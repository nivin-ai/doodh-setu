// Rule-based assistant: answers only from approved content and the farmer's own records (BR-26).
import type { Lang } from './i18n';
import { PHRASES, type Intent } from './phrases';
import { dayTotals, explainChange, monthSummary, type Premium } from './farmer';
import { inr } from './util';

export type { Intent };
const ORDER: Exclude<Intent, 'unknown'>[] = ['snf', 'loan', 'premium', 'increase', 'price', 'earn', 'today'];

// Keywords from every language, so a question typed in any script is understood
export function detectIntent(q: string): Intent {
  const s = q.toLowerCase();
  for (const i of ORDER) if (Object.values(PHRASES).some((p) => p.kw[i].some((k) => s.includes(k.toLowerCase())))) return i;
  return 'unknown';
}

const prevKey = (k: string) => {
  const [y, m] = k.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
};

export function answer(q: string, lang: Lang, today: string, premium: Premium | null): { intent: Intent; text: string; bullets?: string[] } {
  const intent = detectIntent(q);
  const P = PHRASES[lang] ?? PHRASES.en;
  const curKey = today.endsWith('-30') || today.endsWith('-31') ? today.slice(0, 7) : prevKey(today.slice(0, 7));
  switch (intent) {
    case 'snf':
      return { intent, text: P.snf };
    case 'price': {
      const cur = monthSummary(curKey, premium, today), prev = monthSummary(prevKey(curKey), premium, today);
      const diff = cur.total - prev.total;
      const rs = explainChange(prev, cur);
      const name = (k: string) => (k === 'premium' ? P.reason.premium : k === 'snf' ? P.reason.snf : P.reason.volume);
      return { intent, text: P.price(inr(Math.abs(diff)), diff >= 0), bullets: rs.map((r) => `${r.amount >= 0 ? '+' : '-'}${inr(Math.abs(r.amount))}: ${name(r.key)}`) };
    }
    case 'earn': {
      const cur = monthSummary(today.slice(0, 7), premium, today);
      return { intent, text: P.earn(Math.round(cur.litres), inr(cur.total)) };
    }
    case 'today': {
      const d = dayTotals(today, premium);
      return { intent, text: P.milk(d.am.toFixed(1), d.pm.toFixed(1), d.fat.toFixed(1), d.snf.toFixed(1), d.amount) };
    }
    case 'increase':
      return { intent, text: P.increase, bullets: P.tips };
    case 'premium':
      return { intent, text: premium ? P.premiumOn(premium.rate) : P.premiumOff };
    case 'loan':
      return { intent, text: P.loan };
    default:
      return { intent, text: P.unknown };
  }
}
