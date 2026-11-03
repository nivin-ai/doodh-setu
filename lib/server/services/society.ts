// Society dashboard workflows. Runs as the society secretary (row-level security: own society).
import { DbError, withScope, type Scope } from '../db';
import * as R from '../repositories';
import { worthToFarmer } from '../../farmer';
import { addDays, iso, toDate } from '../../util';
import type { MemberRow, SocietyData } from '../../types/api';

const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function getSocietyData(scope: Scope, asOf: string): Promise<SocietyData> {
  if (!isDate(asOf)) throw new DbError('asOf must be YYYY-MM-DD', 400);
  return withScope(scope, async (tx) => {
    const sid = scope.societyId!;
    const soc = (await tx.query<Record<string, unknown>>('select society_id::text id, code, name, village, member_count from societies where society_id = $1', [sid]))[0];
    if (!soc) throw new DbError('Society not found', 404);
    const program = await R.latestProgram(tx);
    const published = program?.status === 'published';
    const window = { from: iso(addDays(toDate(asOf), -29)), to: asOf };
    const recs = await R.listSocietyMembers(tx, sid, published ? program!.id : null, window);
    // the member whose individual pours are recorded is the one using the farmer app in the demo
    const appUser = (await tx.query<{ id: string }>('select farmer_id::text id from milk_transactions where society_id = $1 group by farmer_id order by count(*) desc limit 1', [sid]))[0]?.id;
    const members: MemberRow[] = recs.map((m) => ({
      id: m.id, code: m.code, name: m.name, mobile: m.mobile, device: (m.device === 'smartphone' ? 'Smartphone' : 'Feature phone (IVR)') as MemberRow['device'], lang: m.lang,
      village: m.village, buffaloes: m.buffaloes, cows: m.cows, litres: m.litres, status: R.memberStatus(m, asOf, published), isDemoFarmer: m.id === appUser,
    })).sort((a, b) => (b.isDemoFarmer ? 1 : 0) - (a.isDemoFarmer ? 1 : 0) || a.code.localeCompare(b.code));
    let preview: SocietyData['preview'] = null;
    if (appUser && program) {
      const sessions = await R.listSessions(tx, appUser, asOf, iso(addDays(toDate(asOf), -95)));
      preview = { memberName: members.find((m) => m.id === appUser)?.name ?? 'Member', worth: worthToFarmer(sessions, asOf, program.rate) };
    }
    return {
      asOf,
      society: { id: String(soc.id), code: String(soc.code), name: String(soc.name), village: String(soc.village ?? ''), members: members.length || Number(soc.member_count ?? 0) },
      collection: await R.societyCollection(tx, sid, asOf),
      monthly: await R.societyMonthly(tx, sid, asOf),
      program, members,
      reach: {
        heard: members.filter((m) => m.status === 'Heard' || m.status === 'Interested').length,
        interested: members.filter((m) => m.status === 'Interested').length,
        app: members.filter((m) => m.device === 'Smartphone').length,
        voice: members.filter((m) => m.device !== 'Smartphone').length,
      },
      preview,
      queries: await R.listQueries(tx),
    };
  });
}

export async function societyAction(scope: Scope, body: Record<string, unknown>) {
  const sid = scope.societyId!;
  return withScope(scope, async (tx) => {
    const log = (action: string, programId?: string) => R.audit(tx, { actor: scope.actor, role: 'secretary', action, societyId: sid, entityType: programId ? 'incentive_program' : undefined, entityId: programId ?? null });
    const program = async () => { const p = await R.latestProgram(tx); if (!p) throw new DbError('No programme for this society', 404); return p; };
    switch (body.action) {
      case 'notes': {
        const p = await program();
        const notes = typeof body.notes === 'object' && body.notes ? body.notes : {};
        await R.updateProgram(tx, p.id, { notes: JSON.stringify(notes) });
        return { ok: true };
      }
      case 'concern': {
        const p = await program();
        const text = String(body.text ?? '').trim().slice(0, 1000);
        if (!text) throw new DbError('Write the concern first', 400);
        await R.updateProgram(tx, p.id, { status: 'concern', concern: text, concern_by: scope.actor });
        await log(`Raised concern: ${text}`, p.id);
        return { ok: true };
      }
      case 'publish': {
        const p = await program();
        if (p.status !== 'approved') throw new DbError('Only an approved target can be published', 409);
        const slot = ['evening', 'morning', 'both'].includes(String(body.sendSlot)) ? String(body.sendSlot) : 'evening';
        const when = isDate(body.asOf) ? body.asOf : new Date().toISOString().slice(0, 10);
        await R.updateProgram(tx, p.id, { status: 'published', send_slot: slot, published_by: scope.actor, published_at: new Date().toISOString(), notes: JSON.stringify(body.notes ?? p.notes ?? {}) });
        // DEMO SIMULATION: other members' responses, from their stored response tendencies.
        // First wave on the day of publishing; a second wave about four weeks later.
        const wave2Heard = iso(addDays(toDate(when), 26)), wave2Int = iso(addDays(toDate(when), 31));
        const rows: [string, string | null, string | null][] = (await R.simulationTraits(tx)).map((t) => {
          const hp = Number(t.heard_p), ip = Number(t.interested_p);
          const interested = ip < 0.18 ? when : ip < 0.27 ? wave2Int : null;
          let heard = hp < 0.68 ? when : hp < 0.86 ? wave2Heard : null;
          if (interested && (!heard || interested < heard)) heard = interested;
          return [t.farmer_id, heard, interested];
        });
        await R.insertSimulatedResponses(tx, p.id, rows);
        const members = (await tx.query<{ n: number }>('select count(*)::int n from farmers where society_id = $1', [sid]))[0]?.n ?? 0;
        await log(`Published summer buffalo premium (₹${p.rate}/kg fat, ${p.from} to ${p.to}) to ${members} members, sending ${slot}`, p.id);
        return { ok: true };
      }
      case 'reply': {
        await R.addMessage(tx, String(body.queryId ?? ''), 'society', String(body.text ?? '').trim().slice(0, 2000) || (() => { throw new DbError('Empty reply', 400); })());
        return { ok: true };
      }
    }
    throw new DbError('Unknown action', 400);
  });
}
