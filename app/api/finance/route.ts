import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Writes DairyFin consent, application and data-sharing events to Supabase (supabase/schema.sql).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server. Without them the app still works
// and keeps these records in the browser only.
const FARMER_ID = '00000000-0000-4000-8000-000000000101';
const LENDER_ID: Record<string, string> = {
  'Gramin Partner Bank (demo)': '00000000-0000-4000-8000-000000000201',
  'Sahakari Credit NBFC (demo)': '00000000-0000-4000-8000-000000000202',
  'Union Bank of India': '00000000-0000-4000-8000-000000000203',
};

type Consent = { uuid?: string; recipient: string; purpose: string; status: string; grantedAt: string; noticeVersion?: string; categories?: string[]; method?: string; language?: string };
type Sharing = { uuid?: string; id: string; categories: string[]; purpose: string; status: string; at: string };
type Application = { uuid?: string; ref: string; lender: string; product: string; amount: number; status: string; history: { at: string }[]; sharing?: Sharing[]; docs: { id: string; status: string }[] };

async function db(path: string, method: string, body?: unknown, prefer = 'return=minimal') {
  const url = process.env.SUPABASE_URL!, key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0, 300)}`);
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ stored: false, reason: 'Supabase not configured' });
  const e = await req.json().catch(() => ({}));
  try {
    if (e.type === 'consent') {
      const c = e.consent as Consent;
      await db('consent_records', 'POST', {
        consent_id: c.uuid, farmer_id: FARMER_ID, lender_id: LENDER_ID[c.recipient] ?? null,
        consent_notice_version: c.noticeVersion ?? 'MILK-RECORDS-1.0', consent_purpose: c.purpose.slice(0, 100), consent_status: 'granted',
        granted_at: c.grantedAt, collection_categories: c.categories ?? ['milk_income'], consent_method: c.method ?? 'digital', language: c.language ?? null,
      });
    } else if (e.type === 'withdraw') {
      await db(`consent_records?consent_id=eq.${encodeURIComponent(e.consentUuid)}`, 'PATCH', { consent_status: 'withdrawn', withdrawn_at: e.at });
    } else if (e.type === 'application') {
      const a = e.application as Application;
      const lender = LENDER_ID[a.lender] ?? null;
      await db('loan_applications', 'POST', {
        application_id: a.uuid, farmer_id: FARMER_ID, lender_id: lender, application_reference: `${a.ref}-${a.uuid?.slice(0, 8)}`,
        requested_amount: a.amount, loan_purpose: a.product, application_status: a.status, submitted_at: a.history[0]?.at, last_updated_at: a.history[0]?.at,
      });
      if (e.loanConsentUuid) await db(`consent_records?consent_id=eq.${encodeURIComponent(e.loanConsentUuid)}`, 'PATCH', { application_id: a.uuid });
      if (a.docs?.length) await db('loan_documents', 'POST', a.docs.map((d) => ({ application_id: a.uuid, document_type: d.id, verification_status: d.status === 'received' ? 'verified' : 'pending' })));
      for (const x of a.sharing ?? []) {
        await db('data_sharing_logs', 'POST', {
          sharing_id: x.uuid, farmer_id: FARMER_ID, application_id: a.uuid, consent_id: e.loanConsentUuid, recipient_id: lender,
          data_categories: x.categories, purpose: x.purpose, sharing_status: x.status, shared_at: x.at, reference_id: x.id,
        });
      }
    } else if (e.type === 'status') {
      await db(`loan_applications?application_id=eq.${encodeURIComponent(e.applicationUuid)}`, 'PATCH', { application_status: e.status, last_updated_at: e.at });
    } else {
      return NextResponse.json({ error: 'unknown event' }, { status: 400 });
    }
    return NextResponse.json({ stored: true });
  } catch (err) {
    return NextResponse.json({ stored: false, error: String(err instanceof Error ? err.message : err) }, { status: 502 });
  }
}
