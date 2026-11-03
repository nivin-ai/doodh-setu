// Data-access layer: every SQL statement the app runs lives here. Functions take a transaction
// opened by withScope() (so row-level security applies) and return typed application models.
// No business rules here beyond mapping rows; calculations live in lib/*.ts domain modules and
// workflow rules in lib/server/services.
import { DbError, insertMany, n0, num, type Tx } from '../db';
import type { Session } from '../../farmer';
import type {
  Application, AppStatus, AuditEvent, Consent, CreditRecord, DocId, FarmerProfile, KycRecord, LoanProduct, MemberQuery,
  PlannerDataset, ProgramView, PropertyRecord, SharingLog, SignalStatus, SocietyLite, ZoneRow,
} from '../../types/api';
import type { Lang } from '../../i18n';
import type { City, Channel } from '../../demand';

const one = <T>(rows: T[], what: string): T => { if (!rows[0]) throw new DbError(`${what} not found`, 404); return rows[0]; };
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : '');

// ---------------------------------------------------------------- farmers and members
export async function getFarmerProfile(tx: Tx, farmerId: string): Promise<FarmerProfile> {
  const r = one(await tx.query<Record<string, unknown>>(`
    select f.farmer_id::text id, f.farmer_code code, coalesce(f.display_name, f.first_name) as name, f.mobile_number phone, f.preferred_language lang,
      coalesce(a.village, s.village) village, s.society_id::text sid, s.code scode, s.name sname, f.correction_requested_at is not null corr,
      (select count(*) from cattle c where c.farmer_id = f.farmer_id and c.animal_type = 'buffalo')::int buf,
      (select count(*) from cattle c where c.farmer_id = f.farmer_id and c.animal_type = 'cow')::int cow
    from farmers f join societies s on s.society_id = f.society_id
    left join farmer_addresses a on a.farmer_id = f.farmer_id and a.is_primary
    where f.farmer_id = $1`, [farmerId]), 'Farmer');
  return {
    id: String(r.id), code: String(r.code), name: String(r.name), phone: (r.phone as string) ?? null, language: (r.lang as Lang) ?? 'gu',
    village: String(r.village ?? ''), society: { id: String(r.sid), code: String(r.scode), name: String(r.sname) },
    animals: { buffalo: n0(r.buf), cow: n0(r.cow) }, correctionRequested: Boolean(r.corr),
  };
}

export async function requestCorrection(tx: Tx, farmerId: string) {
  await tx.query('update farmers set correction_requested_at = now() where farmer_id = $1', [farmerId]);
}

export interface MemberRecord {
  id: string; code: string; name: string; mobile: string | null; device: 'smartphone' | 'feature_phone'; lang: Lang; village: string;
  buffaloes: number; cows: number; litres: number; heardOn: string | null; interestedOn: string | null; simulated: boolean | null;
}
export async function listSocietyMembers(tx: Tx, societyId: string, programId: string | null, sinceDays: { from: string; to: string }): Promise<MemberRecord[]> {
  const rows = await tx.query<Record<string, unknown>>(`
    select f.farmer_id::text id, f.farmer_code code, coalesce(f.display_name, f.first_name) as name, f.mobile_number mobile, f.device_type device,
      f.preferred_language lang, coalesce(a.village, '') village,
      (select count(*) from cattle c where c.farmer_id = f.farmer_id and c.animal_type = 'buffalo')::int buf,
      (select count(*) from cattle c where c.farmer_id = f.farmer_id and c.animal_type = 'cow')::int cow,
      (select coalesce(sum(c.estimated_daily_yield), 0) from cattle c where c.farmer_id = f.farmer_id) est,
      r.heard_on::text heard_on, r.interested_on::text interested_on, r.simulated
    from farmers f
    left join farmer_addresses a on a.farmer_id = f.farmer_id and a.is_primary
    left join signal_responses r on r.farmer_id = f.farmer_id and r.program_id = $2
    where f.society_id = $1
    order by f.farmer_code`, [societyId, programId]);
  // average daily milk over the window (only members whose pours are recorded individually)
  const avg = new Map((await tx.query<{ id: string; l: string }>(`
    select farmer_id::text id, sum(milk_quantity_litres) / greatest(1, count(distinct transaction_date)) l from milk_transactions
    where society_id = $1 and transaction_date between $2 and $3 group by farmer_id`, [societyId, sinceDays.from, sinceDays.to])).map((x) => [x.id, Number(x.l)]));
  return rows.map((r) => ({
    id: String(r.id), code: String(r.code), name: String(r.name), mobile: (r.mobile as string) ?? null, device: r.device as MemberRecord['device'],
    lang: (r.lang as Lang) ?? 'gu', village: String(r.village), buffaloes: n0(r.buf), cows: n0(r.cow),
    litres: avg.get(String(r.id)) ?? Number(r.est),
    heardOn: (r.heard_on as string) ?? null, interestedOn: (r.interested_on as string) ?? null, simulated: (r.simulated as boolean) ?? null,
  }));
}
export const memberStatus = (m: Pick<MemberRecord, 'heardOn' | 'interestedOn'>, asOf: string, published: boolean): SignalStatus =>
  !published ? '-' : m.interestedOn && m.interestedOn <= asOf ? 'Interested' : m.heardOn && m.heardOn <= asOf ? 'Heard' : 'Not heard';

export async function simulationTraits(tx: Tx) {
  return tx.query<{ farmer_id: string; heard_p: string; interested_p: string }>('select farmer_id::text farmer_id, heard_p, interested_p from demo_simulation_traits');
}

// ---------------------------------------------------------------- milk
export async function listSessions(tx: Tx, farmerId: string, upTo: string, from = '2000-01-01'): Promise<Session[]> {
  const rows = await tx.query<Record<string, unknown>>(`
    select transaction_date::text d, collection_session s, milk_type t, milk_quantity_litres l, fat_percentage fat, snf_percentage snf
    from milk_transactions where farmer_id = $1 and transaction_date between $2 and $3
    order by transaction_date, collection_session, milk_type`, [farmerId, from, upTo]);
  return rows.map((r) => ({ date: String(r.d), session: r.s as 'AM' | 'PM', type: r.t as 'buffalo' | 'cow', litres: Number(r.l), fat: Number(r.fat), snf: Number(r.snf) }));
}
export async function societyCollection(tx: Tx, societyId: string, date: string) {
  const rows = await tx.query<{ t: string; l: string }>('select milk_type t, litres l from society_collection_daily where society_id = $1 and collection_date = $2', [societyId, date]);
  if (!rows.length) return null;
  const get = (t: string) => Number(rows.find((r) => r.t === t)?.l ?? 0);
  return { buffalo: get('buffalo'), cow: get('cow') };
}
export async function societyMonthly(tx: Tx, societyId: string, upTo: string) {
  return (await tx.query<{ m: string; l: string }>(`select to_char(collection_date, 'YYYY-MM') m, avg(litres) l from society_collection_daily
    where society_id = $1 and milk_type = 'buffalo' and collection_date <= $2 and collection_date >= ($2::date - interval '4 months') group by 1 order by 1`, [societyId, upTo]))
    .map((r) => ({ month: r.m, buffalo: Math.round(Number(r.l)) }));
}
export async function monthlyNetIncome(tx: Tx, farmerId: string, from: string, upTo: string) {
  const rows = await tx.query<{ k: string; total: string; litres: string }>(`
    select to_char(transaction_date, 'YYYY-MM') k, sum(net_amount) total, sum(milk_quantity_litres) litres from milk_transactions
    where farmer_id = $1 and transaction_date between $2 and $3 group by 1 order by 1`, [farmerId, from, upTo]);
  return rows.map((r) => ({ key: r.k, total: Math.round(Number(r.total)), litres: Math.round(Number(r.litres)) }));
}

// ---------------------------------------------------------------- incentive programmes
function toProgram(r: Record<string, unknown>, societyIds: string[]): ProgramView {
  return {
    id: String(r.program_id), title: String(r.title), rate: Number(r.rate_per_kg_fat), from: String(r.starts_on), to: String(r.ends_on),
    status: r.status as ProgramView['status'], submittedBy: String(r.submitted_by), approvedBy: (r.approved_by as string) ?? null,
    justification: (r.justification as string) ?? null, rejectedReason: (r.rejected_reason as string) ?? null, concern: (r.concern as string) ?? null,
    sendSlot: (r.send_slot as ProgramView['sendSlot']) ?? null, notes: (typeof r.notes === 'string' ? JSON.parse(r.notes) : r.notes) as ProgramView['notes'] ?? {},
    societyIds, publishedAt: r.published_at ? iso(r.published_at) : null,
  };
}
const PROGRAM_COLS = `program_id::text program_id, title, rate_per_kg_fat, starts_on::text starts_on, ends_on::text ends_on, status, submitted_by, approved_by,
  justification, rejected_reason, concern, send_slot, notes, published_at`;
// Latest programme this scope can see (RLS decides which)
export async function latestProgram(tx: Tx): Promise<ProgramView | null> {
  const r = (await tx.query<Record<string, unknown>>(`select ${PROGRAM_COLS} from incentive_programs order by created_at desc limit 1`))[0];
  if (!r) return null;
  const ids = (await tx.query<{ id: string }>('select society_id::text id from incentive_program_societies where program_id = $1', [r.program_id])).map((x) => x.id);
  return toProgram(r, ids);
}
export async function getProgram(tx: Tx, id: string): Promise<ProgramView> {
  const r = one(await tx.query<Record<string, unknown>>(`select ${PROGRAM_COLS} from incentive_programs where program_id = $1`, [id]), 'Programme');
  const ids = (await tx.query<{ id: string }>('select society_id::text id from incentive_program_societies where program_id = $1', [id])).map((x) => x.id);
  return toProgram(r, ids);
}
export async function createProgram(tx: Tx, p: { cooperativeId: string; title: string; rate: number; from: string; to: string; submittedBy: string; justification: string | null; societyIds: string[] }) {
  const id = one(await tx.query<{ id: string }>(`insert into incentive_programs (cooperative_id, title, rate_per_kg_fat, starts_on, ends_on, submitted_by, justification)
    values ($1,$2,$3,$4,$5,$6,$7) returning program_id::text id`, [p.cooperativeId, p.title, p.rate, p.from, p.to, p.submittedBy, p.justification]), 'Programme').id;
  await insertMany(tx, 'incentive_program_societies', ['program_id', 'society_id'], p.societyIds.map((s) => [id, s]));
  return id;
}
export async function updateProgram(tx: Tx, id: string, set: Record<string, unknown>) {
  const keys = Object.keys(set);
  if (!keys.length) return;
  const rows = await tx.query(`update incentive_programs set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where program_id = $1 returning program_id`, [id, ...keys.map((k) => set[k])]);
  if (!rows.length) throw new DbError('Programme not found or not editable by this account', 403);
}
export async function getResponse(tx: Tx, programId: string, farmerId: string) {
  const r = (await tx.query<{ h: string | null; i: string | null }>('select heard_on::text h, interested_on::text i from signal_responses where program_id = $1 and farmer_id = $2', [programId, farmerId]))[0];
  return { heardOn: r?.h ?? null, interestedOn: r?.i ?? null };
}
export async function upsertOwnResponse(tx: Tx, programId: string, farmerId: string, field: 'heard_on' | 'interested_on', date: string) {
  await tx.query(`insert into signal_responses (program_id, farmer_id, ${field}) values ($1, $2, $3)
    on conflict (program_id, farmer_id) do update set ${field} = coalesce(signal_responses.${field}, excluded.${field})`, [programId, farmerId, date]);
  if (field === 'interested_on') await tx.query('update signal_responses set heard_on = coalesce(heard_on, $3) where program_id = $1 and farmer_id = $2', [programId, farmerId, date]);
}
export async function insertSimulatedResponses(tx: Tx, programId: string, rows: [string, string | null, string | null][]) {
  await insertMany(tx, 'signal_responses', ['program_id', 'farmer_id', 'heard_on', 'interested_on', 'simulated'], rows.map(([f, h, i]) => [programId, f, h, i, true]), 'on conflict do nothing');
}

// ---------------------------------------------------------------- member queries
export async function listQueries(tx: Tx): Promise<MemberQuery[]> {
  const qs = await tx.query<Record<string, unknown>>(`select q.query_id::text id, q.query_code code, q.language lang, q.created_at, q.status, q.farmer_seen,
      coalesce(f.display_name, f.first_name) fname
    from member_queries q left join farmers f on f.farmer_id = q.farmer_id order by q.created_at desc limit 100`);
  if (!qs.length) return [];
  const msgs = await tx.query<Record<string, unknown>>(`select query_id::text id, sender, body, created_at from query_messages where query_id = any($1::uuid[]) order by created_at`, [qs.map((q) => q.id)]);
  return qs.map((q) => ({
    id: String(q.id), code: String(q.code), lang: q.lang as Lang, at: iso(q.created_at), status: q.status as 'open' | 'resolved', farmerSeen: Boolean(q.farmer_seen),
    farmerName: (q.fname as string) ?? undefined,
    messages: msgs.filter((m) => m.id === q.id).map((m) => ({ from: m.sender as 'farmer' | 'society', text: String(m.body), at: iso(m.created_at) })),
  }));
}
export async function createQuery(tx: Tx, farmerId: string, societyId: string, lang: string, text: string) {
  const id = one(await tx.query<{ id: string }>(`insert into member_queries (query_code, farmer_id, society_id, language) values ('Q' || nextval('member_query_code_seq'), $1, $2, $3) returning query_id::text id`,
    [farmerId, societyId, lang]), 'Query').id;
  await addMessage(tx, id, 'farmer', text);
  return id;
}
export async function addMessage(tx: Tx, queryId: string, sender: 'farmer' | 'society', text: string) {
  await tx.query('insert into query_messages (query_id, sender, body) values ($1, $2, $3)', [queryId, sender, text]);
  const set = sender === 'society' ? `status = 'resolved', farmer_seen = false` : `status = 'open', farmer_seen = true`;
  const rows = await tx.query(`update member_queries set ${set} where query_id = $1 returning query_id`, [queryId]);
  if (!rows.length) throw new DbError('Query not found', 404);
}
export async function markQueriesSeen(tx: Tx, farmerId: string) {
  await tx.query('update member_queries set farmer_seen = true where farmer_id = $1 and not farmer_seen', [farmerId]);
}

// ---------------------------------------------------------------- finance
function toConsent(r: Record<string, unknown>): Consent {
  const cats = typeof r.collection_categories === 'string' ? JSON.parse(r.collection_categories) : r.collection_categories;
  return {
    id: String(r.consent_id), code: String(r.consent_code ?? ''), recipient: String(r.recipient_name ?? ''), lenderId: (r.lender_id as string) ?? null,
    purpose: String(r.consent_purpose ?? ''), scope: String(r.scope ?? ''), period: String(r.period ?? ''), grantedAt: iso(r.granted_at),
    status: r.consent_status === 'withdrawn' ? 'withdrawn' : 'active', withdrawnAt: r.withdrawn_at ? iso(r.withdrawn_at) : undefined,
    noticeVersion: (r.consent_notice_version as string) ?? undefined, categories: (cats as string[]) ?? [], method: (r.consent_method as Consent['method']) ?? undefined,
    language: (r.language as Lang) ?? undefined, statements: num(r.statements_confirmed) ?? undefined,
  };
}
const CONSENT_COLS = `consent_id::text consent_id, consent_code, recipient_name, lender_id::text lender_id, consent_purpose, scope, period, granted_at, consent_status,
  withdrawn_at, consent_notice_version, collection_categories, consent_method, language, statements_confirmed`;
export async function listConsents(tx: Tx, farmerId: string) {
  return (await tx.query<Record<string, unknown>>(`select ${CONSENT_COLS} from consent_records where farmer_id = $1 order by granted_at desc`, [farmerId])).map(toConsent);
}
export async function getConsent(tx: Tx, id: string) {
  const r = (await tx.query<Record<string, unknown>>(`select ${CONSENT_COLS} from consent_records where consent_id = $1`, [id]))[0];
  return r ? toConsent(r) : null;
}
export async function createConsent(tx: Tx, farmerId: string, c: Omit<Consent, 'id' | 'code' | 'grantedAt' | 'status' | 'lenderId'> & { lenderId: string | null }) {
  const n = n0((await tx.query<{ n: number }>('select count(*)::int n from consent_records where farmer_id = $1', [farmerId]))[0]?.n) + 1;
  const code = 'C' + String(n).padStart(3, '0');
  const id = one(await tx.query<{ id: string }>(`insert into consent_records (farmer_id, lender_id, consent_code, recipient_name, consent_purpose, scope, period, consent_status, granted_at,
      collection_categories, consent_notice_version, consent_method, language, statements_confirmed)
    values ($1,$2,$3,$4,$5,$6,$7,'granted',now(),$8,$9,$10,$11,$12) returning consent_id::text id`,
    [farmerId, c.lenderId, code, c.recipient, c.purpose, c.scope, c.period, JSON.stringify(c.categories ?? []), c.noticeVersion ?? null, c.method ?? 'digital', c.language ?? null, c.statements ?? null]), 'Consent').id;
  return { id, code };
}
export async function withdrawConsent(tx: Tx, farmerId: string, consentId: string) {
  const rows = await tx.query(`update consent_records set consent_status = 'withdrawn', withdrawn_at = now() where consent_id = $1 and farmer_id = $2 and consent_status = 'granted' returning consent_code`, [consentId, farmerId]);
  if (!rows.length) throw new DbError('Consent not found', 404);
  return rows[0] as { consent_code: string };
}
export async function lenderByName(tx: Tx, name: string) {
  return (await tx.query<{ id: string }>('select lender_id::text id from lenders where lender_name = $1', [name]))[0]?.id ?? null;
}
export async function listLoanProducts(tx: Tx): Promise<LoanProduct[]> {
  const rows = await tx.query<Record<string, unknown>>(`select p.product_code, p.product_name, p.purpose, p.min_amount, p.max_amount, p.interest_rate, p.max_tenure_months, p.fee_pct, p.eligibility,
      l.lender_name, l.lender_id::text lender_id from loan_products p join lenders l on l.lender_id = p.lender_id order by p.product_code`);
  return rows.map((r) => ({ id: String(r.product_code), lender: String(r.lender_name), lenderId: String(r.lender_id), name: String(r.product_name), purpose: String(r.purpose),
    min: n0(r.min_amount), max: n0(r.max_amount), rate: n0(r.interest_rate), maxTenure: n0(r.max_tenure_months), feePct: n0(r.fee_pct), elig: String(r.eligibility ?? '') }));
}
export async function getKyc(tx: Tx, farmerId: string): Promise<KycRecord[]> {
  return (await tx.query<Record<string, unknown>>('select document_type, document_number_masked, verification_status, verification_provider from farmer_kyc where farmer_id = $1 order by document_type', [farmerId]))
    .map((r) => ({ type: String(r.document_type), masked: String(r.document_number_masked), status: String(r.verification_status), provider: String(r.verification_provider) }));
}
export async function getProperty(tx: Tx, farmerId: string): Promise<PropertyRecord | null> {
  const r = (await tx.query<Record<string, unknown>>('select * from farmer_properties where farmer_id = $1 limit 1', [farmerId]))[0];
  return r ? { ownership: String(r.ownership_type), survey: String(r.survey_number), village: String(r.village), district: String(r.district), state: String(r.state),
    area: Number(r.total_area), unit: String(r.area_unit), use: String(r.land_use), record: String(r.record_type ?? ''), status: String(r.verification_status) } : null;
}
export async function getCredit(tx: Tx, farmerId: string): Promise<CreditRecord | null> {
  const r = (await tx.query<Record<string, unknown>>('select bureau_name, credit_score, existing_loan_count, total_outstanding, mock_data from credit_profiles where farmer_id = $1 limit 1', [farmerId]))[0];
  return r ? { bureau: String(r.bureau_name), score: n0(r.credit_score), loans: n0(r.existing_loan_count), outstanding: n0(r.total_outstanding), mock: Boolean(r.mock_data) } : null;
}

const APP_COLS = `a.application_id::text id, a.application_reference ref, a.loan_purpose product, l.lender_name lender, a.lender_id::text lender_id, a.requested_amount amount,
  a.tenure_months tenure, a.interest_rate rate, a.application_status status, a.last_updated_at, a.is_synthetic, a.farmer_id::text farmer_id,
  c.consent_code, a.consent_id::text consent_id`;
async function hydrateApplication(tx: Tx, r: Record<string, unknown>): Promise<Application> {
  const id = String(r.id);
  const history = await tx.query<Record<string, unknown>>('select status, note, created_at from loan_application_events where application_id = $1 order by created_at', [id]);
  const docs = await tx.query<Record<string, unknown>>('select document_type, document_status from loan_documents where application_id = $1 order by uploaded_at, document_type', [id]);
  const sharing = await tx.query<Record<string, unknown>>(`select s.reference_id, c.consent_code, l.lender_name, s.data_categories, s.purpose, s.sharing_status, s.shared_at
    from data_sharing_logs s left join consent_records c on c.consent_id = s.consent_id left join lenders l on l.lender_id = s.recipient_id where s.application_id = $1 order by s.shared_at`, [id]);
  const ORDER: DocId[] = ['kyc', 'land', 'credit', 'id', 'bank', 'quote'];
  return {
    id, ref: String(r.ref), product: String(r.product), lender: String(r.lender), lenderId: String(r.lender_id), amount: n0(r.amount), tenure: n0(r.tenure), rate: n0(r.rate),
    status: r.status as AppStatus, consentCode: (r.consent_code as string) ?? null,
    history: history.map((h) => ({ status: h.status as AppStatus, note: String(h.note ?? ''), at: iso(h.created_at) })),
    docs: docs.map((d) => ({ id: d.document_type as DocId, status: d.document_status as Application['docs'][number]['status'] })).sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id)),
    sharing: sharing.map((s): SharingLog => ({ id: String(s.reference_id), consentCode: String(s.consent_code ?? ''), recipient: String(s.lender_name ?? ''),
      categories: (typeof s.data_categories === 'string' ? JSON.parse(s.data_categories) : s.data_categories) as string[], purpose: String(s.purpose), status: s.sharing_status as SharingLog['status'], at: iso(s.shared_at) })),
  };
}
export async function latestApplicationForFarmer(tx: Tx, farmerId: string) {
  const r = (await tx.query<Record<string, unknown>>(`select ${APP_COLS} from loan_applications a join lenders l on l.lender_id = a.lender_id left join consent_records c on c.consent_id = a.consent_id
    where a.farmer_id = $1 order by a.submitted_at desc limit 1`, [farmerId]))[0];
  return r ? hydrateApplication(tx, r) : null;
}
export async function getApplication(tx: Tx, id: string) {
  const r = one(await tx.query<Record<string, unknown>>(`select ${APP_COLS} from loan_applications a join lenders l on l.lender_id = a.lender_id left join consent_records c on c.consent_id = a.consent_id
    where a.application_id = $1`, [id]), 'Application');
  return { app: await hydrateApplication(tx, r), farmerId: String(r.farmer_id), consentId: (r.consent_id as string) ?? null, background: Boolean(r.is_synthetic) };
}
export async function nextApplicationRef(tx: Tx) {
  return 'DF-' + one(await tx.query<{ n: string }>(`select nextval('loan_application_ref_seq')::text n`), 'Sequence').n;
}
export async function createApplication(tx: Tx, a: { farmerId: string; lenderId: string; productCode: string; ref: string; amount: number; tenure: number; rate: number; product: string; consentId: string | null }) {
  const id = one(await tx.query<{ id: string }>(`insert into loan_applications (farmer_id, lender_id, loan_product_id, application_reference, requested_amount, tenure_months, interest_rate, loan_purpose,
      application_status, submitted_at, last_updated_at, consent_id)
    values ($1,$2,(select loan_product_id from loan_products where product_code = $3),$4,$5,$6,$7,$8,'submitted',now(),now(),$9) returning application_id::text id`,
    [a.farmerId, a.lenderId, a.productCode, a.ref, a.amount, a.tenure, a.rate, a.product, a.consentId]), 'Application').id;
  if (a.consentId) await tx.query('update consent_records set application_id = $1 where consent_id = $2', [id, a.consentId]);
  return id;
}
export async function addApplicationEvent(tx: Tx, id: string, status: AppStatus, note: string, setStatus = true) {
  await tx.query('insert into loan_application_events (application_id, status, note) values ($1, $2, $3)', [id, status, note]);
  if (setStatus) {
    const rows = await tx.query('update loan_applications set application_status = $2, last_updated_at = now() where application_id = $1 returning application_id', [id, status]);
    if (!rows.length) throw new DbError('Application not found', 404);
  }
}
export async function setDocuments(tx: Tx, id: string, docs: { id: DocId; status: string }[]) {
  for (const d of docs) {
    await tx.query(`insert into loan_documents (application_id, document_type, document_status, verification_status) values ($1, $2, $3, $4)
      on conflict (application_id, document_type) do update set document_status = excluded.document_status, verification_status = excluded.verification_status`,
      [id, d.id, d.status, d.status === 'received' ? 'verified' : 'pending']);
  }
}
export async function logSharing(tx: Tx, s: { farmerId: string; applicationId: string; consentId: string; lenderId: string; categories: string[]; purpose: string; ref: string }) {
  await tx.query(`insert into data_sharing_logs (farmer_id, application_id, consent_id, recipient_id, data_categories, purpose, sharing_status, shared_at, reference_id)
    values ($1,$2,$3,$4,$5,$6,'completed',now(),$7)`, [s.farmerId, s.applicationId, s.consentId, s.lenderId, JSON.stringify(s.categories), s.purpose, s.ref]);
}
export async function listLenderCases(tx: Tx) {
  return tx.query<Record<string, unknown>>(`select a.application_id::text id, a.application_reference ref, a.loan_purpose product, a.requested_amount amount, a.application_status status,
      a.last_updated_at, a.is_synthetic, f.farmer_code, s.name society
    from loan_applications a left join farmers f on f.farmer_id = a.farmer_id left join societies s on s.society_id = f.society_id
    order by a.is_synthetic, a.submitted_at desc limit 200`);
}
export async function logDataAccess(tx: Tx, a: { accessor: string; farmerId: string; lenderId: string; applicationId: string; categories: string[]; purpose: string }) {
  await tx.query(`insert into data_access_logs (accessor, accessor_role, farmer_id, lender_id, application_id, categories, purpose) values ($1, 'lender', $2, $3, $4, $5, $6)`,
    [a.accessor, a.farmerId, a.lenderId, a.applicationId, JSON.stringify(a.categories), a.purpose]);
}
export async function lenderName(tx: Tx, id: string) {
  return (await tx.query<{ n: string }>('select lender_name n from lenders where lender_id = $1', [id]))[0]?.n ?? 'Lender';
}

// ---------------------------------------------------------------- audit
export async function audit(tx: Tx, e: { actor: string; role: string; action: string; cooperativeId?: string | null; societyId?: string | null; lenderId?: string | null; farmerId?: string | null; entityType?: string; entityId?: string | null }) {
  await tx.query(`insert into audit_events (actor, actor_role, action, cooperative_id, society_id, lender_id, farmer_id, entity_type, entity_id) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [e.actor, e.role, e.action, e.cooperativeId ?? null, e.societyId ?? null, e.lenderId ?? null, e.farmerId ?? null, e.entityType ?? null, e.entityId ?? null]);
}
export async function listAudit(tx: Tx, limit = 100): Promise<AuditEvent[]> {
  return (await tx.query<Record<string, unknown>>('select occurred_at, actor, action from audit_events order by occurred_at desc limit $1', [limit]))
    .map((r) => ({ at: iso(r.occurred_at), actor: String(r.actor), action: String(r.action) }));
}

// ---------------------------------------------------------------- planning
export async function plannerDataset(tx: Tx, cooperativeId: string, asOf: string): Promise<PlannerDataset> {
  const union = one(await tx.query<{ id: string; name: string }>('select cooperative_id::text id, name from cooperatives where cooperative_id = $1', [cooperativeId]), 'Union');
  const products = (await tx.query<Record<string, unknown>>('select * from products order by sort_order')).map((p) => ({
    id: p.product_id as PlannerDataset['products'][number]['id'], name: String(p.name), unit: String(p.unit), milkPerUnit: Number(p.milk_litres_per_unit), valuePerLitre: Number(p.value_per_litre),
    capacity: num(p.plant_capacity_litres), buffaloShare: Number(p.buffalo_share), isFallback: Boolean(p.is_fallback), isLiquidMilk: Boolean(p.is_liquid_milk),
  }));
  const weather = await tx.query<{ city: City; d: string; t: string }>('select city, weather_date::text d, max_temp_c t from weather_daily order by city, weather_date');
  const dates = [...new Set(weather.map((w) => w.d))].sort();
  const di = new Map(dates.map((d, i) => [d, i]));
  const temps = {} as Record<City, number[]>;
  for (const w of weather) { (temps[w.city] ??= new Array(dates.length).fill(0))[di.get(w.d)!] = Number(w.t); }
  // demand signals received up to the planning date
  const demand = await tx.query<{ city: string; p: string; ch: Channel; d: string; u: string }>(
    'select city, product_id p, channel ch, demand_date::text d, units u from demand_daily where demand_date <= $1', [asOf]);
  const units: PlannerDataset['units'] = {};
  for (const r of demand) {
    const k = `${r.city}|${r.p}`;
    const u = (units[k] ??= { dealer: new Array(dates.length).fill(0), qcomm: new Array(dates.length).fill(0), shop: new Array(dates.length).fill(0) });
    const i = di.get(r.d);
    if (i !== undefined) u[r.ch][i] = Number(r.u);
  }
  const events = (await tx.query<Record<string, unknown>>('select name, kind, starts_on::text f, ends_on::text t, effects from calendar_events order by starts_on')).map((e) => ({
    name: String(e.name), kind: e.kind as 'festival' | 'heatwave', from: String(e.f), to: String(e.t), effects: (typeof e.effects === 'string' ? JSON.parse(e.effects) : e.effects) as Record<string, number>,
  }));
  const sources = (await tx.query<Record<string, unknown>>('select * from data_sources order by sort_order')).map((s) => ({
    id: String(s.source_id), name: String(s.name), kind: String(s.kind), lag: String(s.freshness), grain: String(s.granularity), quality: n0(s.quality_score), prevQuality: n0(s.previous_quality_score), note: String(s.note ?? ''),
  }));
  const so = await tx.query<{ m: string; t: string; l: string; s: string }>('select outlook_month::text m, milk_type t, expected_litres_per_day l, market_share s from supply_outlook where cooperative_id = $1 order by outlook_month', [cooperativeId]);
  const months = [...new Set(so.map((x) => x.m))];
  const supply = months.map((m) => ({ month: m, buffalo: Number(so.find((x) => x.m === m && x.t === 'buffalo')?.l ?? 0), cow: Number(so.find((x) => x.m === m && x.t === 'cow')?.l ?? 0), marketShare: Number(so.find((x) => x.m === m)?.s ?? 0.55) }));
  const baseline: Record<string, number> = {};
  for (const r of await tx.query<{ p: string; l: string }>(`select l.product_id p, l.litres_per_day l from production_plan_lines l join production_plans p on p.plan_id = l.plan_id
      where p.cooperative_id = $1 and p.kind = 'baseline' and p.status = 'accepted'`, [cooperativeId])) baseline[r.p] = Number(r.l);
  const societies: SocietyLite[] = (await tx.query<Record<string, unknown>>('select society_id::text id, code, name, member_count, buffalo_litres_per_day, region from societies where cooperative_id = $1 order by code', [cooperativeId]))
    .map((s) => ({ id: String(s.id), code: String(s.code), name: String(s.name), members: n0(s.member_count), buffaloLitres: n0(s.buffalo_litres_per_day), region: String(s.region ?? '') }));
  const zones: ZoneRow[] = (await tx.query<Record<string, unknown>>('select * from demand_zones order by zone_id')).map((z) => ({
    id: String(z.zone_id), name: String(z.name), city: z.city as City, lat: Number(z.latitude), lng: Number(z.longitude), aff: Number(z.affluence), inland: Number(z.inland), weight: Number(z.demand_weight), qShare: Number(z.qcomm_share),
  }));
  // keep zone order as seeded (M0, M1, ... A28 ...)
  zones.sort((a, b) => a.city.localeCompare(b.city) * -1 || Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { asOf, union, products, dates, temps, units, events, sources, supply, baseline, societies, zones };
}
export async function acceptPlan(tx: Tx, p: { cooperativeId: string; month: string; kind: 'recommended' | 'adjusted'; by: string; lines: Record<string, number> }) {
  await tx.query(`update production_plans set status = 'superseded' where cooperative_id = $1 and plan_month = $2 and status = 'accepted' and kind <> 'baseline'`, [p.cooperativeId, p.month]);
  const id = one(await tx.query<{ id: string }>(`insert into production_plans (cooperative_id, plan_month, kind, status, accepted_by, accepted_at) values ($1,$2,$3,'accepted',$4,now()) returning plan_id::text id`,
    [p.cooperativeId, p.month, p.kind, p.by]), 'Plan').id;
  await insertMany(tx, 'production_plan_lines', ['plan_id', 'product_id', 'litres_per_day'], Object.entries(p.lines).map(([k, v]) => [id, k, Math.round(v * 10) / 10]));
}
export async function acceptedPlans(tx: Tx, cooperativeId: string) {
  return (await tx.query<{ m: string; k: 'recommended' | 'adjusted'; by: string }>(`select plan_month::text m, kind k, accepted_by by from production_plans
    where cooperative_id = $1 and status = 'accepted' and kind <> 'baseline' order by plan_month`, [cooperativeId])).map((r) => ({ month: r.m, kind: r.k, acceptedBy: r.by }));
}
