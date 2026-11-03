'use client';
// DairyFin applicant workspace, shared by the farmer app and the society dashboard: catalogue,
// product detail, indicative eligibility, data-sharing notice, granular consent, the dynamic
// application form with drafts and documents, and the tracker (more information, offers,
// withdrawal). Insurance policies and claims for farmers. Every term shown comes from the catalogue.
import { Fragment, useMemo, useState } from 'react';
import { postJson } from '@/lib/client/api';
import { CLAIM_LABEL, STATUS_LABEL, STATUS_TONE, indicativeEligibility, validateApplication, type ClaimStatus, type FinProduct } from '@/lib/dairyfin';
import type { AppView, ClaimView, Consent, FarmerFinanceData, PolicyView, SocietyFinanceData } from '@/lib/types/api';
import { inr } from '@/lib/util';
import { Chip } from '../ui';

export const CATEGORY_LABEL: Record<string, string> = {
  identity_kyc: 'Identity and KYC result (masked Aadhaar and PAN)', land_property: 'Land and property records', credit_history: 'Credit bureau score and loans',
  milk_income: 'Milk quantity and payments, last 12 months', livestock: 'Animal details (ear tag, breed, health)', society_operations: 'Society operating data (members, collection, milk quality)',
};
const TYPE_LABEL = { loan: 'Loan', insurance: 'Insurance', prepaid: 'Prepaid' } as const;
const when = (s: string) => new Date(s).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const range = (p: FinProduct) => (p.min !== null && p.max !== null ? `${inr(p.min)} to ${inr(p.max)}` : 'Set by the provider');
const OPEN: AppView['status'][] = ['draft', 'submitted', 'in_review', 'more_info', 'approved'];

type Data = (FarmerFinanceData & { kind: 'farmer' }) | (SocietyFinanceData & { kind: 'society' });
type View = { v: 'home' } | { v: 'catalogue' } | { v: 'detail'; id: string } | { v: 'apply'; id: string; draft?: AppView } | { v: 'done'; ref: string; status: string }
  | { v: 'apps' } | { v: 'app'; id: string } | { v: 'policies' } | { v: 'claim'; policyId: string };

export default function Workspace({ data, url, refresh, start = 'home' }: { data: Data; url: string; refresh: () => Promise<void>; start?: 'home' | 'catalogue' | 'apps' | 'policies' }) {
  const [view, setView] = useState<View>({ v: start });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null);
  const go = (v: View) => { setView(v); setMsg(null); if (typeof window !== 'undefined') window.scrollTo(0, 0); };
  const post = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true); setMsg(null);
    try { const r = await postJson<Record<string, unknown>>(url, body); await refresh(); if (ok) setMsg({ tone: 'good', text: ok }); return r; }
    catch (e) { setMsg({ tone: 'bad', text: e instanceof Error ? e.message : String(e) }); return null; }
    finally { setBusy(false); }
  };
  const ctx = { data, go, post, busy };
  const back = (to: View, label = 'Back') => <button className="mb-3 text-sm font-semibold text-primary" onClick={() => go(to)}>&larr; {label}</button>;

  return (
    <div className="space-y-3">
      {msg ? <div role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.tone === 'good' ? 'bg-good-light text-good' : 'bg-bad-light text-bad'}`}>{msg.text}</div> : null}
      {view.v === 'home' ? <Home {...ctx} /> : null}
      {view.v === 'catalogue' ? <>{back({ v: 'home' })}<Catalogue {...ctx} /></> : null}
      {view.v === 'detail' ? <>{back({ v: 'catalogue' }, 'All products')}<Detail {...ctx} id={view.id} /></> : null}
      {view.v === 'apply' ? <>{back({ v: 'detail', id: view.id })}<Apply key={view.draft?.id ?? view.id} {...ctx} id={view.id} draft={view.draft} /></> : null}
      {view.v === 'done' ? <Done {...ctx} refNo={view.ref} status={view.status} /> : null}
      {view.v === 'apps' ? <>{back({ v: 'home' })}<Apps {...ctx} /></> : null}
      {view.v === 'app' ? <>{back({ v: 'apps' }, 'All applications')}<AppDetail {...ctx} id={view.id} /></> : null}
      {view.v === 'policies' && data.kind === 'farmer' ? <>{back({ v: 'home' })}<Policies {...ctx} data={data} /></> : null}
      {view.v === 'claim' && data.kind === 'farmer' ? <>{back({ v: 'policies' }, 'Policies')}<ClaimForm {...ctx} data={data} policyId={view.policyId} /></> : null}
    </div>
  );
}

type Ctx = { data: Data; go: (v: View) => void; post: (b: Record<string, unknown>, ok?: string) => Promise<Record<string, unknown> | null>; busy: boolean };

export function Safeguards({ items }: { items: string[] }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary-light/60 p-4">
      <div className="text-sm font-bold text-primary">Your cooperative safeguards</div>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-ink">{items.map((s) => <li key={s}>{s}</li>)}</ul>
    </div>
  );
}

function Home({ data, go }: Ctx) {
  const open = data.applications.filter((a) => OPEN.includes(a.status));
  const tiles: [View, string, string][] = [
    [{ v: 'catalogue' }, data.kind === 'farmer' ? 'Explore loans and insurance' : 'Explore society finance', `${data.products.length} products, demo terms`],
    [{ v: 'apps' }, 'My applications', open.length ? `${open.length} open` : 'None open'],
  ];
  if (data.kind === 'farmer') tiles.push([{ v: 'policies' }, 'Policies and claims', `${data.policies.length} policies, ${data.claims.length} claims`]);
  return (
    <>
      {data.kind === 'society' ? (
        <div className="card p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">Representative: {data.signatory.name}</span>
            <Chip tone={data.signatory.authorised ? 'good' : 'warn'}>{data.signatory.authorised ? 'Authorised signatory (demo)' : 'Not authorised to sign'}</Chip></div>
          {data.operations ? <div className="mt-2 text-muted">{data.operations.name}: {data.operations.members} members, about {data.operations.avgDailyLitres} L collected a day (last 90 days){data.operations.avgFat ? `, average fat ${data.operations.avgFat}%` : ''}. Shared with a lender only if the society consents.</div> : null}
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {tiles.map(([v, t, s]) => (
          <button key={t} onClick={() => go(v)} className="card flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:border-primary/40 active:scale-[0.99]">
            <span><span className="block font-semibold">{t}</span><span className="text-xs text-muted">{s}</span></span><span className="text-muted">&rsaquo;</span>
          </button>
        ))}
      </div>
      {open.slice(0, 3).map((a) => <AppRow key={a.id} a={a} onOpen={() => go({ v: 'app', id: a.id })} />)}
      <Safeguards items={data.safeguards} />
    </>
  );
}

function Catalogue({ data, go }: Ctx) {
  const [type, setType] = useState<'all' | 'loan' | 'insurance'>('all');
  const [cat, setCat] = useState('all');
  const cats = [...new Set(data.products.map((p) => p.category))];
  const list = data.products.filter((p) => (type === 'all' || p.type === type) && (cat === 'all' || p.category === cat));
  const hasIns = data.products.some((p) => p.type === 'insurance');
  return (
    <>
      <div className="font-display text-[24px] font-bold leading-tight">{data.kind === 'farmer' ? 'Loans and insurance' : 'Finance for the society'}</div>
      <div className="flex flex-wrap items-center gap-2">
        {hasIns ? (['all', 'loan', 'insurance'] as const).map((t) => <button key={t} onClick={() => setType(t)} className={`rounded-full px-3 py-1 text-sm ${type === t ? 'bg-primary text-white' : 'bg-fill'}`}>{t === 'all' ? 'All' : TYPE_LABEL[t]}</button>) : null}
        <select aria-label="Category" className="input !w-auto !py-1 text-sm" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="all">All categories</option>{cats.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((p) => (
          <div key={p.id} className="card flex flex-col p-4">
            <div className="flex items-start justify-between gap-2"><div><div className="font-bold">{p.name}</div><div className="text-sm text-muted">{p.provider}</div></div>
              <Chip tone={p.status === 'active' ? 'warn' : 'neutral'}>{p.status === 'active' ? 'Demo terms' : 'Paused'}</Chip></div>
            <p className="mt-2 text-sm">{p.description}</p>
            <div className="mt-2 text-xs text-muted">{TYPE_LABEL[p.type]}, {p.category.replace(/_/g, ' ')}{p.type === 'loan' ? `, ${range(p)}` : ''}{p.tenures.length ? `, ${p.tenures.join('/')} months` : ''}</div>
            <button className="btn-secondary mt-3 w-full" onClick={() => go({ v: 'detail', id: p.id })}>View details</button>
          </div>
        ))}
      </div>
      {!list.length ? <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No products match these filters.</div> : null}
    </>
  );
}

function facts(data: Data) {
  return data.kind === 'farmer' ? { ...data.facts, animalTagged: data.cattle.some((c) => c.tag && !c.insured) } : data.facts;
}
const STATE = { met: ['good', 'Looks met'], not_met: ['bad', 'Not met'], unknown: ['neutral', 'Provider checks'] } as const;
function Eligibility({ p, data }: { p: FinProduct; data: Data }) {
  const rows = indicativeEligibility(p, facts(data));
  if (!rows.length) return null;
  return (
    <div>
      <div className="label">Eligibility (indicative only)</div>
      <ul className="mt-1 space-y-1.5">{rows.map((r) => <li key={r.id} className="flex items-start justify-between gap-2 text-sm"><span>{r.label}</span><Chip tone={STATE[r.state][0]}>{STATE[r.state][1]}</Chip></li>)}</ul>
      <p className="mt-1 text-xs text-muted">This is a guide from your own records, not a decision. {p.provider} decides.</p>
    </div>
  );
}

function Detail({ data, go, id }: Ctx & { id: string }) {
  const p = data.products.find((x) => x.id === id);
  if (!p) return <div className="text-muted">Product not found.</div>;
  const row = (k: string, v: React.ReactNode) => <Fragment key={k}><span className="text-muted">{k}</span><span>{v}</span></Fragment>;
  return (
    <div className="card space-y-4 p-4">
      <div><div className="flex flex-wrap items-center gap-2"><span className="font-display text-[22px] font-bold leading-tight">{p.name}</span><Chip tone="warn">Demo terms</Chip></div>
        <div className="text-sm text-muted">{p.provider}, {TYPE_LABEL[p.type].toLowerCase()}</div></div>
      <p className="text-sm">{p.description}</p>
      {p.benefits.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{p.benefits.map((b) => <li key={b}>{b}</li>)}</ul> : null}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {p.type !== 'insurance' ? row('Amount', range(p)) : null}
        {p.type === 'loan' ? row('Interest rate', p.rate !== null ? `${p.rate}% a year (indicative)` : 'Set by the lender') : null}
        {p.tenures.length ? row('Tenure', `${p.tenures.join(', ')} months`) : null}
        {row('Fees', p.fees ?? 'Set by the provider')}
        {p.coverage?.period ? row('Cover period', p.coverage.period) : null}
        {p.coverage?.options?.length ? row('Covers', p.coverage.options.join(', ')) : null}
        {p.type === 'insurance' ? row('Premium', 'Quoted by the insurer after review') : null}
      </div>
      {p.exclusions.length ? <div><div className="label">Not covered</div><ul className="mt-1 list-disc pl-5 text-sm">{p.exclusions.map((e) => <li key={e}>{e}</li>)}</ul></div> : null}
      <Eligibility p={p} data={data} />
      <div><div className="label">Documents needed</div><ul className="mt-1 list-disc pl-5 text-sm">{p.documents.map((d) => <li key={d.id}>{d.label}</li>)}</ul></div>
      <div><div className="label">Information shared if you apply and agree</div><ul className="mt-1 list-disc pl-5 text-sm">{p.dataCategories.map((c) => <li key={c}>{CATEGORY_LABEL[c] ?? c}</li>)}</ul></div>
      <p className="rounded-lg bg-warn-light px-3 py-2 text-xs text-warn">{p.disclaimer}</p>
      {p.status === 'active' ? <button className="btn-primary w-full" onClick={() => go({ v: 'apply', id: p.id })}>Start application</button> : <div className="text-sm text-muted">Not open for applications.</div>}
    </div>
  );
}

// ---------------------------------------------------------------- the application wizard
function Apply({ data, go, post, busy, id, draft }: Ctx & { id: string; draft?: AppView }) {
  const p = data.products.find((x) => x.id === id)!;
  const [step, setStep] = useState(draft ? 2 : 0);
  const [cats, setCats] = useState<string[]>(p.dataCategories);
  const [ticks, setTicks] = useState([false, false, false]);
  const [authority, setAuthority] = useState(false);
  const [amount, setAmount] = useState<string>(draft?.amount ? String(draft.amount) : p.min !== null ? String(p.min) : '');
  const [tenure, setTenure] = useState<string>(draft?.tenure ? String(draft.tenure) : p.tenures[0] ? String(p.tenures[0]) : '');
  const [answers, setAnswers] = useState<Record<string, unknown>>(draft?.answers ?? {});
  const [docs, setDocs] = useState<string[]>(draft ? draft.docs.filter((d) => d.status === 'received').map((d) => d.id) : []);
  const [cattleId, setCattleId] = useState<string>(draft?.insuredAnimal?.id ?? '');
  const animals = data.kind === 'farmer' ? data.cattle : [];
  const society = data.kind === 'society';
  const body = (submit: boolean) => ({
    action: 'save', id: draft?.id, productCode: p.id, amount: p.type === 'loan' ? Number(amount) : null, tenure: p.type === 'loan' ? Number(tenure) : null, answers, docs, cattleId: cattleId || null, submit,
    consent: { categories: cats, statements: ticks.filter(Boolean).length }, confirmAuthority: authority,
  });
  const errs = validateApplication(p, { amount: Number(amount), tenure: Number(tenure), answers, docs }, true);
  if (p.type === 'insurance' && !cattleId) errs.push('Choose the animal to insure');
  const steps = ['Check', 'Notice', 'Consent', 'Details'];
  const save = async (submit: boolean) => {
    const r = await post(body(submit), submit ? undefined : 'Draft saved. You can finish it later from My applications.');
    if (r && submit) go({ v: 'done', ref: String(r.ref), status: String(r.status) });
  };
  return (
    <div className="card space-y-4 p-4">
      <div><div className="font-display text-[20px] font-bold leading-tight">{p.name}</div><div className="text-sm text-muted">Application to {p.provider}{draft ? `, draft ${draft.ref}` : ''}</div></div>
      <ol className="flex gap-1 text-[12px]">{steps.map((s, i) => <li key={s} className={`flex-1 rounded-full px-2 py-1 text-center font-semibold ${i === step ? 'bg-primary text-white' : i < step ? 'bg-primary-light text-primary' : 'bg-fill text-muted'}`}>{i + 1}. {s}</li>)}</ol>

      {step === 0 ? (
        <>
          <Eligibility p={p} data={data} />
          <div><div className="label">Keep these documents ready</div><ul className="mt-1 list-disc pl-5 text-sm">{p.documents.map((d) => <li key={d.id}>{d.label}</li>)}</ul></div>
          {society ? <p className="text-sm">Only an authorised representative of the society can submit. {data.signatory.authorised ? 'You are recorded as an authorised signatory (demo).' : 'Your account is not recorded as an authorised signatory, so you can save a draft but not submit.'}</p> : null}
          <button className="btn-primary w-full" onClick={() => setStep(1)}>Continue</button>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <div className="label">How the information is used</div>
          <dl className="space-y-2 text-sm">
            {[['What can be shared', p.dataCategories.map((c) => CATEGORY_LABEL[c] ?? c).join('; ')], ['Why', `Only to assess and process this ${TYPE_LABEL[p.type].toLowerCase()} application`],
              ['Who receives it', `${p.provider} only. Doodh Setu and the ${society ? 'union' : 'society'} do not decide.`], ['How long', 'Until the application is decided, then as long as the provider\'s legal rules require'],
              ['Your choice', 'You choose each kind of information on the next page. You can withdraw consent at any time; sharing stops at once.'],
            ].map(([k, v]) => <div key={k}><dt className="font-semibold">{k}</dt><dd className="text-muted">{v}</dd></div>)}
          </dl>
          <button className="btn-primary w-full" onClick={() => setStep(2)}>I have read this</button>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <div className="label">Choose what {p.provider} may see</div>
          <div className="space-y-2">{p.dataCategories.map((c) => (
            <label key={c} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />{CATEGORY_LABEL[c] ?? c}</label>
          ))}</div>
          {cats.length < p.dataCategories.length ? <p className="text-xs text-warn">Sharing less is your right. The provider may ask for it later or be unable to assess the application.</p> : null}
          <div className="label pt-2">Please confirm</div>
          {[`I agree that the information I chose is shared with ${p.provider} for this application only.`, 'I understand the provider decides, and Doodh Setu does not guarantee approval.', 'I know I can withdraw this consent at any time from My applications.'].map((s, i) => (
            <label key={s} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={ticks[i]} onChange={(e) => setTicks(ticks.map((t, j) => (j === i ? e.target.checked : t)))} />{s}</label>
          ))}
          {society ? <label className="flex items-start gap-2 text-sm font-semibold"><input type="checkbox" className="mt-1 h-4 w-4" checked={authority} onChange={(e) => setAuthority(e.target.checked)} />I am authorised by the society board to apply and to give this consent for the society.</label> : null}
          <button className="btn-primary w-full" onClick={() => setStep(3)}>Continue</button>
        </>
      ) : null}

      {step === 3 ? (
        <>
          {p.type === 'loan' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm"><span className="label">Amount (Rs)</span><input className="input mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /><span className="text-xs text-muted">{range(p)}</span></label>
              {p.tenures.length ? <label className="block text-sm"><span className="label">Tenure</span><select className="input mt-1" value={tenure} onChange={(e) => setTenure(e.target.value)}>{p.tenures.map((t) => <option key={t} value={t}>{t} months</option>)}</select></label> : null}
            </div>
          ) : null}
          {p.type === 'insurance' ? (
            <label className="block text-sm"><span className="label">Animal to insure</span>
              <select className="input mt-1" value={cattleId} onChange={(e) => setCattleId(e.target.value)}>
                <option value="">Choose an animal</option>
                {animals.map((a) => <option key={a.id} value={a.id} disabled={a.insured || !a.tag}>{a.type === 'buffalo' ? 'Buffalo' : 'Cow'}, {a.breed}, tag {a.tag ?? 'none'}{a.insured ? ' (already insured)' : ''}</option>)}
              </select></label>
          ) : null}
          {p.fields.map((f) => (
            <label key={f.id} className="block text-sm"><span className="label">{f.label}{f.required ? ' *' : ''}</span>
              {f.type === 'select'
                ? <select className="input mt-1" value={String(answers[f.id] ?? '')} onChange={(e) => setAnswers({ ...answers, [f.id]: e.target.value })}><option value="">Choose</option>{f.options?.map((o) => <option key={o}>{o}</option>)}</select>
                : <input className="input mt-1" inputMode={f.type === 'number' ? 'numeric' : undefined} value={String(answers[f.id] ?? '')} onChange={(e) => setAnswers({ ...answers, [f.id]: f.type === 'number' ? e.target.value.replace(/[^0-9]/g, '') : e.target.value })} />}
            </label>
          ))}
          <div><div className="label">Documents</div>
            <ul className="mt-1 space-y-1.5">{p.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 text-sm"><span>{d.label}</span>
                {docs.includes(d.id) ? <Chip tone="good">Added (simulated)</Chip> : <button className="btn-quiet !min-h-[32px] px-3 text-xs" onClick={() => setDocs([...docs, d.id])}>Add (simulated)</button>}</li>
            ))}</ul>
            <p className="mt-1 text-xs text-muted">Prototype: no file is uploaded. Missing documents can be added later.</p>
          </div>
          {errs.length ? <ul className="list-disc pl-5 text-xs text-bad">{errs.map((e) => <li key={e}>{e}</li>)}</ul> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button className="btn-quiet" disabled={busy} onClick={() => save(false)}>Save draft</button>
            <button className="btn-primary" disabled={busy || errs.length > 0 || ticks.some((t) => !t) || !cats.length || (society && (!authority || !data.signatory.authorised))} onClick={() => save(true)}>Submit to {p.provider}</button>
          </div>
          {ticks.some((t) => !t) ? <button className="text-xs font-semibold text-primary" onClick={() => setStep(2)}>Consent not complete: go back to step 3</button> : null}
        </>
      ) : null}
    </div>
  );
}

function Done({ go, refNo, status }: Ctx & { refNo: string; status: string }) {
  return (
    <div className="card space-y-3 p-5 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good-light text-2xl text-good">&#10003;</div>
      <div className="font-display text-[22px] font-bold">Application {status === 'submitted' ? 'sent' : 'saved'}</div>
      <div className="text-sm">Reference <span className="font-bold">{refNo}</span></div>
      <p className="text-sm text-muted">This is not an approval. The provider reviews it and decides. You will see every update in My applications.</p>
      <button className="btn-primary w-full" onClick={() => go({ v: 'apps' })}>Track my applications</button>
    </div>
  );
}

function AppRow({ a, onOpen }: { a: AppView; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="card flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:border-primary/40">
      <span className="min-w-0"><span className="block font-semibold">{a.product}</span><span className="block text-xs text-muted">{a.ref}, {a.lender}{a.amount ? `, ${inr(a.amount)}` : ''}</span></span>
      <span className="flex shrink-0 flex-col items-end gap-1"><Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip>{a.offerStatus === 'pending' ? <Chip tone="marigold">Offer to review</Chip> : null}</span>
    </button>
  );
}

function Apps({ data, go }: Ctx) {
  const [show, setShow] = useState<'open' | 'all'>('open');
  const list = data.applications.filter((a) => show === 'all' || OPEN.includes(a.status));
  return (
    <>
      <div className="flex items-center justify-between"><div className="font-display text-[24px] font-bold leading-tight">My applications</div>
        <select aria-label="Show" className="input !w-auto !py-1 text-sm" value={show} onChange={(e) => setShow(e.target.value as 'open' | 'all')}><option value="open">Open</option><option value="all">All</option></select></div>
      {list.map((a) => <AppRow key={a.id} a={a} onOpen={() => go({ v: 'app', id: a.id })} />)}
      {!list.length ? <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No applications yet. <button className="font-semibold text-primary" onClick={() => go({ v: 'catalogue' })}>Explore products</button></div> : null}
      <Consents data={data} />
    </>
  );
}

function Consents({ data }: { data: Data }) {
  const [busy, setBusy] = useState<string | null>(null);
  const active = data.consents.filter((c) => c.status === 'active' && c.lenderId);
  if (!data.consents.length) return null;
  const withdraw = async (c: Consent) => {
    setBusy(c.id);
    try { await postJson(data.kind === 'farmer' ? '/api/dairyfin/farmer' : '/api/dairyfin/society', { action: 'withdrawConsent', consentId: c.id }); } finally { setBusy(null); }
  };
  return (
    <div className="card p-4">
      <div className="label">Consents you have given</div>
      {!active.length ? <p className="mt-1 text-sm text-muted">No active consents for finance providers.</p> : null}
      <ul className="mt-2 space-y-2">{data.consents.filter((c) => c.lenderId).map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2 text-sm last:border-0">
          <span><span className="font-semibold">{c.code}</span> {c.recipient}: {c.purpose}<span className="block text-xs text-muted">{c.categories.map((x) => CATEGORY_LABEL[x]?.split(' (')[0] ?? x).join(', ')}{c.noticeVersion ? `, notice ${c.noticeVersion}` : ''}</span></span>
          {c.status === 'active' ? <button className="btn-quiet !min-h-[32px] px-3 text-xs" disabled={busy === c.id} onClick={() => withdraw(c)}>Withdraw</button> : <Chip>Withdrawn</Chip>}
        </li>
      ))}</ul>
    </div>
  );
}

function AppDetail({ data, go, post, busy, id }: Ctx & { id: string }) {
  const a = data.applications.find((x) => x.id === id);
  const [reply, setReply] = useState('');
  const product = useMemo(() => data.products.find((p) => p.id === a?.productCode), [data.products, a?.productCode]);
  if (!a) return <div className="text-muted">Application not found.</div>;
  const consent = data.consents.find((c) => c.code === a.consentCode && c.lenderId === a.lenderId);
  const docLabel = (d: string) => product?.documents.find((x) => x.id === d)?.label ?? d;
  const policy = data.kind === 'farmer' ? data.policies.find((p) => p.number.endsWith(a.ref.replace(/^DF-/, ''))) : null;
  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{a.product}</span><Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip></div>
        <div className="text-sm text-muted">{a.ref}, {a.lender}{a.amount ? `, ${inr(a.amount)}` : ''}{a.tenure ? `, ${a.tenure} months` : ''}</div>
        {a.insuredAnimal ? <div className="mt-1 text-sm">Animal: {a.insuredAnimal.type}, {a.insuredAnimal.breed}</div> : null}
        {Object.entries(a.answers).length ? <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 text-sm">{Object.entries(a.answers).map(([k, v]) => <Fragment key={k}><span className="text-muted">{product?.fields.find((f) => f.id === k)?.label ?? k}</span><span>{String(v)}</span></Fragment>)}</div> : null}
        {consent ? <div className="mt-2 text-xs text-muted">Consent {consent.code}: {consent.status === 'active' ? 'active' : 'withdrawn, the provider can no longer see your information'}</div> : null}
      </div>
      {a.status === 'draft' && product ? <button className="btn-primary w-full" onClick={() => go({ v: 'apply', id: product.id, draft: a })}>Continue this draft</button> : null}
      {a.offer && a.offerStatus ? (
        <div className={`rounded-xl border p-4 ${a.offerStatus === 'pending' ? 'border-marigold-deep/40 bg-warn-light' : 'border-line bg-white'}`}>
          <div className="font-bold">Indicative offer from {a.lender}</div>
          <div className="mt-1 text-sm">{a.offer.amount ? inr(a.offer.amount) : ''}{a.offer.rate ? `, ${a.offer.rate}% a year` : ''}{a.offer.tenure ? `, ${a.offer.tenure} months` : ''}</div>
          {a.offer.notes ? <div className="text-sm text-muted">{a.offer.notes}</div> : null}
          <p className="mt-1 text-xs text-muted">An offer is not a sanction. The provider completes its own checks.</p>
          {a.offerStatus === 'pending' ? <div className="mt-2 grid grid-cols-2 gap-2"><button className="btn-quiet" disabled={busy} onClick={() => post({ action: 'offer', id: a.id, decision: 'decline' }, 'Offer declined')}>Decline</button><button className="btn-primary" disabled={busy} onClick={() => post({ action: 'offer', id: a.id, decision: 'accept' }, 'Offer accepted')}>Accept</button></div>
            : <Chip tone={a.offerStatus === 'accepted' ? 'good' : 'neutral'}>You {a.offerStatus} this offer</Chip>}
        </div>
      ) : null}
      {a.status === 'more_info' ? (
        <div className="rounded-xl border border-marigold-deep/40 bg-warn-light p-4">
          <div className="font-bold text-warn">{a.lender} needs more information</div>
          <div className="text-sm">{[...a.history].reverse().find((h) => h.status === 'more_info')?.note}</div>
          <textarea className="input mt-2" rows={2} placeholder="Your reply" value={reply} onChange={(e) => setReply(e.target.value)} />
          <button className="btn-primary mt-2 w-full" disabled={busy || !reply.trim()} onClick={async () => { if (await post({ action: 'respond', id: a.id, note: reply }, 'Reply sent')) setReply(''); }}>Send reply</button>
        </div>
      ) : null}
      {a.docs.length ? (
        <div className="card p-4"><div className="label">Documents</div>
          <ul className="mt-1 space-y-1.5">{a.docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-sm"><span>{docLabel(d.id)}</span>
              {d.status === 'received' ? <Chip tone="good">Received</Chip> : ['declined', 'withdrawn', 'policy_issued'].includes(a.status) ? <Chip>{d.status}</Chip>
                : <button className="btn-quiet !min-h-[32px] px-3 text-xs" disabled={busy} onClick={() => post({ action: 'uploadDoc', id: a.id, doc: d.id }, 'Document added (simulated)')}>{d.status === 'requested' ? 'Requested: add' : 'Add'} (simulated)</button>}</li>
          ))}</ul></div>
      ) : null}
      {policy ? <div className="card p-4 text-sm"><div className="font-bold">Policy {policy.number}</div><div className="text-muted">Cover {policy.start} to {policy.end}, simulated</div></div> : null}
      <div className="card p-4">
        <div className="label">Status history</div>
        <ol className="mt-3 space-y-4 border-l-2 border-line pl-5">
          {a.history.map((h, i) => (
            <li key={i} className="relative"><span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-white ${i === a.history.length - 1 ? 'bg-primary' : 'bg-line'}`} />
              <div className="font-semibold">{STATUS_LABEL[h.status] ?? h.status}</div><div className="text-xs text-muted">{when(h.at)}</div><div className="text-sm">{h.note}</div></li>
          ))}
        </ol>
      </div>
      <p className="text-sm text-muted">{a.lender} makes every decision. Doodh Setu does not guarantee approval.</p>
      {['draft', 'submitted', 'in_review', 'more_info', 'approved'].includes(a.status) ? <button className="btn-quiet w-full" disabled={busy} onClick={() => post({ action: 'withdraw', id: a.id }, a.status === 'draft' ? 'Draft discarded' : 'Application withdrawn and consent withdrawn')}>{a.status === 'draft' ? 'Discard draft' : 'Withdraw application'}</button> : null}
    </div>
  );
}

// ---------------------------------------------------------------- farmer insurance: policies and claims
function Policies({ data, go, post, busy }: Ctx & { data: FarmerFinanceData & { kind: 'farmer' } }) {
  return (
    <>
      <div className="font-display text-[24px] font-bold leading-tight">Policies and claims</div>
      {!data.policies.length ? <div className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">No policies yet. <button className="font-semibold text-primary" onClick={() => go({ v: 'catalogue' })}>See cattle insurance</button></div> : null}
      {data.policies.map((p: PolicyView) => (
        <div key={p.id} className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{p.number}</span><span className="flex gap-1"><Chip tone={p.status === 'active' ? 'good' : 'neutral'}>{p.status}</Chip>{p.simulated ? <Chip tone="warn">Simulated</Chip> : null}</span></div>
          <div className="text-sm text-muted">{p.insurer}{p.animal ? `, ${p.animal.type} (${p.animal.breed})` : ''}</div>
          <div className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm"><span className="text-muted">Cover</span><span>{p.start} to {p.end}</span>
            <span className="text-muted">Sum insured</span><span>{p.sumInsured ? inr(p.sumInsured) : 'As set by insurer'}</span><span className="text-muted">Premium</span><span>{p.premium ? inr(p.premium) : 'Quoted by insurer'}</span>
            <span className="text-muted">Renewal</span><span>{p.renewal.replace(/_/g, ' ')}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn-quiet" disabled={busy || p.renewal === 'requested' || p.status !== 'active'} onClick={() => post({ action: 'renew', policyId: p.id }, 'Renewal request sent to the insurer')}>{p.renewal === 'requested' ? 'Renewal requested' : 'Request renewal'}</button>
            <button className="btn-primary" disabled={p.status !== 'active'} onClick={() => go({ v: 'claim', policyId: p.id })}>Make a claim</button>
          </div>
        </div>
      ))}
      {data.claims.map((c) => <ClaimCard key={c.id} c={c} post={post} busy={busy} />)}
    </>
  );
}

function ClaimCard({ c, post, busy }: { c: ClaimView; post: Ctx['post']; busy: boolean }) {
  const [reply, setReply] = useState('');
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">Claim {c.ref}</span><Chip tone={c.status === 'settled' || c.status === 'approved' ? 'good' : c.status === 'declined' ? 'bad' : c.status === 'more_info' ? 'warn' : 'primary'}>{CLAIM_LABEL[c.status as ClaimStatus] ?? c.status}</Chip></div>
      <div className="text-sm text-muted">Policy {c.policyNumber}, {c.reason}, {c.incidentDate}{c.amountClaimed ? `, ${inr(c.amountClaimed)} claimed` : ''}</div>
      <ol className="mt-2 space-y-1 text-sm">{c.history.map((h, i) => <li key={i}><span className="font-semibold">{CLAIM_LABEL[h.status as ClaimStatus] ?? h.status}</span> <span className="text-xs text-muted">{when(h.at)}</span>{h.note ? <div className="text-muted">{h.note}</div> : null}</li>)}</ol>
      {c.status === 'more_info' ? <><textarea className="input mt-2" rows={2} placeholder="Your reply" value={reply} onChange={(e) => setReply(e.target.value)} /><button className="btn-primary mt-2 w-full" disabled={busy || !reply.trim()} onClick={() => post({ action: 'claimRespond', claimId: c.id, note: reply }, 'Reply sent')}>Send reply</button></> : null}
      {['submitted', 'more_info'].includes(c.status) ? <button className="btn-quiet mt-2 w-full" disabled={busy} onClick={() => post({ action: 'claimWithdraw', claimId: c.id }, 'Claim withdrawn')}>Withdraw claim</button> : null}
      <p className="mt-2 text-xs text-muted">The insurer decides every claim. Settlement here is simulated; no money moves.</p>
    </div>
  );
}

function ClaimForm({ data, go, post, busy, policyId }: Ctx & { data: FarmerFinanceData & { kind: 'farmer' }; policyId: string }) {
  const policy = data.policies.find((p) => p.id === policyId);
  const product = data.products.find((p) => p.id === policy?.productCode);
  const reasons = product?.claimReasons.length ? product.claimReasons : ['Death of the animal'];
  const [reason, setReason] = useState(reasons[0]);
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState(policy?.sumInsured ? String(policy.sumInsured) : '');
  const [docs, setDocs] = useState<string[]>([]);
  if (!policy) return null;
  const DOCS = [['vet_report', 'Veterinary or post-mortem report'], ['photo', 'Photo of the animal with ear tag'], ['society_letter', 'Society letter']];
  return (
    <div className="card space-y-3 p-4">
      <div className="font-display text-[20px] font-bold">Claim on {policy.number}</div>
      <label className="block text-sm"><span className="label">What happened?</span><select className="input mt-1" value={reason} onChange={(e) => setReason(e.target.value)}>{reasons.map((r) => <option key={r}>{r}</option>)}</select></label>
      <label className="block text-sm"><span className="label">Date of the incident</span><input type="date" className="input mt-1" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="block text-sm"><span className="label">Describe what happened</span><textarea className="input mt-1" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <label className="block text-sm"><span className="label">Amount claimed (Rs)</span><input className="input mt-1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} /></label>
      <div><div className="label">Documents (simulated)</div>{DOCS.map(([id, l]) => <label key={id} className="mt-1 flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={docs.includes(id)} onChange={(e) => setDocs(e.target.checked ? [...docs, id] : docs.filter((d) => d !== id))} />{l}</label>)}</div>
      <button className="btn-primary w-full" disabled={busy || !date || !desc.trim()} onClick={async () => { if (await post({ action: 'claim', policyId, reason, date, description: desc, amount: Number(amount) || null, docs }, 'Claim submitted to the insurer')) go({ v: 'policies' }); }}>Submit claim</button>
      <p className="text-xs text-muted">The insurer reviews and decides. Doodh Setu does not decide claims.</p>
    </div>
  );
}
