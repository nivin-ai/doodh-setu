# Doodh Setu prototype (v0.2)

A working prototype of Doodh Setu, a demand-to-farmer intelligence platform for a dairy cooperative, built for the SPJIMR BDA assignment on the Amul case. All data is synthetic, calibrated to public Indian patterns. It is not real Amul data.

## What is inside

| App | URL | Who |
|---|---|---|
| Demo home | `/` | Demo script, demo date switch, reset |
| Farmer app | `/farmer` | Savitaben, a member farmer (Gujarati, Hindi, English, voice) |
| Society dashboard | `/society` | Society secretary |
| Planner console | `/planner` | Union planner, approver and marketing manager (Marketing menu) |
| Lender desk (DairyFin) | `/lender` | Bank case officer |

Open the apps in separate tabs of the same browser. Demo state is shared through the browser's local storage, so actions in one app show up in the others. "Reset demo" on the home page starts again.

## Voice (Gnani.ai)

Speech-to-text and text-to-speech use the Gnani.ai Vachana API through two server routes, so the API key never reaches the browser:

- `POST /api/tts` calls `https://api.vachana.ai/api/v1/tts/inference` (voices: Veera for Gujarati, Nalini for Hindi, Kaveri for English, model `timbre-v2.5`)
- `POST /api/stt` calls `https://api.vachana.ai/stt/v3` (model `prisma-v3.0`, `gu-IN`, `hi-IN`, `en-IN`)

If `GNANI_API_KEY` is not set, the app falls back to the browser's built-in voice (and you can always type questions). Gujarati voices are not available in every browser, so set the key for the real demo.

Optional environment variables: `GNANI_VOICE_GU`, `GNANI_VOICE_HI`, `GNANI_VOICE_EN`, `GNANI_TTS_MODEL`, `GNANI_STT_MODEL`.

## AI answers (Ask tab)

Questions in the Ask tab are answered by an AI model through `/api/ask`. It only uses the farmer's own records and the society's approved advice, which the app sends with each question (`lib/askContext.ts`). If it can't answer from those, it says so and points to "Talk to a person".

Set one key in Vercel (Project, Settings, Environment Variables), then redeploy:
- `GEMINI_API_KEY` (free tier, get it at https://aistudio.google.com/apikey). Optional `GEMINI_MODEL`, default `gemini-flash-latest`.
- or `ANTHROPIC_API_KEY`. Optional `ANTHROPIC_MODEL`, default `claude-haiku-5-5`.

If no key is set, or the AI call fails, the app falls back to the fixed rule-based answers in `lib/ask.ts`. Open `/api/health` to see what is active: `{"gnani":true,"ai":"gemini"}`.

## Map tiles (demand map)

The demand map uses CARTO basemap tiles, which need a free key. Set `CART_KEY` in `.env.local` and in Vercel (Project, Settings, Environment Variables), then redeploy. The key is built into the page at build time, so a redeploy is required after adding it. Without a key, the map falls back to plain OpenStreetMap tiles.

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

- `lib/farmer.ts`: daily milk collection for one farmer (3 buffaloes, 1 cow), seasonal yields, fat and SNF, payment at ₹865 per kg fat plus SNF bonus, and an exact breakdown of why the monthly payment changed.
- `lib/demand.ts`: two years of daily sales for 5 products in Mumbai and Ahmedabad across dealers, quick commerce and Amul Shop, driven by growth, temperature, festivals and weekends. The forecast uses last year's pattern adjusted for growth and temperature, with an 80% range and a 28-day accuracy check.
- `lib/union.ts`: product-mix plan (highest value per litre first, within demand, capacity, buffalo milk and the liquid milk commitment), the buffalo milk gap, the incentive model (cost, value gained, cap check) and the fairness view by society size.
- `lib/marketing.ts`: Module G. Demand opportunities by product and city from the forecast; a supply check that holds any campaign the product-mix plan cannot supply (for example paneer and curd while buffalo milk is short); campaign value counted as extra milk sold as that product instead of going to powder; results against control areas; farmer segments with a weekly message cap; and the monthly "where your milk goes" story.
- `lib/ask.ts`: the farmer assistant answers only from approved content and the farmer's own records, in three languages.
- `lib/i18n.ts`: farmer-facing text in Gujarati, Hindi and English. Starter translations: review with native speakers before field use.

## What changed in v0.2

- Planner console: new Marketing menu (opportunities, campaigns with supply check, results, farmer segments and milk story). New user: Neha (marketing).
- Society dashboard: Milk story page to publish the union's monthly story.
- Farmer app: "Where your milk goes this summer" card and story, read aloud.

## Known limits

- Demo state lives in one browser; there is no database or login.
- Translation of free-text local notes is manual (Gnani.ai provides voice, not translation).
- The forecast and optimiser are simple, explainable models for demonstration.
- Lender offers are demo offers, not real bank products.
