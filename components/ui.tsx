'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking, voiceHealth } from '@/lib/voice';
import { ACCESS } from '@/lib/roles';
import { signOut, useSession } from './session';
import CowLogo from './CowLogo';
import type { Lang } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';

type Tone = 'primary' | 'good' | 'warn' | 'bad' | 'neutral' | 'marigold';
const TONES: Record<Tone, string> = {
  primary: 'bg-primary-light text-primary',
  good: 'bg-good-light text-good',
  warn: 'bg-warn-light text-warn',
  bad: 'bg-bad-light text-bad',
  neutral: 'bg-fill text-muted',
  marigold: 'bg-marigold text-ink',
};

export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold leading-5 ${TONES[tone]} ${className}`}>{children}</span>;
}

// Animated equaliser bars: shown while audio plays or the mic listens.
export function Waveform({ bars = 4, className = '', color = 'currentColor' }: { bars?: number; className?: string; color?: string }) {
  return (
    <span className={`inline-flex h-3.5 items-center gap-[2px] ${className}`} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span key={i} className="block h-full w-[3px] origin-center rounded-full" style={{ background: color, animation: `eq 900ms ease-in-out ${i * 120}ms infinite` }} />
      ))}
    </span>
  );
}

export function PlayButton({ text, lang, size = 36, tone = 'primary' }: { text: string; lang: Lang; size?: number; tone?: 'primary' | 'onMarigold' }) {
  const [playing, setPlaying] = useState(false);
  const label = playing ? 'Stop listening' : 'Listen';
  const cls = tone === 'onMarigold' ? 'bg-ink text-marigold' : 'bg-primary-light text-primary hover:bg-[#D3E4F6]';
  return (
    <button
      aria-label={label}
      title={label}
      onClick={async (e) => {
        e.stopPropagation();
        if (playing) { stopSpeaking(); setPlaying(false); return; }
        setPlaying(true);
        await speak(text, lang, () => setPlaying(false));
      }}
      className={`flex shrink-0 items-center justify-center rounded-full transition ${cls}`}
      style={{ width: size, height: size }}
    >
      {playing ? <Waveform /> : <svg width="13" height="13" viewBox="0 0 12 12" aria-hidden><path d="M2.5 1.2 11 6l-8.5 4.8Z" fill="currentColor" /></svg>}
    </button>
  );
}

// Counts from the previous value to the new one when a figure changes.
export function useCountUp(target: number, ms = 550) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    if (a === target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(target); from.current = target; return; }
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - p, 3);
      setV(a + (target - a) * e);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = target; };
  }, [target, ms]);
  return v;
}

export function Count({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value);
  return <span className="num">{format(v)}</span>;
}

export function VoiceBadge() {
  const [g, setG] = useState<boolean | null>(null);
  useEffect(() => { voiceHealth().then((h) => setG(h.gnani)); }, []);
  if (g === null) return null;
  return <Chip tone={g ? 'good' : 'warn'}>{g ? 'Voice by Gnani.ai' : 'Browser voice (no Gnani key)'}</Chip>;
}

export function DemoBar() {
  const demoDate = useStore((s) => s.demoDate);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-white px-4 py-1.5 text-[13px] text-muted">
      <Link href="/" className="font-semibold text-primary hover:underline">Demo home</Link>
      <span>Demo date <b className="font-semibold text-ink">{DEMO_DATES[demoDate].label}</b></span>
      <span className="hidden sm:inline">Synthetic data, not real Amul data</span>
      <span className="ml-auto"><VoiceBadge /></span>
    </div>
  );
}

const MODULES = [
  { id: 'planner', href: '/planner', label: 'Planner' },
  { id: 'society', href: '/society', label: 'Society' },
  { id: 'lender', href: '/lender', label: 'Lender' },
] as const;

export function ConsoleShell({ title, place, menu, active, onSelect, right, children }: {
  title: string; place?: string; menu: { id: string; label: string; badge?: number }[]; active: string; onSelect: (id: string) => void; right?: React.ReactNode; children: React.ReactNode;
}) {
  const { user } = useSession();
  const here = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : '';
  const mods = user ? MODULES.filter((m) => ACCESS[m.id].includes(user.role)) : [];
  return (
    <div className="min-h-screen bg-milk">
      <DemoBar />
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-console px-4 py-3 text-white md:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <CowLogo size={32} className="border-white/30" />
          <span className="text-[17px] font-semibold tracking-tight">Doodh Setu</span>
        </Link>
        <span className="hidden text-[14px] text-white/75 sm:inline">{title}{place ? <span className="text-white/55">, {place}</span> : null}</span>
        {mods.length > 1 ? (
          <nav className="flex rounded-lg bg-white/10 p-0.5" aria-label="Modules">
            {mods.map((m) => <Link key={m.id} href={m.href} aria-current={here === m.id ? 'page' : undefined} className={`rounded-md px-3 py-1 text-[13px] font-semibold transition-colors ${here === m.id ? 'bg-white text-primary' : 'text-white/80 hover:text-white'}`}>{m.label}</Link>)}
          </nav>
        ) : null}
        <div className="ml-auto flex items-center gap-3 text-sm">
          {right}
          {user ? (
            <>
              <span className="hidden text-right leading-tight sm:block"><span className="block text-[12px] text-white/60">Signed in as</span><span className="block font-semibold">{user.name}</span></span>
              <button onClick={signOut} className="rounded-lg border border-white/25 px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10">Sign out</button>
            </>
          ) : null}
        </div>
      </header>
      <div className="md:flex">
        {menu.length ? <><nav className="sticky top-0 hidden h-[calc(100vh-88px)] w-[228px] shrink-0 border-r border-line bg-white px-3 py-4 md:block" aria-label="Sections">
          {menu.map((m) => {
            const on = active === m.id;
            return (
              <button key={m.id} onClick={() => onSelect(m.id)} aria-current={on ? 'page' : undefined}
                className={`relative mb-0.5 flex w-full items-center justify-between rounded-lg py-2 pl-4 pr-3 text-left text-[15px] transition-colors ${on ? 'bg-primary-light font-semibold text-primary' : 'text-ink hover:bg-alt'}`}>
                <span className={`absolute left-0 top-1.5 h-[calc(100%-12px)] w-[3px] rounded-full bg-primary transition-transform duration-200 ${on ? 'scale-y-100' : 'scale-y-0'}`} />
                {m.label}
                {m.badge ? <span className="min-w-[22px] rounded-full bg-marigold px-1.5 text-center text-[12px] font-bold text-ink">{m.badge}</span> : null}
              </button>
            );
          })}
        </nav>
        <div className="sticky top-0 z-10 w-full overflow-x-auto border-b border-line bg-white px-3 py-2 md:hidden">
          <div className="flex gap-1">{menu.map((m) => <button key={m.id} onClick={() => onSelect(m.id)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${active === m.id ? 'bg-primary text-white' : 'bg-fill'}`}>{m.label}</button>)}</div>
        </div></> : null}
        <main key={active} className="min-w-0 flex-1 animate-view-in px-4 py-6 md:px-6 md:py-7 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3.5">
      <div className="label">{label}</div>
      <div key={String(value)} className={`num mt-0.5 animate-pop text-[26px] font-bold leading-tight ${c}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[13px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function PageTitle({ title, sub, chip }: { title: string; sub?: string; chip?: React.ReactNode }) {
  return (
    <div className="mb-6 max-w-[860px]">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{title}</h2>{chip}</div>
      {sub ? <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{sub}</p> : null}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[13px] leading-relaxed text-muted">{children}</p>;
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-full border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} aria-pressed={value === o.id}
          className={`rounded-full px-3.5 py-1 text-sm transition-colors ${value === o.id ? 'bg-primary font-semibold text-white' : 'text-ink hover:bg-alt'}`}>{o.label}</button>
      ))}
    </div>
  );
}

export const CHART = { indigo: '#0B5CAD', indigoSoft: '#A7C8EB', marigold: '#F2BE2C', marigoldDeep: '#B4860F', green: '#14804A', red: '#B23A2E', grey: '#C3CEDB', grid: '#E6EDF5', temp: '#C2552E' };
