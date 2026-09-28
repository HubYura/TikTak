import { describe, expect, it } from 'vitest';
import { partOfDay, pluralMin, sayDuration, sayTime } from '../src/core/phrasing';

describe('sayTime', () => {
  it.each([
    [3, 0, 'рівно третя'],
    [12, 0, 'рівно дванадцята'],
    [0, 0, 'рівно дванадцята'],
    [3, 15, 'чверть на четверту'],
    [3, 30, 'пів на четверту'],
    [3, 45, 'за чверть четверта'],
    [11, 30, 'пів на дванадцяту'],
    [12, 30, 'пів на першу'],
    [9, 1, '1 хвилина на десяту'],
    [9, 22, '22 хвилини на десяту'],
    [9, 11, '11 хвилин на десяту'],
    [9, 41, 'за 19 хвилин десята'],
    [9, 58, 'за 2 хвилини десята'],
    [15, 0, 'рівно третя']
  ])('%i:%i → %s', (h, m, want) => expect(sayTime(h, m)).toBe(want));
});

describe('pluralMin', () => {
  it.each([[1, 'хвилина'], [2, 'хвилини'], [4, 'хвилини'], [5, 'хвилин'], [11, 'хвилин'],
    [12, 'хвилин'], [14, 'хвилин'], [21, 'хвилина'], [22, 'хвилини'], [25, 'хвилин']])(
    '%i → %s', (n, w) => expect(pluralMin(n)).toBe(w));
});

describe('partOfDay', () => {
  it('ділить добу', () => {
    expect(partOfDay(7)).toBe('ранку');
    expect(partOfDay(13)).toBe('дня');
    expect(partOfDay(19)).toBe('вечора');
    expect(partOfDay(2)).toBe('ночі');
    expect(partOfDay(23)).toBe('ночі');
  });
});

describe('sayDuration', () => {
  it('знахідний відмінок', () => {
    expect(sayDuration(30)).toBe('пів години');
    expect(sayDuration(90)).toBe('півтори години');
    expect(sayDuration(21)).toBe('21 хвилину');
    expect(sayDuration(20)).toBe('20 хвилин');
    expect(sayDuration(45)).toBe('45 хвилин');
    expect(sayDuration(75)).toBe('1 годину 15 хвилин');
  });
});
