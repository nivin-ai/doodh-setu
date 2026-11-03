-- Migration 0003: row-level security.
--
-- How it works: the app's server connects as the database owner but runs every user request
-- inside a transaction that switches to the low-privilege role doodh_app and sets the caller's
-- scope (see lib/server/db.ts):
--   app.role         farmer | secretary | planner | approver | lender
--   app.farmer_id    for farmers
--   app.society_id   for society secretaries
--   app.cooperative_id for union planners and approvers
--   app.lender_id    for lender case officers
--   app.actor        display name, written to audit rows
-- The policies below then decide which rows that request can see or change. Supabase's own
-- anon and authenticated roles get no policies, so the public REST API exposes nothing.

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'doodh_app') then create role doodh_app nologin; end if;
end $$;
grant doodh_app to current_user;

create schema if not exists app;
grant usage on schema app to doodh_app;
grant usage on schema public to doodh_app;

create or replace function app.setting(k text) returns text language sql stable as
$$ select nullif(current_setting('app.' || k, true), '') $$;
create or replace function app.role() returns text language sql stable as $$ select app.setting('role') $$;
create or replace function app.farmer_id() returns uuid language sql stable as $$ select app.setting('farmer_id')::uuid $$;
create or replace function app.society_id() returns uuid language sql stable as $$ select app.setting('society_id')::uuid $$;
create or replace function app.cooperative_id() returns uuid language sql stable as $$ select app.setting('cooperative_id')::uuid $$;
create or replace function app.lender_id() returns uuid language sql stable as $$ select app.setting('lender_id')::uuid $$;
create or replace function app.is_union_staff() returns boolean language sql stable as $$ select app.role() in ('planner', 'approver') $$;

-- Helpers that look across tables without recursion through RLS (security definer, owner rights).
create or replace function app.farmer_in_my_society(f uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from farmers where farmer_id = f and society_id = app.society_id()) $$;
create or replace function app.society_in_my_union(s uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from societies where society_id = s and cooperative_id = app.cooperative_id()) $$;
-- A lender may see a farmer's data only for categories the farmer consented to share with that lender.
create or replace function app.lender_has_consent(f uuid, category text) returns boolean language sql stable security definer set search_path = public as
$$ select app.role() = 'lender' and exists (
     select 1 from consent_records c
     where c.farmer_id = f and c.lender_id = app.lender_id() and c.consent_status = 'granted'
       and (category is null or c.collection_categories ? category)) $$;
create or replace function app.program_reaches_my_society(p uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (
     select 1 from incentive_program_societies ips
     where ips.program_id = p and ips.society_id = coalesce(app.society_id(), (select society_id from farmers where farmer_id = app.farmer_id()))) $$;
create or replace function app.can_see_query(q uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from member_queries m where m.query_id = q and (
     (app.role() = 'farmer' and m.farmer_id = app.farmer_id()) or (app.role() = 'secretary' and m.society_id = app.society_id()))) $$;
create or replace function app.can_see_application(a uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from loan_applications l where l.application_id = a and (
     (app.role() = 'farmer' and l.farmer_id = app.farmer_id()) or (app.role() = 'lender' and l.lender_id = app.lender_id()))) $$;
grant execute on all functions in schema app to doodh_app;

-- Table privileges for the request role (RLS still filters rows)
grant select on all tables in schema public to doodh_app;
grant insert, update on farmers, signal_responses, member_queries, query_messages, incentive_programs, incentive_program_societies,
  production_plans, production_plan_lines, consent_records, data_sharing_logs, loan_applications, loan_application_events,
  loan_documents, audit_events, data_access_logs to doodh_app;
grant delete on incentive_program_societies to doodh_app;
grant usage on all sequences in schema public to doodh_app;
revoke select on app_users from doodh_app;   -- staff accounts are read by the server only

-- Drop and recreate policies so the file can be re-run
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and policyname like 'ds_%' loop
    execute format('drop policy %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- Reference data readable by any signed-in role
create policy ds_read on cooperatives for select to doodh_app using (app.role() is not null);
create policy ds_read on lenders for select to doodh_app using (app.role() is not null);
create policy ds_read on loan_products for select to doodh_app using (app.role() is not null);
create policy ds_read on products for select to doodh_app using (app.role() is not null);

-- Societies: union staff see their union's societies; a secretary sees their own; a farmer their own
create policy ds_read on societies for select to doodh_app using (
  (app.is_union_staff() and cooperative_id = app.cooperative_id())
  or (app.role() = 'secretary' and society_id = app.society_id())
  or (app.role() = 'farmer' and society_id = (select f.society_id from farmers f where f.farmer_id = app.farmer_id()))
);
create policy ds_read on society_collection_daily for select to doodh_app using (
  (app.role() = 'secretary' and society_id = app.society_id()) or (app.is_union_staff() and app.society_in_my_union(society_id))
);

-- Planning data: union staff only (aggregates, no farmer identity)
create policy ds_read on demand_daily for select to doodh_app using (app.is_union_staff());
create policy ds_read on weather_daily for select to doodh_app using (app.is_union_staff());
create policy ds_read on calendar_events for select to doodh_app using (app.is_union_staff());
create policy ds_read on data_sources for select to doodh_app using (app.is_union_staff());
create policy ds_read on demand_zones for select to doodh_app using (app.is_union_staff());
create policy ds_read on supply_outlook for select to doodh_app using (app.is_union_staff() and cooperative_id = app.cooperative_id());
create policy ds_read on production_plans for select to doodh_app using (app.is_union_staff() and cooperative_id = app.cooperative_id());
create policy ds_write on production_plans for insert to doodh_app with check (app.role() = 'planner' and cooperative_id = app.cooperative_id());
create policy ds_update on production_plans for update to doodh_app using (app.role() = 'planner' and cooperative_id = app.cooperative_id());
create policy ds_read on production_plan_lines for select to doodh_app using (
  exists (select 1 from production_plans p where p.plan_id = production_plan_lines.plan_id));
create policy ds_write on production_plan_lines for insert to doodh_app with check (
  app.role() = 'planner' and exists (select 1 from production_plans p where p.plan_id = production_plan_lines.plan_id));

-- Farmers: own record; secretary sees the society's members; a lender only with consent.
-- Union staff get no individual farmer rows.
create policy ds_read on farmers for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'secretary' and society_id = app.society_id())
  or app.lender_has_consent(farmer_id, null)
);
create policy ds_update on farmers for update to doodh_app using (app.role() = 'farmer' and farmer_id = app.farmer_id());
create policy ds_read on farmer_addresses for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and app.farmer_in_my_society(farmer_id))
  or app.lender_has_consent(farmer_id, 'identity_kyc'));
create policy ds_read on cattle for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and app.farmer_in_my_society(farmer_id)));
create policy ds_read on farmer_kyc for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or app.lender_has_consent(farmer_id, 'identity_kyc'));
create policy ds_read on farmer_properties for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or app.lender_has_consent(farmer_id, 'land_property'));
create policy ds_read on credit_profiles for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or app.lender_has_consent(farmer_id, 'credit_history'));
create policy ds_read on milk_transactions for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id())
  or (app.role() = 'secretary' and society_id = app.society_id())
  or app.lender_has_consent(farmer_id, 'milk_income'));

-- Incentive programmes: union staff manage; the secretary sees programmes that reach the society once
-- approved; farmers see published ones. Status changes are checked by the trigger below.
create policy ds_read on incentive_programs for select to doodh_app using (
  (app.is_union_staff() and cooperative_id = app.cooperative_id())
  or (app.role() = 'secretary' and status in ('approved', 'concern', 'published') and app.program_reaches_my_society(program_id))
  or (app.role() = 'farmer' and status = 'published' and app.program_reaches_my_society(program_id))
);
create policy ds_write on incentive_programs for insert to doodh_app with check (app.role() = 'planner' and cooperative_id = app.cooperative_id());
create policy ds_update on incentive_programs for update to doodh_app using (
  (app.is_union_staff() and cooperative_id = app.cooperative_id())
  or (app.role() = 'secretary' and status in ('approved', 'concern') and app.program_reaches_my_society(program_id))
) with check (
  (app.is_union_staff() and cooperative_id = app.cooperative_id())
  or (app.role() = 'secretary' and status in ('approved', 'concern', 'published') and app.program_reaches_my_society(program_id))
);
create policy ds_read on incentive_program_societies for select to doodh_app using (
  (app.is_union_staff() and app.society_in_my_union(society_id))
  or (app.role() = 'secretary' and society_id = app.society_id()));
create policy ds_write on incentive_program_societies for insert to doodh_app with check (app.role() = 'planner' and app.society_in_my_union(society_id));
create policy ds_delete on incentive_program_societies for delete to doodh_app using (app.role() = 'planner' and app.society_in_my_union(society_id));

create or replace function app.check_program_transition() returns trigger language plpgsql as $$
declare r text := app.role();
begin
  if r is null then return new; end if;  -- server maintenance (seed/reset) runs without a request role
  if old.status = new.status then
    if r = 'planner' and old.status = 'rejected' then return new; end if;
    if r = 'secretary' and new.rate_per_kg_fat = old.rate_per_kg_fat then return new; end if; -- notes, send slot
    if r = 'planner' and old.status = 'submitted' then return new; end if;
    raise exception 'Programme % cannot be edited by % in status %', old.program_id, r, old.status;
  end if;
  if r = 'approver' and old.status = 'submitted' and new.status in ('approved', 'rejected') then
    if new.approved_by is not distinct from old.submitted_by then raise exception 'The person who submits cannot approve (maker-checker)'; end if;
    return new;
  elsif r = 'planner' and old.status in ('rejected') and new.status = 'submitted' then return new;
  elsif r = 'planner' and old.status = 'concern' and new.status = 'approved' then return new;
  elsif r = 'secretary' and old.status = 'approved' and new.status in ('concern', 'published') then return new;
  end if;
  raise exception 'Status change % -> % is not allowed for role %', old.status, new.status, r;
end $$;
drop trigger if exists program_transition on incentive_programs;
create trigger program_transition before update on incentive_programs for each row execute function app.check_program_transition();

-- Responses to a programme: the farmer records their own; the secretary sees the society's members
-- and records simulated responses for the demo.
create policy ds_read on signal_responses for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and app.farmer_in_my_society(farmer_id))
  or (app.is_union_staff() and exists (select 1 from incentive_programs p where p.program_id = signal_responses.program_id)));
create policy ds_write on signal_responses for insert to doodh_app with check (
  (app.role() = 'farmer' and farmer_id = app.farmer_id() and not simulated)
  or (app.role() = 'secretary' and app.farmer_in_my_society(farmer_id) and simulated));
create policy ds_read on demo_simulation_traits for select to doodh_app using (app.role() = 'secretary' and app.farmer_in_my_society(farmer_id));
create policy ds_update on signal_responses for update to doodh_app using (app.role() = 'farmer' and farmer_id = app.farmer_id());

-- Member queries: between a farmer and their own society only
-- (direct column checks here: a lookup function would not see a row inside its own INSERT ... RETURNING)
create policy ds_read on member_queries for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id()));
create policy ds_write on member_queries for insert to doodh_app with check (
  app.role() = 'farmer' and farmer_id = app.farmer_id() and society_id = (select f.society_id from farmers f where f.farmer_id = app.farmer_id()));
create policy ds_update on member_queries for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'secretary' and society_id = app.society_id()));
create policy ds_read on query_messages for select to doodh_app using (app.can_see_query(query_id));
create policy ds_write on query_messages for insert to doodh_app with check (
  app.can_see_query(query_id) and ((app.role() = 'farmer' and sender = 'farmer') or (app.role() = 'secretary' and sender = 'society')));

-- Consent and data sharing: the farmer grants and withdraws; the lender sees what is addressed to it
create policy ds_read on consent_records for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and lender_id = app.lender_id()));
create policy ds_write on consent_records for insert to doodh_app with check (app.role() = 'farmer' and farmer_id = app.farmer_id());
create policy ds_update on consent_records for update to doodh_app using (app.role() = 'farmer' and farmer_id = app.farmer_id());
create policy ds_read on data_sharing_logs for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and recipient_id = app.lender_id()));
create policy ds_write on data_sharing_logs for insert to doodh_app with check (app.role() = 'farmer' and farmer_id = app.farmer_id());

-- Loan applications: the applying farmer and the chosen lender only
create policy ds_read on loan_applications for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and lender_id = app.lender_id()));
create policy ds_write on loan_applications for insert to doodh_app with check (app.role() = 'farmer' and farmer_id = app.farmer_id());
create policy ds_update on loan_applications for update to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and lender_id = app.lender_id()));
create policy ds_read on loan_application_events for select to doodh_app using (app.can_see_application(application_id));
create policy ds_write on loan_application_events for insert to doodh_app with check (app.can_see_application(application_id));
create policy ds_read on loan_documents for select to doodh_app using (app.can_see_application(application_id));
create policy ds_write on loan_documents for insert to doodh_app with check (app.can_see_application(application_id));
create policy ds_update on loan_documents for update to doodh_app using (app.can_see_application(application_id));

-- Audit trail: anyone signed in can add their own events; reading is scoped
create policy ds_write on audit_events for insert to doodh_app with check (app.role() is not null and actor = app.setting('actor'));
create policy ds_read on audit_events for select to doodh_app using (
  (app.is_union_staff() and cooperative_id = app.cooperative_id())
  or (app.role() = 'secretary' and society_id = app.society_id())
  or (app.role() = 'lender' and lender_id = app.lender_id()));
-- Sensitive-data access log: written on every lender case view; the farmer can see who looked
create policy ds_write on data_access_logs for insert to doodh_app with check (app.role() = 'lender' and lender_id = app.lender_id() and accessor = app.setting('actor'));
create policy ds_read on data_access_logs for select to doodh_app using (
  (app.role() = 'farmer' and farmer_id = app.farmer_id()) or (app.role() = 'lender' and lender_id = app.lender_id()));
