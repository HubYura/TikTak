/* Режим «Урок»: 11 етапів анімованого пояснення. */

import { PRAISE, STAGES, STAGE_SAY, TRIES, TRY_MISS, type TryDef } from '../core/content';
import { partOfDay, sayTime } from '../core/phrasing';
import { digital, digital24 } from '../core/time';
import { SFX } from '../lib/audio';
import { FX } from '../lib/fx';
import { Voice } from '../lib/voice';
import { STAGE_VIDEOS } from '../core/videos';
import { popover, say, speakNow, speakTap } from './buddy';
import { freeRect, tower3d } from './scene3d';
import { $, app, h } from './state';
import { videoButton } from './video';
import { applyFocus, applyRevealSet, renderHands, setSky, showSun, visibleIds } from './view';

let cur = 0;
let playing = false;
let speed = 1;
let focusOn = true;
let tm = 540, target = 540, acc = 0, stageT = 0;
let tickFlip = false;
/** Скільки мс Тік уже мовчить: етап перемикається лише після того, як пояснення дозвучало. */
let quietMs = 0;
const AFTER_SPEECH = 1600;

/* Тік зачитує етап повністю: свою фразу, «Головне», «Часта помилка» і «Спробуй сам» — по черзі,
   підсвічуючи картку, яку читає. Діти 6 років ще погано читають, тож текст не має бути лише на екрані. */
type Part = { text: string; card: 'idea' | 'warn' | 'try' | null };
let narr: Part[] = [];
let narrIdx = 0;
let narrOn = false;          // пауза зупиняє й читання, а не лише перемикання етапів
let narrQuiet = 0;
const PART_GAP = 450;
const LEAD: Record<'idea' | 'warn' | 'try', string> = { idea: 'Головне.', warn: 'Запам’ятай.', try: 'Спробуй сам.' };

function partsFor(i: number): Part[] {
  const st = STAGES[i];
  return [
    { text: STAGE_SAY[i], card: null },
    { text: LEAD.idea + ' ' + st.idea, card: 'idea' },
    { text: LEAD.warn + ' ' + st.warn, card: 'warn' },
    { text: LEAD.try + ' ' + st.todo, card: 'try' }
  ];
}
const narrating = (): boolean => narrOn && narrIdx < narr.length;
function markReading(card: Part['card']): void {
  document.querySelectorAll('#panelLearn .card').forEach(c => c.classList.toggle('reading', !!card && c.classList.contains(card)));
}
/** Усі тексти уроку — для збирача фраз озвучки. */
export const LESSON_LINES = (): string[] => [
  ...STAGES.flatMap((_, i) => partsFor(i).map(p => p.text)),
  ...TRIES.flatMap(t => (t ? [t.ask, t.ok] : [])),
  ...Object.values(TRY_MISS)
];

/* ---------- «Тепер ти!»: дія на 3D-вежі після пояснення ---------- */
interface Trying { def: TryDef; dial: number; from: number; sum: number; done: boolean; missed: boolean; drag: boolean; lastAng: number }
let trying: Trying | null = null;
let triedStage = -1;                      // на цьому етапі вже пробували — автопрогравання не питає вдруге

const angleOfPoint = (x: number, y: number): number => ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;   // 0 — на 12, за годинниковою
const wrap = (d: number): number => (d > 180 ? d - 360 : d < -180 ? d + 360 : d);

function startTry(): void {
  const def = TRIES[cur], t = tower3d();
  if (!def || !t) return;
  trying = { def, dial: def.start, from: def.start, sum: 0, done: false, missed: false, drag: false, lastAng: 0 };
  triedStage = cur;
  narrOn = false;
  markReading('try');
  t.setInteractive(true);
  document.body.classList.add('learn-try');
  $('btnTry').hidden = true;
  say(def.ask, 'point', 2600, false);
  speakNow(def.ask);
}

function endTry(): void {
  if (!trying) return;
  trying = null;
  tower3d()?.setInteractive(false);
  document.body.classList.remove('learn-try');
  $('btnTry').hidden = !TRIES[cur] || !tower3d();
}

function tryOk(): void {
  if (!trying || trying.done) return;
  trying.done = true;
  SFX.correct();
  FX.cheer(3);
  FX.buzz(28);
  popover(PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  say(trying.def.ok, 'cheer', 2600, false);
  speakNow(trying.def.ok);
  markReading(null);
  quietMs = 0;
  setTimeout(() => { if (trying?.done) endTry(); }, 1600);
}

function tryMiss(): void {
  if (!trying || trying.missed) return;
  trying.missed = true;            // підказуємо раз — далі дитина пробує сама
  SFX.wrong();
  say(TRY_MISS[trying.def.kind], 'think', 2400, false);
  speakNow(TRY_MISS[trying.def.kind]);
}

/** Точка дотику відносно вежі: для кола — центр вільної частини екрана, для решти — циферблат. */
function tryPoint(e: PointerEvent): { a: number; r: number } | null {
  if (trying!.def.kind === 'circle') {
    const f = freeRect(), cx = f.x + f.w / 2, cy = f.y + f.h / 2;
    return { a: angleOfPoint(e.clientX - cx, cy - e.clientY), r: 0 };
  }
  const p = tower3d()?.dialPoint(e.clientX, e.clientY);
  return p ? { a: angleOfPoint(p.x, p.y), r: Math.hypot(p.x, p.y) } : null;
}

function initTry(): void {
  const cv = $('scene3d');
  cv.addEventListener('pointerdown', e => {
    if (!trying || trying.done || app.mode !== 'learn') return;
    const p = tryPoint(e);
    if (!p) return;
    const k = trying.def.kind;
    if (k === 'tap') {
      if (p.r > 1.15) return;
      const n = Math.round(p.a / 30) % 12 || 12;
      if (n === trying.def.n) tryOk(); else { trying.missed = false; tryMiss(); }
      return;
    }
    if (k !== 'circle' && p.r > 1.2) return;
    trying.drag = true;
    trying.lastAng = p.a;
    try { cv.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    e.preventDefault();
  });
  cv.addEventListener('pointermove', e => {
    if (!trying?.drag || trying.done) return;
    const p = tryPoint(e);
    if (!p) return;
    const d = wrap(p.a - trying.lastAng);
    trying.lastAng = p.a;
    const k = trying.def.kind;
    if (k === 'circle') {
      trying.sum += d;
      if (trying.sum >= 320) tryOk();
      else if (trying.sum <= -120) { trying.sum = 0; tryMiss(); }
    } else if (k === 'hour') {
      const h = Math.round(p.a / 30) % 12;
      if (h * 60 !== trying.dial % 720) { trying.dial = h * 60; SFX.notch(); }
    } else {
      // Довга стрілка: як у справжнього годинника, оберт переносить і годину
      const before = Math.round(trying.dial);
      trying.dial = (trying.dial + d / 6 + 1440) % 1440;
      if (Math.round(trying.dial) !== before) SFX.notch();
      if (k === 'turn') { trying.sum += d; if (trying.sum >= 350) tryOk(); }
    }
  });
  const up = () => {
    if (!trying?.drag) return;
    trying.drag = false;
    const k = trying.def.kind;
    if (k === 'hour') { if (trying.dial % 720 === (trying.def.n! % 12) * 60) tryOk(); else tryMiss(); }
    if (k === 'minute') {
      const step = trying.def.m! % 5 ? 1 : 5;
      trying.dial = Math.round(trying.dial / step) * step;
      if (((trying.dial % 60) + 60) % 60 === trying.def.m) tryOk(); else tryMiss();
    }
  };
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  $('btnTry').addEventListener('click', e => { e.stopPropagation(); startTry(); });   // не читати картку замість завдання
}
/* «Підсвітка» на 3D-вежі: що пульсує на етапі */
const FOCUS_3D: Record<string, 'h' | 'm' | 's' | 'nums' | 'ticks'> = {
  fHour: 'h', fMin: 'm', fSec: 's', fNumsMin: 'nums', fTicksMin: 'ticks'
};

export const learnStage = (): number => cur;

export function initLearn(): void {
  const rail = $('rail');
  STAGES.forEach((st, i) => {
    const b = h('button', { class: 'rail-dot', type: 'button', title: 'Етап ' + (i + 1) + ': ' + st.title,
      'aria-label': 'Етап ' + (i + 1) + ': ' + st.title, text: String(i + 1) });
    b.addEventListener('click', () => goTo(i));
    rail.appendChild(b);
  });

  $('btnPlay').addEventListener('click', () => {
    // Наприкінці уроку «Пуск» починає спочатку, а не зупиняється одразу
    if (!playing && cur === STAGES.length - 1 && !narrating()) goTo(0);
    setPlaying(!playing);
  });

  initTry();

  // Дотик до картки — Тік зачитує саме її
  (['idea', 'warn', 'try'] as const).forEach(card => {
    document.querySelector('#panelLearn .card.' + card)?.addEventListener('click', () => {
      const part = partsFor(cur).find(p => p.card === card)!;
      narrOn = false;
      markReading(card);
      speakTap(part.text);
    });
  });
  $('btnPrev').addEventListener('click', () => goTo(cur - 1));
  $('btnNext').addEventListener('click', () => goTo(cur + 1));
  $('btnReset').addEventListener('click', () => { goTo(0); setPlaying(false); });

  document.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(b => {
    b.addEventListener('click', () => {
      speed = parseFloat(b.dataset.speed || '1');
      document.querySelectorAll('[data-speed]').forEach(o => o.classList.toggle('is-active', o === b));
    });
  });

  const tgl = $<HTMLInputElement>('tglFocus');
  tgl.addEventListener('change', () => { focusOn = tgl.checked; refreshFocus(); });

  document.addEventListener('keydown', e => {
    if (app.mode !== 'learn' || document.querySelector('.overlay:not([hidden])')) return;
    if ((e.target as Element).matches('input, textarea, select')) return;
    if (e.key === 'ArrowRight') { goTo(cur + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { goTo(cur - 1); e.preventDefault(); }
    else if (e.code === 'Space' && !(e.target as Element).matches('button')) { setPlaying(!playing); e.preventDefault(); }
    else if (['r', 'R', 'к', 'К'].includes(e.key)) { goTo(0); setPlaying(false); }
  });
}

function refreshFocus(): void {
  const st = STAGES[cur];
  applyFocus(focusOn && st.focus ? st.focus : null, focusOn && st.pulse ? st.pulse : null, visibleIds(cur));
  tower3d()?.setFocus(focusOn && st.pulse ? FOCUS_3D[st.pulse] ?? null : null);
}

export function setPlaying(v: boolean): void {
  playing = v;
  if (v) {
    // Продовжуємо читати з тієї частини, на якій зупинились (а якщо етап ще не читали — з початку)
    if (!narr.length) { narr = partsFor(cur); narrIdx = 0; }
    narrOn = true;
    narrQuiet = PART_GAP;
  } else if (narrOn) {
    narrOn = false;
    if (narrIdx > 0 && narrIdx <= narr.length) narrIdx--;   // перерване речення прочитаємо знову
    Voice.stop();
    markReading(null);
  }
  const b = $('btnPlay');
  b.textContent = v ? '❚❚' : '▶';
  b.setAttribute('aria-label', v ? 'Пауза' : 'Пуск');
}

export function enterLearn(): void {
  goTo(cur, true);
}

export function goTo(i: number, quiet = false): void {
  const next = Math.max(0, Math.min(STAGES.length - 1, i));
  const moved = next !== cur;
  cur = next;
  const st = STAGES[cur];

  if (!quiet) {
    if (cur <= 2) SFX.build(); else SFX.swipe();
  }
  // Фразу етапу Тік і показує, і читає — разом з картками, по черзі (див. narr)
  say(STAGE_SAY[cur], moved ? 'point' : 'idle', 1800, false);
  endTry();
  if (moved) triedStage = -1;
  narr = quiet && !moved ? [] : partsFor(cur);
  narrIdx = 0;
  narrQuiet = PART_GAP;
  narrOn = narr.length > 0;
  markReading(null);

  tm = target = st.start;
  acc = 0;
  stageT = 0;
  quietMs = 0;

  applyRevealSet(visibleIds(cur));
  refreshFocus();

  $('badge').textContent = 'Етап ' + (cur + 1) + ' / ' + STAGES.length;
  $('chip').textContent = st.chip;
  $('stTitle').textContent = st.title;
  $('stDesc').textContent = st.desc;
  $('stIdea').textContent = st.idea;
  $('stWarn').textContent = st.warn;
  $('stTry').textContent = st.todo;
  refreshStageVideo();
  $('readout').hidden = !st.time;

  const rail = $('rail');
  [...rail.children].forEach((d, k) => {
    d.classList.toggle('now', k === cur);
    d.classList.toggle('done', app.p.seen.includes(k) && k !== cur);
    d.setAttribute('aria-current', k === cur ? 'step' : 'false');
  });

  $<HTMLButtonElement>('btnPrev').disabled = cur === 0;
  $<HTMLButtonElement>('btnNext').disabled = cur === STAGES.length - 1;
  $('btnToGame').hidden = cur !== STAGES.length - 1;

  if (!app.p.seen.includes(cur)) { app.p.seen.push(cur); app.save(); }

  if (!st.day) { setSky(12); showSun(null); }
  tower3d()?.setStage(cur, !quiet);
  renderLearn();
}

/** 3D-сцена щойно з'явилась — показати їй поточний етап. */
export function syncTower(): void {
  tower3d()?.setStage(cur, false);
  $('btnTry').hidden = !TRIES[cur] || !!trying;
  refreshFocus();
  renderLearn();
}

/** Кнопка відео етапу — лише коли кліп уже є у сховищі. */
export function refreshStageVideo(): void {
  const b = videoButton(STAGE_VIDEOS[cur], '▶ Відео');
  if (b) b.addEventListener('click', () => setPlaying(false), { capture: true });
  $('stVideo').replaceChildren(...(b ? [b] : []));
}

function renderLearn(): void {
  const st = STAGES[cur];
  const mins = (((trying ? trying.dial : tm) % 1440) + 1440) % 1440;
  renderHands(mins, mins % 1);
  const t3 = tower3d();
  if (t3) { t3.setTime(mins, mins % 1); t3.setDay(st.day ? mins : null); }

  if (st.time) {
    const read = (((trying ? trying.dial : st.snap ? target : tm) % 1440) + 1440) % 1440;
    const h24 = Math.floor(read / 60) % 24;
    const m = Math.floor(read % 60);
    if (st.day) {
      $('digital').textContent = digital24(h24, m);
      $('verbal').textContent = digital(h24, m) + ' ' + partOfDay(h24) + ' · ' + sayTime(h24, m);
      setSky(h24);
      showSun(mins);
    } else {
      $('digital').textContent = digital(h24, m);
      $('verbal').textContent = sayTime(h24, m);
    }
  }
}

export function learnFrame(dt: number): void {
  const st = STAGES[cur];
  // Читання етапу: наступна частина — коли попередня дозвучала й минула коротка пауза
  if (narrating()) {
    narrQuiet = Voice.busy() ? 0 : narrQuiet + dt * 1000;
    if (narrQuiet >= PART_GAP) {
      const p = narr[narrIdx++];
      markReading(p.card);
      speakNow(p.text);
      narrQuiet = 0;
    }
  } else if (narrOn && narrIdx >= narr.length && !Voice.busy()) {
    markReading(null);
  }
  if (playing) {
    stageT += dt * 1000 * speed;
    if (st.rate) {
      const r = st.rate * speed;
      if (st.snap) {
        acc += dt * r;
        while (acc >= st.snap) {
          acc -= st.snap;
          target += st.snap;
          // Цокаємо лише там, де крок не частіший за пів секунди — інакше тріскотіння
          if (st.snap / r >= 0.5) { tickFlip = !tickFlip; if (tickFlip) SFX.tick(); else SFX.tock(); }
        }
      } else {
        target += dt * r;
      }
      if (target > 2880) { target -= 1440; tm -= 1440; }
    }
    // Наступний етап — коли минув час етапу І Тік договорив (плюс коротка пауза, щоб усе осмислити)
    quietMs = Voice.busy() ? 0 : quietMs + dt * 1000;
    // Після пояснення — «Тепер ти!»; урок чекає, доки дитина спробує (▶▶ — пропустити)
    if (!narrating() && !trying && triedStage !== cur && TRIES[cur] && tower3d() && quietMs > 600) startTry();
    if (trying && !trying.done) { stageT = Math.min(stageT, st.hold); quietMs = 0; }
    if (stageT > st.hold && !narrating() && !trying && quietMs > AFTER_SPEECH) {
      if (cur < STAGES.length - 1) goTo(cur + 1);
      else { setPlaying(false); stageT = 0; }
    }
  }
  const k = st.snap ? 9 : 22;
  tm += (target - tm) * (1 - Math.exp(-dt * k));
  renderLearn();
}

// Для перевірок у режимі розробки: чи йде урок і чи чекає він на Тіка
if (import.meta.env.DEV) {
  (window as unknown as { __learn: () => object }).__learn = () => ({ cur, playing, narrIdx, narrOn, stageT: Math.round(stageT), busy: Voice.busy() });
}
