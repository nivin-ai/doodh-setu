// SYNTHETIC demo reference data: the demo union, products, planning assumptions, the demo farmer's
// profile and finance records, lenders and demo staff accounts. Seeded into the database by
// lib/server/seed.ts. Not real Amul data. Nothing in the UI imports this file.

export const DEMO_FEDERATION = { code: 'GCMMF-DEMO', name: 'Gujarat Cooperative Milk Marketing Federation (demo)', district: null, state: 'Gujarat' };
export const DEMO_UNION = { code: 'KDU-DEMO', name: 'Kheda District Union (demo)', district: 'Anand', state: 'Gujarat' };

// Share of the two city markets supplied by this union (demo assumption)
export const UNION_SHARE = 0.55;

// products: consumer products (unit, generator parameters) and the plant's product mix economics
export const PRODUCT_ROWS = [
  { id: 'milk', name: 'Liquid milk', unit: 'L', milkPerUnit: 1, valuePerLitre: 56, capacity: null, buffaloShare: 0.4, isFallback: false, isLiquidMilk: true, beta: -0.002 },
  { id: 'curd', name: 'Curd', unit: 'kg', milkPerUnit: 1.05, valuePerLitre: 66, capacity: 120000, buffaloShare: 0.5, isFallback: false, isLiquidMilk: false, beta: 0.014 },
  { id: 'paneer', name: 'Paneer', unit: 'kg', milkPerUnit: 4.5, valuePerLitre: 90, capacity: 70000, buffaloShare: 1, isFallback: false, isLiquidMilk: false, beta: 0.006 },
  { id: 'lassi', name: 'Lassi and buttermilk', unit: 'L', milkPerUnit: 0.6, valuePerLitre: 72, capacity: 60000, buffaloShare: 0.3, isFallback: false, isLiquidMilk: false, beta: 0.03 },
  { id: 'icecream', name: 'Ice cream', unit: 'L', milkPerUnit: 0.9, valuePerLitre: 84, capacity: 30000, buffaloShare: 0.5, isFallback: false, isLiquidMilk: false, beta: 0.05 },
  { id: 'sink', name: 'Milk powder and butter', unit: 'kg', milkPerUnit: 1, valuePerLitre: 40, capacity: null, buffaloShare: 0, isFallback: true, isLiquidMilk: false, beta: 0 },
];

// Last year's April-June plan (litres of milk per day): the "current plan" baseline
export const BASELINE_PLAN: Record<string, number> = { paneer: 30000, icecream: 16000, lassi: 22000, curd: 70000 };

// Expected milk supply for the lean season (litres per day)
export const SUPPLY_OUTLOOK = [
  { month: '2027-04-01', buffalo: 282000, cow: 398000 },
  { month: '2027-05-01', buffalo: 270000, cow: 382000 },
  { month: '2027-06-01', buffalo: 278000, cow: 392000 },
];

export const DATA_SOURCES = [
  { id: 'dealer', name: 'Retailers via dealers', kind: 'Demand', lag: '3 days', grain: 'Region x week', quality: 35, prevQuality: 30, note: 'Orders reflect stocking, not consumption. Digitised dealer orders (pilot) raised quality from 30.' },
  { id: 'qcomm', name: 'Quick commerce', kind: 'Demand', lag: '1 day', grain: 'SKU x dark store x day', quality: 62, prevQuality: 55, note: 'Feed covers about 70% of SKUs under the current data-sharing terms.' },
  { id: 'shop', name: 'Amul Shop (D2C)', kind: 'Demand', lag: 'Real time', grain: 'Order level', quality: 95, prevQuality: 95, note: 'Full control, small volume.' },
  { id: 'amcs', name: 'Milk collection (AMCS)', kind: 'Supply', lag: '2 hours', grain: 'Farmer x session', quality: 92, prevQuality: 92, note: 'Litres, fat and SNF for every pour.' },
  { id: 'weather', name: 'Weather and calendar', kind: 'External', lag: 'Daily', grain: 'City x day', quality: 85, prevQuality: 85, note: 'Includes IMD heatwave outlook for 10-24 Apr.' },
];

// The demo farmer (member 0412 of the demo society)
export const DEMO_FARMER = {
  code: '0412', name: 'Farmer', language: 'gu', mobile: '+91 98250 40412', registered: '2019-06-01',
  village: 'Bakrol', taluka: 'Anand', district: 'Anand', state: 'Gujarat', pincode: '388315',
  animals: { buffalo: 3, cow: 1 },
};
export const DEMO_KYC = [
  { type: 'Aadhaar', masked: 'XXXX XXXX 4821', status: 'verified', provider: 'DigiLocker (demo)', token: 'tok_aad_7f3c' },
  { type: 'PAN', masked: 'XXXXX6413K', status: 'verified', provider: 'NSDL PAN verification (demo)', token: 'tok_pan_19be' },
];
export const DEMO_PROPERTY = {
  ownership: 'Owned', survey: '214/2', village: 'Bakrol', district: 'Anand', state: 'Gujarat',
  area: 1.2, unit: 'acres', use: 'Mixed (fodder and cattle shed)', record: '7/12 land record extract', status: 'verified',
};
export const DEMO_CREDIT = { bureau: 'CIBIL', score: 742, loans: 1, outstanding: 18000 };

export const LENDERS = [
  { code: 'GPB', name: 'Gramin Partner Bank (demo)', type: 'Bank', integration: 'mock' },
  { code: 'SCN', name: 'Sahakari Credit NBFC (demo)', type: 'NBFC', integration: 'mock' },
];
export const LOAN_PRODUCTS = [
  { code: 'gpb', lender: 'GPB', name: 'Cattle loan', purpose: 'cattle', min: 25000, max: 200000, rate: 10.5, maxTenure: 36, feePct: 1, elig: 'Society member for 12+ months with regular milk supply' },
  { code: 'scn', lender: 'SCN', name: 'Feed and fodder credit', purpose: 'feed', min: 10000, max: 100000, rate: 13, maxTenure: 24, feePct: 1.5, elig: 'Society member for 6+ months' },
];

// Background lender cases from other members (lender desk list)
export const BACKGROUND_CASES = [
  { ref: 'DF-10021', farmerCode: '0187', societyCode: 'S001', product: 'Cattle loan', amount: 80000, status: 'in_review', updated: '2027-03-18' },
  { ref: 'DF-10022', farmerCode: '0033', societyCode: 'S004', product: 'Bulk milk cooler (society)', amount: 150000, status: 'more_info', updated: '2027-03-17' },
  { ref: 'DF-10023', farmerCode: '0291', societyCode: 'S006', product: 'Cattle loan', amount: 50000, status: 'submitted', updated: '2027-03-16' },
];

// Demo staff accounts. Passwords are hashed (scrypt) when seeded and are shown on the sign-in page.
export const DEMO_USERS = [
  { username: 'planner', password: 'planner123', name: 'Union planner', role: 'planner' },
  { username: 'approver', password: 'approver123', name: 'Union approver', role: 'approver' },
  { username: 'secretary', password: 'society123', name: 'Society secretary', role: 'secretary' },
  { username: 'lender', password: 'lender123', name: 'Lender case officer', role: 'lender' },
  { username: 'admin', password: 'admin123', name: 'Demo admin', role: 'admin' },
] as const;

// The demo society's collection on the two demo dates (litres); other days are generated around them
export const SOCIETY_COLLECTION_ANCHORS: Record<string, { buffalo: number; cow: number }> = {
  '2027-03-20': { buffalo: 2560, cow: 2120 },
  '2027-04-30': { buffalo: 2310, cow: 1980 },
};
