-- Migration 0002: database-first Doodh Setu.
-- Extends the baseline (0001) instead of duplicating it:
--   * cooperatives become the union/federation level; village societies get their own table
--   * farmers, milk transactions, loans and consents gain the links and checks the app needs
--   * new tables for demand, planning, incentives, member queries, staff accounts and audit
-- Safe to run more than once (if not exists / drop policy if exists).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. Cooperative structure
-- ---------------------------------------------------------------------------
alter table cooperatives add column if not exists code varchar(30);
alter table cooperatives add column if not exists coop_type varchar(20) not null default 'union';
alter table cooperatives add column if not exists parent_cooperative_id uuid references cooperatives(cooperative_id) on delete restrict;
alter table cooperatives add column if not exists is_synthetic boolean not null default false;
alter table cooperatives add column if not exists updated_at timestamptz not null default now();
do $$ begin
  alter table cooperatives add constraint cooperatives_code_key unique (code);
exception when duplicate_object or duplicate_table then null; end $$;
do $$ begin
  alter table cooperatives add constraint cooperatives_type_chk check (coop_type in ('federation', 'union'));
exception when duplicate_object then null; end $$;

create table if not exists societies (
  society_id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives(cooperative_id) on delete restrict,
  code varchar(20) not null unique,
  name varchar(255) not null,
  village varchar(100), taluka varchar(100), district varchar(100), state varchar(100),
  latitude numeric(10,7), longitude numeric(10,7),
  region varchar(30),
  -- Reported figures for societies whose members are not yet onboarded individually.
  -- For onboarded societies the member list in farmers is authoritative.
  member_count integer check (member_count >= 0),
  buffalo_litres_per_day numeric(12,1) check (buffalo_litres_per_day >= 0),
  status varchar(20) not null default 'active' check (status in ('active', 'inactive')),
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists societies_cooperative_idx on societies(cooperative_id);

-- ---------------------------------------------------------------------------
-- 2. Farmers and herd
-- ---------------------------------------------------------------------------
alter table farmers add column if not exists society_id uuid references societies(society_id) on delete restrict;
alter table farmers add column if not exists display_name varchar(200);
alter table farmers add column if not exists device_type varchar(20) not null default 'smartphone';
alter table farmers add column if not exists is_synthetic boolean not null default false;
do $$ begin
  alter table farmers add constraint farmers_device_chk check (device_type in ('smartphone', 'feature_phone'));
exception when duplicate_object then null; end $$;
create index if not exists farmers_society_idx on farmers(society_id);
-- farmer_code is unique per society, not globally
alter table farmers drop constraint if exists farmers_farmer_code_key;
do $$ begin
  alter table farmers add constraint farmers_society_code_key unique (society_id, farmer_code);
exception when duplicate_object or duplicate_table then null; end $$;

create index if not exists farmer_addresses_farmer_idx on farmer_addresses(farmer_id);
create index if not exists farmer_kyc_farmer_idx on farmer_kyc(farmer_id);
create index if not exists farmer_properties_farmer_idx on farmer_properties(farmer_id);
create index if not exists cattle_farmer_idx on cattle(farmer_id);
alter table cattle add column if not exists estimated_daily_yield numeric(6,2) check (estimated_daily_yield >= 0);
create index if not exists credit_profiles_farmer_idx on credit_profiles(farmer_id);
alter table farmer_properties add column if not exists record_type varchar(100);

-- ---------------------------------------------------------------------------
-- 3. Milk collection. Payments are calculated from these rows (see lib/domain/milk.ts);
--    no separate settlement table yet, so amounts are never stored twice.
-- ---------------------------------------------------------------------------
alter table milk_transactions add column if not exists society_id uuid references societies(society_id) on delete restrict;
alter table milk_transactions add column if not exists collection_session varchar(2);
alter table milk_transactions add column if not exists milk_type varchar(10);
alter table milk_transactions add column if not exists quality_status varchar(20);
alter table milk_transactions add column if not exists is_synthetic boolean not null default false;
alter table milk_transactions alter column milk_quantity_litres type numeric(10,3);
do $$ begin
  alter table milk_transactions add constraint milk_tx_session_chk check (collection_session in ('AM', 'PM'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table milk_transactions add constraint milk_tx_type_chk check (milk_type in ('buffalo', 'cow'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table milk_transactions add constraint milk_tx_qty_chk check (milk_quantity_litres >= 0 and fat_percentage between 0 and 15 and snf_percentage between 0 and 15);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table milk_transactions add constraint milk_tx_pour_key unique (farmer_id, transaction_date, collection_session, milk_type);
exception when duplicate_object or duplicate_table then null; end $$;
create index if not exists milk_tx_farmer_date_idx on milk_transactions(farmer_id, transaction_date);
create index if not exists milk_tx_society_date_idx on milk_transactions(society_id, transaction_date);

-- Society-level daily totals (all members). Used by the society dashboard.
create table if not exists society_collection_daily (
  society_id uuid not null references societies(society_id) on delete restrict,
  collection_date date not null,
  milk_type varchar(10) not null check (milk_type in ('buffalo', 'cow')),
  litres numeric(12,1) not null check (litres >= 0),
  avg_fat numeric(5,2), avg_snf numeric(5,2),
  is_synthetic boolean not null default false,
  primary key (society_id, collection_date, milk_type)
);

-- ---------------------------------------------------------------------------
-- 4. Products, demand and supply
-- ---------------------------------------------------------------------------
create table if not exists products (
  product_id varchar(30) primary key,
  name varchar(100) not null,
  unit varchar(10) not null,
  milk_litres_per_unit numeric(8,3) not null check (milk_litres_per_unit > 0),
  value_per_litre numeric(8,2) not null,            -- net value to the cooperative per litre of milk used (Rs)
  plant_capacity_litres numeric(12,0),               -- litres of milk per day the plant can convert; null = no limit
  buffalo_share numeric(4,3) not null check (buffalo_share between 0 and 1),
  is_fallback boolean not null default false,        -- powder and butter: takes whatever milk is left
  is_liquid_milk boolean not null default false,     -- committed first
  temp_sensitivity numeric(8,5) not null default 0,  -- demand change per deg C (generator parameter, informational)
  sort_order integer not null default 0
);

create table if not exists demand_daily (
  city varchar(30) not null check (city in ('Mumbai', 'Ahmedabad')),
  product_id varchar(30) not null references products(product_id) on delete restrict,
  channel varchar(10) not null check (channel in ('dealer', 'qcomm', 'shop')),
  demand_date date not null,
  units numeric(14,3) not null check (units >= 0),
  is_synthetic boolean not null default false,
  primary key (city, product_id, channel, demand_date)
);
create index if not exists demand_daily_date_idx on demand_daily(demand_date);

create table if not exists weather_daily (
  city varchar(30) not null,
  weather_date date not null,
  max_temp_c numeric(4,1) not null,
  kind varchar(10) not null check (kind in ('observed', 'outlook')),
  is_synthetic boolean not null default false,
  primary key (city, weather_date)
);

create table if not exists calendar_events (
  event_id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  kind varchar(20) not null default 'festival' check (kind in ('festival', 'heatwave')),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  effects jsonb not null default '{}'::jsonb,  -- product_id -> demand lift, or {"temp_plus": 4} for a heatwave
  is_synthetic boolean not null default false
);

create table if not exists data_sources (
  source_id varchar(30) primary key,
  name varchar(100) not null,
  kind varchar(20) not null check (kind in ('Demand', 'Supply', 'External')),
  freshness varchar(30), granularity varchar(60),
  quality_score integer check (quality_score between 0 and 100),
  previous_quality_score integer check (previous_quality_score between 0 and 100),
  note text,
  sort_order integer not null default 0
);

create table if not exists demand_zones (
  zone_id varchar(10) primary key,
  city varchar(30) not null,
  name varchar(100) not null,
  latitude numeric(9,6) not null, longitude numeric(9,6) not null,
  demand_weight numeric(8,6) not null check (demand_weight > 0),
  qcomm_share numeric(6,4) not null check (qcomm_share between 0 and 1),
  affluence numeric(4,2) not null, inland numeric(4,2) not null,
  is_synthetic boolean not null default false
);

create table if not exists supply_outlook (
  cooperative_id uuid not null references cooperatives(cooperative_id) on delete restrict,
  outlook_month date not null,
  milk_type varchar(10) not null check (milk_type in ('buffalo', 'cow')),
  expected_litres_per_day numeric(12,0) not null check (expected_litres_per_day >= 0),
  market_share numeric(4,3),   -- share of the city markets this union supplies (demo assumption)
  is_synthetic boolean not null default false,
  primary key (cooperative_id, outlook_month, milk_type)
);

-- Production plans: last season's plan (baseline) and plans accepted in the planner
create table if not exists production_plans (
  plan_id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives(cooperative_id) on delete restrict,
  plan_month date,                        -- null for the baseline plan
  kind varchar(20) not null check (kind in ('baseline', 'recommended', 'adjusted')),
  status varchar(20) not null default 'accepted' check (status in ('draft', 'accepted', 'superseded')),
  accepted_by varchar(100), accepted_at timestamptz,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists production_plans_coop_idx on production_plans(cooperative_id, plan_month);
create table if not exists production_plan_lines (
  plan_id uuid not null references production_plans(plan_id) on delete cascade,
  product_id varchar(30) not null references products(product_id) on delete restrict,
  litres_per_day numeric(12,1) not null check (litres_per_day >= 0),
  primary key (plan_id, product_id)
);

-- ---------------------------------------------------------------------------
-- 5. Incentive programmes (lean-season premium), responses and member queries
-- ---------------------------------------------------------------------------
create table if not exists incentive_programs (
  program_id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references cooperatives(cooperative_id) on delete restrict,
  title varchar(200) not null,
  milk_type varchar(10) not null default 'buffalo' check (milk_type in ('buffalo', 'cow')),
  rate_per_kg_fat numeric(8,2) not null check (rate_per_kg_fat >= 0),
  starts_on date not null, ends_on date not null check (ends_on >= starts_on),
  status varchar(20) not null default 'submitted' check (status in ('submitted', 'approved', 'rejected', 'concern', 'published')),
  justification text,
  submitted_by varchar(100) not null, submitted_at timestamptz not null default now(),
  approved_by varchar(100), approved_at timestamptz,
  rejected_reason text,
  concern text, concern_by varchar(100),
  send_slot varchar(10) check (send_slot in ('evening', 'morning', 'both')),
  notes jsonb not null default '{}'::jsonb,
  published_by varchar(100), published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maker_checker_chk check (approved_by is null or approved_by <> submitted_by)
);
create index if not exists incentive_programs_coop_idx on incentive_programs(cooperative_id, created_at desc);

create table if not exists incentive_program_societies (
  program_id uuid not null references incentive_programs(program_id) on delete cascade,
  society_id uuid not null references societies(society_id) on delete restrict,
  primary key (program_id, society_id)
);
create index if not exists ips_society_idx on incentive_program_societies(society_id);

create table if not exists signal_responses (
  program_id uuid not null references incentive_programs(program_id) on delete cascade,
  farmer_id uuid not null references farmers(farmer_id) on delete cascade,
  heard_on date,
  interested_on date,
  simulated boolean not null default false,  -- demo: other members' responses are simulated on publish
  updated_at timestamptz not null default now(),
  primary key (program_id, farmer_id)
);
create index if not exists signal_responses_farmer_idx on signal_responses(farmer_id);

create table if not exists member_queries (
  query_id uuid primary key default gen_random_uuid(),
  query_code varchar(20) not null unique,
  farmer_id uuid not null references farmers(farmer_id) on delete cascade,
  society_id uuid not null references societies(society_id) on delete restrict,
  language varchar(10) not null,
  status varchar(10) not null default 'open' check (status in ('open', 'resolved')),
  farmer_seen boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists member_queries_society_idx on member_queries(society_id, created_at desc);
create index if not exists member_queries_farmer_idx on member_queries(farmer_id);
create sequence if not exists member_query_code_seq start 101;

create table if not exists query_messages (
  message_id uuid primary key default gen_random_uuid(),
  query_id uuid not null references member_queries(query_id) on delete cascade,
  sender varchar(10) not null check (sender in ('farmer', 'society')),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists query_messages_query_idx on query_messages(query_id, created_at);

-- Demo only: response tendencies used to simulate how other members react to a published signal
create table if not exists demo_simulation_traits (
  farmer_id uuid primary key references farmers(farmer_id) on delete cascade,
  heard_p numeric(8,6) not null check (heard_p between 0 and 1),
  interested_p numeric(8,6) not null check (interested_p between 0 and 1)
);

-- Farmer requests (data correction etc.)
alter table farmers add column if not exists correction_requested_at timestamptz;

-- ---------------------------------------------------------------------------
-- 6. Finance: links and status checks on the baseline tables
-- ---------------------------------------------------------------------------
alter table lenders add column if not exists is_synthetic boolean not null default false;
alter table loan_products add column if not exists eligibility text;
alter table loan_products add column if not exists is_synthetic boolean not null default false;
alter table loan_applications add column if not exists tenure_months integer check (tenure_months between 1 and 120);
alter table loan_applications add column if not exists interest_rate numeric(5,2);
alter table loan_applications add column if not exists consent_id uuid references consent_records(consent_id) on delete restrict;
alter table loan_applications add column if not exists is_synthetic boolean not null default false;
update loan_applications set application_status = 'submitted' where application_status is null;
alter table loan_applications alter column application_status set default 'submitted';
do $$ begin
  alter table loan_applications add constraint loan_app_status_chk check (application_status in ('submitted', 'in_review', 'more_info', 'approved', 'declined', 'withdrawn'));
exception when duplicate_object then null; end $$;
create index if not exists loan_applications_lender_idx on loan_applications(lender_id, submitted_at desc);
create index if not exists loan_applications_farmer_idx on loan_applications(farmer_id);

create sequence if not exists loan_application_ref_seq start 10024;

create table if not exists loan_application_events (
  event_id uuid primary key default gen_random_uuid(),
  application_id uuid not null references loan_applications(application_id) on delete cascade,
  status varchar(20) not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists loan_app_events_idx on loan_application_events(application_id, created_at);

alter table loan_documents add column if not exists document_status varchar(20) not null default 'missing';
do $$ begin
  alter table loan_documents add constraint loan_doc_status_chk check (document_status in ('received', 'requested', 'missing'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table loan_documents add constraint loan_doc_key unique (application_id, document_type);
exception when duplicate_object or duplicate_table then null; end $$;

alter table consent_records add column if not exists consent_code varchar(20);
alter table consent_records add column if not exists recipient_name varchar(255);
alter table consent_records add column if not exists scope text;
alter table consent_records add column if not exists period varchar(100);
alter table consent_records add column if not exists statements_confirmed integer;
do $$ begin
  alter table consent_records add constraint consent_status_chk check (consent_status in ('granted', 'withdrawn'));
exception when duplicate_object then null; end $$;
create index if not exists consent_records_farmer_idx on consent_records(farmer_id);
create index if not exists consent_records_lender_idx on consent_records(lender_id, consent_status);
create index if not exists data_sharing_logs_farmer_idx on data_sharing_logs(farmer_id);

-- ---------------------------------------------------------------------------
-- 7. Staff accounts, audit trail and sensitive-data access log
-- ---------------------------------------------------------------------------
create table if not exists app_users (
  user_id uuid primary key default gen_random_uuid(),
  username varchar(50) not null unique,
  display_name varchar(100) not null,
  role varchar(20) not null check (role in ('planner', 'approver', 'secretary', 'lender', 'admin')),
  password_hash text not null,                   -- scrypt, never plain text
  cooperative_id uuid references cooperatives(cooperative_id) on delete restrict,
  society_id uuid references societies(society_id) on delete restrict,
  lender_id uuid references lenders(lender_id) on delete restrict,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  event_id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor varchar(100) not null,
  actor_role varchar(20) not null,
  action text not null,
  entity_type varchar(40), entity_id uuid,
  cooperative_id uuid references cooperatives(cooperative_id) on delete restrict,
  society_id uuid references societies(society_id) on delete restrict,
  lender_id uuid references lenders(lender_id) on delete restrict,
  farmer_id uuid references farmers(farmer_id) on delete restrict
);
create index if not exists audit_events_time_idx on audit_events(occurred_at desc);

create table if not exists data_access_logs (
  access_id uuid primary key default gen_random_uuid(),
  accessed_at timestamptz not null default now(),
  accessor varchar(100) not null,
  accessor_role varchar(20) not null,
  farmer_id uuid not null references farmers(farmer_id) on delete restrict,
  lender_id uuid references lenders(lender_id) on delete restrict,
  application_id uuid references loan_applications(application_id) on delete restrict,
  categories jsonb not null default '[]'::jsonb,
  purpose varchar(200) not null
);
create index if not exists data_access_logs_farmer_idx on data_access_logs(farmer_id, accessed_at desc);

-- updated_at triggers
create or replace function app_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['cooperatives','societies','farmers','incentive_programs','member_queries','signal_responses'] loop
    execute format('drop trigger if exists touch_updated_at on %I', t);
    execute format('create trigger touch_updated_at before update on %I for each row execute function app_touch_updated_at()', t);
  end loop;
end $$;

-- RLS on for every table (deny by default). Policies are in 0003.
do $$ declare t text; begin
  foreach t in array array['societies','society_collection_daily','products','demand_daily','weather_daily','calendar_events','data_sources','demand_zones','supply_outlook','production_plans','production_plan_lines','incentive_programs','incentive_program_societies','signal_responses','demo_simulation_traits','member_queries','query_messages','loan_application_events','app_users','audit_events','data_access_logs']
  loop execute format('alter table %I enable row level security', t); end loop;
end $$;
