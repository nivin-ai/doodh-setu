// Seeds the SYNTHETIC demo data set (lib/demo-data) into the database.
//
// Safe and repeatable:
//   * seedDemoData() does nothing if the demo union (code KDU-DEMO) already exists.
//   * every seeded row is marked is_synthetic (or belongs to a synthetic farmer/union), and
//     resetDemoWorkflow() only deletes workflow rows that belong to synthetic records.
// Real records are never updated or deleted by this file.
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { insertMany, type Tx } from './db';
import { generateDemand, GEN_PRODUCTS, EVENTS, HEATWAVE } from '../demo-data/demand';
import { generateSessions } from '../demo-data/milk';
import { generateSocieties } from '../demo-data/societies';
import { GEN_ZONES } from '../demo-data/zones';
import { GEN_MEMBERS } from '../demo-data/members';
import {
  BACKGROUND_CASES, BASELINE_PLAN, DATA_SOURCES, DEMO_CREDIT, DEMO_FARMER, DEMO_FEDERATION, DEMO_KYC, DEMO_PROPERTY, DEMO_UNION,
  DEMO_USERS, LENDERS, LOAN_PRODUCTS, PRODUCT_ROWS, SOCIETY_COLLECTION_ANCHORS, SUPPLY_OUTLOOK, UNION_SHARE,
} from '../demo-data/reference';
import { BASE_RATE, kgFat, snfBonus } from '../farmer';
import { addDays, gauss, iso, mulberry32, toDate } from '../util';

export const DEMO_AS_OF = '2027-03-20';

// Stable ids derived from a name, so the seed always produces the same keys
export function uid(key: string) {
  const h = createHash('sha1').update('doodh-setu:' + key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}
export const IDS = {
  federation: uid('coop:GCMMF-DEMO'),
  union: uid('coop:KDU-DEMO'),
  society: (code: string) => uid('society:' + code),
  farmer: (society: string, code: string) => uid(`farmer:${society}:${code}`),
  lender: (code: string) => uid('lender:' + code),
};
export const DEMO_SOCIETY_CODE = 'S001';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`;
}

export async function isSeeded(tx: Tx) {
  return (await tx.query('select 1 from cooperatives where code = $1', [DEMO_UNION.code])).length > 0;
}

export async function seedDemoData(tx: Tx, opts: { log?: (m: string) => void } = {}) {
  const log = opts.log ?? (() => undefined);
  if (await isSeeded(tx)) { log('Demo data already present, nothing to do.'); return false; }

  // Cooperative structure
  await tx.query(`insert into cooperatives (cooperative_id, code, name, coop_type, state, is_synthetic) values ($1, $2, $3, 'federation', $4, true)`,
    [IDS.federation, DEMO_FEDERATION.code, DEMO_FEDERATION.name, DEMO_FEDERATION.state]);
  await tx.query(`insert into cooperatives (cooperative_id, code, name, coop_type, parent_cooperative_id, district, state, is_synthetic) values ($1, $2, $3, 'union', $4, $5, $6, true)`,
    [IDS.union, DEMO_UNION.code, DEMO_UNION.name, IDS.federation, DEMO_UNION.district, DEMO_UNION.state]);
  const socs = generateSocieties();
  await insertMany(tx, 'societies', ['society_id', 'cooperative_id', 'code', 'name', 'village', 'district', 'state', 'region', 'member_count', 'buffalo_litres_per_day', 'is_synthetic'],
    socs.map((s) => {
      const code = 'S' + String(s.id).padStart(3, '0');
      return [IDS.society(code), IDS.union, code, s.name, s.id === 1 ? DEMO_FARMER.village : s.name.split(' Milk')[0], 'Anand', 'Gujarat', s.region, s.members, s.buffaloLitres, true];
    }));
  log(`Societies: ${socs.length}`);

  // Products, data sources, zones, calendar, weather and demand
  await insertMany(tx, 'products', ['product_id', 'name', 'unit', 'milk_litres_per_unit', 'value_per_litre', 'plant_capacity_litres', 'buffalo_share', 'is_fallback', 'is_liquid_milk', 'temp_sensitivity', 'sort_order'],
    PRODUCT_ROWS.map((p, i) => [p.id, p.name, p.unit, p.milkPerUnit, p.valuePerLitre, p.capacity, p.buffaloShare, p.isFallback, p.isLiquidMilk, p.beta, i]), 'on conflict (product_id) do nothing');
  await insertMany(tx, 'data_sources', ['source_id', 'name', 'kind', 'freshness', 'granularity', 'quality_score', 'previous_quality_score', 'note', 'sort_order'],
    DATA_SOURCES.map((s, i) => [s.id, s.name, s.kind, s.lag, s.grain, s.quality, s.prevQuality, s.note, i]), 'on conflict (source_id) do nothing');
  await insertMany(tx, 'demand_zones', ['zone_id', 'city', 'name', 'latitude', 'longitude', 'demand_weight', 'qcomm_share', 'affluence', 'inland', 'is_synthetic'],
    GEN_ZONES.map((z) => [z.id, z.city, z.name, z.lat, z.lng, z.weight, z.qShare, z.aff, z.inland, true]), 'on conflict (zone_id) do nothing');
  for (const e of EVENTS) {
    const heat = e.from === HEATWAVE.from && e.to === HEATWAVE.to;
    await tx.query(`insert into calendar_events (name, kind, starts_on, ends_on, effects, is_synthetic) values ($1, $2, $3, $4, $5::text::jsonb, true)`,
      [e.name, heat ? 'heatwave' : 'festival', e.from, e.to, JSON.stringify(heat ? { temp_plus: HEATWAVE.plus } : e.effects)]);
  }
  const G = generateDemand();
  const weather: unknown[][] = [];
  for (const city of Object.keys(G.temps) as (keyof typeof G.temps)[]) {
    for (const [date, t] of Object.entries(G.temps[city])) weather.push([city, date, t, date <= DEMO_AS_OF ? 'observed' : 'outlook', true]);
  }
  await insertMany(tx, 'weather_daily', ['city', 'weather_date', 'max_temp_c', 'kind', 'is_synthetic'], weather, 'on conflict do nothing');
  const demand: unknown[][] = [];
  for (const [key, arr] of Object.entries(G.out)) {
    const [city, product] = key.split('|');
    // Demand signals arrive up to the planning date; later days are what actually sells (used by
    // the 30 Apr demo date and the results card).
    for (const x of arr) for (const ch of ['dealer', 'qcomm', 'shop'] as const) demand.push([city, product, ch, x.date, Math.round(x.byChannel[ch] * 1000) / 1000, true]);
  }
  await insertMany(tx, 'demand_daily', ['city', 'product_id', 'channel', 'demand_date', 'units', 'is_synthetic'], demand, 'on conflict do nothing');
  log(`Demand rows: ${demand.length}, weather rows: ${weather.length}`);
  void GEN_PRODUCTS;

  // Supply outlook and last season's production plan
  await insertMany(tx, 'supply_outlook', ['cooperative_id', 'outlook_month', 'milk_type', 'expected_litres_per_day', 'market_share', 'is_synthetic'],
    SUPPLY_OUTLOOK.flatMap((m) => [[IDS.union, m.month, 'buffalo', m.buffalo, UNION_SHARE, true], [IDS.union, m.month, 'cow', m.cow, UNION_SHARE, true]]));
  const baseline = uid('plan:baseline:KDU-DEMO');
  await tx.query(`insert into production_plans (plan_id, cooperative_id, kind, status, accepted_by, accepted_at, is_synthetic) values ($1, $2, 'baseline', 'accepted', 'Last season (Apr-Jun 2026)', '2026-03-25', true)`, [baseline, IDS.union]);
  await insertMany(tx, 'production_plan_lines', ['plan_id', 'product_id', 'litres_per_day'], Object.entries(BASELINE_PLAN).map(([p, l]) => [baseline, p, l]));

  // Farmers of the demo society: the demo farmer and 411 other members
  const s1 = IDS.society(DEMO_SOCIETY_CODE);
  const me = IDS.farmer(DEMO_SOCIETY_CODE, DEMO_FARMER.code);
  const farmers: unknown[][] = [[me, DEMO_FARMER.code, DEMO_FARMER.name, null, DEMO_FARMER.name, DEMO_FARMER.language, DEMO_FARMER.mobile, true, IDS.union, s1, DEMO_FARMER.registered, 'smartphone', true]];
  const addresses: unknown[][] = [[me, 'residential', DEMO_FARMER.village, DEMO_FARMER.taluka, DEMO_FARMER.district, DEMO_FARMER.state, DEMO_FARMER.pincode, true]];
  const cattle: unknown[][] = [];
  const traits: unknown[][] = [];
  // Each member's usual daily milk is spread across their animals (cattle.estimated_daily_yield)
  const herd = (fid: string, b: number, c: number, litres: number) => {
    const per = litres / Math.max(1, b + c);
    for (let i = 0; i < b; i++) cattle.push([fid, 'buffalo', 'Murrah', 'female', 'lactating', 'healthy', 'active', Math.round(per * 100) / 100]);
    for (let i = 0; i < c; i++) cattle.push([fid, 'cow', 'Gir', 'female', 'lactating', 'healthy', 'active', Math.round(per * 100) / 100]);
  };
  herd(me, DEMO_FARMER.animals.buffalo, DEMO_FARMER.animals.cow, 16);
  for (const m of GEN_MEMBERS) {
    const fid = IDS.farmer(DEMO_SOCIETY_CODE, m.id);
    const [first, ...rest] = m.name.split(' ');
    farmers.push([fid, m.id, first, rest.join(' ') || null, m.name, m.lang, m.mobile, true, IDS.union, s1, '2018-04-01', m.device === 'Smartphone' ? 'smartphone' : 'feature_phone', true]);
    addresses.push([fid, 'residential', m.village, 'Anand', 'Anand', 'Gujarat', null, true]);
    herd(fid, m.buffaloes, m.cows, m.litres);
    traits.push([fid, m.heardP, m.interestedP]);
  }
  // Members of other societies who appear in the lender's background cases
  for (const c of BACKGROUND_CASES.filter((x) => x.societyCode !== DEMO_SOCIETY_CODE)) {
    const fid = IDS.farmer(c.societyCode, c.farmerCode);
    farmers.push([fid, c.farmerCode, 'Member', c.farmerCode, `Member ${c.farmerCode}`, 'gu', null, false, IDS.union, IDS.society(c.societyCode), '2017-04-01', 'smartphone', true]);
  }
  await insertMany(tx, 'farmers', ['farmer_id', 'farmer_code', 'first_name', 'last_name', 'display_name', 'preferred_language', 'mobile_number', 'mobile_verified', 'cooperative_id', 'society_id', 'registration_date', 'device_type', 'is_synthetic'], farmers);
  await insertMany(tx, 'farmer_addresses', ['farmer_id', 'address_type', 'village', 'taluka', 'district', 'state', 'pincode', 'is_primary'], addresses);
  await insertMany(tx, 'cattle', ['farmer_id', 'animal_type', 'breed', 'gender', 'milk_production_status', 'health_status', 'cattle_status', 'estimated_daily_yield'], cattle);
  await insertMany(tx, 'demo_simulation_traits', ['farmer_id', 'heard_p', 'interested_p'], traits);
  log(`Farmers: ${farmers.length}, cattle: ${cattle.length}`);

  // Milk pours of the demo farmer (authoritative collection records; payments are derived from them)
  const pours = generateSessions().map((s) => {
    const k = kgFat(s);
    const gross = Math.round(k * (BASE_RATE + snfBonus(s.snf)) * 100) / 100;
    return [me, s1, IDS.union, s.date, s.session, s.type, s.litres, s.fat, s.snf, s.snf >= 8.5 ? 'good' : 'low_snf', s.litres ? Math.round((gross / s.litres) * 100) / 100 : 0, gross, 0, gross, 'paid', true];
  });
  await insertMany(tx, 'milk_transactions', ['farmer_id', 'society_id', 'cooperative_id', 'transaction_date', 'collection_session', 'milk_type', 'milk_quantity_litres', 'fat_percentage', 'snf_percentage', 'quality_status', 'rate_per_litre', 'gross_amount', 'deductions', 'net_amount', 'payment_status', 'is_synthetic'], pours);

  // Society daily collection, Jan-Jun 2027, passing through the demo-date anchors
  const r = mulberry32(2560);
  const coll: unknown[][] = [];
  for (let d = toDate('2027-01-01'); d <= toDate('2027-06-30'); d = addDays(d, 1)) {
    const day = iso(d), m = d.getUTCMonth();
    const season = [1.1, 1.07, 1.0, 0.9, 0.86, 0.88][m];
    const a = SOCIETY_COLLECTION_ANCHORS[day];
    const buf = a ? a.buffalo : Math.round(2560 * season * (1 + gauss(r) * 0.02));
    const cow = a ? a.cow : Math.round(2120 * (0.96 + (season - 0.86) * 0.4) * (1 + gauss(r) * 0.02));
    coll.push([s1, day, 'buffalo', buf, 6.9, 9.0, true], [s1, day, 'cow', cow, 4.2, 8.5, true]);
  }
  await insertMany(tx, 'society_collection_daily', ['society_id', 'collection_date', 'milk_type', 'litres', 'avg_fat', 'avg_snf', 'is_synthetic'], coll);

  // Finance: KYC (masked + provider tokens only), land, credit, lenders and products
  await insertMany(tx, 'farmer_kyc', ['farmer_id', 'document_type', 'document_number_token', 'document_number_masked', 'verification_status', 'verification_provider', 'verified_at'],
    DEMO_KYC.map((k) => [me, k.type, k.token, k.masked, k.status, k.provider, '2026-11-02']));
  await tx.query(`insert into farmer_properties (farmer_id, ownership_type, survey_number, village, district, state, total_area, area_unit, land_use, verification_status, record_type) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [me, DEMO_PROPERTY.ownership, DEMO_PROPERTY.survey, DEMO_PROPERTY.village, DEMO_PROPERTY.district, DEMO_PROPERTY.state, DEMO_PROPERTY.area, DEMO_PROPERTY.unit, DEMO_PROPERTY.use, DEMO_PROPERTY.status, DEMO_PROPERTY.record]);
  await tx.query(`insert into credit_profiles (farmer_id, bureau_name, credit_score, existing_loan_count, total_outstanding, retrieval_status, mock_data) values ($1,$2,$3,$4,$5,'available_with_consent',true)`,
    [me, DEMO_CREDIT.bureau, DEMO_CREDIT.score, DEMO_CREDIT.loans, DEMO_CREDIT.outstanding]);
  await insertMany(tx, 'lenders', ['lender_id', 'lender_name', 'lender_code', 'lender_type', 'integration_status', 'is_synthetic'],
    LENDERS.map((l) => [IDS.lender(l.code), l.name, l.code, l.type, l.integration, true]), 'on conflict (lender_name) do nothing');
  await insertMany(tx, 'loan_products', ['lender_id', 'product_code', 'product_name', 'purpose', 'min_amount', 'max_amount', 'interest_rate', 'max_tenure_months', 'fee_pct', 'eligibility', 'is_synthetic'],
    LOAN_PRODUCTS.map((p) => [IDS.lender(p.lender), p.code, p.name, p.purpose, p.min, p.max, p.rate, p.maxTenure, p.feePct, p.elig, true]), 'on conflict (product_code) do nothing');

  await seedBackgroundCases(tx);

  // Demo staff accounts
  for (const u of DEMO_USERS) {
    const scope = {
      cooperative: ['planner', 'approver', 'admin'].includes(u.role) ? IDS.union : null,
      society: ['secretary', 'admin'].includes(u.role) ? s1 : null,
      lender: ['lender', 'admin'].includes(u.role) ? IDS.lender('GPB') : null,
    };
    await tx.query(`insert into app_users (username, display_name, role, password_hash, cooperative_id, society_id, lender_id, is_demo) values ($1,$2,$3,$4,$5,$6,$7,true) on conflict (username) do nothing`,
      [u.username, u.name, u.role, hashPassword(u.password), scope.cooperative, scope.society, scope.lender]);
  }
  log('Seed complete.');
  return true;
}

// Other members' loan cases at the demo lender, each with a consent to share milk income
async function seedBackgroundCases(tx: Tx) {
  const lender = IDS.lender('GPB');
  const product = (await tx.query<{ id: string }>(`select loan_product_id::text as id from loan_products where product_code = 'gpb'`))[0]?.id ?? null;
  for (const c of BACKGROUND_CASES) {
    const fid = IDS.farmer(c.societyCode, c.farmerCode);
    const consent = uid('consent:' + c.ref), app = uid('application:' + c.ref);
    await tx.query(`insert into consent_records (consent_id, consent_code, farmer_id, lender_id, recipient_name, consent_notice_version, consent_purpose, consent_status, granted_at, collection_categories, consent_method, language, scope, period)
      values ($1, $2, $3, $4, 'Gramin Partner Bank (demo)', 'DPDP-LOAN-1.0', 'Loan assessment', 'granted', $5, '["milk_income"]', 'assisted', 'gu', 'Milk income summary', 'Until the loan is decided') on conflict do nothing`,
      [consent, 'C-' + c.ref.slice(3), fid, lender, c.updated]);
    await tx.query(`insert into loan_applications (application_id, farmer_id, lender_id, loan_product_id, application_reference, requested_amount, loan_purpose, application_status, submitted_at, last_updated_at, consent_id, tenure_months, interest_rate, is_synthetic)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10,24,10.5,true) on conflict do nothing`, [app, fid, lender, product, c.ref, c.amount, c.product, c.status, c.updated, consent]);
    await tx.query(`insert into loan_application_events (application_id, status, note, created_at) values ($1, $2, 'Background demo case', $3)`, [app, c.status, c.updated]);
  }
}

// Clears what people did during a demo (proposals, responses, queries, consents, applications,
// plans, audit) for synthetic records only, then restores the background lender cases.
export async function resetDemoWorkflow(tx: Tx) {
  const synthFarmers = `select farmer_id from farmers where is_synthetic`;
  await tx.query(`update consent_records set application_id = null where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from incentive_programs where cooperative_id in (select cooperative_id from cooperatives where is_synthetic)`);
  await tx.query(`delete from member_queries where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from data_access_logs where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from data_sharing_logs where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from loan_documents where application_id in (select application_id from loan_applications where farmer_id in (${synthFarmers}))`);
  await tx.query(`delete from loan_application_events where application_id in (select application_id from loan_applications where farmer_id in (${synthFarmers}))`);
  await tx.query(`delete from loan_applications where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from consent_records where farmer_id in (${synthFarmers})`);
  await tx.query(`delete from production_plan_lines where plan_id in (select plan_id from production_plans where kind <> 'baseline' and cooperative_id in (select cooperative_id from cooperatives where is_synthetic))`);
  await tx.query(`delete from production_plans where kind <> 'baseline' and cooperative_id in (select cooperative_id from cooperatives where is_synthetic)`);
  await tx.query(`delete from audit_events where cooperative_id in (select cooperative_id from cooperatives where is_synthetic) or farmer_id in (${synthFarmers})
    or society_id in (select society_id from societies where is_synthetic) or lender_id in (select lender_id from lenders where is_synthetic)`);
  await tx.query(`update farmers set correction_requested_at = null where is_synthetic and correction_requested_at is not null`);
  await seedBackgroundCases(tx);
  // next application reference continues after the highest one left (DF-10024 after a clean reset)
  await tx.query(`select setval('loan_application_ref_seq', greatest(10023, coalesce((select max(substring(application_reference from 4)::int) from loan_applications where application_reference ~ '^DF-[0-9]+$'), 0)))`);
}
