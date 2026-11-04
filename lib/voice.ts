'use client';
import { LANG_CODE, type Lang } from './i18n';

// ---------- Capability check ----------
let health: Promise<{ gnani: boolean; stt?: string | null }> | null = null;
export function voiceHealth() {
  if (!health) health = fetch('/api/health').then((r) => r.json()).catch(() => ({ gnani: false }));
  return health;
}

// ---------- Text to speech ----------
let current: HTMLAudioElement | null = null;
export function stopSpeaking() {
  if (current) { current.pause(); current = null; }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

export async function speak(text: string, lang: Lang, onEnd?: () => void): Promise<'gnani' | 'browser' | 'none'> {
  stopSpeaking();
  const h = await voiceHealth();
  if (h.gnani) {
    try {
      const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }) });
      if (r.ok) {
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = new Audio(url);
        current = a;
        a.onended = () => { URL.revokeObjectURL(url); onEnd?.(); };
        await a.play();
        return 'gnani';
      }
    } catch { /* fall through to browser voice */ }
  }
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LANG_CODE[lang];
    const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(LANG_CODE[lang].toLowerCase().slice(0, 2)));
    if (v) u.voice = v;
    u.rate = 0.95;
    u.onend = () => onEnd?.();
    window.speechSynthesis.speak(u);
    return 'browser';
  }
  onEnd?.();
  return 'none';
}

// ---------- Recording to 16 kHz mono WAV (sent to Gemini speech to text) ----------
function encodeWav(samples: Float32Array, rate: number) {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function downsample(data: Float32Array, from: number, to: number) {
  if (from === to) return data;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(data.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio), end = Math.floor((i + 1) * ratio);
    let sum = 0; for (let j = start; j < end && j < data.length; j++) sum += data[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

export interface Recorder { stop: () => void }

// Records until stop() is called, 1.8 s of silence after speech, or 15 s.
// The AudioContext is created before any await so it starts inside the tap (Safari and iOS need this).
export async function recordWav(onDone: (wav: Blob | null) => void): Promise<Recorder> {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (e) { ctx.close(); throw e; }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
  const src = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const mute = ctx.createGain(); mute.gain.value = 0; // keeps the processor running without echoing the mic
  const chunks: Float32Array[] = [];
  let heard = false, silentSince = performance.now(), done = false;
  const finish = () => {
    if (done) return; done = true;
    clearTimeout(cap);
    proc.onaudioprocess = null;
    try { proc.disconnect(); src.disconnect(); mute.disconnect(); } catch { /* already disconnected */ }
    stream.getTracks().forEach((t) => t.stop());
    const len = chunks.reduce((x, c) => x + c.length, 0);
    const all = new Float32Array(len); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
    const rate = ctx.sampleRate; ctx.close();
    onDone(len > rate * 0.4 ? encodeWav(downsample(all, rate, 16000), 16000) : null);
  };
  const cap = setTimeout(finish, 15000); // hard stop even if audio processing never starts
  proc.onaudioprocess = (e) => {
    const d = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(d));
    let rms = 0; for (let i = 0; i < d.length; i++) rms += d[i] * d[i]; rms = Math.sqrt(rms / d.length);
    const t = performance.now();
    if (rms > 0.01) { heard = true; silentSince = t; }
    if (heard && t - silentSince > 1800) finish();
  };
  src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
  return { stop: finish };
}

export async function transcribe(wav: Blob, lang: Lang): Promise<{ text: string | null; error?: string }> {
  const fd = new FormData();
  fd.append('audio_file', wav, 'question.wav');
  fd.append('language', lang);
  try {
    const r = await fetch('/api/stt', { method: 'POST', body: fd });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { text: null, error: `STT ${r.status}: ${String(j?.detail ?? j?.error ?? '').slice(0, 120)}` };
    const t = String(j.transcript ?? '').trim();
    return t ? { text: t } : { text: null, error: 'empty' };
  } catch { return { text: null, error: 'network' }; }
}

// ---------- Browser speech recognition fallback (Chrome, Edge) ----------
type SR = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null };
export function browserRecognition(): (new () => SR) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
