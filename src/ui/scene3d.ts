/* 3D-космос із планетою й вежею. Лежить на весь екран під інтерфейсом: це і тло, і головний об'єкт.
   Без WebGL (старий телефон, вимкнене прискорення) лишається пласка SVG-вежа в рамці. */

import type { Tower3D } from '../scene3d/tower3d';
import { $ } from './state';

let tower: Tower3D | null = null;
let loading: Promise<Tower3D | null> | null = null;
let failed = false;
let wanted = false;

function webgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

/* Яка частина екрана вільна від шапки, панелі й кнопок — там і стоїть вежа */
export function freeRect(): { x: number; y: number; w: number; h: number } {
  const W = innerWidth, H = innerHeight;
  const top = $('app').querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0;
  const ctrl = $('app').querySelector('.controls')?.getBoundingClientRect();
  const bottom = ctrl && ctrl.height ? ctrl.top : H;
  const p = $('panel').getBoundingClientRect();
  // Панель збоку (десктоп) чи шторкою знизу (телефон)
  if (p.width && p.left > W * 0.35) return { x: 0, y: top, w: p.left, h: Math.max(0, bottom - top) };
  const b = p.height && p.top > top ? Math.min(bottom, p.top) : bottom;
  return { x: 0, y: top, w: W, h: Math.max(0, b - top) };
}
let framePending = 0;
export function reframe(): void {
  cancelAnimationFrame(framePending);
  framePending = requestAnimationFrame(() => tower?.setFrame(freeRect()));
}

function load(): Promise<Tower3D | null> {
  if (!loading) {
    loading = (failed || !webgl() ? Promise.resolve(null) : import('../scene3d/tower3d')
      .then(async m => {
        await document.fonts?.ready;                 // цифри на циферблатах малюються шрифтом гри
        const t = m.createTower3D($<HTMLCanvasElement>('scene3d'));
        $('btnTower').addEventListener('click', () => t.overview());
        return t;
      }))
      .catch(e => { console.warn('[3D] сцена недоступна:', e); failed = true; return null; })
      .then(t => {
        tower = t;
        $('scene3d').hidden = !t;
        if (t) {
          document.body.classList.add('bg-3d');
          const ro = new ResizeObserver(reframe);
          ['panel', 'app'].forEach(id => ro.observe($(id)));
          addEventListener('resize', reframe);
          reframe();
        }
        return t;
      });
  }
  return loading;
}

export type Scene3DMode = 'learn' | 'practice' | null;
let mode: Scene3DMode = null;

/** Що показує 3D-сцена: урок, циферблат для гри, або null — лише тло (тоді циферблат завдання —
    пласка SVG-картка поверх космосу). */
export function show3D(next: Scene3DMode, ready?: (t: Tower3D) => void): void {
  mode = next;
  wanted = !!next;
  $('btnTower').hidden = next !== 'learn' || !tower;
  if (!next) {
    document.body.classList.remove('show-3d');
    // Космос лишається тлом: планета повільно обертається
    load().then(t => { if (t && !mode && !document.hidden) { t.ambient(); t.start(); } });
    return;
  }
  load().then(t => {
    if (!t || mode !== next) return;
    document.body.classList.add('show-3d');
    $('btnTower').hidden = next !== 'learn';
    t.setPractice(next === 'practice');
    reframe();
    t.start();
    ready?.(t);
  });
}

export const tower3d = (): Tower3D | null => (wanted ? tower : null);

// Для перевірок у режимі розробки
if (import.meta.env.DEV) (window as unknown as { __tower3d: () => Tower3D | null }).__tower3d = () => tower;

// Вкладка у фоні — нічого не малюємо
document.addEventListener('visibilitychange', () => {
  if (!tower) return;
  if (document.hidden) tower.stop(); else tower.start();
});
