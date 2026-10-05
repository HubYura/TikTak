/* Батьківський замок і звіт. Усе рахується з даних на пристрої. */

import { isWeak, weakness } from '../core/adaptive';
import { homePlan } from '../core/homeplan';
import { ADVENTURES, BADGES, LEVELS, MAX_STARS, STAGES, totalStars } from '../core/content';
import { blankProgress, dayKey } from '../core/progress';
import type { Trap } from '../core/questions';
import { SFX } from '../lib/audio';
import { Voice } from '../lib/voice';
import { PARENTS } from '../core/videos';
import { videoButton } from './video';
import { $, app, h } from './state';

export const TRAP_INFO: Record<Trap, { title: string; good: string; looks: string; tip: string }> = {
  hourNext: {
    title: 'Годину читає за наступним числом',
    good: 'читає годину за пройденим числом',
    looks: 'О 3:45 каже «4:45»: коротка стрілка вже біля 4, і дитина читає її.',
    tip: 'Покажіть на справжньому годиннику 3:10, 3:30, 3:50. Спитайте: «Яке число коротка стрілка вже пройшла?»'
  },
  swap: {
    title: 'Плутає стрілки',
    good: 'розрізняє стрілки',
    looks: 'Замість 2:50 читає «10:10» — коротку як хвилини, довгу як години.',
    tip: 'Гра «коротка — повільна»: дитина веде пальцем коротку стрілку, а ви довгу. Хто швидше?'
  },
  decimal: {
    title: 'Рахує час як десятковий',
    good: 'знає, що пів години — це 30 хвилин',
    looks: '«Пів» сприймає як 50 хвилин, бо звикла до сотень.',
    tip: 'Розріжте паперове коло на дві половинки: кожна — 30 хвилин. Поясніть, що година — це 60, не 100.'
  },
  literal: {
    title: 'Читає число буквально',
    good: 'рахує хвилини п’ятірками',
    looks: 'Довга стрілка на 3 — каже «3 хвилини» замість 15.',
    tip: 'Порахуйте разом п’ятірками вздовж циферблата: 5, 10, 15… Підпишіть олівцем хвилини на паперовому годиннику.'
  },
  quarterDir: {
    title: 'Плутає «чверть на» і «за чверть»',
    good: 'розрізняє «чверть на» і «за чверть»',
    looks: '3:45 називає «чверть на четверту».',
    tip: 'Простежте рух: чверть уже минула — «чверть на», чверть ще лишилась — «за чверть».'
  },
  halfCur: {
    title: '«Пів на» поточну годину',
    good: 'правильно каже «пів на»',
    looks: '3:30 називає «пів на третю» замість «пів на четверту».',
    tip: 'Українське «пів на четверту» — це половина дороги до четвертої. Вживайте цей вираз у побуті.'
  },
  ampm: {
    title: 'Ранок і вечір, 24-годинний запис',
    good: 'розрізняє ранок і вечір',
    looks: 'Не розрізняє 7:00 і 19:00, губиться в записі «13:00».',
    tip: 'Називайте частину доби вголос: «зараз 7 вечора — це 19:00». Покажіть годинник на плиті чи телефоні.'
  },
  carry: {
    title: 'Забуває перенести годину',
    good: 'переносить годину, коли додає час',
    looks: '3:45 + 30 хв рахує як 3:15 — довга стрілка пройшла 12, а година не змінилась.',
    tip: 'Крутіть стрілки на справжньому годиннику: щойно довга проходить 12, коротка переходить на наступне число.'
  }
};

let answer = 0;

export function initParent(onReset: () => void): void {
  $('btnParents').addEventListener('click', openGate);
  $('btnParents2').addEventListener('click', openGate);
  $('gCancel').addEventListener('click', () => { $('gate').hidden = true; });
  $('gateForm').addEventListener('submit', e => {
    e.preventDefault();
    const inp = $<HTMLInputElement>('gA');
    if (Number(inp.value) === answer) {
      $('gate').hidden = true;
      openReport(onReset);
    } else {
      $('gErr').hidden = false;
      inp.value = '';
      inp.focus();
      newQuestion();
    }
  });
  $('rClose').addEventListener('click', () => { $('report').hidden = true; });
  $('rPrint').addEventListener('click', () => window.print());
}

function newQuestion(): void {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  answer = a * b;
  $('gQ').textContent = a + ' × ' + b + ' =';
}

function openGate(): void {
  newQuestion();
  $('gErr').hidden = true;
  const inp = $<HTMLInputElement>('gA');
  inp.value = '';
  $('gate').hidden = false;
  setTimeout(() => inp.focus(), 50);
}

const pct = (a: number, b: number) => (b ? Math.round(a / b * 100) : 0);

function tile(value: string, label: string): HTMLElement {
  return h('div', { class: 'r-tile' }, h('b', { text: value }), h('span', { text: label }));
}

function bar(label: string, right: number, asked: number, extra: string): HTMLElement {
  const p = pct(right, asked);
  const tone = !asked ? 'none' : p >= 85 ? 'good' : p >= 60 ? 'ok' : 'low';
  return h('div', { class: 'r-row' },
    h('span', { class: 'r-label', text: label }),
    h('span', { class: 'r-bar ' + tone }, h('i', { style: 'width:' + (asked ? Math.max(3, p) : 0) + '%' })),
    h('span', { class: 'r-val', text: asked ? p + '% · ' + asked + ' відп.' : 'ще не грали' }),
    h('span', { class: 'r-extra', text: extra }));
}

/** Стовпчики за останні 14 днів: висота — кількість відповідей, зелена частина — правильні. */
function activityChart(): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const days: { key: string; label: string; asked: number; right: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const r = app.p.days[k] || { asked: 0, right: 0 };
    days.push({ key: k, label: String(d.getDate()), asked: r.asked, right: r.right });
  }
  const max = Math.max(10, ...days.map(d => d.asked));
  const W = 560, H = 150, bw = 28, gap = (W - bw * 14) / 13;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H + 22}`);
  svg.setAttribute('class', 'r-chart');
  svg.setAttribute('role', 'img');
  const total = days.reduce((s, d) => s + d.asked, 0);
  svg.setAttribute('aria-label', 'Відповіді за 14 днів: разом ' + total);
  const mk = (tag: string, a: Record<string, string | number>) => {
    const n = document.createElementNS(NS, tag);
    for (const k in a) n.setAttribute(k, String(a[k]));
    svg.appendChild(n);
    return n;
  };
  mk('line', { x1: 0, y1: H, x2: W, y2: H, class: 'r-axis' });
  days.forEach((d, i) => {
    const x = i * (bw + gap);
    const hAll = d.asked / max * (H - 8), hRight = d.right / max * (H - 8);
    if (d.asked) {
      const t = mk('rect', { x, y: H - hAll, width: bw, height: hAll, rx: 5, class: 'r-wrong' });
      const title = document.createElementNS(NS, 'title');
      title.textContent = d.key + ': ' + d.right + ' з ' + d.asked + ' правильно';
      t.appendChild(title);
      mk('rect', { x, y: H - hRight, width: bw, height: hRight, rx: 5, class: 'r-right' });
    }
    const lbl = mk('text', { x: x + bw / 2, y: H + 16, 'text-anchor': 'middle', class: 'r-day' });
    lbl.textContent = d.label;
  });
  return svg;
}

export function openReport(onReset: () => void): void {
  const p = app.p;
  const body = $('reportBody');
  body.innerHTML = '';

  const allDays = Object.values(p.days);
  const minutes = Math.round(allDays.reduce((s, d) => s + d.ms, 0) / 60000);
  const active30 = Object.entries(p.days).filter(([k, d]) => {
    const age = (Date.now() - new Date(k).getTime()) / 86400000;
    return age <= 30 && d.asked > 0;
  }).length;

  const pv = videoButton(PARENTS, '▶ Відео: ' + PARENTS.title);
  if (pv) body.append(h('div', { class: 'r-video' }, pv));
  body.append(
    h('p', { class: 'r-note', text: '🔒 Усі дані зберігаються лише на цьому пристрої й нікуди не надсилаються.' }),
    h('div', { class: 'r-tiles' },
      tile(String(p.totals.asked), 'відповідей'),
      tile(p.totals.asked ? pct(p.totals.right, p.totals.asked) + '%' : '—', p.totals.right + ' правильних'),
      tile(String(active30), 'днів із грою за місяць'),
      tile(minutes ? minutes + ' хв' : p.totals.asked ? '<1 хв' : '0 хв', 'у грі загалом'),
      tile(totalStars(p) + ' / ' + MAX_STARS, 'зірок'),
      tile(String(p.totals.bestStreak), 'найкраща серія'),
      tile(String(p.daily.best), 'днів поспіль «хвилинки часу» (рекорд)')),

    h('h3', { text: 'Активність за 2 тижні' }),
    activityChart(),
    h('p', { class: 'r-legend' }, h('i', { class: 'lg-right' }), ' правильні  ', h('i', { class: 'lg-wrong' }), ' помилки'));

  // Над чим попрацювати
  const traps = (Object.keys(TRAP_INFO) as Trap[]);
  const weak = traps.filter(t => isWeak(p.traps[t])).sort((a, b) => weakness(p.traps[b]) - weakness(p.traps[a]));
  const strong = traps.filter(t => p.traps[t].seen >= 5 && weakness(p.traps[t]) < 0.15);
  body.append(h('h3', { text: 'Над чим варто попрацювати' }));
  if (weak.length) {
    const list = h('div', { class: 'r-traps' });
    weak.forEach(t => {
      const s = p.traps[t], info = TRAP_INFO[t];
      list.append(h('article', { class: 'r-trap' },
        h('h4', { text: info.title }),
        h('p', { class: 'r-trap-meta', text: 'Помилка в ' + Math.round(s.fell) + ' з ' + Math.round(s.seen) + ' випадків, коли була така пастка' }),
        h('p', { text: info.looks }),
        h('p', { class: 'r-tip' }, h('b', { text: 'Вдома: ' }), info.tip)));
    });
    body.append(list, h('p', { class: 'r-note', text: 'Гра вже сама частіше дає завдання саме на ці помилки й повертає до них через кілька питань.' }));
  } else {
    body.append(h('p', { class: 'r-empty', text: p.totals.asked < 15
      ? 'Поки замало відповідей, щоб побачити закономірності. Пограйте ще кілька раундів.'
      : 'Стійких помилок не помічено. Чудово!' }));
  }
  if (strong.length) {
    body.append(h('p', { class: 'r-strong' }, h('b', { text: '💪 Уже впевнено: ' }),
      strong.map(t => TRAP_INFO[t].good).join('; ') + '.'));
  }

  // План на тиждень удома
  const plan = homePlan(p);
  const printBtn = h('button', { class: 'btn btn-sm r-print', type: 'button', text: '🖨 Роздрукувати план' });
  printBtn.addEventListener('click', () => {
    document.body.classList.add('print-plan');
    window.print();
    document.body.classList.remove('print-plan');
  });
  body.append(h('section', { class: 'r-plan' },
    h('h3', { text: 'Що робити вдома цього тижня' }),
    h('p', { class: 'r-focus', text: plan.focus }),
    h('ol', { class: 'r-days' }, ...plan.items.map(it => h('li', { class: 'r-day-card' },
      h('span', { class: 'r-day-name', text: it.day + ' · ' + it.minutes + ' хв' }),
      h('h4', { text: it.title }),
      h('p', { text: it.how }),
      h('p', { class: 'r-need' }, h('b', { text: 'Знадобиться: ' }), it.need)))),
    h('p', { class: 'r-tip' }, plan.daily),
    h('div', { class: 'r-plan-actions' }, printBtn,
      h('a', { class: 'btn btn-sm r-print r-kit', href: '/print.html', target: '_blank', rel: 'noopener',
        text: '✂ Паперовий годинник і картки' }))));

  // Рівні
  body.append(h('h3', { text: 'Рівні й пригоди' }));
  const rows = h('div', { class: 'r-rows' });
  LEVELS.forEach((L, i) => {
    const r = p.levels[i];
    const state = i > p.unlocked ? '🔒' : '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    rows.append(bar(L.name, r.right, r.asked, state));
  });
  ADVENTURES.forEach(a => {
    const r = p.adventures[a.id];
    const state = p.unlocked < a.needs ? '🔒' : '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    rows.append(bar(a.ico + ' ' + a.name, r.right, r.asked, state));
  });
  body.append(rows);

  body.append(h('p', { class: 'r-meta' },
    'Урок: переглянуто ', h('b', { text: p.seen.length + ' з ' + STAGES.length }), ' етапів. ',
    'Значки: ', h('b', { text: p.badges.length + ' з ' + BADGES.length }), '. ',
    'Виправлено власних помилок: ', h('b', { text: String(p.totals.fixed) }), '.'));

  // Налаштування
  body.append(h('h3', { text: 'Налаштування' }));
  const settings = h('div', { class: 'r-settings' });
  const toggle = (label: string, on: boolean, set: (v: boolean) => void, disabled = false, note = '') => {
    const id = 'set-' + Math.random().toString(36).slice(2, 8);
    const inp = h('input', { type: 'checkbox', id });
    (inp as HTMLInputElement).checked = on;
    (inp as HTMLInputElement).disabled = disabled;
    inp.addEventListener('change', () => set((inp as HTMLInputElement).checked));
    settings.append(h('label', { class: 'r-toggle', for: id }, inp, h('span', { text: label }),
      note ? h('small', { text: note }) : ''));
  };
  toggle('Звуки', SFX.isOn(), v => { SFX.set(v); document.dispatchEvent(new Event('settings')); });
  toggle('Озвучка Тіка', p.settings.voice && Voice.available(), v => { p.settings.voice = v; app.save(); document.dispatchEvent(new Event('settings')); },
    !Voice.available(), Voice.available() ? '' : 'На цьому пристрої немає українського голосу');
  toggle('Читати питання вголос автоматично', p.settings.autoRead, v => { p.settings.autoRead = v; app.save(); },
    !Voice.available());
  toggle('Читати варіанти відповідей уголос', p.settings.readOptions, v => { p.settings.readOptions = v; app.save(); },
    !Voice.available(), 'Для дітей, які ще не читають. Біля словесних варіантів завжди є кнопка 🔊.');
  body.append(settings);

  const reset = h('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Скинути весь прогрес' });
  reset.addEventListener('click', () => {
    if (!confirm('Скинути весь прогрес — зірки, рівні, парк і статистику? Це не можна скасувати.')) return;
    const keep = p.settings;
    app.p = blankProgress(LEVELS.length);
    app.p.welcomed = true;
    app.p.settings = keep;
    app.save();
    $('report').hidden = true;
    onReset();
  });
  body.append(h('div', { class: 'r-danger' }, reset));

  $('report').hidden = false;
  $('rClose').focus();
}
