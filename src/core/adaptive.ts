/* Адаптивний добір завдань.

   1. Пастки. Коли серед варіантів є відволікач із певною пасткою, це «експозиція».
      Якщо дитина його обрала — «потрапляння». Слабкість = згладжена частка потраплянь.
   2. Прицільні питання. Чим сильніша слабкість, тим частіше питання будуються так,
      щоб у них була саме ця пастка.
   3. Повтор. Помилкове питання повертається через кілька кроків — уже з іншими варіантами.
   4. Перемішування. Час від часу підкидаємо питання з уже пройденого рівня. */

import type { Progress, ReviewItem, TaskKind } from './progress';
import type { Trap } from './questions';
import { type Rng, pick, rnd } from './rng';

export const weakness = (s: { seen: number; fell: number }): number => (s.fell + 0.5) / (s.seen + 2);

/** Пастка вважається справжньою проблемою, лише коли даних достатньо. */
export const isWeak = (s: { seen: number; fell: number }): boolean => s.seen >= 3 && weakness(s) >= 0.34;

export function recordTraps(p: Progress, exposed: Trap[], fell: Trap | undefined): void {
  for (const t of new Set(exposed)) {
    const s = p.traps[t];
    s.seen++;
    if (fell === t) s.fell++;
    // Ковзне вікно: старі помилки поступово забуваються, коли дитина навчилась
    if (s.seen > 20) { s.seen *= 0.8; s.fell *= 0.8; }
  }
}

export interface Plan {
  h: number; m: number; kind: TaskKind; level: number;
  reason: 'review' | 'focus' | 'mix' | 'normal';
  focus?: Trap;
}

/* Як «викликати» кожну пастку: які хвилини й тип завдання її містять. */
const TRAP_RECIPE: Partial<Record<Trap, { kinds: TaskKind[]; ok: (m: number) => boolean }>> = {
  hourNext:   { kinds: ['read', 'set'], ok: m => m > 30 },
  swap:       { kinds: ['read'],        ok: m => m % 5 === 0 },
  decimal:    { kinds: ['read'],        ok: m => m === 30 },
  literal:    { kinds: ['read'],        ok: m => m === 15 || m === 45 },
  quarterDir: { kinds: ['say'],         ok: m => m === 15 || m === 45 },
  halfCur:    { kinds: ['say'],         ok: m => m === 30 }
};

/** Що вже було нещодавно — щоб питання не повторювались. */
export interface Recent { h: number; m: number; kind: TaskKind }

/** Той самий час у кількох останніх питаннях або той самий тип тричі поспіль — надто схоже. */
export function tooSimilar(t: Recent, recent: Recent[]): boolean {
  const last = recent.slice(-4);
  if (last.some(x => x.h === t.h && x.m === t.m)) return true;
  const two = recent.slice(-2);
  if (two.length === 2 && two.every(x => x.kind === t.kind)) return true;
  const one = recent[recent.length - 1];
  return !!one && one.m === t.m && one.kind === t.kind;
}

/* Помилку повторюємо іншим способом: читав годинник — тепер став стрілки, і навпаки.
   Так це повтор думки, а не завчена відповідь. */
const REVIEW_SWAP: Record<TaskKind, TaskKind> = { read: 'set', set: 'read', say: 'say' };

export function planTask(
  p: Progress, level: number, levelMins: number[][], r: Rng = Math.random, recent: Recent[] = []
): Plan {
  const asked = p.totals.asked;

  // 1. Повтор помилки, якщо настав її час (правила схожості його не стосуються)
  const dueIdx = p.review.findIndex(x => x.due <= asked && x.level <= level);
  if (dueIdx >= 0 && r() < 0.7) {
    const it = p.review[dueIdx];
    return { h: it.h, m: it.m, kind: REVIEW_SWAP[it.kind], level: it.level, reason: 'review' };
  }

  let plan = planFresh(p, level, levelMins, r, recent);
  for (let i = 0; i < 20 && tooSimilar(plan, recent); i++) plan = planFresh(p, level, levelMins, r, recent);
  return plan;
}

function planFresh(p: Progress, level: number, levelMins: number[][], r: Rng, recent: Recent[]): Plan {

  const mins = levelMins[level];
  let h = 1 + rnd(12, r);
  // Для swap-пастки годинна стрілка не повинна збігатися з хвилинною
  const kinds: TaskKind[] = ['read', 'say', 'set'];

  // 2. Прицільне питання на найслабшу пастку, доступну на цьому рівні
  const candidates = (Object.keys(TRAP_RECIPE) as Trap[])
    .map(t => ({ t, w: weakness(p.traps[t]), rc: TRAP_RECIPE[t]! }))
    .filter(c => p.traps[c.t].seen >= 2 && mins.some(c.rc.ok))
    .sort((a, b) => b.w - a.w);
  const top = candidates[0];
  // Прицільне — не двічі поспіль, щоб раунд не складався з однієї пастки
  const lastFocus = recent.length > 0 && TRAP_RECIPE[top?.t as Trap]?.ok(recent[recent.length - 1].m);
  if (top && !lastFocus && r() < Math.min(0.6, top.w * 1.4)) {
    const m = pick(mins.filter(top.rc.ok), r);
    if (top.t === 'swap' && m !== 0 && (h % 12) === m / 5) h = (h % 12) + 1;
    return { h, m, kind: pick(top.rc.kinds, r), level, reason: 'focus', focus: top.t };
  }

  // 3. Перемішування з попереднім рівнем
  if (level > 0 && r() < 0.15) {
    const lv = rnd(level, r);
    return { h, m: pick(levelMins[lv], r), kind: pick(kinds, r), level: lv, reason: 'mix' };
  }

  return { h, m: pick(mins, r), kind: pick(kinds, r), level, reason: 'normal' };
}

/** Після відповіді: помилка стає в чергу на повтор, виправлена — виходить із неї. */
export function scheduleReview(p: Progress, plan: Plan, ok: boolean): boolean {
  // За часом, а не за типом: повтор іде іншим типом завдання
  const i = p.review.findIndex(x => x.h === plan.h && x.m === plan.m);
  let fixed = false;
  if (ok && i >= 0) { p.review.splice(i, 1); fixed = true; }
  if (!ok) {
    const item: ReviewItem = { h: plan.h, m: plan.m, kind: plan.kind, level: plan.level, due: p.totals.asked + 3 };
    if (i >= 0) p.review[i] = item; else p.review.push(item);
    if (p.review.length > 12) p.review.shift();
  }
  return fixed;
}
