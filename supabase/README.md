# Doodh Setu database (Supabase Postgres)

Postgres is the source of truth for all business data. The schema is in `migrations/`, applied in order:

| File | What it does |
|---|---|
| `0001_baseline.sql` | The original `schema.sql` (farmers, KYC, land, cattle, milk transactions, credit, lenders, loans, consent, data sharing, insurance). Its demo seed moved to the seed script. |
| `0002_database_first.sql` | Societies, links and checks on the baseline tables, demand and planning tables, incentive programmes, member queries, staff accounts, audit and data-access logs. |
| `0003_access_control.sql` | The `doodh_app` request role, scope helper functions, row-level security policies and the incentive status trigger (maker-checker). |
| `0004_dairyfin_products.sql` | DairyFin: product configuration on `loan_products`, society applicants, drafts, answers and offers on `loan_applications`, society consents, insurance policies and claims linked to insurers, the consumer wallet tables, and their row-level security. Additive only. |

All are written to be re-runnable. `supabase/seed/*.sql` holds idempotent demo reference data (the DairyFin catalogue, the demo insurer and wallet provider, the demo consumer and insurer account, ear tags for synthetic animals). It is applied after the seed, after a demo reset and, when the demo union exists, on first server start.

## Set up a Supabase project

1. Create a project at supabase.com.
2. Apply the migrations and load the demo data. Easiest from Vercel: add `DATABASE_URL`, `AUTH_SECRET` and `SETUP_KEY` (any random string) as environment variables, redeploy, then open `https://<your site>/api/setup?key=<SETUP_KEY>` once. It applies the migrations, loads the demo data and shows the row counts; remove `SETUP_KEY` afterwards. Or:
   - **SQL editor:** paste each file in order (0001, 0002, 0003) and run it, or
   - **From a computer with this repo:** set `DATABASE_URL` (below) and run `npm run db:migrate`.
3. Load the synthetic demo data: `npm run db:seed` (does nothing if the demo union already exists).
4. In Vercel, add `DATABASE_URL` and `AUTH_SECRET` (Project, Settings, Environment Variables) and redeploy.

`DATABASE_URL` is in Supabase under Project Settings, Database, Connection string. Use the **transaction pooler** string (port 6543) for Vercel. It contains the database password: keep it server-side only.

## Demo data

The seed (`lib/server/seed.ts`, generators in `lib/demo-data/`) creates a synthetic union, 120 societies, 414 farmers with herds, 18 months of milk pours for the demo farmer, two years of city demand by channel, weather, festivals, dark-store zones, lenders, loan products, three background loan cases and five demo staff accounts. Every row is marked `is_synthetic` or belongs to a synthetic union or farmer.

- `npm run db:seed` loads it once.
- `npm run db:reset-demo` (or "Reset demo" on the landing page) clears what was done during a demo: proposals, responses, queries, consents, applications, accepted plans and audit rows that belong to synthetic records. Real records are never touched. Set `ALLOW_DEMO_RESET=false` to disable the public reset button.

## Without Supabase (local demo database)

If `DATABASE_URL` is not set, the server starts PGlite (Postgres compiled to WebAssembly) inside the server process, applies the same migrations and loads the same seed. Row-level security works exactly as on Supabase. Limits: data is kept in memory (or in `PGLITE_DIR` if set) and resets when the server restarts; on Vercel each server instance has its own copy. Use it for development and quick demos, not as the live database.

## Access control

The server connects as the database owner but runs each request in a transaction that does `set local role doodh_app` and sets the caller's scope (`app.role`, `app.farmer_id`, `app.society_id`, `app.cooperative_id`, `app.lender_id`, `app.actor`). Policies then apply:

| Role | Can see | Can change |
|---|---|---|
| farmer | own profile, herd, milk pours, KYC/land/credit, consents, applications, queries, published programmes for their society, who accessed their data | own responses, queries, consents, applications |
| secretary | own society's members, collection, queries, programmes approved for the society | publish or raise a concern on those programmes, reply to queries, record simulated member responses (demo) |
| planner / approver | own union's societies (aggregates), demand, weather, zones, supply, plans, programmes and audit; no individual farmer rows | planner: submit programmes, accept plans; approver: approve or reject (not their own submission) |
| lender | only applications sent to this lender; farmer data only in the categories the farmer consented to share with this lender, while the consent is active | application status and document requests |

Supabase's `anon` and `authenticated` roles have no policies, so the public REST API returns nothing. Staff sign-in uses `app_users` (scrypt hashes); there is no Supabase Auth yet (see the main README).
