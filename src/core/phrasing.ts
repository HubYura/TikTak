/* Українські назви часу з правильними відмінками. */

export const ORD_NOM = ['дванадцята', 'перша', 'друга', 'третя', 'четверта', 'п’ята',
  'шоста', 'сьома', 'восьма', 'дев’ята', 'десята', 'одинадцята'];
export const ORD_ACC = ['дванадцяту', 'першу', 'другу', 'третю', 'четверту', 'п’яту',
  'шосту', 'сьому', 'восьму', 'дев’яту', 'десяту', 'одинадцяту'];

export function pluralMin(n: number): string {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return 'хвилина';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'хвилини';
  return 'хвилин';
}

export function sayTime(h24: number, m: number): string {
  const h = ((h24 % 12) + 12) % 12;
  const next = (h + 1) % 12;
  if (m === 0) return 'рівно ' + ORD_NOM[h];
  if (m === 15) return 'чверть на ' + ORD_ACC[next];
  if (m === 30) return 'пів на ' + ORD_ACC[next];
  if (m === 45) return 'за чверть ' + ORD_NOM[next];
  if (m < 30) return m + ' ' + pluralMin(m) + ' на ' + ORD_ACC[next];
  const left = 60 - m;
  return 'за ' + left + ' ' + pluralMin(left) + ' ' + ORD_NOM[next];
}

export function partOfDay(h24: number): 'ранку' | 'дня' | 'вечора' | 'ночі' {
  if (h24 >= 5 && h24 < 12) return 'ранку';
  if (h24 >= 12 && h24 < 18) return 'дня';
  if (h24 >= 18 && h24 < 23) return 'вечора';
  return 'ночі';
}

/** Тривалість словами: 90 → «1 година 30 хвилин», 30 → «пів години». */
export function sayDuration(d: number): string {
  if (d === 30) return 'пів години';
  if (d === 15) return 'чверть години';
  if (d === 60) return 'одну годину';
  if (d === 90) return 'півтори години';
  if (d === 120) return 'дві години';
  const h = Math.floor(d / 60), m = d % 60;
  const hs = h === 0 ? '' : h === 1 ? '1 годину' : h + ' години';
  const ms = m === 0 ? '' : m + ' ' + (pluralMin(m) === 'хвилина' ? 'хвилину' : pluralMin(m));
  return [hs, ms].filter(Boolean).join(' ');
}
