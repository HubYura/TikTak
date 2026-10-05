/* «Годинник удома»: дитина дивиться на справжній годинник і ставить стрілки так само.
   Перевіряємо за часом пристрою — з запасом, бо домашній годинник може трохи спішити чи відставати. */

import { toDial } from './time';

export type HomeHint = 'hour' | 'swap' | 'minute';
export interface HomeVerdict {
  ok: boolean;
  /** На скільки хвилин стрілки дитини відрізняються від справжнього часу (від −360 до 359). */
  off: number;
  /** Що, найімовірніше, не так — щоб підказати, куди глянути вдруге. */
  hint?: HomeHint;
}

/** Найкоротша різниця двох положень циферблата: від −360 до 359. */
export const dialDiff = (a: number, b: number): number => ((((a - b) % 720) + 1080) % 720) - 360;

/** Скільки хвилин запасу: 5 на крок стрілки й ще трохи на неточний домашній годинник. */
export const HOME_TOLERANCE = 6;

/** Крок стрілок за рівнем дитини: на «Цілих годинах» досить поставити найближчу годину,
    на «Чвертях» — найближчу чверть; точніше за п'ятірки не вимагаємо. */
export const homeSnap = (levelSnap: number): number => Math.max(5, levelSnap);

/** Запас — пів кроку (найближче положення) плюс трохи на неточний годинник. */
export const homeTolerance = (snap: number): number => Math.max(HOME_TOLERANCE, snap / 2 + 3);

export function judgeHome(nowH24: number, nowM: number, got: number, tol = HOME_TOLERANCE): HomeVerdict {
  const now = toDial(nowH24, nowM);
  const off = dialDiff(got, now);
  if (Math.abs(off) <= tol) return { ok: true, off };
  // Стрілки переплутані (перевіряємо першим: це точніший збіг): коротка там, де мала бути довга, і навпаки
  const gotHourNum = Math.round(got / 60) % 12, gotMinNum = Math.round((got % 60) / 5) % 12;
  const nowHourNum = Math.round(now / 60) % 12, nowMinNum = Math.round((now % 60) / 5) % 12;
  if (gotHourNum === nowMinNum && gotMinNum === nowHourNum && gotHourNum !== gotMinNum) return { ok: false, off, hint: 'swap' };
  // Хвилини збігаються, а коротка стрілка — на сусідньому числі
  const minOff = dialDiff(got % 60, now % 60) % 60;
  if (Math.abs(minOff) <= tol && Math.abs(Math.abs(off) - 60) <= tol) return { ok: false, off, hint: 'hour' };
  return { ok: false, off, hint: 'minute' };
}
