import { describe, expect, it } from 'vitest';
import { dialDiff, judgeHome } from '../src/core/homeclock';
import { toDial } from '../src/core/time';

describe('годинник удома', () => {
  it('різниця на циферблаті — найкоротшим шляхом', () => {
    expect(dialDiff(5, 715)).toBe(10);
    expect(dialDiff(715, 5)).toBe(-10);
    expect(dialDiff(360, 0)).toBe(-360);
  });

  it('приймає з запасом і не зважає на ранок/вечір', () => {
    expect(judgeHome(19, 42, toDial(7, 40)).ok).toBe(true);
    expect(judgeHome(19, 42, toDial(7, 45)).ok).toBe(true);
    expect(judgeHome(11, 58, toDial(12, 0)).ok).toBe(true);
    expect(judgeHome(19, 42, toDial(7, 30)).ok).toBe(false);
  });

  it('помічає коротку стрілку на сусідньому числі', () => {
    expect(judgeHome(7, 40, toDial(8, 40))).toMatchObject({ ok: false, hint: 'hour' });
    expect(judgeHome(7, 40, toDial(6, 40))).toMatchObject({ ok: false, hint: 'hour' });
  });

  it('помічає переплутані стрілки', () => {
    // 3:10 — коротка на 3, довга на 2; дитина поставила 2:15
    expect(judgeHome(15, 10, toDial(2, 15))).toMatchObject({ ok: false, hint: 'swap' });
  });

  it('інакше — просить глянути на довгу стрілку', () => {
    expect(judgeHome(7, 40, toDial(7, 10))).toMatchObject({ ok: false, hint: 'minute' });
  });
});
