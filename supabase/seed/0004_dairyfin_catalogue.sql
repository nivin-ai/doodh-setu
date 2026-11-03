-- DairyFin demo catalogue (SYNTHETIC). Applied after the demo seed on every start; idempotent.
-- All terms are demo/indicative: rates, premiums and approvals are set by the provider.
insert into lenders (lender_name, lender_code, lender_type, integration_status, provider_kind, is_synthetic) values
  ('Demo Insurer (simulated)', 'DINS', 'Insurer', 'mock', 'insurer', true),
  ('Doodh Setu Wallet (simulated)', 'DSW', 'Platform', 'mock', 'platform', true)
on conflict (lender_name) do nothing;

-- existing two farmer loans: describe them; their demo rates stay labelled as indicative
update loan_products set category = 'livestock', description = 'Finance to buy milch animals, repaid from milk payments.',
  benefits = '["Repayment can be matched to the milk payment cycle", "Uses your society milk records as income evidence, with consent"]',
  eligibility_rules = '[{"id":"member12","label":"Society member for 12 months or more","check":"membership_months>=12"},{"id":"regular","label":"Regular milk supply in the last 6 months","check":"regular_supply"}]',
  tenure_options = '[12, 24, 36]', fees_text = 'Processing fee 1% (demo)',
  required_documents = '[{"id":"kyc","label":"KYC verification result (Aadhaar, PAN)"},{"id":"bank","label":"Bank account details"},{"id":"quote","label":"Cattle purchase quote"}]',
  application_fields = '[{"id":"animals","label":"Number of animals to buy","type":"number","required":true},{"id":"breed","label":"Breed","type":"select","options":["Murrah buffalo","Mehsani buffalo","Gir cow","HF cross cow"],"required":true}]',
  data_categories = '["identity_kyc","land_property","credit_history","milk_income"]',
  disclaimer = 'Demo product. Rate, fees and approval are decided by the lender.', sort_order = 2
where product_code = 'gpb' and description is null;
update loan_products set category = 'input', description = 'Short-term credit for feed, fodder and mineral mixture.',
  benefits = '["Smaller amounts, shorter tenure", "Can help keep yields up in the lean season"]',
  eligibility_rules = '[{"id":"member6","label":"Society member for 6 months or more","check":"membership_months>=6"}]',
  tenure_options = '[6, 12, 24]', fees_text = 'Processing fee 1.5% (demo)',
  required_documents = '[{"id":"kyc","label":"KYC verification result (Aadhaar, PAN)"},{"id":"bank","label":"Bank account details"}]',
  application_fields = '[{"id":"input","label":"What will you buy?","type":"select","options":["Cattle feed","Green fodder","Mineral mixture"],"required":true}]',
  data_categories = '["identity_kyc","credit_history","milk_income"]',
  disclaimer = 'Demo product. Rate, fees and approval are decided by the lender.', sort_order = 4
where product_code = 'scn' and description is null;

insert into loan_products (lender_id, product_code, product_name, segment, product_type, category, purpose, description, benefits, eligibility_rules, min_amount, max_amount,
  interest_rate, max_tenure_months, tenure_options, fee_pct, fees_text, required_documents, application_fields, data_categories, disclaimer, coverage, exclusions, claim_reasons, sort_order, is_synthetic)
select l.lender_id, v.code, v.name, v.segment, v.ptype, v.category, v.purpose, v.descr, v.benefits::jsonb, v.elig::jsonb, v.min_amt::numeric, v.max_amt::numeric, v.rate::numeric, v.max_ten::int, v.tenures::jsonb, null::numeric, v.fees,
  v.docs::jsonb, v.fields::jsonb, v.cats::jsonb, v.disclaimer, v.coverage::jsonb, v.excl::jsonb, v.reasons::jsonb, v.ord, true
from (values
  ('GPB', 'gpb-wc', 'Milk-receipt working capital', 'farmer', 'loan', 'working_capital', 'working_capital',
   'A small credit line repaid automatically from your fortnightly milk payments.',
   '["Sized from your own milk payments", "Repaid in small amounts from each payment"]',
   '[{"id":"member6","label":"Society member for 6 months or more","check":"membership_months>=6"},{"id":"regular","label":"Regular milk supply in the last 6 months","check":"regular_supply"}]',
   5000, 50000, null, 12, '[3, 6, 12]', 'Set by the lender',
   '[{"id":"kyc","label":"KYC verification result (Aadhaar, PAN)"},{"id":"bank","label":"Bank account details"}]',
   '[{"id":"use","label":"What is it for?","type":"text","required":true}]', '["identity_kyc","milk_income"]',
   'Demo product. Rate and limit are decided by the lender.', null, '[]', '[]', 1),
  ('GPB', 'gpb-eq', 'Dairy equipment finance', 'farmer', 'loan', 'equipment', 'equipment',
   'Finance for a milking machine, chaff cutter or small cooler at the farm.',
   '["Equipment can raise milk quality and save labour"]',
   '[{"id":"member12","label":"Society member for 12 months or more","check":"membership_months>=12"}]',
   20000, 150000, null, 36, '[12, 24, 36]', 'Set by the lender',
   '[{"id":"kyc","label":"KYC verification result (Aadhaar, PAN)"},{"id":"bank","label":"Bank account details"},{"id":"equipment_quote","label":"Equipment quotation"}]',
   '[{"id":"equipment","label":"Equipment","type":"select","options":["Milking machine","Chaff cutter","Farm milk cooler"],"required":true},{"id":"supplier","label":"Supplier name","type":"text","required":true}]',
   '["identity_kyc","credit_history","milk_income"]', 'Demo product. Rate and approval are decided by the lender.', null, '[]', '[]', 3),
  ('DINS', 'ins-cattle', 'Cattle insurance', 'farmer', 'insurance', 'livestock_insurance', 'insurance',
   'Cover for a milch animal against death from disease or accident. Terms here are illustrative.',
   '["Pays the insured value if a covered animal dies", "Animal identified by its ear tag"]',
   '[{"id":"tagged","label":"Animal has an ear tag","check":"animal_tagged"},{"id":"healthy","label":"Animal is healthy when insured (vet certificate)","check":"vet_certificate"}]',
   null, null, null, null, '[]', 'Premium quoted by the insurer',
   '[{"id":"vet_certificate","label":"Veterinary health certificate"},{"id":"animal_photo","label":"Photo of the animal with ear tag"}]',
   '[{"id":"sum_insured","label":"Value of the animal (Rs)","type":"number","required":true}]', '["identity_kyc","livestock"]',
   'Simulated insurance product. Coverage, premium, exclusions and claims are decided by the insurer.',
   '{"period":"12 months","options":["Death from disease","Death from accident"]}',
   '["Theft (not covered in this demo product)", "Death within the first 15 days of cover", "Animals older than the insurer allows"]',
   '["Death from disease", "Death from accident", "Death during calving"]', 5),
  ('GPB', 'soc-bmc', 'Bulk milk cooler finance', 'society', 'loan', 'chilling', 'chilling',
   'Finance for a bulk milk cooler at the society, to keep milk cold from collection to pickup.',
   '["Better milk quality and fewer rejections", "Can support higher milk prices for members"]',
   '[{"id":"registered","label":"Registered dairy cooperative society","check":"society_registered"},{"id":"signatory","label":"Application signed by an authorised society representative","check":"authorised"}]',
   200000, 1500000, null, 60, '[24, 36, 60]', 'Set by the lender',
   '[{"id":"board_resolution","label":"Board resolution authorising the loan"},{"id":"cooler_quote","label":"Cooler quotation"},{"id":"audited_accounts","label":"Last audited accounts"}]',
   '[{"id":"capacity","label":"Cooler capacity (litres)","type":"number","required":true},{"id":"project_cost","label":"Estimated project cost (Rs)","type":"number","required":true},{"id":"benefit","label":"Expected benefit","type":"text","required":true}]',
   '["society_operations"]', 'Demo product. Rate and approval are decided by the lender.', null, '[]', '[]', 10),
  ('GPB', 'soc-test', 'Milk testing and collection equipment', 'society', 'loan', 'infrastructure', 'infrastructure',
   'Finance for automatic milk collection units, fat/SNF analysers and weighing scales.',
   '["Faster, transparent testing at the collection point"]',
   '[{"id":"registered","label":"Registered dairy cooperative society","check":"society_registered"},{"id":"signatory","label":"Application signed by an authorised society representative","check":"authorised"}]',
   50000, 500000, null, 36, '[12, 24, 36]', 'Set by the lender',
   '[{"id":"board_resolution","label":"Board resolution authorising the loan"},{"id":"equipment_quote","label":"Equipment quotation"}]',
   '[{"id":"equipment","label":"Equipment","type":"text","required":true},{"id":"project_cost","label":"Estimated project cost (Rs)","type":"number","required":true}]',
   '["society_operations"]', 'Demo product. Rate and approval are decided by the lender.', null, '[]', '[]', 11),
  ('GPB', 'soc-wc', 'Society working capital', 'society', 'loan', 'working_capital', 'working_capital',
   'A short-term limit to pay members on time when union payments are delayed.',
   '["Keeps member payments on schedule"]',
   '[{"id":"registered","label":"Registered dairy cooperative society","check":"society_registered"},{"id":"signatory","label":"Application signed by an authorised society representative","check":"authorised"}]',
   100000, 1000000, null, 12, '[6, 12]', 'Set by the lender',
   '[{"id":"board_resolution","label":"Board resolution authorising the loan"},{"id":"audited_accounts","label":"Last audited accounts"}]',
   '[{"id":"benefit","label":"Why is the limit needed?","type":"text","required":true}]', '["society_operations"]',
   'Demo product. Limit, rate and approval are decided by the lender.', null, '[]', '[]', 12),
  ('DSW', 'milk-wallet', 'Prepaid milk subscription', 'consumer', 'prepaid', 'wallet', 'subscription',
   'Prepay for daily milk delivered through a participating channel. Balance and payments are simulated.',
   '["Daily milk without paying each time", "See every deduction and renewal date"]',
   '[]', 100, 5000, null, null, '[]', 'No fees in this demo', '[]', '[]', '[]',
   'Simulated prepaid wallet. No real money is collected or stored.', null, '[]', '[]', 20)
) as v(lender, code, name, segment, ptype, category, purpose, descr, benefits, elig, min_amt, max_amt, rate, max_ten, tenures, fees, docs, fields, cats, disclaimer, coverage, excl, reasons, ord)
join lenders l on l.lender_code = v.lender
on conflict (product_code) do nothing;

insert into consumers (consumer_id, display_name, city, is_synthetic)
values ('5f0c1e2a-0000-4000-8000-00000000c001', 'Demo consumer', 'Mumbai', true) on conflict do nothing;

update app_users set is_authorised_signatory = true where username = 'secretary' and is_demo;
update app_users set is_authorised_signatory = true where username = 'admin' and is_demo;
insert into app_users (username, display_name, role, password_hash, lender_id, is_demo)
select 'insurer', 'Insurer reviewer', 'lender', 'scrypt$f177eaccbf3c23aa5a426d24db960633$bbd5f422c42a2a8d1fa1c54f3f054841268d2f984142e41277c0f4254d666612', lender_id, true
from lenders where lender_code = 'DINS'
on conflict (username) do nothing;


-- ear tags for synthetic animals (cattle insurance needs a tagged animal)
update cattle c set animal_tag_number = 'DEMO-' || upper(substr(replace(c.cattle_id::text, '-', ''), 1, 10))
where c.animal_tag_number is null and c.farmer_id in (select farmer_id from farmers where is_synthetic);
