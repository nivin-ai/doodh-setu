// Database tests against the local Postgres (PGlite): migrations, seed, services and row-level security.
// Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asSystem, withScope, type Scope } from '../lib/server/db.ts';
import { IDS, DEMO_SOCIETY_CODE } from '../lib/server/seed.ts';
import { getFarmerData, farmerAction } from '../lib/server/services/farmer.ts';
import { getSocietyData, societyAction } from '../lib/server/services/society.ts';
import { getPlannerDataset, getPlannerWorkflow, plannerAction } from '../lib/server/services/planner.ts';
import { getLenderCase, getLenderData, lenderAction } from '../lib/server/services/lender.ts';
import { resetDemo } from '../lib/server/services/demo.ts';
import { findStaffUser } from '../lib/server/repositories/users.ts';

const ASOF = '2027-03-20';
const farmer: Scope = { role: 'farmer', actor: 'Farmer', farmerId: IDS.farmer(DEMO_SOCIETY_CODE, '0412') };
const other: Scope = { role: 'farmer', actor: 'Other', farmerId: IDS.farmer(DEMO_SOCIETY_CODE, '0001') };
const secretary: Scope = { role: 'secretary', actor: 'Society secretary', societyId: IDS.society(DEMO_SOCIETY_CODE) };
const otherSecretary: Scope = { role: 'secretary', actor: 'Other secretary', societyId: IDS.society('S002') };
const planner: Scope = { role: 'planner', actor: 'Union planner', cooperativeId: IDS.union };
const approver: Scope = { role: 'approver', actor: 'Union approver', cooperativeId: IDS.union };
const lender: Scope = { role: 'lender', actor: 'Lender case officer', lenderId: IDS.lender('GPB') };
const otherLender: Scope = { role: 'lender', actor: 'NBFC officer', lenderId: IDS.lender('SCN') };
const count = (s: Scope, sql: string) => withScope(s, async (tx) => Number((await tx.query<{ n: number }>(`select count(*)::int n from (${sql}) x`))[0].n));

test('seed is present and repeatable', async () => {
  await resetDemo();
  const n = await asSystem(async (tx) => (await tx.query<{ n: number }>('select count(*)::int n from farmers where is_synthetic'))[0].n);
  assert.equal(n, 414);
});

test('staff sign-in checks hashed passwords', async () => {
  assert.equal((await asSystem((tx) => findStaffUser(tx, 'planner', 'planner123')))?.role, 'planner');
  assert.equal(await asSystem((tx) => findStaffUser(tx, 'planner', 'wrong')), null);
});

test('farmer sees only their own records', async () => {
  const d = await getFarmerData(farmer, ASOF);
  assert.equal(d.profile.code, '0412');
  assert.ok(d.sessions.length > 1000 && d.sessions.every((s) => s.date <= ASOF));
  assert.equal(d.finance.kyc.length, 2);
  assert.equal(await count(farmer, 'select * from farmers'), 1);
  assert.equal(await count(farmer, 'select * from milk_transactions where farmer_id <> app.farmer_id()'), 0);
  assert.equal(await count(other, 'select * from farmer_kyc'), 0);
});

test('planner sees planning data but no individual farmers', async () => {
  assert.equal(await count(planner, 'select * from farmers'), 0);
  assert.equal(await count(planner, 'select * from milk_transactions'), 0);
  const ds = await getPlannerDataset(planner, ASOF);
  assert.equal(ds.societies.length, 120);
  assert.equal(ds.products.length, 6);
  assert.ok(ds.units['Mumbai|curd'].dealer.length === ds.dates.length);
});

test('secretary sees own society only', async () => {
  assert.equal(await count(secretary, 'select * from farmers'), 412);
  assert.equal(await count(otherSecretary, 'select * from farmers'), 0);
  assert.equal(await count(secretary, 'select * from demand_daily'), 0);
});

test('incentive workflow with maker-checker, publish and simulated responses', async () => {
  const ds = await getPlannerDataset(planner, ASOF);
  const ids = ds.societies.slice(0, 90).map((s) => s.id);
  await assert.rejects(plannerAction(approver, { action: 'submit', rate: 30, societyIds: ids }));
  const { id } = await plannerAction(planner, { action: 'submit', rate: 30, societyIds: ids }) as { id: string };
  await assert.rejects(plannerAction(planner, { action: 'decide', programId: id, decision: 'approve' }));
  // the database itself refuses an approval by the submitter, even if the service were bypassed
  await assert.rejects(withScope({ ...approver, actor: 'Union planner' }, (tx) => tx.query(`update incentive_programs set status = 'approved', approved_by = 'Union planner' where program_id = $1`, [id])));
  // the secretary cannot see it before approval
  assert.equal((await getSocietyData(secretary, ASOF)).program, null);
  await plannerAction(approver, { action: 'decide', programId: id, decision: 'approve' });
  assert.equal((await getSocietyData(secretary, ASOF)).program?.status, 'approved');
  await assert.rejects(farmerAction(farmer, { action: 'heard', asOf: ASOF }));
  await societyAction(secretary, { action: 'publish', sendSlot: 'evening', asOf: ASOF });
  const soc = await getSocietyData(secretary, ASOF);
  assert.equal(soc.program?.status, 'published');
  assert.ok(soc.reach.interested > 50 && soc.reach.interested < 100, `interested ${soc.reach.interested}`);
  const apr = await getSocietyData(secretary, '2027-04-30');
  assert.ok(apr.reach.interested > soc.reach.interested);
  await farmerAction(farmer, { action: 'interested', asOf: ASOF });
  const fd = await getFarmerData(farmer, ASOF);
  assert.equal(fd.premium?.rate, 30);
  assert.deepEqual(fd.response, { heard: true, interested: true });
  const wf = await getPlannerWorkflow(planner);
  assert.ok(wf.audit.some((a) => a.action.startsWith('Approved')));
});

test('member query thread between farmer and own society', async () => {
  await farmerAction(farmer, { action: 'ask', text: 'When is the vet visiting?', lang: 'en' });
  const q = (await getSocietyData(secretary, ASOF)).queries[0];
  assert.equal(q.messages[0].text, 'When is the vet visiting?');
  assert.equal((await getSocietyData(otherSecretary, ASOF).catch(() => null))?.queries.length ?? 0, 0);
  await societyAction(secretary, { action: 'reply', queryId: q.id, text: 'Thursday morning' });
  const f = (await getFarmerData(farmer, ASOF)).queries[0];
  assert.equal(f.farmerSeen, false);
  assert.equal(f.messages[1].text, 'Thursday morning');
  await assert.rejects(farmerAction(other, { action: 'followUp', queryId: q.id, text: 'hijack' }));
});

test('lender sees farmer data only with consent, and access is logged', async () => {
  assert.equal(await count(lender, 'select * from farmer_kyc'), 0);
  const fd = await getFarmerData(farmer, ASOF);
  const product = fd.finance.products.find((p) => p.id === 'gpb')!;
  const c = await farmerAction(farmer, { action: 'grantConsent', consent: { recipient: product.lender, purpose: 'Loan assessment', categories: ['identity_kyc', 'land_property', 'credit_history', 'milk_income'], noticeVersion: 'DPDP-LOAN-1.0' } }) as { id: string };
  const app = await farmerAction(farmer, { action: 'apply', application: { productCode: 'gpb', amount: 60000, tenure: 24, loanConsentId: c.id } }) as { id: string; ref: string };
  assert.equal(app.ref, 'DF-10024');
  assert.equal(await count(otherLender, 'select * from loan_applications'), 0);
  const list = await getLenderData(lender);
  assert.ok(list.cases.find((x) => x.id === app.id));
  const kase = await getLenderCase(lender, app.id, ASOF);
  assert.equal(kase.kyc?.length, 2);
  assert.ok(kase.income && kase.income.length >= 6);
  assert.equal(await count(farmer, 'select * from data_access_logs'), 1);
  await lenderAction(lender, { action: 'requestDoc', id: app.id });
  await farmerAction(farmer, { action: 'uploadDoc' });
  await lenderAction(lender, { action: 'status', id: app.id, status: 'approved', note: 'ok' });
  assert.equal((await getFarmerData(farmer, ASOF)).application?.status, 'approved');
  // withdrawing consent cuts the lender off
  await farmerAction(farmer, { action: 'withdrawConsent', consentId: c.id });
  assert.equal(await count(lender, 'select * from farmer_kyc'), 0);
  assert.equal((await getLenderCase(lender, app.id, ASOF)).kyc, null);
});

test('reset clears demo workflow but keeps background cases', async () => {
  await resetDemo();
  assert.equal((await getPlannerWorkflow(planner)).program, null);
  assert.equal((await getLenderData(lender)).cases.length, 3);
});
