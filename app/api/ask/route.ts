import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 30;

// AI assistant grounded on the farmer's records and approved content (BR-26).
// Uses Anthropic Claude (Haiku, the fastest model) when ANTHROPIC_API_KEY is set.
const LANG_NAME: Record<string, string> = {
  gu: 'Gujarati (Gujarati script)', hi: 'Hindi (Devanagari script)', en: 'simple Indian English', mr: 'Marathi (Devanagari script)',
  bn: 'Bengali (Bengali script)', te: 'Telugu (Telugu script)', ta: 'Tamil (Tamil script)', kn: 'Kannada (Kannada script)',
  ml: 'Malayalam (Malayalam script)', or: 'Odia (Odia script)',
};

const system = (lang: string, name: string) => `You are the society helper at the village milk society, talking with a dairy farmer who is a member of an Amul cooperative society in Gujarat. You speak through the Amul Setu app, and your reply is read aloud.

How to talk:
- Talk like a warm, respectful person from the society who knows the farmer, not like a machine or a report. Address them respectfully (for example "ben" or "bhai" in Gujarati) without using a name.
- Reply in ${LANG_NAME[lang] ?? LANG_NAME.gu}, in plain spoken language a village farmer uses at home. Short, natural sentences. No headings, no jargon, no "As an AI".
- First answer the actual question directly, then add one helpful line if it matters (why it happened, or what they can do next). You may end with a short friendly follow-up question when it helps.
- Say money the way people say it aloud (for example "about 2,400 rupees"), not "Rs".
- Keep "text" to 2 to 4 short spoken sentences. Use "bullets" only when giving steps or reasons that are easier as a list (at most 4); otherwise return an empty list.

What you may say:
- Use ONLY the FACTS given (the farmer's own records and the society's approved advice). Never invent numbers, rates, dates, schemes, loan offers or medical advice. Do arithmetic from the facts when needed and round sensibly.
- If the facts do not cover the question, say honestly that you don't have that information, and offer to pass it to someone at the society. Set "handoff" to true.
- For a sick animal, tell them to call the society vet. Never ask for OTP, PIN, Aadhaar or bank passwords.

Return only JSON: {"text": string, "bullets": string[], "handoff": boolean}`;

function parse(raw: string) {
  const s = raw.replace(/```(?:json)?/g, '');
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (typeof j.text !== 'string' || !j.text.trim()) return null;
    const bullets = Array.isArray(j.bullets) ? j.bullets.filter((b: unknown) => typeof b === 'string' && b.trim()).slice(0, 4) : [];
    return { text: j.text.trim(), bullets, handoff: Boolean(j.handoff) };
  } catch { return null; }
}

// Indian-language answers need far more tokens than English (Gujarati and Hindi script), and the
// model's hidden reasoning used most of the old 1024-token limit, so longer Gujarati and Hindi answers
// were cut off and fell back to the scripted reply. Reasoning is off (answers are short and grounded in
// the facts; this is also about 3x faster) and the limit has headroom. ANTHROPIC_THINKING=on restores it.
async function claude(key: string, sys: string, user: string) {
  const call = async (noThinking: boolean) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: 2048,
        ...(noThinking ? { thinking: { type: 'disabled' } } : {}),
        system: sys, messages: [{ role: 'user', content: user }],
      }),
    });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  };
  const off = process.env.ANTHROPIC_THINKING !== 'on';
  let { r, j } = await call(off);
  // a model that does not accept the thinking setting: try once without it
  if (!r.ok && off && r.status === 400 && /thinking/i.test(JSON.stringify(j))) ({ r, j } = await call(false));
  if (!r.ok) throw new Error(`Claude ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const text = (j?.content ?? []).map((c: { type?: string; text?: string }) => (c.type === 'text' ? c.text ?? '' : '')).join('');
  return { text, stop: String(j?.stop_reason ?? '') };
}

// If an answer is still cut off, keep the complete sentences of "text" rather than failing
function salvage(raw: string) {
  const m = raw.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return null;
  let t = m[1];
  try { t = JSON.parse(`"${t}"`); } catch { t = t.replace(/\\n/g, ' ').replace(/\\"/g, '"'); }
  const cut = Math.max(...['.', '।', '?', '!'].map((p) => t.lastIndexOf(p)));
  t = (cut > 20 ? t.slice(0, cut + 1) : t).trim();
  return t ? { text: t, bullets: [] as string[], handoff: false } : null;
}

export async function POST(req: NextRequest) {
  const a = process.env.ANTHROPIC_API_KEY;
  if (!a) return NextResponse.json({ error: 'No AI key set (ANTHROPIC_API_KEY)' }, { status: 501 });
  const { question, lang, context, name, history } = (await req.json().catch(() => ({}))) as { question?: string; lang?: string; context?: string; name?: string; history?: { q: string; a: string }[] };
  if (!question?.trim() || question.length > 500) return NextResponse.json({ error: 'question required (max 500 chars)' }, { status: 400 });
  const past = (Array.isArray(history) ? history.slice(-3) : []).map((h) => `Farmer: ${String(h.q).slice(0, 300)}\nYou: ${String(h.a).slice(0, 500)}`).join('\n');
  const user = `FACTS:\n${String(context ?? '').slice(0, 8000)}\n\n${past ? `EARLIER IN THIS CONVERSATION:\n${past}\n\n` : ''}FARMER NOW ASKS: ${question.trim()}`;
  const sys = system(lang ?? 'gu', String(name ?? '').slice(0, 60));
  try {
    const { text: raw, stop } = await claude(a, sys, user);
    const out = parse(raw) ?? (stop === 'max_tokens' ? salvage(raw) : null);
    if (!out) return NextResponse.json({ error: `Could not read AI answer${stop === 'max_tokens' ? ' (answer too long)' : ''}`, raw: raw.slice(0, 300) }, { status: 502 });
    return NextResponse.json({ ...out, source: 'claude' });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 502 });
  }
}
