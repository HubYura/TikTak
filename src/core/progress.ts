/* Прогрес дитини. Живе лише на пристрої — жодних акаунтів і серверів. */

import { TRAPS, type Trap } from './questions';

export type TaskKind = 'read' | 'say' | 'set';

export interface LevelRec { stars: number; best: number; asked: number; right: number }
export interface TrapStat { seen: number; fell: number }
export interface ReviewItem { h: number; m: number; kind: TaskKind; level: number; due: number }
export interface DayRec { asked: number; right: number; ms: number }

export interface Progress {
  v: 2;
  unlocked: number;
  level: number;
  levels: LevelRec[];
  adventures: { routine: LevelRec; elapsed: LevelRec };
  seen: number[];
  badges: string[];
  park: string[];            // атракціони, які вже відсвяткували
  welcomed: boolean;
  totals: { asked: number; right: number; streak: number; bestStreak: number; fixed: number };
  traps: Record<Trap, TrapStat>;
  review: ReviewItem[];
  days: Record<string, DayRec>;
  settings: { voice: boolean; autoRead: boolean };
}

export const STORE_V1 = 'chasopark.progress.v1';
export const STORE = 'chasopark.progress.v2';

const rec = (): LevelRec => ({ stars: 0, best: 0, asked: 0, right: 0 });

export function blankProgress(levels: number): Progress {
  return {
    v: 2,
    unlocked: 0,
    level: 0,
    levels: Array.from({ length: levels }, rec),
    adventures: { routine: rec(), elapsed: rec() },
    seen: [],
    badges: [],
    park: [],
    welcomed: false,
    totals: { asked: 0, right: 0, streak: 0, bestStreak: 0, fixed: 0 },
    traps: Object.fromEntries(TRAPS.map(t => [t, { seen: 0, fell: 0 }])) as Record<Trap, TrapStat>,
    review: [],
    days: {},
    settings: { voice: true, autoRead: true }
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** Приводить будь-який збережений запис (v1 або v2) до поточної форми.
    Невідомі чи зіпсовані поля замінюються типовими — прогрес дитини не губиться через дрібницю. */
export function migrate(raw: unknown, levels: number): Progress | null {
  if (!isObj(raw) || (raw.v !== 1 && raw.v !== 2)) return null;
  if (!Array.isArray(raw.levels) || raw.levels.length !== levels) return null;

  const p = blankProgress(levels);
  p.unlocked = Math.max(0, Math.min(levels - 1, num(raw.unlocked)));
  p.level = Math.max(0, Math.min(p.unlocked, num(raw.level)));
  p.levels = raw.levels.map((l: unknown) => {
    const o = isObj(l) ? l : {};
    return { stars: num(o.stars), best: num(o.best), asked: num(o.asked), right: num(o.right) };
  });
  if (Array.isArray(raw.seen)) p.seen = raw.seen.filter((x): x is number => typeof x === 'number');
  if (Array.isArray(raw.badges)) p.badges = raw.badges.filter((x): x is string => typeof x === 'string');
  if (Array.isArray(raw.park)) p.park = raw.park.filter((x): x is string => typeof x === 'string');
  // У v1 не було прапорця привітання в найперших записах — ці діти вже бачили гру.
  p.welcomed = typeof raw.welcomed === 'boolean' ? raw.welcomed : true;

  if (isObj(raw.totals)) {
    const t = raw.totals;
    p.totals = { asked: num(t.asked), right: num(t.right), streak: num(t.streak),
                 bestStreak: num(t.bestStreak), fixed: num(t.fixed) };
  }
  if (isObj(raw.adventures)) {
    for (const k of ['routine', 'elapsed'] as const) {
      const a = raw.adventures[k];
      if (isObj(a)) p.adventures[k] = { stars: num(a.stars), best: num(a.best), asked: num(a.asked), right: num(a.right) };
    }
  }
  if (isObj(raw.traps)) {
    for (const t of TRAPS) {
      const s = raw.traps[t];
      if (isObj(s)) p.traps[t] = { seen: num(s.seen), fell: num(s.fell) };
    }
  }
  if (Array.isArray(raw.review)) {
    p.review = raw.review.filter(isObj).map(r => ({
      h: num(r.h, 12), m: num(r.m), kind: (['read', 'say', 'set'].includes(r.kind as string) ? r.kind : 'read') as TaskKind,
      level: num(r.level), due: num(r.due)
    })).slice(-12);
  }
  if (isObj(raw.days)) {
    for (const [k, v] of Object.entries(raw.days)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(v)) p.days[k] = { asked: num(v.asked), right: num(v.right), ms: num(v.ms) };
    }
  }
  if (isObj(raw.settings)) {
    p.settings = {
      voice: typeof raw.settings.voice === 'boolean' ? raw.settings.voice : true,
      autoRead: typeof raw.settings.autoRead === 'boolean' ? raw.settings.autoRead : true
    };
  }
  return p;
}

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

/** localStorage може кинути виняток (приватний режим, заблоковані дані сайту) —
    у такому разі гра працює повністю, просто без збереження. */
export function loadProgress(store: KV | null, levels: number): Progress {
  try {
    if (!store) return blankProgress(levels);
    const v2 = store.getItem(STORE);
    if (v2) { const p = migrate(JSON.parse(v2), levels); if (p) return p; }
    const v1 = store.getItem(STORE_V1);
    if (v1) { const p = migrate(JSON.parse(v1), levels); if (p) return p; }
  } catch { /* зіпсований запис — починаємо спочатку */ }
  return blankProgress(levels);
}

export function saveProgress(store: KV | null, p: Progress): void {
  try { store?.setItem(STORE, JSON.stringify(p)); } catch { /* просто не зберігаємо */ }
}

export const dayKey = (d = new Date()): string =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function logAnswer(p: Progress, ok: boolean, now = new Date()): void {
  const k = dayKey(now);
  const d = p.days[k] || (p.days[k] = { asked: 0, right: 0, ms: 0 });
  d.asked++;
  if (ok) d.right++;
  // Тримаємо лише останні 60 днів
  const keys = Object.keys(p.days).sort();
  while (keys.length > 60) delete p.days[keys.shift()!];
}

export function logTime(p: Progress, ms: number, now = new Date()): void {
  const k = dayKey(now);
  const d = p.days[k] || (p.days[k] = { asked: 0, right: 0, ms: 0 });
  d.ms += ms;
}
