// Database maintenance for a real Postgres (Supabase): DATABASE_URL must be set.
//   npm run db:migrate      apply supabase/migrations that have not run yet
//   npm run db:seed         load the synthetic demo data (skipped if already present)
//   npm run db:reset-demo   clear demo workflow (synthetic records only)
import { asSystem, migrate } from '../lib/server/db.ts';
import { resetDemoWorkflow, seedDemoData } from '../lib/server/seed.ts';

const cmd = process.argv[2];
if (!process.env.DATABASE_URL) { console.error('Set DATABASE_URL first (Supabase: Project Settings > Database > Connection string).'); process.exit(1); }
if (cmd === 'migrate') { await migrate(); console.log('Migrations applied.'); }
else if (cmd === 'seed') { await asSystem((tx) => seedDemoData(tx, { log: console.log })); }
else if (cmd === 'reset') { await asSystem((tx) => resetDemoWorkflow(tx)); console.log('Demo workflow reset.'); }
else { console.error('Usage: tsx scripts/db.mts migrate|seed|reset'); process.exit(1); }
process.exit(0);
