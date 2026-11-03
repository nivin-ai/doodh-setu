'use client';
import { Fragment, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';
import { fmtDate, fmtMonth, inr, MONTHS } from '@/lib/util';
import { postJson, useResource } from '@/lib/client/api';
import type { AppStatus, ClaimView, LenderCase, LenderData } from '@/lib/types/api';
import { CHART, Chip, ConsoleShell, Note, PageTitle, Stat } from './ui';
import { IconBack, IconCheck, IconChevron } from './icons';
import { ErrorState, Loading } from './DataState';
import { APP_TRANSITIONS, CLAIM_LABEL, CLAIM_TRANSITIONS, STATUS_LABEL as LABEL, STATUS_TONE as TONE, type ClaimStatus } from '@/lib/dairyfin';
import { CATEGORY_LABEL } from './dairyfin/Workspace';

// Provider desk (bank or insurer). Data comes from /api/lender: only applications routed to this
// provider (never drafts), and applicant data only for the categories the applicant consented to.
// Opening a case is logged in data_access_logs.
export default function LenderApp() {
  const [view, setView] = useState('cases');
  const [open, setOpen] = useState<string | null>(null);
  const r = useResource<LenderData>('/api/lender', { poll: 6000 });
  const d = r.data;
  const newCount = d ? d.cases.filter((c) => !c.background && c.status === 'submitted').length : 0;
  const openClaims = d ? d.claims.filter((c) => ['submitted', 'in_review'].includes(c.status)).length : 0;
  const insurer = d?.lender.kind === 'insurer';
  const menu = [{ id: 'cases', label: insurer ? 'Applications' : 'Cases', badge: newCount },
    ...(insurer ? [{ id: 'claims', label: 'Claims', badge: openClaims }, { id: 'policies', label: 'Policies' }] : []),
    { id: 'products', label: 'Products' }, { id: 'audit', label: 'Audit trail' }];
  return (
    <ConsoleShell title={insurer ? 'DairyFin insurer desk' : 'DairyFin PartnerDesk'} place={d?.lender.name} menu={menu} active={view} onSelect={(v) => { setView(v); setOpen(null); }}>
      {!d ? (r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Loading cases..." />)
        : view === 'cases' ? (open ? <CaseDetail id={open} back={() => setOpen(null)} /> : <Cases d={d} onOpen={setOpen} />)
        : view === 'claims' ? <Claims d={d} refresh={r.refresh} /> : view === 'policies' ? <Policies d={d} refresh={r.refresh} />
        : view === 'products' ? <Products d={d} /> : <Audit d={d} />}
    </ConsoleShell>
  );
}

type Tab = 'all' | 'farmer' | 'society' | 'insurance';
function Cases({ d, onOpen }: { d: LenderData; onOpen: (r: string) => void }) {
  const [tab, setTab] = useState<Tab>('all');
  const [status, setStatus] = useState<'all' | AppStatus>('all');
  const [product, setProduct] = useState('all');
  const has = { farmer: d.cases.some((c) => c.applicantType === 'farmer' && c.productType === 'loan'), society: d.cases.some((c) => c.applicantType === 'society'), insurance: d.cases.some((c) => c.productType === 'insurance') };
  const tabs: [Tab, string][] = [['all', 'All'], ...(has.farmer ? [['farmer', 'Farmer loans']] as [Tab, string][] : []), ...(has.society ? [['society', 'Society']] as [Tab, string][] : []), ...(has.insurance ? [['insurance', 'Insurance']] as [Tab, string][] : [])];
  const rows = d.cases.filter((c) => (tab === 'all' || (tab === 'insurance' ? c.productType === 'insurance' : tab === 'society' ? c.applicantType === 'society' : c.applicantType === 'farmer' && c.productType === 'loan'))
    && (status === 'all' || c.status === status) && (product === 'all' || c.productCode === product));
  const products = [...new Map(d.cases.map((c) => [c.productCode, c.product])).entries()];
  return (
    <div>
      <PageTitle title="Case queue" sub={`Only applications sent to ${d.lender.name}. Drafts stay with the applicant. Every case opened is logged.`} />
      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <Stat label="Applications" value={d.cases.length} /><Stat label="New" value={d.cases.filter((r) => r.status === 'submitted').length} />
        <Stat label="Awaiting applicant" value={d.cases.filter((r) => r.status === 'more_info').length} /><Stat label="In review" value={d.cases.filter((r) => r.status === 'in_review').length} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {tabs.map(([id, l]) => <button key={id} onClick={() => setTab(id)} className={`rounded-full px-3 py-1 text-sm ${tab === id ? 'bg-primary text-white' : 'bg-fill'}`}>{l}</button>)}
        <select aria-label="Status" className="input !w-auto !py-1 text-sm" value={status} onChange={(e) => setStatus(e.target.value as 'all' | AppStatus)}>
          <option value="all">All statuses</option>{(Object.keys(LABEL) as AppStatus[]).filter((s) => s !== 'draft').map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select>
        <select aria-label="Product" className="input !w-auto !py-1 text-sm" value={product} onChange={(e) => setProduct(e.target.value)}>
          <option value="all">All products</option>{products.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
      </div>
      <div className="overflow-x-auto"><table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Reference</th><th>Applicant</th><th>Product</th><th>Amount</th><th>Status</th><th>Updated</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="group cursor-pointer hover:bg-primary-light" onClick={() => onOpen(r.id)}>
            <td className="font-bold text-primary">{r.ref}</td><td>{r.farmer}{r.applicantType === 'society' ? <Chip className="ml-2" tone="primary">Society</Chip> : null}</td><td>{r.product}</td>
            <td className="num">{r.amount ? inr(r.amount) : '-'}</td><td><Chip tone={TONE[r.status]}>{LABEL[r.status]}</Chip></td>
            <td className="whitespace-nowrap">{fmtDate(r.updated.slice(0, 10))}<IconChevron size={16} className="ml-2 inline text-primary opacity-0 transition-opacity group-hover:opacity-100" /></td></tr>
        ))}</tbody>
      </table></div>
      {!rows.length ? <p className="mt-3 text-sm text-muted">No applications match these filters.</p> : null}
    </div>
  );
}

const LEGACY_DOCS: Record<string, string> = { id: 'Identity proof', bank: 'Bank account details', quote: 'Cattle purchase quote', kyc: 'KYC verification result (Aadhaar, PAN)', land: 'Land record (7/12 extract)', credit: 'Credit bureau report' };

function CaseDetail({ id, back }: { id: string; back: () => void }) {
  const s = useStore();
  const today = DEMO_DATES[s.demoDate].date;
  const r = useResource<LenderCase>(`/api/lender?case=${id}&asOf=${today}`, { poll: 6000 });
  const [note, setNote] = useState('');
  const [next, setNext] = useState<AppStatus | ''>('');
  const [reqDocs, setReqDocs] = useState<string[]>([]);
  const [reqNote, setReqNote] = useState('');
  const [offer, setOffer] = useState({ amount: '', rate: '', tenure: '', notes: '' });
  const [premium, setPremium] = useState('');
  const [internal, setInternal] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const backBtn = <button className="mb-3 flex items-center gap-1 text-sm font-semibold text-primary hover:underline" onClick={back}><IconBack size={16} />All cases</button>;
  if (!r.data) return <div>{backBtn}{r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Opening case..." />}</div>;
  const { application: a, consent, kyc, property, credit, income, farmer, background, society, animal, product, notes } = r.data;
  const act = async (action: string, body: Record<string, unknown>, done = 'Saved') => {
    setErr(''); setOk('');
    try { await postJson('/api/lender', { action, id, ...body }); await r.refresh(); setOk(done); return true; } catch (e) { setErr(e instanceof Error ? e.message : String(e)); return false; }
  };
  if (background) {
    return <div>{backBtn}<PageTitle title={`Case ${a.ref}`} chip={<Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>} sub={farmer ? `Member ${farmer.code}, ${farmer.society}. ${a.product}, ${inr(a.amount)}.` : undefined} /><div className="rounded-sheet border border-dashed border-line p-8 text-muted">Background demo case. Open the demo farmer&apos;s or the society&apos;s case to try the full flow.</div></div>;
  }
  const active = consent?.status === 'active';
  const cats = product?.dataCategories ?? ['identity_kyc', 'land_property', 'credit_history', 'milk_income'];
  const months = income ?? [];
  const avg = months.length ? Math.round(months.slice(-6).reduce((x, m) => x + m.total, 0) / Math.min(6, months.length)) : 0;
  const lowest = months.reduce((x, m) => (m.total < x.total ? m : x), months[0] ?? { key: '', total: 0, litres: 0 });
  const data = months.map((m) => ({ m: MONTHS[Number(m.key.slice(5)) - 1], v: m.total, low: m.key === lowest.key }));
  const docName = (d: string) => product?.documents.find((x) => x.id === d)?.label ?? LEGACY_DOCS[d] ?? d;
  const moves = (APP_TRANSITIONS[a.status] ?? []).filter((x) => ['in_review', 'approved', 'declined'].includes(x));
  const closed = ['declined', 'withdrawn', 'policy_issued'].includes(a.status);
  const isIns = a.productType === 'insurance';
  const applicant = a.applicantType === 'society'
    ? (society ? `${society.name} (society), ${society.village}` : 'Society (operating data not shared)')
    : farmer ? `${farmer.name}, member ${farmer.code}, ${farmer.society}` : 'Applicant hidden (no consent)';
  const sub = [applicant, a.amount ? `${inr(a.amount)}${a.tenure ? ` over ${a.tenure} months` : ''}` : '', a.submittedAt ? `submitted ${fmtDate(a.submittedAt.slice(0, 10))}` : ''].filter(Boolean).join('. ');
  return (
    <div>
      {backBtn}
      <PageTitle title={`Case ${a.ref} | ${a.product}`} chip={<span className="flex gap-2"><Chip tone={TONE[a.status]}>{LABEL[a.status]}</Chip>{a.applicantType === 'society' ? <Chip tone="primary">Society application</Chip> : null}{isIns ? <Chip tone="primary">Insurance</Chip> : null}</span>} sub={sub} />
      {!active ? <div role="alert" className="mb-4 rounded-xl border border-bad/30 bg-bad-light px-4 py-3 text-sm text-bad">{consent ? `Consent ${consent.code} was withdrawn. Shared data is hidden and you cannot approve, make an offer or issue a policy on it.` : 'No consent on record for this application.'}</div> : null}
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="flex items-center justify-between"><span className="label">Consent</span><Chip tone={active ? 'good' : 'bad'}>{active ? 'Active' : consent ? 'Withdrawn' : 'None'}</Chip></div>
          {consent ? <dl className="mt-2 grid grid-cols-[100px_1fr] gap-x-3 gap-y-1.5 text-sm">{([['ID', consent.code], ['Given by', a.applicantType === 'society' ? 'Society representative' : 'Farmer'], ['Purpose', consent.purpose], ['Data', consent.categories.map((c) => CATEGORY_LABEL[c]?.split(' (')[0] ?? c).join(', ')], ['Period', consent.period], ['Notice', consent.noticeVersion ?? '-'], ['Granted', new Date(consent.grantedAt).toLocaleString('en-IN')]] as const).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}</dl> : <p className="text-sm text-muted">No consent on record.</p>}
        </div>
        <div className="card p-4">
          <div className="label">Application details</div>
          <dl className="mt-2 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-sm">
            {Object.entries(a.answers ?? {}).map(([k, v]) => <Fragment key={k}><dt className="text-muted">{product?.fields.find((f) => f.id === k)?.label ?? k}</dt><dd>{String(v)}</dd></Fragment>)}
            {animal ? <><dt className="text-muted">Animal</dt><dd>{animal.type}, {animal.breed}, tag {animal.tag ?? '-'}, {animal.health}</dd></> : isIns ? <><dt className="text-muted">Animal</dt><dd className="text-bad">Not shared</dd></> : null}
          </dl>
          {a.offer ? <div className="mt-3 rounded-lg bg-fill px-3 py-2 text-sm">Offer: {a.offer.amount ? inr(a.offer.amount) : ''}{a.offer.rate ? `, ${a.offer.rate}%` : ''}{a.offer.tenure ? `, ${a.offer.tenure} months` : ''} <Chip tone={a.offerStatus === 'accepted' ? 'good' : a.offerStatus === 'declined' ? 'bad' : 'warn'}>{a.offerStatus === 'pending' ? 'Awaiting applicant' : `Applicant ${a.offerStatus}`}</Chip></div> : null}
        </div>
      </div>

      {a.applicantType === 'society' ? (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between"><span className="label">Society operating data (shared with the society&apos;s consent)</span><Chip tone="warn">Simulated</Chip></div>
          {society ? <div className="mt-2 grid gap-4 md:grid-cols-4"><Stat label="Members" value={society.members} /><Stat label="Milk a day (90-day avg)" value={`${society.avgDailyLitres} L`} /><Stat label="Average fat" value={society.avgFat ? `${society.avgFat}%` : '-'} /><Stat label="Society code" value={society.code} /></div>
            : <p className="mt-2 text-sm text-bad">Not shared, or consent withdrawn.</p>}
        </div>
      ) : null}

      {cats.includes('milk_income') ? (
        <div className="card mt-4 p-4">
          <div className="flex items-center justify-between"><span className="label">Income evidence</span><Chip tone="warn">Simulated</Chip></div>
          {income && months.length ? (<>
            <div className="mt-1 text-sm text-muted">Average net milk payments, last 6 months</div><div className="num font-display text-[28px] font-bold leading-tight">{inr(avg)} <span className="text-[15px] font-semibold text-muted">per month</span></div>
            <div className="text-sm">Coverage {months.length} of 12 months. Lowest month {inr(lowest.total)} ({fmtMonth(lowest.key)}).</div>
            <div className="mt-2 h-36"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="m" fontSize={10} tickLine={false} axisLine={false} /><YAxis hide /><Tooltip cursor={{ fill: '#F4F8FC' }} formatter={(v: number) => inr(v)} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>{data.map((x, i) => <Cell key={i} fill={x.low ? CHART.marigold : CHART.indigo} />)}</Bar></BarChart></ResponsiveContainer></div>
          </>) : <p className="mt-2 text-sm text-bad">{consent && !active ? 'Consent withdrawn. Evidence is hidden.' : 'The applicant did not share milk income.'}</p>}
        </div>
      ) : null}

      {cats.some((c) => ['identity_kyc', 'land_property', 'credit_history'].includes(c)) ? (
        <div className="card mt-4 p-4">
          <span className="label">Identity, land and credit (each only if shared)</span>
          <div className="mt-3 grid gap-4 text-sm md:grid-cols-3">
            {cats.includes('identity_kyc') ? <div><div className="font-semibold">Identity and KYC</div>{kyc ? kyc.map((k) => <div key={k.type}>{k.type} {k.masked} <Chip tone="good">{k.status}</Chip><div className="text-xs text-muted">{k.provider}</div></div>) : <div className="text-muted">Not shared</div>}</div> : null}
            {cats.includes('land_property') ? <div><div className="font-semibold">Land and property</div>{property ? <><div>{property.ownership}, survey {property.survey}</div><div>{property.village}, {property.district}, {property.state}</div><div>{property.area} {property.unit}, {property.use}</div><div className="text-xs text-muted">{property.record}, {property.status}</div></> : <div className="text-muted">Not shared</div>}</div> : null}
            {cats.includes('credit_history') ? <div><div className="font-semibold">Credit history</div>{credit ? <><div>{credit.bureau} score <b>{credit.score}</b></div><div>{credit.loans} existing loan, {inr(credit.outstanding)} outstanding</div><div className="text-xs text-muted">With consent{credit.mock ? ' (mock)' : ''}</div></> : <div className="text-muted">Not shared</div>}</div> : null}
          </div>
          <div className="mt-3 text-xs text-muted">Masked values only; full Aadhaar and PAN numbers stay with the verification provider. Simulated data.</div>
          {a.sharing.length ? <ul className="mt-2 border-t border-line pt-2 text-xs">{a.sharing.map((x) => <li key={x.id}>Sharing log {x.id}: {x.categories.join(', ')} to {x.recipient}, {x.status}, {new Date(x.at).toLocaleString('en-IN')} (consent {x.consentCode})</li>)}</ul> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <div className="label">Documents</div>
          <ul className="mt-2 divide-y divide-[#E6EDF5] text-sm">{a.docs.map((d) => <li key={d.id} className="flex items-center justify-between py-2"><span>{docName(d.id)}</span><span key={d.status} className="animate-pop">{d.status === 'received' ? <Chip tone="good"><IconCheck size={13} />Received (simulated)</Chip> : d.status === 'requested' ? <Chip tone="warn">Requested</Chip> : <Chip>Missing</Chip>}</span></li>)}</ul>
        </div>
        <div className="card p-4">
          <div className="label">History</div>
          <ol className="mt-2 space-y-2 text-sm">{a.history.map((h, i) => <li key={i}><span className="font-semibold">{LABEL[h.status] ?? h.status}</span> <span className="text-xs text-muted">{new Date(h.at).toLocaleString('en-IN')}</span>{h.note ? <div className="text-muted">{h.note}</div> : null}</li>)}</ol>
        </div>
      </div>

      {!closed ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="card space-y-3 p-4">
            <div className="label">Decision</div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm">New status<select className="input mt-1" value={next} onChange={(e) => setNext(e.target.value as AppStatus)}><option value="">Choose</option>{moves.map((m) => <option key={m} value={m}>{LABEL[m]}</option>)}</select></label>
              <input className="input min-w-[200px] flex-1" placeholder="Note to the applicant" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn-primary" disabled={!next || ((next === 'declined') && !note.trim())} onClick={async () => { if (await act('status', { status: next, note }, `Status set to ${LABEL[next as AppStatus]}`)) { setNote(''); setNext(''); } }}>Update</button>
            </div>
            {isIns && a.status === 'approved' ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                <label className="text-sm">Premium (Rs)<input className="input mt-1 w-32" inputMode="numeric" value={premium} onChange={(e) => setPremium(e.target.value.replace(/[^0-9]/g, ''))} /></label>
                <button className="btn-primary" disabled={!active} onClick={() => act('issuePolicy', { premium: Number(premium) || null }, 'Policy issued (simulated)')}>Issue policy</button>
              </div>
            ) : null}
            {!isIns && ['in_review', 'approved', 'submitted'].includes(a.status) ? (
              <div className="border-t border-line pt-3">
                <div className="text-sm font-semibold">Indicative offer</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(['amount', 'rate', 'tenure'] as const).map((k) => <input key={k} className="input w-28" placeholder={k === 'amount' ? 'Amount' : k === 'rate' ? 'Rate %' : 'Months'} value={offer[k]} onChange={(e) => setOffer({ ...offer, [k]: e.target.value.replace(/[^0-9.]/g, '') })} />)}
                  <input className="input min-w-[160px] flex-1" placeholder="Conditions" value={offer.notes} onChange={(e) => setOffer({ ...offer, notes: e.target.value })} />
                  <button className="btn-secondary" disabled={!active || !offer.amount} onClick={() => act('offer', { amount: Number(offer.amount), rate: Number(offer.rate) || null, tenure: Number(offer.tenure) || null, notes: offer.notes }, 'Offer sent')}>Send offer</button>
                </div>
              </div>
            ) : null}
          </div>
          <div className="card space-y-3 p-4">
            <div className="label">Ask the applicant for more</div>
            <div className="flex flex-wrap gap-2">{(product?.documents ?? []).map((d) => <label key={d.id} className="flex items-center gap-1.5 text-sm"><input type="checkbox" className="h-4 w-4" checked={reqDocs.includes(d.id)} onChange={(e) => setReqDocs(e.target.checked ? [...reqDocs, d.id] : reqDocs.filter((x) => x !== d.id))} />{d.label}</label>)}</div>
            <div className="flex gap-2"><input className="input flex-1" placeholder="What do you need?" value={reqNote} onChange={(e) => setReqNote(e.target.value)} />
              <button className="btn-secondary" disabled={a.status === 'more_info' || (!reqNote.trim() && !reqDocs.length)} onClick={async () => { if (await act('requestInfo', { docs: reqDocs, note: reqNote }, 'Request sent to the applicant')) { setReqDocs([]); setReqNote(''); } }}>Request</button></div>
          </div>
        </div>
      ) : <div className="mt-4 inline-flex animate-pop items-center gap-2 rounded-full bg-fill px-4 py-2 text-sm">Case closed: <b>{LABEL[a.status]}</b></div>}

      <div className="card mt-4 p-4">
        <div className="label">Internal notes (not shown to the applicant)</div>
        <div className="mt-2 flex gap-2"><input className="input flex-1" value={internal} onChange={(e) => setInternal(e.target.value)} placeholder="Add a note" /><button className="btn-quiet" disabled={!internal.trim()} onClick={async () => { if (await act('note', { note: internal }, 'Note added')) setInternal(''); }}>Add</button></div>
        <ul className="mt-2 space-y-1 text-sm">{notes.map((n, i) => <li key={i}><span className="text-xs text-muted">{new Date(n.at).toLocaleString('en-IN')}, {n.actor}:</span> {n.action.replace(/^Note on [^:]+: /, '')}</li>)}</ul>
      </div>
      {ok ? <p role="status" className="mt-2 text-sm text-good">{ok}</p> : null}
      {err ? <p role="alert" className="mt-2 text-sm text-bad">{err}</p> : null}
      <Note>Not shown to providers: animal health records beyond the insured animal, signals, messages, voice data. The provider&apos;s own sanction or underwriting process decides final terms. Membership of the society and milk payments are never affected by a decision.</Note>
    </div>
  );
}

function Claims({ d, refresh }: { d: LenderData; refresh: () => Promise<void> }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const act = async (c: ClaimView, status: ClaimStatus) => {
    setErr('');
    try { await postJson('/api/lender', { action: 'claimStatus', claimId: c.id, status, note: notes[c.id] ?? '', amount: status === 'approved' ? c.amountClaimed : undefined }); await refresh(); setNotes({ ...notes, [c.id]: '' }); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div>
      <PageTitle title="Claims" sub="Claims on policies issued by this insurer. Settlement is simulated; no money moves." />
      {err ? <p role="alert" className="mb-2 text-sm text-bad">{err}</p> : null}
      {!d.claims.length ? <p className="text-muted">No claims yet.</p> : null}
      <div className="grid gap-4 xl:grid-cols-2">{d.claims.map((c) => {
        const moves = (CLAIM_TRANSITIONS[c.status as ClaimStatus] ?? []).filter((m) => m !== 'withdrawn');
        return (
          <div key={c.id} className="card p-4">
            <div className="flex items-center justify-between"><span className="font-bold">{c.ref}</span><Chip tone={c.status === 'declined' ? 'bad' : ['approved', 'settled'].includes(c.status) ? 'good' : c.status === 'more_info' ? 'warn' : 'primary'}>{CLAIM_LABEL[c.status as ClaimStatus] ?? c.status}</Chip></div>
            <div className="text-sm text-muted">{c.farmer ?? 'Member'}, policy {c.policyNumber}</div>
            <div className="mt-1 text-sm">{c.reason} on {c.incidentDate}{c.amountClaimed ? `, ${inr(c.amountClaimed)} claimed` : ''}</div>
            <div className="text-sm text-muted">{c.description}</div>
            <ol className="mt-2 space-y-1 text-xs">{c.history.map((h, i) => <li key={i}><b>{CLAIM_LABEL[h.status as ClaimStatus] ?? h.status}</b> {new Date(h.at).toLocaleString('en-IN')}{h.note ? `: ${h.note}` : ''}</li>)}</ol>
            {moves.length ? <div className="mt-3 flex flex-wrap gap-2"><input className="input min-w-[160px] flex-1" placeholder="Note to the farmer" value={notes[c.id] ?? ''} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />
              {moves.map((m) => <button key={m} className={m === 'declined' ? 'btn-quiet' : 'btn-secondary'} onClick={() => act(c, m)}>{CLAIM_LABEL[m]}</button>)}</div> : null}
          </div>
        );
      })}</div>
    </div>
  );
}

function Policies({ d, refresh }: { d: LenderData; refresh: () => Promise<void> }) {
  const act = async (policyId: string, decision: 'renew' | 'decline') => { await postJson('/api/lender', { action: 'renewal', id: '', policyId, decision }).catch(() => undefined); await refresh(); };
  return (
    <div>
      <PageTitle title="Policies" sub="Policies issued through Doodh Setu. All simulated." />
      <div className="overflow-x-auto"><table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Policy</th><th>Animal</th><th>Sum insured</th><th>Premium</th><th>Cover</th><th>Renewal</th><th></th></tr></thead>
        <tbody>{d.policies.map((p) => <tr key={p.id}><td className="font-semibold">{p.number}</td><td>{p.animal ? `${p.animal.type}, ${p.animal.breed}` : '-'}</td><td>{p.sumInsured ? inr(p.sumInsured) : '-'}</td><td>{p.premium ? inr(p.premium) : '-'}</td><td>{p.start} to {p.end}</td><td>{p.renewal.replace(/_/g, ' ')}</td>
          <td>{p.renewal === 'requested' ? <span className="flex gap-1"><button className="btn-secondary !min-h-[32px] px-3 text-xs" onClick={() => act(p.id, 'renew')}>Renew</button><button className="btn-quiet !min-h-[32px] px-3 text-xs" onClick={() => act(p.id, 'decline')}>Decline</button></span> : null}</td></tr>)}</tbody>
      </table></div>
      {!d.policies.length ? <p className="mt-3 text-muted">No policies yet.</p> : null}
    </div>
  );
}

function Products({ d }: { d: LenderData }) {
  return (
    <div>
      <PageTitle title="Product catalogue" sub="Products this provider offers through Doodh Setu. All terms are demo and indicative until verified." />
      <div className="overflow-x-auto"><table className="tbl card w-full overflow-hidden">
        <thead><tr><th>Product</th><th>For</th><th>Type</th><th>Range</th><th>Rate</th><th>Tenure</th><th>Fees</th><th>Status</th></tr></thead>
        <tbody>{d.catalogue.map((p) => <tr key={p.id}><td>{p.name}</td><td className="capitalize">{p.segment}</td><td className="capitalize">{p.type}</td><td>{p.min !== null && p.max !== null ? `${inr(p.min)} - ${inr(p.max)}` : '-'}</td><td>{p.rate !== null ? `${p.rate}%` : 'Set by provider'}</td><td>{p.tenures.length ? `${p.tenures.join('/')} months` : '-'}</td><td>{p.fees ?? '-'}</td><td><Chip tone="warn">{p.termsVerified ? 'Verified' : 'Demo terms'}</Chip></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

function Audit({ d }: { d: LenderData }) {
  return (
    <div>
      <PageTitle title="Audit trail" sub="Consent, access, status, offer, policy and claim events." />
      <div className="card p-4"><ul className="divide-y divide-[#E6EDF5] text-[13px]">{d.audit.filter((x) => /consent|application|DF-|CL-|Requested|Uploaded|Set |offer|policy|Policy|Claim|Note on/i.test(x.action)).map((x, i) => <li key={i} className="grid grid-cols-[150px_1fr] gap-3 py-1.5"><span className="num text-muted">{new Date(x.at).toLocaleString('en-IN')}</span><span><b className="font-semibold">{x.actor}</b>: {x.action}</span></li>)}</ul>
        {d.audit.length === 0 ? <p className="text-muted">No events yet.</p> : null}</div>
    </div>
  );
}
