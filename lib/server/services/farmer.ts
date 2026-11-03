// Farmer app workflows. Runs as the signed-in farmer (row-level security: own records only).
import { DbError, withScope, type Scope } from '../db';
import * as R from '../repositories';
import type { FarmerData } from '../../types/api';
import type { DocId } from '../../types/api';
import { NOTICE_VERSION } from '../../finance';

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const str = (v: unknown, max = 500) => { if (typeof v !== 'string' || !v.trim()) throw new DbError('Missing text', 400); return v.trim().slice(0, max); };

export async function getFarmerData(scope: Scope, asOf: string): Promise<FarmerData> {
  if (!isDate(asOf)) throw new DbError('asOf must be YYYY-MM-DD', 400);
  return withScope(scope, async (tx) => {
    const fid = scope.farmerId!;
    const profile = await R.getFarmerProfile(tx, fid);
    const [sessions, program, queries, consents, application, products, kyc, property, credit] = await Promise.all([
      R.listSessions(tx, fid, asOf), R.latestProgram(tx), R.listQueries(tx), R.listConsents(tx, fid), R.latestApplicationForFarmer(tx, fid),
      R.listLoanProducts(tx), R.getKyc(tx, fid), R.getProperty(tx, fid), R.getCredit(tx, fid),
    ]);
    const published = program && program.status === 'published' ? program : null;
    const resp = published ? await R.getResponse(tx, published.id, fid) : { heardOn: null, interestedOn: null };
    return {
      asOf, profile, sessions,
      premium: published ? { programId: published.id, rate: published.rate, from: published.from, to: published.to } : null,
      response: { heard: !!resp.heardOn, interested: !!resp.interestedOn },
      queries, consents, application,
      finance: { kyc, property, credit, products },
    };
  });
}

export async function farmerAction(scope: Scope, body: Record<string, unknown>) {
  const fid = scope.farmerId!;
  const asOf = isDate(body.asOf) ? body.asOf : new Date().toISOString().slice(0, 10);
  return withScope(scope, async (tx) => {
    const log = (action: string, extra: Partial<Parameters<typeof R.audit>[1]> = {}) => R.audit(tx, { actor: scope.actor, role: 'farmer', action, farmerId: fid, ...extra });
    switch (body.action) {
      case 'heard':
      case 'interested': {
        const p = await R.latestProgram(tx);
        if (!p || p.status !== 'published') throw new DbError('No published signal', 409);
        await R.upsertOwnResponse(tx, p.id, fid, body.action === 'heard' ? 'heard_on' : 'interested_on', asOf);
        if (body.action === 'interested') {
          const prof = await R.getFarmerProfile(tx, fid);
          await log(`Tapped "I'm interested" on the summer premium`, { societyId: prof.society.id, entityType: 'incentive_program', entityId: p.id });
        }
        return { ok: true };
      }
      case 'ask': {
        const prof = await R.getFarmerProfile(tx, fid);
        const id = await R.createQuery(tx, fid, prof.society.id, String(body.lang ?? prof.language), str(body.text, 2000));
        return { ok: true, id };
      }
      case 'followUp': await R.addMessage(tx, str(body.queryId, 60), 'farmer', str(body.text, 2000)); return { ok: true };
      case 'markSeen': await R.markQueriesSeen(tx, fid); return { ok: true };
      case 'correction': {
        await R.requestCorrection(tx, fid);
        const prof = await R.getFarmerProfile(tx, fid);
        await R.createQuery(tx, fid, prof.society.id, String(body.lang ?? prof.language), 'Data correction request');
        return { ok: true };
      }
      case 'grantConsent': {
        const c = (body.consent ?? {}) as Record<string, unknown>;
        const recipient = str(c.recipient, 255);
        const lenderId = await R.lenderByName(tx, recipient);
        const out = await R.createConsent(tx, fid, {
          recipient, lenderId, purpose: str(c.purpose, 100), scope: String(c.scope ?? ''), period: String(c.period ?? ''),
          categories: Array.isArray(c.categories) ? (c.categories as string[]).slice(0, 10) : ['milk_income'], noticeVersion: (c.noticeVersion as string) ?? undefined,
          method: c.method === 'assisted' ? 'assisted' : 'digital', language: (c.language as never) ?? undefined, statements: typeof c.statements === 'number' ? c.statements : undefined,
        });
        await log(`Granted consent ${out.code} to ${recipient} for "${String(c.purpose)}"${c.noticeVersion ? ` (notice ${String(c.noticeVersion)})` : ''}`, { lenderId });
        return { ok: true, ...out };
      }
      case 'withdrawConsent': {
        const r = await R.withdrawConsent(tx, fid, str(body.consentId, 60));
        await log(`Withdrew consent ${r.consent_code}`);
        return { ok: true };
      }
      case 'apply': {
        const a = (body.application ?? {}) as Record<string, unknown>;
        const products = await R.listLoanProducts(tx);
        const product = products.find((p) => p.id === a.productCode);
        if (!product) throw new DbError('Unknown loan product', 400);
        const amount = Number(a.amount), tenure = Number(a.tenure);
        if (!(amount >= product.min && amount <= product.max) || !(tenure >= 1 && tenure <= product.maxTenure)) throw new DbError('Amount or tenure outside the product limits', 400);
        const consent = typeof a.loanConsentId === 'string' ? await R.getConsent(tx, a.loanConsentId) : null;
        const lc = consent && consent.status === 'active' && consent.lenderId === product.lenderId ? consent : null;
        const ref = await R.nextApplicationRef(tx);
        const id = await R.createApplication(tx, { farmerId: fid, lenderId: product.lenderId, productCode: product.id, ref, amount, tenure, rate: product.rate, product: product.name, consentId: lc?.id ?? null });
        await R.addApplicationEvent(tx, id, 'submitted', 'Application received by the bank', false);
        const have = !!lc;
        const docs: { id: DocId; status: string }[] = [{ id: 'kyc', status: have ? 'received' : 'missing' }, { id: 'land', status: have ? 'received' : 'missing' }, { id: 'credit', status: have ? 'received' : 'missing' }, { id: 'id', status: 'received' }, { id: 'bank', status: 'received' }, { id: 'quote', status: 'missing' }];
        await R.setDocuments(tx, id, docs);
        await log(`Submitted application ${ref} to ${product.lender}`, { lenderId: product.lenderId, entityType: 'loan_application', entityId: id });
        if (lc) {
          const sref = 'S' + Date.now().toString(36).toUpperCase();
          await R.logSharing(tx, { farmerId: fid, applicationId: id, consentId: lc.id, lenderId: product.lenderId, categories: lc.categories, purpose: 'Loan assessment and processing', ref: sref });
          await R.audit(tx, { actor: scope.actor, role: 'farmer', action: `DairyFin shared ${lc.categories.join(', ')} with ${product.lender} under consent ${lc.code} (${sref})`, farmerId: fid, lenderId: product.lenderId });
        }
        return { ok: true, id, ref };
      }
      case 'uploadDoc': {
        const app = await R.latestApplicationForFarmer(tx, fid);
        if (!app) throw new DbError('No application', 404);
        await R.setDocuments(tx, app.id, [{ id: 'quote', status: 'received' }]);
        await R.addApplicationEvent(tx, app.id, 'in_review', 'Document received; back in review');
        await log(`Uploaded cattle purchase quote for ${app.ref}`, { lenderId: app.lenderId });
        return { ok: true };
      }
      case 'withdrawApplication': {
        const app = await R.latestApplicationForFarmer(tx, fid);
        if (!app) throw new DbError('No application', 404);
        await R.addApplicationEvent(tx, app.id, 'withdrawn', 'Withdrawn by farmer');
        await log(`Withdrew application ${app.ref}`, { lenderId: app.lenderId });
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}
void NOTICE_VERSION;
