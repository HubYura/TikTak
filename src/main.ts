/* ЧасоПарк — точка входу: збирає сцену, режими й цикл анімації. */

import '@fontsource/nunito/cyrillic-600.css';
import '@fontsource/nunito/cyrillic-800.css';
import '@fontsource/nunito/cyrillic-900.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import '@fontsource/unbounded/cyrillic-700.css';
import '@fontsource/unbounded/cyrillic-800.css';
import '@fontsource/unbounded/latin-700.css';
import '@fontsource/unbounded/latin-800.css';
import './styles/main.css';

import { PARK, RESET_SAY, VOICE_ON_SAY, parkLine } from './core/content';
import { logTime } from './core/progress';
import { SFX } from './lib/audio';
import { FX, reducedMotion } from './lib/fx';
import { Voice } from './lib/voice';
import { animateScene, buildScene, setFaceStyle, setStopwatch } from './scene/scene';
import { replay, say } from './ui/buddy';
import { camera, cameraTick, initCamera, type Box } from './ui/camera';
import { enterLearn, initLearn, learnFrame, refreshStageVideo, setPlaying, syncTower } from './ui/learn';
import { show3D } from './ui/scene3d';
import { INTRO } from './core/videos';
import { Videos } from './lib/video';
import { initVideo, videoButton } from './ui/video';
import { initParent } from './ui/parent';
import {
  awardBadges, enterPractice, initPractice, practiceFrame, renderScore, resetPracticeTrack, setOnRoundEnd
} from './ui/practice';
import { $, app, type Mode } from './ui/state';
import { mountTik } from './ui/tik';
import { applyPark, applyRevealSet } from './ui/view';

mountTik();
app.S = buildScene(document.getElementById('scene') as unknown as SVGSVGElement);
FX.mount();

/* ---------- Камера ---------- */

const WIDE: Box = [0, -10, 900, 630];
const PORTRAIT: Box = [228, -14, 444, 520];
const CLOSE: Box = [300, 64, 300, 250];      // впритул до циферблата: стрілку легко схопити пальцем
const REVEAL: Box = [60, -60, 780, 650];     // ті самі пропорції, що й CLOSE, але видно весь острів

function frameFor(): Box {
  if (app.mode === 'practice') return CLOSE;
  const w = window.innerWidth, h = window.innerHeight;
  // Лише для вузьких портретних екранів: у низькому альбомному вікні висока рамка з'їла б панель
  return w < 640 && h > w * 1.15 ? PORTRAIT : WIDE;
}

initCamera(app.S.svg, () => FX.resize());
camera(frameFor());
window.addEventListener('resize', () => camera(frameFor()));

/* ---------- Звук, голос, кнопки шапки ---------- */

['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => SFX.unlock(), { once: true }));
document.addEventListener('pointerdown', e => {
  const b = (e.target as Element).closest('button');
  if (b && !b.disabled && !b.classList.contains('opt')) SFX.tap();
}, true);

function paintSound(): void {
  const on = SFX.isOn();
  const b = $('btnSound');
  b.textContent = on ? '🔊' : '🔇';
  b.classList.toggle('is-off', !on);
  b.setAttribute('aria-pressed', String(on));
}
$('btnSound').addEventListener('click', () => {
  const on = SFX.toggle();
  paintSound();
  say(on ? 'Звук увімкнено!' : 'Тепер тихо.', 'happy', 1400, false);
});

function paintVoice(): void {
  const avail = Voice.available();
  const on = avail && app.p.settings.voice;
  const b = $('btnVoice');
  b.hidden = !avail;
  b.classList.toggle('is-off', !on);
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Тік говорить уголос' : 'Тік мовчить';
  $('btnReplay').hidden = !on;
}
$('btnVoice').addEventListener('click', () => {
  app.p.settings.voice = !app.p.settings.voice;
  app.save();
  paintVoice();
  if (!app.p.settings.voice) Voice.stop();
  say(app.p.settings.voice ? VOICE_ON_SAY : 'Добре, я мовчатиму.', 'happy', 1400);
});
$('btnReplay').addEventListener('click', replay);
Voice.onChange(paintVoice);
document.addEventListener('settings', () => { paintSound(); paintVoice(); });
paintSound();

/* ---------- Режими ---------- */

function setMode(m: Mode): void {
  app.mode = m;
  const learning = m === 'learn';
  const bl = $('modeLearn'), bp = $('modePractice');
  bl.classList.toggle('is-active', learning);
  bp.classList.toggle('is-active', !learning);
  bl.setAttribute('aria-selected', String(learning));
  bp.setAttribute('aria-selected', String(!learning));
  $('panelLearn').hidden = !learning;
  $('panelPractice').hidden = learning;
  $('ctrlLearn').hidden = !learning;
  $('ctrlPractice').hidden = learning;
  $('badge').hidden = !learning;
  document.body.dataset.mode = m;
  Voice.stop();

  camera(frameFor());

  if (learning) {
    app.S.grab.style.display = 'none';
    setFaceStyle(app.S, 'teach');
    setStopwatch(app.S, false);
    enterLearn();
    show3D(true, syncTower);
  } else {
    show3D(false);
    setPlaying(false);
    // У грі циферблат повний: без секундної стрілки, секторів чвертей і приглушення
    const all = new Set(Object.keys(app.S.parts));
    ['fSec', 'fQuarters', 'sun'].forEach(id => all.delete(id));
    applyRevealSet(all);
    app.S.face.classList.remove('focus');
    for (const p of Object.values(app.S.parts)) p.el.classList.remove('dim', 'pulse');
    enterPractice();
  }
}

$('modeLearn').addEventListener('click', () => setMode('learn'));
$('modePractice').addEventListener('click', () => setMode('practice'));
$('btnToGame').addEventListener('click', () => setMode('practice'));

/* ---------- Парк росте ---------- */

function celebratePark(): void {
  const fresh = applyPark();
  if (!fresh.length) return;
  const a = PARK.find(x => x.id === fresh[fresh.length - 1])!;
  app.p.park.push(...fresh);
  app.save();

  // Від'їжджаємо камерою, щоб дитина побачила, як атракціон з'являється в парку
  for (const id of fresh) app.S.park[id].classList.remove('on');
  camera(app.mode === 'practice' ? REVEAL : frameFor(), 900);
  setTimeout(() => {
    for (const id of fresh) app.S.park[id].classList.add('on');
    SFX.build();
    setTimeout(() => SFX.badge(), 250);
    FX.cheer(5);
  }, 950);
  setTimeout(() => {
    $('ptIco').textContent = a.ico;
    $('ptText').textContent = 'На твоїй планеті з’явився атракціон «' + a.name + '». Збирай зірки — парк на планеті ростиме далі!';
    $('parkToast').hidden = false;
    say(parkLine(a.name), 'cheer', 3000);
    $('ptOk').focus();
  }, 2200);
}
$('ptOk').addEventListener('click', () => {
  $('parkToast').hidden = true;
  camera(frameFor(), 700);
});
setOnRoundEnd(celebratePark);

/* ---------- Батьки ---------- */

initParent(() => {
  resetPracticeTrack();
  applyPark();
  renderScore();
  setMode(app.mode);
  say(RESET_SAY, 'happy', 2000);
});

/* ---------- Привітання ---------- */

function closeWelcome(target: Mode): void {
  $('welcome').hidden = true;
  app.p.welcomed = true;
  app.save();
  SFX.unlock();
  SFX.level();
  setMode(target);
  if (target === 'learn') setPlaying(true);
}
$('wLearn').addEventListener('click', () => closeWelcome('learn'));
$('wPlay').addEventListener('click', () => closeWelcome('practice'));

/* Esc закриває будь-яке вікно, крім привітання */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  for (const id of ['report', 'gate', 'parkToast']) {
    if (!$(id).hidden) { $(id).hidden = true; if (id === 'parkToast') camera(frameFor(), 700); }
  }
});

/* ---------- Цикл анімації ---------- */

let last = 0, T = 0, playMs = 0;
const reduced = reducedMotion();

function frame(ts: number): void {
  if (!last) last = ts;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  T += dt;

  if (app.mode === 'learn') learnFrame(dt);
  else practiceFrame(ts);
  animateScene(app.S, T, reduced);
  cameraTick(ts);

  // Час у грі — лише коли вкладка на екрані
  if (!document.hidden) {
    playMs += dt * 1000;
    if (playMs > 15000) { logTime(app.p, playMs); playMs = 0; app.save(); }
  }
  requestAnimationFrame(frame);
}

/* ---------- Відео ---------- */

initVideo();
Videos.onChange(() => {
  refreshStageVideo();
  const b = videoButton(INTRO, '▶ Знайомство з Тіком');
  $('wVideo').replaceChildren(...(b ? [b] : []));
});
// Типово — тека /videos/ на самому сайті; окреме сховище задається через VITE_VIDEO_BASE
Videos.load(import.meta.env.VITE_VIDEO_BASE || '/videos/');
Voice.load('/voice/');

/* ---------- Старт ---------- */

initLearn();
initPractice();
applyRevealSet(new Set());
applyPark();
app.p.park = Array.from(new Set([...app.p.park, ...PARK.filter(a => app.S.park[a.id].classList.contains('on')).map(a => a.id)]));
renderScore();
awardBadges();
setMode('learn');
setPlaying(app.p.welcomed);
requestAnimationFrame(frame);

if (!app.p.welcomed) $('welcome').hidden = false;
else if (app.p.totals.asked > 0) say('З поверненням! Продовжимо урок чи пограємо?', 'happy', 2200, false);

if (import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
