import { describe, expect, it } from 'vitest';
import { ROUTINE, diagnoseSet, elapsedTask, readOptions, routineTask, sayOptions, twinOf } from '../src/core/questions';
import { digital, norm12 } from '../src/core/time';
import { sayTime } from '../src/core/phrasing';

const all = Array.from({ length: 720 }, (_, t) => [norm12(Math.floor(t / 60)), t % 60] as const);

describe('варіанти відповідей на всіх 720 значеннях часу', () => {
  it.each([['read', readOptions], ['say', sayOptions]] as const)('%s: 4 різні, рівно одна правильна', (_, fn) => {
    for (const [h, m] of all) {
      const o = fn(h, m);
      expect(o).toHaveLength(4);
      expect(new Set(o.map(x => x.label)).size).toBe(4);
      expect(o.filter(x => x.correct)).toHaveLength(1);
      expect(o.find(x => x.correct)!.label).toBe(fn === readOptions ? digital(h, m) : sayTime(h, m));
      expect(o.filter(x => x.correct && x.trap)).toHaveLength(0);
    }
  });
});

describe('пастки', () => {
  const trapOf = (o: ReturnType<typeof readOptions>, label: string) => o.find(x => x.label === label)?.trap;
  it('3:45 → 4:45 ловить «годинну за наступним числом»', () => expect(trapOf(readOptions(3, 45), '4:45')).toBe('hourNext'));
  it('2:50 → 10:10 ловить переплутані стрілки', () => expect(trapOf(readOptions(2, 50), '10:10')).toBe('swap'));
  it('3:30 → 3:50 ловить десятковий час', () => expect(trapOf(readOptions(3, 30), '3:50')).toBe('decimal'));
  it('3:15 → 3:03 ловить буквальне читання', () => expect(trapOf(readOptions(3, 15), '3:03')).toBe('literal'));
  it('3:45 → «чверть на четверту» ловить на/за', () =>
    expect(trapOf(sayOptions(3, 45), 'чверть на четверту')).toBe('quarterDir'));
  it('3:30 → «пів на третю» ловить поточну годину', () =>
    expect(trapOf(sayOptions(3, 30), 'пів на третю')).toBe('halfCur'));
});

describe('diagnoseSet', () => {
  it('розпізнає типові помилки', () => {
    expect(diagnoseSet(3, 45, 4, 45)).toBe('hourNext');
    expect(diagnoseSet(2, 50, 10, 10)).toBe('swap');
    expect(diagnoseSet(3, 30, 3, 50)).toBe('decimal');
    expect(diagnoseSet(3, 15, 3, 3)).toBe('literal');
    expect(diagnoseSet(3, 15, 3, 15)).toBeUndefined();
    expect(diagnoseSet(3, 15, 7, 40)).toBeUndefined();
  });
});

describe('elapsedTask', () => {
  it('на всіх комбінаціях — 4 різні варіанти й правильний кінець', () => {
    for (const d of [10, 15, 20, 30, 45, 60, 90]) {
      for (let t = 0; t < 720; t += 5) {
        const h = norm12(Math.floor(t / 60)), m = t % 60;
        const k = elapsedTask(h, m, d, t);
        expect(new Set(k.options.map(o => o.label)).size).toBe(4);
        const right = k.options.filter(o => o.correct);
        expect(right).toHaveLength(1);
        const endT = (t + d) % 720;
        expect(right[0].label).toBe(digital(Math.floor(endT / 60), endT % 60));
      }
    }
  });
  it('3:45 + 30 хв → пастка переносу 3:15', () => {
    const k = elapsedTask(3, 45, 30, 0);
    expect(k.options.find(o => o.label === '3:15')?.trap).toBe('carry');
    expect(k.options.find(o => o.correct)!.label).toBe('4:15');
  });
});

describe('розпорядок дня', () => {
  it('у кожної дії є двійник з іншої половини доби', () => {
    for (const a of ROUTINE) {
      const t = twinOf(a);
      expect(t, a.id).toBeDefined();
      expect(Math.abs(t!.h24 - a.h24)).toBe(12);
    }
  });
  it('завдання мають 4 різні варіанти й пастку ampm', () => {
    for (const a of ROUTINE) {
      for (const kind of ['what', 'write'] as const) {
        const k = routineTask(a, kind, ROUTINE);
        expect(new Set(k.options.map(o => o.label)).size).toBe(4);
        expect(k.options.filter(o => o.correct)).toHaveLength(1);
        expect(k.options.some(o => o.trap === 'ampm')).toBe(true);
      }
    }
  });
});

import { shuffle } from '../src/core/rng';

describe('shuffle', () => {
  it('ставить правильну відповідь на кожне місце приблизно порівну', () => {
    const pos = [0, 0, 0, 0];
    for (let i = 0; i < 8000; i++) pos[shuffle([0, 1, 2, 3]).indexOf(0)]++;
    for (const n of pos) expect(n).toBeGreaterThan(1700);
  });
});
