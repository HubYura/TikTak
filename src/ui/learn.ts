/* Режим «Урок»: 11 етапів анімованого пояснення. */

import { STAGES, STAGE_SAY } from '../core/content';
import { partOfDay, sayTime } from '../core/phrasing';
import { digital, digital24 } from '../core/time';
import { SFX } from '../lib/audio';
import { STAGE_VIDEOS } from '../core/videos';
import { say } from './buddy';
import { $, app, h } from './state';
import { videoButton } from './video';
import { applyFocus, applyRevealSet, renderHands, setSky, showSun, visibleIds } from './view';

let cur = 0;
let playing = false;
let speed = 1;
let focusOn = true;
let tm = 540, target = 540, acc = 0, stageT = 0;
let tickFlip = false;

export const learnStage = (): number => cur;

export function initLearn(): void {
  const rail = $('rail');
  STAGES.forEach((st, i) => {
    const b = h('button', { class: 'rail-dot', type: 'button', title: 'Етап ' + (i + 1) + ': ' + st.title,
      'aria-label': 'Етап ' + (i + 1) + ': ' + st.title, text: String(i + 1) });
    b.addEventListener('click', () => goTo(i));
    rail.appendChild(b);
  });

  $('btnPlay').addEventListener('click', () => setPlaying(!playing));
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
}

export function setPlaying(v: boolean): void {
  playing = v;
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
  say(STAGE_SAY[cur], moved ? 'happy' : 'idle', 1500, !quiet || moved);

  tm = target = st.start;
  acc = 0;
  stageT = 0;

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
  // Не scrollIntoView: той прокрутив би всю сторінку на телефоні
  const dot = rail.children[cur] as HTMLElement | undefined;
  if (dot) rail.scrollTo({ left: dot.offsetLeft - rail.clientWidth / 2 + dot.offsetWidth / 2, behavior: 'smooth' });

  $<HTMLButtonElement>('btnPrev').disabled = cur === 0;
  $<HTMLButtonElement>('btnNext').disabled = cur === STAGES.length - 1;
  $('btnToGame').hidden = cur !== STAGES.length - 1;

  if (!app.p.seen.includes(cur)) { app.p.seen.push(cur); app.save(); }

  if (!st.day) { setSky(12); showSun(null); }
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
  const mins = ((tm % 1440) + 1440) % 1440;
  renderHands(mins, mins % 1);

  if (st.time) {
    const read = (((st.snap ? target : tm) % 1440) + 1440) % 1440;
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
    if (stageT > st.hold) {
      if (cur < STAGES.length - 1) goTo(cur + 1);
      else { setPlaying(false); stageT = 0; }
    }
  }
  const k = st.snap ? 9 : 22;
  tm += (target - tm) * (1 - Math.exp(-dt * k));
  renderLearn();
}
