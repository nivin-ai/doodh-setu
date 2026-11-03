'use client';
import Link from 'next/link';
import { ClientOnly } from '@/components/Providers';
import { Chip, VoiceBadge } from '@/components/ui';
import { IconChevron } from '@/components/icons';
import { useStore } from '@/lib/store';
import { DEMO_DATES, type DemoDateKey } from '@/lib/demo';

const APPS = [
  { href: '/farmer', title: 'Farmer app', who: 'Savitaben, member of Anand Milk Society', desc: 'Voice-first app in Gujarati, Hindi and English: milk, earnings, signals, DairyFin finance, ask by voice.' },
  { href: '/society', title: 'Society dashboard', who: 'Rameshbhai, society secretary', desc: 'Receive approved targets, publish messages in three languages, track members and answer queries.' },
  { href: '/planner', title: 'Planner console', who: 'Priya (planner) and Mr Shah (approver)', desc: 'One screen: demand forecast, product mix, milk gap and incentive with approval, and results.' },
  { href: '/lender', title: 'Lender desk (DairyFin)', who: 'Anita, case officer at a demo partner bank', desc: 'Review consented income evidence, request documents and update application status.' },
];

const STEPS: { d: DemoDateKey; app: string; text: string }[] = [
  { d: 'mar', app: 'Planner', text: 'Overview: headline numbers and data health at the top of the one-screen console.' },
  { d: 'mar', app: 'Planner', text: 'Section 1, Demand: forecast heatwave in April lifts curd, lassi and ice cream.' },
  { d: 'mar', app: 'Planner', text: 'Section 2, Product mix: move milk from powder to paneer and curd; value per litre rises. Accept the plan.' },
  { d: 'mar', app: 'Planner', text: 'Section 3: buffalo milk short in April to June. Set the premium; fix the fairness warning; submit.' },
  { d: 'mar', app: 'Planner', text: 'Switch user to the approver and approve in section 3 (maker-checker).' },
  { d: 'mar', app: 'Society', text: 'Preview the message in three languages, add a local note, publish.' },
  { d: 'mar', app: 'Farmer', text: 'Hear the signal in Gujarati, see what it is worth, tap "I\'m interested". Ask a question by voice.' },
  { d: 'mar', app: 'Farmer', text: 'Finance: check affordability, compare demo offers, consent and apply.' },
  { d: 'mar', app: 'Lender', text: 'Review the case and request a document; the farmer uploads it; mark approved.' },
  { d: 'apr', app: 'Farmer', text: 'Switch demo date to 30 Apr: earnings show the premium and why the price changed.' },
  { d: 'apr', app: 'Planner', text: 'Section 4, Results: response and the share of value passed to farmers.' },
];

// The loop the platform closes: city demand reaches the union, the union signals the society,
// the society tells the farmer, and the farmer's milk (and the price gain) flows back.
const LOOP = 'M 70 60 C 200 10, 330 10, 450 60 C 520 90, 520 170, 450 200 C 330 250, 200 250, 70 200 C 0 170, 0 90, 70 60 Z';
const STATIONS = [
  { x: 70, y: 60, t: 'City demand', s: 'shops, quick commerce' },
  { x: 450, y: 60, t: 'District union', s: 'forecast, product mix' },
  { x: 450, y: 200, t: 'Village society', s: 'message in 3 languages' },
  { x: 70, y: 200, t: 'Farmer', s: 'more milk, better price' },
];

function Loop() {
  return (
    <svg viewBox="-20 -10 560 290" className="w-full" role="img" aria-label="Demand travels from the city to the union, society and farmer; milk and price gains flow back.">
      <path d={LOOP} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
      <path d={LOOP} fill="none" stroke="#F4B400" strokeWidth="2.5" strokeDasharray="6 10" style={{ animation: 'dash 2.4s linear infinite' }} />
      {[0, 1, 2].map((i) => (
        <g key={i} style={{ offsetPath: `path('${LOOP}')`, offsetRotate: '0deg', animation: `travel 9s linear ${-i * 3}s infinite` } as React.CSSProperties}>
          <path d="M0 -11 C 5 -4, 8 0, 8 4 a8 8 0 0 1 -16 0 c0 -4 3 -8 8 -15Z" fill={i === 0 ? '#FFFFFF' : '#FFF3CF'} opacity={i === 0 ? 1 : 0.75} />
        </g>
      ))}
      {STATIONS.map((st, i) => (
        <g key={st.t}>
          <circle cx={st.x} cy={st.y} r="11" fill="#1B2560" stroke="#F4B400" strokeWidth="2.5" />
          <circle cx={st.x} cy={st.y} r="4" fill="#F4B400" />
          <text x={st.x} y={i < 2 ? st.y + 34 : st.y - 32} textAnchor={i === 0 || i === 3 ? 'start' : 'end'} dx={i === 0 || i === 3 ? -18 : 18} fill="#fff" fontSize="17" fontWeight="700" fontFamily="'Baloo 2', sans-serif">{st.t}</text>
          <text x={st.x} y={i < 2 ? st.y + 50 : st.y - 16} textAnchor={i === 0 || i === 3 ? 'start' : 'end'} dx={i === 0 || i === 3 ? -18 : 18} fill="rgba(255,255,255,.7)" fontSize="12.5">{st.s}</text>
        </g>
      ))}
    </svg>
  );
}

function Home() {
  const s = useStore();
  const openQ = s.queries.filter((q) => q.status === 'open').length;
  const state = [
    { k: 'Incentive', v: s.incentive.status },
    { k: 'Farmer interested', v: s.farmer.interested ? 'yes' : 'no' },
    { k: 'Application', v: s.application ? s.application.status : 'none' },
    { k: 'Open queries', v: String(openQ) },
  ];
  return (
    <div className="min-h-screen bg-milk">
      <section className="relative overflow-hidden bg-console text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 pb-10 pt-9 lg:grid-cols-[1fr_520px]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="marigold">Prototype v0.2</Chip>
              <VoiceBadge />
            </div>
            <h1 className="mt-4 font-display text-[52px] font-extrabold leading-[0.95] tracking-tight sm:text-[64px]">Doodh Setu</h1>
            <p className="mt-4 max-w-[34ch] text-[19px] leading-snug text-white/85">
              From what the city buys to what the village milks, and the price gain back to the farmer.
            </p>
            <p className="mt-4 max-w-[60ch] text-[14px] leading-relaxed text-white/60">
              A demand-to-farmer intelligence platform for a dairy cooperative. Student prototype for the Amul case. All data is synthetic, calibrated to public Indian patterns.
            </p>
          </div>
          <div className="mx-auto w-full max-w-[520px]"><Loop /></div>
        </div>
        <div className="blockprint h-3 w-full" />
      </section>

      <div className="mx-auto max-w-6xl px-5 py-9">
        <h2 className="font-display text-[24px] font-bold">Open an app</h2>
        <p className="mt-1 text-[14px] text-muted">Each opens in a new tab. Put them side by side: an action in one shows up in the others (same browser).</p>
        <div className="mt-4 grid gap-px overflow-hidden rounded-sheet border border-line bg-line md:grid-cols-2">
          {APPS.map((a) => (
            <Link key={a.href} href={a.href} target="_blank" className="group flex items-start gap-4 bg-white p-5 transition-colors hover:bg-primary-light">
              <div className="min-w-0 flex-1">
                <div className="text-[19px] font-bold text-primary">{a.title}</div>
                <div className="text-[13px] font-semibold text-muted">{a.who}</div>
                <p className="mt-2 text-[15px] leading-relaxed">{a.desc}</p>
              </div>
              <IconChevron size={22} className="mt-1 shrink-0 text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <h2 className="font-display text-[24px] font-bold">Demo script</h2>
            <ol className="relative mt-4 space-y-3 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-[2px] before:bg-line">
              {STEPS.map((st, i) => {
                const newDate = i === 0 || STEPS[i - 1].d !== st.d;
                return (
                  <li key={i} className="relative">
                    {newDate ? <div className="mb-2 ml-10 text-[13px] font-semibold text-marigold-deep">{DEMO_DATES[st.d].label}</div> : null}
                    <div className="flex gap-3 text-[15px]">
                      <span className="relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-primary ring-2 ring-primary/25">{i + 1}</span>
                      <span className="pt-0.5"><b className="font-semibold">{st.app}</b>: {st.text}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
          <aside className="space-y-4">
            <div className="rounded-sheet border border-line bg-white p-5">
              <h2 className="font-bold">Demo date</h2>
              <div className="mt-3 space-y-2">
                {(Object.keys(DEMO_DATES) as DemoDateKey[]).map((k) => (
                  <label key={k} className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors ${s.demoDate === k ? 'border-primary bg-primary-light' : 'border-line hover:bg-alt'}`}>
                    <input type="radio" className="mt-1 accent-[#26347F]" checked={s.demoDate === k} onChange={() => s.set({ demoDate: k })} />
                    <span><b>{DEMO_DATES[k].label}</b><br /><span className="text-[13px] text-muted">{DEMO_DATES[k].note}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-sheet border border-line bg-white p-5">
              <h2 className="font-bold">Demo state</h2>
              <dl className="mt-2 divide-y divide-[#E8EBF1] text-[15px]">
                {state.map((x) => (
                  <div key={x.k} className="flex justify-between py-1.5"><dt className="text-muted">{x.k}</dt><dd key={x.v} className="animate-pop font-semibold">{x.v}</dd></div>
                ))}
              </dl>
              <button className="btn-quiet mt-3 w-full" onClick={() => { if (confirm('Reset the demo to the start?')) s.reset(); }}>Reset demo</button>
            </div>
            <p className="px-1 text-[13px] leading-relaxed text-muted">
              Voice uses Gnani.ai (Vachana) speech-to-text and text-to-speech when an API key is set on the server. Without a key, the browser&apos;s built-in voice is used, which may not have Gujarati on every device.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <ClientOnly><Home /></ClientOnly>;
}
