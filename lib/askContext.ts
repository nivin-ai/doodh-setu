// Builds the facts the AI assistant may use: the farmer's own records plus approved content (BR-26).
import { BASE_RATE, SNF_BONUS_PER_POINT, dayTotals, explainChange, monthKeysUpTo, monthSummary, type MonthSummary, type Premium } from './farmer';
import { FARMER } from './demo';

const r0 = (n: number) => Math.round(n).toLocaleString('en-IN');
const monthName = (k: string) => new Date(k + '-01T00:00:00Z').toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function line(m: MonthSummary) {
  return `${monthName(m.key)} (${m.days} days): ${r0(m.litres)} litres, avg fat ${m.avgFat.toFixed(1)}%, buffalo SNF ${m.avgSnfBuffalo.toFixed(2)}%, base Rs ${r0(m.base)} + SNF bonus Rs ${r0(m.snf)} + premium Rs ${r0(m.premium)} = total Rs ${r0(m.total)}`;
}

export function buildContext(today: string, premium: Premium | null): string {
  const monthEnd = today.endsWith('-30') || today.endsWith('-31');
  const keys = monthKeysUpTo(today, 4);
  const months = keys.map((k) => monthSummary(k, premium, today));
  const current = months[3];
  const complete = monthEnd ? months.slice(1) : months.slice(0, 3);
  const last = complete[complete.length - 1], before = complete[complete.length - 2];
  const reasons = explainChange(before, last).map((r) => `${r.key === 'volume' ? 'milk quantity' : r.key === 'snf' ? 'SNF quality bonus' : 'buffalo milk premium'} ${r.amount >= 0 ? '+' : '-'}Rs ${r0(Math.abs(r.amount))}`);
  const d = dayTotals(today, premium);
  return [
    `TODAY: ${today}`,
    `FARMER: ${FARMER.name}, member ${FARMER.memberId} of ${FARMER.society}, ${FARMER.village}. Animals: ${FARMER.animals.buffalo} buffaloes, ${FARMER.animals.cow} cow.`,
    '',
    'TODAY\'S COLLECTION:',
    `Morning ${d.am.toFixed(1)} litres, evening ${d.pm.toFixed(1)} litres. Buffalo fat ${d.fat.toFixed(1)}%, buffalo SNF ${d.snf.toFixed(1)}%. Today's amount Rs ${r0(d.amount)}.`,
    '',
    'PAYMENT RULES (society rate card):',
    `Payment = kg fat x (base rate Rs ${BASE_RATE} per kg fat + SNF bonus + any premium).`,
    `SNF bonus: Rs ${SNF_BONUS_PER_POINT} per kg fat for every 0.1% SNF above 8.5%.`,
    premium ? `Active premium: buffalo milk earns Rs ${premium.rate} extra per kg fat from ${premium.from} to ${premium.to}. Details in the Signals tab.` : 'No premium is active right now.',
    '',
    'MONTHLY RECORDS:',
    ...complete.map(line),
    monthEnd ? '' : `${monthName(current.key)} so far: ${line(current).split(': ').slice(1).join(': ')}`,
    `Change from ${monthName(before.key)} to ${monthName(last.key)}: total ${last.total >= before.total ? 'up' : 'down'} Rs ${r0(Math.abs(last.total - before.total))}. Reasons: ${reasons.join('; ') || 'none'}.`,
    '',
    'APPROVED ADVICE (veterinarian-approved, from the society):',
    '- SNF means milk solids other than fat, such as protein and lactose. ',
    '- Summer milk: give green fodder or silage every day; clean water 3-4 times a day; keep animals in shade at midday; ask the society about mineral mixture.',
    '- Sick animal, fever, not eating, or a sharp drop in milk: call the society vet. Do not give medicine without the vet.',
    '- Loans: information is in the Finance tab, where the farmer can check if an EMI is affordable. The bank always makes the decision. The app never asks for OTP, PIN or bank passwords.',
    '- Wrong entry in the records: use "Request a correction" in Profile, or talk to the society.',
  ].filter((x) => x !== undefined).join('\n');
}
