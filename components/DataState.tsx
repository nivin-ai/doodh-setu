'use client';
import type { ApiError } from '@/lib/client/api';

// Loading, error and empty states shared by every module
export function Loading({ label = 'Loading...' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 p-8 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden />{label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const signIn = error.status === 401 || error.status === 403;
  return (
    <div role="alert" className="m-4 rounded-xl border border-bad/30 bg-bad-light p-5 text-[15px]">
      <div className="font-semibold text-bad">{signIn ? 'You do not have access to this data' : 'Could not load the data'}</div>
      <p className="mt-1 text-ink">{error.message}</p>
      <div className="mt-3 flex gap-2">
        {onRetry ? <button className="btn-quiet !min-h-[36px] text-sm" onClick={onRetry}>Try again</button> : null}
        {signIn ? <a className="btn-primary !min-h-[36px] text-sm" href="/login">Sign in</a> : null}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-sheet border border-dashed border-line p-8 text-center text-sm text-muted">{children}</div>;
}
