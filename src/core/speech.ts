/* Як Тік вимовляє фразу: текст → речення → шматки, для кожного з яких є готовий запис голосу.

   Записів на кожну можливу фразу не зробити: у фразах трапляються години й хвилини.
   Тому фраза ріжеться на сталі шматки («Постав стрілки», «хвилин на восьму») і числа
   («на двадцять»), а числа й час вимовляються словами з правильними відмінками.
   Той самий розріз використовують і гра (шукає записи), і збирач фраз для озвучки. */

import { ORD_ACC, ORD_NOM } from './phrasing';

const ONES_M = ['нуль', 'один', 'два', 'три', 'чотири', 'п’ять', 'шість', 'сім', 'вісім', 'дев’ять',
  'десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', 'п’ятнадцять', 'шістнадцять',
  'сімнадцять', 'вісімнадцять', 'дев’ятнадцять'];
const TENS = ['', '', 'двадцять', 'тридцять', 'сорок', 'п’ятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'дев’яносто'];

/** Години на електронному табло: 0..23, жіночий рід (година). */
const ORD24_NOM = ['нуль', ...ORD_NOM.slice(1), 'дванадцята', 'тринадцята', 'чотирнадцята', 'п’ятнадцята',
  'шістнадцята', 'сімнадцята', 'вісімнадцята', 'дев’ятнадцята', 'двадцята', 'двадцять перша',
  'двадцять друга', 'двадцять третя'];
/** «о третій», «о чотирнадцятій». */
const ORD24_LOC = ['нульовій', 'першій', 'другій', 'третій', 'четвертій', 'п’ятій', 'шостій', 'сьомій',
  'восьмій', 'дев’ятій', 'десятій', 'одинадцятій', 'дванадцятій', 'тринадцятій', 'чотирнадцятій',
  'п’ятнадцятій', 'шістнадцятій', 'сімнадцятій', 'вісімнадцятій', 'дев’ятнадцятій', 'двадцятій',
  'двадцять першій', 'двадцять другій', 'двадцять третій'];

type Gender = 'm' | 'f' | 'fAcc' | 'gen';

/** Родовий відмінок: «до восьми», «до дванадцяти». */
const ONES_GEN = ['нуля', 'одного', 'двох', 'трьох', 'чотирьох', 'п’яти', 'шести', 'семи', 'восьми', 'дев’яти',
  'десяти', 'одинадцяти', 'дванадцяти', 'тринадцяти', 'чотирнадцяти', 'п’ятнадцяти', 'шістнадцяти',
  'сімнадцяти', 'вісімнадцяти', 'дев’ятнадцяти'];
const TENS_GEN = ['', '', 'двадцяти', 'тридцяти', 'сорока', 'п’ятдесяти', 'шістдесяти', 'сімдесяти', 'вісімдесяти', 'дев’яноста'];

/** 0..100 словами. f — «одна/дві» (хвилина), fAcc — «одну/дві» (годину). */
export function numberWords(n: number, g: Gender = 'm'): string {
  if (g === 'gen' && n >= 0 && n < 100 && Number.isInteger(n)) {
    return n < 20 ? ONES_GEN[n] : TENS_GEN[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES_GEN[n % 10] : '');
  }
  if (n === 100) return 'сто';
  if (n < 0 || n > 100 || !Number.isInteger(n)) return String(n);
  const fem = (d: number) => d === 1 ? (g === 'fAcc' ? 'одну' : 'одна') : 'дві';
  const unit = (d: number) => g !== 'm' && (d === 1 || d === 2) ? fem(d) : ONES_M[d];
  if (n < 20) return unit(n);
  const t = Math.floor(n / 10), d = n % 10;
  return d ? TENS[t] + ' ' + unit(d) : TENS[t];
}

const pluralSec = (n: number): string => {
  const d = n % 10, dd = n % 100;
  if (d === 1 && dd !== 11) return 'секунда';
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'секунди';
  return 'секунд';
};

const minuteWords = (m: number): string => m === 0 ? 'нуль нуль' : m < 10 ? 'нуль ' + numberWords(m) : numberWords(m);

/** Прибирає розмітку, емодзі й письмові скорочення — те, що не вимовляють. */
export function speakable(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[★☆➜✓«»"“”„]/g, '')
    .replace(/\(-ла\)/g, '')
    // «12,3 с» → «12 секунд»: дитині не потрібні десяті частки
    .replace(/(\d+)(?:,(\d))? с(?![\p{L}])/gu, (_, a, b) => {
      const n = Math.round(Number(a + '.' + (b || 0)));
      return n + ' ' + pluralSec(n);
    })
    // «3:30 — пів на четверту»: уголос досить словесного часу
    .replace(/\d{1,2}:\d{2}\s+—\s+(?=(рівно|чверть|пів|за|\d+ хвилин))/g, '')
    .replace(/\s+—\s+/g, ', ')
    .replace(/…/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Piece {
  /** Ключ пошуку запису: без регістру й розділових знаків. */
  key: string;
  /** Текст для синтезу — з розділовими знаками, щоб інтонація була правильною. */
  text: string;
}

export const speechKey = (s: string): string =>
  s.toLowerCase().replace(/[’']/g, '’').replace(/[^\p{L}\p{N}’ ]+/gu, ' ').replace(/\s+/g, ' ').trim();

const piece = (text: string): Piece => ({ key: speechKey(text), text: text.trim() });

/** Прийменники, які краще звучать разом із числом: «на двадцять», «за п’ять», «о третій». */
const GLUE = new Set(['на', 'за', 'о', 'не', 'по', 'через', 'до', 'уже', 'вже']);

/* Словесний час (sayTime) — цілим шматком: «пів на восьму», «20 хвилин на восьму», «за 5 хвилин восьма».
   Так звучить природно, а варіантів лише 720. */
const NOM = ORD_NOM.join('|'), ACC = ORD_ACC.join('|');
const SAY_TIME = `рівно (?:${NOM})|(?:чверть|пів) на (?:${ACC})|за чверть (?:${NOM})|\\d+ хвилин[аиу]? на (?:${ACC})|за \\d+ хвилин[аиу]? (?:${NOM})`;

/* Порядок важливий: словесний час, електронний час, «7-та», звичайні числа. */
const TOKEN = new RegExp(`(?<![\\p{L}’])(${SAY_TIME})(?![\\p{L}’])|(\\d{1,2}):(\\d{2})|(\\d+)-та|(\\d+)`, 'giu');

/** «20 хвилин на восьму» → «двадцять хвилин на восьму». */
const timeWords = (phrase: string): string =>
  phrase.toLowerCase().replace(/\d+(?= (хвилин\S*))/, (n, w) => numberWords(Number(n), /у$/.test(w) ? 'fAcc' : 'f'));

/** Розрізає одне речення на шматки. */
function splitSentence(sentence: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  let pendingText = '';
  const flushText = (s: string) => { pendingText += s; };
  const emitText = () => {
    const t = pendingText.trim();
    if (speechKey(t)) out.push(piece(t));
    pendingText = '';
  };

  for (const m of sentence.matchAll(TOKEN)) {
    const at = m.index!;
    flushText(sentence.slice(last, at));
    last = at + m[0].length;

    if (m[1] !== undefined) {           // словесний час — цілим шматком, без перенесення прийменника
      emitText();
      out.push(piece(timeWords(m[1])));
      continue;
    }

    // Прийменник перед числом переносимо в числовий шматок
    let lead = '';
    const words = pendingText.trimEnd().split(' ');
    const tail = words[words.length - 1]?.toLowerCase();
    if (tail && GLUE.has(tail)) {
      lead = words.pop()!;
      pendingText = words.join(' ') + (words.length ? ' ' : '');
    }
    emitText();

    const rest = sentence.slice(last).trimStart().toLowerCase();
    if (m[2] !== undefined) {
      const h = Number(m[2]), mm = Number(m[3]);
      if (lead.toLowerCase() === 'о') {
        out.push(piece('о ' + ORD24_LOC[h % 24]));
        if (mm) out.push(piece(minuteWords(mm)));
      } else {
        if (lead) out.push(piece(lead));
        out.push(piece(ORD24_NOM[h % 24]));
        out.push(piece(minuteWords(mm)));
      }
    } else if (m[4] !== undefined) {
      out.push(piece((lead ? lead + ' ' : '') + ORD24_NOM[Number(m[4]) % 24]));
    } else {
      const n = Number(m[5]);
      const g: Gender = lead.toLowerCase() === 'до' ? 'gen'
        : /^(хвилину|годину|секунду)/.test(rest) ? 'fAcc'
        : /^(хвилин|годин|секунд)/.test(rest) ? 'f' : 'm';
      out.push(piece((lead ? lead + ' ' : '') + numberWords(n, g)));
    }
  }
  flushText(sentence.slice(last));
  emitText();
  return out;
}

/** Фраза → речення → шматки. Порожні шматки (самі розділові знаки) відкидаються. */
export function speechPlan(text: string): Piece[][] {
  const clean = speakable(text);
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+/)
    .map(splitSentence)
    .filter(s => s.length);
}
