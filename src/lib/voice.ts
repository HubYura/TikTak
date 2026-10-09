/* Озвучка Тіка.

   Основний голос — записи Лади (ukrainian-tts) у /voice/: фраза ріжеться на шматки
   (див. core/speech.ts), і шматки програються підряд через Web Audio. Так голос однаковий
   на будь-якому пристрої й працює офлайн.
   Якщо якогось шматка бракує, а в системі є український голос, — говорить Web Speech. */

import { speechPlan, speakable, type Piece } from '../core/speech';

export { speakable };

type Listener = (available: boolean) => void;

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let webVoice: SpeechSynthesisVoice | null = null;
let clips: Record<string, string> | null = null;
let voiceName = '';
let base = '/voice/';
const listeners: Listener[] = [];
const available = (): boolean => !!clips || !!webVoice;
const notify = () => listeners.forEach(l => l(available()));

function pickVoice(): void {
  if (!synth) return;
  const uk = synth.getVoices().filter(v => v.lang.toLowerCase().startsWith('uk'));
  // Локальні голоси звучать без затримки й працюють офлайн
  const next = uk.find(v => v.localService) || uk[0] || null;
  if (next !== webVoice) { webVoice = next; notify(); }
}

if (synth) {
  pickVoice();
  // Голоси часто довантажуються асинхронно; властивість працює й у старих Safari
  synth.onvoiceschanged = pickVoice;
}

/* ---------- Записи Лади ---------- */

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let playing: AudioBufferSourceNode[] = [];
let endsAt = 0;
let generation = 0;
let pending = false;   // записи ще вантажаться — фраза от-от почнеться

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Браузер будить звук лише після жесту — будимо при першому дотику
if (typeof window !== 'undefined') {
  ['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { audio(); }, { passive: true }));
}

function load(file: string): Promise<AudioBuffer | null> {
  let p = buffers.get(file);
  if (!p) {
    p = fetch(base + file)
      .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(b => new Promise<AudioBuffer>((res, rej) => audio()!.decodeAudioData(b, res, rej)))
      .catch(() => { buffers.delete(file); return null; });
    buffers.set(file, p);
  }
  return p;
}

const PIECE_GAP = 0.05, SENTENCE_GAP = 0.28;

async function playClips(plan: Piece[][], interrupt: boolean): Promise<boolean> {
  const c = audio();
  if (!c || !clips) return false;
  const my = ++generation;
  const files = plan.map(s => s.map(p => clips![p.key]));
  const decoded = await Promise.all(files.map(s => Promise.all(s.map(load))));
  if (my !== generation) return true;                  // поки вантажилось, почалась інша фраза
  if (decoded.some(s => s.some(b => !b))) return false;
  if (c.state !== 'running') return true;              // звук ще не дозволено — мовчимо, а не говоримо запізно
  if (interrupt) stopClips();
  let t = Math.max(c.currentTime + 0.03, interrupt ? 0 : endsAt);
  decoded.forEach((sentence, i) => {
    if (i) t += SENTENCE_GAP;
    sentence.forEach((b, j) => {
      if (j) t += PIECE_GAP;
      const src = c.createBufferSource();
      src.buffer = b!;
      src.connect(c.destination);
      src.start(t);
      src.onended = () => { playing = playing.filter(x => x !== src); };
      playing.push(src);
      t += b!.duration;
    });
  });
  endsAt = t;
  return true;
}

function stopClips(): void {
  playing.forEach(s => { try { s.stop(); } catch { /* уже зупинено */ } });
  playing = [];
  endsAt = 0;
}

/* ---------- Web Speech: запасний варіант ---------- */

function speakWeb(text: string, interrupt: boolean): void {
  if (!synth || !webVoice) return;
  const t = speakable(text);
  if (!t) return;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.voice = webVoice;
  u.lang = webVoice.lang;
  u.rate = 0.95;
  u.pitch = 1.15;
  synth.speak(u);
}

export const Voice = {
  available,
  onChange(l: Listener): void { listeners.push(l); l(available()); },

  /** Завантажує перелік записів. Без нього лишається тільки Web Speech. */
  load(url = '/voice/'): void {
    base = url.endsWith('/') ? url : url + '/';
    fetch(base + 'manifest.json')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((m: { voice?: string; clips?: Record<string, string> }) => {
        if (m.clips && Object.keys(m.clips).length) { clips = m.clips; voiceName = m.voice || ''; notify(); }
      })
      .catch(() => {});
  },

  /** Чий голос у записах: 'Lada' (ukrainian-tts) або 'Tik' (ElevenLabs). */
  name(): string { return voiceName; },

  /** interrupt=false — стати в чергу, не обриваючи попередню фразу. */
  speak(text: string, interrupt = true): void {
    const plan = speechPlan(text);
    if (!plan.length) return;
    const missing = clips ? plan.flat().filter(p => !clips![p.key]) : [];
    if (clips && !missing.length) {
      if (interrupt) synth?.cancel();
      pending = true;
      playClips(plan, interrupt).then(ok => { pending = false; if (!ok) speakWeb(text, interrupt); });
      return;
    }
    if (import.meta.env.DEV && clips) console.warn('[voice] немає запису:', missing.map(p => p.text));
    if (interrupt) { generation++; stopClips(); }
    speakWeb(text, interrupt);
  },

  /** Чи Тік зараз говорить (або от-от почне) — щоб урок не перемикав етап посеред фрази. */
  busy(): boolean {
    return pending || (!!ctx && ctx.state === 'running' && ctx.currentTime < endsAt) || !!synth?.speaking;
  },

  stop(): void {
    pending = false;
    generation++;
    stopClips();
    synth?.cancel();
  }
};
