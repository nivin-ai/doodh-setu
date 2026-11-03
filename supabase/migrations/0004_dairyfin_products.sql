-- Migration 0004: DairyFin for farmers, societies and consumers, and insurance.
-- Extends the existing finance tables instead of adding parallel ones:
--   loan_products      -> the one financial product catalogue (loans, insurance, prepaid), configured as data
--   loan_applications  -> applications from farmers or societies, with product answers, offers and drafts
--   consent_records    -> also for societies
--   insurance_*        -> policies and claims linked to the application and the insurer
-- New: consumers and a simulated prepaid milk wallet. All terms seeded here are DEMO/indicative.

-- ---------------------------------------------------------------- providers and catalogue
alter table lenders add column if not exists provider_kind varchar(20) not null default 'lender';
do $$ begin alter table lenders add constraint lenders_kind_chk check (provider_kind in ('lender', 'insurer', 'platform'));
exception when duplicate_object then null; end $$;

alter table loan_products add column if not exists segment varchar(10) not null default 'farmer';
alter table loan_products add column if not exists product_type varchar(12) not null default 'loan';
alter table loan_products add column if not exists category varchar(30);
alter table loan_products add column if not exists description text;
alter table loan_products add column if not exists benefits jsonb not null default '[]'::jsonb;
alter table loan_products add column if not exists eligibility_rules jsonb not null default '[]'::jsonb; -- [{id, label, check}] (eligibility stays the old text summary)
alter table loan_products add column if not exists tenure_options jsonb not null default '[]'::jsonb;   -- months
alter table loan_products add column if not exists fees_text text;
alter table loan_products add column if not exists required_documents jsonb not null default '[]'::jsonb; -- [{id, label}]
alter table loan_products add column if not exists application_fields jsonb not null default '[]'::jsonb; -- [{id, label, type, options?, required?}]
alter table loan_products add column if not exists data_categories jsonb not null default '[]'::jsonb;  -- what the consent covers
alter table loan_products add column if not exists product_status varchar(10) not null default 'active';
alter table loan_products add column if not exists disclaimer text;
alter table loan_products add column if not exists terms_verified boolean not null default false;      -- false = demo/indicative terms
alter table loan_products add column if not exists coverage jsonb;                                       -- insurance: {options: [...], period}
alter table loan_products add column if not exists exclusions jsonb not null default '[]'::jsonb;
alter table loan_products add column if not exists claim_reasons jsonb not null default '[]'::jsonb;
alter table loan_products add column if not exists sort_order integer not null default 0;
alter table loan_products add column if not exists updated_at timestamptz not null default now();
do $$ begin alter table loan_products add constraint loan_products_segment_chk check (segment in ('farmer', 'society', 'consumer'));
exception when duplicate_object then null; end $$;
do $$ begin alter table loan_products add constraint loan_products_type_chk check (product_type in ('loan', 'insurance', 'prepaid'));
exception when duplicate_object then null; end $$;
do $$ begin alter table loan_products add constraint loan_products_status_chk check (product_status in ('active', 'paused'));
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- applications (farmer or society)
alter table loan_applications add column if not exists applicant_type varchar(10) not null default 'farmer';
alter table loan_applications add column if not exists society_id uuid references societies(society_id) on delete restrict;
alter table loan_applications add column if not exists answers jsonb not null default '{}'::jsonb;
alter table loan_applications add column if not exists offer jsonb;                 -- lender's indicative offer {amount, rate, tenure, notes}
alter table loan_applications add column if not exists offer_status varchar(10);
alter table loan_applications add column if not exists decided_at timestamptz;
alter table loan_applications add column if not exists insured_cattle_id uuid references cattle(cattle_id) on delete restrict;
alter table loan_applications add column if not exists submitted_by varchar(100);
alter table loan_applications drop constraint if exists loan_app_status_chk;
alter table loan_applications add constraint loan_app_status_chk check (application_status in
  ('draft', 'submitted', 'in_review', 'more_info', 'approved', 'declined', 'policy_issued', 'withdrawn'));
do $$ begin alter table loan_applications add constraint loan_app_applicant_chk check (
  (applicant_type = 'farmer' and farmer_id is not null) or (applicant_type = 'society' and society_id is not null));
exception when duplicate_object then null; end $$;
do $$ begin alter table loan_applications add constraint loan_app_offer_chk check (offer_status is null or offer_status in ('pending', 'accepted', 'declined'));
exception when duplicate_object then null; end $$;
create index if not exists loan_applications_society_idx on loan_applications(society_id);
alter table loan_application_events add column if not exists actor varchar(100);

alter table consent_records add column if not exists society_id uuid references societies(society_id) on delete restrict;
alter table consent_records add column if not exists loan_product_code varchar(20);
create index if not exists consent_records_society_idx on consent_records(society_id);
alter table data_sharing_logs add column if not exists society_id uuid references societies(society_id) on delete restrict;
alter table data_access_logs alter column farmer_id drop not null;
alter table data_access_logs add column if not exists society_id uuid references societies(society_id) on delete restrict;

-- Demo authorisation: which staff account may sign finance applications for the society
alter table app_users add column if not exists is_authorised_signatory boolean not null default false;

-- ---------------------------------------------------------------- insurance policies and claims (baseline tables, extended)
alter table insurance_policies add column if not exists application_id uuid references loan_applications(application_id) on delete restrict;
alter table insurance_policies add column if not exists insurer_id uuid references lenders(lender_id) on delete restrict;
alter table insurance_policies add column if not exists renewal_status varchar(20) not null default 'not_due';
alter table insurance_policies add column if not exists is_simulated boolean not null default true;
do $$ begin alter table insurance_policies add constraint ins_policy_status_chk check (policy_status in ('active', 'expired', 'cancelled'));
exception when duplicate_object then null; end $$;
create index if not exists insurance_policies_farmer_idx on insurance_policies(farmer_id);
alter table insurance_claims add column if not exists farmer_id uuid references farmers(farmer_id) on delete restrict;
alter table insurance_claims add column if not exists claim_reason varchar(60);
alter table insurance_claims add column if not exists description text;
alter table insurance_claims add column if not exists documents jsonb not null default '[]'::jsonb;
alter table insurance_claims add column if not exists created_at timestamptz not null default now();
do $$ begin alter table insurance_claims add constraint ins_claim_status_chk check (claim_status in
  ('draft', 'submitted', 'in_review', 'more_info', 'approved', 'declined', 'settled', 'withdrawn'));
exception when duplicate_object then null; end $$;
create sequence if not exists insurance_claim_ref_seq start 501;
create table if not exists insurance_claim_events (
  event_id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references insurance_claims(claim_id) on delete cascade,
  status varchar(20) not null, note text, actor varchar(100),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- consumers and the simulated prepaid wallet
create table if not exists consumers (
  consumer_id uuid primary key default gen_random_uuid(),
  display_name varchar(100) not null,
  city varchar(30) not null,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists wallet_subscriptions (
  subscription_id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references consumers(consumer_id) on delete cascade,
  product_code varchar(20) not null references loan_products(product_code) on delete restrict,
  channel varchar(40) not null,
  plan varchar(100) not null,
  price_per_day numeric(8,2) not null check (price_per_day >= 0),
  status varchar(10) not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  renews_on date,
  created_at timestamptz not null default now()
);
create table if not exists wallet_transactions (
  txn_id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references consumers(consumer_id) on delete cascade,
  kind varchar(10) not null check (kind in ('topup', 'purchase')),
  amount numeric(10,2) not null check (amount > 0),
  description text not null,
  simulated boolean not null default true,     -- no payment gateway: every payment is simulated
  created_at timestamptz not null default now()
);
create index if not exists wallet_txn_consumer_idx on wallet_transactions(consumer_id, created_at desc);
do $$ declare t text; begin
  foreach t in array array['insurance_claim_events', 'consumers', 'wallet_subscriptions', 'wallet_transactions'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- access control for the new paths
grant select on consumers, wallet_subscriptions, wallet_transactions, insurance_claim_events to doodh_app;
grant usage, select on sequence insurance_claim_ref_seq to doodh_app;
grant insert, update on consumers, wallet_subscriptions, wallet_transactions, insurance_policies, insurance_policy_animals,
  insurance_claims, insurance_claim_events to doodh_app;
create or replace function app.consumer_id() returns uuid language sql stable as $$ select app.setting('consumer_id')::uuid $$;
grant execute on function app.consumer_id() to doodh_app;

create or replace function app.lender_has_society_consent(s uuid, category text) returns boolean language sql stable security definer set search_path = public as
$$ select app.role() = 'lender' and exists (
     select 1 from consent_records c where c.society_id = s and c.lender_id = app.lender_id() and c.consent_status = 'granted'
       and (category is null or c.collection_categories ? category)) $$;
create or replace function app.can_see_application(a uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from loan_applications l where l.application_id = a and (
     (app.role() = 'farmer' and l.farmer_id = app.farmer_id())
     or (app.role() = 'secretary' and l.applicant_type = 'society' and l.society_id = app.society_id())
     or (app.role() = 'lender' and l.lender_id = app.lender_id() and l.application_status <> 'draft'))) $$;
create or replace function app.can_see_claim(c uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from insurance_claims k join insurance_policies p on p.policy_id = k.policy_id where k.claim_id = c and (
     (app.role() = 'farmer' and k.farmer_id = app.farmer_id()) or (app.role() = 'lender' and p.insurer_id = app.lender_id() and k.claim_status <> 'draft'))) $$;
grant execute on all functions in schema app to doodh_app;

-- applications: farmers their own, a secretary the society's own, lenders those sent to them (not drafts)
drop policy if exists ds_read on loan_applications;
drop policy if exists ds_write on loan_applications;
drop policy if exists ds_update on loan_applications;
create policy ds_read on loan_applications for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'secretary' and applicant_type = 'society' and society_id = app.society_id())
  or (app.role() = 'lender' and lender_id = app.lender_id() and application_status <> 'draft'));
create policy ds_write on loan_applications for insert to doodh_app with check (
  (app.role() = 'farmer' and applicant_type = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'secretary' and applicant_type = 'society' and society_id = app.society_id()));
create policy ds_update on loan_applications for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'secretary' and applicant_type = 'society' and society_id = app.society_id())
  or (app.role() = 'lender' and lender_id = app.lender_id() and application_status <> 'draft'));

-- consents for societies
drop policy if exists ds_read on consent_records;
drop policy if exists ds_write on consent_records;
drop policy if exists ds_update on consent_records;
create policy ds_read on consent_records for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id())
  or (app.role() = 'lender' and lender_id = app.lender_id()));
create policy ds_write on consent_records for insert to doodh_app with check (
  (app.role() = 'farmer' and farmer_id = app.farmer_id() and society_id is null) or (app.role() = 'secretary' and society_id = app.society_id() and farmer_id is null));
create policy ds_update on consent_records for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id()));
drop policy if exists ds_read on data_sharing_logs;
drop policy if exists ds_write on data_sharing_logs;
create policy ds_read on data_sharing_logs for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id())
  or (app.role() = 'lender' and recipient_id = app.lender_id()));
create policy ds_write on data_sharing_logs for insert to doodh_app with check (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id()));
drop policy if exists ds_write on data_access_logs;
create policy ds_write on data_access_logs for insert to doodh_app with check (app.role() = 'lender' and lender_id = app.lender_id() and accessor = app.setting('actor'));
drop policy if exists ds_read on data_access_logs;
create policy ds_read on data_access_logs for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id())
  or (app.role() = 'lender' and lender_id = app.lender_id()));

-- lenders see society operating data only with the society's consent
create or replace function app.lender_has_member_consent(s uuid) returns boolean language sql stable security definer set search_path = public as
$$ select app.role() = 'lender' and exists (select 1 from consent_records c join farmers f on f.farmer_id = c.farmer_id
     where f.society_id = s and c.lender_id = app.lender_id() and c.consent_status = 'granted') $$;
grant execute on function app.lender_has_member_consent(uuid) to doodh_app;
-- the society's name is visible to a lender that holds the society's consent or a member's consent
create policy ds_lender_read on societies for select to doodh_app using (app.lender_has_society_consent(society_id, null) or app.lender_has_member_consent(society_id));
create policy ds_lender_read on society_collection_daily for select to doodh_app using (app.lender_has_society_consent(society_id, 'society_operations'));
-- insurers see the insured animal only with the farmer's livestock consent
create policy ds_lender_read on cattle for select to doodh_app using (app.lender_has_consent(farmer_id, 'livestock'));

-- insurance policies, animals and claims
create policy ds_read on insurance_policies for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and insurer_id = app.lender_id()));
create policy ds_write on insurance_policies for insert to doodh_app with check (app.role() = 'lender' and insurer_id = app.lender_id());
create policy ds_update on insurance_policies for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and insurer_id = app.lender_id()));
create policy ds_read on insurance_policy_animals for select to doodh_app using (exists (select 1 from insurance_policies p where p.policy_id = insurance_policy_animals.policy_id));
create policy ds_write on insurance_policy_animals for insert to doodh_app with check (
  app.role() = 'lender' and exists (select 1 from insurance_policies p where p.policy_id = insurance_policy_animals.policy_id and p.insurer_id = app.lender_id()));
create policy ds_read on insurance_claims for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'lender' and claim_status <> 'draft' and exists (select 1 from insurance_policies p where p.policy_id = insurance_claims.policy_id and p.insurer_id = app.lender_id())));
create policy ds_write on insurance_claims for insert to doodh_app with check (
  app.role() = 'farmer' and farmer_id = app.farmer_id() and exists (select 1 from insurance_policies p where p.policy_id = insurance_claims.policy_id and p.farmer_id = app.farmer_id()));
create policy ds_update on insurance_claims for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'lender' and exists (select 1 from insurance_policies p where p.policy_id = insurance_claims.policy_id and p.insurer_id = app.lender_id())));
create policy ds_read on insurance_claim_events for select to doodh_app using (app.can_see_claim(claim_id));
create policy ds_write on insurance_claim_events for insert to doodh_app with check (app.can_see_claim(claim_id) or app.role() = 'farmer');

-- consumers: only their own wallet
create policy ds_read on consumers for select to doodh_app using (app.role() = 'consumer' and consumer_id = app.consumer_id());
create policy ds_read on wallet_subscriptions for select to doodh_app using (app.role() = 'consumer' and consumer_id = app.consumer_id());
create policy ds_write on wallet_subscriptions for insert to doodh_app with check (app.role() = 'consumer' and consumer_id = app.consumer_id());
create policy ds_update on wallet_subscriptions for update to doodh_app using (app.role() = 'consumer' and consumer_id = app.consumer_id());
create policy ds_read on wallet_transactions for select to doodh_app using (app.role() = 'consumer' and consumer_id = app.consumer_id());
create policy ds_write on wallet_transactions for insert to doodh_app with check (app.role() = 'consumer' and consumer_id = app.consumer_id());
