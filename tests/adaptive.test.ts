import { describe, expect, it } from 'vitest';
import { isWeak, planTask, recordTraps, scheduleReview, weakness } from '../src/core/adaptive';
import { LEVELS } from '../src/core/content';
import { blankProgress } from '../src/core/progress';
import { seeded } from '../src/core/rng';

const mins = LEVELS.map(l => l.mins);

describe('адаптивний добір', () => {
  it('слабкість росте з потрапляннями й забувається з часом', () => {
    const p = blankProgress(5);
    expect(isWeak(p.traps.decimal)).toBe(false);
    for (let i = 0; i < 4; i++) recordTraps(p, ['decimal'], 'decimal');
    expect(isWeak(p.traps.decimal)).toBe(true);
    const before = weakness(p.traps.decimal);
    for (let i = 0; i < 30; i++) recordTraps(p, ['decimal'], undefined);
    expect(weakness(p.traps.decimal)).toBeLessThan(before);
    expect(isWeak(p.traps.decimal)).toBe(false);
  });

  it('частіше дає питання на слабку пастку', () => {
    const count = (weak: boolean) => {
      const p = blankProgress(5);
      if (weak) for (let i = 0; i < 5; i++) recordTraps(p, ['quarterDir'], 'quarterDir');
      const r = seeded(42);
      let hits = 0;
      for (let i = 0; i < 1000; i++) {
        const t = planTask(p, 2, mins, r);
        if (t.kind === 'say' && (t.m === 15 || t.m === 45)) hits++;
      }
      return hits;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 2);
  });

  it('повертає помилку на повтор і знімає її після виправлення', () => {
    const p = blankProgress(5);
    const plan = { h: 3, m: 30, kind: 'read' as const, level: 1, reason: 'normal' as const };
    p.totals.asked = 10;
    scheduleReview(p, plan, false);
    expect(p.review).toHaveLength(1);
    expect(p.review[0].due).toBe(13);
    p.totals.asked = 13;
    const r = seeded(1);
    let got = false;
    for (let i = 0; i < 20 && !got; i++) got = planTask(p, 1, mins, r).reason === 'review';
    expect(got).toBe(true);
    expect(scheduleReview(p, plan, true)).toBe(true);
    expect(p.review).toHaveLength(0);
  });

  it('ніколи не виходить за межі відкритого рівня', () => {
    const p = blankProgress(5);
    const r = seeded(7);
    for (let i = 0; i < 500; i++) {
      const t = planTask(p, 1, mins, r);
      expect(t.level).toBeLessThanOrEqual(1);
      expect(LEVELS[t.level].mins).toContain(t.m);
      expect(t.h).toBeGreaterThanOrEqual(1);
      expect(t.h).toBeLessThanOrEqual(12);
    }
  });
});
