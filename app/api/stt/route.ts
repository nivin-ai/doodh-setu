import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Gnani.ai Vachana speech-to-text (REST, max 30 s audio). Docs: https://docs.gnani.ai/api/STT/speech-to-text
const CODES: Record<string, string> = { gu: 'gu-IN', hi: 'hi-IN', en: 'en-IN', mr: 'mr-IN', bn: 'bn-IN', te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN' };

export async function POST(req: NextRequest) {
  const key = process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: 'GNANI_API_KEY not set' }, { status: 501 });
  const form = await req.formData();
  const audio = form.get('audio_file');
  const lang = String(form.get('language') ?? 'gu');
  if (!CODES[lang]) return NextResponse.json({ error: `Gnani STT does not support ${lang}` }, { status: 422 });
  if (!(audio instanceof Blob)) return NextResponse.json({ error: 'audio_file required' }, { status: 400 });
  const out = new FormData();
  out.append('audio_file', audio, 'question.wav');
  out.append('language_code', CODES[lang]);
  out.append('model', process.env.GNANI_STT_MODEL || 'prisma-v3.0');
  out.append('format', 'transcribe');
  const r = await fetch('https://api.vachana.ai/stt/v3', { method: 'POST', headers: { 'X-API-Key-ID': key }, body: out });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.success === false) return NextResponse.json({ error: 'Gnani STT failed', status: r.status, detail: j }, { status: 502 });
  return NextResponse.json({ transcript: j.transcript ?? '', detected: j.detected_language_code ?? null });
}
