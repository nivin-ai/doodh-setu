// Bank-ready loan application dossier (PDF), built in the browser from the case data the lender
// desk already loads (/api/lender?case=...&dossier=1). Nothing is typed in or invented here:
// every value comes from Amul Setu records, and anything missing or not covered by the farmer's
// consent prints as "Not provided".
//
// Branding: the PDF uses the Amul Setu name in plain type. If an authorised logo or stamp image
// has been provided, put it at public/branding/logo.png and public/branding/stamp.png and it is
// placed in the header and in the authorisation section, keeping its proportions. Without those
// files the authorisation section says that no stamp has been applied.
import type { LenderCase, LoanDossier } from '../types/api';
import { MONTHS } from '../util';

type JsPDF = import('jspdf').jsPDF;
type Cell = string | { content: string; styles?: Record<string, unknown> };

const NP = 'Not provided';
const W = 210, H = 297, M = 16; // A4 in mm, side margin
type RGB = readonly [number, number, number];
const C: Record<'ink' | 'muted' | 'line' | 'brand' | 'brandLight' | 'good' | 'goodLight' | 'bad' | 'badLight' | 'warn', RGB> = {
  ink: [23, 32, 51] as const, muted: [98, 110, 128] as const, line: [214, 222, 232] as const,
  brand: [21, 77, 155] as const, brandLight: [235, 242, 251] as const,
  good: [21, 128, 61] as const, goodLight: [232, 246, 237] as const, bad: [185, 28, 28] as const, badLight: [253, 236, 236] as const,
  warn: [161, 98, 7] as const,
};

export const DECLARATION = [
  'I hereby give my voluntary consent to Amul Setu and the authorised dairy cooperative representatives to collect, compile and share the personal, KYC, banking, dairy production and financial information provided by me for the purpose of facilitating my loan application with the concerned bank.',
  'I confirm that the information provided is accurate to the best of my knowledge. I understand that my information will be shared with the bank for loan assessment and verification purposes. I understand that the final decision regarding loan approval, eligibility, interest rates and disbursement rests entirely with the bank.',
];

const LANG_NAME: Record<string, string> = { en: 'English', hi: 'Hindi', gu: 'Gujarati', mr: 'Marathi', bn: 'Bengali', te: 'Telugu', ta: 'Tamil', kn: 'Kannada', ml: 'Malayalam', or: 'Odia' };
const CATEGORY_NAME: Record<string, string> = { identity_kyc: 'Identity and KYC', land_property: 'Land and property records', credit_history: 'Credit history', milk_income: 'Milk supply and income' };

const rupees = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
const val = (v: string | number | null | undefined) => (v === null || v === undefined || v === '' ? NP : String(v));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dateOnly = (iso: string | null) => {
  if (!iso) return NP;
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
const dateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST' : NP);
const monthName = (key: string) => `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
function yearsBetween(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) y--;
  return y;
}
function durationSince(from: string | null, to: string) {
  if (!from) return NP;
  const months = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / (30.44 * 864e5)));
  const y = Math.floor(months / 12), m = months % 12;
  return [y ? `${y} year${y > 1 ? 's' : ''}` : '', m ? `${m} month${m > 1 ? 's' : ''}` : ''].filter(Boolean).join(' ') || 'Less than a month';
}
// The loan categories the bank asked for, from the product the farmer applied for
export function loanCategory(product: string) {
  if (/cattle|animal|milch/i.test(product)) return 'Cattle purchase';
  if (/feed|fodder|working/i.test(product)) return 'Working capital';
  if (/equipment|machine|chiller/i.test(product)) return 'Dairy equipment';
  if (/shed|construction/i.test(product)) return 'Cattle shed construction';
  return 'Other';
}
export function dossierFileName(c: LenderCase) {
  const name = (c.dossier?.applicant.name ?? c.farmer?.name ?? 'Farmer').replace(/[^A-Za-z0-9]+/g, '') || 'Farmer';
  return `AmulSetu_${name}_LoanApplication_${c.application.ref}.pdf`;
}

// ---------------------------------------------------------------- assets
const b64 = (buf: ArrayBuffer) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
let fonts: Promise<[string, string]> | null = null;
const loadFonts = () => (fonts ??= Promise.all(['/fonts/DejaVuSans-subset.ttf', '/fonts/DejaVuSans-Bold-subset.ttf'].map(async (u) => {
  const r = await fetch(u);
  if (!r.ok) throw new Error('Could not load the PDF font');
  return b64(await r.arrayBuffer());
})) as Promise<[string, string]>).catch((e) => { fonts = null; throw e; });

interface Img { data: string; w: number; h: number }
// Optional authorised branding images; missing files are simply skipped
async function loadImage(url: string): Promise<Img | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const blob = await r.blob();
    const data = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(blob); });
    const size = await new Promise<{ w: number; h: number }>((res, rej) => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = rej; i.src = data; });
    return { data, ...size };
  } catch { return null; }
}
const fit = (img: Img, maxW: number, maxH: number) => { const k = Math.min(maxW / img.w, maxH / img.h); return { w: img.w * k, h: img.h * k }; };

// ---------------------------------------------------------------- document
export async function buildDossierPdf(c: LenderCase): Promise<Blob> {
  const d = c.dossier;
  if (!d) throw new Error('Dossier data is missing');
  const [{ jsPDF }, { default: autoTable }, [regular, bold], logo, stamp] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), loadFonts(), loadImage('/branding/logo.png'), loadImage('/branding/stamp.png'),
  ]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('DejaVuSans.ttf', regular); doc.addFont('DejaVuSans.ttf', 'DejaVu', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', bold); doc.addFont('DejaVuSans-Bold.ttf', 'DejaVu', 'bold');
  doc.setFont('DejaVu', 'normal');
  doc.setProperties({ title: `Loan application ${c.application.ref}`, subject: 'Farmer loan application dossier', creator: 'Amul Setu', author: 'Amul Setu' });

  const a = c.application;
  const consent = c.consent;
  const consentOk = !!consent && consent.status === 'active' && !!consent.grantedAt;
  const generatedAt = new Date().toISOString();
  const TOP = 32, BOTTOM = 22;
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const table = (startY: number, head: string[] | null, body: Cell[][], opts: Record<string, unknown> = {}) => {
    autoTable(doc, {
      startY, head: head ? [head] : undefined, body: body as never, theme: 'grid',
      margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
      styles: { font: 'DejaVu', fontSize: 8.5, cellPadding: { top: 1.25, bottom: 1.25, left: 2, right: 2 }, textColor: C.ink as never, lineColor: C.line as never, lineWidth: 0.2, overflow: 'linebreak', valign: 'middle' },
      headStyles: { font: 'DejaVu', fontStyle: 'bold', fillColor: C.brandLight as never, textColor: C.brand as never },
      didParseCell: (h: { cell: { raw: unknown; styles: { textColor: unknown } }; section: string }) => {
        if (h.section === 'body' && h.cell.raw === NP) h.cell.styles.textColor = [...C.muted];
      },
      ...opts,
    });
    return lastY();
  };
  // label / value / source rows
  const kv = (startY: number, rows: [string, string, string?][]) => table(startY, ['Item', 'Details', 'Source'], rows.map(([k, v, s]) => [k, v, v === NP ? '' : s ?? '']), {
    columnStyles: { 0: { cellWidth: 58, fontStyle: 'bold' }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 32, textColor: [...C.muted], fontSize: 7.5 } },
  });
  const heading = (y: number, text: string, sub?: string) => {
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...C.brand); doc.text(text, M, y);
    if (sub) { doc.setFont('DejaVu', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted); doc.text(doc.splitTextToSize(sub, W - 2 * M), M, y + 4.5); }
    return y + (sub ? 8 : 3);
  };
  const pageTitle = (text: string) => {
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(15); doc.setTextColor(...C.ink); doc.text(text, M, TOP + 4);
    return TOP + 11;
  };
  const room = (y: number, need: number) => { if (y + need > H - BOTTOM) { doc.addPage(); return TOP + 4; } return y; };

  // ---------------- Page 1: summary
  let y = pageTitle('Page 1 · Loan application summary');
  // key facts band
  doc.setFillColor(...C.brandLight); doc.roundedRect(M, y, W - 2 * M, 19, 2, 2, 'F');
  const facts: [string, string][] = [['Application reference', a.ref], ['Application date', dateOnly(d.submittedAt)], ['Amount requested', rupees(a.amount)], ['Loan category', loanCategory(a.product)]];
  facts.forEach(([k, v], i) => {
    const x = M + 4 + i * ((W - 2 * M - 8) / 4);
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted); doc.text(k, x, y + 6.5);
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...C.ink); doc.text(v, x, y + 13.5);
  });
  y += 25;
  y = heading(y, 'Loan request');
  y = kv(y, [
    ['Lender', d.lenderName, 'Application'], ['Loan product', a.product, 'Application'], ['Loan category', loanCategory(a.product), 'Application'],
    ['Purpose of the loan', /cattle/i.test(a.product) ? 'Purchase of milch animals' : a.product, 'Application'],
    ['Amount requested', rupees(a.amount), 'Application'], ['Preferred repayment tenure', `${a.tenure} months`, 'Application'],
    ['Indicative interest rate', `${a.rate}% a year (product rate; final terms set by the bank)`, 'Lender product'],
    ['Repayment frequency', NP], ['Additional remarks', NP],
  ]) + 6;
  y = room(y, 60);
  y = heading(y, 'Applicant');
  const age = d.applicant.dob ? `${yearsBetween(d.applicant.dob, generatedAt)} years` : NP;
  y = kv(y, [
    ['Full name', val(d.applicant.name), 'Member register'], ["Father's / spouse's name", NP],
    ['Date of birth and age', d.applicant.dob ? `${dateOnly(d.applicant.dob)} (${age})` : NP, 'Member register'],
    ['Gender', d.applicant.gender ? cap(d.applicant.gender) : NP, 'Member register'],
    ['Mobile number', val(d.applicant.mobile), d.applicant.mobileVerified ? 'Verified (OTP)' : 'Declared'],
    ['Residential address', d.address ? [d.address.village, d.address.taluka && `Taluka ${d.address.taluka}`].filter(Boolean).join(', ') || NP : NP, 'Member register'],
    ['Village', val(d.address?.village), 'Member register'], ['District', val(d.address?.district), 'Member register'],
    ['State', val(d.address?.state), 'Member register'], ['PIN code', val(d.address?.pincode), 'Member register'],
    ['Photograph', NP],
  ]) + 6;
  y = room(y, 40);
  y = heading(y, 'Cooperative membership');
  kv(y, [
    ['Farmer ID', val(d.applicant.code), 'Society register'],
    ['Cooperative membership ID', d.cooperative.societyCode && d.applicant.code ? `${d.cooperative.societyCode}-${d.applicant.code}` : NP, 'Society register'],
    ['Dairy cooperative society', val(d.cooperative.society), 'Society register'], ['District milk union', val(d.cooperative.union), 'Society register'],
    ['Member since', dateOnly(d.cooperative.memberSince), 'Society register'],
  ]);

  // ---------------- Page 2: KYC and banking
  doc.addPage();
  y = pageTitle('Page 2 · KYC and banking information');
  y = heading(y, 'Identity verification', 'Masked numbers only. Full Aadhaar and PAN numbers are held by the verification provider, never by Amul Setu.');
  const kycRows: Cell[][] = c.kyc && c.kyc.length ? c.kyc.map((k) => [k.type, k.masked, cap(k.status), k.provider]) : [[{ content: c.kyc ? 'No identity documents on record' : 'Not shared: the farmer has not consented to share identity and KYC details with this bank', styles: { textColor: C.muted } }, '', '', '']];
  if (c.kyc && !c.kyc.some((k) => /voter/i.test(k.type))) kycRows.push(['Voter ID / other proof', NP, '', '']);
  y = table(y, ['Document', 'Number (masked)', 'Status', 'Verified by'], kycRows, { columnStyles: { 0: { cellWidth: 44, fontStyle: 'bold' } } }) + 4;
  const kycStatus = !c.kyc ? NP : c.kyc.length && c.kyc.every((k) => k.status === 'verified') ? 'Verified' : c.kyc.length ? 'Partly verified' : 'Not verified';
  y = kv(y, [['Overall KYC status', kycStatus, 'Verification provider']]) + 8;
  y = heading(y, 'Bank account', 'Account details are collected by the bank directly and are not stored in Amul Setu.');
  const bankDoc = a.docs.find((x) => x.id === 'bank');
  kv(y, [
    ['Bank name', NP], ['Branch name', NP], ["Account holder's name", NP], ['Account number (masked)', NP], ['IFSC code', NP],
    ['Bank account verification', NP],
    ['Bank account document', bankDoc ? (bankDoc.status === 'received' ? 'Received with the application' : cap(bankDoc.status)) : NP, 'Application documents'],
  ]);

  // ---------------- Page 3: dairy and agriculture
  doc.addPage();
  y = pageTitle('Page 3 · Dairy and agricultural information');
  const months = c.income ?? [];
  const last6 = months.slice(-6);
  const days = (key: string) => new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5)), 0)).getUTCDate();
  const avgSupplied = last6.length ? last6.reduce((x, m) => x + m.litres, 0) / last6.reduce((x, m) => x + days(m.key), 0) : null;
  y = heading(y, 'Cattle and milk production');
  y = kv(y, [
    ['Buffaloes', d.cattle ? String(d.cattle.buffalo) : NP, 'Society register'], ['Cows', d.cattle ? String(d.cattle.cow) : NP, 'Society register'],
    ['Type of cattle', d.cattle ? [d.cattle.buffalo ? 'Buffalo' : '', d.cattle.cow ? 'Cow' : ''].filter(Boolean).join(' and ') || NP : NP, 'Society register'],
    ['Average daily milk production', d.cattle ? `${d.cattle.estimatedDailyYield} litres (estimate)` : NP, 'Society estimate'],
    ['Average daily milk supplied to the society', avgSupplied !== null ? `${avgSupplied.toFixed(1)} litres (last ${last6.length} months)` : NP, 'Collection records'],
    ['Association with the cooperative', durationSince(d.cooperative.memberSince, generatedAt), 'Society register'],
  ]) + 8;
  y = heading(y, 'Land ownership');
  const p = c.property;
  kv(y, p ? [
    ['Ownership', p.ownership, cap(p.status)], ['Survey number', p.survey, cap(p.status)], ['Location', `${p.village}, ${p.district}, ${p.state}`, cap(p.status)],
    ['Area', `${p.area} ${p.unit}`, cap(p.status)], ['Land use', p.use, cap(p.status)], ['Record', p.record || NP, cap(p.status)],
  ] : [['Land records', c.consent ? NP : 'Not shared: no consent for land records']]);

  // ---------------- Page 4: financial information
  doc.addPage();
  y = pageTitle('Page 4 · Financial information');
  const avgIncome = last6.length ? last6.reduce((x, m) => x + m.total, 0) / last6.length : null;
  y = heading(y, 'Milk income', 'Net payments for milk poured at the society, from the society\'s collection and payment records.');
  y = kv(y, [
    ['Average monthly milk income', avgIncome !== null ? `${rupees(avgIncome)} (last ${last6.length} months)` : NP, 'Collection records'],
    ['Months of records', months.length ? `${months.length} (${monthName(months[0].key)} to ${monthName(months[months.length - 1].key)})` : NP, 'Collection records'],
  ]) + 5;
  if (months.length) {
    y = table(y, ['Month', 'Milk supplied (litres)', 'Average per day (litres)', 'Payment received'],
      [...months.map((m) => [monthName(m.key), m.litres.toLocaleString('en-IN'), (m.litres / days(m.key)).toFixed(1), rupees(m.total)]),
        [{ content: 'Total', styles: { fontStyle: 'bold' } }, { content: months.reduce((x, m) => x + m.litres, 0).toLocaleString('en-IN'), styles: { fontStyle: 'bold' } }, '', { content: rupees(months.reduce((x, m) => x + m.total, 0)), styles: { fontStyle: 'bold' } }]],
      { columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } }) + 5;
    // bar chart of monthly payments
    y = room(y, 40);
    const chartH = 24, chartW = W - 2 * M, max = Math.max(...months.map((m) => m.total));
    const bw = chartW / months.length;
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(9); doc.setTextColor(...C.ink); doc.text('Monthly milk payments', M, y + 3);
    const base = y + 8 + chartH;
    months.forEach((m, i) => {
      const h = max ? (m.total / max) * chartH : 0;
      doc.setFillColor(...C.brand); doc.rect(M + i * bw + bw * 0.18, base - h, bw * 0.64, h, 'F');
      doc.setFont('DejaVu', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...C.muted);
      doc.text(MONTHS[Number(m.key.slice(5)) - 1], M + i * bw + bw / 2, base + 4, { align: 'center' });
    });
    doc.setDrawColor(...C.line); doc.line(M, base, W - M, base);
    y = base + 10;
  } else {
    doc.setFontSize(9); doc.setTextColor(...C.muted); doc.text(c.consent ? 'No milk supply records in this period.' : 'Not shared: no consent for milk income records.', M, y + 2); y += 8;
  }
  y = room(y, 45);
  y = heading(y, 'Liabilities and other income');
  const cr = c.credit;
  kv(y, [
    ['Existing loans', cr ? String(cr.loans) : NP, cr ? `${cr.bureau}${cr.mock ? ' (demo report)' : ''}` : ''],
    ['Total outstanding', cr ? rupees(cr.outstanding) : NP, cr ? `${cr.bureau}${cr.mock ? ' (demo report)' : ''}` : ''],
    ['Credit score', cr ? String(cr.score) : NP, cr ? `${cr.bureau}${cr.mock ? ' (demo report)' : ''}` : ''],
    ['Existing EMI commitments', NP], ['Other sources of income', NP],
  ]);

  // ---------------- Page 5: declaration and consent
  doc.addPage();
  y = pageTitle('Page 5 · Farmer declaration and consent');
  y = heading(y, 'Declaration');
  doc.setFont('DejaVu', 'normal'); doc.setFontSize(9); doc.setTextColor(...C.ink);
  for (const para of DECLARATION) { const lines = doc.splitTextToSize(para, W - 2 * M); doc.text(lines, M, y + 1, { lineHeightFactor: 1.4 }); y += lines.length * 4.45 + 2.5; }
  y += 2;
  // consent box: shows the consent recorded when the farmer applied; no new consent is taken here
  const boxH = 24;
  doc.setFillColor(...(consentOk ? C.goodLight : C.badLight)); doc.setDrawColor(...(consentOk ? C.good : C.bad));
  doc.roundedRect(M, y, W - 2 * M, boxH, 2, 2, 'FD');
  doc.setDrawColor(...C.ink); doc.setLineWidth(0.5); doc.rect(M + 5, y + 5, 7, 7);
  if (consentOk) {
    doc.setDrawColor(...C.good); doc.setLineWidth(1.1); doc.line(M + 6.3, y + 8.8, M + 8.2, y + 10.8); doc.line(M + 8.2, y + 10.8, M + 11.2, y + 6.2);
  }
  doc.setLineWidth(0.2);
  doc.setFont('DejaVu', 'bold'); doc.setFontSize(13); doc.setTextColor(...(consentOk ? C.good : C.bad));
  doc.text(consentOk ? 'CONSENT OBTAINED' : consent ? 'CONSENT WITHDRAWN: DO NOT SHARE' : 'CONSENT RECORD MISSING: FLAGGED FOR ADMINISTRATOR REVIEW', M + 16, y + 10.5);
  doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.ink);
  const note = consentOk
    ? `Consent was given by the farmer in the Amul Setu app when applying (${consent.method === 'assisted' ? 'assisted' : 'digital'}, ${LANG_NAME[consent.language ?? ''] ?? 'language not recorded'}). This document displays that record; it does not collect a new consent.`
    : consent ? `The farmer withdrew this consent${consent.withdrawnAt ? ` on ${dateTime(consent.withdrawnAt)}` : ''}. The information in this document must not be shared further.`
    : 'No valid consent record is linked to this application. Do not share this document with any third party until an administrator has reviewed it.';
  doc.setFontSize(8); doc.text(doc.splitTextToSize(note, W - 2 * M - 22), M + 16, y + 16);
  y += boxH + 4;
  y = kv(y, [
    ["Farmer's full name", val(d.applicant.name), 'Member register'], ['Farmer ID', val(d.applicant.code), 'Society register'],
    ['Loan application reference', a.ref, 'Application'],
    ['Consent given on', consent ? dateTime(consent.grantedAt) : NP, 'Consent record'],
    ['Consent record ID', consent ? consent.code : NP, 'Consent record'],
    ['Consent status', consentOk ? 'CONSENT OBTAINED' : consent ? 'Withdrawn' : 'Missing, flagged for review', 'Consent record'],
    ['Notice version', consent?.noticeVersion ?? NP, 'Consent record'],
    ['Data covered', consent ? consent.categories.map((x) => CATEGORY_NAME[x] ?? x).join(', ') : NP, 'Consent record'],
    ['Shared with', consent ? consent.recipient : NP, 'Consent record'],
  ]) + 4;
  if (d.consentStatements && consent) {
    y = room(y, 40);
    y = heading(y, 'Statements the farmer confirmed in the app', `As recorded with notice ${consent.noticeVersion}${consent.statements ? `, ${consent.statements} of 3 boxes ticked` : ''}${consent.language && consent.language !== 'en' ? `. Shown in English; the farmer read them in ${LANG_NAME[consent.language] ?? consent.language}` : ''}.`);
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.ink);
    for (const st of d.consentStatements) {
      const lines = doc.splitTextToSize(st, W - 2 * M - 8);
      y = room(y, lines.length * 3.8 + 3);
      doc.text(consentOk ? '✓' : '·', M + 1, y + 1);
      doc.text(lines, M + 7, y + 1, { lineHeightFactor: 1.35 }); y += lines.length * 3.8 + 1.8;
    }
    y += 3;
  }
  // authorisation section
  y = room(y, 30);
  y = heading(y, 'Cooperative authorisation');
  doc.setDrawColor(...C.line); doc.setLineDashPattern([1.5, 1.2], 0); doc.roundedRect(M, y, W - 2 * M, 22, 2, 2, 'S'); doc.setLineDashPattern([], 0);
  if (stamp) {
    const s = fit(stamp, 40, 19); doc.addImage(stamp.data, M + 4, y + 1.5, s.w, s.h);
  }
  doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.muted);
  doc.text(doc.splitTextToSize(stamp
    ? 'Authorised stamp applied by the cooperative. The stamp confirms that this document was compiled from the society\'s records. It is not a guarantee of the loan or of the applicant\'s creditworthiness.'
    : 'No cooperative stamp has been applied. This document was generated by Amul Setu from platform records and has not yet been verified by an authorised cooperative officer.', W - 2 * M - (stamp ? 56 : 10)), M + (stamp ? 50 : 5), y + 7);

  // ---------------- header and footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    let x = M;
    if (logo) { const s = fit(logo, 30, 14); doc.addImage(logo.data, M, 9, s.w, s.h); x = M + s.w + 4; }
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(15); doc.setTextColor(...C.brand); doc.text('Amul Setu', x, 15);
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...C.muted); doc.text('Farmer loan application dossier', x, 20);
    doc.setFontSize(8); doc.text(`Ref ${a.ref}`, W - M, 13, { align: 'right' }); doc.text(`Generated ${dateTime(generatedAt)}`, W - M, 17.5, { align: 'right' });
    doc.setFont('DejaVu', 'bold'); doc.setTextColor(...C.warn); doc.text('PROTOTYPE · SYNTHETIC DEMO DATA', W - M, 22, { align: 'right' });
    doc.setDrawColor(...C.brand); doc.setLineWidth(0.6); doc.line(M, 26, W - M, 26); doc.setLineWidth(0.2);
    doc.setDrawColor(...C.line); doc.line(M, H - 19, W - M, H - 19);
    doc.setFont('DejaVu', 'normal'); doc.setFontSize(7); doc.setTextColor(...C.muted);
    doc.text(doc.splitTextToSize('Generated by Amul Setu from records held on the platform. Not an officially verified cooperative document. Amul and the cooperative do not guarantee this loan or the applicant\'s creditworthiness; the decision rests with the bank. Confidential: shared under the farmer\'s consent for loan assessment only.', W - 2 * M - 22), M, H - 15);
    doc.setFont('DejaVu', 'bold'); doc.setFontSize(8); doc.text(`Page ${i} of ${total}`, W - M, H - 15, { align: 'right' });
  }
  return doc.output('blob');
}

export type { LoanDossier };
