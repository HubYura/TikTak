/* Звук — усе синтезується через Web Audio.
   Жодних файлів, жодних мережевих запитів. */

import { getFlag, setFlag } from './storage';

const KEY = 'chasopark.sound.v1';

interface ToneOpts { at?: number; type?: OscillatorType; to?: number; vol?: number; attack?: number }
interface HissOpts { at?: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number; vol?: number }

export const SFX = (() => {

  let ctx: AudioContext | null = null, master: GainNode | null = null, noiseBuf: AudioBuffer | null = null;
  let enabled = getFlag(KEY, true);

  /* Браузери створюють контекст у стані suspended, поки не буде жесту
     користувача. Тому будимо його при кожному відтворенні. */
  function ensure(): AudioContext | null {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch { return null; }
      master = ctx.createGain();
      master.gain.value = 0.26;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function noise(c: AudioContext): AudioBuffer {
    if (!noiseBuf) {
      const n = Math.floor(c.sampleRate * 0.5);
      noiseBuf = c.createBuffer(1, n, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function tone(freq: number, dur: number, o: ToneOpts = {}): void {
    const ctx = enabled ? ensure() : null;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);

    const vol = o.vol == null ? 0.6 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  function hiss(dur: number, o: HissOpts = {}): void {
    const ctx = enabled ? ensure() : null;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    const flt = ctx.createBiquadFilter();
    const g = ctx.createGain();

    src.buffer = noise(ctx);
    flt.type = o.filter || 'bandpass';
    flt.frequency.setValueAtTime(o.freq || 1200, t0);
    if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    flt.Q.value = o.q || 1;

    const vol = o.vol == null ? 0.4 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(flt); flt.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  const chord = (notes: number[], step: number, dur: number, o: ToneOpts) =>
    notes.forEach((f, i) => tone(f, dur, Object.assign({ at: i * step }, o)));

  const API = {
    /* Інтерфейс */
    click:  () => tone(660, 0.06, { type: 'triangle', vol: 0.35 }),
    tap:    () => tone(880, 0.05, { type: 'square', vol: 0.22 }),
    swipe:  () => hiss(0.22, { freq: 500, to: 2600, vol: 0.22 }),

    /* Годинник */
    tick:   () => tone(1450, 0.03, { type: 'square', vol: 0.16 }),
    tock:   () => tone(1150, 0.03, { type: 'square', vol: 0.16 }),
    /* Клацання, коли стрілка переступає хвилину */
    notch:  () => tone(1000, 0.022, { type: 'square', vol: 0.13 }),

    /* Будівництво */
    build:  () => { tone(150, 0.16, { type: 'triangle', to: 70, vol: 0.5 });
                    hiss(0.14, { freq: 900, to: 260, vol: 0.25 }); },

    /* Відповіді */
    correct: () => chord([523.25, 659.25, 783.99, 1046.5], 0.065, 0.28,
                         { type: 'triangle', vol: 0.5 }),
    /* М'яко й без осуду: дві спадні ноти, а не різкий зумер */
    wrong:   () => { tone(392, 0.16, { type: 'sine', vol: 0.4 });
                     tone(311.13, 0.26, { type: 'sine', vol: 0.36, at: 0.14 }); },

    /* Нагороди */
    star:   () => chord([1318.5, 1760, 2093], 0.05, 0.22, { type: 'triangle', vol: 0.32 }),
    level:  () => { chord([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, 0.42,
                          { type: 'triangle', vol: 0.5 });
                    hiss(0.5, { freq: 2600, to: 700, vol: 0.14, at: 0.1 }); },
    badge:  () => { chord([784, 1046.5, 1318.5, 1568], 0.07, 0.5,
                          { type: 'triangle', vol: 0.45 });
                    tone(261.63, 0.6, { type: 'sine', vol: 0.3 }); },

    /* Керування */
    isOn: () => enabled,
    set(v: boolean) {
      enabled = !!v;
      setFlag(KEY, enabled);
      if (enabled) { ensure(); API.click(); }
    },
    toggle(): boolean { API.set(!enabled); return enabled; },
    /* Викликається на першому жесті: без цього контекст лишиться сплячим */
    unlock() { if (enabled) ensure(); }
  };

  return API;
})();
