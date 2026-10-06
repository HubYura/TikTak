/* Пригода «Плануємо день» для 9–10 років: тривалість подій у 24-годинному форматі.
   Коли закінчиться, коли почалося, скільки тривало — і через північ.
   Хибні варіанти — типові помилки: годину не перенесли, рахують «до 100», плутаються з північчю. */

import { pluralMin, sayDuration } from './phrasing';
import { OptionSet, type Option } from './questions';
import { digital24 } from './time';

export type PlanKind = 'end' | 'start' | 'between' | 'midnight';
export interface PlanTask {
  kind: PlanKind;
  text: string;
  options: Option[];
  /** Правильна відповідь словами — для пояснення й озвучки. */
  answer: string;
  /** Що показують стрілки до відповіді і куди прокручуються після (хвилини від півночі). */
  from: number;
  to: number;
}

const DAY = 1440;
const wrap = (t: number): number => ((t % DAY) + DAY) % DAY;
const hm = (t: number): string => digital24(Math.floor(wrap(t) / 60), wrap(t) % 60);
/** «1 година 25 хвилин» — повними словами, щоб Тік не читав скорочень. */
export function durWords(d: number): string {
  const h = Math.floor(d / 60), m = d % 60;
  const hw = (n: number) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? 'година' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'години' : 'годин'; };
  return [h ? h + ' ' + hw(h) : '', m ? m + ' ' + pluralMin(m) : ''].filter(Boolean).join(' ');
}

/** «1 год 25 хв» — коротко, для варіантів відповіді. */
export function fmtDur(d: number): string {
  const h = Math.floor(d / 60), m = d % 60;
  return [h ? h + ' год' : '', m ? m + ' хв' : ''].filter(Boolean).join(' ') || '0 хв';
}

const END: [string, string, string][] = [
  ['🎬', 'Фільм почався о {t} і триває {d}.', 'О котрій він закінчиться?'],
  ['⚽', 'Футбольний матч почався о {t} і триває {d}.', 'О котрій він закінчиться?'],
  ['🚌', 'Автобус виїхав о {t} і їде {d}.', 'О котрій він приїде?'],
  ['🎂', 'Свято почалося о {t} і тривало {d}.', 'О котрій воно закінчилося?']
];
const START: [string, string, string][] = [
  ['🚆', 'Потяг прибув о {t}, а їхав {d}.', 'О котрій він вирушив?'],
  ['🍰', 'Пиріг дістали з печі о {t}, а пікся він {d}.', 'О котрій його поставили в піч?'],
  ['🏊', 'Тренування закінчилося о {t}, а тривало {d}.', 'О котрій воно почалося?']
];
const BETWEEN: [string, string, string][] = [
  ['🎻', 'Урок музики триває з {a} до {b}.', 'Скільки він триває?'],
  ['🚗', 'Ми виїхали о {a}, а приїхали о {b}.', 'Скільки часу ми їхали?'],
  ['🎨', 'Гурток малювання — з {a} до {b}.', 'Скільки він триває?']
];
const NIGHT: [string, string, string][] = [
  ['🌙', 'Тік ліг спати о {a}, а прокинувся о {b}.', 'Скільки він спав?'],
  ['✈️', 'Літак вилетів о {a}, а приземлився о {b}.', 'Скільки тривав політ?']
];

type Rnd = () => number;
const pick = <T>(r: Rnd, a: readonly T[]): T => a[Math.floor(r() * a.length)];
const step5 = (r: Rnd, lo: number, hi: number): number => lo + Math.floor(r() * ((hi - lo) / 5 + 1)) * 5;

export function planningTask(r: Rnd, kind: PlanKind = pick(r, ['end', 'start', 'between', 'midnight'] as const)): PlanTask {
  const set = new OptionSet();
  const time = (t: number, trap?: Option['trap'], label = hm(t)) => set.add({ label, correct: set.size === 0, trap });
  const dur = (d: number, trap?: Option['trap'], label = fmtDur(d)) => { if (d > 0) set.add({ label, correct: set.size === 0, trap }); };

  if (kind === 'end' || kind === 'start') {
    // Тривалість 35–215 хв і хвилини, що «переливаються» через годину, — головна складність
    let s: number, d: number;
    // хвилини разом — від 60 до 95: і перенос години потрібен, і «18:65» виглядає правдоподібно
    do { s = step5(r, 8 * 60, 19 * 60); d = step5(r, 35, 215); } while ((s % 60) + (d % 60) < 60 || (s % 60) + (d % 60) > 95 || d % 60 === 0);
    const e = s + d;
    const [ico, a, q] = pick(r, kind === 'end' ? END : START);
    const text = ico + ' ' + a.replace('{t}', hm(kind === 'end' ? s : e)).replace('{d}', sayDuration(d)) + ' ' + q;
    if (kind === 'end') {
      time(e);
      time(e - 60, 'carry');                                        // хвилини додали, а годину не перенесли
      const hh = Math.floor(s / 60) + Math.floor(d / 60), mm = (s % 60) + (d % 60);
      time(0, 'decimal', String(hh).padStart(2, '0') + ':' + mm);   // «до 100»: 17:40 + 1:25 = 18:65
      time(e + 60); time(e - 5); time(e + 5);
      return { kind, text, options: set.take(), answer: hm(e), from: s, to: e };
    }
    time(s);
    time(s + 60, 'carry');                                          // забули позичити годину
    const hh = Math.floor(e / 60) - Math.floor(d / 60), mm = Math.abs((e % 60) - (d % 60));
    time(0, 'carry', String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'));   // від більшого відняли менше
    time(s - 60); time(s + 5); time(s - 5);
    return { kind, text, options: set.take(), answer: hm(s), from: e, to: s };
  }

  if (kind === 'between') {
    let a: number, b: number;
    // хвилини кінця менші за хвилини початку (треба позичати годину), а «до 100» дає 60+ хвилин
    do { a = step5(r, 8 * 60, 18 * 60); b = a + step5(r, 40, 200); } while ((a % 60) <= (b % 60) || (a % 60) - (b % 60) > 40);
    const d = b - a;
    const [ico, t, q] = pick(r, BETWEEN);
    const text = ico + ' ' + t.replace('{a}', hm(a)).replace('{b}', hm(b)) + ' ' + q;
    dur(d);
    const dec = (Math.floor(b / 60) * 100 + b % 60) - (Math.floor(a / 60) * 100 + a % 60);
    dur(1, 'decimal', (dec >= 100 ? Math.floor(dec / 100) + ' год ' : '') + (dec % 100) + ' хв');   // 18:20 − 16:45 = «1 год 75 хв»
    dur((Math.floor(b / 60) - Math.floor(a / 60)) * 60 + Math.abs((b % 60) - (a % 60)), 'carry');            // «2 год 25 хв»
    dur(d + 60); dur(d - 5); dur(d + 5);
    return { kind, text, options: set.take(), answer: durWords(d), from: a, to: b };
  }

  // Через північ: від вечора до ранку
  const a = step5(r, 20 * 60, 23 * 60 + 30), b = step5(r, 5 * 60 + 30, 8 * 60 + 30);
  const d = b + DAY - a;
  const [ico, t, q] = pick(r, NIGHT);
  const text = ico + ' ' + t.replace('{a}', hm(a)).replace('{b}', hm(b)) + ' ' + q;
  dur(d);
  dur(a - b, 'ampm');                                               // відняли «навпаки»: 21:30 − 7:15 = 14 год 15 хв
  dur(d + 60, 'carry'); dur(d - 60); dur(d + 30); dur(d - 30);
  return { kind, text, options: set.take(), answer: durWords(d), from: a, to: b + DAY };
}
