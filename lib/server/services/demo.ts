// Public demo helpers: aggregate status counts for the landing page and the demo reset.
// They run with the server's own rights but return counts and statuses only, never records.
import { asSystem, dbMode } from '../db';
import { isSeeded, resetDemoWorkflow, seedDemoData } from '../seed';
import type { DemoState } from '../../types/api';

export async function demoState(): Promise<DemoState> {
  return asSystem(async (tx) => {
    const r = (await tx.query<Record<string, unknown>>(`select
      (select status from incentive_programs p join cooperatives c on c.cooperative_id = p.cooperative_id where c.is_synthetic order by p.created_at desc limit 1) incentive,
      (select count(*) from signal_responses r join farmers f on f.farmer_id = r.farmer_id where f.is_synthetic and not r.simulated and r.interested_on is not null)::int interested,
      (select application_status from loan_applications a join farmers f on f.farmer_id = a.farmer_id where f.is_synthetic and not a.is_synthetic order by submitted_at desc limit 1) application,
      (select count(*) from member_queries q join farmers f on f.farmer_id = q.farmer_id where f.is_synthetic and q.status = 'open')::int open_queries`))[0] ?? {};
    return { incentive: (r.incentive as string) ?? 'none', farmerInterested: Number(r.interested) > 0, application: (r.application as string) ?? 'none', openQueries: Number(r.open_queries ?? 0), db: dbMode() };
  });
}

export function resetAllowed() { return process.env.ALLOW_DEMO_RESET !== 'false'; }

export async function resetDemo() {
  await asSystem(async (tx) => {
    if (!(await isSeeded(tx))) { await seedDemoData(tx); return; }
    await resetDemoWorkflow(tx);
  });
}
