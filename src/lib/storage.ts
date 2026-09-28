import type { KV } from '../core/progress';

/** Доступ до localStorage, що переживає приватний режим і заблоковані дані сайту. */
export const store: KV | null = (() => {
  try {
    const s = window.localStorage;
    const k = '__chasopark_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
})();

export function getFlag(key: string, dflt: boolean): boolean {
  try { const v = store?.getItem(key); return v == null ? dflt : v === '1'; } catch { return dflt; }
}
export function setFlag(key: string, v: boolean): void {
  try { store?.setItem(key, v ? '1' : '0'); } catch { /* не зберігаємо */ }
}
