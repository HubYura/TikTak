/* Озвучка Тіка через Web Speech.
   Український голос є не на кожному пристрої — тоді кнопка озвучки просто ховається. */

type Listener = (available: boolean) => void;

const synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;

let voice: SpeechSynthesisVoice | null = null;
const listeners: Listener[] = [];

function pickVoice(): void {
  if (!synth) return;
  const all = synth.getVoices();
  const uk = all.filter(v => v.lang.toLowerCase().startsWith('uk'));
  // Локальні голоси звучать без затримки й працюють офлайн
  const next = uk.find(v => v.localService) || uk[0] || null;
  if (next !== voice) {
    voice = next;
    listeners.forEach(l => l(!!voice));
  }
}

if (synth) {
  pickVoice();
  // Голоси часто довантажуються асинхронно; властивість працює й у старих Safari
  synth.onvoiceschanged = pickVoice;
}

/** Прибирає емодзі й розмітку — інакше синтезатор читає «усміхнене обличчя». */
export function speakable(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => (m === '00' ? h : h + ' ' + Number(m)))
    .replace(/[★☆➜✓]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const Voice = {
  available: (): boolean => !!voice,
  onChange(l: Listener): void { listeners.push(l); l(!!voice); },
  speak(text: string): void {
    if (!synth || !voice) return;
    const t = speakable(text);
    if (!t) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.95;
    u.pitch = 1.15;
    synth.speak(u);
  },
  stop(): void { synth?.cancel(); }
};
