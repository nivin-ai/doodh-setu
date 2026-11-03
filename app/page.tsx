'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { ClientOnly } from '@/components/Providers';
import { VoiceBadge } from '@/components/ui';
import WalkingCow from '@/components/WalkingCow';
import { signOut, useSession } from '@/components/session';
import { HOME_FOR } from '@/lib/roles';
import { IconBank, IconChevron, IconDrop, IconNotice } from '@/components/icons';
import { useStore } from '@/lib/store';
import { DEMO_DATES, type DemoDateKey } from '@/lib/demo';

const APPS = [
  { href: '/farmer', title: 'Farmer app', who: 'Farmer, member of Anand Milk Society', desc: 'Milk, earnings, society signals and DairyFin finance in Gujarati, Hindi and English, with an AI assistant that answers aloud. No sign-in; add it to your phone\'s home screen to use it like an app.' },
  { href: '/society', title: 'Society dashboard', who: 'Society secretary', desc: 'Receive approved targets, publish messages in three languages, track members and answer queries.' },
  { href: '/planner', title: 'Planner console', who: 'Planner and approver', desc: 'One screen: demand forecast, product mix, milk gap and incentive with approval, and results.' },
  { href: '/lender', title: 'Lender desk (DairyFin)', who: 'Lender (case officer at a demo partner bank)', desc: 'Review consented income evidence, request documents and update application status.' },
];

const STEPS: { d: DemoDateKey; app: string; text: string }[] = [
  { d: 'mar', app: 'Planner', text: 'Overview: headline numbers and data health at the top of the one-screen console.' },
  { d: 'mar', app: 'Planner', text: 'Section 1, Demand: forecast heatwave in April lifts curd, lassi and ice cream.' },
  { d: 'mar', app: 'Planner', text: 'Section 2, Product mix: move milk from powder to paneer and curd; value per litre rises. Accept the plan.' },
  { d: 'mar', app: 'Planner', text: 'Section 3: buffalo milk short in April to June. Set the premium; fix the fairness warning; submit.' },
  { d: 'mar', app: 'Planner', text: 'Sign in as the approver (or switch to Approver as the demo admin) and approve in section 3 (maker-checker).' },
  { d: 'mar', app: 'Society', text: 'Preview the message in three languages, add a local note, publish.' },
  { d: 'mar', app: 'Farmer', text: 'Hear the signal in Gujarati, see what it is worth, tap "I\'m interested". Ask the assistant a question.' },
  { d: 'mar', app: 'Farmer', text: 'Finance: check affordability, compare demo offers, consent and apply.' },
  { d: 'mar', app: 'Lender', text: 'Review the case and request a document; the farmer uploads it; mark approved.' },
  { d: 'apr', app: 'Farmer', text: 'Switch demo date to 30 Apr: earnings show the premium and why the price changed.' },
  { d: 'apr', app: 'Planner', text: 'Section 4, Results: response and the share of value passed to farmers.' },
];

const FLOW = [
  { t: 'City demand', s: 'Dealers, quick commerce and the Amul Shop show what will sell.' },
  { t: 'District union', s: 'Forecast, product mix and the milk gap for the season ahead.' },
  { t: 'Village society', s: 'Approved targets and premiums, sent in the members’ language.' },
  { t: 'Farmer', s: 'Acts on the signal and earns more for the milk that is needed.' },
];

const IconChart = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>
);
const APP_ICON: Record<string, (p: { size?: number }) => JSX.Element> = { '/farmer': IconDrop, '/society': IconNotice, '/planner': IconChart, '/lender': IconBank };

function Home() {
  const s = useStore();
  const { user } = useSession();
  const openQ = s.queries.filter((q) => q.status === 'open').length;
  const state = [
    { k: 'Incentive', v: s.incentive.status },
    { k: 'Farmer interested', v: s.farmer.interested ? 'yes' : 'no' },
    { k: 'Application', v: s.application ? s.application.status : 'none' },
    { k: 'Open queries', v: String(openQ) },
  ];
  return (
    <div className="min-h-screen bg-milk font-sans">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-[13px] font-bold tracking-wide text-white">DS</span>
          <span className="text-[17px] font-semibold tracking-tight">Doodh Setu</span>
          <span className="ml-auto hidden text-[13px] text-muted md:inline">Prototype v0.2, synthetic data</span>
          <span className="hidden sm:inline"><VoiceBadge /></span>
          {user ? (
            <>
              <span className="hidden text-right text-[13px] leading-tight sm:block"><span className="block text-muted">Signed in as</span><b className="block font-semibold">{user.name}</b></span>
              <Link href={HOME_FOR[user.role]} className="btn-primary !min-h-[36px] text-[14px]">Open console</Link>
              <button onClick={signOut} className="btn-quiet !min-h-[36px] text-[14px]">Sign out</button>
            </>
          ) : <Link href="/login" className="btn-primary !min-h-[36px] text-[14px]">Sign in</Link>}
        </div>
      </header>

      <section className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-12">
          <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-primary">Demand-to-farmer platform for dairy cooperatives</div>
          <h1 className="mt-3 max-w-[22ch] text-[36px] font-semibold leading-[1.12] tracking-tight sm:text-[44px]">Turn city demand into better prices for dairy farmers.</h1>
          <p className="mt-4 max-w-[62ch] text-[17px] leading-relaxed text-muted">
            Doodh Setu connects consumer sales data to milk procurement. The union plans the season from live demand, the society relays targets and premiums, and farmers see what their milk is worth, in their own language.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={user ? HOME_FOR[user.role] : '/login'} className="btn-primary">{user ? 'Open staff console' : 'Sign in to the staff console'}</Link>
            <Link href="/farmer" target="_blank" className="btn-secondary">Open farmer app</Link>
          </div>

          <ol className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((f, i) => (
              <li key={f.t} className="bg-alt p-5">
                <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                  <span className="num text-primary">{String(i + 1).padStart(2, '0')}</span>
                  {i < FLOW.length - 1 ? <span className="h-px flex-1 bg-line" /> : null}
                </div>
                <div className="mt-2 text-[16px] font-semibold">{f.t}</div>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{f.s}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-[13px] text-muted">Milk, and the price gain, flow back from the farmer to the union and the market.</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight">Applications</h2>
            <p className="mt-1 text-[14px] text-muted">The staff console holds the planner, society and lender modules behind one sign-in. The farmer app is a separate phone app. Each opens in a new tab, and an action in one appears in the others.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {APPS.map((a) => {
            const Icon = APP_ICON[a.href];
            return (
              <Link key={a.href} href={a.href} target="_blank" className="group card flex items-start gap-4 p-5 transition hover:border-primary/40 hover:shadow-[0_8px_24px_-16px_rgba(11,92,173,.5)]">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary"><Icon size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">{a.who}</span><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${a.href === '/farmer' ? 'bg-good-light text-good' : 'bg-primary-light text-primary'}`}>{a.href === '/farmer' ? 'Phone app' : 'Staff console'}</span></div>
                  <div className="mt-0.5 text-[17px] font-semibold">{a.title}</div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{a.desc}</p>
                </div>
                <IconChevron size={20} className="mt-1 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            );
          })}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <h2 className="text-[20px] font-semibold tracking-tight">Demo walkthrough</h2>
            <div className="card mt-4 overflow-hidden">
              <table className="w-full text-[14px]">
                <tbody>
                  {STEPS.map((st, i) => {
                    const newDate = i === 0 || STEPS[i - 1].d !== st.d;
                    return (
                      <Fragment key={i}>
                        {newDate ? (
                          <tr><td colSpan={3} className="border-b border-line bg-alt px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-muted">Demo date: {DEMO_DATES[st.d].label}</td></tr>
                        ) : null}
                        <tr className="border-b border-line last:border-0">
                          <td className="num w-10 py-2.5 pl-4 align-top text-muted">{i + 1}</td>
                          <td className="w-24 py-2.5 align-top font-semibold">{st.app}</td>
                          <td className="py-2.5 pr-4 align-top leading-relaxed">{st.text}</td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="text-[15px] font-semibold">Demo date</h2>
              <div className="mt-3 space-y-2">
                {(Object.keys(DEMO_DATES) as DemoDateKey[]).map((k) => (
                  <label key={k} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${s.demoDate === k ? 'border-primary bg-primary-light' : 'border-line hover:bg-alt'}`}>
                    <input type="radio" className="mt-1 accent-[#0B5CAD]" checked={s.demoDate === k} onChange={() => s.set({ demoDate: k })} />
                    <span className="text-[14px]"><b className="font-semibold">{DEMO_DATES[k].label}</b><br /><span className="text-[13px] text-muted">{DEMO_DATES[k].note}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="card p-5">
              <h2 className="text-[15px] font-semibold">Demo state</h2>
              <dl className="mt-2 divide-y divide-[#E6EDF5] text-[14px]">
                {state.map((x) => (
                  <div key={x.k} className="flex justify-between py-1.5"><dt className="text-muted">{x.k}</dt><dd key={x.v} className="font-semibold">{x.v}</dd></div>
                ))}
              </dl>
              <button className="btn-quiet mt-3 w-full" onClick={() => { if (confirm('Reset the demo to the start?')) s.reset(); }}>Reset demo</button>
            </div>
          </aside>
        </div>
      </div>

      <WalkingCow />
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-5 py-5 text-[13px] leading-relaxed text-muted">
          Student prototype for the Amul (GCMMF) case. All data is synthetic, calibrated to public Indian patterns. Answers and messages are read aloud with Gnani.ai when a key is set on the server, otherwise with the browser&apos;s built-in voice.
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return <ClientOnly><Home /></ClientOnly>;
}
