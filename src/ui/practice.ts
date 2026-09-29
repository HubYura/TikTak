/* Режим «Гра»: рівні, пригоди, адаптивний добір і перетягування стрілок. */

import { planTask, recordTraps, scheduleReview, tooSimilar, type Plan, type Recent } from '../core/adaptive';
import {
  ADVENTURES, BADGES, CHEER_SAY, CHEER_UP, LEVELS, MAX_STARS, PASS, PRAISE, PRAISE_SAY, ROUND,
  PARK, RESET_SAY, ROUND_FAIL_SAY, ROUND_PASS_SAY, STAGE_SAY, VOICE_ON_SAY, badgeLine, nextAttraction, parkLine, starsFor, totalStars,
  unlockLine, unlockWhat, type AdventureId
} from '../core/content';
import { partOfDay, sayTime } from '../core/phrasing';
import { logAnswer, type LevelRec } from '../core/progress';
import {
  ROUTINE, diagnoseSet, elapsedTask, readOptions, routineTask, sayOptions, trapsFor,
  type ElapsedTask, type Option, type RoutineTask, type Trap
} from '../core/questions';
import { feelTask, judgeEstimate, type FeelTask } from '../core/feel';
import { pick, rnd, shuffle } from '../core/rng';
import { TRAP_VIDEOS } from '../core/videos';
import { angleDist, angleOf, digital, fromDial, toDial } from '../core/time';
import { SFX } from '../lib/audio';
import { FX } from '../lib/fx';
import { CX, CY, FACE_NAMES, R, setFaceStyle, setStopwatch, type FaceStyle } from '../scene/scene';
import { bump, gesture, popover, say, speakNow } from './buddy';
import { $, anyOf, app, h } from './state';
import { videoButton } from './video';
import { renderHands, setSky, showSun } from './view';

type Track = { kind: 'level'; idx: number } | { kind: 'adv'; id: AdventureId };

type Task =
  | { type: 'clock'; plan: Plan; options: Option[]; style?: FaceStyle }
  | { type: 'routine'; t: RoutineTask }
  | { type: 'elapsed'; t: ElapsedTask }
  | { type: 'feel'; t: FeelTask };

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
  say('Час гри! Обери відповідь або покрути стрілки.', 'happy', 2200, false);
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
  setFaceStyle(app.S, style);
  const stopwatch = task?.type === 'feel' && task.t.mode === 'estimate';
  setStopwatch(app.S, stopwatch);
  app.S.parts.fSec.el.classList.toggle('on', stopwatch);
  renderTask();
  renderDial();
}

function correctLabel(o: Option[]): string { return o.find(x => x.correct)!.label; }

function renderTask(): void {
  const t = task!;
  const fb = $('qFb'), opts = $('qOpts'), text = $('qText');
  fb.hidden = true;
  $('pNext').hidden = true;
  $('pDunno').hidden = false;
  const isSet = t.type === 'clock' && t.plan.kind === 'set';
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

  if (t.type === 'clock') {
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
  }

  opts.className = 'opts' + (wordy ? ' wordy' : '');
  options = shuffle([...options]);
  options.forEach((o, i) => {
    const b = h('button', { class: 'opt', type: 'button', text: o.label, 'aria-keyshortcuts': String(i + 1) });
    b.addEventListener('click', () => choose(o, b, options));
    opts.appendChild(b);
  });

  // Питання про циферблат — Тік показує на нього рукою
  if (t.type === 'clock') gesture('point', 1800);
  speakNow(spoken);
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
  [...$('qOpts').children].forEach(b => {
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
  if (t.type === 'clock' && t.plan.kind === 'set') animateDial(toDial(t.plan.h, t.plan.m));
  else if (t.type === 'feel' && t.t.mode === 'estimate') {
    timerStart = 0;
    $('qOpts').innerHTML = '';
  } else {
    const opts = t.type === 'clock' ? t.options : 'options' in t.t ? t.t.options : [];
    [...$('qOpts').children].forEach(b => {
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
  // Пояснення озвучуємо, а не лише показуємо — 6-річні ще погано читають
  // Заголовок («Не зовсім») — окремим реченням, інакше він зливається з поясненням
  const fb = $('qFb'), title = fb.querySelector('b')?.textContent || '';
  const body = (fb.textContent || '').slice(title.length).trim();
  speakNow(title.replace(/^[✅🤔💡]\s*/u, '').replace(/[^.!?]$/, '$&.') + ' ' + body);

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

  $('pDunno').hidden = true;
  $('pCheck').hidden = true;
  const next = $('pNext');
  next.hidden = false;
  next.textContent = round.length >= ROUND ? 'Підсумок ➜' : 'Далі ➜';
  requestAnimationFrame(() => next.focus({ preventScroll: true }));
  app.S.grab.style.display = 'none';
  $('sceneWrap').classList.remove('can-drag');

  // «Скільки минуло?»: після відповіді прокручуємо стрілки до кінця — це і є пояснення
  if (task!.type === 'elapsed') animateDial(toDial(task!.t.end.h, task!.t.end.m), 1600);

  renderDots();
  renderScore();
  awardBadges();
}

function nextTask(): void {
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
        h('div', { class: 'pp-note', text: 'Ще ' + (next.stars - stars) + ' ⭐ — і він з’явиться в парку!' })));
  } else {
    pp.append(h('span', { class: 'pp-ico', text: '🏆' }),
      h('div', { class: 'pp-body' }, h('div', { class: 'pp-title', text: 'Увесь парк збудовано! Ти — справжній годинникар.' })));
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
  if (task?.type !== 'elapsed' && target - dial > 360) target -= 720;
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
  const t = task;
  if (t && t.type === 'clock' && t.plan.kind === 'set') {
    const g = fromDial(dial);
    $('digital').textContent = digital(g.h, g.m);
    $('verbal').textContent = answered ? 'правильне положення' : 'ти ставиш';
  }
}

function toSvg(evt: PointerEvent): DOMPoint {
  const svg = app.S.svg;
  const m = svg.getScreenCTM();
  const pt = new DOMPoint(evt.clientX, evt.clientY);
  return m ? pt.matrixTransform(m.inverse()) : pt;
}

function initDrag(): void {
  const grab = app.S.grab;
  let mode: 'min' | 'hour' | null = null, lastAng = 0;

  grab.addEventListener('pointerdown', e => {
    const t = task;
    if (app.mode !== 'practice' || !t || t.type !== 'clock' || t.plan.kind !== 'set' || answered) return;
    const p = toSvg(e), dx = p.x - CX, dy = p.y - CY, r = Math.hypot(dx, dy);
    if (r > R + 10) return;
    const a = angleOf(dx, dy);
    // Довга стрілка проходить і крізь зону короткої — біля центру беремо ту, до якої влучили кутом
    const hourA = (dial % 720) / 720 * 360, minA = (dial % 60) * 6;
    mode = r > 60 ? 'min' : (angleDist(a, hourA) <= angleDist(a, minA) ? 'hour' : 'min');
    lastAng = a;
    try { grab.setPointerCapture(e.pointerId); } catch { /* не критично */ }
    grab.classList.add('dragging');
    app.S.parts[mode === 'min' ? 'fMin' : 'fHour'].el.classList.add('held');
    e.preventDefault();
  });

  grab.addEventListener('pointermove', e => {
    if (!mode) return;
    const p = toSvg(e), a = angleOf(p.x - CX, p.y - CY);
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
  });

  /* Слухаємо на вікні: палець може відірватися поза циферблатом */
  const end = () => {
    if (!mode) return;
    app.S.parts[mode === 'min' ? 'fMin' : 'fHour'].el.classList.remove('held');
    mode = null;
    grab.classList.remove('dragging');
    const snap = task?.type === 'clock' ? LEVELS[task.plan.level].snap : snapOf();
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
    if (t.type !== 'clock' || t.plan.kind !== 'set') {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) ($('qOpts').children[n - 1] as HTMLButtonElement | undefined)?.click();
      return;
    }
    const step = LEVELS[t.plan.level].snap;
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
        const opts = [...$('qOpts').querySelectorAll('button')] as HTMLButtonElement[];
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
