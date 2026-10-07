/* Режим «Гра»: рівні, пригоди, адаптивний добір і перетягування стрілок. */

import { planTask, recordTraps, scheduleReview, tooSimilar, type Plan, type Recent } from '../core/adaptive';
import {
  ADVENTURES, BADGES, CHEER_SAY, CHEER_UP, LEVELS, MAX_STARS, PASS, PRAISE, PRAISE_SAY, ROUND,
  PARK, RESET_SAY, ROUND_FAIL_SAY, ROUND_PASS_SAY, STAGE_SAY, VOICE_ON_SAY, badgeLine, nextAttraction, parkLine, starsFor, totalStars,
  unlockLine, unlockWhat, type AdventureId
} from '../core/content';
import { partOfDay, sayTime } from '../core/phrasing';
import { dailyDone, logAnswer, markDaily, type LevelRec } from '../core/progress';
import {
  ROUTINE, diagnoseSet, elapsedTask, readOptions, routineTask, sayOptions, trapsFor,
  type ElapsedTask, type Option, type RoutineTask, type Trap
} from '../core/questions';
import { feelTask, judgeEstimate, type FeelTask } from '../core/feel';
import { planningTask, type PlanTask } from '../core/planning';
import { homeSnap, homeTolerance, judgeHome, type HomeHint } from '../core/homeclock';
import { pick, rnd, shuffle } from '../core/rng';
import { TRAP_VIDEOS } from '../core/videos';
import { angleDist, angleOf, digital, fromDial, toDial } from '../core/time';
import { SFX } from '../lib/audio';
import { FX } from '../lib/fx';
import { CX, CY, FACE_NAMES, R, setFaceStyle, setStopwatch, type FaceStyle } from '../scene/scene';
import { bump, gesture, popover, say, speakAfter, speakNow, speakTap } from './buddy';
import { LESSON_LINES } from './learn';
import { show3D, tower3d } from './scene3d';
import { $, anyOf, app, h } from './state';
import { videoButton } from './video';
import { renderHands, setSky, showSun } from './view';

type Track = { kind: 'level'; idx: number } | { kind: 'adv'; id: AdventureId };

type Task =
  | { type: 'clock'; plan: Plan; options: Option[]; style?: FaceStyle }
  | { type: 'routine'; t: RoutineTask }
  | { type: 'elapsed'; t: ElapsedTask }
  | { type: 'plan'; t: PlanTask }
  | { type: 'feel'; t: FeelTask }
  | { type: 'home'; tries: number };

let track: Track = { kind: 'level', idx: Math.min(app.p.level, app.p.unlocked) };
let task: Task | null = null;
let round: boolean[] = [];
let answered = false;
let dial = 540;     // що показує циферблат у грі (0..719)
let raw = 540;      // необроблений стан під час перетягування
let anim: { from: number; to: number; t0: number; ms: number } | null = null;
/* «Скільки триває хвилина?»: коли натиснули «Старт» і де зараз секундна стрілка */
let timerStart = 0;
let secShown: { to: number; t0: number } | null = null;
/* Що було в цьому сеансі — щоб завдання не повторювались поспіль */
let recent: Recent[] = [];
let recentKeys: string[] = [];
const seenRecently = (key: string, n = 4) => recentKeys.slice(-n).includes(key);
/** Бере перший варіант, якого не було нещодавно (або останній, якщо вибору нема). */
function fresh<T>(make: () => T, keyOf: (x: T) => string, n = 4): T {
  let x = make();
  for (let i = 0; i < 25 && seenRecently(keyOf(x), n); i++) x = make();
  recentKeys.push(keyOf(x));
  if (recentKeys.length > 20) recentKeys.shift();
  return x;
}

/** Викликається після кожного раунду — main.ts святкує нові атракціони. */
let onRoundEnd: () => void = () => {};
export const setOnRoundEnd = (f: () => void): void => { onRoundEnd = f; };

const snapOf = (): number => track.kind === 'level' ? LEVELS[track.idx].snap : 5;
const trackRec = (): LevelRec => track.kind === 'level' ? app.p.levels[track.idx] : app.p.adventures[track.id];
const advOf = (id: AdventureId) => ADVENTURES.find(a => a.id === id)!;
const advUnlocked = (id: AdventureId) => app.p.unlocked >= advOf(id).needs;

const POD = {
  'ранку': { ico: '🌅', word: 'ранок' }, 'дня': { ico: '☀️', word: 'день' },
  'вечора': { ico: '🌆', word: 'вечір' }, 'ночі': { ico: '🌙', word: 'ніч' }
} as const;

/* ---------- Запуск ---------- */

export function initPractice(): void {
  $('pCheck').addEventListener('click', checkHands);
  $('pDunno').addEventListener('click', giveUp);
  $('pNext').addEventListener('click', nextTask);
  initDrag();
}

export function enterPractice(): void {
  setSky(12);
  showSun(null);
  startTrack();
  if (dailyDone(app.p)) say('Час гри! Обери відповідь або покрути стрілки.', 'happy', 2200, false);
  else say(DAILY_ASK, 'happy', 4200, false);
}

function startTrack(): void {
  round = [];
  // Після вибору рівня питання має бути перед очима, а не десь нагорі
  $('panel').scrollTo({ top: 0, behavior: 'smooth' });
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  renderTracks();
  renderDots();
  renderScore();
  renderBadges();
  newTask();
}

/* ---------- Питання ---------- */

function newTask(): void {
  answered = false;
  anim = null;
  timerStart = 0;
  secShown = null;
  app.S.parts.fSec.el.classList.remove('on');
  const p = app.p;
  let style: FaceStyle = 'teach';

  if (track.kind === 'level') {
    const plan = planTask(p, track.idx, LEVELS.map(l => l.mins), Math.random, recent);
    const options = plan.kind === 'read' ? readOptions(plan.h, plan.m)
      : plan.kind === 'say' ? sayOptions(plan.h, plan.m) : [];
    task = { type: 'clock', plan, options };
    if (plan.kind === 'set') {
      // Стрілки стартують далеко від відповіді — інакше нічого робити
      const start = (toDial(plan.h, plan.m) + 150 + rnd(300)) % 720;
      raw = dial = (Math.round(start / LEVELS[plan.level].snap) * LEVELS[plan.level].snap) % 720;
    } else {
      raw = dial = toDial(plan.h, plan.m);
    }
    setSky(12);
  } else if (track.id === 'faces') {
    // Справжні годинники: хвилини — за найвищим пройденим рівнем, але не точніше п'ятірок
    const lv = Math.min(p.unlocked, 3);
    let plan: Plan;
    let tries = 0;
    do {
      const kind = Math.random() < 0.7 ? 'read' : 'set';
      plan = { h: 1 + rnd(12), m: pick(LEVELS[lv].mins), kind, level: lv, reason: 'normal' };
    } while (tooSimilar(plan, recent) && ++tries < 20);
    const { h: h0, m: m0, kind } = plan;
    // Стиль циферблата не повторюється поспіль
    style = fresh(() => pick(['classic', 'roman', 'minimal'] as const), x => 'style:' + x, 1);
    task = { type: 'clock', plan, options: kind === 'read' ? readOptions(h0, m0) : [], style };
    if (kind === 'set') {
      const start = (toDial(h0, m0) + 150 + rnd(300)) % 720;
      raw = dial = (Math.round(start / LEVELS[lv].snap) * LEVELS[lv].snap) % 720;
    } else {
      raw = dial = toDial(h0, m0);
    }
    setSky(12);
  } else if (track.id === 'feel') {
    // Та сама справа чи той самий режим тричі поспіль — нудно; однакова ціль секунд — теж
    const t = fresh(() => feelTask(Math.random, p.adventures.feel.right >= 5),
      x => x.mode === 'estimate' ? 'sec:' + x.seconds : 'q:' + x.text + x.options.map(o => o.label).sort().join());
    task = { type: 'feel', t };
    raw = dial = 0;
    setSky(12);
  } else if (track.id === 'routine') {
    const act = fresh(() => pick(ROUTINE), a => 'act:' + a.id, 5);
    const kind = Math.random() < 0.6 ? 'what' : 'write';
    const others = shuffle([...ROUTINE]);
    task = { type: 'routine', t: routineTask(act, kind, others) };
    raw = dial = toDial(act.h24, act.m);
    setSky(act.h24);
  } else if (track.id === 'plan') {
    // 9–10 років: тривалість у 24-годинному форматі; стрілки показують початок (або кінець — для «коли почалося?»)
    const t = fresh(() => planningTask(Math.random), x => 'plan:' + x.text, 6);
    task = { type: 'plan', t };
    raw = dial = ((t.from % 720) + 720) % 720;
    setSky(Math.floor((t.from % 1440) / 60));
  } else {
    const durs = [15, 30, 45, 60, 90, 20, 10];
    const d = fresh(() => pick(durs), x => 'dur:' + x, 2);
    const h0 = 1 + rnd(12), m0 = pick(d % 15 === 0 ? [0, 15, 30, 45] : [0, 5, 10, 20, 30, 40, 45, 50]);
    const story = fresh(() => rnd(6), x => 'story:' + x, 3);
    task = { type: 'elapsed', t: elapsedTask(h0, m0, d, story) };
    raw = dial = toDial(h0, m0);
    setSky(12);
  }

  if (task && task.type === 'clock') {
    recent.push({ h: task.plan.h, m: task.plan.m, kind: task.plan.kind });
    if (recent.length > 10) recent.shift();
  }
  sync3D(style);
  setFaceStyle(app.S, style);
  const stopwatch = task?.type === 'feel' && task.t.mode === 'estimate';
  setStopwatch(app.S, stopwatch);
  app.S.parts.fSec.el.classList.toggle('on', stopwatch);
  renderTask();
  renderDial();
}

/** Звичайний циферблат — на 3D-вежі; інші стилі, секундомір і «Розпорядок дня» (там підказує небо) — у SVG. */
export function sync3D(style: FaceStyle = task?.type === 'clock' ? task.style ?? 'teach' : 'teach'): void {
  const in3D = !!task && ((task.type === 'clock' && style === 'teach') || task.type === 'elapsed' || task.type === 'plan' || task.type === 'home');
  show3D(app.mode === 'practice' && in3D ? 'practice' : null, () => renderDial());
}

function correctLabel(o: Option[]): string { return o.find(x => x.correct)!.label; }

function renderTask(): void {
  const t = task!;
  const fb = $('qFb'), opts = $('qOpts'), text = $('qText');
  fb.hidden = true;
  $('pNext').hidden = true;
  $('pDunno').hidden = false;
  const isSet = canSet(t);
  $('pCheck').hidden = !isSet;
  app.S.grab.style.display = isSet ? '' : 'none';
  $('sceneWrap').classList.toggle('can-drag', isSet);

  const reason = $('pReason');
  const r = t.type === 'clock' ? t.plan.reason : 'normal';
  reason.hidden = r !== 'review' && r !== 'mix' && !(t.type === 'clock' && t.style);
  reason.textContent = t.type === 'clock' && t.style ? '🕰️ ' + FACE_NAMES[t.style]
    : r === 'review' ? '🔁 Повторимо' : '🔄 Згадаймо';

  // Показник у кутку сцени
  const ro = $('readout');
  ro.hidden = !(isSet || t.type === 'routine');
  if (t.type === 'routine') {
    const pod = POD[partOfDay(t.t.act.h24)];
    $('digital').textContent = pod.ico;
    $('verbal').textContent = pod.word;
  }

  opts.innerHTML = '';
  let spoken = '';
  let options: Option[] = [];
  let wordy = false;

  if (t.type === 'home') {
    text.innerHTML = '';
    text.append(HOME_ASK, h('small', { class: 'hint', text: HOME_HINT }));
    spoken = HOME_ASK + ' ' + HOME_HINT;
  } else if (t.type === 'clock') {
    const { h: hh, m, kind } = t.plan;
    if (kind === 'set') {
      text.innerHTML = '';
      text.append('Постав стрілки на ', h('span', { class: 'target', text: digital(hh, m) }),
        h('small', { class: 'hint', text: 'Довгу стрілку тягни за край циферблата, коротку — ближче до центру.' }));
      spoken = 'Постав стрілки на ' + sayTime(hh, m) + '.';
    } else {
      text.textContent = kind === 'read' ? (t.style ? 'Котра година на цьому годиннику?' : 'Котра година на вежі?')
        : 'Як сказати цей час українською?';
      spoken = text.textContent;
      options = t.options;
      wordy = kind === 'say';
    }
  } else if (t.type === 'feel' && t.t.mode === 'estimate') {
    const n = t.t.seconds;
    text.innerHTML = '';
    text.append('Натисни «Старт», а потім «Стоп», коли, на твою думку, мине ',
      h('span', { class: 'target', text: n === 60 ? '1 хвилина' : n + ' секунд' }),
      h('small', { class: 'hint', text: 'Не дивись на годинник — рахуй про себе.' }));
    spoken = 'Натисни Старт, а потім Стоп, коли мине ' + (n === 60 ? 'одна хвилина' : n + ' секунд') + '. Рахуй про себе.';
    opts.className = 'opts timer';
    const b = h('button', { class: 'opt timer-btn', type: 'button', text: '▶ Старт' });
    b.addEventListener('click', () => toggleTimer(b));
    opts.appendChild(b);
    speakNow(spoken);
    return;
  } else if (t.type === 'feel' && t.t.mode !== 'estimate') {
    text.textContent = t.t.text;
    spoken = t.t.text;
    options = t.t.options;
    wordy = true;
  } else if (t.type === 'routine') {
    text.textContent = t.t.text;
    spoken = t.t.text;
    options = t.t.options;
    wordy = t.t.kind === 'what';
  } else if (t.type === 'elapsed') {
    text.textContent = t.t.story;
    spoken = t.t.story;
    options = t.t.options;
  } else if (t.type === 'plan') {
    text.textContent = t.t.text;
    spoken = t.t.text;
    options = t.t.options;
  }

  opts.className = 'opts' + (wordy ? ' wordy' : '');
  options = shuffle([...options]);
  options.forEach((o, i) => {
    const b = h('button', { class: 'opt', type: 'button', text: o.label, 'aria-keyshortcuts': String(i + 1) });
    b.addEventListener('click', () => choose(o, b, options));
    if (!wordy) { opts.appendChild(b); return; }
    // Хто ще не читає, може послухати кожен варіант, не обираючи його
    const ear = h('button', { class: 'opt-ear', type: 'button', 'aria-label': 'Послухати: ' + o.label, text: '🔊' });
    ear.addEventListener('click', () => {
      speakTap(o.label);
      b.classList.remove('heard');
      void b.offsetWidth;
      b.classList.add('heard');
    });
    opts.appendChild(h('div', { class: 'opt-row' }, b, ear));
  });

  // Питання про циферблат — Тік показує на нього рукою
  if (t.type === 'clock' || t.type === 'home') gesture('point', 1800);
  speakNow(spoken);
  if (wordy && app.p.settings.readOptions) options.forEach(o => speakAfter(o.label));
}

/* ---------- Пояснення, прив'язані до конкретної помилки ---------- */

function explain(trap: Trap | undefined): string {
  const t = task!;
  if (t.type === 'clock') {
    const { h: hh, m } = t.plan;
    const next = (hh % 12) + 1;
    switch (trap) {
      case 'hourNext':
        return m > 30
          ? `Коротка стрілка вже майже дійшла до ${next}, але година ще ${hh}-та: читаємо число, яке вона <b>вже пройшла</b>.`
          : 'Подивись на коротку стрілку — саме вона показує, котра година.';
      case 'swap': return 'Стрілки переплутані. <b>Коротка й товста</b> — години, <b>довга й тонка</b> — хвилини.';
      case 'decimal': return 'Пів години — це <b>30</b> хвилин, а не 50: коло ділиться на 60, а не на 100.';
      case 'literal': return `Число ${m / 5} для довгої стрілки означає не ${m / 5} хвилин, а <b>${m}</b>: рахуй п’ятірками.`;
      case 'quarterDir': return m === 45
        ? 'Коли чверть <b>лишилася</b>, кажуть «за чверть» і називають годину, яка тільки настане.'
        : 'Коли чверть уже <b>минула</b>, кажуть «чверть на» наступну годину.';
      case 'halfCur': return '«Пів на» — це половина шляху до <b>наступної</b> години.';
    }
    return '';
  }
  if (t.type === 'feel') return t.t.mode === 'estimate' ? '' : t.t.explain;
  if (t.type === 'routine' && trap === 'ampm') {
    const a = t.t.act;
    return t.t.kind === 'what'
      ? `Стрілки о ${digital(a.h24, a.m)} вранці й увечері стоять <b>однаково</b>! Дивись на небо: зараз ${POD[partOfDay(a.h24)].word}.`
      : 'Після 12 дня електронний годинник рахує далі: 13, 14, 15… До денного й вечірнього часу <b>додаємо 12</b>.';
  }
  if (t.type === 'plan') {
    if (trap === 'carry') return 'Набралося 60 хвилин — це <b>ще одна година</b>. А коли хвилин не вистачає, «позичаємо» годину: вона дає 60 хвилин.';
    if (trap === 'decimal') return 'У годині <b>60</b> хвилин, а не 100. Хвилин не може бути 60 і більше — це вже наступна година.';
    if (trap === 'ampm') return 'Через північ рахуй частинами: <b>до 24:00</b>, а потім ще від 0:00 до ранку.';
    return '';
  }
  if (t.type === 'elapsed') {
    if (trap === 'carry') return 'Довга стрілка пройшла через 12 — отже, <b>година вже стала наступною</b>.';
    if (trap === 'decimal') return 'Пів години — це 30 хвилин, а не 50.';
    if (trap === 'hourNext') return 'Минуло менше години — коротка стрілка ще не дійшла до наступного числа.';
  }
  return '';
}

function rightText(): string {
  const t = task!;
  if (t.type === 'clock') return digital(t.plan.h, t.plan.m) + ' — ' + sayTime(t.plan.h, t.plan.m);
  if (t.type === 'routine') return correctLabel(t.t.options);
  if (t.type === 'feel') return t.t.mode === 'estimate' ? t.t.seconds + ' секунд' : correctLabel(t.t.options);
  if (t.type === 'home') return '';
  if (t.type === 'plan') return t.t.answer;
  return digital(t.t.end.h, t.t.end.m) + ' — ' + sayTime(t.t.end.h, t.t.end.m);
}

/** Після помилки — коротке відео саме про цю плутанину, якщо воно вже є. */
function attachTrapVideo(trap: Trap | undefined): void {
  if (!trap) return;
  const b = videoButton(TRAP_VIDEOS[trap], '▶ Подивись, як це працює');
  if (b) $('qFb').append(b);
}

function feedback(ok: boolean, html: string, title?: string): void {
  const fb = $('qFb');
  fb.hidden = false;
  fb.className = 'fb' + (ok ? '' : ' bad');
  fb.innerHTML = '<b>' + (title || (ok ? '✅ Правильно!' : '🤔 Не зовсім')) + '</b>' + html;
}

/* ---------- Відповіді ---------- */

function choose(o: Option, btn: HTMLButtonElement, options: Option[]): void {
  if (answered) return;
  const ok = o.correct;
  [...$('qOpts').querySelectorAll('.opt, .opt-ear')].forEach(b => {
    (b as HTMLButtonElement).disabled = true;
    if (b.textContent === correctLabel(options)) b.classList.add('right');
    else if (b === btn) b.classList.add('wrong');
    else b.classList.add('faded');
  });
  const why = ok ? '' : explain(o.trap);
  feedback(ok, ' ' + (why ? why + ' ' : '') + (ok ? rightText() : 'Правильно: ' + rightText()));
  const exposed = options.map(x => x.trap).filter((x): x is Trap => !!x);
  finish(ok, exposed, ok ? undefined : o.trap, ok ? btn : null);
  // Кнопку додаємо після finish: інакше її підпис потрапив би в озвучку пояснення
  if (!ok) attachTrapVideo(o.trap);
}

function checkHands(): void {
  const t = task;
  if (!answered && t?.type === 'home') { checkHome(t); return; }
  if (answered || !t || t.type !== 'clock' || t.plan.kind !== 'set') return;
  const target = toDial(t.plan.h, t.plan.m);
  const got = Math.round(dial) % 720;
  const ok = got === target;
  const g = fromDial(got);
  const trap = ok ? undefined : diagnoseSet(t.plan.h, t.plan.m, g.h, g.m);
  if (ok) {
    feedback(true, ' Стрілки стоять правильно: ' + sayTime(t.plan.h, t.plan.m) + '.');
  } else {
    const why = explain(trap);
    feedback(false, ` Ти поставив(-ла) ${digital(g.h, g.m)}, а треба ${rightText()}. ${why}`);
    animateDial(target);
  }
  finish(ok, trapsFor('set', t.plan.m), trap, null);
  if (!ok) attachTrapVideo(trap);
}

function giveUp(): void {
  if (answered || !task) return;
  const t = task;
  if (t.type === 'home') { revealHome(' Нічого страшного!'); return; }
  if (t.type === 'clock' && t.plan.kind === 'set') animateDial(toDial(t.plan.h, t.plan.m));
  else if (t.type === 'feel' && t.t.mode === 'estimate') {
    timerStart = 0;
    $('qOpts').innerHTML = '';
  } else {
    const opts = t.type === 'clock' ? t.options : 'options' in t.t ? t.t.options : [];
    [...$('qOpts').querySelectorAll('.opt, .opt-ear')].forEach(b => {
      (b as HTMLButtonElement).disabled = true;
      b.classList.add(b.textContent === correctLabel(opts) ? 'right' : 'faded');
    });
  }
  feedback(false, ' ' + hintFor() + ' Правильно: ' + rightText(), '💡 Дивись, як це працює');
  finish(false, [], undefined, null, true);
}

/** Коротке пояснення на «Не знаю» — не покарання, а підказка. */
function hintFor(): string {
  const t = task!;
  if (t.type === 'clock') return track.kind === 'level' ? LEVELS[t.plan.level].tip : advOf('faces').tip;
  if (t.type === 'home') return HOME_HINT;
  return advOf(t.type).tip;
}

function finish(ok: boolean, exposed: Trap[], fell: Trap | undefined, srcEl: Element | null, dunno = false): void {
  if (answered) return;
  answered = true;
  const p = app.p;

  if (ok) {
    SFX.correct();
    FX.buzz(28);
    popover(anyOf(PRAISE));
    say(anyOf(PRAISE_SAY), 'cheer', 2400, false);
    if (srcEl) FX.fromElement(srcEl, 22); else FX.cheer(2);
  } else {
    SFX.wrong();
    FX.buzz([26, 60, 26]);
    if (!dunno) popover(anyOf(CHEER_UP), true);
    say(dunno ? 'Нічого страшного! Подивись пояснення — наступного разу вийде.' : anyOf(CHEER_SAY), dunno ? 'think' : 'oops', 2400, false);
  }
  speakFeedback();

  round.push(ok);
  p.totals.asked++;
  logAnswer(p, ok);
  const rec = task!.type === 'clock' && track.kind === 'level' ? p.levels[task!.plan.level] : trackRec();
  rec.asked++;
  if (ok) {
    rec.right++;
    p.totals.right++;
    p.totals.streak++;
    p.totals.bestStreak = Math.max(p.totals.bestStreak, p.totals.streak);
  } else {
    p.totals.streak = 0;
  }
  if (!dunno) recordTraps(p, exposed, fell);
  if (task!.type === 'clock' && scheduleReview(p, task!.plan, ok)) p.totals.fixed++;
  app.save();

  showNext(round.length >= ROUND ? 'Підсумок ➜' : 'Далі ➜');

  // «Скільки минуло?»: після відповіді прокручуємо стрілки до кінця — це і є пояснення
  if (task!.type === 'elapsed') animateDial(toDial(task!.t.end.h, task!.t.end.m), 1600);
  // «Плануємо день»: стрілки прокручуються від початку до кінця (або назад — для «коли почалося?»)
  if (task!.type === 'plan') { const p = task!.t; animateDial(((p.to % 720) + 720) % 720, 1800); }

  renderDots();
  renderScore();
  awardBadges();
}

/** Пояснення озвучуємо, а не лише показуємо — 6-річні ще погано читають.
    Заголовок («Не зовсім») — окремим реченням, інакше він зливається з поясненням. */
function speakFeedback(): void {
  const fb = $('qFb'), title = fb.querySelector('b')?.textContent || '';
  const body = (fb.textContent || '').slice(title.length).trim();
  speakNow(title.replace(/^[✅🤔💡👀]\s*/u, '').replace(/[^.!?]$/, '$&.') + ' ' + body);
}

/** Кнопки після відповіді: «Далі» замість «Перевірити» й «Не знаю». */
function showNext(label = 'Далі ➜'): void {
  $('pDunno').hidden = true;
  $('pCheck').hidden = true;
  const next = $('pNext');
  next.hidden = false;
  next.textContent = label;
  requestAnimationFrame(() => next.focus({ preventScroll: true }));
  app.S.grab.style.display = 'none';
  $('sceneWrap').classList.remove('can-drag');
}

/* ---------- «Годинник удома»: звіряємо зі справжнім часом ---------- */

const DAILY_ASK = 'Час для хвилинки часу! Глянь на годинник удома й натисни «Годинник удома».';
/** Крок стрілок у «Годиннику вдома» — за рівнем дитини (див. homeSnap). */
let homeStep = 5;
const HOME_ASK = 'Подивись на справжній годинник у себе вдома й постав стрілки на вежі так само.';
const HOME_HINT = 'Якщо вдома є лише електронний годинник — подивись на нього й переклади час на стрілки.';
const HOME_RETRY: Record<HomeHint, string> = {
  hour: 'Довга стрілка стоїть добре, а коротка — на сусідньому числі. Яке число коротка стрілка вже пройшла?',
  swap: 'Здається, стрілки помінялися місцями. Коротка показує години, а довга — хвилини.',
  minute: 'Подивись уважно, на яке число показує довга стрілка, і порахуй хвилини п’ятірками.'
};
/** На ранніх рівнях дитина ще не рахує хвилини — підказуємо простіше. */
const HOME_RETRY_EASY = 'Подивись уважно, куди показує коротка стрілка на годиннику вдома. Довга — нагорі чи внизу?';

const homeOk = (H: number, M: number): string =>
  ' Зараз ' + digital(H, M) + ' — ' + sayTime(H, M) + ' ' + partOfDay(H) + '. Ти вмієш читати справжній годинник!';
/** Після першої за день «хвилинки» — скільки днів поспіль. */
const dailyLine = (streak: number): string =>
  streak > 1 ? ' Хвилинка часу — днів поспіль: ' + streak + '!' : ' Хвилинку часу на сьогодні зроблено!';
const homeReveal = (H: number, M: number, lead: string): string =>
  lead + ' Мій годинник каже, що зараз ' + digital(H, M) + ' — ' + sayTime(H, M) + ' ' + partOfDay(H) +
  '. Порівняй зі стрілками вдома. Якщо вони інакші, може, ваш годинник спішить або відстає — спитай у дорослих.';

const canSet = (t: Task): boolean => t.type === 'home' || (t.type === 'clock' && t.plan.kind === 'set');

function startHome(): void {
  answered = false;
  anim = null;
  secShown = null;
  const now = new Date();
  task = { type: 'home', tries: 0 };
  homeStep = homeSnap(LEVELS[Math.min(app.p.unlocked, LEVELS.length - 1)].snap);
  // Стрілки стартують далеко від справжнього часу; небо — як надворі
  const start = (toDial(now.getHours(), now.getMinutes()) + 150 + rnd(300)) % 720;
  raw = dial = (Math.round(start / homeStep) * homeStep) % 720;
  setSky(now.getHours() + now.getMinutes() / 60);
  sync3D();
  setFaceStyle(app.S, 'teach');
  setStopwatch(app.S, false);
  app.S.parts.fSec.el.classList.remove('on');
  renderTracks();
  $('pChip').textContent = '🏠 Годинник удома';
  renderTask();
  renderDial();
  $('panel').scrollTo({ top: 0, behavior: 'smooth' });
}

function checkHome(t: { type: 'home'; tries: number }): void {
  const now = new Date(), H = now.getHours(), M = now.getMinutes();
  const v = judgeHome(H, M, Math.round(dial) % 720, homeTolerance(homeStep));
  if (v.ok) {
    answered = true;
    const first = markDaily(app.p);
    app.save();
    // Стрілки доходять до точного часу: на ранніх рівнях видно, що «майже восьма» — це трохи до 8
    animateDial(toDial(H, M));
    feedback(true, homeOk(H, M) + (first ? dailyLine(app.p.daily.streak) : ''), '✅ Так і є!');
    SFX.correct();
    FX.buzz(28);
    FX.cheer(3);
    popover('🏠 ' + anyOf(PRAISE));
    gesture('cheer', 1800);
    speakFeedback();
    showNext();
    renderTracks();
    $('pChip').textContent = '🏠 Годинник удома';
    awardBadges();
    return;
  }
  if (t.tries++ === 0) {
    SFX.wrong();
    const tip = homeStep >= 30 && v.hint === 'minute' ? HOME_RETRY_EASY : HOME_RETRY[v.hint ?? 'minute'];
    feedback(false, ' ' + tip, '👀 Глянь ще раз');
    gesture('think', 1600);
    speakFeedback();
    return;
  }
  revealHome('');
}

function revealHome(lead: string): void {
  const now = new Date(), H = now.getHours(), M = now.getMinutes();
  answered = true;
  animateDial(toDial(H, M));
  feedback(false, homeReveal(H, M, lead), '💡 Дивись, котра зараз');
  speakFeedback();
  showNext();
}

function nextTask(): void {
  if (task?.type === 'home') { renderTracks(); newTask(); return; }
  if (round.length >= ROUND) finishRound();
  else newTask();
}

function finishRound(): void {
  const p = app.p;
  const right = round.filter(Boolean).length;
  const stars = starsFor(right);
  const rec = trackRec();
  rec.stars = Math.max(rec.stars, stars);
  rec.best = Math.max(rec.best, right);

  let unlockedNow = '';
  if (track.kind === 'level' && right >= PASS && track.idx === p.unlocked && track.idx < LEVELS.length - 1) {
    p.unlocked = track.idx + 1;
    unlockedNow = unlockWhat(LEVELS[p.unlocked].name, ADVENTURES.find(a => a.needs === p.unlocked)?.name);
  }
  app.save();

  $('qOpts').innerHTML = '';
  $('pCheck').hidden = true;
  $('pDunno').hidden = true;
  $('pNext').hidden = false;
  $('pNext').textContent = 'Ще раунд ➜';
  $('readout').hidden = true;
  $('pReason').hidden = true;
  app.S.grab.style.display = 'none';

  $('qText').textContent = 'Раунд завершено: ' + right + ' із ' + ROUND;
  const pass = right >= PASS;
  feedback(pass,
    ' <span class="round-stars">' + '★'.repeat(stars) + '<i>' + '☆'.repeat(3 - stars) + '</i></span>' +
    (unlockedNow ? 'Відкрито «' + unlockedNow + '»!'
      : pass ? 'Чудова робота!'
        : 'Потрібно ' + PASS + ' правильних, щоб рухатись далі. Спробуй ще раз!'),
    pass ? '🎉 Раунд пройдено' : '💪 Раунд завершено');

  if (pass) {
    SFX.level();
    FX.cheer(6);
    FX.buzz([30, 50, 30, 50, 80]);
    popover(unlockedNow ? '🎉 Нове відкрито!' : '⭐'.repeat(Math.max(1, stars)));
    say(unlockedNow ? unlockLine(unlockedNow) : ROUND_PASS_SAY, 'cheer', 3200);
  } else {
    SFX.star();
    say(ROUND_FAIL_SAY, 'happy', 2600);
  }

  round = [];
  renderTracks();
  renderDots();
  renderScore();
  awardBadges();
  onRoundEnd();
}

/* ---------- Відображення ---------- */

function renderDots(): void {
  const dots = $('qDots');
  dots.innerHTML = '';
  for (let i = 0; i < ROUND; i++) {
    dots.appendChild(h('span', {
      class: 'qdot' + (i < round.length ? (round[i] ? ' right' : ' wrong') : i === round.length ? ' now' : '')
    }));
  }
}

const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);

function renderTracks(): void {
  const p = app.p;
  const lv = $('levels');
  lv.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const locked = i > p.unlocked;
    const active = track.kind === 'level' && track.idx === i;
    const b = h('button', { class: 'level-btn' + (active ? ' is-active' : ''), type: 'button',
      'aria-pressed': String(active), title: locked ? 'Пройди попередній рівень' : L.tip });
    b.append(h('span', { class: 'lv-ico', text: locked ? '🔒' : L.short }),
      h('span', { class: 'lv-name', text: L.name }),
      h('span', { class: 'stars', text: starStr(p.levels[i].stars), 'aria-label': p.levels[i].stars + ' зірки з 3' }));
    (b as HTMLButtonElement).disabled = locked;
    b.addEventListener('click', () => {
      track = { kind: 'level', idx: i };
      p.level = i;
      app.save();
      startTrack();
    });
    lv.appendChild(b);
  });

  const adv = $('adventures');
  adv.innerHTML = '';
  ADVENTURES.forEach(a => {
    const locked = !advUnlocked(a.id);
    const active = track.kind === 'adv' && track.id === a.id;
    const b = h('button', { class: 'level-btn adv' + (active ? ' is-active' : ''), type: 'button',
      'aria-pressed': String(active),
      title: locked ? 'Відкриється після рівня «' + LEVELS[a.needs - 1].name + '»' : a.tip });
    b.append(h('span', { class: 'lv-ico', text: locked ? '🔒' : a.ico }),
      h('span', { class: 'lv-name', text: a.name }),
      h('span', { class: 'stars', text: starStr(p.adventures[a.id].stars) }));
    (b as HTMLButtonElement).disabled = locked;
    b.addEventListener('click', () => { track = { kind: 'adv', id: a.id }; startTrack(); });
    adv.appendChild(b);
  });
  // «Хвилинка часу» — раз на день звірити стрілки з годинником удома; доступна з першого рівня
  const home = task?.type === 'home', done = dailyDone(p);
  const hb = h('button', { class: 'level-btn adv home-btn' + (home ? ' is-active' : '') + (done ? '' : ' due'), type: 'button',
    'aria-pressed': String(home), title: 'Постав стрілки так, як на годиннику у тебе вдома' });
  hb.append(h('span', { class: 'lv-ico', text: '🏠' }), h('span', { class: 'lv-name', text: 'Годинник удома' }),
    h('span', { class: 'stars home-note', text: done ? '✓ сьогодні' + (p.daily.streak > 1 ? ' · 🔥' + p.daily.streak : '')
      : p.daily.streak ? '🔥 ' + p.daily.streak + ' — не перерви!' : 'хвилинка часу' }));
  hb.addEventListener('click', startHome);
  adv.appendChild(hb);

  $('pChip').textContent = track.kind === 'level'
    ? 'Рівень ' + (track.idx + 1) + ' · ' + LEVELS[track.idx].name
    : advOf(track.id).ico + ' ' + advOf(track.id).name;
}

export function renderScore(): void {
  const stars = totalStars(app.p);
  const pill = $('starPill');
  const b = pill.querySelector('b')!;
  if (b.textContent !== String(stars)) { b.textContent = String(stars); bump(pill); }
  pill.title = 'Зірок: ' + stars + ' з ' + MAX_STARS;

  const pp = $('parkProgress');
  const next = nextAttraction(stars);
  pp.innerHTML = '';
  if (next) {
    const prevNeed = PARK.filter(a => a.stars < next.stars).pop()?.stars ?? 0;
    const pct = Math.max(4, Math.round((stars - prevNeed) / (next.stars - prevNeed) * 100));
    pp.append(
      h('span', { class: 'pp-ico', text: next.ico, 'aria-hidden': 'true' }),
      h('div', { class: 'pp-body' },
        h('div', { class: 'pp-title', text: 'Наступний атракціон: ' + next.name }),
        h('div', { class: 'pp-bar' }, h('span', { style: 'width:' + pct + '%' })),
        h('div', { class: 'pp-note', text: 'Ще ' + (next.stars - stars) + ' ⭐ — і він з’явиться на планеті!' })));
  } else {
    pp.append(h('span', { class: 'pp-ico', text: '🏆' }),
      h('div', { class: 'pp-body' }, h('div', { class: 'pp-title', text: 'Увесь парк на планеті збудовано! Ти — справжній годинникар.' })));
  }
}

function renderBadges(justEarned: string[] = []): void {
  const row = $('badgesRow');
  row.innerHTML = '';
  BADGES.forEach(b => {
    const got = app.p.badges.includes(b.id);
    const d = h('div', { class: 'badge-item' + (got ? ' earned' : '') + (justEarned.includes(b.id) ? ' just' : ''),
      title: b.nm + ' — ' + (got ? 'здобуто!' : b.hint) });
    d.append(h('span', { class: 'ico', text: b.ico }), h('span', { class: 'nm', text: b.nm }));
    if (!got) d.append(h('span', { class: 'bh', text: b.hint }));
    row.appendChild(d);
  });
}

export function awardBadges(): void {
  const p = app.p;
  const fresh = BADGES.filter(b => !p.badges.includes(b.id) && b.test(p)).map(b => b.id);
  if (!fresh.length) return;
  p.badges.push(...fresh);
  app.save();
  renderBadges(fresh);
  const b = BADGES.find(x => x.id === fresh[0])!;
  setTimeout(() => {
    SFX.badge();
    FX.cheer(4);
    FX.buzz([30, 40, 30, 40, 60]);
    popover(b.ico + ' ' + b.nm);
    say(badgeLine(b.nm), 'cheer', 3000);
  }, 900);
}

/* ---------- Циферблат ---------- */

function animateDial(to: number, ms = 700): void {
  // Крутимо вперед найкоротшим шляхом, але для «Скільки минуло?» — лише вперед
  let target = to;
  while (target < dial) target += 720;
  const forward = task?.type === 'elapsed' || (task?.type === 'plan' && task.t.to > task.t.from);
  if (task?.type === 'plan' && !forward) { while (target > dial) target -= 720; }   // «коли почалося?» — крутимо назад
  else if (!forward && target - dial > 360) target -= 720;
  anim = { from: dial, to: target, t0: performance.now(), ms };
}

let secFrac = 0;

/* ---------- «Скільки триває хвилина?» ---------- */

function toggleTimer(btn: HTMLButtonElement): void {
  const t = task;
  if (answered || !t || t.type !== 'feel' || t.t.mode !== 'estimate') return;
  if (!timerStart) {
    timerStart = performance.now();
    btn.textContent = '■ Стоп';
    btn.classList.add('running');
    $('pDunno').hidden = true;
    SFX.tick();
    say('Рахуй про себе… Я мовчу 🤫', 'think', 60000, false);
    return;
  }
  const secs = (performance.now() - timerStart) / 1000;
  const target = t.t.seconds;
  const ok = judgeEstimate(target, secs);
  btn.disabled = true;
  btn.classList.remove('running');
  btn.textContent = secs.toFixed(1).replace('.', ',') + ' с';
  // Секундна стрілка «прокручує» відрахований час — видно, скільки це насправді
  setStopwatch(app.S, true, target);
  secShown = { to: secs, t0: performance.now() };
  $('readout').hidden = false;
  $('digital').textContent = secs.toFixed(1).replace('.', ',') + ' с';
  $('verbal').textContent = 'треба було ' + target + ' с';
  const diff = secs - target;
  const how = ok ? (Math.abs(diff) < 1 ? 'Майже секунда в секунду!' : 'Дуже близько!')
    : diff < 0 ? 'Трохи поспішив(-ла): час минає повільніше, ніж здається.'
      : 'Трохи задовго: спробуй рахувати рівніше.';
  feedback(ok, ` Минуло ${secs.toFixed(1).replace('.', ',')} с, а треба було ${target} с. ${how}` +
    (ok ? '' : ' ' + advOf('feel').tip));
  finish(ok, [], undefined, ok ? btn : null);
}

export function practiceFrame(now: number): void {
  if (secShown) {
    const k = Math.min(1, (now - secShown.t0) / 1400);
    secFrac = (secShown.to / 60) * (1 - Math.pow(1 - k, 3));
  } else {
    secFrac = 0;
  }
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.ms);
    const e = 1 - Math.pow(1 - k, 3);
    const before = Math.floor(dial);
    dial = anim.from + (anim.to - anim.from) * e;
    if (task?.type === 'elapsed' && Math.floor(dial / 5) !== Math.floor(before / 5)) SFX.notch();
    if (k >= 1) { dial = ((anim.to % 720) + 720) % 720; raw = dial; anim = null; }
  }
  renderDial();
}

function renderDial(): void {
  renderHands(dial, secFrac);
  tower3d()?.setTime(dial, secFrac);
  const t = task;
  if (t && canSet(t)) {
    const g = fromDial(dial);
    $('digital').textContent = digital(g.h, g.m);
    $('verbal').textContent = answered ? (t.type === 'home' ? 'зараз' : 'правильне положення') : 'ти ставиш';
  }
}

function toSvg(evt: PointerEvent): DOMPoint {
  const svg = app.S.svg;
  const m = svg.getScreenCTM();
  const pt = new DOMPoint(evt.clientX, evt.clientY);
  return m ? pt.matrixTransform(m.inverse()) : pt;
}

/** Дотик відносно центру циферблата в одиницях SVG-сцени (y — донизу), байдуже, яка сцена на екрані. */
function dialOffset(e: PointerEvent): { dx: number; dy: number } | null {
  const t3 = tower3d();
  if (t3 && document.body.classList.contains('show-3d')) {
    const p = t3.dialPoint(e.clientX, e.clientY);
    return p && { dx: p.x * R, dy: -p.y * R };
  }
  const p = toSvg(e);
  return { dx: p.x - CX, dy: p.y - CY };
}

function initDrag(): void {
  const grab = app.S.grab;
  const canvas3d = $('scene3d');
  let mode: 'min' | 'hour' | null = null, lastAng = 0;

  const down = (e: PointerEvent, el: Element) => {
    const t = task;
    if (app.mode !== 'practice' || !t || !canSet(t) || answered) return;
    const o = dialOffset(e);
    if (!o) return;
    const { dx, dy } = o, r = Math.hypot(dx, dy);
    if (r > R + 10) return;
    const a = angleOf(dx, dy);
    // Довга стрілка проходить і крізь зону короткої — біля центру беремо ту, до якої влучили кутом
    const hourA = (dial % 720) / 720 * 360, minA = (dial % 60) * 6;
    mode = r > 60 ? 'min' : (angleDist(a, hourA) <= angleDist(a, minA) ? 'hour' : 'min');
    lastAng = a;
    try { el.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    grab.classList.add('dragging');
    app.S.parts[mode === 'min' ? 'fMin' : 'fHour'].el.classList.add('held');
    e.preventDefault();
  };
  grab.addEventListener('pointerdown', e => down(e, grab));
  canvas3d.addEventListener('pointerdown', e => down(e, canvas3d));

  const move = (e: PointerEvent) => {
    if (!mode) return;
    const o = dialOffset(e);
    if (!o) return;
    const a = angleOf(o.dx, o.dy);
    if (mode === 'min') {
      // Накопичуємо різницю кута: обертання довгої переносить години, як у справжнього годинника
      let d = a - lastAng;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      raw = (raw + d / 6 + 720) % 720;
      lastAng = a;
    } else {
      const m = raw % 60;
      const hh = Math.round((a - m * 0.5) / 30);
      raw = (((hh % 12) + 12) % 12) * 60 + m;
    }
    // Під час руху — крок у хвилину, інакше на рівні «Цілі години» стрілка б застрягла
    const before = dial;
    dial = Math.round(raw) % 720;
    if (dial !== before) { SFX.notch(); FX.buzz(6); }
    renderDial();
  };
  grab.addEventListener('pointermove', move);
  canvas3d.addEventListener('pointermove', move);

  /* Слухаємо на вікні: палець може відірватися поза циферблатом */
  const end = () => {
    if (!mode) return;
    app.S.parts[mode === 'min' ? 'fMin' : 'fHour'].el.classList.remove('held');
    mode = null;
    grab.classList.remove('dragging');
    const snap = task?.type === 'clock' ? LEVELS[task.plan.level].snap : task?.type === 'home' ? homeStep : snapOf();
    raw = dial = (Math.round(dial / snap) * snap) % 720;
    renderDial();
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);

  /* Клавіатура: стрілки ←/→ крутять довгу стрілку, ↑/↓ — коротку */
  window.addEventListener('keydown', e => {
    if (app.mode !== 'practice' || document.querySelector('.overlay:not([hidden])')) return;
    const t = task;
    if (!t || answered || (e.target as Element).matches('input, textarea')) return;
    if (!canSet(t)) {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) ($('qOpts').querySelectorAll('.opt')[n - 1] as HTMLButtonElement | undefined)?.click();
      return;
    }
    const step = t.type === 'clock' ? LEVELS[t.plan.level].snap : homeStep;
    const moves: Record<string, number> = { ArrowRight: step, ArrowLeft: -step, ArrowUp: 60, ArrowDown: -60 };
    if (e.key in moves) {
      raw = dial = ((dial + moves[e.key]) % 720 + 720) % 720;
      SFX.notch();
      renderDial();
      e.preventDefault();
    } else if (e.key === 'Enter' && !(e.target as Element).matches('button')) {
      checkHands();
    }
  });
}

export function resetPracticeTrack(): void {
  track = { kind: 'level', idx: 0 };
}

/* ---------- Збирач фраз для озвучки (лише в режимі розробки) ----------
   scripts/harvest-speech.mjs викликає __harvestSpeech(n): гра сама відповідає на n випадкових
   завдань у всіх рівнях і пригодах, а все, що Тік мав сказати, падає в window.__spoken. */

if (import.meta.env.DEV) {
  (window as unknown as { __harvestSpeech: (n: number) => void }).__harvestSpeech = (n: number) => {
    const tracks: Track[] = [
      ...LEVELS.map((_, idx) => ({ kind: 'level' as const, idx })),
      ...ADVENTURES.map(a => ({ kind: 'adv' as const, id: a.id }))
    ];
    for (let i = 0; i < n; i++) {
      track = pick(tracks);
      round = [];
      newTask();
      const t = task!;
      const r = Math.random();
      if (r < 0.2 && !(t.type === 'feel' && t.t.mode === 'estimate')) {
        giveUp();
      } else if (t.type === 'clock' && t.plan.kind === 'set') {
        const snap = t.plan.level != null ? LEVELS[t.plan.level].snap : 5;
        dial = raw = r < 0.5 ? toDial(t.plan.h, t.plan.m) : Math.round(rnd(720) / snap) * snap % 720;
        checkHands();
      } else if (t.type === 'feel' && t.t.mode === 'estimate') {
        const btn = $('qOpts').querySelector('button') as HTMLButtonElement;
        toggleTimer(btn);
        timerStart = performance.now() - t.t.seconds * (0.4 + Math.random() * 1.2) * 1000;
        toggleTimer(btn);
      } else {
        const opts = [...$('qOpts').querySelectorAll('.opt')] as HTMLButtonElement[];
        pick(opts).click();
      }
      if (Math.random() < 0.1) {
        round = Array.from({ length: ROUND }, () => Math.random() < 0.7);
        finishRound();
      }
    }
    // Усі 720 положень стрілок — у тих самих зворотах, що й у завданнях, щоб жоден час не лишився без голосу
    for (let hh = 1; hh <= 12; hh++) {
      for (let mm = 0; mm < 60; mm++) {
        speakNow('Постав стрілки на ' + sayTime(hh, mm) + '.');
        speakNow('Правильно: ' + digital(hh, mm) + ' — ' + sayTime(hh, mm));
        speakNow('Ти поставив(-ла) ' + digital(hh, mm) + ', а треба ' + digital(hh, mm) + ' — ' + sayTime(hh, mm) + '.');
        speakNow('Стрілки стоять правильно: ' + sayTime(hh, mm) + '.');
      }
    }
    // «Годинник удома»: питання, підказки й відповіді в усі частини доби
    startHome();
    [...Object.values(HOME_RETRY), HOME_RETRY_EASY].forEach(x => { feedback(false, ' ' + x, '👀 Глянь ще раз'); speakFeedback(); });
    speakNow(DAILY_ASK);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 30]) speakNow(dailyLine(n).trim());
    for (const hh of [0, 3, 7, 11, 12, 15, 19, 22]) {
      for (const mm of [0, 15, 30, 42]) {
        feedback(true, homeOk(hh, mm), '✅ Так і є!');
        speakFeedback();
        for (const lead of ['', ' Нічого страшного!']) {
          feedback(false, homeReveal(hh, mm, lead), '💡 Дивись, котра зараз');
          speakFeedback();
        }
      }
    }
    // Уроки: Тік зачитує всі картки етапів
    LESSON_LINES().forEach(s => speakNow(s));
    // Репліки поза завданнями
    STAGE_SAY.forEach(s => speakNow(s));
    [ROUND_PASS_SAY, ROUND_FAIL_SAY, VOICE_ON_SAY, RESET_SAY].forEach(s => speakNow(s));
    BADGES.forEach(b => speakNow(badgeLine(b.nm)));
    PARK.forEach(a => speakNow(parkLine(a.name)));
    LEVELS.forEach((l, i) => {
      speakNow(unlockLine(unlockWhat(l.name, ADVENTURES.find(a => a.needs === i)?.name)));
    });
  };
}
