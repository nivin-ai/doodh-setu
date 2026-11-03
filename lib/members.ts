import { mulberry32, gauss } from './util';
import { FARMER } from './demo';
import type { Lang } from './i18n';

// Member register of the demo society (synthetic). In the real system this comes from the
// society's member master in AMCS. Phone numbers are made up for the demo.
export interface Member {
  id: string; name: string; mobile: string; device: 'Smartphone' | 'Feature phone (IVR)'; lang: Lang;
  village: string; buffaloes: number; cows: number; litres: number;
  heardP: number; interestedP: number; // demo response draws
}

const HAMLETS = ['Bakrol', 'Bakrol', 'Bakrol', 'Vadod', 'Gamdi', 'Jitodia', 'Lambhvel'];
const fmt = (n: number) => `+91 ${String(n).slice(0, 5)} ${String(n).slice(5)}`;

export const MEMBERS: Member[] = (() => {
  const r = mulberry32(7); // same draws as before, so names and response rates stay the same
  const c = mulberry32(31); // contact and herd details
  const first = ['Ramila', 'Jashodaben', 'Kantibhai', 'Hansaben', 'Manubhai', 'Bhartiben', 'Dahyabhai', 'Kokilaben', 'Pravinbhai', 'Sharda', 'Ishwarbhai', 'Mina', 'Rekha', 'Bhikhabhai', 'Geeta'];
  const last = ['Patel', 'Parmar', 'Solanki', 'Chauhan', 'Thakor', 'Rathod', 'Makwana', 'Vaghela'];
  return Array.from({ length: 411 }, (_, i) => {
    const feature = r() < 0.28;
    const name = `${first[Math.floor(r() * first.length)]} ${last[Math.floor(r() * last.length)]}`;
    const lang = (r() < 0.85 ? 'gu' : r() < 0.8 ? 'hi' : 'en') as Lang;
    const litres = Math.max(3, 12 + gauss(r) * 5);
    const heardP = r(), interestedP = r();
    const buffaloes = Math.max(0, Math.round(litres / 6 + (c() - 0.5) * 1.5));
    const cows = Math.max(0, Math.round(c() * 2.4 - 0.4));
    const mobile = fmt(9_000_000_000 + Math.floor(c() * 999_999_999));
    return { id: String(i + 1).padStart(4, '0'), name, mobile, device: feature ? 'Feature phone (IVR)' : 'Smartphone', lang, village: HAMLETS[Math.floor(c() * HAMLETS.length)], buffaloes, cows, litres, heardP, interestedP };
  });
})();

export const DEMO_FARMER_MOBILE = FARMER.phone;
export const TOTAL_MEMBERS = MEMBERS.length + 1;

export type SignalStatus = '-' | 'Interested' | 'Heard' | 'Not heard';
export interface MemberRow extends Omit<Member, 'heardP' | 'interestedP'> { status: SignalStatus; isDemoFarmer?: boolean }

// Everyone in the register with their response to the current signal (demo farmer first).
export function memberRows(o: { published: boolean; apr: boolean; lang: Lang; heard: boolean; interested: boolean }): MemberRow[] {
  const st = (hp: number, ip: number): SignalStatus => !o.published ? '-' : ip < (o.apr ? 0.27 : 0.18) ? 'Interested' : hp < (o.apr ? 0.86 : 0.68) ? 'Heard' : 'Not heard';
  const me: MemberRow = {
    id: FARMER.memberId, name: FARMER.name, mobile: DEMO_FARMER_MOBILE, device: 'Smartphone', lang: o.lang, village: FARMER.village.split(',')[0],
    buffaloes: FARMER.animals.buffalo, cows: FARMER.animals.cow, litres: 16, isDemoFarmer: true,
    status: !o.published ? '-' : o.interested ? 'Interested' : o.heard ? 'Heard' : 'Not heard',
  };
  return [me, ...MEMBERS.map(({ heardP, interestedP, ...m }) => ({ ...m, status: st(heardP, interestedP) }))];
}
