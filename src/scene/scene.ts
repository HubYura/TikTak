/* Ізометрична сцена: летючий острів-парк, годинникова вежа й атракціони.
   Уся графіка — пласке SVG у два-три тони на матеріал, без растру. */

import { el, group, isoBlock, poly, tr, type Pt } from './svg';

export const OX = 450, OY = 470;          // центр ізометричної сітки
export const TW = 76, TH = 38;            // ширина / висота плитки
export const CX = 450, CY = 188, R = 96;  // центр і радіус циферблата

export const iso = (i: number, j: number): Pt => [OX + (i - j) * TW / 2, OY + (i + j) * TH / 2];
export const polar = (a: number, r: number): Pt => [
  CX + r * Math.sin(a * Math.PI / 180),
  CY - r * Math.cos(a * Math.PI / 180)
];

/* Палітра сцени — соковита, зі світлом зліва згори */
export const C = {
  grassTop: '#a6ef7a', grassAlt: '#94e066', grassSide: '#6fbf45', grassDeep: '#4f9a2e',
  pathTop: '#fff1c9', pathAlt: '#ffe39a',
  soil: '#8b6cff', soilDeep: '#6a4de0',
  wood: '#b9a4ff', woodTop: '#d4c6ff', woodSide: '#8b6cff', woodDeep: '#6a4de0',
  stone: '#fff7e6', stoneTop: '#ffffff', stoneSide: '#d9cfe8',
  roof: '#ff7a3d', roofLight: '#ffa06e', roofSide: '#d9582a',
  gold: '#ffd23f', goldDark: '#d9a40b',
  dial: '#ffffff', minBand: '#eaf5ff', bezel: '#15111f',
  ink: '#15111f', tickMin: '#a9b8c8',
  hourHand: '#ff5a5f', hourHandD: '#c73c43',
  minHand: '#2d8cff', minHandD: '#1560c2',
  secHand: '#ff9f1a',
  leafA: '#2ec4b6', leafB: '#5fdcc9', leafC: '#9ff0e2',
  water: '#7ee3f2', waterD: '#3fb8d6'
};

export interface Part { el: SVGGElement; kids: SVGElement[] | null }

export interface SceneRefs {
  svg: SVGSVGElement;
  parts: Record<string, Part>;
  skyA: SVGStopElement; skyB: SVGStopElement;
  hourHand: SVGGElement; minHand: SVGGElement; secHand: SVGGElement;
  face: SVGGElement; world: SVGGElement; grab: SVGCircleElement;
  sunInner: SVGGElement; sunBody: SVGCircleElement; sunGlow: SVGCircleElement;
  stars: SVGGElement;
  clouds: { node: SVGGElement; x: number; y: number; s: number }[];
  peeps: { node: SVGGElement; axis: number; t: number; speed: number }[];
  park: Record<string, SVGGElement>;
  faceRefs: FaceRefs;
  anim: { wheel: SVGGElement; cabins: SVGGElement[]; horses: SVGGElement; water: SVGGElement[];
          balloon: SVGGElement; fireworks: SVGGElement };
}

export type FaceStyle = 'teach' | 'classic' | 'roman' | 'minimal';

interface FaceRefs {
  dial: SVGCircleElement; glass: SVGPathElement;
  hourNums: SVGTextElement[]; minNums: SVGGElement; band: SVGGElement;
  hourHand: SVGPolygonElement; minHand: SVGPolygonElement;
  hub: SVGCircleElement;
  hand: (len: number, halfW: number, tail: number) => string;
}

export function buildScene(svg: SVGSVGElement): SceneRefs {
  const parts: Record<string, Part> = {};
  const reg = (id: string, node: SVGGElement, kids?: SVGElement[]) => {
    if (kids) parts[id] = { el: node, kids };
    else { node.classList.add('part'); parts[id] = { el: node, kids: null }; }
  };

  const defs = el('defs', {}, svg);
  const sky = el('linearGradient', { id: 'skyGrad', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  const skyA = el('stop', { offset: 0, 'stop-color': '#7ee3f2' }, sky);
  const skyB = el('stop', { offset: 1, 'stop-color': '#c8f4fa' }, sky);

  /* Небо поза «світом»: нічне затемнення не повинно гасити сонце й місяць */
  const gSky = group('gSky', svg);
  el('rect', { x: -400, y: -200, width: 1700, height: 1100, fill: 'url(#skyGrad)' }, gSky);
  reg('sky', gSky);

  const stars = el('g', { class: 'night-stars', opacity: 0 }, svg);
  for (let i = 0; i < 38; i++) {
    const x = (i * 197) % 900, y = 12 + ((i * 89) % 230);
    el('circle', { cx: x, cy: y, r: i % 5 === 0 ? 1.8 : 1.1, fill: '#fff', opacity: 0.5 + (i % 3) * 0.2 }, stars);
  }

  /* Внутрішня група потрібна тому, що .part має власний CSS-transform */
  const gSun = group('gSun', svg);
  const sunInner = el('g', {}, gSun);
  const sunGlow = el('circle', { cx: 120, cy: 120, r: 40, fill: '#ffd76a', opacity: 0.28 }, sunInner);
  const sunBody = el('circle', { cx: 120, cy: 120, r: 26, fill: '#ffd76a' }, sunInner);
  reg('sun', gSun);

  const world = el('g', { id: 'world' }, svg);

  /* Хмари */
  const gClouds = group('gClouds', world);
  const clouds: SceneRefs['clouds'] = [];
  ([[130, 88, 1], [430, 50, 0.78], [720, 110, 1.18]] as const).forEach(([x, y, s]) => {
    const c = el('g', { transform: tr(x, y, s) }, gClouds);
    poly([[-48, 8], [-30, -12], [-6, -20], [18, -14], [40, 2], [48, 12]], '#ffffff', c);
    poly([[-48, 8], [48, 12], [36, 22], [-34, 20]], '#e1eef7', c);
    clouds.push({ node: c, x, y, s });
  });
  reg('clouds', gClouds);

  /* Повітряна куля — атракціон, що дрейфує в небі */
  const gBalloon = group('park-balloon', world);
  const balloon = el('g', {}, gBalloon);
  {
    const b = el('g', { transform: tr(772, 150) }, balloon);
    el('line', { x1: -12, y1: 24, x2: -8, y2: 52, stroke: '#6d4c2f', 'stroke-width': 1.5 }, b);
    el('line', { x1: 12, y1: 24, x2: 8, y2: 52, stroke: '#6d4c2f', 'stroke-width': 1.5 }, b);
    el('ellipse', { cx: 0, cy: 0, rx: 34, ry: 38, fill: '#ff5a5f' }, b);
    el('path', { d: 'M 0 -38 C -14 -30 -14 30 0 38 C 14 30 14 -30 0 -38 Z', fill: '#ffc93c' }, b);
    el('path', { d: 'M -34 0 C -30 22 -16 32 -12 34 L 12 34 C 16 32 30 22 34 0', fill: 'none' }, b);
    el('ellipse', { cx: -12, cy: -16, rx: 7, ry: 11, fill: '#fff', opacity: 0.35 }, b);
    poly([[-12, 30], [12, 30], [8, 38], [-8, 38]], '#d64048', b);
    poly([[-10, 52], [10, 52], [8, 66], [-8, 66]], C.wood, b);
    poly([[0, 52], [10, 52], [8, 66], [0, 66]], C.woodSide, b);
  }

  /* ---------- Земля: летючий острів ---------- */
  const gGround = group('gGround', world);
  poly([[222, 470], [450, 584], [450, 706]], C.soil, gGround);
  poly([[450, 584], [678, 470], [450, 706]], C.soilDeep, gGround);
  poly([[222, 470], [450, 584], [450, 600], [222, 486]], C.grassSide, gGround);
  poly([[450, 584], [678, 470], [678, 486], [450, 600]], C.grassDeep, gGround);
  ([[172, 545, 15], [726, 528, 12], [300, 640, 10]] as const).forEach(([x, y, r]) => {
    poly([[x - r, y], [x, y - r * 0.5], [x + r, y], [x, y + r * 0.5]], C.grassAlt, gGround);
    poly([[x - r, y], [x, y + r * 0.5], [x, y + r * 1.6]], C.soil, gGround);
    poly([[x, y + r * 0.5], [x + r, y], [x, y + r * 1.6]], C.soilDeep, gGround);
  });
  for (let s = -6; s <= 6; s++) {
    for (let i = -3; i <= 3; i++) {
      const j = s - i;
      if (j < -3 || j > 3) continue;
      const [x, y] = iso(i, j);
      const onPath = i === 0 || j === 0;
      const alt = (((i + j) % 2) + 2) % 2;
      const fill = onPath ? (alt ? C.pathTop : C.pathAlt) : (alt ? C.grassTop : C.grassAlt);
      poly([[x, y - TH / 2], [x + TW / 2, y], [x, y + TH / 2], [x - TW / 2, y]], fill, gGround);
    }
  }
  ([[-2, 0], [2, 0], [0, -2], [0, 2], [1.4, 0], [0, 1.4]] as const).forEach(([i, j]) => {
    const [x, y] = iso(i, j);
    poly([[x - 7, y], [x, y - 3.5], [x + 7, y], [x, y + 3.5]], '#d3b680', gGround);
  });
  // квіти по краях галявини
  ([[-2.2, -1.4, '#ff6b9a'], [1.6, 2.4, '#ffd23c'], [2.3, -1.3, '#b98bff'], [-1.4, 2.2, '#ff8c42']] as const)
    .forEach(([i, j, col]) => {
      const [x, y] = iso(i, j);
      for (let k = 0; k < 3; k++) el('circle', { cx: x + k * 7 - 7, cy: y + (k % 2) * 3, r: 3, fill: col }, gGround);
    });
  reg('ground', gGround);

  const gShadow = group('gShadow', world);
  el('ellipse', { cx: OX + 10, cy: OY + 8, rx: 132, ry: 38, fill: '#2f5a24', opacity: 0.3 }, gShadow);
  reg('shadow', gShadow);

  /* ---------- Декор парку ---------- */
  const gScenery = group('gScenery', world);
  const tree = (x: number, y: number, s: number) => {
    const g = el('g', { transform: tr(x, y, s) }, gScenery);
    poly([[-6, 0], [6, 0], [4, -24], [-4, -24]], C.woodSide, g);
    poly([[0, 0], [6, 0], [4, -24], [0, -24]], C.woodDeep, g);
    const blob = (cy: number, w: number, h: number, col: string) =>
      poly([[-w, cy], [-w * 0.72, cy - h * 0.62], [0, cy - h], [w * 0.72, cy - h * 0.62], [w, cy],
        [w * 0.6, cy + h * 0.28], [-w * 0.6, cy + h * 0.28]], col, g);
    blob(-20, 26, 30, C.leafA);
    blob(-38, 21, 26, C.leafB);
    blob(-54, 14, 20, C.leafC);
  };
  ([[-2.6, -2.6, 1], [2.6, -2.9, 0.86], [-1.2, -3, 0.8], [2.8, 2.7, 0.95], [-2.9, 2.9, 0.9], [1.6, 3.1, 0.8]] as const)
    .forEach(([i, j, s]) => { const [x, y] = iso(i, j); tree(x, y, s); });
  ([[-1.9, 1.9], [1.9, -1.9]] as const).forEach(([i, j]) => {
    const [x, y] = iso(i, j);
    poly([[x - 3, y], [x + 3, y], [x + 2, y - 42], [x - 2, y - 42]], '#5a6674', gScenery);
    poly([[x - 10, y - 42], [x + 10, y - 42], [x + 6, y - 58], [x - 6, y - 58]], C.gold, gScenery);
    el('circle', { cx: x, cy: y - 50, r: 13, fill: C.gold, opacity: 0.22 }, gScenery);
  });
  reg('scenery', gScenery);

  /* ---------- Атракціони (з'являються разом зі зірками) ---------- */
  const park: Record<string, SVGGElement> = {};
  park.balloon = gBalloon;

  // Колесо огляду — ліворуч
  const gWheel = group('park-wheel', world);
  let wheel: SVGGElement, cabins: SVGGElement[] = [];
  {
    const [bx, by] = iso(-2.3, 2.0);
    const cx = bx, cy = by - 88, r = 56;
    poly([[bx - 30, by], [bx - 24, by], [cx + 2, cy], [cx - 2, cy]], '#5b6b7d', gWheel);
    poly([[bx + 30, by], [bx + 24, by], [cx - 2, cy], [cx + 2, cy]], '#46556a', gWheel);
    wheel = el('g', { 'data-cx': cx, 'data-cy': cy }, gWheel);
    el('circle', { cx, cy, r, fill: 'none', stroke: '#ff5a5f', 'stroke-width': 5 }, wheel);
    el('circle', { cx, cy, r: r - 10, fill: 'none', stroke: '#ffd0d2', 'stroke-width': 2 }, wheel);
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      el('line', { x1: cx, y1: cy, x2: cx + r * Math.cos(a), y2: cy + r * Math.sin(a), stroke: '#ff8a8e', 'stroke-width': 2.2 }, wheel);
    }
    el('circle', { cx, cy, r: 7, fill: C.gold, stroke: C.goldDark, 'stroke-width': 2 }, gWheel);
    const cabCols = ['#2d8cff', '#ffc93c', '#2fc172', '#a45cff', '#ff8c42', '#2d8cff', '#ffc93c', '#2fc172'];
    for (let k = 0; k < 8; k++) {
      const c = el('g', {}, gWheel);
      el('line', { x1: 0, y1: -6, x2: 0, y2: 0, stroke: '#3d4a57', 'stroke-width': 1.5 }, c);
      poly([[-8, 0], [8, 0], [6, 12], [-6, 12]], cabCols[k], c);
      poly([[-6, 2], [6, 2], [5, 6], [-5, 6]], '#ffffff', c, { opacity: 0.6 });
      cabins.push(c);
    }
  }
  park.wheel = gWheel;

  // Карусель — праворуч позаду
  const gCar = group('park-carousel', world);
  let horses: SVGGElement;
  {
    const [x, y] = iso(1.5, -2.8);
    el('ellipse', { cx: x, cy: y + 4, rx: 46, ry: 16, fill: '#b98a5a' }, gCar);
    el('ellipse', { cx: x, cy: y, rx: 46, ry: 16, fill: '#f5deae' }, gCar);
    for (let k = 0; k < 5; k++) {
      const px = x - 36 + k * 18;
      el('line', { x1: px, y1: y + (k % 2 ? 6 : 2), x2: px, y2: y - 52, stroke: C.gold, 'stroke-width': 2.5 }, gCar);
    }
    horses = el('g', {}, gCar);
    (['#ffffff', '#ffd0d2', '#cfe6ff'] as const).forEach((col, k) => {
      const hx = x - 28 + k * 28;
      const h = el('g', { transform: tr(hx, y - 18) }, horses);
      poly([[-9, 0], [9, 0], [11, -6], [4, -8], [-9, -6]], col, h, { stroke: '#8a6a4a', 'stroke-width': 1 });
      poly([[7, -6], [12, -14], [15, -12], [11, -4]], col, h, { stroke: '#8a6a4a', 'stroke-width': 1 });
    });
    const stripes = ['#ff5a5f', '#ffffff'];
    for (let k = 0; k < 8; k++) {
      const x0 = x - 52 + k * 13, x1 = x0 + 13;
      poly([[x0, y - 50], [x1, y - 50], [x, y - 84]], stripes[k % 2], gCar);
    }
    poly([[x - 52, y - 50], [x + 52, y - 50], [x + 48, y - 44], [x - 48, y - 44]], '#d64048', gCar);
    el('circle', { cx: x, cy: y - 88, r: 5, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1.5 }, gCar);
  }
  park.carousel = gCar;

  // Фонтан — спереду ліворуч
  const gFount = group('park-fountain', world);
  const water: SVGGElement[] = [];
  {
    const [x, y] = iso(-0.6, 3.0);
    el('ellipse', { cx: x, cy: y + 6, rx: 36, ry: 14, fill: C.stoneSide }, gFount);
    el('ellipse', { cx: x, cy: y, rx: 36, ry: 14, fill: C.stone }, gFount);
    el('ellipse', { cx: x, cy: y, rx: 29, ry: 10, fill: C.water }, gFount);
    poly([[x - 4, y], [x + 4, y], [x + 3, y - 22], [x - 3, y - 22]], C.stoneSide, gFount);
    el('ellipse', { cx: x, cy: y - 22, rx: 12, ry: 4.5, fill: C.stone }, gFount);
    for (let k = 0; k < 3; k++) {
      const w = el('g', {}, gFount);
      el('path', { d: `M ${x} ${y - 24} q ${-16 + k * 16} -22 ${-26 + k * 26} 20`, fill: 'none',
        stroke: C.water, 'stroke-width': 3, 'stroke-linecap': 'round' }, w);
      water.push(w);
    }
  }
  park.fountain = gFount;

  // Кіоск морозива — спереду праворуч
  const gKiosk = group('park-kiosk', world);
  {
    const [x, y] = iso(3.0, -0.6);
    isoBlock(gKiosk, x - 24, x + 14, y - 30, y + 4, 14, '#fff3e0', '#e8cfa8', '#ffffff');
    poly([[x - 16, y - 24], [x + 6, y - 24], [x + 6, y - 10], [x - 16, y - 10]], '#7fd3ff', gKiosk);
    for (let k = 0; k < 5; k++) {
      poly([[x - 28 + k * 9, y - 32], [x - 19 + k * 9, y - 32], [x - 19 + k * 9, y - 40], [x - 28 + k * 9, y - 40]],
        k % 2 ? '#ffffff' : '#2d8cff', gKiosk);
    }
    poly([[x - 2, y - 44], [x + 8, y - 44], [x + 3, y - 30]], '#e3a877', gKiosk);
    el('circle', { cx: x + 3, cy: y - 50, r: 8, fill: '#ffb3c7' }, gKiosk);
    el('circle', { cx: x + 3, cy: y - 58, r: 6, fill: '#fff3b0' }, gKiosk);
  }
  park.kiosk = gKiosk;

  /* ---------- Вежа ---------- */
  const gPlinth = group('gPlinth', world);
  isoBlock(gPlinth, 352, 548, 424, 472, 26, C.stone, C.stoneSide, C.stoneTop);
  poly([[352, 424], [548, 424], [548, 433], [352, 433]], '#c8d0da', gPlinth);
  poly([[404, 472], [496, 472], [496, 486], [404, 486]], C.stoneSide, gPlinth);
  poly([[404, 472], [496, 472], [508, 466], [416, 466]], C.stone, gPlinth);
  reg('plinth', gPlinth);

  const gShaft = group('gShaft', world);
  isoBlock(gShaft, 386, 514, 300, 424, 22, C.wood, C.woodSide, C.woodTop);
  for (let y = 322; y < 424; y += 30) {
    poly([[386, y], [514, y], [514, y + 4], [386, y + 4]], C.woodDeep, gShaft);
    poly([[514, y], [536, y - 12], [536, y - 8], [514, y + 4]], '#5c3819', gShaft);
  }
  poly([[386, 300], [392, 300], [392, 424], [386, 424]], C.woodTop, gShaft);
  reg('shaft', gShaft);

  const gHousing = group('gHousing', world);
  isoBlock(gHousing, 318, 582, 70, 304, 24, C.wood, C.woodSide, C.woodTop);
  poly([[318, 290], [582, 290], [582, 304], [318, 304]], C.woodSide, gHousing);
  poly([[318, 70], [324, 70], [324, 304], [318, 304]], C.woodTop, gHousing);
  el('rect', { x: 328, y: 78, width: 244, height: 218, rx: 22, fill: 'none', stroke: C.woodDeep, 'stroke-width': 6 }, gHousing);
  ([[342, 92], [558, 92], [342, 282], [558, 282]] as const).forEach(([x, y]) =>
    el('circle', { cx: x, cy: y, r: 4.5, fill: C.gold, stroke: C.goldDark, 'stroke-width': 1.5 }, gHousing));
  reg('housing', gHousing);

  const gRoof = group('gRoof', world);
  poly([[296, 70], [604, 70], [450, 12]], C.roof, gRoof);
  poly([[450, 12], [604, 70], [628, 62], [474, 4]], C.roofSide, gRoof);
  poly([[296, 70], [604, 70], [628, 62], [320, 62]], C.roofLight, gRoof);
  poly([[286, 70], [614, 70], [614, 82], [286, 82]], C.roofSide, gRoof);
  poly([[286, 70], [614, 70], [626, 64], [298, 64]], C.roof, gRoof);
  reg('roof', gRoof);

  const gBanner = group('gBanner', world);
  el('line', { x1: 450, y1: 12, x2: 450, y2: -8, stroke: C.goldDark, 'stroke-width': 2.5 }, gBanner);
  poly([[451, -8], [486, -1], [451, 6]], C.gold, gBanner);
  poly([[451, -1], [486, -1], [451, 6]], C.goldDark, gBanner);
  reg('banner', gBanner);

  // Святкові прапорці на піддашку й феєрверк
  const gFlags = group('park-flags', world);
  const fireworks = el('g', {}, gFlags);
  {
    const cols = ['#ff5a5f', '#ffc93c', '#2fc172', '#2d8cff', '#a45cff'];
    for (let k = 0; k < 16; k++) {
      const x = 292 + k * 20;
      poly([[x, 82], [x + 16, 82], [x + 8, 96]], cols[k % cols.length], gFlags);
    }
    for (let f = 0; f < 3; f++) {
      const fw = el('g', { opacity: 0 }, fireworks);
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        el('line', { x1: 0, y1: 0, x2: Math.cos(a) * 22, y2: Math.sin(a) * 22, stroke: cols[(f + k) % cols.length],
          'stroke-width': 3, 'stroke-linecap': 'round' }, fw);
      }
    }
  }
  park.flags = gFlags;

  /* ---------- Циферблат ---------- */
  const face = group('face', world);
  const text = (x: number, y: number, s: string, size: number, fill: string, weight: number, parent: Element) => {
    const t = el('text', { x, y, class: 'part', fill, 'font-size': size, 'font-weight': weight,
      'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': 'Nunito, system-ui, sans-serif' }, parent);
    t.textContent = s;
    return t;
  };

  const gDial = group('fDial', face);
  el('circle', { cx: CX, cy: CY, r: R + 9, fill: C.goldDark }, gDial);
  el('circle', { cx: CX, cy: CY, r: R + 7, fill: C.gold }, gDial);
  el('circle', { cx: CX, cy: CY, r: R + 3.5, fill: C.bezel }, gDial);
  const dialDisc = el('circle', { cx: CX, cy: CY, r: R, fill: C.dial }, gDial);
  const glass = el('path', {
    d: `M ${CX - R * 0.82} ${CY - R * 0.3} A ${R} ${R} 0 0 1 ${CX + R * 0.3} ${CY - R * 0.82} ` +
       `A ${R * 1.5} ${R * 1.5} 0 0 0 ${CX - R * 0.82} ${CY - R * 0.3} Z`,
    fill: '#dff1ff', opacity: 0.55
  }, gDial);
  reg('fDial', gDial);

  // Синя смуга хвилин по краю — з'являється разом із числами хвилин
  const gBand = group('fBand', face);
  el('circle', { cx: CX, cy: CY, r: R - 15, fill: 'none', stroke: C.minBand, 'stroke-width': 22 }, gBand);

  const gQ = group('fQuarters', face);
  const qCols = [C.gold, '#2fc172', C.minHand, C.hourHand];
  const qr = R - 27;
  for (let q = 0; q < 4; q++) {
    const [x0, y0] = polar(q * 90, qr), [x1, y1] = polar(q * 90 + 90, qr);
    el('path', { d: `M ${CX} ${CY} L ${x0} ${y0} A ${qr} ${qr} 0 0 1 ${x1} ${y1} Z`, fill: qCols[q], opacity: 0.18 }, gQ);
  }
  reg('fQuarters', gQ);

  const gTm = group('fTicksMin', face);
  const tmKids: SVGElement[] = [];
  for (let k = 0; k < 60; k++) {
    if (k % 5 === 0) continue;
    const [x1, y1] = polar(k * 6, R - 3), [x2, y2] = polar(k * 6, R - 8);
    tmKids.push(el('line', { x1, y1, x2, y2, stroke: C.tickMin, 'stroke-width': 1.8, 'stroke-linecap': 'round', class: 'part' }, gTm));
  }
  reg('fTicksMin', gTm, tmKids);

  const gTh = group('fTicksHour', face);
  const thKids: SVGElement[] = [];
  for (let k = 0; k < 12; k++) {
    const [x1, y1] = polar(k * 30, R - 3), [x2, y2] = polar(k * 30, R - 11);
    thKids.push(el('line', { x1, y1, x2, y2, stroke: C.ink, 'stroke-width': 4, 'stroke-linecap': 'round', class: 'part' }, gTh));
  }
  reg('fTicksHour', gTh, thKids);

  // Числа годин — далеко від центру, щоб «11», «12» і «1» не злипались
  const gNh = group('fNumsHour', face);
  const nhKids: SVGTextElement[] = [];
  for (let n = 1; n <= 12; n++) {
    const [x, y] = polar(n * 30, R - 41);
    nhKids.push(text(x, y + 1, String(n), 22, C.ink, 800, gNh));
  }
  reg('fNumsHour', gNh, nhKids);

  // Числа хвилин — на синій смузі по краю, того ж кольору, що й хвилинна стрілка
  const gNm = group('fNumsMin', face);
  // Смуга лишається під рисками (вона вище в DOM), але з'являється разом із числами
  const nmKids: SVGElement[] = [gBand];
  for (let n = 1; n <= 12; n++) {
    const [x, y] = polar(n * 30, R - 19);
    nmKids.push(text(x, y + 0.5, n === 12 ? '00' : String(n * 5).padStart(2, '0'), 11.5, C.minHandD, 800, gNm));
  }
  gBand.classList.add('part');
  reg('fNumsMin', gNm, nmKids);

  const hand = (len: number, halfW: number, tail: number): Pt[] => [
    [CX - halfW, CY + tail], [CX + halfW, CY + tail],
    [CX + halfW * 0.7, CY - len + 8], [CX, CY - len], [CX - halfW * 0.7, CY - len + 8]
  ];

  const gH = group('fHour', face);
  const hourHand = el('g', {}, gH);
  const hourPoly = poly(hand(50, 7.5, 12), C.hourHand, hourHand, { stroke: C.hourHandD, 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  reg('fHour', gH);

  const gM = group('fMin', face);
  const minHand = el('g', {}, gM);
  const minPoly = poly(hand(R - 6, 5, 16), C.minHand, minHand, { stroke: C.minHandD, 'stroke-width': 2.5, 'stroke-linejoin': 'round' });
  reg('fMin', gM);

  const gS = group('fSec', face);
  const secHand = el('g', {}, gS);
  el('line', { x1: CX, y1: CY + 22, x2: CX, y2: CY - R + 6, stroke: C.secHand, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, secHand);
  el('circle', { cx: CX, cy: CY + 16, r: 4.5, fill: C.secHand }, secHand);
  reg('fSec', gS);

  const gHub = group('fHub', face);
  const hubDisc = el('circle', { cx: CX, cy: CY, r: 9, fill: C.bezel }, gHub);
  el('circle', { cx: CX, cy: CY, r: 4.5, fill: C.gold }, gHub);
  reg('fHub', gHub);

  /* ---------- Відвідувачі ---------- */
  const gPeeps = group('gPeeps', world);
  const peeps: SceneRefs['peeps'] = [];
  const peepCols = [['#ff5a5f', '#c73c43'], ['#2d8cff', '#1560c2'], ['#2fc172', '#1c7d49'],
    ['#ffc93c', '#d19a0b'], ['#a45cff', '#6b32b5']];
  for (let p = 0; p < 5; p++) {
    const g = el('g', {}, gPeeps);
    const [c1, c2] = peepCols[p];
    el('ellipse', { cx: 0, cy: 1, rx: 8, ry: 3.4, fill: '#000', opacity: 0.18 }, g);
    poly([[-7, 0], [7, 0], [5, -15], [-5, -15]], c1, g);
    poly([[0, 0], [7, 0], [5, -15], [0, -15]], c2, g);
    el('circle', { cx: 0, cy: -21, r: 6.5, fill: '#f8d9b6' }, g);
    poly([[-7, -24], [7, -24], [0, -33]], c1, g);
    el('circle', { cx: -2.4, cy: -21, r: 1.1, fill: '#3d3026' }, g);
    el('circle', { cx: 2.4, cy: -21, r: 1.1, fill: '#3d3026' }, g);
    peeps.push({ node: g, axis: p % 2, t: p / 5, speed: 0.055 + p * 0.014 });
  }
  reg('peeps', gPeeps);

  for (const g of Object.values(park)) g.classList.add('part', 'attraction');

  /* Прозорий диск над циферблатом: деталі мають pointer-events:none,
     тож стрілки крутять саме за нього. */
  const grab = el('circle', { id: 'grab', cx: CX, cy: CY, r: R + 10, fill: 'transparent' }, world);
  grab.style.display = 'none';

  return {
    svg, parts, skyA, skyB, hourHand, minHand, secHand, face, world, grab,
    sunInner, sunBody, sunGlow, stars, clouds, peeps, park,
    anim: { wheel, cabins, horses, water, balloon, fireworks },
    faceRefs: {
      dial: dialDisc, glass, hourNums: nhKids, minNums: gNm, band: gBand, hourHand: hourPoly, minHand: minPoly, hub: hubDisc,
      hand: (len, halfW, tail) => hand(len, halfW, tail).map(p => p.join(',')).join(' ')
    }
  };
}

/* ---------- Кадр анімації декору ---------- */

export function animateScene(S: SceneRefs, T: number, reduced: boolean): void {
  const t = reduced ? 0 : T;

  S.clouds.forEach((c, i) => {
    const x = ((c.x + t * (7 + i * 3)) % 1010) - 55;
    c.node.setAttribute('transform', tr(x, c.y, c.s));
  });

  S.peeps.forEach(p => {
    const u = (p.t + t * p.speed) % 1;
    const d = -3.2 + u * 6.4;
    const [x, y] = p.axis ? iso(d, 0) : iso(0, d);
    const bob = Math.abs(Math.sin(t * 6 + p.t * 9)) * 2.4;
    p.node.setAttribute('transform', tr(x, y - bob));
  });

  const w = S.anim.wheel;
  const cx = Number(w.dataset.cx), cy = Number(w.dataset.cy);
  const rot = t * 14;
  w.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`);
  S.anim.cabins.forEach((c, k) => {
    const a = (k * 45 + rot) * Math.PI / 180;
    c.setAttribute('transform', tr(cx + 56 * Math.cos(a), cy + 56 * Math.sin(a) + 2));
  });

  S.anim.horses.setAttribute('transform', tr(Math.sin(t * 1.6) * 6, Math.sin(t * 4) * 3));
  S.anim.water.forEach((wt, k) => wt.setAttribute('opacity', String(0.55 + 0.45 * Math.sin(t * 5 + k * 2))));
  S.anim.balloon.setAttribute('transform', tr(Math.sin(t * 0.3) * 30, Math.sin(t * 0.8) * 8));

  [...S.anim.fireworks.children].forEach((fw, k) => {
    const cyc = (t * 0.45 + k * 0.33) % 1;
    const x = [180, 700, 610][k], y = [110, 90, 190][k];
    const s = 0.3 + cyc * 1.2;
    fw.setAttribute('transform', tr(x, y, s));
    fw.setAttribute('opacity', reduced ? '0' : String(cyc < 0.7 ? Math.min(1, cyc * 4) * (1 - cyc / 0.7) : 0));
  });
}

/* ---------- Небо й світло доби ---------- */

export function skyFor(h24: number): { a: string; b: string; dark: number } {
  if (h24 < 5) return { a: '#18264a', b: '#34487a', dark: 0.55 };
  if (h24 < 7) return { a: '#f3a26b', b: '#ffdcb3', dark: 0.16 };
  if (h24 < 18) return { a: '#7ee3f2', b: '#c8f4fa', dark: 0 };
  if (h24 < 20) return { a: '#ee8559', b: '#ffd29e', dark: 0.18 };
  if (h24 < 22) return { a: '#46598c', b: '#8579a8', dark: 0.4 };
  return { a: '#18264a', b: '#34487a', dark: 0.55 };
}

export function placeSun(S: SceneRefs, mins: number): void {
  const place = (x: number, y: number) => S.sunInner.setAttribute('transform', tr(x - 120, y - 120));
  const p = (mins - 360) / 720;
  if (p >= 0 && p <= 1) {
    S.sunBody.setAttribute('fill', '#ffd76a');
    S.sunGlow.setAttribute('fill', '#ffd76a');
    place(80 + p * 740, 165 - Math.sin(p * Math.PI) * 118);
  } else {
    const q = ((((mins + 720) % 1440) - 360) / 720);
    S.sunBody.setAttribute('fill', '#eef3ff');
    S.sunGlow.setAttribute('fill', '#c9d8ff');
    place(80 + q * 740, 165 - Math.sin(q * Math.PI) * 118);
  }
}

/* ---------- Стилі циферблата ----------
   Навчальний циферблат — кольорові стрілки й сині хвилини. Справжні годинники
   такими не бувають, тож у пригоді «Справжні годинники» підказки поступово зникають. */

const ROMAN = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];

export const FACE_NAMES: Record<FaceStyle, string> = {
  teach: 'Навчальний годинник', classic: 'Звичайний настінний годинник',
  roman: 'Годинник із римськими цифрами', minimal: 'Годинник без цифр'
};

export function setFaceStyle(S: SceneRefs, style: FaceStyle): void {
  const f = S.faceRefs;
  const teach = style === 'teach';
  const dark = style === 'roman' ? '#2b2118' : '#1d2b3a';
  f.dial.setAttribute('fill', style === 'roman' ? '#f6ecd6' : style === 'classic' ? '#fffdf6' : C.dial);
  f.glass.style.display = teach ? '' : 'none';
  f.minNums.style.display = teach ? '' : 'none';
  f.band.style.display = teach ? '' : 'none';
  f.hourNums.forEach((t, i) => {
    t.style.display = style === 'minimal' ? 'none' : '';
    t.textContent = style === 'roman' ? ROMAN[(i + 1) % 12] : String(i + 1);
    t.setAttribute('font-size', style === 'roman' ? '16' : '22');
    t.setAttribute('font-family', style === 'teach' ? 'Nunito, system-ui, sans-serif' : 'Georgia, "Times New Roman", serif');
    t.setAttribute('font-weight', style === 'teach' ? '800' : '700');
    t.setAttribute('fill', style === 'roman' ? dark : C.ink);
  });
  // Стрілки: у навчальному — кольорові й товсті; у справжніх — темні, хвилинна тонша
  f.hourHand.setAttribute('points', teach ? f.hand(50, 7.5, 12) : f.hand(48, 6, 10));
  f.minHand.setAttribute('points', teach ? f.hand(R - 6, 5, 16) : f.hand(R - 8, 3.2, 14));
  f.hourHand.setAttribute('fill', teach ? C.hourHand : dark);
  f.hourHand.setAttribute('stroke', teach ? C.hourHandD : dark);
  f.minHand.setAttribute('fill', teach ? C.minHand : dark);
  f.minHand.setAttribute('stroke', teach ? C.minHandD : dark);
  f.hub.setAttribute('fill', teach ? C.bezel : dark);
}

/** Секундомір для «Скільки триває хвилина?»: без годинної й хвилинної стрілок,
    із зеленим сектором «скільки треба було» (0 — сховати). */
export function setStopwatch(S: SceneRefs, on: boolean, targetSec = 0): void {
  S.parts.fHour.el.style.display = on ? 'none' : '';
  S.parts.fMin.el.style.display = on ? 'none' : '';
  let arc = S.face.querySelector<SVGPathElement>('#targetArc');
  if (!arc) {
    arc = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arc.id = 'targetArc';
    arc.setAttribute('fill', '#22b865');
    arc.setAttribute('opacity', '0.28');
    S.face.insertBefore(arc, S.parts.fSec.el);
  }
  if (!on || !targetSec) { arc.setAttribute('d', ''); return; }
  const a = Math.min(359.9, targetSec * 6), r = R - 8;
  const [x, y] = polar(a, r);
  arc.setAttribute('d', `M ${CX} ${CY} L ${CX} ${CY - r} A ${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${x} ${y} Z`);
}
