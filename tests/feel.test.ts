import { describe, expect, it } from 'vitest';
import { ACTIVITIES, BUCKETS, bucketOf, feelTask, judgeEstimate } from '../src/core/feel';
import { seeded } from '../src/core/rng';

describe('«Скільки триває хвилина?»', () => {
  it('щедро, але чесно оцінює спробу', () => {
    expect(judgeEstimate(10, 10.4)).toBe(true);
    expect(judgeEstimate(10, 12)).toBe(true);
    expect(judgeEstimate(10, 13)).toBe(false);
    expect(judgeEstimate(5, 3)).toBe(true);   // для коротких — щонайменше ±2 с
    expect(judgeEstimate(60, 46)).toBe(true);
    expect(judgeEstimate(60, 40)).toBe(false);
  });

  it('кожна справа потрапляє рівно в один кошик', () => {
    for (const a of ACTIVITIES) expect(BUCKETS.map(b => b.label)).toContain(bucketOf(a.minutes));
  });

  it('завдання завжди мають одну правильну відповідь серед різних', () => {
    const r = seeded(3);
    const modes = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = feelTask(r, i % 2 === 0);
      modes.add(t.mode);
      if (t.mode === 'estimate') {
        expect(t.seconds).toBeGreaterThanOrEqual(5);
        expect(t.seconds).toBeLessThanOrEqual(60);
        continue;
      }
      expect(t.options.filter(o => o.correct)).toHaveLength(1);
      expect(new Set(t.options.map(o => o.label)).size).toBe(t.options.length);
      expect(t.explain.length).toBeGreaterThan(10);
    }
    expect([...modes].sort()).toEqual(['compare', 'estimate', 'howlong']);
  });

  it('у «що довше» справи відрізняються щонайменше втричі', () => {
    const r = seeded(9);
    for (let i = 0; i < 300; i++) {
      const t = feelTask(r);
      if (t.mode !== 'compare') continue;
      const [a, b] = t.options.map(o => ACTIVITIES.find(x => o.label.endsWith(x.what))!);
      const long = t.options[0].correct ? a : b, short = t.options[0].correct ? b : a;
      expect(long.minutes / short.minutes).toBeGreaterThanOrEqual(3);
    }
  });
});
