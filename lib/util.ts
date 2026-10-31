export const DAY = 86400000;

export function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number) {
  let u = 0, v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const toDate = (s: string) => new Date(s + 'T00:00:00Z');
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY);
export const monthKey = (s: string) => s.slice(0, 7);

export function inr(n: number, dp = 0) {
  const sign = n < 0 ? '-' : '';
  return sign + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

export function inrShort(n: number) {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${(n / 1e7).toFixed(1)} crore`;
  if (a >= 1e5) return `₹${(n / 1e5).toFixed(1)} lakh`;
  return inr(n);
}

export function num(n: number, dp = 0) {
  return n.toLocaleString('en-IN', { maximumFractionDigits: dp, minimumFractionDigits: dp });
}

export function pct(n: number, dp = 0) {
  return `${(n * 100).toFixed(dp)}%`;
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function fmtDate(s: string) {
  const d = toDate(s);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMonth(key: string) {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function mean(a: number[]) {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

export function sd(a: number[]) {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
}

export function interp(monthly: number[], date: Date) {
  // monthly values are mid-month normals; linear interpolation by day of year
  const doy = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY;
  const pos = doy / 30.44 - 0.5;
  const i = Math.floor(pos);
  const f = pos - i;
  const a = monthly[((i % 12) + 12) % 12];
  const b = monthly[(((i + 1) % 12) + 12) % 12];
  return a + (b - a) * f;
}
