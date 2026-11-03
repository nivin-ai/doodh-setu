// SYNTHETIC demo data: quick-commerce dark-store zones in Mumbai and Ahmedabad.
import { mulberry32 } from '../util';
import type { City } from '../demand';
import type { Zone } from '../geo';

// aff = affluence / premium-product propensity (0-1); inland = how much hotter it gets than the city reading (0-1)
const RAW: [City, string, number, number, number, number][] = [
  ['Mumbai', 'Colaba', 18.906, 72.815, 0.9, 0.0], ['Mumbai', 'Fort and Churchgate', 18.933, 72.832, 0.8, 0.0],
  ['Mumbai', 'Marine Lines', 18.945, 72.823, 0.75, 0.0], ['Mumbai', 'Byculla', 18.979, 72.833, 0.35, 0.2],
  ['Mumbai', 'Lower Parel', 18.995, 72.830, 0.8, 0.15], ['Mumbai', 'Worli', 19.017, 72.817, 0.9, 0.0],
  ['Mumbai', 'Dadar', 19.018, 72.844, 0.6, 0.2], ['Mumbai', 'Wadala', 19.017, 72.865, 0.45, 0.35],
  ['Mumbai', 'Matunga', 19.027, 72.855, 0.6, 0.25], ['Mumbai', 'Sion', 19.043, 72.862, 0.45, 0.35],
  ['Mumbai', 'Bandra West', 19.060, 72.836, 0.95, 0.05], ['Mumbai', 'Khar', 19.072, 72.836, 0.85, 0.1],
  ['Mumbai', 'Santacruz', 19.081, 72.841, 0.7, 0.2], ['Mumbai', 'Vile Parle', 19.100, 72.844, 0.65, 0.25],
  ['Mumbai', 'Kurla', 19.072, 72.880, 0.3, 0.5], ['Mumbai', 'Chembur', 19.062, 72.900, 0.6, 0.55],
  ['Mumbai', 'Ghatkopar', 19.086, 72.908, 0.55, 0.6], ['Mumbai', 'Andheri West', 19.136, 72.830, 0.8, 0.2],
  ['Mumbai', 'Andheri East', 19.115, 72.870, 0.55, 0.45], ['Mumbai', 'Jogeshwari', 19.137, 72.849, 0.4, 0.4],
  ['Mumbai', 'Powai', 19.118, 72.906, 0.85, 0.75], ['Mumbai', 'Vikhroli', 19.111, 72.927, 0.4, 0.75],
  ['Mumbai', 'Bhandup', 19.144, 72.938, 0.35, 0.8], ['Mumbai', 'Mulund', 19.172, 72.956, 0.55, 0.9],
  ['Mumbai', 'Goregaon', 19.164, 72.849, 0.6, 0.45], ['Mumbai', 'Malad', 19.187, 72.849, 0.5, 0.5],
  ['Mumbai', 'Kandivali', 19.205, 72.852, 0.5, 0.55], ['Mumbai', 'Borivali', 19.230, 72.857, 0.55, 0.6],
  ['Ahmedabad', 'Navrangpura', 23.037, 72.556, 0.75, 0.5], ['Ahmedabad', 'Naranpura', 23.057, 72.556, 0.6, 0.55],
  ['Ahmedabad', 'Vastrapur', 23.039, 72.529, 0.85, 0.5], ['Ahmedabad', 'Bodakdev', 23.039, 72.507, 0.9, 0.55],
  ['Ahmedabad', 'Thaltej', 23.050, 72.506, 0.85, 0.6], ['Ahmedabad', 'Satellite', 23.026, 72.512, 0.85, 0.55],
  ['Ahmedabad', 'Prahlad Nagar', 23.012, 72.505, 0.9, 0.6], ['Ahmedabad', 'Bopal', 23.031, 72.465, 0.7, 0.8],
  ['Ahmedabad', 'Science City', 23.081, 72.494, 0.75, 0.8], ['Ahmedabad', 'Gota', 23.104, 72.545, 0.55, 0.85],
  ['Ahmedabad', 'Chandkheda', 23.109, 72.585, 0.5, 0.85], ['Ahmedabad', 'Sabarmati', 23.083, 72.587, 0.45, 0.7],
  ['Ahmedabad', 'Paldi', 23.010, 72.563, 0.65, 0.55], ['Ahmedabad', 'Vasna', 23.000, 72.548, 0.45, 0.65],
  ['Ahmedabad', 'Old City', 23.026, 72.596, 0.3, 0.7], ['Ahmedabad', 'Maninagar', 22.996, 72.603, 0.5, 0.7],
  ['Ahmedabad', 'Isanpur', 22.976, 72.601, 0.3, 0.8], ['Ahmedabad', 'Bapunagar', 23.034, 72.632, 0.3, 0.85],
  ['Ahmedabad', 'Nikol', 23.044, 72.669, 0.4, 0.95], ['Ahmedabad', 'Naroda', 23.069, 72.660, 0.35, 0.95],
  ['Ahmedabad', 'Vastral', 23.005, 72.661, 0.35, 1.0],
];

export const GEN_ZONES: Zone[] = (() => {
  const r = mulberry32(412);
  const zs = RAW.map(([city, name, lat, lng, aff, inland], i) => ({ id: `${city[0]}${i}`, name, city, lat, lng, aff, inland, weight: 0.6 + 0.8 * r(), qShare: 0 }));
  for (const c of ['Mumbai', 'Ahmedabad'] as City[]) {
    const own = zs.filter((z) => z.city === c);
    const sum = own.reduce((a, z) => a + z.weight, 0);
    own.forEach((z) => { z.weight /= sum; z.qShare = 0.13 * (0.45 + 1.1 * z.aff); });
  }
  return zs;
})();

