import { describe, expect, it } from 'vitest';
import { durWords, fmtDur, planningTask, type PlanKind } from '../src/core/planning';
import { seeded } from '../src/core/rng';

const minutes = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const durOf = (s: string) => (Number(s.match(/(\d+) год/)?.[1] ?? 0) * 60) + Number(s.match(/(\d+) хв/)?.[1] ?? 0);

describe('Плануємо день', () => {
  it('тривалість коротко', () => {
    expect(fmtDur(95)).toBe('1 год 35 хв');
    expect(fmtDur(120)).toBe('2 год');
    expect(fmtDur(45)).toBe('45 хв');
    expect(durWords(95)).toBe('1 година 35 хвилин');
    expect(durWords(605)).toBe('10 годин 5 хвилин');
    expect(durWords(142)).toBe('2 години 22 хвилини');
  });

  for (const kind of ['end', 'start', 'between', 'midnight'] as PlanKind[]) {
    it(`${kind}: одна правильна відповідь, чотири різні варіанти, правильна — справді правильна`, () => {
      const r = seeded(7);
      for (let i = 0; i < 300; i++) {
        const t = planningTask(r, kind);
        expect(t.options).toHaveLength(4);
        expect(new Set(t.options.map(o => o.label)).size).toBe(4);
        expect(t.options.filter(o => o.correct)).toHaveLength(1);
        const right = t.options.find(o => o.correct)!.label;
        if (kind === 'end') expect(minutes(right)).toBe(t.to % 1440);
        if (kind === 'start') expect(minutes(right)).toBe(t.to);
        if (kind === 'between' || kind === 'midnight') expect(durOf(right)).toBe(t.to - t.from);
      }
    });
  }

  it('типові помилки серед варіантів', () => {
    const r = seeded(3);
    const t = planningTask(r, 'between');
    expect(t.options.some(o => o.trap === 'decimal')).toBe(true);
    const n = planningTask(r, 'midnight');
    expect(n.options.some(o => o.trap === 'ampm')).toBe(true);
    expect(n.text).toMatch(/спав|політ/);
  });
});
