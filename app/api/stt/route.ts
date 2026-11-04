import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Speech to text with Google Gemini (audio understanding). Docs: https://ai.google.dev/gemini-api/docs/audio
// Claude's API does not accept audio, so Gemini handles transcription and Claude still answers (/api/ask).
const LANG_NAME: Record<string, string> = {
  gu: 'Gujarati (write in Gujarati script)', hi: 'Hindi (write in Devanagari script)', en: 'Indian English',
  mr: 'Marathi (write in Devanagari script)', bn: 'Bengali (write in Bengali script)', te: 'Telugu (write in Telugu script)',
  ta: 'Tamil (write in Tamil script)', kn: 'Kannada (write in Kannada script)', ml: 'Malayalam (write in Malayalam script)',
  or: 'Odia (write in Odia script)',
};

const prompt = (lang: string) => `Transcribe this short voice question exactly as spoken. The speaker is a dairy farmer in rural India, a member of an Amul village milk cooperative society, asking about their milk payments, milk quality, animals or loans.

The expected language is ${LANG_NAME[lang]}. Farmers often mix in English or Hindi words; keep those words as they are said.

Words you are likely to hear: Amul, mandali / society (doodh mandali), SNF, fat, litre, rate, payment, bonus, premium, paneer, dahi, ghee, buffalo (bhens), cow (gaay), heifer, calving, insemination (AI), vet / doctor, mineral mixture, fodder (chaaro), silage, cattle feed (daan), loan, EMI, bank, KCC, DairyFin, Doodh Setu.

Rules:
- Output only the transcript text. No quotes, labels, translation or explanation.
- Write numbers as digits.
- If there is no clear speech, output nothing.`;

async function gemini(key: string, model: string, b64: string, mime: string, lang: string) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt(lang) }, { inline_data: { mime_type: mime, data: b64 } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 400 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini ${model} ${r.status}: ${JSON.stringify(j?.error ?? j).slice(0, 300)}`);
  const parts = j?.candidates?.[0]?.content?.parts ?? [];
  return parts.filter((p: { thought?: boolean }) => !p.thought).map((p: { text?: string }) => p.text ?? '').join('').trim().replace(/^["“]|["”]$/g, '');
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 501 });
  const form = await req.formData();
  const audio = form.get('audio_file');
  const lang = String(form.get('language') ?? 'gu');
  if (!LANG_NAME[lang]) return NextResponse.json({ error: `Speech to text does not support ${lang}` }, { status: 422 });
  if (!(audio instanceof Blob)) return NextResponse.json({ error: 'audio_file required' }, { status: 400 });
  if (audio.size > 3_000_000) return NextResponse.json({ error: 'audio too long' }, { status: 413 });
  const b64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
  const mime = audio.type || 'audio/wav';
  // Main model first; if it errors or returns nothing, try the lighter fallback once.
  const models = [process.env.GEMINI_STT_MODEL || 'gemini-3.8-flash', process.env.GEMINI_STT_FALLBACK || 'gemini-3.5-flash-lite'];
  let lastErr = '';
  for (const m of models) {
    try {
      const transcript = await gemini(key, m, b64, mime, lang);
      if (transcript) return NextResponse.json({ transcript, model: m });
      lastErr = `${m}: empty transcript`;
    } catch (e) { lastErr = String(e instanceof Error ? e.message : e); }
  }
  return NextResponse.json({ error: 'Speech to text failed', detail: lastErr }, { status: 502 });
}
