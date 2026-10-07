import { describe, expect, it } from 'vitest';
import { STORE, STORE_V1, blankProgress, dailyDone, exportCode, exportProgress, importProgress, loadProgress, logAnswer, markDaily, migrate, saveProgress } from '../src/core/progress';

const mem = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('прогрес', () => {
  it('переносить запис v1 без втрати зірок', () => {
    const v1 = {
      v: 1, unlocked: 2, level: 1,
      levels: [{ stars: 3, best: 5 }, { stars: 2, best: 4 }, { stars: 0, best: 1 }, { stars: 0, best: 0 }, { stars: 0, best: 0 }],
      seen: [0, 1, 2], totals: { asked: 20, right: 15, streak: 2, bestStreak: 7 }
    };
    const p = loadProgress(mem({ [STORE_V1]: JSON.stringify(v1) }), 5);
    expect(p.v).toBe(2);
    expect(p.unlocked).toBe(2);
    expect(p.levels[0].stars).toBe(3);
    expect(p.totals.bestStreak).toBe(7);
    expect(p.totals.fixed).toBe(0);
    expect(p.welcomed).toBe(true);
    expect(p.badges).toEqual([]);
    expect(p.traps.swap).toEqual({ seen: 0, fell: 0 });
    expect(p.adventures.feel).toEqual({ stars: 0, best: 0, asked: 0, right: 0 });
    expect(p.adventures.faces.stars).toBe(0);
  });

  it('відкидає несумісне й не падає на смітті', () => {
    expect(migrate({ v: 9 }, 5)).toBeNull();
    expect(migrate({ v: 1, levels: [] }, 5)).toBeNull();
    expect(loadProgress(mem({ [STORE]: '{not json' }), 5).v).toBe(2);
    const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadProgress(throwing, 5).unlocked).toBe(0);
    expect(() => saveProgress(throwing, blankProgress(5))).not.toThrow();
  });

  it('зберігає й читає назад', () => {
    const s = mem();
    const p = blankProgress(5);
    p.unlocked = 3; p.traps.decimal = { seen: 4, fell: 2 };
    saveProgress(s, p);
    expect(loadProgress(s, 5)).toEqual(p);
  });

  it('веде денну статистику й тримає лише 60 днів', () => {
    const p = blankProgress(5);
    for (let i = 0; i < 70; i++) logAnswer(p, i % 2 === 0, new Date(2026, 0, 1 + i));
    expect(Object.keys(p.days)).toHaveLength(60);
    expect(p.days['2026-03-11']).toEqual({ asked: 1, right: 0, ms: 0 });
  });
});

describe('хвилинка часу', () => {
  it('рахує дні поспіль і раз на день', () => {
    const p = blankProgress(5);
    expect(markDaily(p, new Date(2026, 9, 5, 8))).toBe(true);
    expect(markDaily(p, new Date(2026, 9, 5, 19))).toBe(false);
    expect(markDaily(p, new Date(2026, 9, 6, 8))).toBe(true);
    expect(p.daily).toMatchObject({ streak: 2, best: 2, count: 2 });
    expect(dailyDone(p, new Date(2026, 9, 6, 22))).toBe(true);
    markDaily(p, new Date(2026, 9, 9, 8));
    expect(p.daily).toMatchObject({ streak: 1, best: 2, count: 3 });
  });

  it('переживає збереження й зіпсовані дані', () => {
    const p = blankProgress(5);
    markDaily(p, new Date(2026, 0, 31));
    markDaily(p, new Date(2026, 1, 1));
    expect(migrate(JSON.parse(JSON.stringify(p)), 5)!.daily.streak).toBe(2);
    expect(migrate({ ...p, daily: { last: 'вчора', streak: 'x' } }, 5)!.daily).toEqual({ last: '', streak: 0, best: 0, count: 0 });
  });
});

describe('налаштування озвучки', () => {
  it('варіанти зачитуються типово, а вимкнене зберігається', () => {
    expect(blankProgress(5).settings.readOptions).toBe(true);
    const p = blankProgress(5);
    p.settings.readOptions = false;
    expect(migrate(JSON.parse(JSON.stringify(p)), 5)!.settings.readOptions).toBe(false);
    const { readOptions: _, ...old } = p.settings;
    expect(migrate({ ...p, settings: old }, 5)!.settings.readOptions).toBe(true);
  });
});

describe('резервна копія', () => {
  const sample = () => {
    const p = blankProgress(5);
    p.unlocked = 3; p.totals.asked = 42; p.badges = ['sharp', 'daily'];
    markDaily(p, new Date(2026, 9, 5));
    return p;
  };

  it('файл і код відновлюють той самий прогрес', () => {
    const p = sample();
    expect(importProgress(exportProgress(p), 5)).toEqual(p);
    const code = exportCode(p);
    expect(code.startsWith('CP1-')).toBe(true);
    expect(importProgress(code, 5)).toEqual(p);
    expect(importProgress('  ' + code.slice(0, 20) + '\n' + code.slice(20) + '  ', 5)).toEqual(p);
  });

  it('чуже чи зіпсоване не приймає', () => {
    expect(importProgress('{"app":"other","progress":{}}', 5)).toBeNull();
    expect(importProgress('CP1-!!!', 5)).toBeNull();
    expect(importProgress('просто текст', 5)).toBeNull();
    expect(importProgress(exportProgress(blankProgress(5)), 4)).toBeNull();   // інша кількість рівнів
  });
});
