'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';
import { fmtDate, fmtMonth, inr, MONTHS } from '@/lib/util';
import { postJson, useResource } from '@/lib/client/api';
import type { AppStatus, LenderCase, LenderData } from '@/lib/types/api';
import { CHART, Chip, ConsoleShell, Note, PageTitle, Stat } from './ui';
import { IconBack, IconCheck, IconChevron, IconSend } from './icons';
import { buildDossierPdf, dossierFileName } from '@/lib/client/dossierPdf';
import { ErrorState, Loading } from './DataState';

const TONE: Record<AppStatus, 'primary' | 'good' | 'warn' | 'bad' | 'neutral'> = { submitted: 'primary', in_review: 'primary', more_info: 'warn', approved: 'good', declined: 'bad', withdrawn: 'neutral' };
const LABEL: Record<AppStatus, string> = { submitted: 'Application received', in_review: 'Under bank review', more_info: 'More information needed', approved: 'Approved', declined: 'Rejected', withdrawn: 'Withdrawn' };

// Lender data comes from the database (/api/lender): only this lender's applications, and farmer
// data only for the categories the farmer consented to share. Opening a case is logged.
export default function LenderApp() {
  const [view, setView] = useState('cases');
  const [open, setOpen] = useState<string | null>(null);
  const r = useResource<LenderData>('/api/lender', { poll: 6000 });
  const d = r.data;
  const newCount = d ? d.cases.filter((c) => !c.background && c.status === 'submitted').length : 0;
  const menu = [{ id: 'cases', label: 'Cases', badge: newCount }, { id: 'products', label: 'Products' }, { id: 'audit', label: 'Audit trail' }];
  return (
    <ConsoleShell title="DairyFin PartnerDesk" place={d?.lender.name} menu={menu} active={view} onSelect={(v) => { setView(v); setOpen(null); }}>
      {!d ? (r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Loading cases..." />)
        : view === 'cases' ? (open ? <CaseDetail id={open} back={() => setOpen(null)} /> : <Cases d={d} onOpen={setOpen} />) : view === 'products' ? <Products d={d} /> : <Audit d={d} />}
    </ConsoleShell>
  );
}

function Cases({ d, onOpen }: { d: LenderData; onOpen: (r: string) => void }) {
  const rows = d.cases;
  return (
    <div>
      <PageTitle title="Case queue" sub="Only applications routed to this bank. Every case opened is logged." />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Stat label="Applications" value={rows.length} /><Stat label="Awaiting documents" value={rows.filter((r) => r.status === 'more_info').length} /><Stat label="In review" value={rows.filter((r) => r.status === 'in_review').length} />
      </div>
      <div className="card overflow-x-auto">
      <table className="tbl w-full min-w-[860px]">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Applied</th><th>Consent</th><th>Loan PDF</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="group cursor-pointer hover:bg-primary-light" onClick={() => onOpen(r.id)}>
            <td className="whitespace-nowrap font-bold text-primary">{r.ref}</td><td>{r.farmer}</td><td>{r.product}</td><td className="num whitespace-nowrap">{inr(r.amount)}</td>
            <td className="whitespace-nowrap">{r.submitted ? fmtDate(r.submitted.slice(0, 10)) : '-'}</td>
            <td><Chip tone={r.consent === 'active' ? 'good' : 'bad'}>{r.consent === 'active' ? 'Obtained' : r.consent === 'withdrawn' ? 'Withdrawn' : 'Missing'}</Chip></td>
            <td>{r.dossierGenerated ? <Chip tone="good">Generated</Chip> : <Chip>Ready</Chip>}</td>
            <td><Chip tone={TONE[r.status]}>{r.status === 'submitted' && r.dossierGenerated ? 'PDF generated' : LABEL[r.status]}</Chip></td>
            <td className="whitespace-nowrap">{fmtDate(r.updated.slice(0, 10))}<IconChevron size={16} className="ml-2 inline text-primary opacity-0 transition-opacity group-hover:opacity-100" /></td></tr>
        ))}</tbody>
      </table>
      </div>
    </div>
  );
}

function CaseDetail({ id, back }: { id: string; back: () => void }) {
  const s = useStore();
  const today = DEMO_DATES[s.demoDate].date;
  const r = useResource<LenderCase>(`/api/lender?case=${id}&asOf=${today}&dossier=1`, { poll: 6000 });
  const [note, setNote] = useState('');
  const [next, setNext] = useState<AppStatus>('in_review');
  const [err, setErr] = useState('');
  const backBtn = <button className="mb-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline" onClick={back}><IconBack size={16} />All cases</button>;
  if (!r.data) return <div>{backBtn}{r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Opening case..." />}</div>;
  const { application: a, consent, kyc, property, credit, income, farmer, background } = r.data;
  const act = async (action: string, body: Record<string, unknown>) => {
    setErr('');
    try { await postJson('/api/lender', { action, id, ...body }); await r.refresh(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  if (background) {
    return <div>{backBtn}<PageTitle title={`Case ${a.ref}`} chip={<Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>} sub={farmer ? `Member ${farmer.code}, ${farmer.society}. ${a.product}, ${inr(a.amount)}.` : undefined} /><div className="rounded-sheet border border-dashed border-line p-8 text-muted">Background demo case. Open the farmer&apos;s case to try the full flow.</div><DossierCard c={r.data} /></div>;
  }
  const active = consent?.status === 'active';
  const months = income ?? [];
  const avg = months.length ? Math.round(months.slice(-6).reduce((x, m) => x + m.total, 0) / Math.min(6, months.length)) : 0;
  const lowest = months.reduce((x, m) => (m.total < x.total ? m : x), months[0] ?? { key: '', total: 0, litres: 0 });
  const data = months.map((m) => ({ m: MONTHS[Number(m.key.slice(5)) - 1], v: m.total, low: m.key === lowest.key }));
  const docName = { id: 'Identity proof', bank: 'Bank account details', quote: 'Cattle purchase quote', kyc: 'KYC verification result (Aadhaar, PAN)', land: 'Land record (7/12 extract)', credit: 'Credit bureau report' };
  const shareOk = active && !!(kyc || property || credit);
  return (
    <div>
      {backBtn}
      <PageTitle title={`Case ${a.ref} | ${a.product} ${inr(a.amount)}`} chip={<Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>} sub={`${farmer ? `${farmer.name}, member ${farmer.code}, ${farmer.society}` : 'Applicant hidden (no consent)'}. ${a.tenure} months at ${a.rate}%.`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between"><span className="label">Consent</span><Chip tone={active ? 'good' : 'bad'}>{active ? 'Active' : consent ? 'Withdrawn' : 'None'}</Chip></div>
          {consent ? <dl className="mt-2 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-sm">{([['ID', consent.code], ['Recipient', consent.recipient], ['Purpose', consent.purpose], ['Data', consent.scope || consent.categories.join(', ')], ['Period', consent.period], ['Granted', new Date(consent.grantedAt).toLocaleString('en-IN')]] as const).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}</dl> : <p className="text-sm text-muted">No consent on record.</p>}
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between"><span className="label">Income evidence</span><Chip tone="warn">Simulated</Chip></div>
          {income && months.length ? (<>
            <div className="mt-1 text-sm text-muted">Average net milk payments, last 6 months</div><div className="num font-display text-[28px] font-bold leading-tight">{inr(avg)} <span className="text-[15px] font-semibold text-muted">per month</span></div>
            <div className="text-sm">Coverage {months.length} of 12 months. Lowest month {inr(lowest.total)} ({fmtMonth(lowest.key)}).</div>
            <div className="mt-2 h-36"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="m" fontSize={10} tickLine={false} axisLine={false} /><YAxis hide /><Tooltip cursor={{ fill: '#F4F8FC' }} formatter={(v: number) => inr(v)} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>{data.map((x, i) => <Cell key={i} fill={x.low ? CHART.marigold : CHART.indigo} />)}</Bar></BarChart></ResponsiveContainer></div>
          </>) : <p className="mt-2 text-sm text-bad">{consent ? 'Consent withdrawn. Evidence is hidden.' : 'No consent to share milk income.'}</p>}
        </div>
      </div>
      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="label">Identity, land and credit (shared with consent)</span>
          {consent ? <Chip tone={shareOk ? 'good' : 'bad'}>{shareOk ? `Consent ${consent.code} active, notice ${consent.noticeVersion}` : `Consent ${consent.code} ${active ? 'does not cover these' : 'withdrawn'}`}</Chip> : <Chip tone="bad">No DPDP loan consent</Chip>}</div>
        {shareOk ? (
          <div className="mt-3 grid gap-4 text-sm md:grid-cols-3">
            <div><div className="font-semibold">Identity and KYC</div>{kyc ? kyc.map((k) => <div key={k.type}>{k.type} {k.masked} <Chip tone="good">{k.status}</Chip><div className="text-xs text-muted">{k.provider}</div></div>) : <div className="text-muted">Not shared</div>}</div>
            <div><div className="font-semibold">Land and property</div>{property ? <><div>{property.ownership}, survey {property.survey}</div><div>{property.village}, {property.district}, {property.state}</div><div>{property.area} {property.unit}, {property.use}</div><div className="text-xs text-muted">{property.record}, {property.status}</div></> : <div className="text-muted">Not shared</div>}</div>
            <div><div className="font-semibold">Credit history</div>{credit ? <><div>{credit.bureau} score <b>{credit.score}</b></div><div>{credit.loans} existing loan, {inr(credit.outstanding)} outstanding</div><div className="text-xs text-muted">With consent, at application{credit.mock ? ' (mock)' : ''}</div></> : <div className="text-muted">Not shared</div>}</div>
          </div>
        ) : <p className="mt-2 text-sm text-bad">{consent && !active ? 'The farmer withdrew consent. Identity, land and credit data are hidden and no further sharing takes place.' : 'Not shared: the farmer has not given DPDP consent for this application.'}</p>}
        <div className="mt-3 text-xs text-muted">Masked values only; full Aadhaar and PAN numbers stay with the verification provider. Simulated data.</div>
        {a.sharing.length ? <ul className="mt-2 border-t border-line pt-2 text-xs">{a.sharing.map((x) => <li key={x.id}>Sharing log {x.id}: {x.categories.join(', ')} to {x.recipient}, {x.status}, {new Date(x.at).toLocaleString('en-IN')} (consent {x.consentCode})</li>)}</ul> : null}
      </div>
      <div className="card mt-4 p-4">
        <div className="label">Documents</div>
        <ul className="mt-2 divide-y divide-[#E6EDF5] text-sm">{a.docs.map((d) => <li key={d.id} className="flex items-center justify-between py-2"><span>{docName[d.id]}</span><span key={d.status} className="animate-pop">{d.status === 'received' ? <Chip tone="good"><IconCheck size={13} />Received</Chip> : d.status === 'requested' ? <Chip tone="warn">Requested</Chip> : <Chip>Missing</Chip>}</span></li>)}</ul>
      </div>
      <DossierCard c={r.data} />
      <Note>Not shown to lenders: animal health records, signals, messages, voice data (BR-25). Final terms are recorded only after the bank&apos;s own sanction process (BR-18).</Note>
      {!['approved', 'declined', 'withdrawn'].includes(a.status) ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button className="btn-secondary" disabled={a.docs.find((d) => d.id === 'quote')?.status !== 'missing' || !active} onClick={() => act('requestDoc', {})}>Request cattle purchase quote</button>
          <label className="text-sm">New status<select className="input mt-1" value={next} onChange={(e) => setNext(e.target.value as AppStatus)}><option value="in_review">Under bank review</option><option value="approved">Approved</option><option value="declined">Rejected</option></select></label>
          <input className="input max-w-sm" placeholder="Note (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" disabled={!note.trim() || !active} onClick={async () => { await act('status', { status: next, note }); setNote(''); }}>Update status</button>
        </div>
      ) : <div className="mt-4 inline-flex animate-pop items-center gap-2 rounded-full bg-fill px-4 py-2 text-sm">Case closed: <b>{LABEL[a.status]}</b></div>}
      {err ? <p role="alert" className="mt-2 text-sm text-bad">{err}</p> : null}
    </div>
  );
}

// Bank-ready loan dossier: a PDF built from the application, the farmer's records and the consent
// recorded when the farmer applied. No new consent is collected here. Each build and share is
// written to the audit trail.
function DossierCard({ c }: { c: LenderCase }) {
  const [busy, setBusy] = useState<'' | 'preview' | 'download' | 'share'>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const logged = useRef(false);
  const consent = c.consent;
  const ok = consent?.status === 'active';
  const name = dossierFileName(c);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const log = (mode: 'generated' | 'downloaded' | 'shared') => postJson('/api/lender', { action: 'dossier', id: c.application.id, mode }).catch(() => undefined);
  const build = async () => {
    const blob = await buildDossierPdf(c);
    if (!logged.current) { logged.current = true; void log('generated'); }
    return blob;
  };
  const run = async (kind: 'preview' | 'download' | 'share') => {
    setBusy(kind); setMsg('');
    try {
      const blob = await build();
      if (kind === 'preview') { setPreview(URL.createObjectURL(blob)); return; }
      const file = new File([blob], name, { type: 'application/pdf' });
      if (kind === 'share') {
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.share && nav.canShare?.({ files: [file] })) {
          try { await nav.share({ files: [file], title: `Loan application ${c.application.ref}` }); void log('shared'); return; }
          catch (e) { if ((e as Error).name === 'AbortError') return; }
        }
        setMsg('This browser cannot share files directly, so the PDF was downloaded. Attach it to an email or message to the bank.');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      void log('downloaded');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not create the PDF');
    } finally { setBusy(''); }
  };
  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label">Bank-ready loan dossier (PDF)</span>
        <Chip tone={ok ? 'good' : 'bad'}>{ok ? `Consent obtained, ${new Date(consent!.grantedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : consent ? 'Consent withdrawn: do not share' : 'No consent record: flagged for review'}</Chip>
      </div>
      <p className="mt-1 text-sm text-muted">Built automatically from the application, the farmer&apos;s records and the consent given when applying. Anything not on record, or not covered by consent, shows as &quot;Not provided&quot;.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={!!busy} onClick={() => run('preview')}>{busy === 'preview' ? 'Preparing...' : 'Preview PDF'}</button>
        <button className="btn-primary" disabled={!!busy} onClick={() => run('download')}>{busy === 'download' ? 'Preparing...' : 'Download PDF'}</button>
        <button className="btn-secondary inline-flex items-center gap-1.5" disabled={!!busy || !ok} title={ok ? undefined : 'Sharing needs an active consent'} onClick={() => run('share')}><IconSend size={15} />{busy === 'share' ? 'Preparing...' : 'Share PDF'}</button>
      </div>
      <div className="mt-2 text-xs text-muted">File name: {name}{c.dossier?.generatedCount ? `. Created, downloaded or shared ${c.dossier.generatedCount} time${c.dossier.generatedCount > 1 ? 's' : ''} before (see Audit trail).` : ''}</div>
      {msg ? <p role="status" className="mt-2 text-sm text-warn">{msg}</p> : null}
      {preview ? createPortal(
        <div className="fixed inset-0 z-[1000] flex flex-col bg-black/60 p-2 sm:p-6" role="dialog" aria-label="PDF preview" onClick={() => setPreview(null)}>
          <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-sheet bg-white" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2">
              <span className="truncate text-sm font-semibold">{name}</span>
              <div className="flex gap-2">
                <a className="btn-secondary" href={preview} target="_blank" rel="noreferrer">Open in new tab</a>
                <button className="btn-primary" onClick={() => run('download')}>Download</button>
                <button className="btn-secondary" onClick={() => setPreview(null)}>Close</button>
              </div>
            </div>
            <iframe title="Loan dossier preview" src={preview} className="w-full flex-1" />
          </div>
        </div>, document.body,
      ) : null}
    </div>
  );
}

const PURPOSE_LABEL: Record<string, string> = { cattle: 'Buy milch animals', feed: 'Feed and fodder', equipment: 'Dairy equipment', shed: 'Cattle shed construction', working_capital: 'Working capital', other: 'Other' };
const emi = (p: number, annual: number, n: number) => { const r = annual / 1200; return r === 0 ? p / n : (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1); };
const BLANK = { name: '', purpose: 'cattle', min: '25000', max: '150000', rate: '11', maxTenure: '36', feePct: '1', elig: 'Society member for 12+ months with regular milk supply' };

function Products({ d }: { d: LenderData }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const set = (k: keyof typeof BLANK) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const n = { min: Number(f.min), max: Number(f.max), rate: Number(f.rate), tenure: Number(f.maxTenure), fee: Number(f.feePct) };
  const ok = f.name.trim().length >= 3 && n.min >= 1000 && n.max > n.min && n.max <= 5000000 && n.rate > 0 && n.rate <= 36 && n.tenure >= 3 && n.tenure <= 120 && n.fee >= 0 && n.fee <= 10 && !!f.elig.trim();
  const example = ok ? Math.min(Math.max(50000, n.min), n.max) : 0;
  const save = async () => {
    setBusy(true); setErr('');
    try {
      await postJson('/api/lender', { action: 'createProduct', product: { name: f.name, purpose: f.purpose, min: n.min, max: n.max, rate: n.rate, maxTenure: n.tenure, feePct: n.fee, elig: f.elig } });
      setDone(f.name.trim()); setF(BLANK); setOpen(false);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const remove = async (code: string, name: string) => {
    if (!window.confirm(`Remove "${name}"? Farmers will no longer see it.`)) return;
    try { await postJson('/api/lender', { action: 'removeProduct', code }); setDone(''); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  const input = 'input mt-1 !min-h-[40px] !py-1.5';
  const field = (label: string, el: React.ReactNode, hint?: string) => <label className="flex flex-col text-sm font-semibold">{label}{el}{hint ? <span className="mt-0.5 text-xs font-normal text-muted">{hint}</span> : null}</label>;
  return (
    <div>
      <PageTitle title="Product catalogue" sub="Products shown to farmers in the Finance section, with a source date and a demo label (BR-19)." />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {!open ? <button className="btn-primary" onClick={() => { setOpen(true); setDone(''); setErr(''); }}>+ New product</button> : null}
        {done ? <span className="text-sm text-good">“{done}” is live. Farmers see it under Finance, compare loan options.</span> : null}
      </div>
      {open ? (
        <div className="card mb-4 p-4">
          <div className="label">New loan product</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {field('Product name', <input className={input} value={f.name} onChange={set('name')} placeholder="e.g. Cattle shed loan" maxLength={80} />)}
            {field('Purpose', <select className={input} value={f.purpose} onChange={set('purpose')}>{Object.entries(PURPOSE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>)}
            {field('Minimum amount (₹)', <input className={input} type="number" inputMode="numeric" min={1000} step={1000} value={f.min} onChange={set('min')} />)}
            {field('Maximum amount (₹)', <input className={input} type="number" inputMode="numeric" min={1000} step={1000} value={f.max} onChange={set('max')} />, 'Up to ₹50,00,000')}
            {field('Interest rate (% a year)', <input className={input} type="number" inputMode="decimal" min={0} max={36} step={0.05} value={f.rate} onChange={set('rate')} />)}
            {field('Maximum tenure (months)', <input className={input} type="number" inputMode="numeric" min={3} max={120} value={f.maxTenure} onChange={set('maxTenure')} />)}
            {field('Processing fee (% of loan)', <input className={input} type="number" inputMode="decimal" min={0} max={10} step={0.25} value={f.feePct} onChange={set('feePct')} />)}
            {field('Who is eligible', <input className={input} value={f.elig} onChange={set('elig')} maxLength={300} />, 'Shown to farmers before they apply')}
          </div>
          <div className="mt-3 rounded-xl bg-fill px-3 py-2 text-sm">
            {ok ? <>Farmers will see: {inr(n.min)} to {inr(n.max)} at {n.rate}% for up to {n.tenure} months. Example: {inr(example)} over {n.tenure} months is an EMI of <b>{inr(Math.round(emi(example, n.rate, n.tenure)))}</b>, plus a {inr(Math.round((example * n.fee) / 100))} fee.</>
              : <span className="text-muted">Fill in every field. The maximum must be more than the minimum, the rate 0 to 36%, tenure 3 to 120 months and the fee 0 to 10%.</span>}
          </div>
          {err ? <p role="alert" className="mt-2 text-sm text-bad">{err}</p> : null}
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" disabled={!ok || busy} onClick={save}>{busy ? 'Publishing...' : 'Publish to farmers'}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => { setOpen(false); setErr(''); }}>Cancel</button>
          </div>
        </div>
      ) : err ? <p role="alert" className="mb-3 text-sm text-bad">{err}</p> : null}
      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[900px]">
          <thead><tr><th>Product</th><th>Purpose</th><th>Range</th><th>Rate</th><th>Tenure</th><th>Fees</th><th>Applications</th><th>Effective</th><th>Label</th><th></th></tr></thead>
          <tbody>{d.products.map((p) => <tr key={p.id}><td className="font-semibold">{p.name}<div className="text-xs font-normal text-muted">{p.elig}</div></td><td>{PURPOSE_LABEL[p.purpose] ?? p.purpose}</td><td className="whitespace-nowrap">{inr(p.min)} - {inr(p.max)}</td><td>{p.rate}%</td><td className="whitespace-nowrap">Up to {p.maxTenure} months</td><td>{p.feePct}%</td><td className="num">{p.applications ?? 0}</td>
            <td className="whitespace-nowrap">{p.createdByLender && p.createdAt ? fmtDate(p.createdAt.slice(0, 10)) : '31 Oct 2026'}</td><td>{p.createdByLender ? <Chip tone="primary">Added by bank</Chip> : <Chip tone="warn">Demo offer</Chip>}</td>
            <td>{p.createdByLender && !p.applications ? <button className="text-sm font-semibold text-bad hover:underline" onClick={() => remove(p.id, p.name)}>Remove</button> : null}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function Audit({ d }: { d: LenderData }) {
  const s = { audit: d.audit };
  return (
    <div>
      <PageTitle title="Audit trail" sub="Consent, access and status events." />
      <div className="card p-4"><ul className="divide-y divide-[#E6EDF5] text-[13px]">{s.audit.filter((x) => /consent|application|DF-|Requested|Uploaded|Set |loan product/.test(x.action)).map((x, i) => <li key={i} className="grid grid-cols-[150px_1fr] gap-3 py-1.5"><span className="num text-muted">{new Date(x.at).toLocaleString('en-IN')}</span><span><b className="font-semibold">{x.actor}</b>: {x.action}</span></li>)}</ul>
        {s.audit.length === 0 ? <p className="text-muted">No events yet.</p> : null}</div>
    </div>
  );
}
