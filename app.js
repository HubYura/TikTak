/* ============================================================
   ЧасоПарк — симуляція навчання аналоговому годиннику
   Низькополігональна ізометрична сцена у стилі RollerCoaster Tycoon.
   ============================================================ */

'use strict';

const NS = 'http://www.w3.org/2000/svg';

/* ---------- Геометрія сцени ---------- */

const OX = 450, OY = 470;          // центр ізометричної сітки
const TW = 76,  TH = 38;           // ширина / висота плитки
const CX = 450, CY = 192, R = 90;  // центр і радіус циферблата

const iso = (i, j) => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2];
const polar = (a, r) => [
  CX + r * Math.sin(a * Math.PI / 180),
  CY - r * Math.cos(a * Math.PI / 180)
];

/* ---------- Етапи навчання ---------- */

const STAGES = [
  {
    chip: 'Будівництво',
    title: 'Ділянка для атракціону',
    desc: 'Розчищаємо галявину в парку й закладаємо кам’яний фундамент майбутньої Годинникової вежі. Усе, що ми збудуємо далі, крутитиметься навколо одного центру.',
    idea: 'Годинник — це коло. Усе на ньому рухається в один бік: згори праворуч, униз, ліворуч і знову вгору. Цей напрямок так і називають — «за годинниковою стрілкою».',
    warn: 'Діти часто ведуть пальцем проти стрілки. Обведіть коло рукою кілька разів у правильному напрямку, перш ніж узагалі рахувати.',
    todo: 'Намалюй пальцем у повітрі велике коло за годинниковою стрілкою. Почни згори, від числа 12.',
    show: ['sky', 'clouds', 'ground', 'shadow', 'plinth'],
    rate: 0, snap: 0, start: 540, hold: 3200, time: false
  },
  {
    chip: 'Будівництво',
    title: 'Вежа росте',
    desc: 'Ставимо дерев’яний стовп, будку для механізму й дах із прапорцем. Відвідувачі парку вже підтягуються подивитись на новий атракціон.',
    idea: 'У кожного годинника є корпус і механізм усередині. Стрілки не рухаються самі — їх крутить один спільний механізм, тому вони назавжди пов’язані між собою.',
    warn: 'Годинник — не малюнок, а машина. Якщо одна стрілка зрушила, друга теж зрушила — просто набагато менше.',
    todo: 'Порахуй, скільки «поверхів» у нашої вежі. Як гадаєш, де саме з’явиться циферблат?',
    show: ['shaft', 'housing', 'roof', 'banner', 'scenery', 'peeps'],
    rate: 0, snap: 0, start: 540, hold: 3200, time: false
  },
  {
    chip: 'Циферблат',
    title: 'Циферблат і числа 1–12',
    desc: 'Встановлюємо велике коло й розставляємо числа від 1 до 12. Число 12 — угорі, 6 — унизу, 3 — праворуч, 9 — ліворуч.',
    idea: '12 чисел ділять коло на 12 однакових частин. Відстань між сусідніми числами — рівно одна година.',
    warn: 'Числа йдуть тільки за годинниковою стрілкою. Найлегше спершу поставити 12, 3, 6 і 9 — а решту вписати між ними.',
    todo: 'Закрий очі й скажи: яке число навпроти 12? А навпроти 4?',
    show: ['fDial', 'fTicksHour', 'fNumsHour', 'fHub'],
    focus: ['fDial', 'fTicksHour', 'fNumsHour', 'fHub'],
    rate: 0, snap: 0, start: 540, hold: 4200, time: false
  },
  {
    chip: 'Стрілки',
    title: 'Коротка стрілка — години',
    desc: 'Ставимо товсту коротку стрілку. Вона показує години й повзе дуже повільно: одне число за цілу годину.',
    idea: 'Коротка й товста = години. Читаємо те число, яке стрілка вже пройшла, а не те, до якого прямує.',
    warn: 'Найчастіша помилка — переплутати стрілки. Запам’ятай: коротка мала, бо повільна. Довга велика, бо швидка.',
    todo: 'Стрілка стоїть між 4 і 5. Яка зараз година — четверта чи п’ята?',
    show: ['fHour'],
    focus: ['fHour', 'fNumsHour', 'fHub'], pulse: 'fHour',
    rate: 60, snap: 60, start: 720, hold: 13000, time: true
  },
  {
    chip: 'Стрілки',
    title: 'Довга стрілка — хвилини',
    desc: 'Додаємо довгу тонку стрілку. Поки вона робить один повний оберт, коротка встигає перейти лише на одне сусіднє число.',
    idea: 'Одне коло довгої стрілки = 60 хвилин = 1 година. Саме тому годинна стрілка рухається плавно, а не стрибає.',
    warn: 'Годинна стрілка не стоїть на місці, чекаючи хвилинну! О 3:45 вона вже майже торкається 4 — але година все одно третя.',
    todo: 'Стеж за короткою стрілкою, поки довга робить повне коло. Помітив, як вона потихеньку повзе?',
    show: ['fMin'],
    focus: ['fMin', 'fHour', 'fHub'], pulse: 'fMin',
    rate: 30, snap: 0, start: 540, hold: 13000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Пів години',
    desc: 'Довга стрілка внизу, на числі 6. Половина кола пройдена — минуло 30 хвилин.',
    idea: 'Пів години = 30 хвилин. Годинна стрілка в цей момент стоїть рівно посередині між двома числами.',
    warn: 'Пів — це 30, а не 50! Час рахують до 60, а не до 100. Він не десятковий.',
    todo: 'Українською 3:30 — це «пів на четверту». Чому саме на четверту, а не на третю?',
    show: [],
    focus: ['fMin', 'fHour', 'fNumsHour', 'fHub'],
    rate: 20, snap: 30, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Чверть години',
    desc: 'Ділимо коло на чотири рівні частини. Довга стрілка на 3 — минула чверть; на 9 — лишилася чверть.',
    idea: 'Чверть = 15 хвилин. 3:15 — «чверть на четверту». 3:45 — «за чверть четверта».',
    warn: '3:45 — це НЕ «чверть на четверту». Коли чверть лишається, називають ту годину, яка тільки настане: «за чверть четверта».',
    todo: 'Котра година, якщо довга стрілка на 9, а коротка майже дійшла до 7?',
    show: ['fQuarters'],
    focus: ['fMin', 'fHour', 'fQuarters', 'fHub'],
    rate: 12, snap: 15, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Лічба п’ятірками',
    desc: 'Підписуємо числа вдруге — синім, зсередини. Тепер кожне число на циферблаті має два різні значення.',
    idea: 'Для довгої стрілки число 1 означає 5 хвилин, 2 — це 10, 3 — це 15. Рахуй п’ятірками: 5, 10, 15, 20…',
    warn: 'Одне й те саме число означає різне для різних стрілок. Чорні числа — для короткої, сині — для довгої.',
    todo: 'Довга стрілка вказує на 8. Скільки це хвилин? Рахуй п’ятірками вголос.',
    show: ['fNumsMin'],
    focus: ['fMin', 'fNumsMin', 'fHub'], pulse: 'fNumsMin',
    rate: 6, snap: 5, start: 540, hold: 13000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Маленькі поділки',
    desc: 'Між числами з’являються дрібні риски. Їх рівно 60 — по одній на кожну хвилину.',
    idea: 'Одна риска = 1 хвилина. Між двома сусідніми числами — рівно 5 рисок.',
    warn: 'Не переходь до точних хвилин, поки не засвоєна лічба п’ятірками: спершу знайди найближче число, а вже потім дорахуй риски.',
    todo: 'Довга стрілка на дві риски далі за число 4. Скільки це хвилин? (20 + 2)',
    show: ['fTicksMin'],
    focus: ['fMin', 'fTicksMin', 'fHub'], pulse: 'fTicksMin',
    rate: 4, snap: 1, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Секунди',
    title: 'Секундна стрілка',
    desc: 'Найтонша й найшвидша стрілка. Один її оберт — це лише одна хвилина.',
    idea: '60 секунд = 1 хвилина. Секундна стрілка тонка та яскрава — не плутай її з хвилинною.',
    warn: 'І секундна, і хвилинна довгі. Розрізняй їх за товщиною й кольором, а не за довжиною.',
    todo: 'Порахуй уголос до 60, поки помаранчева стрілка робить повне коло.',
    show: ['fSec'],
    focus: ['fSec', 'fHub'], pulse: 'fSec',
    rate: 0.25, snap: 0, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Доба',
    title: 'Ранок, день, вечір, ніч',
    desc: 'Небо над парком змінюється. За добу коротка стрілка обходить циферблат двічі — а цифровий годинник рахує аж до 24.',
    idea: 'Ранок і вечір на циферблаті виглядають однаково. 15:00 — це 3 година дня: 15 − 12 = 3.',
    warn: 'На циферблаті немає ні 0, ні 13. О 12 ночі й о 12 дня стрілки в тому самому місці — розрізняємо їх за небом.',
    todo: 'Котра година буде на циферблаті о 19:00? А о 22:00?',
    show: ['sun'],
    focus: ['fHour', 'fMin', 'fNumsHour', 'fHub'],
    rate: 120, snap: 0, start: 300, hold: 15000, time: true, day: true
  }
];

/* Коротка репліка Тіка на кожен етап */
const STAGE_SAY = [
  'Розчищаємо галявину! Обведи пальцем коло — завжди в один бік.',
  'Вежа росте! Усередині сховається механізм.',
  'Дивись: 12 угорі, 6 унизу, 3 праворуч, 9 ліворуч.',
  'Коротка стрілка — це години. Вона найповільніша.',
  'Довга робить ціле коло, а коротка — лише крок. Бачиш?',
  'Стрілка внизу, на 6 — половина кола, 30 хвилин!',
  'Ділимо коло на чотири частини. Це чверті.',
  'Рахуємо п’ятірками: 5, 10, 15, 20…',
  'Кожна дрібна рисочка — одна хвилинка.',
  'Найшвидша стрілка! Порахуй до 60 разом зі мною.',
  'Дивись, як небо змінюється: ранок, день, вечір, ніч.'
];

const PRAISE = ['Клас!', 'Супер!', 'Точно!', 'Молодець!', 'Так тримати!', 'Вау!', 'Легко!'];
const PRAISE_SAY = [
  'Оце так! Ти справжній годинникар.',
  'Ідеально! Наступне буде ще цікавіше.',
  'Так, саме так! Я в тебе вірив.',
  'Чудово! Стрілки тебе слухаються.'
];
const CHEER_UP = ['Майже!', 'Ще трішки!', 'Буває!', 'Спробуймо ще!'];
const CHEER_SAY = [
  'Нічого страшного — помилки вчать найкраще.',
  'Подивись на підказку й спробуй ще раз.',
  'Я теж колись плутав стрілки. Далі вийде!',
  'Ще одна спроба — і все вийде.'
];

const anyOf = a => a[Math.floor(Math.random() * a.length)];

/* ---------- Українські назви часу ---------- */

const ORD_NOM = ['дванадцята', 'перша', 'друга', 'третя', 'четверта', 'п’ята',
                 'шоста', 'сьома', 'восьма', 'дев’ята', 'десята', 'одинадцята'];
const ORD_ACC = ['дванадцяту', 'першу', 'другу', 'третю', 'четверту', 'п’яту',
                 'шосту', 'сьому', 'восьму', 'дев’яту', 'десяту', 'одинадцяту'];

function pluralMin(n) {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return 'хвилина';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'хвилини';
  return 'хвилин';
}

function sayTime(h24, m) {
  const h = h24 % 12;
  const next = (h + 1) % 12;
  if (m === 0)  return 'рівно ' + ORD_NOM[h];
  if (m === 15) return 'чверть на ' + ORD_ACC[next];
  if (m === 30) return 'пів на ' + ORD_ACC[next];
  if (m === 45) return 'за чверть ' + ORD_NOM[next];
  if (m < 30)   return m + ' ' + pluralMin(m) + ' на ' + ORD_ACC[next];
  const left = 60 - m;
  return 'за ' + left + ' ' + pluralMin(left) + ' ' + ORD_NOM[next];
}

function partOfDay(h24) {
  if (h24 >= 5 && h24 < 12)  return 'ранку';
  if (h24 >= 12 && h24 < 18) return 'дня';
  if (h24 >= 18 && h24 < 23) return 'вечора';
  return 'ночі';
}

/* ---------- Побудова SVG ---------- */

const scene = document.getElementById('scene');
const parts = {};

function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  (parent || scene).appendChild(n);
  return n;
}
function group(id, parent) { return el('g', { id }, parent); }
function poly(points, fill, parent, extra) {
  return el('polygon', Object.assign({ points: points.map(p => p.join(',')).join(' '), fill }, extra || {}), parent);
}

/** Реєструє блок, який з'являється на певному етапі. */
function regPart(id, node, kids) {
  if (kids) parts[id] = { el: node, kids };
  else { node.classList.add('part'); parts[id] = { el: node, kids: null }; }
}

/** Ізометричний блок: передня грань, бічна грань, верхня грань. */
function isoBlock(parent, x1, x2, yTop, yBot, depth, cFront, cSide, cTop) {
  poly([[x1, yTop], [x2, yTop], [x2, yBot], [x1, yBot]], cFront, parent);
  poly([[x2, yTop], [x2 + depth, yTop - depth * 0.55], [x2 + depth, yBot - depth * 0.55], [x2, yBot]], cSide, parent);
  poly([[x1, yTop], [x1 + depth, yTop - depth * 0.55], [x2 + depth, yTop - depth * 0.55], [x2, yTop]], cTop, parent);
}

/* Палітра сцени — соковита, з чіткою стороною світла */
const C = {
  grassTop: '#7cc356', grassAlt: '#6cb548', grassSide: '#4f8f33', grassDeep: '#3f7628',
  pathTop:  '#f0d7a4', pathAlt:  '#e3c68d',
  soil: '#8a5c34', soilDeep: '#563820',
  wood: '#c08048', woodTop: '#dda068', woodSide: '#8f5a2e', woodDeep: '#6d4322',
  stone: '#d6dde6', stoneTop: '#eef2f7', stoneSide: '#a3aebb',
  roof: '#e8484f', roofLight: '#ff6b6b', roofSide: '#b0323a',
  gold: '#ffc42e', goldDark: '#c48c00',
  dial: '#fbfcff', dialRing: '#e9eef5', bezel: '#2a3442',
  ink: '#1f2a37', tickMin: '#b9c3cf',
  hourHand: '#ff5a5f', hourHandD: '#c03b41',
  minHand: '#1aa7ff', minHandD: '#0f6ea9',
  secHand: '#ffc42e',
  leafA: '#5fae3f', leafB: '#7bc95a', leafC: '#94dd6f'
};

function buildScene() {
  const defs = el('defs');

  const sky = el('linearGradient', { id: 'skyGrad', x1: '0', y1: '0', x2: '0', y2: '1' }, defs);
  const skyA = el('stop', { offset: '0', 'stop-color': '#8ad3ef' }, sky);
  const skyB = el('stop', { offset: '1', 'stop-color': '#d9f2fb' }, sky);

  /* Небо */
  const gSky = group('gSky');
  el('rect', { x: 0, y: 0, width: 900, height: 620, fill: 'url(#skyGrad)' }, gSky);
  regPart('sky', gSky);

  /* Сонце та місяць. Внутрішня група потрібна тому, що на .part CSS
     виставляє власний transform і затер би наш translate. */
  const gSun = group('gSun');
  const sunInner = el('g', {}, gSun);
  const sunGlow = el('circle', { cx: 120, cy: 120, r: 40, fill: '#ffd76a', opacity: '.28' }, sunInner);
  const sunBody = el('circle', { cx: 120, cy: 120, r: 26, fill: '#ffd76a' }, sunInner);
  regPart('sun', gSun);

  /* Хмари — м'які низькополігональні шапки */
  const gClouds = group('gClouds');
  const cloudShapes = [];
  [[130, 88, 1], [430, 60, .78], [700, 110, 1.18]].forEach(([x, y, s]) => {
    const c = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')' }, gClouds);
    poly([[-48, 8], [-30, -12], [-6, -20], [18, -14], [40, 2], [48, 12]], '#ffffff', c);
    poly([[-48, 8], [48, 12], [36, 22], [-34, 20]], '#dceaf3', c);
    cloudShapes.push({ node: c, x, y, s });
  });
  regPart('clouds', gClouds);

  /* ---------- Земля: летючий острів ---------- */

  const gGround = group('gGround');

  // Підземна частина — два схили, що сходяться в шпиль під островом
  poly([[222, 470], [450, 584], [450, 706]], C.soil, gGround);
  poly([[450, 584], [678, 470], [450, 706]], C.soilDeep, gGround);
  // Смуга дерну по краю
  poly([[222, 470], [450, 584], [450, 600], [222, 486]], C.grassSide, gGround);
  poly([[450, 584], [678, 470], [678, 486], [450, 600]], C.grassDeep, gGround);

  // Дрібні уламки, що летять поруч, — додають відчуття висоти
  [[172, 545, 15], [726, 528, 12], [300, 640, 10]].forEach(([x, y, r]) => {
    poly([[x - r, y], [x, y - r * .5], [x + r, y], [x, y + r * .5]], C.grassAlt, gGround);
    poly([[x - r, y], [x, y + r * .5], [x, y + r * 1.6]], C.soil, gGround);
    poly([[x, y + r * .5], [x + r, y], [x, y + r * 1.6]], C.soilDeep, gGround);
  });

  // Плитки поверхні
  const tiles = [];
  for (let s = -6; s <= 6; s++) {
    for (let i = -3; i <= 3; i++) {
      const j = s - i;
      if (j >= -3 && j <= 3) tiles.push([i, j]);
    }
  }
  tiles.forEach(([i, j]) => {
    const [x, y] = iso(i, j);
    const onPath = (i === 0 || j === 0);
    const alt = ((i + j) % 2 + 2) % 2;
    const fill = onPath ? (alt ? C.pathTop : C.pathAlt) : (alt ? C.grassTop : C.grassAlt);
    poly([[x, y - TH / 2], [x + TW / 2, y], [x, y + TH / 2], [x - TW / 2, y]], fill, gGround);
  });

  // Камінці на доріжці
  [[-2, 0], [2, 0], [0, -2], [0, 2], [1.4, 0], [0, 1.4]].forEach(([i, j]) => {
    const [x, y] = iso(i, j);
    poly([[x - 7, y], [x, y - 3.5], [x + 7, y], [x, y + 3.5]], '#cbae7a', gGround);
  });
  regPart('ground', gGround);

  /* Тінь під вежею */
  const gShadow = group('gShadow');
  el('ellipse', { cx: OX + 10, cy: OY + 8, rx: 126, ry: 36, fill: '#2f5a24', opacity: '.32' }, gShadow);
  regPart('shadow', gShadow);

  /* ---------- Декор парку ---------- */

  const gScenery = group('gScenery');

  /** Дерево з округлою кроною у три тони. */
  function tree(x, y, s) {
    const g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + s + ')' }, gScenery);
    poly([[-6, 0], [6, 0], [4, -24], [-4, -24]], C.woodSide, g);
    poly([[0, 0], [6, 0], [4, -24], [0, -24]], C.woodDeep, g);
    // крона: три «шапки», кожна ширша знизу
    const blob = (cy, w, h, col) =>
      poly([[-w, cy], [-w * .72, cy - h * .62], [0, cy - h], [w * .72, cy - h * .62], [w, cy],
            [w * .6, cy + h * .28], [-w * .6, cy + h * .28]], col, g);
    blob(-20, 26, 30, C.leafA);
    blob(-38, 21, 26, C.leafB);
    blob(-54, 14, 20, C.leafC);
  }
  [[-2.6, -2.6, 1], [2.6, -2.4, .92], [-2.5, 2.5, 1.05], [2.7, 2.6, .95],
   [-3, .2, .85], [3, -.2, .88], [-1.2, -3, .8], [1.3, 3, .82]]
    .forEach(([i, j, s]) => { const [x, y] = iso(i, j); tree(x, y, s); });

  // Ліхтарі
  [[-1.9, 1.9], [1.9, -1.9]].forEach(([i, j]) => {
    const [x, y] = iso(i, j);
    poly([[x - 3, y], [x + 3, y], [x + 2, y - 42], [x - 2, y - 42]], '#5a6674', gScenery);
    poly([[x - 10, y - 42], [x + 10, y - 42], [x + 6, y - 58], [x - 6, y - 58]], C.gold, gScenery);
    el('circle', { cx: x, cy: y - 50, r: 13, fill: C.gold, opacity: '.22' }, gScenery);
  });

  // Кульки — трохи свята
  [[-2.2, 1.1, '#ff5a5f'], [2.3, 1.4, '#1aa7ff'], [-1.1, -2.3, '#a45cff']].forEach(([i, j, col]) => {
    const [x, y] = iso(i, j);
    el('line', { x1: x, y1: y, x2: x + 4, y2: y - 46, stroke: '#3d4a57', 'stroke-width': 1.4 }, gScenery);
    el('ellipse', { cx: x + 5, cy: y - 56, rx: 11, ry: 13, fill: col }, gScenery);
    el('ellipse', { cx: x + 1, cy: y - 60, rx: 3.4, ry: 4.4, fill: '#fff', opacity: '.45' }, gScenery);
  });
  regPart('scenery', gScenery);

  /* ---------- Вежа ---------- */

  const gPlinth = group('gPlinth');
  isoBlock(gPlinth, 352, 548, 424, 472, 26, C.stone, C.stoneSide, C.stoneTop);
  poly([[352, 424], [548, 424], [548, 433], [352, 433]], '#c2cad4', gPlinth);
  // сходинка спереду
  poly([[404, 472], [496, 472], [496, 486], [404, 486]], C.stoneSide, gPlinth);
  poly([[404, 472], [496, 472], [508, 466], [416, 466]], C.stone, gPlinth);
  regPart('plinth', gPlinth);

  const gShaft = group('gShaft');
  isoBlock(gShaft, 386, 514, 300, 424, 22, C.wood, C.woodSide, C.woodTop);
  for (let y = 322; y < 424; y += 30) {
    poly([[386, y], [514, y], [514, y + 4], [386, y + 4]], C.woodDeep, gShaft);
    poly([[514, y], [536, y - 12], [536, y - 8], [514, y + 4]], '#5c3819', gShaft);
  }
  // світлий кант зліва — напрямок світла
  poly([[386, 300], [392, 300], [392, 424], [386, 424]], C.woodTop, gShaft);
  regPart('shaft', gShaft);

  const gHousing = group('gHousing');
  isoBlock(gHousing, 330, 570, 78, 300, 24, C.wood, C.woodSide, C.woodTop);
  poly([[330, 284], [570, 284], [570, 300], [330, 300]], C.woodSide, gHousing);
  poly([[330, 78], [336, 78], [336, 300], [330, 300]], C.woodTop, gHousing);
  // рамка навколо циферблата, як у справжніх баштових годинників
  el('rect', { x: 342, y: 86, width: 216, height: 206, rx: 20,
               fill: 'none', stroke: C.woodDeep, 'stroke-width': 6 }, gHousing);
  // заклепки по кутах
  [[356, 98], [544, 98], [356, 280], [544, 280]].forEach(([x, y]) =>
    el('circle', { cx: x, cy: y, r: 4.5, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1.5 }, gHousing));
  regPart('housing', gHousing);

  /* Дах тримаємо вище за безель циферблата: інакше піддашок ліг би
     просто на золоте кільце, бо циферблат малюється поверх даху. */
  const gRoof = group('gRoof');
  poly([[306, 78], [594, 78], [450, 8]], C.roof, gRoof);
  poly([[450, 8], [594, 78], [618, 70], [474, 0]], C.roofSide, gRoof);
  poly([[306, 78], [594, 78], [618, 70], [330, 70]], C.roofLight, gRoof);
  // піддашок
  poly([[296, 78], [604, 78], [604, 90], [296, 90]], C.roofSide, gRoof);
  poly([[296, 78], [604, 78], [616, 72], [308, 72]], C.roof, gRoof);
  regPart('roof', gRoof);

  const gBanner = group('gBanner');
  el('circle', { cx: 450, cy: 6, r: 5.5, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1.5 }, gBanner);
  poly([[456, 2], [500, 10], [456, 18]], C.gold, gBanner);
  poly([[456, 10], [500, 10], [456, 18]], C.goldDark, gBanner);
  regPart('banner', gBanner);

  /* ---------- Циферблат ---------- */

  const face = group('face');

  const gDial = group('fDial', face);
  el('circle', { cx: CX, cy: CY, r: R + 9, fill: C.goldDark }, gDial);
  el('circle', { cx: CX, cy: CY, r: R + 7, fill: C.gold }, gDial);
  el('circle', { cx: CX, cy: CY, r: R + 4, fill: C.bezel }, gDial);
  el('circle', { cx: CX, cy: CY, r: R, fill: C.dial }, gDial);
  el('circle', { cx: CX, cy: CY, r: R - 20, fill: 'none', stroke: C.dialRing, 'stroke-width': 1.5 }, gDial);
  // скляний відблиск угорі зліва
  el('path', {
    d: 'M ' + (CX - R * .82) + ' ' + (CY - R * .3) +
       ' A ' + R + ' ' + R + ' 0 0 1 ' + (CX + R * .3) + ' ' + (CY - R * .82) +
       ' A ' + (R * 1.5) + ' ' + (R * 1.5) + ' 0 0 0 ' + (CX - R * .82) + ' ' + (CY - R * .3) + ' Z',
    fill: '#ffffff', opacity: '.3'
  }, gDial);
  regPart('fDial', gDial);

  /* Чверті — чотири світлі сектори */
  const gQ = group('fQuarters', face);
  const qCols = [C.gold, '#2fc172', C.minHand, C.hourHand];
  for (let q = 0; q < 4; q++) {
    const a0 = q * 90, a1 = a0 + 90;
    const [x0, y0] = polar(a0, R - 6), [x1, y1] = polar(a1, R - 6);
    el('path', {
      d: 'M ' + CX + ' ' + CY + ' L ' + x0 + ' ' + y0 + ' A ' + (R - 6) + ' ' + (R - 6) + ' 0 0 1 ' + x1 + ' ' + y1 + ' Z',
      fill: qCols[q], opacity: '.16'
    }, gQ);
  }
  regPart('fQuarters', gQ);

  /* Дрібні поділки */
  const gTm = group('fTicksMin', face);
  const tmKids = [];
  for (let k = 0; k < 60; k++) {
    if (k % 5 === 0) continue;
    const a = k * 6;
    const [x1, y1] = polar(a, R - 5), [x2, y2] = polar(a, R - 11);
    tmKids.push(el('line', { x1, y1, x2, y2, stroke: C.tickMin, 'stroke-width': 2,
                             'stroke-linecap': 'round', class: 'part' }, gTm));
  }
  regPart('fTicksMin', gTm, tmKids);

  /* Годинні поділки */
  const gTh = group('fTicksHour', face);
  const thKids = [];
  for (let k = 0; k < 12; k++) {
    const a = k * 30;
    const [x1, y1] = polar(a, R - 4), [x2, y2] = polar(a, R - 17);
    thKids.push(el('line', { x1, y1, x2, y2, stroke: C.ink, 'stroke-width': 5.5,
                             'stroke-linecap': 'round', class: 'part' }, gTh));
  }
  regPart('fTicksHour', gTh, thKids);

  /* Числа годин */
  const gNh = group('fNumsHour', face);
  const nhKids = [];
  for (let n = 1; n <= 12; n++) {
    const [x, y] = polar(n * 30, R - 48);
    const t = el('text', {
      x, y, class: 'part', fill: C.ink, 'font-size': 28, 'font-weight': 700,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': 'Fredoka, Segoe UI, sans-serif'
    }, gNh);
    t.textContent = String(n);
    nhKids.push(t);
  }
  regPart('fNumsHour', gNh, nhKids);

  /* Числа хвилин — того ж кольору, що й хвилинна стрілка */
  const gNm = group('fNumsMin', face);
  const nmKids = [];
  for (let n = 1; n <= 12; n++) {
    const [x, y] = polar(n * 30, R - 26);
    const t = el('text', {
      x, y, class: 'part', fill: C.minHand, 'font-size': 13, 'font-weight': 600,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      'font-family': 'Fredoka, Segoe UI, sans-serif'
    }, gNm);
    t.textContent = n === 12 ? '00' : String(n * 5).padStart(2, '0');
    nmKids.push(t);
  }
  regPart('fNumsMin', gNm, nmKids);

  /* Стрілки: товсті, з темним контуром, щоб читалися поверх чисел */
  const handShape = (len, halfW, tail) => [
    [CX - halfW, CY + tail], [CX + halfW, CY + tail],
    [CX + halfW * .55, CY - len + 10], [CX, CY - len], [CX - halfW * .55, CY - len + 10]
  ];

  const gH = group('fHour', face);
  const hourHand = el('g', {}, gH);
  poly(handShape(46, 8, 14), C.hourHand, hourHand,
       { stroke: C.hourHandD, 'stroke-width': 3, 'stroke-linejoin': 'round' });
  regPart('fHour', gH);

  const gM = group('fMin', face);
  const minHand = el('g', {}, gM);
  poly(handShape(76, 6, 18), C.minHand, minHand,
       { stroke: C.minHandD, 'stroke-width': 3, 'stroke-linejoin': 'round' });
  regPart('fMin', gM);

  const gS = group('fSec', face);
  const secHand = el('g', {}, gS);
  el('line', { x1: CX, y1: CY + 22, x2: CX, y2: CY - 82, stroke: C.bezel, 'stroke-width': 5,
               'stroke-linecap': 'round' }, secHand);
  el('line', { x1: CX, y1: CY + 22, x2: CX, y2: CY - 82, stroke: C.secHand, 'stroke-width': 2.4,
               'stroke-linecap': 'round' }, secHand);
  el('circle', { cx: CX, cy: CY - 82, r: 5, fill: C.secHand, stroke: C.bezel, 'stroke-width': 2 }, secHand);
  regPart('fSec', gS);

  const gHub = group('fHub', face);
  el('circle', { cx: CX, cy: CY, r: 10, fill: C.bezel }, gHub);
  el('circle', { cx: CX, cy: CY, r: 5, fill: C.gold }, gHub);
  regPart('fHub', gHub);

  /* ---------- Відвідувачі ---------- */

  const gPeeps = group('gPeeps');
  const peeps = [];
  const peepCols = [['#ff5a5f', '#c03b41'], ['#1aa7ff', '#0f6ea9'], ['#2fc172', '#1c7d49'],
                    ['#ffc42e', '#c48c00'], ['#a45cff', '#6b32b5']];
  for (let p = 0; p < 5; p++) {
    const g = el('g', {}, gPeeps);
    const [c1, c2] = peepCols[p];
    el('ellipse', { cx: 0, cy: 1, rx: 8, ry: 3.4, fill: '#000', opacity: '.18' }, g);
    poly([[-7, 0], [7, 0], [5, -15], [-5, -15]], c1, g);
    poly([[0, 0], [7, 0], [5, -15], [0, -15]], c2, g);
    el('circle', { cx: 0, cy: -21, r: 6.5, fill: '#f8d9b6' }, g);
    poly([[-7, -24], [7, -24], [0, -33]], c1, g);
    el('circle', { cx: -2.4, cy: -21, r: 1.1, fill: '#3d3026' }, g);
    el('circle', { cx: 2.4, cy: -21, r: 1.1, fill: '#3d3026' }, g);
    peeps.push({ node: g, axis: p % 2, t: p / 5, speed: 0.055 + p * 0.014 });
  }
  regPart('peeps', gPeeps);

  return { skyA, skyB, hourHand, minHand, secHand, face, cloudShapes, peeps, sunInner, sunBody, sunGlow };
}

const S = buildScene();

/* ---------- Порядок відображення (перебудовуємо z-order) ---------- */

/* Небо й світило лишаються поза групою world: нічне затемнення
   не повинно гасити сонце та місяць. */
scene.appendChild(document.getElementById('gSky'));
scene.appendChild(document.getElementById('gSun'));

const world = el('g', { id: 'world' });
['gClouds', 'gGround', 'gScenery', 'gShadow', 'gPlinth', 'gShaft',
 'gHousing', 'gRoof', 'gBanner', 'face', 'gPeeps']
  .forEach(id => { const n = document.getElementById(id); if (n) world.appendChild(n); });

/* Прозорий диск над циферблатом — за нього дитина крутить стрілки.
   Самі деталі мають pointer-events:none, тож ловити вказівник нема чим. */
const grab = el('circle', { id: 'grab', cx: CX, cy: CY, r: R + 8, fill: 'transparent' }, world);
grab.style.display = 'none';

/* ---------- Стан ---------- */

const FACE_IDS = ['fDial', 'fQuarters', 'fTicksMin', 'fTicksHour', 'fNumsHour', 'fNumsMin', 'fHour', 'fMin', 'fSec', 'fHub'];

let cur = 0;
let playing = false;
let speed = 1;
let focusOn = true;
let mode = 'learn';               // 'learn' | 'practice'
let tm = 540, target = 540, acc = 0, stageT = 0, T = 0, last = 0;
let tickFlip = false;

const $ = id => document.getElementById(id);
const ui = {
  rail: $('rail'), badge: $('badge'), chip: $('chip'), title: $('stTitle'),
  desc: $('stDesc'), idea: $('stIdea'), warn: $('stWarn'), todo: $('stTry'),
  readout: $('readout'), digital: $('digital'), verbal: $('verbal'),
  play: $('btnPlay'), prev: $('btnPrev'), next: $('btnNext'), reset: $('btnReset'),
  focus: $('tglFocus'), wrap: document.querySelector('.scene-wrap'),
  buddy: $('buddy'), buddySay: $('buddySay'), pop: $('popover'), sound: $('btnSound')
};

/* ---------- Маскот і святкування ---------- */

let buddyTimer = 0, popTimer = 0;

/** Тік каже щось і на мить змінює вираз обличчя. */
function say(text, mood, ms) {
  if (text) ui.buddySay.textContent = text;
  clearTimeout(buddyTimer);
  // Перезапускаємо анімацію, навіть якщо настрій той самий
  ui.buddy.dataset.mood = 'idle';
  void ui.buddy.offsetWidth;
  ui.buddy.dataset.mood = mood || 'idle';
  if (mood && mood !== 'idle') {
    buddyTimer = setTimeout(() => { ui.buddy.dataset.mood = 'idle'; }, ms || 2200);
  }
}

/** Велика похвала просто поверх сцени. */
function popover(text, bad) {
  const p = ui.pop;
  p.hidden = false;
  p.className = 'popover' + (bad ? ' bad' : '');
  p.textContent = text;
  p.style.animation = 'none';
  void p.offsetWidth;
  p.style.animation = '';
  clearTimeout(popTimer);
  popTimer = setTimeout(() => { p.hidden = true; }, 1400);
}

FX.mount();

/* Звук у браузері не запуститься до першого жесту користувача */
['pointerdown', 'keydown'].forEach(ev =>
  window.addEventListener(ev, () => SFX.unlock(), { once: true }));

/* Клацання на будь-якій кнопці, крім варіантів відповіді —
   ті мають власні звуки правильно/неправильно */
document.addEventListener('pointerdown', e => {
  const b = e.target.closest('button');
  if (b && !b.disabled && !b.classList.contains('opt')) SFX.tap();
}, true);

function paintSound() {
  const on = SFX.isOn();
  ui.sound.textContent = on ? '🔊' : '🔇';
  ui.sound.classList.toggle('is-off', !on);
  ui.sound.setAttribute('aria-pressed', String(on));
}
ui.sound.addEventListener('click', () => {
  const on = SFX.toggle();
  paintSound();
  say(on ? 'Звук увімкнено!' : 'Тепер тихо.', 'happy', 1400);
});
paintSound();

/* Рейка етапів */
STAGES.forEach((_, i) => {
  const b = document.createElement('button');
  b.className = 'rail-dot';
  b.type = 'button';
  b.textContent = String(i + 1);
  b.title = 'Етап ' + (i + 1) + ': ' + STAGES[i].title;
  b.addEventListener('click', () => goTo(i));
  ui.rail.appendChild(b);
});

function visibleIds(upTo) {
  const set = new Set();
  for (let i = 0; i <= upTo; i++) STAGES[i].show.forEach(id => set.add(id));
  return set;
}

function applyReveal(upTo) { applyRevealSet(visibleIds(upTo)); }

function applyRevealSet(vis) {
  Object.keys(parts).forEach(id => {
    const p = parts[id];
    const on = vis.has(id);
    if (p.kids) {
      p.kids.forEach((k, i) => {
        k.style.transitionDelay = on ? (i * 45) + 'ms' : '0ms';
        k.classList.toggle('on', on);
      });
    } else {
      p.el.classList.toggle('on', on);
    }
  });
}

function applyFocus() {
  const st = STAGES[cur];
  S.face.classList.toggle('focus', focusOn && !!st.focus);
  // Тло циферблата й вісь стрілок ніколи не приглушуємо —
  // інакше крізь них просвічує корпус вежі.
  const keep = new Set(st.focus || FACE_IDS);
  keep.add('fDial');
  keep.add('fHub');

  // .dim має вищу специфічність за .part, тому приглушуємо лише те,
  // що вже відкрите — інакше прихована деталь стала б видимою на 32%.
  const vis = visibleIds(cur);
  FACE_IDS.forEach(id => {
    const p = parts[id];
    if (!p) return;
    const shown = p.kids ? true : vis.has(id);
    p.el.classList.toggle('dim', shown && !keep.has(id));
    p.el.classList.toggle('pulse', focusOn && st.pulse === id);
  });
}

function goTo(i) {
  const moved = cur !== Math.max(0, Math.min(STAGES.length - 1, i));
  cur = Math.max(0, Math.min(STAGES.length - 1, i));
  const st = STAGES[cur];

  if (mode === 'learn') {
    // Перші три етапи — будівництво, там доречний глухий удар,
    // далі просто легкий перехід.
    if (cur <= 2) SFX.build(); else SFX.swipe();
    say(STAGE_SAY[cur], moved ? 'happy' : 'idle', 1500);
  }

  tm = target = st.start;
  acc = 0;
  stageT = 0;

  applyReveal(cur);
  applyFocus();

  ui.badge.textContent = 'Етап ' + (cur + 1) + ' / ' + STAGES.length;
  ui.chip.textContent = st.chip;
  ui.title.textContent = st.title;
  ui.desc.textContent = st.desc;
  ui.idea.textContent = st.idea;
  ui.warn.textContent = st.warn;
  ui.todo.textContent = st.todo;
  ui.readout.hidden = !st.time;

  Array.from(ui.rail.children).forEach((d, k) => {
    d.classList.toggle('now', k === cur);
    d.classList.toggle('done', k < cur);
  });
  ui.rail.children[cur].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

  ui.prev.disabled = cur === 0;
  ui.next.disabled = cur === STAGES.length - 1;

  if (!progress.seen.includes(cur)) { progress.seen.push(cur); saveProgress(); }

  if (!st.day) setSky(12);
  render();
}

function setPlaying(v) {
  playing = v;
  ui.play.textContent = v ? '⏸' : '▶';
  ui.play.setAttribute('aria-label', v ? 'Пауза' : 'Пуск');
}

let lastSkyH = -1;
function setSky(h24) {
  if (h24 === lastSkyH) return;
  lastSkyH = h24;
  let a, b, dark;
  if (h24 < 5)       { a = '#132038'; b = '#2a3d63'; dark = .55; }
  else if (h24 < 7)  { a = '#ef9a5f'; b = '#ffd2a1'; dark = .18; }
  else if (h24 < 18) { a = '#8ad3ef'; b = '#d9f2fb'; dark = 0;   }
  else if (h24 < 20) { a = '#e8794f'; b = '#ffc98f'; dark = .18; }
  else if (h24 < 22) { a = '#3d4f7d'; b = '#7a6f9a'; dark = .4;  }
  else               { a = '#132038'; b = '#2a3d63'; dark = .55; }
  S.skyA.setAttribute('stop-color', a);
  S.skyB.setAttribute('stop-color', b);
  ui.wrap.style.background = 'linear-gradient(180deg,' + a + ',' + b + ')';
  world.style.filter = dark ? 'brightness(' + (1 - dark * 0.55) + ') saturate(' + (1 - dark * 0.35) + ')' : '';
}

/* ---------- Рендер ---------- */

function render() {
  const st = STAGES[cur];
  const learning = mode === 'learn';
  const mins = learning ? ((tm % 1440) + 1440) % 1440 : ((pMin % 720) + 720) % 720;

  const hAng = (mins % 720) / 720 * 360;
  const mAng = (mins % 60) * 6;
  const sAng = (mins % 1) * 360;

  S.hourHand.setAttribute('transform', 'rotate(' + hAng + ' ' + CX + ' ' + CY + ')');
  S.minHand.setAttribute('transform', 'rotate(' + mAng + ' ' + CX + ' ' + CY + ')');
  S.secHand.setAttribute('transform', 'rotate(' + sAng + ' ' + CX + ' ' + CY + ')');

  if (learning && st.time) {
    const readMins = ((( st.snap ? target : tm) % 1440) + 1440) % 1440;
    const h24 = Math.floor(readMins / 60) % 24;
    const m = Math.floor(readMins % 60);
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

    if (st.day) {
      ui.digital.textContent = String(h24).padStart(2, '0') + ':' + String(m).padStart(2, '0');
      ui.verbal.textContent = h12 + ':' + String(m).padStart(2, '0') + ' ' + partOfDay(h24) + ' — ' + sayTime(h24, m);
    } else {
      ui.digital.textContent = h12 + ':' + String(m).padStart(2, '0');
      ui.verbal.textContent = sayTime(h24, m);
    }

    if (st.day) setSky(h24);
  }

  /* У практиці показник відбиває те, що виставила дитина, а не відповідь */
  if (!learning && pTask && pTask.kind === 'set') {
    const h12 = Math.floor(mins / 60) === 0 ? 12 : Math.floor(mins / 60);
    ui.digital.textContent = h12 + ':' + String(Math.floor(mins % 60)).padStart(2, '0');
    ui.verbal.textContent = 'ти виставив(ла) так';
  }

  /* Сонце / місяць */
  if (learning && st.day) {
    const p = (mins - 360) / 720;
    if (p >= 0 && p <= 1) {
      S.sunBody.setAttribute('fill', '#ffd76a');
      S.sunGlow.setAttribute('fill', '#ffd76a');
      place(S.sunInner, 80 + p * 740, 165 - Math.sin(p * Math.PI) * 118);
    } else {
      const q = (((mins + 720) % 1440) - 360) / 720;
      S.sunBody.setAttribute('fill', '#eef3ff');
      S.sunGlow.setAttribute('fill', '#c9d8ff');
      place(S.sunInner, 80 + q * 740, 165 - Math.sin(q * Math.PI) * 118);
    }
  }

  /* Хмари пливуть */
  S.cloudShapes.forEach((c, i) => {
    const x = ((c.x + T * (7 + i * 3)) % 1010) - 55;
    c.node.setAttribute('transform', 'translate(' + x + ' ' + c.y + ') scale(' + c.s + ')');
  });

  /* Відвідувачі гуляють доріжками */
  S.peeps.forEach(p => {
    const u = (p.t + T * p.speed) % 1;
    const d = -3.2 + u * 6.4;
    const [x, y] = p.axis ? iso(d, 0) : iso(0, d);
    const bob = Math.abs(Math.sin(T * 6 + p.t * 9)) * 2.4;
    p.node.setAttribute('transform', 'translate(' + x + ' ' + (y - bob) + ')');
  });
}

function place(node, x, y) { node.setAttribute('transform', 'translate(' + (x - 120) + ' ' + (y - 120) + ')'); }

/* ---------- Цикл анімації ---------- */

function frame(ts) {
  if (!last) last = ts;
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  T += dt;

  const st = STAGES[cur];

  if (playing && mode === 'learn') {
    stageT += dt * 1000 * speed;

    if (st.rate) {
      const r = st.rate * speed;
      if (st.snap) {
        acc += dt * r;
        while (acc >= st.snap) {
          acc -= st.snap;
          target += st.snap;
          // Цокаємо лише там, де крок не частіший за пів секунди,
          // інакше на дрібних хвилинах це перетворюється на тріскотіння.
          if (st.snap / r >= 0.5) { tickFlip = !tickFlip; tickFlip ? SFX.tick() : SFX.tock(); }
        }
      } else {
        target += dt * r;
      }
      if (target > 2880) { target -= 1440; tm -= 1440; }
    }

    if (stageT > st.hold) {
      if (cur < STAGES.length - 1) { goTo(cur + 1); }
      else { setPlaying(false); stageT = 0; }
    }
  }

  if (mode === 'learn') {
    const k = st.snap ? 9 : 22;
    tm += (target - tm) * (1 - Math.exp(-dt * k));
  }

  render();
  requestAnimationFrame(frame);
}

/* ---------- Керування ---------- */

ui.play.addEventListener('click', () => setPlaying(!playing));
ui.prev.addEventListener('click', () => goTo(cur - 1));
ui.next.addEventListener('click', () => goTo(cur + 1));
ui.reset.addEventListener('click', () => { goTo(0); setPlaying(false); });

document.querySelectorAll('[data-speed]').forEach(b => {
  b.addEventListener('click', () => {
    speed = parseFloat(b.dataset.speed);
    document.querySelectorAll('[data-speed]').forEach(o => o.classList.toggle('is-active', o === b));
  });
});

ui.focus.addEventListener('change', () => { focusOn = ui.focus.checked; applyFocus(); });

document.addEventListener('keydown', e => {
  if (mode !== 'learn') return;
  if (e.target.matches('input, textarea')) return;
  if (e.key === 'ArrowRight') { goTo(cur + 1); e.preventDefault(); }
  else if (e.key === 'ArrowLeft') { goTo(cur - 1); e.preventDefault(); }
  else if (e.code === 'Space') { setPlaying(!playing); e.preventDefault(); }
  else if (e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') { goTo(0); setPlaying(false); }
});

/* ============================================================
   ПРАКТИКА
   ============================================================ */

const LEVELS = [
  { name: 'Цілі години',   mins: [0],                snap: 60,
    tip: 'Довга стрілка завжди дивиться рівно на 12.' },
  { name: 'Пів години',    mins: [0, 30],            snap: 30,
    tip: 'Довга стрілка або на 12, або на 6. Пів — це 30 хвилин, не 50.' },
  { name: 'Чверті',        mins: [0, 15, 30, 45],    snap: 15,
    tip: 'На 3 — чверть минула, на 9 — чверть лишилася до наступної години.' },
  { name: 'П’ятірками',    mins: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], snap: 5,
    tip: 'Дивись, на яке число вказує довга стрілка, і рахуй п’ятірками.' },
  { name: 'Точні хвилини', mins: Array.from({ length: 60 }, (_, i) => i), snap: 1,
    tip: 'Спершу знайди найближче число, потім дорахуй дрібні риски.' }
];

const ROUND = 5;          // питань у раунді
const PASS = 4;           // скільки треба, щоб відкрити наступний рівень
const STORE = 'chasopark.progress.v1';

const BADGES = [
  { id: 'builder',  ico: '🏗️', nm: 'Будівничий', test: p => p.seen.length >= STAGES.length },
  { id: 'sharp',    ico: '🎯', nm: 'Влучний',    test: p => p.totals.bestStreak >= 5 },
  { id: 'fire',     ico: '🔥', nm: 'Вогонь',     test: p => p.totals.bestStreak >= 10 },
  { id: 'explorer', ico: '🧭', nm: 'Мандрівник', test: p => p.unlocked >= LEVELS.length - 1 },
  { id: 'starman',  ico: '🌟', nm: 'Зіркар',     test: p => p.levels.reduce((s, l) => s + l.stars, 0) >= 15 },
  { id: 'owl',      ico: '🦉', nm: 'Нічна сова', test: p => p.seen.includes(STAGES.length - 1) }
];

const pUI = {
  chip: $('pChip'), name: $('pName'), levels: $('levels'), dots: $('qDots'),
  text: $('qText'), opts: $('qOpts'), fb: $('qFb'), tip: $('pTip'),
  stats: $('pStats'), reset: $('btnResetProgress'),
  check: $('pCheck'), dunno: $('pDunno'), next: $('pNext'),
  setLearn: $('ctrlLearn'), setPractice: $('ctrlPractice'),
  panelLearn: $('panelLearn'), panelPractice: $('panelPractice'),
  btnLearn: $('modeLearn'), btnPractice: $('modePractice'),
  streak: $('pStreak'), stars: $('pStars'), acc: $('pAcc'),
  xpFill: $('xpFill'), xpLabel: $('xpLabel'),
  badges: $('badgesRow'), welcome: $('welcome'),
  wLearn: $('wLearn'), wPlay: $('wPlay')
};

const blankProgress = () => ({
  v: 1,
  unlocked: 0,
  level: 0,
  levels: LEVELS.map(() => ({ stars: 0, best: 0 })),
  seen: [],
  badges: [],
  welcomed: false,
  totals: { asked: 0, right: 0, streak: 0, bestStreak: 0 }
});

/* localStorage може кинути виняток (приватний режим, заблоковані дані сайту)
   або містити дані старої версії — у всіх випадках просто працюємо без збереження. */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || p.v !== 1 || !Array.isArray(p.levels) || p.levels.length !== LEVELS.length) return null;
    if (!p.totals || !Array.isArray(p.seen)) return null;
    // Поля, доданих пізніше, у старих записах немає — дописуємо їх,
    // а не викидаємо весь прогрес дитини.
    if (!Array.isArray(p.badges)) p.badges = [];
    if (typeof p.welcomed !== 'boolean') p.welcomed = true;
    return p;
  } catch (e) { return null; }
}
function saveProgress() {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch (e) { /* просто не зберігаємо */ }
}

let progress = loadProgress() || blankProgress();
let pLevel = Math.min(progress.level || 0, progress.unlocked);
let pTask = null;          // поточне питання
let pRound = [];           // результати раунду
let pAnswered = false;
let pMin = 540;            // те, що показує циферблат у практиці (0..719)
let pRaw = 540;            // необроблений кут перетягування

const pad = n => String(n).padStart(2, '0');
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const digital = (h, m) => h + ':' + pad(m);
const norm12 = h => ((h - 1 + 12) % 12) + 1;

/* ---------- Генерація питань ---------- */

/** Відволікачі будуються з реальних дитячих помилок, а не навмання. */
function readOptions(h, m) {
  const seen = new Map();
  const add = (hh, mm) => {
    hh = norm12(hh); mm = ((mm % 60) + 60) % 60;
    const key = digital(hh, mm);
    if (!seen.has(key)) seen.set(key, { h: hh, m: mm, label: key });
  };

  add(h, m);                                        // правильна
  if (m > 30) add(h + 1, m);                        // годинна вже біля наступного числа
  if (m % 5 === 0) add(m === 0 ? 12 : m / 5, (h % 12) * 5);  // стрілки переплутані
  if (m === 30) add(h, 50);                         // «пів» прочитане як 50
  if (m === 15) add(h, 3);                          // число прочитане буквально
  if (m === 45) add(h, 9);
  for (let d = 5; seen.size < 4 && d < 60; d += 5) add(h, m + d);
  for (let d = 1; seen.size < 4; d++) add(h, m + d);

  return [...seen.values()].slice(0, 4);
}

function sayOptions(h, m) {
  const seen = new Map();
  const add = s => { if (s && !seen.has(s)) seen.set(s, { label: s }); };
  const cur = h % 12, next = (h + 1) % 12;

  add(sayTime(h, m));                               // правильна
  if (m === 15) add('за чверть ' + ORD_NOM[next]);  // плутанина «на» / «за»
  if (m === 45) add('чверть на ' + ORD_ACC[next]);
  if (m === 30) add('пів на ' + ORD_ACC[cur]);      // пів на поточну замість наступної
  if (m === 0)  add('рівно ' + ORD_NOM[next]);
  add(sayTime(h + 1, m));
  add(sayTime(h, (m + 30) % 60));
  add(sayTime(h, (m + 15) % 60));
  for (let d = 1; seen.size < 4 && d < 60; d++) add(sayTime(h, (m + d) % 60));

  return [...seen.values()].slice(0, 4);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function newTask() {
  const L = LEVELS[pLevel];
  const h = 1 + rnd(12);
  const m = pick(L.mins);
  const kind = pick(['read', 'say', 'set']);

  pTask = { h, m, kind, total: (h % 12) * 60 + m };
  pAnswered = false;

  if (kind === 'set') {
    // Стрілки стартують не з відповіді — інакше нічого робити.
    const start = ((h % 12) * 60 + m + 150 + rnd(300)) % 720;
    pRaw = pMin = (Math.round(start / L.snap) * L.snap) % 720;
  } else {
    pRaw = pMin = pTask.total;
  }

  renderTask();
  render();
}

/* ---------- Відображення ---------- */

function renderTask() {
  const t = pTask;
  pUI.fb.hidden = true;
  pUI.next.hidden = true;
  pUI.dunno.hidden = false;
  pUI.check.hidden = t.kind !== 'set';
  grab.style.display = t.kind === 'set' ? '' : 'none';
  ui.readout.hidden = t.kind !== 'set';

  pUI.opts.className = 'opts' + (t.kind === 'say' ? ' wordy' : '');
  pUI.opts.innerHTML = '';

  if (t.kind === 'set') {
    pUI.text.innerHTML = 'Постав стрілки на <span class="target">' + digital(t.h, t.m) + '</span>' +
      '<br><span style="font-weight:400;font-size:14px;color:#5b6b77">Тягни довгу стрілку за краєм циферблата, коротку — біля центру.</span>';
    return;
  }

  const opts = shuffle(t.kind === 'read' ? readOptions(t.h, t.m) : sayOptions(t.h, t.m));
  pUI.text.textContent = t.kind === 'read'
    ? 'Котра година на вежі?'
    : 'Як сказати цей час українською?';

  opts.forEach(o => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.type = 'button';
    b.textContent = o.label;
    b.addEventListener('click', () => choose(o, b));
    pUI.opts.appendChild(b);
  });
}

function correctLabel(t) {
  return t.kind === 'say' ? sayTime(t.h, t.m) : digital(t.h, t.m);
}

/** Пояснення прив'язане саме до тієї плутанини, яку припустила дитина. */
function explain(t, chosen) {
  const right = digital(t.h, t.m) + ' — ' + sayTime(t.h, t.m);

  if (t.kind === 'read' && chosen) {
    if (chosen.h === norm12(t.h + 1) && chosen.m === t.m && t.m > 30)
      return 'Коротка стрілка вже майже дійшла до ' + norm12(t.h + 1) +
             ', але година ще ' + t.h + '-та: читаємо те число, яке вона <b>вже пройшла</b>. Правильно: ' + right;
    // Обидві половинки мають збігтися, інакше 3:03 хибно зарахується як «свап»
    if (t.m % 5 === 0 && chosen.h === (t.m === 0 ? 12 : t.m / 5) && chosen.m === (t.h % 12) * 5)
      return 'Стрілки переплутані. Коротка й товста — години, довга й тонка — хвилини. Правильно: ' + right;
    if (t.m === 30 && chosen.m === 50)
      return 'Пів години — це <b>30</b> хвилин, а не 50: коло ділиться на 60, а не на 100. Правильно: ' + right;
    if (t.m === 15 && chosen.m === 3)
      return 'Число 3 для довгої стрілки означає не 3 хвилини, а <b>15</b>: рахуй п’ятірками. Правильно: ' + right;
  }

  if (t.kind === 'say' && chosen) {
    if (t.m === 45 && chosen.label.startsWith('чверть на'))
      return 'Коли чверть уже <b>лишилася</b>, кажуть «за чверть» і називають годину, яка тільки настане. Правильно: ' + right;
    if (t.m === 15 && chosen.label.startsWith('за чверть'))
      return 'Коли чверть уже <b>минула</b>, кажуть «чверть на». Правильно: ' + right;
    if (t.m === 30 && chosen.label.startsWith('пів на'))
      return 'Пів на — це рух до <b>наступної</b> години. Правильно: ' + right;
  }

  return 'Правильна відповідь: ' + right;
}

function feedback(ok, html, title) {
  pUI.fb.hidden = false;
  pUI.fb.className = 'fb' + (ok ? '' : ' bad');
  pUI.fb.innerHTML = '<b>' + (title || (ok ? '✅ Правильно!' : '❌ Не зовсім')) + '</b>' + html;
}

function finishTask(ok, srcEl) {
  if (pAnswered) return;
  pAnswered = true;

  if (ok) {
    SFX.correct();
    FX.buzz(28);
    popover(anyOf(PRAISE));
    say(anyOf(PRAISE_SAY), 'cheer', 2400);
    if (srcEl) FX.fromElement(srcEl, 22); else FX.cheer(2);
  } else {
    SFX.wrong();
    FX.buzz([26, 60, 26]);
    popover(anyOf(CHEER_UP), true);
    say(anyOf(CHEER_SAY), 'oops', 2400);
  }

  pRound.push(ok);
  progress.totals.asked++;
  if (ok) {
    progress.totals.right++;
    progress.totals.streak++;
    progress.totals.bestStreak = Math.max(progress.totals.bestStreak, progress.totals.streak);
  } else {
    progress.totals.streak = 0;
  }
  saveProgress();

  pUI.dunno.hidden = true;
  pUI.check.hidden = true;
  pUI.next.hidden = false;
  pUI.next.textContent = pRound.length >= ROUND ? 'Підсумок ➜' : 'Далі ➜';
  grab.style.display = 'none';

  renderDots();
  renderStats();
  awardBadges();
}

function choose(o, btn) {
  if (pAnswered) return;
  const ok = o.label === correctLabel(pTask);

  [...pUI.opts.children].forEach(b => {
    b.disabled = true;
    if (b.textContent === correctLabel(pTask)) b.classList.add('right');
    else if (b === btn) b.classList.add('wrong');
    else b.classList.add('faded');
  });

  feedback(ok, ok ? ' ' + digital(pTask.h, pTask.m) + ' — ' + sayTime(pTask.h, pTask.m)
                  : ' ' + explain(pTask, o));
  finishTask(ok, ok ? btn : null);
}

function checkHands() {
  if (pAnswered || !pTask || pTask.kind !== 'set') return;
  const ok = Math.round(pMin) % 720 === pTask.total;
  if (ok) {
    feedback(true, ' Стрілки стоять правильно: ' + sayTime(pTask.h, pTask.m) + '.');
  } else {
    const got = Math.round(pMin) % 720;
    const gh = Math.floor(got / 60) === 0 ? 12 : Math.floor(got / 60);
    feedback(false, ' Ти поставив(ла) ' + digital(gh, got % 60) +
      ', а треба ' + digital(pTask.h, pTask.m) + ' — ' + sayTime(pTask.h, pTask.m) + '.');
    pRaw = pMin = pTask.total;   // показуємо правильне положення
    render();
  }
  finishTask(ok);
}

function giveUp() {
  if (pAnswered) return;
  if (pTask.kind === 'set') { pRaw = pMin = pTask.total; render(); }
  else [...pUI.opts.children].forEach(b => {
    b.disabled = true;
    b.classList.add(b.textContent === correctLabel(pTask) ? 'right' : 'faded');
  });
  feedback(false, ' ' + explain(pTask, null));
  finishTask(false);
}

function nextTask() {
  if (pRound.length >= ROUND) finishRound();
  else newTask();
}

function finishRound() {
  const right = pRound.filter(Boolean).length;
  const stars = right >= 5 ? 3 : right >= 4 ? 2 : right >= 3 ? 1 : 0;
  const rec = progress.levels[pLevel];
  rec.stars = Math.max(rec.stars, stars);
  rec.best = Math.max(rec.best, right);

  let unlockedNow = false;
  if (right >= PASS && pLevel === progress.unlocked && pLevel < LEVELS.length - 1) {
    progress.unlocked = pLevel + 1;
    unlockedNow = true;
  }
  saveProgress();

  pUI.opts.innerHTML = '';
  pUI.check.hidden = true;
  pUI.dunno.hidden = true;
  pUI.next.hidden = false;
  pUI.next.textContent = 'Ще раунд ➜';
  grab.style.display = 'none';
  ui.readout.hidden = true;

  pUI.text.textContent = 'Раунд завершено: ' + right + ' із ' + ROUND;
  feedback(right >= PASS,
    ' ' + '★'.repeat(stars) + '☆'.repeat(3 - stars) +
    (unlockedNow ? ' — відкрито рівень «' + LEVELS[pLevel + 1].name + '»!'
     : right >= PASS ? ' — чудова робота!'
     : ' — потрібно ' + PASS + ' правильних, щоб рухатись далі. Спробуй ще раз.'),
    right >= PASS ? '🎉 Раунд завершено' : '💪 Раунд завершено');

  if (right >= PASS) {
    SFX.level();
    FX.cheer(6);
    FX.buzz([30, 50, 30, 50, 80]);
    popover(unlockedNow ? '🎉 Новий рівень!' : '⭐'.repeat(Math.max(1, stars)));
    say(unlockedNow ? 'Рівень «' + LEVELS[pLevel + 1].name + '» відкрито! Спробуємо?'
                    : 'Раунд пройдено! Хочеш ще?', 'cheer', 3200);
  } else {
    SFX.star();
    say('Ще один раунд — і рівень буде наш. Я поруч!', 'happy', 2600);
  }

  pRound = [];
  renderLevels();
  renderDots();
  renderStats();
  awardBadges();
}

function renderDots() {
  pUI.dots.innerHTML = '';
  for (let i = 0; i < ROUND; i++) {
    const d = document.createElement('span');
    d.className = 'qdot' + (i < pRound.length ? (pRound[i] ? ' right' : ' wrong')
                            : i === pRound.length ? ' now' : '');
    pUI.dots.appendChild(d);
  }
}

function renderLevels() {
  pUI.levels.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const locked = i > progress.unlocked;
    const st = progress.levels[i];
    const b = document.createElement('button');
    b.className = 'level-btn' + (i === pLevel ? ' is-active' : '');
    b.type = 'button';
    b.disabled = locked;
    b.innerHTML = (locked ? '🔒 ' : '') + L.name +
      ' <span class="stars">' + '★'.repeat(st.stars) + '☆'.repeat(3 - st.stars) + '</span>';
    b.addEventListener('click', () => { pLevel = i; progress.level = i; saveProgress(); startLevel(); });
    pUI.levels.appendChild(b);
  });
  pUI.chip.textContent = 'Рівень ' + (pLevel + 1) + ' / ' + LEVELS.length;
  pUI.name.textContent = LEVELS[pLevel].name;
  pUI.tip.textContent = LEVELS[pLevel].tip;
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 260);
}

function renderScore() {
  const t = progress.totals;
  const totalStars = progress.levels.reduce((s, l) => s + l.stars, 0);
  const pct = t.asked ? Math.round(t.right / t.asked * 100) + '%' : '—';

  const set = (pill, val) => {
    const b = pill.querySelector('b');
    if (b.textContent !== String(val)) { b.textContent = val; bump(pill); }
  };
  set(pUI.streak, t.streak);
  set(pUI.stars, totalStars);
  set(pUI.acc, pct);

  const maxStars = LEVELS.length * 3;
  pUI.xpFill.style.width = Math.round(totalStars / maxStars * 100) + '%';
  pUI.xpLabel.textContent = totalStars === maxStars
    ? 'Усі зірки твої! 🏆'
    : totalStars + ' / ' + maxStars + ' ⭐';
}

function renderBadges(justEarned) {
  pUI.badges.innerHTML = '';
  BADGES.forEach(b => {
    const got = progress.badges.includes(b.id);
    const d = document.createElement('div');
    d.className = 'badge-item' + (got ? ' earned' : '') +
                  (justEarned && justEarned.includes(b.id) ? ' just' : '');
    d.title = b.nm + (got ? ' — здобуто!' : ' — ще попереду');
    d.innerHTML = '<span class="ico">' + b.ico + '</span><span class="nm">' + b.nm + '</span>';
    pUI.badges.appendChild(d);
  });
}

/** Нові значки святкуємо окремо — це найсильніша нагорода в грі. */
function awardBadges() {
  const fresh = BADGES.filter(b => !progress.badges.includes(b.id) && b.test(progress))
                      .map(b => b.id);
  if (!fresh.length) return;

  progress.badges.push(...fresh);
  saveProgress();
  renderBadges(fresh);

  const b = BADGES.find(x => x.id === fresh[0]);
  setTimeout(() => {
    SFX.badge();
    FX.cheer(4);
    FX.buzz([30, 40, 30, 40, 60]);
    popover(b.ico + ' ' + b.nm);
    say('Новий значок: «' + b.nm + '»! Ти крутий.', 'cheer', 3000);
  }, 700);
}

function renderStats() {
  renderScore();
  const t = progress.totals;
  const pct = t.asked ? Math.round(t.right / t.asked * 100) : 0;
  const totalStars = progress.levels.reduce((s, l) => s + l.stars, 0);
  pUI.stats.innerHTML =
    'Етапів уроку переглянуто: <b>' + progress.seen.length + ' / ' + STAGES.length + '</b><br>' +
    'Відповідей: <b>' + t.asked + '</b>, правильних: <b>' + t.right + '</b> (' + pct + '%)<br>' +
    'Найкраща серія поспіль: <b>' + t.bestStreak + '</b><br>' +
    'Зірок зібрано: <b>' + totalStars + ' / ' + LEVELS.length * 3 + '</b>';
}

function startLevel() {
  pRound = [];
  renderLevels();
  renderDots();
  renderStats();
  renderBadges();
  newTask();
}

/* ---------- Перетягування стрілок ---------- */

function toSvg(evt) {
  const pt = scene.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  return pt.matrixTransform(scene.getScreenCTM().inverse());
}
const angOf = (dx, dy) => (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
const angDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

let dragMode = null, lastAng = 0;

grab.addEventListener('pointerdown', e => {
  if (mode !== 'practice' || !pTask || pTask.kind !== 'set' || pAnswered) return;
  const p = toSvg(e), dx = p.x - CX, dy = p.y - CY, r = Math.hypot(dx, dy);
  if (r > R + 8) return;

  const a = angOf(dx, dy);
  // Довга стрілка проходить і через зону короткої, тож самого радіуса замало:
  // ближче до центру вибираємо ту стрілку, до якої дитина справді потрапила.
  const hourA = (pMin % 720) / 720 * 360;
  const minA = (pMin % 60) * 6;
  dragMode = r > 56 ? 'min'
           : (angDist(a, hourA) <= angDist(a, minA) ? 'hour' : 'min');
  lastAng = a;
  try { grab.setPointerCapture(e.pointerId); } catch (err) { /* не критично */ }
  grab.classList.add('dragging');
  e.preventDefault();
});

grab.addEventListener('pointermove', e => {
  if (!dragMode) return;
  const p = toSvg(e), a = angOf(p.x - CX, p.y - CY);

  if (dragMode === 'min') {
    // Накопичуємо різницю кута, тож обертання переносить години —
    // як під час заведення справжнього годинника.
    let d = a - lastAng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    pRaw = (pRaw + d / 6 + 720) % 720;
    lastAng = a;
  } else {
    const m = pRaw % 60;
    const hh = Math.round((a - m * 0.5) / 30);
    pRaw = (((hh % 12) + 12) % 12) * 60 + m;
  }

  // Під час перетягування стрілка йде за пальцем із кроком у хвилину.
  // Якби тут застосовувався крок рівня (30 або навіть 60 хвилин),
  // стрілка здавалася б намертво застряглою.
  const before = pMin;
  pMin = Math.round(pRaw) % 720;
  // Клацання на кожній перейденій хвилині — стрілка відчувається «зубчастою»
  if (pMin !== before) { SFX.notch(); FX.buzz(6); }
  render();
});

/* Слухаємо на вікні, а не на колі: якщо захоплення вказівника не спрацювало,
   палець може відірватись поза циферблатом — і перетягування зависло б. */
['pointerup', 'pointercancel'].forEach(ev =>
  window.addEventListener(ev, () => {
    if (!dragMode) return;
    dragMode = null;
    grab.classList.remove('dragging');
    // Прилипання до кроку рівня — уже після того, як дитина відпустила стрілку.
    const snap = LEVELS[pLevel].snap;
    pRaw = pMin = (Math.round(pMin / snap) * snap) % 720;
    render();
  }));

/* ---------- Перемикання режимів ---------- */

/** У практиці годинник має бути повним: без секундної стрілки,
    без секторів чвертей і без приглушення деталей. */
function practiceReveal() {
  const all = new Set(Object.keys(parts));
  ['fSec', 'fQuarters', 'sun'].forEach(id => all.delete(id));
  applyRevealSet(all);
  S.face.classList.remove('focus');
  FACE_IDS.forEach(id => {
    const p = parts[id];
    if (p) { p.el.classList.remove('dim'); p.el.classList.remove('pulse'); }
  });
}

function setMode(m) {
  mode = m;
  const learning = m === 'learn';

  pUI.btnLearn.classList.toggle('is-active', learning);
  pUI.btnPractice.classList.toggle('is-active', !learning);
  pUI.btnLearn.setAttribute('aria-selected', String(learning));
  pUI.btnPractice.setAttribute('aria-selected', String(!learning));

  pUI.panelLearn.hidden = !learning;
  pUI.panelPractice.hidden = learning;
  pUI.setLearn.hidden = !learning;
  pUI.setPractice.hidden = learning;
  ui.rail.hidden = !learning;
  ui.badge.hidden = !learning;

  fitScene();

  if (learning) {
    grab.style.display = 'none';
    goTo(cur);
  } else {
    setPlaying(false);
    setSky(12);
    practiceReveal();
    ui.readout.hidden = true;
    startLevel();
    say('Час гри! Обери відповідь або покрути стрілки.', 'happy', 2200);
  }
}

/* ---------- Привітання під час першого запуску ---------- */

function closeWelcome(target) {
  pUI.welcome.hidden = true;
  progress.welcomed = true;
  saveProgress();
  SFX.unlock();
  SFX.level();
  setMode(target);
}
pUI.wLearn.addEventListener('click', () => closeWelcome('learn'));
pUI.wPlay.addEventListener('click', () => closeWelcome('practice'));

pUI.btnLearn.addEventListener('click', () => setMode('learn'));
pUI.btnPractice.addEventListener('click', () => setMode('practice'));
pUI.check.addEventListener('click', checkHands);
pUI.dunno.addEventListener('click', giveUp);
pUI.next.addEventListener('click', nextTask);
pUI.reset.addEventListener('click', () => {
  if (!confirm('Скинути весь прогрес — зірки, рівні та статистику?')) return;
  progress = blankProgress();
  progress.welcomed = true;
  pLevel = 0;
  saveProgress();
  startLevel();
  say('Починаємо з чистого аркуша!', 'happy', 2000);
});

/* На вузьких екранах підводимо «камеру» ближче до вежі,
   інакше циферблат стискається до нечитабельних 60 px. */
function fitViewBox() {
  // У практиці парк — лише тло: підводимо камеру впритул до циферблата,
  // інакше стрілку неможливо схопити пальцем.
  if (mode === 'practice') { scene.setAttribute('viewBox', '300 80 300 226'); return; }

  const w = window.innerWidth, h = window.innerHeight;
  // Тільки для портретних вузьких екранів: у низькому альбомному вікні
  // висока рамка витягла б сцену під панель керування.
  const portrait = w < 640 && h > w * 1.15;
  scene.setAttribute('viewBox', portrait ? '240 0 420 500' : '0 0 900 620');
}

/* Зміна рамки міняє висоту сцени, а події resize при цьому не буде —
   тож шар конфеті доводиться переміряти вручну, вже після перерахунку. */
function fitScene() {
  fitViewBox();
  requestAnimationFrame(() => FX.resize());
}
window.addEventListener('resize', fitViewBox);
fitViewBox();

/* ---------- Старт ---------- */

applyReveal(-1);
goTo(0);
renderBadges();
setPlaying(true);
requestAnimationFrame(frame);

if (!progress.welcomed) pUI.welcome.hidden = false;
