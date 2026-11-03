// SYNTHETIC demo data generator: the 120 village societies of the demo union.
import { mulberry32, gauss } from '../util';
export type SizeGroup = 'small' | 'medium' | 'large';
export interface GenSociety { id: number; name: string; members: number; buffaloLitres: number; size: SizeGroup; region: 'North' | 'Central' | 'South' }

const NAMES = ['Anand', 'Bakrol', 'Vallabh Vidyanagar', 'Karamsad', 'Bhalej', 'Ode', 'Umreth', 'Borsad', 'Petlad', 'Sojitra', 'Tarapur', 'Khambhat', 'Nadiad', 'Kapadvanj', 'Mahudha', 'Thasra', 'Matar', 'Kheda', 'Mehmedabad', 'Vaso'];
export function generateSocieties(): GenSociety[] {
  const r = mulberry32(86);
  const out: GenSociety[] = [];
  for (let i = 0; i < 120; i++) {
    const members = Math.round(Math.max(60, Math.exp(5.6 + gauss(r) * 0.55)));
    const size: SizeGroup = members < 200 ? 'small' : members <= 500 ? 'medium' : 'large';
    const perMember = 6 + r() * 3 + (size === 'large' ? 2 : 0);
    out.push({
      id: i + 1,
      name: i === 0 ? 'Anand Milk Society' : `${NAMES[i % NAMES.length]} Milk Society ${Math.floor(i / NAMES.length) + 1}`,
      members, size, buffaloLitres: Math.round(members * perMember),
      region: (['North', 'Central', 'South'] as const)[i % 3],
    });
  }
  out[0].members = 412; out[0].size = 'medium';
  return out;
}
