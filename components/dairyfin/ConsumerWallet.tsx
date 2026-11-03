'use client';
// Consumer prepaid milk subscription. Every payment is simulated: no card, UPI or bank details are
// asked for, and no money is collected or held. Balance = simulated top-ups minus deliveries.
import Link from 'next/link';
import { useState } from 'react';
import { postJson, useResource } from '@/lib/client/api';
import type { WalletData } from '@/lib/types/api';
import { inr } from '@/lib/util';
import { WALLET_PLANS } from '@/lib/dairyfin';
import { ErrorState, Loading } from '../DataState';
import CowLogo from '../CowLogo';
import { Chip } from '../ui';

const PLANS = WALLET_PLANS;
const CHANNELS = ['Doorstep delivery partner', 'Nearby milk parlour', 'Quick-commerce partner'];
const openWallet = () => fetch('/api/consumer/session', { method: 'POST' }).then(() => undefined);

export default function ConsumerWallet() {
  const r = useResource<WalletData>('/api/consumer', { before: openWallet });
  const [plan, setPlan] = useState(PLANS[0].id);
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [amount, setAmount] = useState('500');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const act = async (body: Record<string, unknown>, ok: string) => {
    setBusy(true); setMsg(null);
    try { await postJson('/api/consumer', body); await r.refresh(); setMsg({ ok: true, t: ok }); }
    catch (e) { setMsg({ ok: false, t: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  };
  const w = r.data;
  const sub = w?.subscription;
  const days = sub && sub.pricePerDay ? Math.floor((w?.balance ?? 0) / sub.pricePerDay) : 0;
  return (
    <div className="min-h-screen bg-milk">
      <header className="flex items-center gap-2.5 bg-console px-4 py-3 text-white">
        <Link href="/" className="flex items-center gap-2.5"><CowLogo size={30} className="border-white/30" /><span className="font-semibold">Doodh Setu</span></Link>
        <span className="text-sm text-white/70">Milk wallet</span><Chip tone="marigold" className="ml-auto">Simulated</Chip>
      </header>
      <main className="mx-auto max-w-[480px] space-y-3 px-4 py-5">
        {!w ? (r.error ? <ErrorState error={r.error} onRetry={r.refresh} /> : <Loading label="Opening your wallet..." />) : (<>
          <div className="rounded-xl bg-warn-light px-4 py-3 text-[13px] text-warn">{w.product?.disclaimer ?? 'Simulated wallet.'} Never enter card, UPI or bank details here.</div>
          {msg ? <div role="status" className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? 'bg-good-light text-good' : 'bg-bad-light text-bad'}`}>{msg.t}</div> : null}
          <div className="card p-4">
            <div className="label">Balance</div>
            <div className="num font-display text-[34px] font-bold leading-tight">{inr(w.balance)}</div>
            <div className="text-sm text-muted">{sub ? `${sub.plan}: about ${days} day${days === 1 ? '' : 's'} of milk` : 'No subscription yet'}</div>
            <div className="mt-3 flex gap-2">
              <input aria-label="Top-up amount" className="input w-32" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ''))} />
              <button className="btn-primary flex-1" disabled={busy || !amount} onClick={() => act({ action: 'topup', amount: Number(amount) }, `Added ${inr(Number(amount))} (simulated)`)}>Add money (simulated)</button>
            </div>
            <div className="mt-1 text-xs text-muted">{w.product ? `Between ${inr(w.product.min ?? 0)} and ${inr(w.product.max ?? 0)} per top-up.` : ''} No payment is taken.</div>
          </div>

          {sub ? (
            <div className="card p-4">
              <div className="flex items-center justify-between"><span className="font-bold">{sub.plan}</span><Chip tone={sub.status === 'active' ? 'good' : 'warn'}>{sub.status}</Chip></div>
              <div className="text-sm text-muted">{sub.channel}, {inr(sub.pricePerDay)} a day (demo price){sub.renewsOn ? `, renews on ${sub.renewsOn}` : ''}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-secondary" disabled={busy || sub.status !== 'active'} onClick={() => act({ action: 'deliver' }, 'Today\'s delivery recorded (simulated)')}>Simulate today&apos;s delivery</button>
                <button className="btn-quiet" disabled={busy} onClick={() => act({ action: 'renew' }, 'Renewed for 30 more days')}>Renew 30 days</button>
                <button className="btn-quiet" disabled={busy} onClick={() => act({ action: sub.status === 'active' ? 'pause' : 'resume' }, sub.status === 'active' ? 'Paused' : 'Resumed')}>{sub.status === 'active' ? 'Pause' : 'Resume'}</button>
                <button className="btn-quiet" disabled={busy} onClick={() => act({ action: 'cancel' }, 'Subscription cancelled')}>Cancel</button>
              </div>
            </div>
          ) : null}

          <div className="card space-y-2 p-4">
            <div className="label">{sub ? 'Change plan' : 'Start a subscription'}</div>
            {PLANS.map((p) => <label key={p.id} className="flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2"><input type="radio" name="plan" checked={plan === p.id} onChange={() => setPlan(p.id)} />{p.label}</span><span className="num text-muted">{inr(p.perDay)}/day</span></label>)}
            <select aria-label="Delivery channel" className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
            <button className="btn-primary w-full" disabled={busy} onClick={() => act({ action: 'subscribe', plan, channel }, 'Subscription started')}>{sub ? 'Switch plan' : 'Subscribe'}</button>
            <p className="text-xs text-muted">Prices are demo figures for the prototype.</p>
          </div>

          <div className="card p-4">
            <div className="label">History</div>
            {!w.transactions.length ? <p className="mt-1 text-sm text-muted">No transactions yet.</p> : null}
            <ul className="mt-1 divide-y divide-[#E6EDF5] text-sm">{w.transactions.map((t, i) => (
              <li key={i} className="flex items-center justify-between py-2"><span>{t.description}<span className="block text-xs text-muted">{new Date(t.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                <span className={`num font-semibold ${t.kind === 'topup' ? 'text-good' : ''}`}>{t.kind === 'topup' ? '+' : '-'}{inr(t.amount)}</span></li>
            ))}</ul>
          </div>
        </>)}
      </main>
    </div>
  );
}
