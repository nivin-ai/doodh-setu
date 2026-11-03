// Lender desk workflows. Runs as the lender's case officer (row-level security: only this
// lender's applications, and farmer data only in the categories the farmer consented to).
// Every case view that shows farmer data is written to data_access_logs.
import { asSystem, withScope, type Scope } from '../db';
import * as F from '../repositories/finance';
import { providerAction } from './dairyfin';
import * as R from '../repositories';
import type { AppStatus, LenderCase, LenderData } from '../../types/api';
import { addDays, iso, toDate } from '../../util';

export async function getLenderData(scope: Scope): Promise<LenderData> {
  return withScope(scope, async (tx) => {
    const lid = scope.lenderId!;
    const rows = await R.listLenderCases(tx);
    const kind = ((await tx.query<{ k: string }>('select provider_kind k from lenders where lender_id = $1', [lid]))[0]?.k ?? 'lender') as LenderData['lender']['kind'];
    return {
      lender: { id: lid, name: await R.lenderName(tx, lid), kind },
      cases: rows.map((r) => ({
        id: String(r.id), ref: String(r.ref), product: String(r.product), productCode: String(r.product_code ?? ''), amount: Number(r.amount ?? 0), status: r.status as AppStatus,
        updated: new Date(r.last_updated_at as string).toISOString(), background: Boolean(r.is_synthetic),
        applicantType: (r.applicant_type as 'farmer' | 'society') ?? 'farmer', productType: (r.product_type as 'loan' | 'insurance' | 'prepaid') ?? 'loan',
        // identities are only visible with consent; without it the provider sees the reference only
        farmer: r.applicant_type === 'society'
          ? (r.applicant_society ? `Society: ${String(r.applicant_society)}` : 'Society (no consent to identify)')
          : r.farmer_code ? `Member ${String(r.farmer_code)}, ${String(r.society ?? '')}` : 'Member (no consent to identify)',
      })),
      products: (await R.listLoanProducts(tx)).filter((p) => p.lenderId === lid),
      catalogue: (await F.listProducts(tx)).filter((p) => p.providerId === lid),
      policies: await F.listPolicies(tx),
      claims: await F.listClaims(tx),
      audit: await R.listAudit(tx),
    };
  });
}

export async function getLenderCase(scope: Scope, id: string, asOf: string): Promise<LenderCase> {
  const out = await withScope(scope, async (tx) => {
    const owner = await F.applicationOwner(tx, id);
    const view = await F.getAppView(tx, id);
    const { background } = await R.getApplication(tx, id);
    const consent = owner.consentId ? await R.getConsent(tx, owner.consentId) : null;
    const active = consent && consent.status === 'active' ? consent.categories : [];
    const has = (c: string) => active.includes(c);
    const product = view.productCode ? await F.getProduct(tx, view.productCode).catch(() => null) : null;
    const notes = (await tx.query<Record<string, unknown>>(`select occurred_at, actor, action from audit_events where entity_id = $1 and action like 'Note on %' order by occurred_at desc`, [id]))
      .map((r) => ({ at: new Date(r.occurred_at as string).toISOString(), actor: String(r.actor), action: String(r.action) }));
    let farmer: LenderCase['farmer'] = null, kyc = null, property = null, credit = null, income = null, animal: LenderCase['animal'] = null;
    if (owner.type === 'farmer' && owner.farmerId) {
      const fid = owner.farmerId;
      // Row-level security returns nothing for categories without consent; the checks keep the response explicit
      const farmerRow = (await tx.query<Record<string, unknown>>(`select f.farmer_code, coalesce(f.display_name, f.first_name) n, s.name s from farmers f left join societies s on s.society_id = f.society_id where f.farmer_id = $1`, [fid]))[0];
      farmer = farmerRow ? { name: String(farmerRow.n), code: String(farmerRow.farmer_code), society: String(farmerRow.s ?? '') } : null;
      kyc = has('identity_kyc') ? await R.getKyc(tx, fid) : null;
      property = has('land_property') ? await R.getProperty(tx, fid) : null;
      credit = has('credit_history') ? await R.getCredit(tx, fid) : null;
      const inc = has('milk_income') ? await R.monthlyNetIncome(tx, fid, iso(addDays(toDate(asOf), -400)), asOf) : null;
      income = inc ? inc.filter((m) => m.key < asOf.slice(0, 7) || asOf.endsWith('-30') || asOf.endsWith('-31')).slice(-12) : null;
      if (has('livestock') && owner.cattleId) {
        const c = (await tx.query<Record<string, unknown>>('select animal_type, breed, animal_tag_number, health_status from cattle where cattle_id = $1', [owner.cattleId]))[0];
        animal = c ? { type: String(c.animal_type), breed: String(c.breed ?? ''), tag: (c.animal_tag_number as string) ?? null, health: String(c.health_status ?? '') } : null;
      }
    }
    if (active.length) await F.logAccess(tx, { accessor: scope.actor, farmerId: owner.farmerId, societyId: owner.societyId, lenderId: scope.lenderId!, applicationId: id, categories: active, purpose: `Case review ${view.ref}` });
    return { owner, view, background, consent, kyc, property, credit, income, farmer, animal, product, notes, opsAllowed: owner.type === 'society' && has('society_operations') };
  });
  // Society operating figures are aggregates, read only after the consent check above passed
  const society = out.opsAllowed && out.owner.societyId ? await asSystem((tx) => F.societyOperations(tx, out.owner.societyId!, asOf)) : null;
  return {
    application: out.view, consent: out.consent, kyc: out.kyc, property: out.property, credit: out.credit, background: out.background, income: out.income,
    farmer: out.farmer, animal: out.animal, product: out.product, notes: out.notes, society,
  };
}

export async function lenderAction(scope: Scope, body: Record<string, unknown>) {
  return withScope(scope, (tx) => providerAction(tx, scope, body));
}
