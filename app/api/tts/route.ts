import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Gnani.ai Vachana text-to-speech (REST). Docs: https://docs.gnani.ai/api/introduction/quick-start
const VOICES: Record<string, { voice: string; language: string }> = {
  gu: { voice: process.env.GNANI_VOICE_GU || 'Veera', language: 'gu-IN' },
  hi: { voice: process.env.GNANI_VOICE_HI || 'Nalini', language: 'hi-IN' },
  en: { voice: process.env.GNANI_VOICE_EN || 'Kaveri', language: 'en-IN' },
  mr: { voice: process.env.GNANI_VOICE_MR || 'Zahira', language: 'mr-IN' },
  bn: { voice: process.env.GNANI_VOICE_BN || 'Kirra', language: 'bn-IN' },
  te: { voice: process.env.GNANI_VOICE_TE || 'Suhana', language: 'te-IN' },
  ta: { voice: process.env.GNANI_VOICE_TA || 'Asmita', language: 'ta-IN' },
  kn: { voice: process.env.GNANI_VOICE_KN || 'Saanvi', language: 'kn-IN' },
  ml: { voice: process.env.GNANI_VOICE_ML || 'Reshma', language: 'ml-IN' },
  // Odia is not in Gnani's timbre-v2.5 voice list; only used if a voice is configured, else the browser voice is used
  ...(process.env.GNANI_VOICE_OR ? { or: { voice: process.env.GNANI_VOICE_OR, language: 'or-IN' } } : {}),
};

export async function POST(req: NextRequest) {
  const key = process.env.GNANI_API_KEY;
  if (!key) return NextResponse.json({ error: 'GNANI_API_KEY not set' }, { status: 501 });
  const { text, lang } = (await req.json()) as { text?: string; lang?: string };
  if (!text || text.length > 1200) return NextResponse.json({ error: 'text required (max 1200 chars)' }, { status: 400 });
  const v = VOICES[lang ?? 'gu'];
  if (!v) return NextResponse.json({ error: `No Gnani voice for ${lang}` }, { status: 422 });
  const r = await fetch('https://api.vachana.ai/api/v1/tts/inference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key-ID': key },
    body: JSON.stringify({
      text,
      voice: v.voice,
      model: process.env.GNANI_TTS_MODEL || 'timbre-v2.5',
      language: v.language,
      speed: 1.0,
      audio_config: { sample_rate: 22050, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'wav' },
    }),
  });
  if (!r.ok) {
    const detail = await r.text();
    return NextResponse.json({ error: 'Gnani TTS failed', status: r.status, detail: detail.slice(0, 500) }, { status: 502 });
  }
  const audio = await r.arrayBuffer();
  return new NextResponse(audio, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' } });
}
