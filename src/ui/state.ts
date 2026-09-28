import { LEVELS } from '../core/content';
import { loadProgress, saveProgress } from '../core/progress';
import { store } from '../lib/storage';
import type { SceneRefs } from '../scene/scene';

export type Mode = 'learn' | 'practice';

export const app = {
  mode: 'learn' as Mode,
  p: loadProgress(store, LEVELS.length),
  S: null as unknown as SceneRefs,
  /** Показ циферблата у хвилинах від півночі (0..1440, дробові — для плавності). */
  clockMins: 540,
  save(): void { saveProgress(store, this.p); }
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const n = document.getElementById(id);
  if (!n) throw new Error('Немає елемента #' + id);
  return n as T;
};

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Partial<Record<string, string>> = {}, ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

export const anyOf = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
