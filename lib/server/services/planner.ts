// Planner console workflows. Runs as the union planner or approver (row-level security: own
// union; no individual farmer records). Maker-checker is enforced again by a database trigger.
import { DbError, withScope, type Scope } from '../db';
import * as R from '../repositories';
import { PREMIUM_PERIOD } from '../../demo';
import type { PlannerDataset, PlannerWorkflow } from '../../types/api';

const g = globalThis as unknown as { __dsDataset?: Map<string, Promise<PlannerDataset>> };

// The planning dataset is large and changes only when data is loaded, so it is cached per union and date
export async function getPlannerDataset(scope: Scope, asOf: string): Promise<PlannerDataset> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new DbError('asOf must be YYYY-MM-DD', 400);
  const key = `${scope.cooperativeId}|${asOf}`;
  g.__dsDataset ??= new Map();
  if (!g.__dsDataset.has(key)) {
    const p = withScope(scope, (tx) => R.plannerDataset(tx, scope.cooperativeId!, asOf));
    g.__dsDataset.set(key, p);
    p.catch(() => g.__dsDataset?.delete(key));
  }
  return g.__dsDataset.get(key)!;
}

export async function getPlannerWorkflow(scope: Scope): Promise<PlannerWorkflow> {
  return withScope(scope, async (tx) => ({ program: await R.latestProgram(tx), audit: await R.listAudit(tx), acceptedPlans: await R.acceptedPlans(tx, scope.cooperativeId!) }));
}

export async function plannerAction(scope: Scope, body: Record<string, unknown>) {
  const coop = scope.cooperativeId!;
  return withScope(scope, async (tx) => {
    const log = (action: string, id?: string) => R.audit(tx, { actor: scope.actor, role: scope.role, action, cooperativeId: coop, entityType: 'incentive_program', entityId: id ?? null });
    switch (body.action) {
      case 'submit': {
        if (scope.role !== 'planner') throw new DbError('Only the planner can submit', 403);
        const rate = Number(body.rate);
        const ids = Array.isArray(body.societyIds) ? (body.societyIds as string[]) : [];
        if (!(rate >= 0 && rate <= 200) || !ids.length) throw new DbError('Set a rate and at least one society', 400);
        const reason = typeof body.justification === 'string' && body.justification.trim() ? body.justification.trim().slice(0, 1000) : null;
        const current = await R.latestProgram(tx);
        if (current && current.status === 'rejected') {
          // resubmit the same proposal with new terms
          await tx.query('delete from incentive_program_societies where program_id = $1', [current.id]);
          await tx.query('insert into incentive_program_societies (program_id, society_id) select $1, unnest($2::uuid[])', [current.id, ids]);
          await R.updateProgram(tx, current.id, { status: 'submitted', rate_per_kg_fat: rate, justification: reason, submitted_by: scope.actor, submitted_at: new Date().toISOString(), rejected_reason: null });
          await log(`Resubmitted premium ₹${rate}/kg fat for ${ids.length} societies${reason ? ` with justification: ${reason}` : ''}`, current.id);
          return { ok: true, id: current.id };
        }
        if (current && current.status !== 'rejected') throw new DbError('A proposal is already in progress', 409);
        const id = await R.createProgram(tx, { cooperativeId: coop, title: 'Lean-season buffalo milk premium', rate, from: PREMIUM_PERIOD.from, to: PREMIUM_PERIOD.to, submittedBy: scope.actor, justification: reason, societyIds: ids });
        await log(`Submitted premium ₹${rate}/kg fat for ${ids.length} societies${reason ? ` with justification: ${reason}` : ''}`, id);
        return { ok: true, id };
      }
      case 'decide': {
        if (scope.role !== 'approver') throw new DbError('Only the approver can decide', 403);
        const id = String(body.programId ?? '');
        if (body.decision === 'approve') {
          await R.updateProgram(tx, id, { status: 'approved', approved_by: scope.actor, approved_at: new Date().toISOString() });
          await log('Approved lean-season premium; released to societies', id);
        } else {
          const reason = String(body.reason ?? '').trim().slice(0, 1000);
          if (!reason) throw new DbError('Give a reason to reject', 400);
          await R.updateProgram(tx, id, { status: 'rejected', rejected_reason: reason });
          await log(`Rejected: ${reason}`, id);
        }
        return { ok: true };
      }
      case 'confirm': {
        if (scope.role !== 'planner') throw new DbError('Only the planner can respond', 403);
        const id = String(body.programId ?? '');
        await R.updateProgram(tx, id, { status: 'approved', concern: null });
        await log('Responded to society concern; target confirmed', id);
        return { ok: true };
      }
      case 'acceptPlan': {
        if (scope.role !== 'planner') throw new DbError('Only the planner can accept a plan', 403);
        const month = String(body.month ?? '');
        if (!/^\d{4}-\d{2}-01$/.test(month)) throw new DbError('month must be YYYY-MM-01', 400);
        const lines = (body.lines ?? {}) as Record<string, number>;
        const kind = body.kind === 'adjusted' ? 'adjusted' : 'recommended';
        await R.acceptPlan(tx, { cooperativeId: coop, month, kind, by: scope.actor, lines });
        await R.audit(tx, { actor: scope.actor, role: scope.role, action: `Accepted ${kind} product mix for ${month.slice(0, 7)}`, cooperativeId: coop, entityType: 'production_plan' });
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}
