// Lender desk workflows. Runs as the lender's case officer (row-level security: only this
// lender's applications, and farmer data only in the categories the farmer consented to).
// Every case view that shows farmer data is written to data_access_logs.
import { DbError, withScope, type Scope } from '../db';
import * as R from '../repositories';
import type { AppStatus, LenderCase, LenderData } from '../../types/api';
import { addDays, iso, toDate } from '../../util';

export async function getLenderData(scope: Scope): Promise<LenderData> {
  return withScope(scope, async (tx) => {
    const lid = scope.lenderId!;
    const rows = await R.listLenderCases(tx);
    return {
      lender: { id: lid, name: await R.lenderName(tx, lid) },
      cases: rows.map((r) => ({
        id: String(r.id), ref: String(r.ref), product: String(r.product), amount: Number(r.amount), status: r.status as AppStatus,
        updated: new Date(r.last_updated_at as string).toISOString(), background: Boolean(r.is_synthetic),
        // the farmer row is only visible with consent; without it the lender sees the reference only
        farmer: r.farmer_code ? `Member ${String(r.farmer_code)}, ${String(r.society ?? '')}` : 'Member (no consent to identify)',
      })),
      products: (await R.listLoanProducts(tx)).filter((p) => p.lenderId === lid),
      audit: await R.listAudit(tx),
    };
  });
}

export async function getLenderCase(scope: Scope, id: string, asOf: string): Promise<LenderCase> {
  return withScope(scope, async (tx) => {
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
    return {
      application: app, consent, kyc, property, credit, background,
      income: income ? income.filter((m) => m.key < asOf.slice(0, 7) || asOf.endsWith('-30') || asOf.endsWith('-31')).slice(-12) : null,
      farmer: farmerRow ? { name: String(farmerRow.n), code: String(farmerRow.farmer_code), society: String(farmerRow.s ?? '') } : null,
    };
  });
}

export async function lenderAction(scope: Scope, body: Record<string, unknown>) {
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
