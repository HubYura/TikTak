export type Rng = () => number;

export const rnd = (n: number, r: Rng = Math.random): number => Math.floor(r() * n);
export const pick = <T>(a: readonly T[], r: Rng = Math.random): T => a[rnd(a.length, r)];

export function shuffle<T>(a: T[], r: Rng = Math.random): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1, r);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Детермінований генератор для тестів (mulberry32). */
export function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
