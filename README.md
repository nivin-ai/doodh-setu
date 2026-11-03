# Doodh Setu prototype (v0.3, database-first)

A working prototype of Doodh Setu, a demand-to-farmer intelligence platform for a dairy cooperative, built for the SPJIMR BDA assignment on the Amul case. All data is synthetic, calibrated to public Indian patterns. It is not real Amul data.

## What is inside

| App | URL | Who |
|---|---|---|
| Demo home | `/` | Demo script, demo date switch, reset |
| Farmer app | `/farmer` | A member farmer (Gujarati, Hindi, English, voice) |
| Society dashboard | `/society` | Society secretary |
| Planner console | `/planner` | Union planner and approver |
| Lender desk (DairyFin) | `/lender` | Bank case officer |

All business data is in Postgres (Supabase, or a local demo database when none is configured). Open the apps in separate tabs: an action in one shows up in the others within seconds. "Reset demo" on the home page clears what was done during a demo.

## Architecture

```
React screens (components/*App.tsx)          UI only; Zustand holds demo date, language, playback, acting role
   |  useResource / postJson (lib/client/api.ts)   loading, error and cross-tab refresh
   v
API routes (app/api/{farmer,society,planner,lender,demo})   check the signed cookie -> database scope
   v
Services (lib/server/services)               workflow rules: maker-checker, consent, publishing, audit
   v
Repositories (lib/server/repositories)       every SQL statement, typed results
   v
lib/server/db.ts                             postgres.js (DATABASE_URL) or PGlite (local), each request inside
   v                                         `set local role doodh_app` + scope settings
Postgres with row-level security (supabase/migrations)
```

- Domain calculations stay pure and are shared by server and browser: `lib/farmer.ts` (payments), `lib/demand.ts` (forecast), `lib/union.ts` (product mix, milk gap, incentive), `lib/geo.ts` (zone demand). They take data as arguments; none of them holds data.
- Synthetic data generators live in `lib/demo-data/` and are used only by the seed (`lib/server/seed.ts`).
- Database setup, seeding and the access model: see `supabase/README.md`.

## Environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Supabase Postgres | Transaction pooler connection string (port 6543). Server only. Without it the local demo database (PGlite) is used. |
| `AUTH_SECRET` | Signing sign-in cookies | Any long random string. Without it a built-in demo value is used. |
| `ALLOW_DEMO_RESET` | Reset button | Set to `false` to disable the public demo reset. |
| `PGLITE_DIR` | Local demo database | Optional folder to keep local data between restarts. |
| `ANTHROPIC_API_KEY`, `GNANI_API_KEY`, `CART_KEY` | AI answers, voice, map tiles | As before. |

## Checks

```
npm run typecheck   # TypeScript
npm test            # migrations, seed, services and row-level security against a local Postgres (PGlite)
npm run build
```

## Staff sign-in

The planner console (`/planner`), society dashboard (`/society`) and lender desk (`/lender`) form one staff website behind a sign-in (`/login`). Accounts are in the `app_users` table (scrypt password hashes). `middleware.ts` checks the signed cookie and role on every page request; each API request is checked again and runs with that user's database scope, so row-level security applies.

The farmer app (`/farmer`) has no staff sign-in. In this prototype the browser is registered as the demo farmer's phone (`/api/farmer/session`); a real app would verify the member's mobile number with a one-time code. It can be added to a phone home screen (`public/farmer.webmanifest`).

Demo accounts: planner / planner123, approver / approver123, secretary / society123, lender / lender123, admin / admin123. The admin can switch between all three modules and act as planner or approver.

## Voice (Gnani.ai)

Text-to-speech (reading answers and messages aloud) uses the Gnani.ai Vachana API through a server route, so the API key never reaches the browser. Voice input is switched off in the farmer app for now; farmers type or tap a suggested question.

- `POST /api/tts` calls `https://api.vachana.ai/api/v1/tts/inference` (voices: Veera for Gujarati, Nalini for Hindi, Kaveri for English, model `timbre-v2.5`)
- `POST /api/stt` (speech-to-text, `https://api.vachana.ai/stt/v3`, model `prisma-v3.0`) is kept but not used by the app

If `GNANI_API_KEY` is not set, the app falls back to the browser's built-in voice . Gujarati voices are not available in every browser, so set the key for the real demo.

Optional environment variables: `GNANI_VOICE_GU`, `GNANI_VOICE_HI`, `GNANI_VOICE_EN`, `GNANI_TTS_MODEL`, `GNANI_STT_MODEL`.

## AI answers (Ask tab)

Questions in the Ask tab are answered by an AI model through `/api/ask`. It only uses the farmer's own records and the society's approved advice, which the app sends with each question (`lib/askContext.ts`). If it can't answer from those, it says so and points to "Talk to a person".

Set `ANTHROPIC_API_KEY` in Vercel (Project, Settings, Environment Variables), then redeploy. Get a key at https://console.anthropic.com. Optional `ANTHROPIC_MODEL`, default `claude-haiku-5-5` (Anthropic's fastest model).

If no key is set, or the AI call fails, the app falls back to the fixed rule-based answers in `lib/ask.ts`. Open `/api/health` to see what is active: `{"gnani":true,"ai":"claude"}`.

## Map tiles (demand map)

The demand map uses CARTO basemap tiles, which need a free key. Set `CART_KEY` in `.env.local` and in Vercel (Project, Settings, Environment Variables), then redeploy. The key is built into the page at build time, so a redeploy is required after adding it. Without a key, the map falls back to plain OpenStreetMap tiles.

## Database

See `supabase/README.md` for migrations, the seed, the local demo database and the access model. KYC is stored as masked values and provider tokens only; raw Aadhaar or PAN numbers are never stored.

## Deploy to Vercel (no Git needed)

1. Install Node.js 20 or later from https://nodejs.org (one-time).
2. Open Terminal, go to this folder:
   `cd "~/Desktop/BDA Prototype/doodh-setu-app"`
3. Run `npx vercel` and follow the prompts (log in, accept the defaults). This gives you a preview link.
4. Add your Gnani key: `npx vercel env add GNANI_API_KEY` (choose Production and Preview), or add it in the Vercel dashboard under Project, Settings, Environment Variables.
5. Run `npx vercel --prod` to publish the production link.

Alternative: push this folder to a GitHub repository and import it at https://vercel.com/new. Vercel detects Next.js automatically.

## Run on your computer

```
npm install
cp .env.example .env.local   # then paste your Gnani key
npm run dev                  # open http://localhost:3000
```

## How the numbers work

- `lib/farmer.ts`: payment at ₹865 per kg fat plus SNF bonus and any premium, from the farmer's milk pours (`milk_transactions`), and an exact breakdown of why the monthly payment changed.
- `lib/demand.ts`: the forecast over daily sales by city, product and channel (`demand_daily`) and temperatures (`weather_daily`): last year's pattern adjusted for growth and temperature, with an 80% range and a 28-day accuracy check. The synthetic sales themselves are generated by `lib/demo-data/demand.ts` at seed time.
- `lib/union.ts`: product-mix plan (buffalo milk goes first to the products that earn most per litre of buffalo milk, within demand, capacity, buffalo milk and the liquid milk commitment), the buffalo milk gap, the incentive model (cost, value gained from the extra milk only, break-even check; the mix gain is reported separately) and the fairness view by society size.
- `lib/ask.ts`: the farmer assistant answers only from approved content and the farmer's own records, in three languages.
- `lib/i18n.ts`: farmer-facing text in Gujarati, Hindi and English. Starter translations: review with native speakers before field use.

## What changed in v0.3

- Postgres is the source of truth: migrations, row-level security by role, typed repositories and services, a repeatable synthetic seed, and a local PGlite database when no `DATABASE_URL` is set.
- Every module reads and writes through the API; Zustand keeps only UI preferences.
- Staff accounts moved to the database; lender access depends on the farmer's active consent and every case view is logged.

## Known limits

- Staff accounts are demo accounts; there is no Supabase Auth, password reset or multi-factor sign-in yet. The farmer app trusts a demo device registration instead of an OTP.
- Without `DATABASE_URL` the local database resets when the server restarts and is not shared between server instances.
- Other members' responses to a published premium are simulated (`demo_simulation_traits`), and the results card's buffalo-milk lift and stockout figures are illustrative.
- Only the demo farmer has individual milk pours; other members show herd-based yields.
- Translation of free-text local notes is manual (Gnani.ai provides voice, not translation).
- The forecast and optimiser are simple, explainable models for demonstration.
- Lender offers are demo offers, not real bank products.
