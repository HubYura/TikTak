/* «Скільки триває хвилина?» — відчуття тривалості.
   Читати годинник ≠ розуміти час: діти 6–8 років часто не відчувають, скільки
   це — 20 хвилин. Тут дві частини: оцінити тривалість самому (Старт/Стоп)
   і співвіднести знайомі справи з тривалістю. */

import type { Option } from './questions';
import { type Rng, pick, shuffle } from './rng';

export interface Activity { ico: string; name: string; what: string; minutes: number }

/* Тривалості — типові для дитини, округлені до «кошиків», які легко уявити. */
export const ACTIVITIES: Activity[] = [
  { ico: '🧼', name: 'помити руки',          what: 'Помити руки',          minutes: 0.5 },
  { ico: '👟', name: 'взутися',              what: 'Взутися',              minutes: 1 },
  { ico: '🪥', name: 'почистити зуби',       what: 'Почистити зуби',       minutes: 2 },
  { ico: '🥣', name: 'поснідати',            what: 'Поснідати',            minutes: 15 },
  { ico: '🎬', name: 'подивитися мультик',   what: 'Мультик',              minutes: 20 },
  { ico: '📚', name: 'урок у школі',         what: 'Урок у школі',         minutes: 40 },
  { ico: '⚽', name: 'футбольний матч',      what: 'Футбольний матч',      minutes: 90 },
  { ico: '🎂', name: 'свято з друзями',      what: 'Свято з друзями',      minutes: 180 },
  { ico: '😴', name: 'поспати вночі',        what: 'Нічний сон',           minutes: 600 }
];

/* Відповіді на «Скільки приблизно триває…?» — кошики з порядком величини */
export const BUCKETS: { label: string; max: number }[] = [
  { label: 'пів хвилини', max: 0.75 },
  { label: '1–2 хвилини', max: 5 },
  { label: '15–20 хвилин', max: 30 },
  { label: 'близько години', max: 120 },
  { label: 'кілька годин', max: 300 },
  { label: 'цілу ніч', max: Infinity }
];

export const bucketOf = (minutes: number): string => BUCKETS.find(b => minutes <= b.max)!.label;

export type FeelTask =
  | { mode: 'estimate'; seconds: number }
  | { mode: 'compare' | 'howlong'; text: string; options: Option[]; explain: string };

export const ESTIMATE_TARGETS = [5, 10, 10, 15, 20, 30];

/** Щедрий допуск: для 6-річних «майже вгадав» — теж перемога. */
export function judgeEstimate(target: number, actual: number): boolean {
  return Math.abs(actual - target) <= Math.max(2, target * 0.25);
}

export function feelTask(r: Rng = Math.random, allowMinute = false): FeelTask {
  const roll = r();
  if (roll < 0.4) {
    const targets = allowMinute ? [...ESTIMATE_TARGETS, 60] : ESTIMATE_TARGETS;
    return { mode: 'estimate', seconds: pick(targets, r) };
  }
  if (roll < 0.7) {
    // Дві справи, одна помітно довша за іншу
    let a: Activity, b: Activity;
    do { a = pick(ACTIVITIES, r); b = pick(ACTIVITIES, r); }
    while (a === b || Math.max(a.minutes, b.minutes) / Math.min(a.minutes, b.minutes) < 3);
    const [long, short] = a.minutes > b.minutes ? [a, b] : [b, a];
    return {
      mode: 'compare',
      text: 'Що триває довше?',
      options: shuffle([
        { label: long.ico + ' ' + long.what, correct: true },
        { label: short.ico + ' ' + short.what, correct: false }
      ], r),
      explain: `${long.what} — це приблизно ${bucketOf(long.minutes)}, а ${short.what.toLowerCase()} — ${bucketOf(short.minutes)}.`
    };
  }
  const act = pick(ACTIVITIES, r);
  const right = bucketOf(act.minutes);
  const others = shuffle(BUCKETS.map(b => b.label).filter(l => l !== right), r).slice(0, 3);
  return {
    mode: 'howlong',
    text: `${act.ico} Скільки приблизно триває «${act.name}»?`,
    options: shuffle([{ label: right, correct: true }, ...others.map(l => ({ label: l, correct: false }))], r),
    explain: `«${act.name[0].toUpperCase() + act.name.slice(1)}» — це приблизно ${right}.`
  };
}
