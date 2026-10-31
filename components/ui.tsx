'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { speak, stopSpeaking, voiceHealth } from '@/lib/voice';
import type { Lang } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { DEMO_DATES } from '@/lib/demo';

type Tone = 'primary' | 'good' | 'warn' | 'bad' | 'neutral';
const TONES: Record<Tone, string> = {
  primary: 'bg-primary-light text-primary border-primary',
  good: 'bg-good-light text-good border-good',
  warn: 'bg-warn-light text-warn border-warn',
  bad: 'bg-bad-light text-bad border-bad',
  neutral: 'bg-fill text-muted border-line',
};

export function Chip({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${TONES[tone]} ${className}`}>{children}</span>;
}

export function PlayButton({ text, lang, size = 34 }: { text: string; lang: Lang; size?: number }) {
  const [playing, setPlaying] = useState(false);
  const label = playing ? 'Stop' : 'Listen';
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
      className={`flex shrink-0 items-center justify-center rounded-full border border-primary bg-primary-light text-primary ${playing ? 'listening' : ''}`}
      style={{ width: size, height: size }}
    >
      {playing ? (
        <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1" width="3.5" height="10" fill="currentColor" /><rect x="7.5" y="1" width="3.5" height="10" fill="currentColor" /></svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor" /></svg>
      )}
    </button>
  );
}

export function VoiceBadge() {
  const [g, setG] = useState<boolean | null>(null);
  useEffect(() => { voiceHealth().then((h) => setG(h.gnani)); }, []);
  if (g === null) return null;
  return <Chip tone={g ? 'good' : 'warn'}>{g ? 'Voice: Gnani.ai' : 'Voice: browser fallback'}</Chip>;
}

export function DemoBar() {
  const demoDate = useStore((s) => s.demoDate);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-[#FFFBF2] px-4 py-1.5 text-xs text-muted">
      <Link href="/" className="font-bold text-primary">← Demo home</Link>
      <span>Demo date: <b className="text-ink">{DEMO_DATES[demoDate].label}</b></span>
      <span>Synthetic data. Not real Amul data.</span>
      <span className="ml-auto"><VoiceBadge /></span>
    </div>
  );
}

export function ConsoleShell({ title, menu, active, onSelect, right, children }: {
  title: string; menu: { id: string; label: string; badge?: number }[]; active: string; onSelect: (id: string) => void; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <DemoBar />
      <header className="flex items-center gap-4 bg-console px-5 py-3 text-white">
        <h1 className="text-[15px] font-bold">{title}</h1>
        <div className="ml-auto flex items-center gap-3 text-sm">{right}</div>
      </header>
      <div className="flex">
        <nav className="min-h-[calc(100vh-90px)] w-[220px] shrink-0 border-r border-line bg-alt p-3">
          {menu.map((m) => (
            <button key={m.id} onClick={() => onSelect(m.id)}
              className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${active === m.id ? 'border border-primary bg-primary-light font-bold text-primary' : 'text-ink hover:bg-fill'}`}>
              {m.label}
              {m.badge ? <span className="rounded-full bg-warn px-2 text-[11px] font-bold text-white">{m.badge}</span> : null}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'text-good' : tone === 'warn' ? 'text-warn' : tone === 'bad' ? 'text-bad' : 'text-ink';
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function PageTitle({ title, sub, chip }: { title: string; sub?: string; chip?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{title}</h2>{chip}</div>
      {sub ? <p className="mt-1 text-sm text-muted">{sub}</p> : null}
    </div>
  );
}

export function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs italic text-muted">{children}</p>;
}
