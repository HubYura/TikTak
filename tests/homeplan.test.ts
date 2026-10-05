import { describe, expect, it } from 'vitest';
import { recordTraps } from '../src/core/adaptive';
import { homePlan, weakTraps } from '../src/core/homeplan';
import { blankProgress } from '../src/core/progress';
import { TRAPS } from '../src/core/questions';

describe('план на тиждень удома', () => {
  it('без помилок — три заняття під поточний рівень', () => {
    const p = blankProgress(5);
    p.unlocked = 2;
    const plan = homePlan(p);
    expect(plan.items).toHaveLength(3);
    expect(plan.focus).toContain('чверті');
    expect(plan.items.map(i => i.day)).toEqual(['Понеділок', 'Середа', 'П’ятниця']);
  });

  it('найчастіша помилка йде першою й займає два дні з трьох', () => {
    const p = blankProgress(5);
    for (let i = 0; i < 6; i++) recordTraps(p, ['quarterDir'], 'quarterDir');
    for (let i = 0; i < 4; i++) recordTraps(p, ['decimal'], 'decimal');
    expect(weakTraps(p)[0]).toBe('quarterDir');
    const plan = homePlan(p);
    expect(plan.focus).toMatch(/^Цього тижня — розрізняти «чверть на»/);
    expect(plan.focus).toContain('60 хвилин');
    expect(plan.items[0].title).not.toBe(plan.items[2].title);
    expect(plan.items[1].title).toBe('Піца-годинник');
  });

  it('для кожної помилки є план без порожніх полів', () => {
    for (const t of TRAPS) {
      const p = blankProgress(5);
      for (let i = 0; i < 5; i++) recordTraps(p, [t], t);
      for (const it of homePlan(p).items) {
        expect(it.title && it.how && it.need).toBeTruthy();
      }
    }
  });

  it('рівень поза межами не ламає план', () => {
    const p = blankProgress(5);
    p.unlocked = 99;
    expect(homePlan(p).items).toHaveLength(3);
  });
});
