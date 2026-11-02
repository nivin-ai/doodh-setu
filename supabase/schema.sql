-- Doodh Setu / DairyFin database (Supabase Postgres)
-- Follows "Farmers_Database_Structure.xlsx" (tables 1-16), plus cooperatives and loan_products,
-- which the structure references as foreign keys.
-- Run once in Supabase: Dashboard > SQL Editor > New query > paste this file > Run.
-- Row level security is ON for every table with no public policies: only the app's server
-- (using the service role key) can read or write. Never expose the service role key in the browser.

create extension if not exists pgcrypto;

-- 0. Reference tables ---------------------------------------------------------
create table if not exists cooperatives (
  cooperative_id uuid primary key default gen_random_uuid(),
  name varchar(255) not null,
  district varchar(100),
  state varchar(100),
  created_at timestamptz default now()
);

-- 1. Farmer profile --------------------------------------------------------------
create table if not exists farmers (
  farmer_id uuid primary key default gen_random_uuid(),
  farmer_code varchar(20) unique,
  first_name varchar(100), middle_name varchar(100), last_name varchar(100),
  date_of_birth date,
  gender varchar(20),
  preferred_language varchar(10),
  mobile_number varchar(20),
  mobile_verified boolean default false,
  email varchar(255),
  cooperative_id uuid references cooperatives(cooperative_id),
  registration_date timestamptz,
  profile_status varchar(30) default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. KYC: masked values and provider tokens only. Never store raw Aadhaar or PAN numbers.
create table if not exists farmer_kyc (
  kyc_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  document_type varchar(30),
  document_number_token varchar(255),
  document_number_masked varchar(30),
  document_storage_key varchar(500),
  verification_status varchar(30) default 'pending',
  verification_provider varchar(100),
  verified_at timestamptz,
  expiry_date date,
  created_at timestamptz default now()
);

create table if not exists farmer_addresses (
  address_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  address_type varchar(30),
  village varchar(100), taluka varchar(100), district varchar(100), state varchar(100),
  pincode varchar(10),
  latitude decimal(10,7), longitude decimal(10,7),
  is_primary boolean default false,
  created_at timestamptz default now()
);

-- 3. Land and property ----------------------------------------------------------------
create table if not exists farmer_properties (
  property_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  ownership_type varchar(30),
  survey_number varchar(100),
  khasra_number varchar(100),
  village varchar(100), district varchar(100), state varchar(100),
  total_area decimal(12,3),
  area_unit varchar(20),
  land_use varchar(50),
  lease_start_date date, lease_end_date date,
  verification_status varchar(30) default 'pending',
  created_at timestamptz default now()
);

create table if not exists farmer_documents (
  document_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  property_id uuid references farmer_properties(property_id),
  document_type varchar(50),
  document_name varchar(255),
  storage_key varchar(500),
  document_version integer default 1,
  verification_status varchar(30) default 'pending',
  uploaded_at timestamptz default now(),
  verified_at timestamptz
);

-- 4. Cattle and dairy operations ---------------------------------------------------
create table if not exists cattle (
  cattle_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  animal_tag_number varchar(100) unique,
  animal_type varchar(30), breed varchar(100), gender varchar(20),
  date_of_birth date, estimated_age_months integer,
  purchase_date date, purchase_value decimal(12,2), estimated_market_value decimal(12,2),
  milk_production_status varchar(30), health_status varchar(30), cattle_status varchar(30),
  created_at timestamptz default now()
);

create table if not exists milk_transactions (
  transaction_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  cattle_id uuid references cattle(cattle_id),
  cooperative_id uuid references cooperatives(cooperative_id),
  transaction_date date,
  milk_quantity_litres decimal(10,3), fat_percentage decimal(5,2), snf_percentage decimal(5,2),
  rate_per_litre decimal(10,2), gross_amount decimal(12,2), deductions decimal(12,2), net_amount decimal(12,2),
  payment_status varchar(30), payment_reference varchar(100)
);

-- 5. Credit history and loan applications ---------------------------------------------
create table if not exists credit_profiles (
  credit_profile_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id) on delete cascade,
  bureau_name varchar(50), credit_score integer, report_reference varchar(255),
  existing_loan_count integer, total_outstanding decimal(14,2),
  retrieval_status varchar(30), retrieved_at timestamptz, expires_at timestamptz,
  mock_data boolean default true
);

create table if not exists lenders (
  lender_id uuid primary key default gen_random_uuid(),
  lender_name varchar(255) unique,
  lender_code varchar(50),
  lender_type varchar(30),
  integration_status varchar(30) default 'mock',
  created_at timestamptz default now()
);

create table if not exists loan_products (
  loan_product_id uuid primary key default gen_random_uuid(),
  lender_id uuid references lenders(lender_id),
  product_code varchar(20) unique,
  product_name varchar(255), purpose varchar(50),
  min_amount decimal(14,2), max_amount decimal(14,2), interest_rate decimal(5,2), max_tenure_months integer, fee_pct decimal(5,2),
  created_at timestamptz default now()
);

create table if not exists loan_applications (
  application_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id),
  lender_id uuid references lenders(lender_id),
  loan_product_id uuid references loan_products(loan_product_id),
  application_reference varchar(50) unique,
  requested_amount decimal(14,2), approved_amount decimal(14,2),
  loan_purpose text,
  application_status varchar(40),
  submitted_at timestamptz, last_updated_at timestamptz
);

create table if not exists loan_documents (
  loan_document_id uuid primary key default gen_random_uuid(),
  application_id uuid references loan_applications(application_id) on delete cascade,
  document_type varchar(50), document_reference varchar(500),
  verification_status varchar(30), uploaded_at timestamptz default now()
);

-- 6. DPDP consent management -------------------------------------------------------
create table if not exists consent_records (
  consent_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id),
  application_id uuid references loan_applications(application_id),  -- set once the application exists
  lender_id uuid references lenders(lender_id),
  consent_notice_version varchar(30),
  consent_purpose varchar(100),
  consent_status varchar(30),
  granted_at timestamptz, withdrawn_at timestamptz,
  collection_categories jsonb,
  consent_method varchar(30), language varchar(10),
  created_at timestamptz default now()
);

create table if not exists data_sharing_logs (
  sharing_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id),
  application_id uuid references loan_applications(application_id),
  consent_id uuid references consent_records(consent_id),
  recipient_id uuid references lenders(lender_id),
  data_categories jsonb, purpose varchar(100),
  sharing_status varchar(30), shared_at timestamptz, reference_id varchar(255)
);

-- 7. Cattle insurance ----------------------------------------------------------------
create table if not exists insurance_policies (
  policy_id uuid primary key default gen_random_uuid(),
  farmer_id uuid references farmers(farmer_id),
  insurer_name varchar(255), policy_number varchar(100), product_id uuid,
  total_insured_value decimal(14,2), premium_amount decimal(12,2),
  policy_start_date date, policy_end_date date,
  policy_status varchar(30), issuance_status varchar(30), document_reference varchar(500),
  created_at timestamptz default now()
);

create table if not exists insurance_policy_animals (
  policy_animal_id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(policy_id) on delete cascade,
  cattle_id uuid references cattle(cattle_id),
  insured_value decimal(12,2), coverage_status varchar(30)
);

create table if not exists insurance_claims (
  claim_id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(policy_id),
  cattle_id uuid references cattle(cattle_id),
  claim_reference varchar(100), incident_type varchar(50), incident_date date,
  claim_amount decimal(12,2), approved_amount decimal(12,2),
  claim_status varchar(30), submitted_at timestamptz, settled_at timestamptz
);

-- Row level security: on everywhere, no public policies (server-only access) ----------------
do $$ declare t text; begin
  foreach t in array array['cooperatives','farmers','farmer_kyc','farmer_addresses','farmer_properties','farmer_documents','cattle','milk_transactions','credit_profiles','lenders','loan_products','loan_applications','loan_documents','consent_records','data_sharing_logs','insurance_policies','insurance_policy_animals','insurance_claims']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;

-- Demo seed (simulated data; fixed ids so the app can refer to them) ------------------------
insert into cooperatives (cooperative_id, name, district, state) values
  ('00000000-0000-4000-8000-000000000001', 'Anand Milk Society', 'Anand', 'Gujarat') on conflict do nothing;

insert into farmers (farmer_id, farmer_code, first_name, last_name, gender, preferred_language, mobile_number, mobile_verified, cooperative_id, registration_date, profile_status) values
  ('00000000-0000-4000-8000-000000000101', '0412', 'Savitaben', 'Patel', 'Female', 'gu', '+91XXXXXX4410', true, '00000000-0000-4000-8000-000000000001', '2019-06-01', 'active') on conflict do nothing;

insert into farmer_addresses (farmer_id, address_type, village, taluka, district, state, pincode, is_primary) values
  ('00000000-0000-4000-8000-000000000101', 'residential', 'Bakrol', 'Anand', 'Anand', 'Gujarat', '388315', true);

insert into farmer_kyc (farmer_id, document_type, document_number_token, document_number_masked, verification_status, verification_provider, verified_at) values
  ('00000000-0000-4000-8000-000000000101', 'Aadhaar', 'tok_aad_7f3c', 'XXXX XXXX 4821', 'verified', 'DigiLocker (demo)', now()),
  ('00000000-0000-4000-8000-000000000101', 'PAN', 'tok_pan_19be', 'XXXXX6413K', 'verified', 'NSDL PAN verification (demo)', now());

insert into farmer_properties (farmer_id, ownership_type, survey_number, village, district, state, total_area, area_unit, land_use, verification_status) values
  ('00000000-0000-4000-8000-000000000101', 'owned', '214/2', 'Bakrol', 'Anand', 'Gujarat', 1.2, 'acres', 'mixed', 'verified');

insert into credit_profiles (farmer_id, bureau_name, credit_score, existing_loan_count, total_outstanding, retrieval_status, retrieved_at, mock_data) values
  ('00000000-0000-4000-8000-000000000101', 'CIBIL', 742, 1, 18000, 'retrieved', now(), true);

insert into lenders (lender_id, lender_name, lender_code, lender_type, integration_status) values
  ('00000000-0000-4000-8000-000000000201', 'Gramin Partner Bank (demo)', 'GPB', 'Bank', 'mock'),
  ('00000000-0000-4000-8000-000000000202', 'Sahakari Credit NBFC (demo)', 'SCN', 'NBFC', 'mock'),
  ('00000000-0000-4000-8000-000000000203', 'Union Bank of India', 'UBI', 'Bank', 'inactive')
  on conflict do nothing;

insert into loan_products (lender_id, product_code, product_name, purpose, min_amount, max_amount, interest_rate, max_tenure_months, fee_pct) values
  ('00000000-0000-4000-8000-000000000201', 'gpb', 'Cattle loan', 'cattle', 25000, 200000, 10.5, 36, 1),
  ('00000000-0000-4000-8000-000000000202', 'scn', 'Feed and fodder credit', 'feed', 10000, 100000, 13, 24, 1.5)
  on conflict do nothing;
