'use client';
import { Fragment, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';
import { fmtDate, fmtMonth, inr, MONTHS } from '@/lib/util';
import { postJson, useResource } from '@/lib/client/api';
import type { AppStatus, LenderCase, LenderData } from '@/lib/types/api';
import { CHART, Chip, ConsoleShell, Note, PageTitle, Stat } from './ui';
import { IconBack, IconCheck, IconChevron } from './icons';
import { ErrorState, Loading } from './DataState';

const TONE: Record<AppStatus, 'primary' | 'good' | 'warn' | 'bad' | 'neutral'> = { submitted: 'primary', in_review: 'primary', more_info: 'warn', approved: 'good', declined: 'bad', withdrawn: 'neutral' };
const LABEL: Record<AppStatus, string> = { submitted: 'Submitted', in_review: 'In review', more_info: 'More information needed', approved: 'Approved', declined: 'Declined', withdrawn: 'Withdrawn' };

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
      <table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="group cursor-pointer hover:bg-primary-light" onClick={() => onOpen(r.id)}>
            <td className="font-bold text-primary">{r.ref}</td><td>{r.farmer}</td><td>{r.product}</td><td className="num">{inr(r.amount)}</td><td><Chip tone={TONE[r.status]}>{LABEL[r.status]}</Chip></td><td className="whitespace-nowrap">{fmtDate(r.updated.slice(0, 10))}<IconChevron size={16} className="ml-2 inline text-primary opacity-0 transition-opacity group-hover:opacity-100" /></td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CaseDetail({ id, back }: { id: string; back: () => void }) {
  const s = useStore();
  const today = DEMO_DATES[s.demoDate].date;
  const r = useResource<LenderCase>(`/api/lender?case=${id}&asOf=${today}`, { poll: 6000 });
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
    return <div>{backBtn}<PageTitle title={`Case ${a.ref}`} chip={<Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>} sub={farmer ? `Member ${farmer.code}, ${farmer.society}. ${a.product}, ${inr(a.amount)}.` : undefined} /><div className="rounded-sheet border border-dashed border-line p-8 text-muted">Background demo case. Open the farmer&apos;s case to try the full flow.</div></div>;
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
      <Note>Not shown to lenders: animal health records, signals, messages, voice data (BR-25). Final terms are recorded only after the bank&apos;s own sanction process (BR-18).</Note>
      {!['approved', 'declined', 'withdrawn'].includes(a.status) ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button className="btn-secondary" disabled={a.docs.find((d) => d.id === 'quote')?.status !== 'missing' || !active} onClick={() => act('requestDoc', {})}>Request cattle purchase quote</button>
          <label className="text-sm">New status<select className="input mt-1" value={next} onChange={(e) => setNext(e.target.value as AppStatus)}><option value="in_review">In review</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label>
          <input className="input max-w-sm" placeholder="Note (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" disabled={!note.trim() || !active} onClick={async () => { await act('status', { status: next, note }); setNote(''); }}>Update status</button>
        </div>
      ) : <div className="mt-4 inline-flex animate-pop items-center gap-2 rounded-full bg-fill px-4 py-2 text-sm">Case closed: <b>{LABEL[a.status]}</b></div>}
      {err ? <p role="alert" className="mt-2 text-sm text-bad">{err}</p> : null}
    </div>
  );
}

function Products({ d }: { d: LenderData }) {
  return (
    <div>
      <PageTitle title="Product catalogue" sub="Products shown to farmers with a source date and a demo label (BR-19)." />
      <table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Product</th><th>Purpose</th><th>Range</th><th>Rate</th><th>Tenure</th><th>Fees</th><th>Effective</th><th>Label</th></tr></thead>
        <tbody>{d.products.map((p) => <tr key={p.id}><td>{p.name}</td><td>{p.purpose === 'cattle' ? 'Buy milch animals' : p.purpose}</td><td>{inr(p.min)} - {inr(p.max)}</td><td>{p.rate}%</td><td>Up to {p.maxTenure} months</td><td>{p.feePct}%</td><td>31 Oct 2026</td><td><Chip tone="warn">Demo offer</Chip></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function Audit({ d }: { d: LenderData }) {
  const s = { audit: d.audit };
  return (
    <div>
      <PageTitle title="Audit trail" sub="Consent, access and status events." />
      <div className="card p-4"><ul className="divide-y divide-[#E6EDF5] text-[13px]">{s.audit.filter((x) => /consent|application|DF-|Requested|Uploaded|Set /.test(x.action)).map((x, i) => <li key={i} className="grid grid-cols-[150px_1fr] gap-3 py-1.5"><span className="num text-muted">{new Date(x.at).toLocaleString('en-IN')}</span><span><b className="font-semibold">{x.actor}</b>: {x.action}</span></li>)}</ul>
        {s.audit.length === 0 ? <p className="text-muted">No events yet.</p> : null}</div>
    </div>
  );
}
