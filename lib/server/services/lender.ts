// Lender desk workflows. Runs as the lender's case officer (row-level security: only this
// lender's applications, and farmer data only in the categories the farmer consented to).
// Every case view that shows farmer data is written to data_access_logs.
import { asSystem, DbError, withScope, type Scope } from '../db';
import * as R from '../repositories';
import type { AppStatus, LenderCase, LenderData, LoanDossier } from '../../types/api';
import { fin, NOTICE_VERSION } from '../../finance';
import { addDays, iso, toDate } from '../../util';

export async function getLenderData(scope: Scope): Promise<LenderData> {
  const data = await withScope(scope, async (tx) => {
    const lid = scope.lenderId!;
    const rows = await R.listLenderCases(tx);
    return {
      lender: { id: lid, name: await R.lenderName(tx, lid) },
      cases: rows.map((r) => ({
        id: String(r.id), ref: String(r.ref), product: String(r.product), amount: Number(r.amount), status: r.status as AppStatus,
        updated: new Date(r.last_updated_at as string).toISOString(), background: Boolean(r.is_synthetic),
        submitted: r.submitted_at ? new Date(r.submitted_at as string).toISOString() : null,
        consent: (r.consent_status === 'granted' ? 'active' : r.consent_status === 'withdrawn' ? 'withdrawn' : 'none') as 'active' | 'withdrawn' | 'none',
        dossierGenerated: Boolean(r.dossier_generated),
        // the farmer row is only visible with consent; without it the lender sees the reference only
        farmer: r.farmer_code ? `Member ${String(r.farmer_code)}` : 'Member (no consent to identify)',
        societyId: (r.society_id as string) ?? null,
      })),
      products: await (async () => {
        const counts = await R.productApplicationCounts(tx);
        return (await R.listLoanProducts(tx)).filter((p) => p.lenderId === lid).map((p) => ({ ...p, applications: counts.get(p.id) ?? 0 }));
      })(),
      audit: await R.listAudit(tx),
    };
  });
  const names = await asSystem((tx) => R.societyNames(tx, [...new Set(data.cases.map((c) => c.societyId).filter((x): x is string => !!x))]));
  return {
    ...data,
    cases: data.cases.map(({ societyId, ...c }) => ({ ...c, farmer: societyId && names.get(societyId) ? `${c.farmer}, ${names.get(societyId)!.name}` : c.farmer })),
  };
}

export async function getLenderCase(scope: Scope, id: string, asOf: string, opts: { dossier?: boolean } = {}): Promise<LenderCase> {
  let farmerIdOut = '';
  let societyIdOut = '';
  const out = await withScope(scope, async (tx): Promise<LenderCase> => {
    const { app, farmerId, consentId, background } = await R.getApplication(tx, id);
    const consent = consentId ? await R.getConsent(tx, consentId) : null;
    const active = consent && consent.status === 'active' ? consent.categories : [];
    const has = (c: string) => active.includes(c);
    // Row-level security returns nothing for categories without consent; the checks here keep the response explicit
    const farmerRow = (await tx.query<Record<string, unknown>>(`select f.farmer_code, coalesce(f.display_name, f.first_name) n, s.name s from farmers f left join societies s on s.society_id = f.society_id where f.farmer_id = $1`, [farmerId]))[0];
    const kyc = has('identity_kyc') ? await R.getKyc(tx, farmerId) : null;
    const property = has('land_property') ? await R.getProperty(tx, farmerId) : null;
    const credit = has('credit_history') ? await R.getCredit(tx, farmerId) : null;
    const income = has('milk_income') ? await R.monthlyNetIncome(tx, farmerId, iso(addDays(toDate(asOf), -400)), asOf) : null;
    if (active.length) {
      await R.logDataAccess(tx, { accessor: scope.actor, farmerId, lenderId: scope.lenderId!, applicationId: app.id, categories: active, purpose: `Case review ${app.ref}` });
    }
    farmerIdOut = farmerId;
    let dossier: LoanDossier | undefined;
    if (opts.dossier) {
      const d = await R.dossierApplicant(tx, farmerId, app.id);
      societyIdOut = d.farmer?.societyId ?? '';
      const idOk = has('identity_kyc');
      dossier = {
        asOf, lenderName: await R.lenderName(tx, scope.lenderId!),
        applicant: {
          name: d.farmer?.name ?? null, code: d.farmer?.code ?? null,
          // date of birth, gender and mobile are identity details: only with identity_kyc consent
          dob: idOk ? d.farmer?.dob ?? null : null, gender: idOk ? d.farmer?.gender ?? null : null,
          mobile: idOk ? d.farmer?.mobile ?? null : null, mobileVerified: idOk ? d.farmer?.mobileVerified ?? null : null,
        },
        address: d.address,
        cooperative: { society: d.farmer?.society ?? null, societyCode: d.farmer?.societyCode ?? null, union: d.farmer?.union ?? null, memberSince: d.farmer?.memberSince ?? null },
        cattle: null,
        submittedAt: d.submittedAt,
        consentStatements: consent && consent.noticeVersion === NOTICE_VERSION ? [...fin('en').statements] : null,
        generatedCount: d.generatedCount,
      };
    }
    return {
      application: app, consent, kyc, property, credit, background, dossier,
      income: income ? income.filter((m) => m.key < asOf.slice(0, 7) || asOf.endsWith('-30') || asOf.endsWith('-31')).slice(-12) : null,
      farmer: farmerRow ? { name: String(farmerRow.n), code: String(farmerRow.farmer_code), society: String(farmerRow.s ?? '') } : null,
    };
  });
  // Herd size for the dossier: animal counts and estimated yield only (no animal health records,
  // BR-25), read with the server's rights and only while the farmer's consent to share milk and
  // dairy data with this lender is active.
  if (out.dossier && societyIdOut) {
    const soc = (await asSystem((tx) => R.societyNames(tx, [societyIdOut]))).get(societyIdOut);
    if (soc) {
      out.dossier.cooperative.society = soc.name;
      out.dossier.cooperative.societyCode = soc.code;
      if (out.farmer) out.farmer.society = soc.name;
    }
  }
  if (out.dossier && out.consent?.status === 'active' && out.consent.categories.includes('milk_income')) {
    const rows = await asSystem((tx) => tx.query<{ t: string; n: number; y: string }>(`select animal_type t, count(*)::int n, coalesce(sum(estimated_daily_yield), 0) y
      from cattle where farmer_id = $1 and coalesce(cattle_status, 'active') = 'active' group by 1`, [farmerIdOut]));
    if (rows.length) {
      const get = (t: string) => rows.find((r) => r.t === t)?.n ?? 0;
      out.dossier.cattle = { buffalo: get('buffalo'), cow: get('cow'), estimatedDailyYield: Math.round(rows.reduce((x, r) => x + Number(r.y), 0) * 10) / 10 };
    }
  }
  return out;
}

export const PRODUCT_PURPOSES = ['cattle', 'feed', 'equipment', 'shed', 'working_capital', 'other'] as const;

// New loan products from the lender desk. The database lets lenders read products but not write
// them (supabase/migrations/0003_access_control.sql), so the server writes with its own rights after
// checking the signed-in lender here: the product always belongs to that lender, and a lender can
// remove only its own desk-created products that no farmer has applied for.
async function productAction(scope: Scope, body: Record<string, unknown>) {
  if (scope.role !== 'lender' || !scope.lenderId) throw new DbError('Only a lender can manage products', 403);
  const lid = scope.lenderId;
  if (body.action === 'removeProduct') {
    const code = String(body.code ?? '').slice(0, 20);
    return asSystem(async (tx) => {
      const rows = await tx.query<{ name: string }>(`delete from loan_products p where p.product_code = $1 and p.lender_id = $2 and not p.is_synthetic
        and not exists (select 1 from loan_applications a where a.loan_product_id = p.loan_product_id) returning product_name name`, [code, lid]);
      if (!rows.length) throw new DbError('This product cannot be removed (it is not yours, came with the demo, or farmers have applied for it)', 409);
      await R.audit(tx, { actor: scope.actor, role: 'lender', action: `Removed loan product ${rows[0].name} (${code})`, lenderId: lid, entityType: 'loan_product' });
      return { ok: true };
    });
  }
  const p = (body.product ?? {}) as Record<string, unknown>;
  const name = String(p.name ?? '').trim().replace(/\s+/g, ' ');
  const purpose = String(p.purpose ?? '');
  const min = Math.round(Number(p.min)), max = Math.round(Number(p.max));
  const rate = Math.round(Number(p.rate) * 100) / 100, tenure = Math.round(Number(p.maxTenure)), fee = Math.round(Number(p.feePct) * 100) / 100;
  const elig = String(p.elig ?? '').trim().replace(/\s+/g, ' ').slice(0, 300);
  const problems = [
    name.length < 3 || name.length > 80 ? 'Product name must be 3 to 80 characters' : '',
    !(PRODUCT_PURPOSES as readonly string[]).includes(purpose) ? 'Choose a purpose' : '',
    !(min >= 1000) ? 'Minimum amount must be at least ₹1,000' : '',
    !(max <= 5000000) ? 'Maximum amount can be at most ₹50,00,000' : '',
    !(max > min) ? 'Maximum amount must be more than the minimum' : '',
    !(rate > 0 && rate <= 36) ? 'Interest rate must be between 0 and 36% a year' : '',
    !(tenure >= 3 && tenure <= 120) ? 'Tenure must be 3 to 120 months' : '',
    !(fee >= 0 && fee <= 10) ? 'Processing fee must be 0 to 10%' : '',
    !elig ? 'Add who is eligible' : '',
  ].filter(Boolean);
  if (problems.length) throw new DbError(problems.join('. '), 400);
  return asSystem(async (tx) => {
    const dup = await tx.query('select 1 from loan_products where lender_id = $1 and lower(product_name) = lower($2)', [lid, name]);
    if (dup.length) throw new DbError('You already have a product with this name', 409);
    const code = 'P' + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase();
    await tx.query(`insert into loan_products (lender_id, product_code, product_name, purpose, min_amount, max_amount, interest_rate, max_tenure_months, fee_pct, eligibility, is_synthetic)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,false)`, [lid, code, name, purpose, min, max, rate, tenure, fee, elig]);
    await R.audit(tx, { actor: scope.actor, role: 'lender', action: `Created loan product ${name} (${code}): ₹${min}-₹${max}, ${rate}%, up to ${tenure} months`, lenderId: lid, entityType: 'loan_product' });
    return { ok: true, code };
  });
}

export async function lenderAction(scope: Scope, body: Record<string, unknown>) {
  if (body.action === 'createProduct' || body.action === 'removeProduct') return productAction(scope, body);
  return withScope(scope, async (tx) => {
    const id = String(body.id ?? '');
    const { app } = await R.getApplication(tx, id);
    const log = (action: string) => R.audit(tx, { actor: scope.actor, role: 'lender', action, lenderId: scope.lenderId, entityType: 'loan_application', entityId: id });
    switch (body.action) {
      case 'status': {
        const status = String(body.status) as AppStatus;
        if (!['in_review', 'approved', 'declined'].includes(status)) throw new DbError('Status not allowed', 400);
        const note = String(body.note ?? '').slice(0, 500);
        await R.addApplicationEvent(tx, id, status, note);
        await log(`Set ${app.ref} to ${status}${note ? ': ' + note : ''}`);
        return { ok: true };
      }
      case 'dossier': {
        // Audit trail for the bank-ready PDF: generated (preview or download) or shared
        const mode = body.mode === 'shared' ? 'Shared' : body.mode === 'downloaded' ? 'Downloaded' : 'Generated';
        await R.audit(tx, { actor: scope.actor, role: 'lender', action: `${mode} loan dossier PDF for ${app.ref}`, lenderId: scope.lenderId, entityType: 'loan_dossier', entityId: id });
        return { ok: true };
      }
      case 'requestDoc': {
        await R.setDocuments(tx, id, [{ id: 'quote', status: 'requested' }]);
        await R.addApplicationEvent(tx, id, 'more_info', 'Please upload a cattle purchase quote');
        await log(`Requested cattle purchase quote on ${app.ref}`);
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}
