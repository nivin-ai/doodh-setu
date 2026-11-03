// DairyFin multi-product engine: one application workflow for every product in the catalogue
// (farmer loans, cattle insurance, society loans), the insurer's policy and claims steps, and the
// simulated consumer milk wallet. Product terms come from loan_products; nothing is hard-coded here.
// Every call runs in withScope(), so row-level security limits each role to its own records.
import { DbError, asSystem, withScope, type Scope, type Tx } from '../db';
import * as R from '../repositories';
import * as F from '../repositories/finance';
import { APP_TRANSITIONS, CLAIM_TRANSITIONS, COOPERATIVE_SAFEGUARDS, WALLET_PLANS, canMove, indicativeEligibility, validateApplication, type ClaimStatus, type FinProduct } from '../../dairyfin';
import type { AppStatus, FarmerFinanceData, SocietyFinanceData, WalletData } from '../../types/api';

const today = () => new Date().toISOString().slice(0, 10);
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const text = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const need = (v: unknown, what: string, max = 500) => { const t = text(v, max); if (!t) throw new DbError(`${what} is required`, 400); return t; };
const numOrNull = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
export const NOTICE = { farmer: 'DF-APP-1.0', society: 'DF-SOC-1.0' } as const;

// Demo authorisation of the society representative (app_users.is_authorised_signatory)
export async function isAuthorisedSignatory(username: string) {
  return asSystem(async (tx) => Boolean((await tx.query<{ a: boolean }>('select is_authorised_signatory a from app_users where username = $1', [username]))[0]?.a));
}

// ---------------------------------------------------------------- reads
export async function getFarmerFinance(scope: Scope, asOf: string): Promise<FarmerFinanceData> {
  const at = isDate(asOf) ? asOf : today();
  return withScope(scope, async (tx) => {
    const fid = scope.farmerId!;
    const [products, applications, consents, policies, claims, facts, cattle] = await Promise.all([
      F.listProducts(tx, 'farmer'), F.listApplications(tx), R.listConsents(tx, fid), F.listPolicies(tx), F.listClaims(tx), F.farmerFacts(tx, fid, at), F.farmerCattle(tx, fid),
    ]);
    return { products, applications, consents, policies, claims, facts, cattle, safeguards: COOPERATIVE_SAFEGUARDS };
  });
}

export async function getSocietyFinance(scope: Scope, signatory: { name: string; authorised: boolean }, asOf: string): Promise<SocietyFinanceData> {
  const at = isDate(asOf) ? asOf : today();
  return withScope(scope, async (tx) => {
    const sid = scope.societyId!;
    const [products, applications, consents, operations] = await Promise.all([F.listProducts(tx, 'society'), F.listApplications(tx), F.listSocietyConsents(tx, sid), F.societyOperations(tx, sid, at)]);
    return { products, applications, consents, operations, facts: { societyRegistered: true, authorised: signatory.authorised }, signatory, safeguards: COOPERATIVE_SAFEGUARDS };
  });
}

// ---------------------------------------------------------------- the application engine (farmers and societies)
interface Applicant { type: 'farmer' | 'society'; farmerId: string | null; societyId: string | null; actor: string; authorised?: boolean }

async function audit(tx: Tx, who: Applicant, action: string, extra: { lenderId?: string | null; entityId?: string | null } = {}) {
  await R.audit(tx, { actor: who.actor, role: who.type === 'farmer' ? 'farmer' : 'secretary', action, farmerId: who.farmerId, societyId: who.societyId, lenderId: extra.lenderId ?? null, entityType: 'loan_application', entityId: extra.entityId ?? null });
}
async function ownApplication(tx: Tx, who: Applicant, id: string) {
  const o = await F.applicationOwner(tx, id); // row-level security: only the applicant's own applications are found
  if (o.type !== who.type || (who.type === 'farmer' ? o.farmerId !== who.farmerId : o.societyId !== who.societyId)) throw new DbError('Application not found', 404);
  return o;
}

async function saveApplication(tx: Tx, who: Applicant, body: Record<string, unknown>) {
  const product = await F.getProduct(tx, need(body.productCode, 'Product', 30));
  if (product.segment !== who.type) throw new DbError('This product is not offered to this applicant', 400);
  if (product.type === 'prepaid') throw new DbError('Use the wallet for this product', 400);
  const submit = body.submit === true;
  const amount = numOrNull(body.amount), tenure = numOrNull(body.tenure);
  const answers = (typeof body.answers === 'object' && body.answers ? body.answers : {}) as Record<string, unknown>;
  for (const k of Object.keys(answers)) if (!product.fields.some((f) => f.id === k)) delete answers[k];
  const docs = Array.isArray(body.docs) ? (body.docs as unknown[]).map(String).filter((d) => product.documents.some((x) => x.id === d)) : [];

  // insurance: the insured animal must be the farmer's own, tagged and not already covered
  let cattleId: string | null = typeof body.cattleId === 'string' && body.cattleId ? body.cattleId : null;
  if (product.type === 'insurance') {
    const animals = await F.farmerCattle(tx, who.farmerId!);
    const a = animals.find((x) => x.id === cattleId);
    if (submit && !a) throw new DbError('Choose the animal to insure', 400);
    if (a?.insured) throw new DbError('This animal already has an active policy', 409);
    if (!a) cattleId = null;
  } else cattleId = null;

  const errors = validateApplication(product, { amount, tenure, answers, docs }, submit);
  if (submit && who.type === 'society' && !who.authorised) errors.push('Only an authorised society representative can submit this application');
  if (submit && who.type === 'society' && body.confirmAuthority !== true) errors.push('Confirm that you are authorised by the society board to apply');
  const consentIn = (body.consent ?? null) as { categories?: unknown; statements?: unknown; language?: unknown } | null;
  const categories = Array.isArray(consentIn?.categories) ? (consentIn!.categories as unknown[]).map(String).filter((c) => product.dataCategories.includes(c)) : [];
  if (submit) {
    if (!consentIn || Number(consentIn.statements) < 3) errors.push('Read and accept the data-sharing notice before submitting');
    if (!categories.length) errors.push('Choose at least one kind of information to share, or the provider cannot assess the application');
  }
  if (errors.length) throw new DbError(errors.join('. '), 400);

  let id = typeof body.id === 'string' && body.id ? body.id : null;
  let ref: string;
  if (id) {
    const o = await ownApplication(tx, who, id);
    if (o.status !== 'draft') throw new DbError('Only a draft can be edited', 409);
    if (o.productCode !== product.id) throw new DbError('The product of a draft cannot change', 400);
    await F.updateApplicationRow(tx, id, { amount, tenure, answers, cattleId });
    ref = (await R.getApplication(tx, id)).app.ref;
  } else {
    ref = await R.nextApplicationRef(tx);
    id = await F.createApplicationRow(tx, {
      applicantType: who.type, farmerId: who.farmerId, societyId: who.societyId, productCode: product.id, lenderId: product.providerId, ref, amount, tenure, rate: product.rate,
      product: product.name, consentId: null, answers, status: 'draft', cattleId, by: who.actor,
    });
    if (!submit) await R.addApplicationEvent(tx, id, 'draft', 'Draft saved', false);
  }
  await R.setDocuments(tx, id, product.documents.map((d) => ({ id: d.id, status: docs.includes(d.id) ? 'received' : 'missing' })));
  if (!submit) { await audit(tx, who, `Saved draft ${ref} (${product.name})`, { entityId: id }); return { ok: true, id, ref, status: 'draft' as AppStatus }; }

  // consent for this application, this recipient and this purpose only
  const purpose = `${product.name} application ${ref}`;
  const consent = who.type === 'farmer'
    ? await R.createConsent(tx, who.farmerId!, {
        recipient: product.provider, lenderId: product.providerId, purpose: purpose.slice(0, 100), scope: categories.join(', '), period: 'Until the application is decided',
        categories, noticeVersion: NOTICE.farmer, method: 'digital', language: (text(consentIn?.language, 5) || undefined) as never, statements: 3,
      })
    : await F.createSocietyConsent(tx, who.societyId!, { lenderId: product.providerId, recipient: product.provider, purpose, categories, noticeVersion: NOTICE.society, productCode: product.id, signedBy: who.actor });
  await F.linkConsent(tx, consent.id, id, product.id);
  await F.updateApplicationRow(tx, id, { consentId: consent.id });
  await R.addApplicationEvent(tx, id, 'submitted', `Sent to ${product.provider}. ${product.provider} reviews and decides.`);
  await F.markSubmitted(tx, id);
  const sref = 'S' + Date.now().toString(36).toUpperCase();
  if (who.type === 'farmer') await R.logSharing(tx, { farmerId: who.farmerId!, applicationId: id, consentId: consent.id, lenderId: product.providerId, categories, purpose: `Assessment of ${ref}`, ref: sref });
  else await F.logSocietySharing(tx, { societyId: who.societyId!, applicationId: id, consentId: consent.id, lenderId: product.providerId, categories, purpose: `Assessment of ${ref}`, ref: sref });
  await audit(tx, who, `Submitted ${ref} (${product.name}) to ${product.provider}; shared ${categories.join(', ')} under consent ${consent.code}`, { lenderId: product.providerId, entityId: id });
  return { ok: true, id, ref, status: 'submitted' as AppStatus };
}

async function applicantAction(tx: Tx, who: Applicant, body: Record<string, unknown>) {
  switch (body.action) {
    case 'save': return saveApplication(tx, who, body);
    case 'uploadDoc': {
      const id = need(body.id, 'Application', 60); const o = await ownApplication(tx, who, id);
      if (['declined', 'withdrawn', 'policy_issued'].includes(o.status)) throw new DbError('This application is closed', 409);
      const product = await F.getProduct(tx, o.productCode);
      const doc = product.documents.find((d) => d.id === body.doc);
      if (!doc) throw new DbError('Unknown document for this product', 400);
      await R.setDocuments(tx, id, [{ id: doc.id, status: 'received' }]);
      if (o.status !== 'draft') await R.addApplicationEvent(tx, id, o.status, `${doc.label} uploaded (simulated)`, false);
      await audit(tx, who, `Uploaded ${doc.label} (simulated) for application`, { entityId: id });
      return { ok: true };
    }
    case 'respond': {
      const id = need(body.id, 'Application', 60); const o = await ownApplication(tx, who, id);
      if (o.status !== 'more_info') throw new DbError('No information was requested', 409);
      await R.addApplicationEvent(tx, id, 'in_review', `Applicant replied: ${need(body.note, 'Reply', 1000)}`);
      await audit(tx, who, 'Replied to a request for more information', { entityId: id });
      return { ok: true };
    }
    case 'withdraw': {
      const id = need(body.id, 'Application', 60); const o = await ownApplication(tx, who, id);
      if (!canMove(o.status, 'withdrawn')) throw new DbError('This application can no longer be withdrawn', 409);
      await R.addApplicationEvent(tx, id, 'withdrawn', o.status === 'draft' ? 'Draft discarded' : 'Withdrawn by the applicant. Data sharing for it has stopped.');
      if (o.consentId) await withdrawConsentRow(tx, who, o.consentId).catch(() => undefined);
      await audit(tx, who, 'Withdrew application', { entityId: id });
      return { ok: true };
    }
    case 'offer': {
      const id = need(body.id, 'Application', 60); await ownApplication(tx, who, id);
      const v = await F.getAppView(tx, id);
      if (v.offerStatus !== 'pending') throw new DbError('There is no open offer', 409);
      const accept = body.decision === 'accept';
      await F.setOffer(tx, id, null, accept ? 'accepted' : 'declined');
      await R.addApplicationEvent(tx, id, v.status, accept ? 'Applicant accepted the indicative offer. The provider completes its own checks and sanction.' : 'Applicant declined the offer', false);
      await audit(tx, who, `${accept ? 'Accepted' : 'Declined'} offer on ${v.ref}`, { lenderId: v.lenderId, entityId: id });
      return { ok: true };
    }
    case 'withdrawConsent': {
      const code = await withdrawConsentRow(tx, who, need(body.consentId, 'Consent', 60));
      await audit(tx, who, `Withdrew consent ${code}`);
      return { ok: true };
    }
  }
  return null;
}

// Withdrawal takes effect at once: the provider's row-level access depends on consent_status = 'granted'
async function withdrawConsentRow(tx: Tx, who: Applicant, consentId: string) {
  const r = who.type === 'farmer' ? await R.withdrawConsent(tx, who.farmerId!, consentId) : await F.withdrawSocietyConsent(tx, who.societyId!, consentId);
  const app = (await tx.query<{ id: string; s: AppStatus }>('select application_id::text id, application_status s from loan_applications where consent_id = $1', [consentId]))[0];
  if (app) await R.addApplicationEvent(tx, app.id, app.s, `Consent ${r.consent_code} withdrawn. The provider can no longer see the shared information.`, false);
  return r.consent_code;
}

export async function farmerFinanceAction(scope: Scope, body: Record<string, unknown>) {
  return withScope(scope, async (tx) => {
    const fid = scope.farmerId!;
    const who: Applicant = { type: 'farmer', farmerId: fid, societyId: null, actor: scope.actor };
    const out = await applicantAction(tx, who, body);
    if (out) return out;
    const log = (action: string) => R.audit(tx, { actor: scope.actor, role: 'farmer', action, farmerId: fid, entityType: 'insurance' });
    switch (body.action) {
      case 'claim': {
        const policy = (await F.listPolicies(tx)).find((p) => p.id === body.policyId);
        if (!policy || policy.status !== 'active') throw new DbError('Choose an active policy', 400);
        const product = policy.productCode ? await F.getProduct(tx, policy.productCode) : null;
        const reason = need(body.reason, 'Reason', 60);
        if (product && product.claimReasons.length && !product.claimReasons.includes(reason)) throw new DbError('Choose one of the listed reasons', 400);
        if (!isDate(body.date) || body.date > today()) throw new DbError('Enter the date of the incident', 400);
        const id = await F.createClaim(tx, { farmerId: fid, policyId: policy.id, reason, date: body.date, description: need(body.description, 'Description', 1000), amount: numOrNull(body.amount),
          docs: Array.isArray(body.docs) ? (body.docs as unknown[]).map(String).slice(0, 10) : [], actor: scope.actor });
        await log(`Submitted a claim on policy ${policy.number}`);
        return { ok: true, id };
      }
      case 'claimRespond': {
        const id = need(body.claimId, 'Claim', 60); const c = await F.getClaim(tx, id);
        if (c.status !== 'more_info') throw new DbError('No information was requested', 409);
        await F.claimEvent(tx, id, 'in_review', `Farmer replied: ${need(body.note, 'Reply', 1000)}`, scope.actor, true);
        return { ok: true };
      }
      case 'claimWithdraw': {
        const id = need(body.claimId, 'Claim', 60); const c = await F.getClaim(tx, id);
        if (!CLAIM_TRANSITIONS[c.status as ClaimStatus]?.includes('withdrawn')) throw new DbError('This claim can no longer be withdrawn', 409);
        await F.claimEvent(tx, id, 'withdrawn', 'Withdrawn by the farmer', scope.actor, true);
        return { ok: true };
      }
      case 'renew': {
        const policy = (await F.listPolicies(tx)).find((p) => p.id === body.policyId);
        if (!policy) throw new DbError('Policy not found', 404);
        await F.policyRenewal(tx, policy.id, 'requested');
        await log(`Asked ${policy.insurer} to renew policy ${policy.number}`);
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}

export async function societyFinanceAction(scope: Scope, authorised: boolean, body: Record<string, unknown>) {
  return withScope(scope, async (tx) => {
    const out = await applicantAction(tx, { type: 'society', farmerId: null, societyId: scope.societyId!, actor: scope.actor, authorised }, body);
    if (out) return out;
    throw new DbError('Unknown action', 400);
  });
}

// ---------------------------------------------------------------- provider side (lender or insurer)
const TERMINAL: AppStatus[] = ['declined', 'withdrawn', 'policy_issued'];
export async function providerAction(tx: Tx, scope: Scope, body: Record<string, unknown>) {
  const lid = scope.lenderId!;
  const audit = (action: string, entityType = 'loan_application', entityId: string | null = null) => R.audit(tx, { actor: scope.actor, role: 'lender', action, lenderId: lid, entityType, entityId });
  if (body.action === 'claimStatus') {
    const id = need(body.claimId, 'Claim', 60); const c = await F.getClaim(tx, id);
    const to = String(body.status) as ClaimStatus;
    if (!CLAIM_TRANSITIONS[c.status as ClaimStatus]?.includes(to) || to === 'withdrawn') throw new DbError(`A ${c.status} claim cannot move to ${to}`, 409);
    const note = text(body.note, 1000);
    if ((to === 'more_info' || to === 'declined') && !note) throw new DbError('Add a note for the farmer', 400);
    if (to === 'approved') await F.setClaimApproved(tx, id, numOrNull(body.amount));
    await F.claimEvent(tx, id, to, note || (to === 'settled' ? 'Settlement recorded (simulated, no payment made)' : ''), scope.actor, true);
    await audit(`Claim ${c.ref}: ${to}${note ? ': ' + note : ''}`, 'insurance_claim', id);
    return { ok: true };
  }
  if (body.action === 'renewal') {
    const policyId = need(body.policyId, 'Policy', 60);
    const st = body.decision === 'renew' ? 'renewed' : 'not_renewed';
    await F.policyRenewal(tx, policyId, st);
    if (st === 'renewed') await tx.query(`update insurance_policies set policy_end_date = policy_end_date + 365 where policy_id = $1`, [policyId]);
    await audit(`Policy renewal: ${st}`, 'insurance_policy', policyId);
    return { ok: true };
  }
  const id = need(body.id, 'Application', 60);
  const v = await F.getAppView(tx, id); // row-level security: only applications sent to this provider
  if (v.lenderId !== lid) throw new DbError('Application not found', 404);
  const consent = v.consentCode ? (await tx.query<{ s: string }>('select consent_status s from consent_records where application_id = $1 order by granted_at desc limit 1', [id]))[0]?.s : null;
  const consentActive = consent === 'granted';
  switch (body.action) {
    case 'status': {
      const to = String(body.status) as AppStatus;
      if (!['in_review', 'more_info', 'approved', 'declined'].includes(to) || !canMove(v.status, to)) throw new DbError(`A ${v.status} application cannot move to ${to}`, 409);
      const note = text(body.note, 1000);
      if ((to === 'more_info' || to === 'declined') && !note) throw new DbError('Add a note for the applicant', 400);
      if (to === 'approved' && !consentActive) throw new DbError('The applicant has withdrawn consent. You cannot approve on shared data.', 409);
      await R.addApplicationEvent(tx, id, to, note);
      if (to === 'approved' || to === 'declined') await tx.query('update loan_applications set decided_at = now() where application_id = $1', [id]);
      await audit(`Set ${v.ref} to ${to}${note ? ': ' + note : ''}`, 'loan_application', id);
      return { ok: true };
    }
    case 'requestDoc': // older desk button
    case 'requestInfo': {
      if (!canMove(v.status, 'more_info')) throw new DbError('Information can only be requested while the application is open', 409);
      const product = await F.getProduct(tx, v.productCode);
      const ids = body.action === 'requestDoc' ? ['quote'] : Array.isArray(body.docs) ? (body.docs as unknown[]).map(String) : [];
      const docs = product.documents.filter((d) => ids.includes(d.id));
      const note = text(body.note, 1000) || (docs.length ? `Please upload: ${docs.map((d) => d.label).join(', ')}` : '');
      if (!note) throw new DbError('Say what information is needed', 400);
      if (docs.length) await R.setDocuments(tx, id, docs.map((d) => ({ id: d.id, status: 'requested' })));
      await R.addApplicationEvent(tx, id, 'more_info', note);
      await audit(`Requested more information on ${v.ref}: ${note}`, 'loan_application', id);
      return { ok: true };
    }
    case 'offer': {
      if (TERMINAL.includes(v.status) || v.status === 'more_info') throw new DbError('An offer can be made while the application is in review or approved', 409);
      if (!consentActive) throw new DbError('The applicant has withdrawn consent', 409);
      const offer = { amount: numOrNull(body.amount) ?? undefined, rate: numOrNull(body.rate) ?? undefined, tenure: numOrNull(body.tenure) ?? undefined, notes: text(body.notes, 500) || undefined };
      if (!offer.amount && v.productType === 'loan') throw new DbError('Offer amount is required', 400);
      if (v.status === 'submitted') await R.addApplicationEvent(tx, id, 'in_review', 'Under review');
      await F.setOffer(tx, id, offer, 'pending');
      await R.addApplicationEvent(tx, id, v.status === 'submitted' ? 'in_review' : v.status, 'Indicative offer sent. It is not a sanction.', false);
      await audit(`Sent an indicative offer on ${v.ref}`, 'loan_application', id);
      return { ok: true };
    }
    case 'note': {
      await audit(`Note on ${v.ref}: ${need(body.note, 'Note', 1000)}`, 'loan_application', id);
      return { ok: true };
    }
    case 'issuePolicy': {
      if (v.productType !== 'insurance') throw new DbError('Only insurance applications become policies', 400);
      if (v.status !== 'approved') throw new DbError('Approve the application before issuing the policy', 409);
      if (!consentActive) throw new DbError('The applicant has withdrawn consent', 409);
      const owner = await F.applicationOwner(tx, id);
      const start = today(); const end = new Date(Date.now() + 364 * 86400000).toISOString().slice(0, 10);
      const sum = numOrNull(body.sumInsured) ?? numOrNull(v.answers.sum_insured);
      const number = `DEMO-POL-${v.ref.replace(/^DF-/, '')}`;
      await F.issuePolicy(tx, { applicationId: id, farmerId: owner.farmerId!, insurerId: lid, insurer: v.lender, number, sumInsured: sum, premium: numOrNull(body.premium), start, end, cattleId: owner.cattleId });
      await R.addApplicationEvent(tx, id, 'policy_issued', `Policy ${number} issued (simulated). Cover ${start} to ${end}.`);
      await audit(`Issued policy ${number} for ${v.ref}`, 'loan_application', id);
      return { ok: true, number };
    }
  }
  throw new DbError('Unknown action', 400);
}
void APP_TRANSITIONS; void indicativeEligibility;

// ---------------------------------------------------------------- consumer wallet (simulated payments only)
export async function getWallet(scope: Scope): Promise<WalletData> {
  return withScope(scope, async (tx) => {
    const w = await F.walletState(tx, scope.consumerId!);
    const product = (await F.listProducts(tx, 'consumer'))[0] ?? null;
    return { ...w, product };
  });
}
const PLANS = Object.fromEntries(WALLET_PLANS.map((p) => [p.id, p]));
export async function walletAction(scope: Scope, body: Record<string, unknown>) {
  return withScope(scope, async (tx) => {
    const cid = scope.consumerId!;
    const w = await F.walletState(tx, cid);
    const product = (await F.listProducts(tx, 'consumer'))[0];
    if (!product) throw new DbError('The wallet product is not configured', 503);
    switch (body.action) {
      case 'subscribe': {
        const plan = PLANS[String(body.plan)]; if (!plan) throw new DbError('Choose a plan', 400);
        if (w.subscription) await tx.query(`update wallet_subscriptions set status = 'cancelled' where subscription_id = $1`, [w.subscription.id]);
        await tx.query(`insert into wallet_subscriptions (consumer_id, product_code, channel, plan, price_per_day, renews_on) values ($1,$2,$3,$4,$5, current_date + 30)`,
          [cid, product.id, need(body.channel, 'Channel', 40), plan.label, plan.perDay]);
        return { ok: true };
      }
      case 'topup': {
        const amt = Number(body.amount);
        if (!(amt >= (product.min ?? 1) && amt <= (product.max ?? 5000))) throw new DbError(`Top-up must be between Rs ${product.min} and Rs ${product.max}`, 400);
        await F.walletAdd(tx, cid, 'topup', amt, 'Top-up (simulated payment, no money collected)');
        return { ok: true };
      }
      case 'deliver': {
        if (!w.subscription || w.subscription.status !== 'active') throw new DbError('No active subscription', 409);
        if (w.balance < w.subscription.pricePerDay) throw new DbError('Balance too low. Top up first.', 409);
        await F.walletAdd(tx, cid, 'purchase', w.subscription.pricePerDay, `${w.subscription.plan} delivered (simulated)`);
        return { ok: true };
      }
      case 'pause': case 'resume': case 'cancel': {
        if (!w.subscription) throw new DbError('No subscription', 409);
        const st = body.action === 'pause' ? 'paused' : body.action === 'resume' ? 'active' : 'cancelled';
        await tx.query('update wallet_subscriptions set status = $2 where subscription_id = $1', [w.subscription.id, st]);
        return { ok: true };
      }
      case 'renew': {
        if (!w.subscription) throw new DbError('No subscription', 409);
        await tx.query(`update wallet_subscriptions set renews_on = greatest(coalesce(renews_on, current_date), current_date) + 30, status = 'active' where subscription_id = $1`, [w.subscription.id]);
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}
export type { FinProduct };
