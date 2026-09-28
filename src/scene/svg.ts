export const NS = 'http://www.w3.org/2000/svg';

export type Pt = [number, number];
type Attrs = Record<string, string | number>;

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs, parent: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  parent.appendChild(n);
  return n;
}

export const group = (id: string, parent: Element): SVGGElement => el('g', { id }, parent);

export const poly = (points: Pt[], fill: string, parent: Element, extra: Attrs = {}): SVGPolygonElement =>
  el('polygon', { points: points.map(p => p.join(',')).join(' '), fill, ...extra }, parent);

/** Ізометричний блок: передня, бічна й верхня грані. */
export function isoBlock(parent: Element, x1: number, x2: number, yTop: number, yBot: number, depth: number,
  cFront: string, cSide: string, cTop: string): void {
  poly([[x1, yTop], [x2, yTop], [x2, yBot], [x1, yBot]], cFront, parent);
  poly([[x2, yTop], [x2 + depth, yTop - depth * 0.55], [x2 + depth, yBot - depth * 0.55], [x2, yBot]], cSide, parent);
  poly([[x1, yTop], [x1 + depth, yTop - depth * 0.55], [x2 + depth, yTop - depth * 0.55], [x2, yTop]], cTop, parent);
}

export const tr = (x: number, y: number, s = 1, r = 0): string =>
  'translate(' + x + ' ' + y + ')' + (s !== 1 ? ' scale(' + s + ')' : '') + (r ? ' rotate(' + r + ')' : '');
