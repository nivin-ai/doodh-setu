'use client';
import { useMemo, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore, activePremium, type AppStatus } from '@/lib/store';
import { DEMO_DATES, FARMER } from '@/lib/demo';
import { monthKeysUpTo, monthSummary } from '@/lib/farmer';
import { fmtMonth, inr, MONTHS } from '@/lib/util';
import { Chip, ConsoleShell, Note, PageTitle, Stat } from './ui';

const LENDER = 'Gramin Partner Bank (demo)';
const SEEDED = [
  { ref: 'DF-10021', farmer: 'Member 0187, Bakrol society', product: 'Cattle loan', amount: 80000, status: 'in_review' as AppStatus, updated: '18 Mar 2027' },
  { ref: 'DF-10022', farmer: 'Member 0033, Karamsad society', product: 'Bulk milk cooler (society)', amount: 150000, status: 'more_info' as AppStatus, updated: '17 Mar 2027' },
  { ref: 'DF-10023', farmer: 'Member 0291, Ode society', product: 'Cattle loan', amount: 50000, status: 'submitted' as AppStatus, updated: '16 Mar 2027' },
];
const TONE: Record<AppStatus, 'primary' | 'good' | 'warn' | 'bad' | 'neutral'> = { submitted: 'primary', in_review: 'primary', more_info: 'warn', approved: 'good', declined: 'bad', withdrawn: 'neutral' };
const LABEL: Record<AppStatus, string> = { submitted: 'Submitted', in_review: 'In review', more_info: 'More information needed', approved: 'Approved', declined: 'Declined', withdrawn: 'Withdrawn' };

export default function LenderApp() {
  const s = useStore();
  const [view, setView] = useState('cases');
  const [open, setOpen] = useState<string | null>(null);
  const ownCase = s.application && s.application.lender === LENDER ? s.application : null;
  const newCount = ownCase && ownCase.status === 'submitted' ? 1 : 0;
  const menu = [{ id: 'cases', label: 'Cases', badge: newCount }, { id: 'products', label: 'Products' }, { id: 'audit', label: 'Audit trail' }];
  return (
    <ConsoleShell title={`DairyFin PartnerDesk | ${LENDER}`} menu={menu} active={view} onSelect={(v) => { setView(v); setOpen(null); }} right={<span>Anita (case officer)</span>}>
      {view === 'cases' ? (open ? <CaseDetail refId={open} back={() => setOpen(null)} /> : <Cases onOpen={setOpen} />) : view === 'products' ? <Products /> : <Audit />}
    </ConsoleShell>
  );
}

function Cases({ onOpen }: { onOpen: (r: string) => void }) {
  const s = useStore();
  const a = s.application && s.application.lender === LENDER ? s.application : null;
  const rows = [...(a ? [{ ref: a.ref, farmer: `${FARMER.name}, member ${FARMER.memberId}, ${FARMER.society}`, product: a.product, amount: a.amount, status: a.status, updated: 'Today' }] : []), ...SEEDED];
  return (
    <div>
      <PageTitle title="Case queue" sub="Only applications routed to this bank. Every case opened is logged." />
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <Stat label="Applications" value={rows.length} /><Stat label="Awaiting documents" value={rows.filter((r) => r.status === 'more_info').length} /><Stat label="In review" value={rows.filter((r) => r.status === 'in_review').length} />
      </div>
      {s.application && s.application.lender !== LENDER ? <Note>A demo application was sent to another lender; switch the farmer&apos;s product to {LENDER} to see it here.</Note> : null}
      <table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.ref} className="cursor-pointer hover:bg-alt" onClick={() => onOpen(r.ref)}>
            <td className="font-bold text-primary">{r.ref}</td><td>{r.farmer}</td><td>{r.product}</td><td>{inr(r.amount)}</td><td><Chip tone={TONE[r.status]}>{LABEL[r.status]}</Chip></td><td>{r.updated}</td></tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function CaseDetail({ refId, back }: { refId: string; back: () => void }) {
  const s = useStore();
  const a = s.application;
  const [note, setNote] = useState('');
  const [next, setNext] = useState<AppStatus>('in_review');
  const today = DEMO_DATES[s.demoDate].date;
  const premium = activePremium(s);
  const months = useMemo(() => {
    const complete = today.endsWith('-30') || today.endsWith('-31');
    const keys = monthKeysUpTo(today, 13).slice(complete ? 1 : 0, complete ? 13 : 12);
    return keys.map((k) => monthSummary(k, premium, today));
  }, [today, premium?.rate]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a || a.ref !== refId) {
    const r = SEEDED.find((x) => x.ref === refId);
    return <div><button className="mb-3 text-sm font-bold text-primary" onClick={back}>‹ All cases</button><PageTitle title={`Case ${refId}`} chip={r ? <Chip tone={TONE[r.status]}>{LABEL[r.status]}</Chip> : undefined} /><div className="card p-6 text-muted">Background demo case. Open {FARMER.first}&apos;s case to try the full flow.</div></div>;
  }
  const consent = s.consents.find((c) => c.id === a.consentId);
  const active = consent?.status === 'active';
  const avg = Math.round(months.slice(-6).reduce((x, m) => x + m.total, 0) / 6);
  const lowest = months.reduce((x, m) => (m.total < x.total ? m : x), months[0]);
  const data = months.map((m) => ({ m: MONTHS[Number(m.key.slice(5)) - 1], v: m.total, low: m.key === lowest.key }));
  const docName = { id: 'Identity proof', bank: 'Bank account details', quote: 'Cattle purchase quote' };
  return (
    <div>
      <button className="mb-3 text-sm font-bold text-primary" onClick={back}>‹ All cases</button>
      <PageTitle title={`Case ${a.ref} | ${a.product} ${inr(a.amount)}`} chip={<Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>} sub={`${FARMER.name} · member ${FARMER.memberId} · ${FARMER.society} · ${a.tenure} months at ${a.rate}%`} />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between"><span className="label">Consent</span><Chip tone={active ? 'good' : 'bad'}>{active ? 'Active' : 'Withdrawn'}</Chip></div>
          {consent ? <ul className="mt-2 space-y-1 text-sm"><li>ID: {consent.id}</li><li>Recipient: {consent.recipient}</li><li>Purpose: {consent.purpose}</li><li>Data: {consent.scope}</li><li>Period: {consent.period}</li><li>Granted: {new Date(consent.grantedAt).toLocaleString('en-IN')}</li></ul> : <p className="text-sm text-muted">No consent on record.</p>}
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between"><span className="label">Income evidence</span><Chip tone="warn">Simulated</Chip></div>
          {active ? (<>
            <div className="mt-1 font-bold">Average net milk payments: {inr(avg)} / month (last 6 months)</div>
            <div className="text-sm">Coverage: {months.length} of 12 months · Lowest month: {inr(lowest.total)} ({fmtMonth(lowest.key)})</div>
            <div className="mt-2 h-36"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="m" fontSize={10} /><YAxis hide /><Tooltip formatter={(v: number) => inr(v)} />
              <Bar dataKey="v">{data.map((d, i) => <Cell key={i} fill={d.low ? '#B26B00' : '#1F5FA8'} />)}</Bar></BarChart></ResponsiveContainer></div>
          </>) : <p className="mt-2 text-sm text-bad">Consent withdrawn. Evidence is hidden.</p>}
        </div>
      </div>
      <div className="card mt-4 p-4">
        <div className="label">Documents</div>
        <ul className="mt-2 space-y-1 text-sm">{a.docs.map((d) => <li key={d.id} className="flex justify-between"><span>{docName[d.id]}</span><span className={d.status === 'received' ? 'font-bold text-good' : d.status === 'requested' ? 'font-bold text-warn' : 'text-muted'}>{d.status}</span></li>)}</ul>
      </div>
      <Note>Not shown to lenders: animal health records, signals, messages, voice data (BR-25). Final terms are recorded only after the bank&apos;s own sanction process (BR-18).</Note>
      {!['approved', 'declined', 'withdrawn'].includes(a.status) ? (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <button className="btn-secondary" disabled={a.docs.find((d) => d.id === 'quote')?.status !== 'missing' || !active} onClick={() => s.requestDoc()}>Request cattle purchase quote</button>
          <label className="text-sm">New status<select className="input mt-1" value={next} onChange={(e) => setNext(e.target.value as AppStatus)}><option value="in_review">In review</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label>
          <input className="input max-w-sm" placeholder="Note (required)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn-primary" disabled={!note.trim() || !active} onClick={() => { s.setAppStatus(next, note); setNote(''); }}>Update status</button>
        </div>
      ) : <p className="mt-4 text-sm">Case closed: <b>{LABEL[a.status]}</b>.</p>}
    </div>
  );
}

function Products() {
  return (
    <div>
      <PageTitle title="Product catalogue" sub="Products shown to farmers with a source date and a demo label (BR-19)." />
      <table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Product</th><th>Purpose</th><th>Range</th><th>Rate</th><th>Tenure</th><th>Fees</th><th>Effective</th><th>Label</th></tr></thead>
        <tbody><tr><td>Cattle loan</td><td>Buy milch animals</td><td>₹25,000 - ₹2,00,000</td><td>10.5%</td><td>Up to 36 months</td><td>1%</td><td>31 Oct 2026</td><td><Chip tone="warn">Demo offer</Chip></td></tr></tbody>
      </table>
    </div>
  );
}

function Audit() {
  const s = useStore();
  return (
    <div>
      <PageTitle title="Audit trail" sub="Consent, access and status events." />
      <div className="card p-4"><ul className="space-y-1 text-sm">{s.audit.filter((x) => /consent|application|DF-|Requested|Uploaded|Set /.test(x.action)).map((x, i) => <li key={i}><span className="text-muted">{new Date(x.at).toLocaleString('en-IN')}</span> · <b>{x.actor}</b>: {x.action}</li>)}</ul>
        {s.audit.length === 0 ? <p className="text-muted">No events yet.</p> : null}</div>
    </div>
  );
}
