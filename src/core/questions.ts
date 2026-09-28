/* Питання й відволікачі.
   Кожен хибний варіант має «пастку» — мітку конкретної дитячої помилки.
   Так вибір дитини стає діагностикою, яку далі використовує адаптивний добір. */

import { ORD_ACC, ORD_NOM, sayDuration, sayTime } from './phrasing';
import { addMinutes, digital, digital24, norm12 } from './time';

export type Trap =
  | 'hourNext'   // годинна прочитана за наступним числом
  | 'swap'       // стрілки переплутані місцями
  | 'decimal'    // час порахований як десятковий (пів = 50)
  | 'literal'    // число прочитане буквально, без лічби п'ятірками
  | 'quarterDir' // «чверть на» / «за чверть»
  | 'halfCur'    // «пів на» поточну годину замість наступної
  | 'ampm'       // ранок / вечір, 12- і 24-годинний запис
  | 'carry';     // забуто перенести годину під час додавання

export const TRAPS: Trap[] = ['hourNext', 'swap', 'decimal', 'literal', 'quarterDir', 'halfCur', 'ampm', 'carry'];

export interface Option {
  label: string;
  correct: boolean;
  trap?: Trap;
  h?: number;
  m?: number;
}

class OptionSet {
  private seen = new Map<string, Option>();
  add(o: Option): void {
    if (!this.seen.has(o.label)) this.seen.set(o.label, o);
  }
  get size(): number { return this.seen.size; }
  take(n = 4): Option[] { return [...this.seen.values()].slice(0, n); }
}

/** «Котра година?» — цифрові варіанти. */
export function readOptions(h: number, m: number): Option[] {
  const set = new OptionSet();
  const add = (hh: number, mm: number, trap?: Trap) => {
    hh = norm12(hh);
    mm = ((mm % 60) + 60) % 60;
    set.add({ label: digital(hh, mm), h: hh, m: mm, correct: !trap && set.size === 0, trap });
  };

  add(h, m);
  if (m > 30) add(h + 1, m, 'hourNext');
  if (m % 5 === 0) add(m === 0 ? 12 : m / 5, (h % 12) * 5, 'swap');
  if (m === 30) add(h, 50, 'decimal');
  if (m === 15) add(h, 3, 'literal');
  if (m === 45) add(h, 9, 'literal');
  for (let d = 5; set.size < 4 && d < 60; d += 5) add(h, m + d);
  for (let d = 1; set.size < 4; d++) add(h, m + d);

  return set.take();
}

/** «Як це сказати?» — словесні варіанти. */
export function sayOptions(h: number, m: number): Option[] {
  const set = new OptionSet();
  const add = (label: string, trap?: Trap) => set.add({ label, correct: set.size === 0, trap });
  const cur = ((h % 12) + 12) % 12, next = (cur + 1) % 12;

  add(sayTime(h, m));
  if (m === 15) add('за чверть ' + ORD_NOM[next], 'quarterDir');
  if (m === 45) add('чверть на ' + ORD_ACC[next], 'quarterDir');
  if (m === 30) add('пів на ' + ORD_ACC[cur], 'halfCur');
  if (m === 0) add('рівно ' + ORD_NOM[next], 'hourNext');
  add(sayTime(h + 1, m), 'hourNext');
  add(sayTime(h, (m + 30) % 60));
  add(sayTime(h, (m + 15) % 60));
  for (let d = 1; set.size < 4 && d < 60; d++) add(sayTime(h, (m + d) % 60));

  return set.take();
}

/** Діагностика для «Постав стрілки»: яку помилку, найімовірніше, зробила дитина. */
export function diagnoseSet(h: number, m: number, gotH: number, gotM: number): Trap | undefined {
  h = norm12(h); gotH = norm12(gotH);
  if (gotH === h && gotM === m) return undefined;
  if (gotM === m && gotH === norm12(h + 1)) return 'hourNext';
  if (m % 5 === 0 && gotH === (m === 0 ? 12 : m / 5) && gotM === (h % 12) * 5) return 'swap';
  if (m === 30 && gotM === 50) return 'decimal';
  if ((m === 15 && gotM === 3) || (m === 45 && gotM === 9)) return 'literal';
  return undefined;
}

/** Пастки, у які дитина потенційно може потрапити на цьому часі. */
export function trapsFor(kind: 'read' | 'say' | 'set', m: number): Trap[] {
  const t: Trap[] = [];
  if (kind === 'say') {
    if (m === 15 || m === 45) t.push('quarterDir');
    if (m === 30) t.push('halfCur');
    t.push('hourNext');
    return t;
  }
  if (m > 30 || (kind === 'set' && m >= 0)) t.push('hourNext');
  if (m % 5 === 0) t.push('swap');
  if (m === 30) t.push('decimal');
  if (m === 15 || m === 45) t.push('literal');
  return t;
}

/* ---------- Пригода «Скільки минуло?» ---------- */

export interface ElapsedTask {
  h: number; m: number; d: number;
  end: { h: number; m: number };
  options: Option[];
  story: string;
}

const STORIES = [
  ['🎬', 'Мультик почався о', 'і тривав'],
  ['⚽', 'Футбол почався о', 'і тривав'],
  ['🎨', 'Гурток малювання почався о', 'і тривав'],
  ['🎠', 'Карусель запустили о', 'і вона крутилася'],
  ['🍰', 'Пиріг поставили в піч о', 'і він пікся'],
  ['📚', 'Урок почався о', 'і тривав']
];

export function elapsedTask(h: number, m: number, d: number, storyIdx: number): ElapsedTask {
  const end = addMinutes(h, m, d);
  const set = new OptionSet();
  const add = (hh: number, mm: number, trap?: Trap) => {
    hh = norm12(hh); mm = ((mm % 60) + 60) % 60;
    set.add({ label: digital(hh, mm), h: hh, m: mm, correct: set.size === 0, trap });
  };
  add(end.h, end.m);
  // Хвилини додано, а годину не перенесено: 3:45 + 30 → 3:15
  if (m + (d % 60) >= 60) add(end.h - 1, end.m, 'carry');
  // «Пів години» як 50 хвилин
  if (d === 30 || d === 90) { const e = addMinutes(h, m, d + 20); add(e.h, e.m, 'decimal'); }
  // Година стала наступною, хоч минуло менше години
  if (d < 60) add(h + 1, m, 'hourNext');
  const back = addMinutes(h, m, -d); add(back.h, back.m);
  for (let k = 5; set.size < 4; k += 5) { const e = addMinutes(end.h, end.m, k); add(e.h, e.m); }

  const [ico, a, b] = STORIES[storyIdx % STORIES.length];
  return {
    h, m, d, end,
    options: set.take(),
    story: ico + ' ' + a + ' ' + digital(h, m) + ' ' + b + ' ' + sayDuration(d) + '. Коли він закінчився?'
  };
}

/* ---------- Пригода «Розпорядок дня» ---------- */

export interface Activity { id: string; ico: string; name: string; h24: number; m: number }

/* Кожна дія має «двійника» з тим самим положенням стрілок в іншій половині доби —
   саме він і стає головним відволікачем. */
export const ROUTINE: Activity[] = [
  { id: 'wake',   ico: '🌅', name: 'Прокидається',       h24: 7,  m: 0 },
  { id: 'dinner', ico: '🍝', name: 'Вечеряє',          h24: 19, m: 0 },
  { id: 'school', ico: '🎒', name: 'Іде до школи',     h24: 8,  m: 0 },
  { id: 'bath',   ico: '🛁', name: 'Купається',          h24: 20, m: 0 },
  { id: 'lesson', ico: '📚', name: 'Сидить на уроці',   h24: 9,  m: 0 },
  { id: 'bed',    ico: '🌙', name: 'Лягає спати',      h24: 21, m: 0 },
  { id: 'lunch',  ico: '🍲', name: 'Обідає',           h24: 13, m: 0 },
  { id: 'night',  ico: '💤', name: 'Міцно спить',       h24: 1,  m: 0 },
  { id: 'walk',   ico: '🛝', name: 'Гуляє в парку',    h24: 16, m: 30 },
  { id: 'dream',  ico: '🌌', name: 'Бачить сни',         h24: 4,  m: 30 },
  { id: 'snack',  ico: '🍎', name: 'Полуднує',         h24: 11, m: 0 },
  { id: 'story',  ico: '📖', name: 'Слухає казку',     h24: 23, m: 0 }
];

export const twinOf = (a: Activity): Activity | undefined =>
  ROUTINE.find(b => b.id !== a.id && b.h24 % 12 === a.h24 % 12 && b.m === a.m);

export interface RoutineTask {
  kind: 'what' | 'write';
  act: Activity;
  text: string;
  options: Option[];
}

export function routineTask(act: Activity, kind: 'what' | 'write', others: Activity[]): RoutineTask {
  const set = new OptionSet();
  if (kind === 'what') {
    const add = (a: Activity, trap?: Trap) => set.add({ label: a.ico + ' ' + a.name, correct: set.size === 0, trap });
    add(act);
    const tw = twinOf(act);
    if (tw) add(tw, 'ampm');
    others.forEach(o => { if (set.size < 4 && o.id !== act.id) add(o); });
    return { kind, act, text: 'Що Тік робить о цій порі?', options: set.take() };
  }
  const add = (h24: number, trap?: Trap) =>
    set.add({ label: digital24(h24, act.m), correct: set.size === 0, trap });
  add(act.h24);
  add((act.h24 + 12) % 24, 'ampm');
  add(act.h24 + 1);
  add(act.h24 + 11);
  add(act.h24 - 1);
  return {
    kind, act,
    text: act.ico + ' Тік ' + act.name.toLowerCase() + '. Як це записати на електронному годиннику?',
    options: set.take()
  };
}
