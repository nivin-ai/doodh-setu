'use client';
import Link from 'next/link';
import { ClientOnly } from '@/components/Providers';
import { Chip, VoiceBadge } from '@/components/ui';
import { useStore } from '@/lib/store';
import { DEMO_DATES, type DemoDateKey } from '@/lib/demo';

const APPS = [
  { href: '/farmer', title: 'Farmer app', who: 'Savitaben, member of Anand Milk Society', desc: 'Voice-first app in Gujarati, Hindi and English: milk, earnings, signals, DairyFin finance, ask by voice.' },
  { href: '/society', title: 'Society dashboard', who: 'Rameshbhai, society secretary', desc: 'Receive approved targets, publish messages in three languages, track members and answer queries.' },
  { href: '/planner', title: 'Planner console', who: 'Priya (planner) and Mr Shah (approver), district union', desc: 'Data health, demand forecasts, product mix, milk gap, incentive design with fairness and cap checks, approvals.' },
  { href: '/lender', title: 'Lender desk (DairyFin)', who: 'Anita, case officer at a demo partner bank', desc: 'Review consented income evidence, request documents and update application status.' },
];

const STEPS: { d: DemoDateKey; app: string; text: string }[] = [
  { d: 'mar', app: 'Planner', text: 'Data health: see each channel on volume vs quality.' },
  { d: 'mar', app: 'Planner', text: 'Demand: forecast heatwave in April lifts curd, lassi and ice cream.' },
  { d: 'mar', app: 'Planner', text: 'Product mix: move milk from powder to paneer and curd; value per litre rises.' },
  { d: 'mar', app: 'Planner', text: 'Milk gap: buffalo milk short in April to June. Design a premium; fix the fairness warning; submit.' },
  { d: 'mar', app: 'Planner', text: 'Switch user to the approver and approve (maker-checker).' },
  { d: 'mar', app: 'Society', text: 'Preview the message in three languages, add a local note, publish.' },
  { d: 'mar', app: 'Farmer', text: 'Hear the signal in Gujarati, see what it is worth, tap "I\'m interested". Ask a question by voice.' },
  { d: 'mar', app: 'Farmer', text: 'Finance: check affordability, compare demo offers, consent and apply.' },
  { d: 'mar', app: 'Lender', text: 'Review the case and request a document; the farmer uploads it; mark approved.' },
  { d: 'apr', app: 'Farmer', text: 'Switch demo date to 30 Apr: earnings show the premium and why the price changed.' },
  { d: 'apr', app: 'Planner', text: 'Monitor: response and the share of value passed to farmers.' },
];

function Home() {
  const s = useStore();
  return (
    <div className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold text-console">Doodh Setu</h1>
        <Chip tone="warn">Prototype v0.1</Chip>
        <VoiceBadge />
      </div>
      <p className="mt-2 max-w-3xl text-muted">
        A demand-to-farmer intelligence platform for a dairy cooperative: better demand data and forecasts, a better product mix, and seasonal signals and price gains passed back to farmers through their village society. Student prototype for the Amul case. All data is synthetic, calibrated to public Indian patterns.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {APPS.map((a) => (
          <Link key={a.href} href={a.href} target="_blank" className="card block p-5 transition hover:border-primary hover:shadow-sm">
            <div className="text-lg font-bold text-primary">{a.title} ↗</div>
            <div className="text-xs font-bold text-muted">{a.who}</div>
            <p className="mt-2 text-sm">{a.desc}</p>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">Each app opens in a new tab. Open them side by side: actions in one appear in the others (same browser).</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card p-5">
          <h2 className="text-lg font-bold">Demo script</h2>
          <ol className="mt-3 space-y-2">
            {STEPS.map((st, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-light text-xs font-bold text-primary">{i + 1}</span>
                <span><b>{st.app}</b> <span className="text-muted">({DEMO_DATES[st.d].label})</span>: {st.text}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-bold">Demo date</h2>
            <div className="mt-3 space-y-2">
              {(Object.keys(DEMO_DATES) as DemoDateKey[]).map((k) => (
                <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${s.demoDate === k ? 'border-primary bg-primary-light' : 'border-line'}`}>
                  <input type="radio" checked={s.demoDate === k} onChange={() => s.set({ demoDate: k })} />
                  <span><b>{DEMO_DATES[k].label}</b><br /><span className="text-xs text-muted">{DEMO_DATES[k].note}</span></span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="font-bold">Demo state</h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Incentive: <b>{s.incentive.status}</b></li>
              <li>Farmer interested: <b>{s.farmer.interested ? 'yes' : 'no'}</b></li>
              <li>Application: <b>{s.application ? s.application.status : 'none'}</b></li>
              <li>Open queries: <b>{s.queries.filter((q) => q.status === 'open').length}</b></li>
            </ul>
            <button className="btn-quiet mt-3 w-full" onClick={() => { if (confirm('Reset the demo to the start?')) s.reset(); }}>Reset demo</button>
          </div>
          <div className="card p-5 text-xs text-muted">
            Voice uses Gnani.ai (Vachana) speech-to-text and text-to-speech when an API key is set on the server. Without a key, the browser&apos;s built-in voice is used, which may not have Gujarati on every device.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <ClientOnly><Home /></ClientOnly>;
}
