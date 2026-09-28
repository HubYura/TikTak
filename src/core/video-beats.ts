/* Партитура руху для відеопояснень: що робить годинник під час кожного речення.
   Blender-скрипт (video/blender) рендерить саме це, тому стрілки в кліпах завжди
   математично точні — генератори відео з цим не справляються.

   Один «біт» = одне речення сценарію (розбиття таке саме, як для субтитрів). */

export type Part = 'numbers' | 'cardinal' | 'fives' | 'ticks' | 'hour' | 'minute' | 'second';

export type Glow =
  | 'hour' | 'minute' | 'second'      // стрілка світиться
  | 'fives' | 'ticks'                 // кільце хвилин / рисок
  | 'halves' | 'quarters'             // сектори
  | 'circle' | 'gears'                // стрілка-коло навколо циферблата, механізм
  | `num${number}`;                   // конкретне число

export interface Beat {
  /** Куди стрілки доходять до кінця речення ('H:MM'; для добових кліпів — 24-годинний). */
  clock?: string;
  /** Або: на скільки хвилин прокрутити вперед за це речення. */
  turn?: number;
  /** Що з'являється на циферблаті з цього речення. */
  show?: Part[];
  glow?: Glow[];
  /** Великий підпис над циферблатом (без емодзі — це текст у 3D). */
  label?: string;
  mood?: 'idle' | 'happy' | 'oops';
}

export interface ClipMotion {
  start: string;
  /** Що видно з самого початку. Типово — увесь циферблат без секундної стрілки. */
  parts?: Part[];
  /** Небо змінюється з часом доби. */
  day?: boolean;
  beats: Beat[];
}

const FULL: Part[] = ['numbers', 'fives', 'ticks', 'hour', 'minute'];

export const MOTION: Record<string, ClipMotion> = {
  'intro': { start: '12:00', beats: [
    { mood: 'happy' }, { glow: ['hour', 'minute'] }, { turn: 60 }, {}, { mood: 'happy', turn: 15 }
  ] },
  'parents': { start: '7:00', beats: [
    {}, { clock: '7:30', label: 'пів на восьму' }, { glow: ['halves', 'quarters'] },
    { glow: ['hour'] }, { mood: 'happy' }
  ] },

  'stage-1': { start: '12:00', parts: ['minute'], beats: [
    { glow: ['circle'], turn: 60 }, { label: 'за годинниковою стрілкою', turn: 60 },
    { mood: 'happy', glow: ['circle'], turn: 60 }
  ] },
  'stage-2': { start: '3:00', parts: ['numbers', 'hour', 'minute'], beats: [
    {}, { glow: ['gears'], turn: 60 }, { glow: ['hour', 'minute'], turn: 60 }
  ] },
  'stage-3': { start: '12:00', parts: [], beats: [
    { show: ['cardinal'] }, { show: ['numbers'] }, { show: ['hour'], glow: ['hour'], turn: 60 }
  ] },
  'stage-4': { start: '4:00', parts: ['numbers', 'ticks', 'hour'], beats: [
    { glow: ['hour'] }, { glow: ['hour'], turn: 40 }, { glow: ['num4'], label: 'четверта' }
  ] },
  'stage-5': { start: '3:00', parts: ['numbers', 'ticks', 'hour'], beats: [
    { show: ['minute'], glow: ['minute'] }, { turn: 60, glow: ['minute', 'hour'], label: '60 хвилин' }
  ] },
  'stage-6': { start: '3:00', parts: ['numbers', 'ticks', 'hour', 'minute'], beats: [
    { clock: '3:30', glow: ['halves'] }, { label: '30 хвилин' },
    { label: '30, а не 50', mood: 'oops' }, { label: 'пів на четверту', mood: 'happy' }
  ] },
  'stage-7': { start: '3:00', parts: ['numbers', 'ticks', 'hour', 'minute'], beats: [
    { glow: ['quarters'] }, { clock: '3:15', glow: ['quarters'], label: 'чверть на четверту' },
    { clock: '3:45', glow: ['quarters'], label: 'за чверть четверта' }
  ] },
  'stage-8': { start: '9:00', parts: ['numbers', 'ticks', 'hour', 'minute'], beats: [
    { show: ['fives'], glow: ['fives'], clock: '9:15' }, { clock: '9:20', glow: ['fives', 'minute'], mood: 'happy' }
  ] },
  'stage-9': { start: '9:20', parts: ['numbers', 'fives', 'hour', 'minute'], beats: [
    { show: ['ticks'], glow: ['ticks'] }, { clock: '9:21', label: '1 хвилина' },
    { clock: '9:22', glow: ['num4'], label: '20 + 2 = 22' }
  ] },
  'stage-10': { start: '10:10', beats: [
    { show: ['second'], glow: ['second'] }, { turn: 1, label: '60 секунд = 1 хвилина' }, { turn: 1, mood: 'happy' }
  ] },
  'stage-11': { start: '7:00', day: true, beats: [
    { turn: 1440, glow: ['hour'] }, { turn: 720, label: 'ранок і вечір' }, { label: '19:00', mood: 'happy' }
  ] },

  'trap-hourNext': { start: '3:45', beats: [
    { glow: ['hour'] }, { glow: ['num3'], label: 'третя', mood: 'happy' }, { glow: ['hour', 'num3'] }
  ] },
  'trap-swap': { start: '2:50', beats: [
    { glow: ['hour'] }, { glow: ['minute'], turn: 10 }, { glow: ['hour'], mood: 'happy' }
  ] },
  'trap-decimal': { start: '3:00', beats: [
    { turn: 60, label: '60, а не 100' }, { clock: '4:30', glow: ['halves'], label: '30' }
  ] },
  'trap-literal': { start: '3:00', beats: [
    { clock: '3:15', glow: ['minute', 'num3'], label: '15 хвилин' }, { glow: ['fives'], mood: 'happy' }
  ] },
  'trap-quarterDir': { start: '3:00', beats: [
    { clock: '3:15', glow: ['quarters'], label: 'чверть на четверту' },
    { clock: '3:45', glow: ['quarters'], label: 'за чверть четверта' }
  ] },
  'trap-halfCur': { start: '3:00', beats: [
    { clock: '3:30', glow: ['halves'], label: 'пів на четверту' }, { glow: ['num4'], mood: 'happy' }
  ] },
  'trap-ampm': { start: '7:00', day: true, beats: [
    { label: '7:00' }, { turn: 720 }, { label: '19:00', mood: 'happy' }
  ] },
  'trap-carry': { start: '3:45', beats: [
    { turn: 30, glow: ['minute', 'hour'], label: '4:15' }
  ] }
};

export const partsOf = (m: ClipMotion): Part[] => m.parts ?? FULL;

/** Те саме розбиття на речення, що й для субтитрів у грі. */
export const sentences = (text: string): string[] =>
  text.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) || [text];
