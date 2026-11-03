// DairyFin data access: product catalogue, multi-product applications, insurance policies and
// claims, and the simulated consumer wallet. Row-level security scopes every query.
import { DbError, n0, num, type Tx } from '../db';
import type { FinProduct } from '../../dairyfin';
import type { AppView, ClaimView, PolicyView } from '../../types/api';
import { getApplication, toConsent } from './index';

const j = <T>(v: unknown, d: T): T => (v === null || v === undefined ? d : typeof v === 'string' ? (JSON.parse(v) as T) : (v as T));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : '');

export async function listProducts(tx: Tx, segment?: string): Promise<FinProduct[]> {
  const rows = await tx.query<Record<string, unknown>>(`select p.*, l.lender_name, l.lender_id::text lid, l.provider_kind from loan_products p join lenders l on l.lender_id = p.lender_id
    where ($1::text is null or p.segment = $1) order by p.sort_order, p.product_code`, [segment ?? null]);
  return rows.map((r) => ({
    id: String(r.product_code), name: String(r.product_name), segment: (r.segment as FinProduct['segment']) ?? 'farmer', type: (r.product_type as FinProduct['type']) ?? 'loan',
    category: String(r.category ?? r.purpose ?? ''), description: String(r.description ?? ''), benefits: j(r.benefits, []), provider: String(r.lender_name), providerId: String(r.lid),
    providerKind: (r.provider_kind as FinProduct['providerKind']) ?? 'lender', eligibility: j(r.eligibility_rules, []), min: num(r.min_amount), max: num(r.max_amount), rate: num(r.interest_rate),
    tenures: j<number[]>(r.tenure_options, []).length ? j<number[]>(r.tenure_options, []) : r.max_tenure_months ? [n0(r.max_tenure_months)] : [],
    fees: (r.fees_text as string) ?? null, documents: j(r.required_documents, []), fields: j(r.application_fields, []), dataCategories: j(r.data_categories, []),
    status: (r.product_status as 'active' | 'paused') ?? 'active', disclaimer: String(r.disclaimer ?? 'Demo product.'), termsVerified: Boolean(r.terms_verified),
    coverage: j(r.coverage, null), exclusions: j(r.exclusions, []), claimReasons: j(r.claim_reasons, []),
  }));
}
export async function getProduct(tx: Tx, code: string) {
  const p = (await listProducts(tx)).find((x) => x.id === code);
  if (!p) throw new DbError('Unknown product', 400);
  return p;
}

// Applications visible to this scope, with their product configuration details
export async function listApplications(tx: Tx): Promise<AppView[]> {
  const ids = await tx.query<{ id: string }>('select application_id::text id from loan_applications order by coalesce(submitted_at, last_updated_at) desc nulls last limit 50');
  const out: AppView[] = [];
  for (const { id } of ids) out.push(await getAppView(tx, id));
  return out;
}
export async function getAppView(tx: Tx, id: string): Promise<AppView> {
  const { app } = await getApplication(tx, id);
  const r = (await tx.query<Record<string, unknown>>(`select a.applicant_type, a.answers, a.offer, a.offer_status, a.submitted_at, p.product_code, p.product_type,
      c.cattle_id::text cid, c.animal_type, c.breed
    from loan_applications a left join loan_products p on p.loan_product_id = a.loan_product_id left join cattle c on c.cattle_id = a.insured_cattle_id where a.application_id = $1`, [id]))[0];
  return {
    ...app, productCode: String(r.product_code ?? ''), productType: (r.product_type as AppView['productType']) ?? 'loan', applicantType: (r.applicant_type as AppView['applicantType']) ?? 'farmer',
    answers: j(r.answers, {}), offer: j(r.offer, null), offerStatus: (r.offer_status as AppView['offerStatus']) ?? null,
    insuredAnimal: r.cid ? { id: String(r.cid), type: String(r.animal_type), breed: String(r.breed ?? '') } : null, submittedAt: r.submitted_at ? iso(r.submitted_at) : null,
  };
}

export async function createApplicationRow(tx: Tx, a: {
  applicantType: 'farmer' | 'society'; farmerId: string | null; societyId: string | null; productCode: string; lenderId: string; ref: string; amount: number | null; tenure: number | null;
  rate: number | null; product: string; consentId: string | null; answers: Record<string, unknown>; status: 'draft' | 'submitted'; cattleId: string | null; by: string;
}) {
  const r = await tx.query<{ id: string }>(`insert into loan_applications (applicant_type, farmer_id, society_id, lender_id, loan_product_id, application_reference, requested_amount, tenure_months,
      interest_rate, loan_purpose, application_status, submitted_at, last_updated_at, consent_id, answers, insured_cattle_id, submitted_by)
    values ($1,$2,$3,$4,(select loan_product_id from loan_products where product_code = $5),$6,$7,$8,$9,$10,$11::text,case when $11::text = 'submitted' then now() end, now(),$12,$13::text::jsonb,$14,$15)
    returning application_id::text id`,
    [a.applicantType, a.farmerId, a.societyId, a.lenderId, a.productCode, a.ref, a.amount, a.tenure, a.rate, a.product, a.status, a.consentId, JSON.stringify(a.answers), a.cattleId, a.by]);
  if (!r[0]) throw new DbError('Could not save the application', 500);
  return r[0].id;
}
export async function updateApplicationRow(tx: Tx, id: string, set: { amount?: number | null; tenure?: number | null; answers?: Record<string, unknown>; consentId?: string | null; cattleId?: string | null }) {
  await tx.query(`update loan_applications set requested_amount = coalesce($2, requested_amount), tenure_months = coalesce($3, tenure_months),
    answers = coalesce($4::text::jsonb, answers), consent_id = coalesce($5, consent_id), insured_cattle_id = coalesce($6, insured_cattle_id), last_updated_at = now() where application_id = $1`,
    [id, set.amount ?? null, set.tenure ?? null, set.answers ? JSON.stringify(set.answers) : null, set.consentId ?? null, set.cattleId ?? null]);
}
export async function markSubmitted(tx: Tx, id: string) {
  await tx.query(`update loan_applications set submitted_at = coalesce(submitted_at, now()) where application_id = $1`, [id]);
}
export async function setOffer(tx: Tx, id: string, offer: Record<string, unknown> | null, status: 'pending' | 'accepted' | 'declined' | null) {
  await tx.query(`update loan_applications set offer = coalesce($2::text::jsonb, offer), offer_status = $3::text, decided_at = case when $3::text = 'pending' then now() else decided_at end where application_id = $1`,
    [id, offer ? JSON.stringify(offer) : null, status]);
}

// ---------------------------------------------------------------- insurance
export async function listPolicies(tx: Tx): Promise<PolicyView[]> {
  const rows = await tx.query<Record<string, unknown>>(`select p.policy_id::text id, p.policy_number, p.total_insured_value, p.premium_amount, p.policy_start_date::text s, p.policy_end_date::text e,
      p.policy_status, p.renewal_status, p.is_simulated, l.lender_name, c.animal_type, c.breed, lp.product_code
    from insurance_policies p left join lenders l on l.lender_id = p.insurer_id
    left join insurance_policy_animals pa on pa.policy_id = p.policy_id left join cattle c on c.cattle_id = pa.cattle_id
    left join loan_applications a on a.application_id = p.application_id left join loan_products lp on lp.loan_product_id = a.loan_product_id
    order by p.created_at desc`);
  return rows.map((r) => ({ id: String(r.id), number: String(r.policy_number), insurer: String(r.lender_name ?? ''), animal: r.animal_type ? { type: String(r.animal_type), breed: String(r.breed ?? '') } : null,
    sumInsured: num(r.total_insured_value), premium: num(r.premium_amount), start: String(r.s), end: String(r.e), status: String(r.policy_status), renewal: String(r.renewal_status), simulated: Boolean(r.is_simulated), productCode: (r.product_code as string) ?? null }));
}
export async function issuePolicy(tx: Tx, p: { applicationId: string; farmerId: string; insurerId: string; insurer: string; number: string; sumInsured: number | null; premium: number | null; start: string; end: string; cattleId: string | null }) {
  const id = (await tx.query<{ id: string }>(`insert into insurance_policies (farmer_id, insurer_name, policy_number, total_insured_value, premium_amount, policy_start_date, policy_end_date,
      policy_status, issuance_status, application_id, insurer_id, is_simulated) values ($1,$2,$3,$4,$5,$6,$7,'active','issued',$8,$9,true) returning policy_id::text id`,
    [p.farmerId, p.insurer, p.number, p.sumInsured, p.premium, p.start, p.end, p.applicationId, p.insurerId]))[0].id;
  if (p.cattleId) await tx.query(`insert into insurance_policy_animals (policy_id, cattle_id, insured_value, coverage_status) values ($1,$2,$3,'covered')`, [id, p.cattleId, p.sumInsured]);
  return id;
}
export async function listClaims(tx: Tx): Promise<ClaimView[]> {
  const rows = await tx.query<Record<string, unknown>>(`select k.claim_id::text id, k.claim_reference, k.claim_reason, k.incident_date::text d, k.description, k.claim_status, k.claim_amount,
      p.policy_number, f.farmer_code from insurance_claims k join insurance_policies p on p.policy_id = k.policy_id left join farmers f on f.farmer_id = k.farmer_id order by k.created_at desc`);
  const ev = rows.length ? await tx.query<Record<string, unknown>>('select claim_id::text id, status, note, created_at from insurance_claim_events where claim_id = any($1::uuid[]) order by created_at', [rows.map((r) => r.id)]) : [];
  return rows.map((r) => ({ id: String(r.id), ref: String(r.claim_reference), policyNumber: String(r.policy_number), reason: String(r.claim_reason ?? ''), incidentDate: String(r.d ?? ''),
    description: String(r.description ?? ''), status: String(r.claim_status), amountClaimed: num(r.claim_amount), farmer: r.farmer_code ? `Member ${String(r.farmer_code)}` : undefined,
    history: ev.filter((e) => e.id === r.id).map((e) => ({ status: String(e.status), note: String(e.note ?? ''), at: iso(e.created_at) })) }));
}
export async function createClaim(tx: Tx, c: { farmerId: string; policyId: string; reason: string; date: string; description: string; amount: number | null; docs: string[]; actor: string }) {
  const id = (await tx.query<{ id: string }>(`insert into insurance_claims (policy_id, farmer_id, claim_reference, claim_reason, incident_type, incident_date, description, claim_amount, claim_status, submitted_at, documents)
    values ($1,$2,'CL-' || nextval('insurance_claim_ref_seq'),$3,$3,$4,$5,$6,'submitted',now(),$7::text::jsonb) returning claim_id::text id`,
    [c.policyId, c.farmerId, c.reason, c.date, c.description, c.amount, JSON.stringify(c.docs)]))[0]?.id;
  if (!id) throw new DbError('Policy not found', 404);
  await claimEvent(tx, id, 'submitted', 'Claim submitted', c.actor);
  return id;
}
export async function claimEvent(tx: Tx, id: string, status: string, note: string, actor: string, setStatus = false) {
  if (setStatus) {
    const r = await tx.query(`update insurance_claims set claim_status = $2::text, settled_at = case when $2::text = 'settled' then now() else settled_at end where claim_id = $1 returning claim_id`, [id, status]);
    if (!r.length) throw new DbError('Claim not found', 404);
  }
  await tx.query('insert into insurance_claim_events (claim_id, status, note, actor) values ($1,$2,$3,$4)', [id, status, note, actor]);
}

// ---------------------------------------------------------------- consumer wallet (simulated)
export async function walletState(tx: Tx, consumerId: string) {
  const c = (await tx.query<Record<string, unknown>>('select consumer_id::text id, display_name, city from consumers where consumer_id = $1', [consumerId]))[0];
  if (!c) throw new DbError('Consumer not found', 404);
  const sub = (await tx.query<Record<string, unknown>>(`select subscription_id::text id, product_code, channel, plan, price_per_day, status, renews_on::text renews from wallet_subscriptions
    where consumer_id = $1 and status <> 'cancelled' order by created_at desc limit 1`, [consumerId]))[0] ?? null;
  const txns = await tx.query<Record<string, unknown>>('select kind, amount, description, created_at, simulated from wallet_transactions where consumer_id = $1 order by created_at desc limit 50', [consumerId]);
  const balance = txns.reduce((x, t) => x + (t.kind === 'topup' ? 1 : -1) * Number(t.amount), 0);
  return {
    consumer: { id: String(c.id), name: String(c.display_name), city: String(c.city) },
    subscription: sub ? { id: String(sub.id), product: String(sub.product_code), channel: String(sub.channel), plan: String(sub.plan), pricePerDay: Number(sub.price_per_day), status: String(sub.status), renewsOn: (sub.renews as string) ?? null } : null,
    transactions: txns.map((t) => ({ kind: t.kind as 'topup' | 'purchase', amount: Number(t.amount), description: String(t.description), at: iso(t.created_at), simulated: Boolean(t.simulated) })),
    balance: Math.round(balance * 100) / 100,
  };
}

// ---------------------------------------------------------------- applicant facts and consents
export async function farmerFacts(tx: Tx, farmerId: string, asOf: string) {
  const r = (await tx.query<Record<string, unknown>>(`select f.registration_date::date::text reg,
      (select count(distinct transaction_date) from milk_transactions m where m.farmer_id = f.farmer_id and m.transaction_date > $2::date - 180 and m.transaction_date <= $2::date)::int days
    from farmers f where f.farmer_id = $1`, [farmerId, asOf]))[0];
  const reg = r?.reg ? new Date(String(r.reg)) : null;
  const months = reg ? Math.max(0, Math.floor((new Date(asOf).getTime() - reg.getTime()) / (30.44 * 86400000))) : undefined;
  return { membershipMonths: months, regularSupply: r ? n0(r.days) >= 120 : undefined };
}
export async function farmerCattle(tx: Tx, farmerId: string) {
  return (await tx.query<Record<string, unknown>>(`select c.cattle_id::text id, c.animal_type, c.breed, c.animal_tag_number tag, c.health_status,
      exists (select 1 from insurance_policy_animals pa join insurance_policies p on p.policy_id = pa.policy_id where pa.cattle_id = c.cattle_id and p.policy_status = 'active') insured
    from cattle c where c.farmer_id = $1 order by c.animal_type, c.created_at, c.cattle_id`, [farmerId]))
    .map((r) => ({ id: String(r.id), type: String(r.animal_type), breed: String(r.breed ?? ''), tag: (r.tag as string) ?? null, health: String(r.health_status ?? ''), insured: Boolean(r.insured) }));
}
export async function societyOperations(tx: Tx, societyId: string, asOf: string) {
  const r = (await tx.query<Record<string, unknown>>(`select s.code, s.name, s.village, (select count(*) from farmers f where f.society_id = s.society_id)::int members,
      (select sum(litres) / nullif(count(distinct collection_date), 0) from society_collection_daily d where d.society_id = s.society_id and d.collection_date > $2::date - 90 and d.collection_date <= $2::date) avg_litres,
      (select avg(avg_fat) from society_collection_daily d where d.society_id = s.society_id and d.collection_date > $2::date - 90 and d.collection_date <= $2::date) fat
    from societies s where s.society_id = $1`, [societyId, asOf]))[0];
  if (!r) return null;
  return { code: String(r.code), name: String(r.name), village: String(r.village ?? ''), members: n0(r.members), avgDailyLitres: Math.round(n0(r.avg_litres)), avgFat: r.fat === null ? null : Math.round(Number(r.fat) * 100) / 100 };
}
const SOC_CONSENT_COLS = `consent_id::text consent_id, consent_code, recipient_name, lender_id::text lender_id, consent_purpose, scope, period, granted_at, consent_status,
  withdrawn_at, consent_notice_version, collection_categories, consent_method, language, statements_confirmed`;
export async function listSocietyConsents(tx: Tx, societyId: string) {
  return (await tx.query<Record<string, unknown>>(`select ${SOC_CONSENT_COLS} from consent_records where society_id = $1 order by granted_at desc`, [societyId])).map(toConsent);
}
export async function createSocietyConsent(tx: Tx, societyId: string, c: { lenderId: string; recipient: string; purpose: string; categories: string[]; noticeVersion: string; productCode: string; signedBy: string }) {
  const n = n0((await tx.query<{ n: number }>('select count(*)::int n from consent_records where society_id = $1', [societyId]))[0]?.n) + 1;
  const code = 'SC' + String(n).padStart(3, '0');
  const r = await tx.query<{ id: string }>(`insert into consent_records (society_id, lender_id, consent_code, recipient_name, consent_purpose, scope, period, consent_status, granted_at,
      collection_categories, consent_notice_version, consent_method, loan_product_code)
    values ($1,$2,$3,$4,$5,$6,'Until the application is decided','granted',now(),$7::text::jsonb,$8,'digital',$9) returning consent_id::text id`,
    [societyId, c.lenderId, code, c.recipient, c.purpose.slice(0, 100), `Signed by ${c.signedBy} for the society`, JSON.stringify(c.categories), c.noticeVersion, c.productCode]);
  return { id: r[0].id, code };
}
export async function withdrawSocietyConsent(tx: Tx, societyId: string, consentId: string) {
  const rows = await tx.query<{ consent_code: string }>(`update consent_records set consent_status = 'withdrawn', withdrawn_at = now() where consent_id = $1 and society_id = $2 and consent_status = 'granted' returning consent_code`, [consentId, societyId]);
  if (!rows.length) throw new DbError('Consent not found', 404);
  return rows[0];
}
export async function linkConsent(tx: Tx, consentId: string, applicationId: string, productCode: string) {
  await tx.query('update consent_records set application_id = $1, loan_product_code = $3 where consent_id = $2', [applicationId, consentId, productCode]);
}
export async function logSocietySharing(tx: Tx, s: { societyId: string; applicationId: string; consentId: string; lenderId: string; categories: string[]; purpose: string; ref: string }) {
  await tx.query(`insert into data_sharing_logs (society_id, application_id, consent_id, recipient_id, data_categories, purpose, sharing_status, shared_at, reference_id)
    values ($1,$2,$3,$4,$5::text::jsonb,$6,'completed',now(),$7)`, [s.societyId, s.applicationId, s.consentId, s.lenderId, JSON.stringify(s.categories), s.purpose, s.ref]);
}
export async function logAccess(tx: Tx, a: { accessor: string; farmerId: string | null; societyId: string | null; lenderId: string; applicationId: string; categories: string[]; purpose: string }) {
  await tx.query(`insert into data_access_logs (accessor, accessor_role, farmer_id, society_id, lender_id, application_id, categories, purpose) values ($1, 'lender', $2, $3, $4, $5, $6::text::jsonb, $7)`,
    [a.accessor, a.farmerId, a.societyId, a.lenderId, a.applicationId, JSON.stringify(a.categories), a.purpose]);
}
export async function applicationOwner(tx: Tx, id: string) {
  const r = (await tx.query<Record<string, unknown>>(`select farmer_id::text f, society_id::text s, applicant_type t, application_status st, consent_id::text c, insured_cattle_id::text cattle, requested_amount amt,
      (select product_code from loan_products p where p.loan_product_id = a.loan_product_id) code from loan_applications a where application_id = $1`, [id]))[0];
  if (!r) throw new DbError('Application not found', 404);
  return { farmerId: (r.f as string) ?? null, societyId: (r.s as string) ?? null, type: r.t as 'farmer' | 'society', status: r.st as AppView['status'], consentId: (r.c as string) ?? null,
    cattleId: (r.cattle as string) ?? null, amount: num(r.amt), productCode: String(r.code ?? '') };
}
export async function policyRenewal(tx: Tx, policyId: string, status: string) {
  const r = await tx.query('update insurance_policies set renewal_status = $2 where policy_id = $1 returning policy_id', [policyId, status]);
  if (!r.length) throw new DbError('Policy not found', 404);
}
export async function getClaim(tx: Tx, id: string) {
  const r = (await tx.query<Record<string, unknown>>(`select k.claim_status s, k.claim_reference ref, k.farmer_id::text f from insurance_claims k where k.claim_id = $1`, [id]))[0];
  if (!r) throw new DbError('Claim not found', 404);
  return { status: String(r.s), ref: String(r.ref), farmerId: String(r.f) };
}
export async function setClaimApproved(tx: Tx, id: string, amount: number | null) {
  await tx.query('update insurance_claims set approved_amount = coalesce($2, approved_amount) where claim_id = $1', [id, amount]);
}
export async function walletAdd(tx: Tx, consumerId: string, kind: 'topup' | 'purchase', amount: number, description: string) {
  await tx.query('insert into wallet_transactions (consumer_id, kind, amount, description, simulated) values ($1,$2,$3,$4,true)', [consumerId, kind, amount, description]);
}
