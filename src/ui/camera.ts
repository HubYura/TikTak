/* «Камера» — плавна зміна viewBox. */

import { reducedMotion } from '../lib/fx';

export type Box = [number, number, number, number];

let svg: SVGSVGElement;
let cur: Box = [0, 0, 900, 620];
let from: Box = cur, to: Box = cur;
let t0 = 0, dur = 0;
let onResize: (() => void) | null = null;

export function initCamera(s: SVGSVGElement, resized: () => void): void {
  svg = s;
  onResize = resized;
}

const apply = (b: Box) => svg.setAttribute('viewBox', b.map(v => v.toFixed(1)).join(' '));

export function camera(b: Box, ms = 0): void {
  const aspectChanged = Math.abs(b[2] / b[3] - cur[2] / cur[3]) > 0.01;
  if (!ms || reducedMotion() || aspectChanged) {
    // Зміна пропорцій змінює висоту сцени — її не анімуємо, щоб верстка не «дихала»
    cur = from = to = b; dur = 0;
    apply(b);
    requestAnimationFrame(() => onResize?.());
    return;
  }
  from = cur; to = b; t0 = performance.now(); dur = ms;
}

export function cameraTick(now: number): void {
  if (!dur) return;
  const k = Math.min(1, (now - t0) / dur);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  cur = from.map((v, i) => v + (to[i] - v) * e) as Box;
  apply(cur);
  if (k >= 1) dur = 0;
}
