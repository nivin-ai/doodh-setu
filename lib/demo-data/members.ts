// SYNTHETIC demo data generator: the member register of the demo society. Names and phone
// numbers are made up.
import { mulberry32, gauss } from '../util';
import type { Lang } from '../i18n';

export interface GenMember {
  id: string; name: string; mobile: string; device: 'Smartphone' | 'Feature phone (IVR)'; lang: Lang;
  village: string; buffaloes: number; cows: number; litres: number; heardP: number; interestedP: number;
}

const HAMLETS = ['Bakrol', 'Bakrol', 'Bakrol', 'Vadod', 'Gamdi', 'Jitodia', 'Lambhvel'];
const fmt = (n: number) => `+91 ${String(n).slice(0, 5)} ${String(n).slice(5)}`;

export const GEN_MEMBERS: GenMember[] = (() => {
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

