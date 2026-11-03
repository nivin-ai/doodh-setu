// DairyFin tests: catalogue, application engine, consent, role isolation, insurance and the wallet.
// Run: npm test (PGlite) or with DATABASE_URL against a real Postgres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asSystem, withScope, type Scope } from '../lib/server/db.ts';
import { IDS, DEMO_SOCIETY_CODE } from '../lib/server/seed.ts';
import { resetDemo } from '../lib/server/services/demo.ts';
import { farmerFinanceAction, getFarmerFinance, getSocietyFinance, getWallet, societyFinanceAction, walletAction } from '../lib/server/services/dairyfin.ts';
import { getLenderCase, getLenderData, lenderAction } from '../lib/server/services/lender.ts';
import { canMove, indicativeEligibility, validateApplication } from '../lib/dairyfin.ts';

const ASOF = '2027-03-20';
const farmer: Scope = { role: 'farmer', actor: 'Farmer', farmerId: IDS.farmer(DEMO_SOCIETY_CODE, '0412') };
const other: Scope = { role: 'farmer', actor: 'Other', farmerId: IDS.farmer(DEMO_SOCIETY_CODE, '0001') };
const secretary: Scope = { role: 'secretary', actor: 'Society secretary', societyId: IDS.society(DEMO_SOCIETY_CODE) };
const otherSecretary: Scope = { role: 'secretary', actor: 'Other secretary', societyId: IDS.society('S002') };
const lender: Scope = { role: 'lender', actor: 'Lender case officer', lenderId: IDS.lender('GPB') };
const otherLender: Scope = { role: 'lender', actor: 'NBFC officer', lenderId: IDS.lender('SCN') };
const signatory = { name: 'Society secretary', authorised: true };
let insurer: Scope;
let consumer: Scope;
const consent = (categories: string[]) => ({ categories, statements: 3, language: 'en' });

test('setup', async () => {
  await resetDemo();
  const ids = await asSystem(async (tx) => ({
    ins: (await tx.query<{ id: string }>(`select lender_id::text id from lenders where lender_code = 'DINS'`))[0].id,
    con: (await tx.query<{ id: string }>(`select consumer_id::text id from consumers where is_synthetic limit 1`))[0].id,
  }));
  insurer = { role: 'lender', actor: 'Insurer reviewer', lenderId: ids.ins };
  consumer = { role: 'consumer', actor: 'Demo consumer', consumerId: ids.con };
});

test('catalogue is data-driven and grouped by segment', async () => {
  const f = await getFarmerFinance(farmer, ASOF);
  const s = await getSocietyFinance(secretary, signatory, ASOF);
  assert.ok(f.products.every((p) => p.segment === 'farmer'));
  assert.ok(f.products.some((p) => p.type === 'insurance') && f.products.some((p) => p.type === 'loan'));
  assert.deepEqual(s.products.map((p) => p.id).sort(), ['soc-bmc', 'soc-test', 'soc-wc']);
  assert.ok([...f.products, ...s.products].every((p) => !p.termsVerified && p.disclaimer.length > 0), 'all terms are demo/indicative');
  assert.ok(f.cattle.length > 0 && f.cattle.every((c) => c.tag));
});

test('rules: transitions, validation and indicative eligibility', async () => {
  assert.ok(canMove('draft', 'submitted') && !canMove('declined', 'approved') && !canMove('withdrawn', 'in_review'));
  const p = (await getFarmerFinance(farmer, ASOF)).products.find((x) => x.id === 'gpb-eq')!;
  assert.ok(validateApplication(p, { amount: 1000, tenure: 12, answers: {}, docs: [] }, true).length >= 3);
  assert.deepEqual(validateApplication(p, { amount: 50000, tenure: 24, answers: { equipment: 'Chaff cutter', supplier: 'Demo supplier' }, docs: [] }, true), []);
  assert.deepEqual(validateApplication(p, { answers: {}, docs: [] }, false), [], 'drafts can be incomplete');
  assert.equal(indicativeEligibility(p, { membershipMonths: 3 })[0].state, 'not_met');
});

test('farmer loan: draft, submit, lender review, more info, offer, accept', async () => {
  const d = await farmerFinanceAction(farmer, { action: 'save', productCode: 'gpb-eq', amount: 60000, answers: { equipment: 'Milking machine' } });
  assert.equal(d.status, 'draft');
  assert.equal((await getLenderData(lender)).cases.some((c) => c.id === d.id), false, 'lender does not see drafts');
  await assert.rejects(farmerFinanceAction(farmer, { action: 'save', id: d.id, productCode: 'gpb-eq', amount: 60000, tenure: 24, answers: { equipment: 'Milking machine' }, submit: true, consent: consent(['identity_kyc']) }), /Supplier name is required/);
  const s = await farmerFinanceAction(farmer, { action: 'save', id: d.id, productCode: 'gpb-eq', amount: 60000, tenure: 24, answers: { equipment: 'Milking machine', supplier: 'Demo supplier' },
    docs: ['kyc'], submit: true, consent: consent(['identity_kyc', 'milk_income']) });
  assert.equal(s.status, 'submitted');
  // other parties are isolated
  assert.equal((await getFarmerFinance(other, ASOF)).applications.some((a) => a.id === d.id), false);
  assert.equal((await getLenderData(otherLender)).cases.some((c) => c.id === d.id), false);
  const row = (await getLenderData(lender)).cases.find((c) => c.id === d.id)!;
  assert.equal(row.applicantType, 'farmer');
  const c = await getLenderCase(lender, d.id!, ASOF);
  assert.ok(c.kyc && c.income && c.property === null && c.credit === null, 'only consented categories');
  assert.equal(c.farmer?.society, 'Anand Milk Society');
  await lenderAction(lender, { action: 'requestInfo', id: d.id, docs: ['equipment_quote'], note: 'Please upload the quotation' });
  let app = (await getFarmerFinance(farmer, ASOF)).applications.find((a) => a.id === d.id)!;
  assert.equal(app.status, 'more_info');
  assert.equal(app.docs.find((x) => x.id === 'equipment_quote')?.status, 'requested');
  await farmerFinanceAction(farmer, { action: 'uploadDoc', id: d.id, doc: 'equipment_quote' });
  await farmerFinanceAction(farmer, { action: 'respond', id: d.id, note: 'Quotation uploaded' });
  await assert.rejects(lenderAction(lender, { action: 'status', id: d.id, status: 'declined' }), /note/);
  await lenderAction(lender, { action: 'offer', id: d.id, amount: 50000, rate: 11.5, tenure: 24, notes: 'Indicative' });
  await lenderAction(lender, { action: 'note', id: d.id, note: 'Supplier verified by phone' });
  await farmerFinanceAction(farmer, { action: 'offer', id: d.id, decision: 'accept' });
  await lenderAction(lender, { action: 'status', id: d.id, status: 'approved', note: 'Sanction subject to our checks' });
  app = (await getFarmerFinance(farmer, ASOF)).applications.find((a) => a.id === d.id)!;
  assert.equal(app.status, 'approved');
  assert.equal(app.offerStatus, 'accepted');
  assert.equal((await getLenderCase(lender, d.id!, ASOF)).notes.length, 1);
  await assert.rejects(lenderAction(lender, { action: 'status', id: d.id, status: 'in_review' }), /cannot move/);
});

test('withdrawing consent blocks the lender at once', async () => {
  const s = await farmerFinanceAction(farmer, { action: 'save', productCode: 'gpb-wc', amount: 10000, tenure: 6, answers: { use: 'Fodder' }, docs: ['kyc', 'bank'], submit: true, consent: consent(['milk_income']) });
  assert.ok((await getLenderCase(lender, s.id!, ASOF)).income);
  const consentId = (await getFarmerFinance(farmer, ASOF)).consents.find((c) => c.purpose.includes(s.ref!))!.id;
  await farmerFinanceAction(farmer, { action: 'withdrawConsent', consentId });
  const c = await getLenderCase(lender, s.id!, ASOF);
  assert.equal(c.income, null);
  assert.equal(c.consent?.status, 'withdrawn');
  await assert.rejects(lenderAction(lender, { action: 'status', id: s.id, status: 'approved' }), /withdrawn consent/);
});

test('society application needs an authorised representative and society consent', async () => {
  const body = { action: 'save', productCode: 'soc-bmc', amount: 800000, tenure: 36, answers: { capacity: 2000, project_cost: 900000, benefit: 'Less spoilage' }, docs: ['board_resolution'], submit: true, confirmAuthority: true, consent: consent(['society_operations']) };
  await assert.rejects(societyFinanceAction(secretary, false, body), /authorised/);
  const s = await societyFinanceAction(secretary, true, body);
  assert.equal(s.status, 'submitted');
  assert.equal((await getSocietyFinance(otherSecretary, signatory, ASOF)).applications.length, 0);
  assert.equal((await getFarmerFinance(farmer, ASOF)).applications.some((a) => a.id === s.id), false, 'farmers do not see society applications');
  const row = (await getLenderData(lender)).cases.find((c) => c.id === s.id)!;
  assert.equal(row.applicantType, 'society');
  const c = await getLenderCase(lender, s.id!, ASOF);
  assert.ok(c.society && c.society.members > 0 && c.society.avgDailyLitres > 0);
  assert.equal(c.farmer, null);
});

test('cattle insurance: apply, insurer issues policy, claim and settle', async () => {
  const f = await getFarmerFinance(farmer, ASOF);
  const animal = f.cattle[0];
  const s = await farmerFinanceAction(farmer, { action: 'save', productCode: 'ins-cattle', cattleId: animal.id, answers: { sum_insured: 70000 }, docs: ['vet_certificate', 'animal_photo'], submit: true, consent: consent(['identity_kyc', 'livestock']) });
  assert.equal((await getLenderData(lender)).cases.some((c) => c.id === s.id), false, 'bank does not see insurance applications');
  const c = await getLenderCase(insurer, s.id!, ASOF);
  assert.equal(c.animal?.tag, animal.tag);
  await assert.rejects(lenderAction(insurer, { action: 'issuePolicy', id: s.id }), /Approve/);
  await lenderAction(insurer, { action: 'status', id: s.id, status: 'approved', note: 'Indicative premium quoted' });
  const out = await lenderAction(insurer, { action: 'issuePolicy', id: s.id, premium: 2800 });
  const after = await getFarmerFinance(farmer, ASOF);
  assert.equal(after.applications.find((a) => a.id === s.id)?.status, 'policy_issued');
  const policy = after.policies.find((p) => p.number === (out as { number: string }).number)!;
  assert.ok(policy.simulated && policy.status === 'active');
  assert.ok(after.cattle.find((x) => x.id === animal.id)?.insured);
  await assert.rejects(farmerFinanceAction(farmer, { action: 'save', productCode: 'ins-cattle', cattleId: animal.id, answers: { sum_insured: 1 }, submit: false }), /already has an active policy/);
  await farmerFinanceAction(farmer, { action: 'renew', policyId: policy.id });
  const claim = await farmerFinanceAction(farmer, { action: 'claim', policyId: policy.id, reason: 'Death from disease', date: '2026-10-01', description: 'Animal died after fever', amount: 70000 });
  assert.equal((await getLenderData(insurer)).claims.length, 1);
  assert.equal((await getLenderData(lender)).claims.length, 0);
  await lenderAction(insurer, { action: 'claimStatus', claimId: claim.id, status: 'more_info', note: 'Upload the post-mortem report' });
  await farmerFinanceAction(farmer, { action: 'claimRespond', claimId: claim.id, note: 'Uploaded' });
  await lenderAction(insurer, { action: 'claimStatus', claimId: claim.id, status: 'approved', amount: 65000 });
  await lenderAction(insurer, { action: 'claimStatus', claimId: claim.id, status: 'settled' });
  const cl = (await getFarmerFinance(farmer, ASOF)).claims[0];
  assert.equal(cl.status, 'settled');
  assert.ok(cl.history.length >= 5);
});

test('consumer wallet is simulated and private', async () => {
  await walletAction(consumer, { action: 'subscribe', plan: 'gold-500', channel: 'Doorstep delivery partner' });
  await assert.rejects(walletAction(consumer, { action: 'deliver' }), /Balance too low/);
  await walletAction(consumer, { action: 'topup', amount: 500 });
  await walletAction(consumer, { action: 'deliver' });
  const w = await getWallet(consumer);
  assert.equal(w.balance, 466);
  assert.ok(w.transactions.every((t) => t.simulated));
  assert.equal(await withScope(farmer, async (tx) => (await tx.query('select * from wallet_transactions')).length), 0);
  await assert.rejects(walletAction(consumer, { action: 'topup', amount: 100000 }), /between/);
});

test('reset clears DairyFin workflow', async () => {
  await resetDemo();
  const f = await getFarmerFinance(farmer, ASOF);
  assert.equal(f.applications.length, 0);
  assert.equal(f.policies.length, 0);
  assert.equal((await getSocietyFinance(secretary, signatory, ASOF)).applications.length, 0);
  assert.equal((await getWallet(consumer)).transactions.length, 0);
});
