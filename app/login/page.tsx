'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { resetSession } from '@/components/session';
import CowLogo from '@/components/CowLogo';
import { ROLE_LABEL, type Role } from '@/lib/roles';

// Demo accounts, shown so presenters can sign in quickly. Checked on the server (lib/users.ts).
const DEMO: { username: string; password: string; role: Role; opens: string }[] = [
  { username: 'planner', password: 'planner123', role: 'planner', opens: 'Planner console' },
  { username: 'approver', password: 'approver123', role: 'approver', opens: 'Planner console (approvals)' },
  { username: 'secretary', password: 'society123', role: 'secretary', opens: 'Society dashboard' },
  { username: 'lender', password: 'lender123', role: 'lender', opens: 'Lender desk' },
  { username: 'admin', password: 'admin123', role: 'admin', opens: 'All three modules' },
];

function Login() {
  const params = useSearchParams();
  const next = params.get('next');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) { setError(j.error ?? 'Could not sign in. Try again.'); setBusy(false); return; }
    resetSession();
    window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : j.home;
  };

  return (
    <div className="min-h-screen bg-milk">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3.5">
          <Link href="/" className="flex items-center gap-3">
            <CowLogo size={36} />
            <span className="text-[17px] font-semibold tracking-tight">Doodh Setu</span>
          </Link>
          <Link href="/farmer" className="ml-auto text-[14px] font-semibold text-primary hover:underline">Farmer app</Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[400px_1fr] lg:items-start">
        <form onSubmit={submit} className="card p-6 sm:p-7">
          <h1 className="text-[24px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-[14px] text-muted">Staff console for the union, village societies and partner lenders.</p>
          <label className="mt-6 block text-[14px] font-semibold">Username
            <input className="input mt-1.5" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="mt-4 block text-[14px] font-semibold">Password
            <input className="input mt-1.5" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error ? <p role="alert" className="mt-3 rounded-lg bg-bad-light px-3 py-2 text-[14px] text-bad">{error}</p> : null}
          {next ? <p className="mt-3 text-[13px] text-muted">Sign in to continue to {next.replace('/', '')}.</p> : null}
          <button className="btn-primary mt-5 w-full" disabled={busy || !username || !password}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <div>
          <h2 className="text-[15px] font-semibold">Demo accounts</h2>
          <p className="mt-1 text-[14px] text-muted">Prototype only. Select an account to fill in the form.</p>
          <div className="card mt-3 overflow-hidden">
            <table className="w-full text-[14px]">
              <thead><tr className="border-b border-line bg-alt text-left text-[12px] uppercase tracking-[0.08em] text-muted"><th className="px-4 py-2 font-semibold">Role</th><th className="px-4 py-2 font-semibold">Username</th><th className="hidden px-4 py-2 font-semibold sm:table-cell">Password</th><th className="hidden px-4 py-2 font-semibold md:table-cell">Opens</th></tr></thead>
              <tbody>
                {DEMO.map((d) => (
                  <tr key={d.username} onClick={() => { setUsername(d.username); setPassword(d.password); setError(''); }} className="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-primary-light">
                    <td className="px-4 py-2.5 font-semibold">{ROLE_LABEL[d.role]}</td>
                    <td className="num px-4 py-2.5">{d.username}</td>
                    <td className="num hidden px-4 py-2.5 text-muted sm:table-cell">{d.password}</td>
                    <td className="hidden px-4 py-2.5 text-muted md:table-cell">{d.opens}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">All tabs in one browser share one sign-in. To show the planner, society and lender side by side, sign in as the demo admin. The farmer app does not need a sign-in.</p>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Login /></Suspense>;
}
