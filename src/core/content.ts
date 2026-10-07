/* Навчальний зміст: етапи уроку, рівні, значки, атракціони парку на планеті. */

import type { AdventureId, Progress } from './progress';

export type { AdventureId };

export interface Stage {
  chip: string; title: string; desc: string; idea: string; warn: string; todo: string;
  show: string[]; focus?: string[]; pulse?: string;
  rate: number; snap: number; start: number; hold: number; time: boolean; day?: boolean;
}

export const STAGES: Stage[] = [
  {
    chip: 'Будівництво',
    title: 'Місце для вежі',
    desc: 'Тік прилетів на маленьку планету. Тут ніхто не знає, що таке час. Будуємо годинникову вежу.',
    idea: 'Годинник — це коло. Стрілки ходять по ньому завжди в один бік. Цей бік звуть «за годинниковою стрілкою».',
    warn: 'Веди пальцем тільки в цей бік: від 12 праворуч і вниз.',
    todo: 'Намалюй пальцем у повітрі велике коло. Почни згори, від 12, і веди праворуч.',
    show: ['sky', 'clouds', 'ground', 'shadow', 'plinth'],
    rate: 0, snap: 0, start: 540, hold: 6000, time: false
  },
  {
    chip: 'Будівництво',
    title: 'Вежа росте',
    desc: 'Вежа росте вгору. Жителі планети прийшли подивитися.',
    idea: 'Усередині годинника є колеса. Вони крутять обидві стрілки разом.',
    warn: 'Рухається одна стрілка, рухається й друга. Тільки повільніше.',
    todo: 'Порахуй поверхи вежі. Як думаєш, де буде циферблат?',
    show: ['shaft', 'housing', 'roof', 'banner', 'scenery', 'peeps'],
    rate: 0, snap: 0, start: 540, hold: 6000, time: false
  },
  {
    chip: 'Циферблат',
    title: 'Циферблат і числа 1–12',
    desc: 'Ставимо циферблат. Це коло з числами від 1 до 12.',
    idea: '12 угорі, 6 унизу. 3 праворуч, 9 ліворуч. Від числа до числа — одна година.',
    warn: 'Спершу знайди 12, 3, 6 і 9. Решта чисел стоїть між ними.',
    todo: 'Заплющ очі. Яке число навпроти 12? А навпроти 4?',
    show: ['fDial', 'fTicksHour', 'fNumsHour', 'fHub'],
    focus: ['fDial', 'fTicksHour', 'fNumsHour', 'fHub'],
    rate: 0, snap: 0, start: 540, hold: 6500, time: false
  },
  {
    chip: 'Стрілки',
    title: 'Коротка стрілка — години',
    desc: 'Ставимо коротку товсту стрілку. Вона ходить дуже повільно.',
    idea: 'Коротка стрілка показує години. Читай число, яке вона вже пройшла.',
    warn: 'Не плутай стрілки. Коротка показує години, довга — хвилини.',
    todo: 'Стрілка між 4 і 5. Котра година: четверта чи п’ята?',
    show: ['fHour'],
    focus: ['fHour', 'fNumsHour', 'fHub'], pulse: 'fHour',
    rate: 60, snap: 60, start: 720, hold: 13000, time: true
  },
  {
    chip: 'Стрілки',
    title: 'Довга стрілка — хвилини',
    desc: 'Ставимо довгу тонку стрілку. Вона показує хвилини.',
    idea: 'Довга стрілка проходить ціле коло за годину. Коротка за цей час проходить одне число.',
    warn: 'О 3:45 коротка стрілка майже на 4. Але година ще третя.',
    todo: 'Дивись на коротку стрілку, поки довга йде по колу. Бачиш, як вона повзе?',
    show: ['fMin'],
    focus: ['fMin', 'fHour', 'fHub'], pulse: 'fMin',
    rate: 30, snap: 0, start: 540, hold: 13000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Пів години',
    desc: 'Довга стрілка внизу, на 6. Вона пройшла пів кола.',
    idea: 'Пів кола — це 30 хвилин. Коротка стрілка тоді посередині між числами.',
    warn: 'Пів години — це 30 хвилин. У годині 60 хвилин, тому не 50.',
    todo: 'Про 3:30 кажуть «пів на четверту». Як думаєш, чому на четверту?',
    show: [],
    focus: ['fMin', 'fHour', 'fNumsHour', 'fHub'],
    rate: 20, snap: 30, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Чверть години',
    desc: 'Ділимо коло на 4 частини. Кожна частина — чверть.',
    idea: 'Чверть — це 15 хвилин. 3:15 — «чверть на четверту». 3:45 — «за чверть четверта».',
    warn: 'О 3:45 до четвертої лишилась чверть. Тому кажуть «за чверть четверта».',
    todo: 'Довга стрілка на 9, коротка майже на 7. Котра година?',
    show: ['fQuarters'],
    focus: ['fMin', 'fHour', 'fQuarters', 'fHub'],
    rate: 12, snap: 15, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Лічба п’ятірками',
    desc: 'Біля чисел з’являються сині підписи. Це хвилини.',
    idea: 'Для довгої стрілки 1 — це 5 хвилин, 2 — це 10. Рахуй п’ятірками: 5, 10, 15, 20…',
    warn: 'Чорні числа — для короткої стрілки. Сині — для довгої.',
    todo: 'Довга стрілка на 8. Скільки це хвилин? Рахуй п’ятірками вголос.',
    show: ['fNumsMin'],
    focus: ['fMin', 'fNumsMin', 'fHub'], pulse: 'fNumsMin',
    rate: 6, snap: 5, start: 540, hold: 13000, time: true
  },
  {
    chip: 'Читання часу',
    title: 'Маленькі поділки',
    desc: 'Між числами з’являються маленькі риски. Їх 60.',
    idea: 'Одна риска — одна хвилина. Між сусідніми числами 5 рисок.',
    warn: 'Спершу знайди найближче число. Потім дорахуй риски.',
    todo: 'Довга стрілка на 2 риски після 4. Скільки хвилин? (20 і ще 2)',
    show: ['fTicksMin'],
    focus: ['fMin', 'fTicksMin', 'fHub'], pulse: 'fTicksMin',
    rate: 4, snap: 1, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Секунди',
    title: 'Секундна стрілка',
    desc: 'Ось найтонша стрілка. Вона найшвидша.',
    idea: 'Секундна стрілка проходить коло за одну хвилину. Це 60 секунд.',
    warn: 'Секундна теж довга. Шукай тонку помаранчеву стрілку.',
    todo: 'Рахуй уголос до 60, поки помаранчева стрілка йде по колу.',
    show: ['fSec'],
    focus: ['fSec', 'fHub'], pulse: 'fSec',
    rate: 0.25, snap: 0, start: 540, hold: 12000, time: true
  },
  {
    chip: 'Доба',
    title: 'Ранок, день, вечір, ніч',
    desc: 'Планета крутиться: ранок, день, вечір, ніч. За добу коротка стрілка проходить коло двічі.',
    idea: 'Ранок і вечір на циферблаті однакові. 15:00 — це 3 година дня, бо 15 − 12 = 3.',
    warn: 'О 12 дня і о 12 ночі стрілки однакові. Дивись на небо: сонце чи зорі?',
    todo: 'Котра година буде на циферблаті о 19:00? А о 22:00?',
    show: ['sun'],
    focus: ['fHour', 'fMin', 'fNumsHour', 'fHub'],
    rate: 120, snap: 0, start: 300, hold: 15000, time: true, day: true
  }
];

/* Коротка репліка Тіка на кожен етап */
export const STAGE_SAY = [
  'Тут ніхто не знає, що таке час. Будуймо вежу! Обведи пальцем коло в один бік.',
  'Вежа росте! Усередині сховаються колеса для стрілок.',
  'Дивись: 12 угорі, 6 унизу, 3 праворуч, 9 ліворуч.',
  'Коротка стрілка показує години. Вона дуже повільна.',
  'Довга проходить ціле коло, а коротка лише одне число. Бачиш?',
  'Довга стрілка на 6. Це пів кола, 30 хвилин!',
  'Ділимо коло на 4 частини. Це чверті.',
  'Рахуємо п’ятірками: 5, 10, 15, 20…',
  'Кожна маленька риска — одна хвилина.',
  'Найшвидша стрілка! Рахуймо разом до 60.',
  'Ранок, день, вечір, ніч. Тепер жителі знають, що таке час!'
];

/* «Тепер ти!» — дія на 3D-вежі після пояснення етапу. null — етап без дії. */
export type TryKind = 'circle' | 'tap' | 'hour' | 'turn' | 'minute';
export interface TryDef { kind: TryKind; ask: string; ok: string; n?: number; m?: number; start: number }
export const TRIES: (TryDef | null)[] = [
  { kind: 'circle', start: 540, ask: 'Тепер ти! Обведи пальцем коло навколо вежі. Веди від 12 праворуч.', ok: 'Так! У цей бік ходять усі стрілки.' },
  null,
  { kind: 'tap', n: 6, start: 540, ask: 'Тепер ти! Торкнись на циферблаті числа 6.', ok: 'Так! Шість унизу, навпроти дванадцяти.' },
  { kind: 'hour', n: 3, start: 720, ask: 'Тепер ти! Потягни коротку стрілку на число 3.', ok: 'Так! Коротка стрілка на 3. Зараз третя година.' },
  { kind: 'turn', start: 540, ask: 'Тепер ти! Покрути довгу стрілку на ціле коло. Дивись на коротку.', ok: 'Бачиш? Довга пройшла коло, а коротка лише одне число.' },
  { kind: 'minute', m: 30, start: 540, ask: 'Тепер ти! Постав довгу стрілку на 6. Це пів кола.', ok: 'Так! Пів кола — це 30 хвилин.' },
  { kind: 'minute', m: 15, start: 540, ask: 'Тепер ти! Постав довгу стрілку на 3. Це чверть.', ok: 'Так! Чверть — це 15 хвилин.' },
  { kind: 'minute', m: 20, start: 540, ask: 'Тепер ти! Постав довгу стрілку на 20 хвилин. Рахуй п’ятірками.', ok: 'Так! Для довгої стрілки 4 — це 20 хвилин.' },
  { kind: 'minute', m: 7, start: 540, ask: 'Тепер ти! Постав довгу стрілку на 7 хвилин. Рахуй риски.', ok: 'Так! Сім рисок — сім хвилин.' },
  null,
  null
];
export const TRY_MISS: Record<TryKind, string> = {
  circle: 'Інший бік! Веди від 12 праворуч і вниз.',
  tap: 'Це інше число. Пошукай ще!',
  hour: 'Майже! Постав коротку стрілку точно на число.',
  turn: 'Крути далі, поки довга стрілка не пройде все коло.',
  minute: 'Майже! Глянь, куди показує довга стрілка.'
};

export const PRAISE = ['Клас!', 'Супер!', 'Точно!', 'Молодець!', 'Так тримати!', 'Вау!', 'Легко!'];
export const PRAISE_SAY = [
  'Так! Стрілки тебе слухаються.',
  'Правильно! Ти швидко вчишся.',
  'Так, усе вірно!',
  'Точно! Ідемо далі.'
];
export const CHEER_UP = ['Майже!', 'Ще трішки!', 'Буває!', 'Спробуймо ще!'];
export const CHEER_SAY = [
  'Нічого. Спробуй ще раз.',
  'Глянь на підказку і спробуй ще.',
  'Я теж колись плутав стрілки. Ще раз!',
  'Ще одна спроба, і вийде.'
];

export interface Level { name: string; short: string; mins: number[]; snap: number; tip: string }

export const LEVELS: Level[] = [
  { name: 'Цілі години', short: ':00', mins: [0], snap: 60,
    tip: 'Довга стрілка завжди на 12.' },
  { name: 'Пів години', short: ':30', mins: [0, 30], snap: 30,
    tip: 'Довга стрілка на 12 або на 6. Пів години — це 30 хвилин.' },
  { name: 'Чверті', short: ':15', mins: [0, 15, 30, 45], snap: 15,
    tip: 'Довга на 3: чверть минула. Довга на 9: до години лишилась чверть.' },
  { name: 'П’ятірками', short: ':05', mins: Array.from({ length: 12 }, (_, i) => i * 5), snap: 5,
    tip: 'Глянь, на яке число показує довга стрілка. Рахуй п’ятірками.' },
  { name: 'Точні хвилини', short: ':01', mins: Array.from({ length: 60 }, (_, i) => i), snap: 1,
    tip: 'Спершу знайди найближче число. Потім дорахуй риски.' }
];


export interface Adventure { id: AdventureId; ico: string; name: string; needs: number; tip: string }

/** Пригоди відкриваються разом із рівнями, на яких спираються. */
export const ADVENTURES: Adventure[] = [
  { id: 'routine', ico: '🗓️', name: 'Розпорядок дня', needs: 1,
    tip: 'О 7 ранку й о 7 вечора стрілки однакові. Дивись на небо!' },
  { id: 'elapsed', ico: '⏳', name: 'Скільки минуло?', needs: 3,
    tip: 'Крути довгу стрілку вперед. Пройшла 12 — настала нова година.' },
  { id: 'feel', ico: '⏱️', name: 'Скільки триває хвилина?', needs: 1,
    tip: 'Рахуй повільно: «двадцять один, двадцять два…». Одне число — це майже секунда.' },
  { id: 'faces', ico: '🕰️', name: 'Справжні годинники', needs: 2,
    tip: 'Тут немає кольорів. Коротка стрілка — години, довга — хвилини.' },
  { id: 'plan', ico: '📅', name: 'Плануємо день', needs: 4,
    tip: 'Спершу додай години, потім хвилини. 60 хвилин — це ще одна година.' }
];

export const ROUND = 5;
export const PASS = 4;

export const starsFor = (right: number): number => right >= 5 ? 3 : right >= 4 ? 2 : right >= 3 ? 1 : 0;

export const totalStars = (p: Progress): number =>
  p.levels.reduce((s, l) => s + l.stars, 0) + ADVENTURES.reduce((s, a) => s + p.adventures[a.id].stars, 0);

export const MAX_STARS = (LEVELS.length + ADVENTURES.length) * 3;

export interface Badge { id: string; ico: string; nm: string; hint: string; test: (p: Progress) => boolean }

export const BADGES: Badge[] = [
  { id: 'builder',  ico: '🏗️', nm: 'Будівничий', hint: 'Переглянь усі етапи уроку', test: p => p.seen.length >= STAGES.length },
  { id: 'sharp',    ico: '🎯', nm: 'Влучний',    hint: '5 правильних поспіль', test: p => p.totals.bestStreak >= 5 },
  { id: 'fire',     ico: '🔥', nm: 'Вогонь',     hint: '10 правильних поспіль', test: p => p.totals.bestStreak >= 10 },
  { id: 'explorer', ico: '🧭', nm: 'Мандрівник', hint: 'Відкрий усі рівні', test: p => p.unlocked >= LEVELS.length - 1 },
  { id: 'starman',  ico: '🌟', nm: 'Зіркар',     hint: 'Збери 15 зірок', test: p => totalStars(p) >= 15 },
  { id: 'owl',      ico: '🦉', nm: 'Нічна сова', hint: 'Переглянь етап про добу', test: p => p.seen.includes(STAGES.length - 1) },
  { id: 'fixer',    ico: '🩹', nm: 'Виправлялко', hint: 'Виправ 5 своїх помилок', test: p => p.totals.fixed >= 5 },
  { id: 'day',      ico: '🗓️', nm: 'Розпорядник', hint: 'Пройди «Розпорядок дня»', test: p => p.adventures.routine.stars >= 2 },
  { id: 'chrono',   ico: '⏳', nm: 'Хронометр',  hint: 'Пройди «Скільки минуло?»', test: p => p.adventures.elapsed.stars >= 2 },
  { id: 'feel',     ico: '⏱️', nm: 'Відчуваю час', hint: 'Пройди «Скільки триває хвилина?»', test: p => p.adventures.feel.stars >= 2 },
  { id: 'faces',    ico: '🕰️', nm: 'Годинникар', hint: 'Пройди «Справжні годинники»', test: p => p.adventures.faces.stars >= 2 },
  { id: 'planner',  ico: '📅', nm: 'Планувальник', hint: 'Пройди «Плануємо день»', test: p => p.adventures.plan.stars >= 2 },
  { id: 'daily',    ico: '🏠', nm: 'Щоденна хвилинка', hint: '3 дні поспіль звір час із годинником удома', test: p => p.daily.best >= 3 }
];

/* Парк росте разом із зірками — це «мета-нагорода», заради якої хочеться повертатися. */
export interface Attraction { id: string; ico: string; name: string; stars: number }

export const PARK: Attraction[] = [
  { id: 'carousel', ico: '🎠', name: 'Карусель',        stars: 2 },
  { id: 'fountain', ico: '⛲', name: 'Фонтан',          stars: 5 },
  { id: 'wheel',    ico: '🎡', name: 'Колесо огляду',   stars: 8 },
  { id: 'kiosk',    ico: '🍦', name: 'Кіоск морозива',  stars: 11 },
  { id: 'balloon',  ico: '🎈', name: 'Повітряна куля',  stars: 14 },
  { id: 'flags',    ico: '🎉', name: 'Святкові прапорці', stars: 18 }
];

/* Репліки Тіка з підставленими назвами: одне місце і для гри, і для збирача озвучки. */
export const parkLine = (name: string): string => 'Дивись! На планеті тепер є ' + name.toLowerCase() + '!';
export const badgeLine = (nm: string): string => 'Новий значок: «' + nm + '»! Ти молодець.';
export const unlockWhat = (level: string, adv?: string): string => adv ? level + '» і пригоду «' + adv : level;
export const unlockLine = (what: string): string => 'Відкрито «' + what + '»! Спробуємо?';
export const ROUND_PASS_SAY = 'Раунд пройдено! Хочеш ще?';
export const ROUND_FAIL_SAY = 'Ще один раунд, і вийде. Я поруч!';
export const VOICE_ON_SAY = 'Тепер я говорю вголос!';
export const RESET_SAY = 'Починаємо спочатку!';

export const parkUnlocked = (stars: number): Attraction[] => PARK.filter(a => stars >= a.stars);
export const nextAttraction = (stars: number): Attraction | undefined => PARK.find(a => stars < a.stars);
