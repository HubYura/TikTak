/* 3D-сцена «Уроку»: вантажиться лише тоді, коли дитина відкриває урок.
   Без WebGL (старий телефон, вимкнене прискорення) лишається звичайний острів. */

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
        document.body.classList.toggle('has-3d', !!t);
        $('scene3d').hidden = !t;
        return t;
      });
  }
  return loading;
}

/** Увімкнути або призупинити 3D-сцену (поза «Уроком» вона не малюється). */
export function show3D(on: boolean, ready?: (t: Tower3D) => void): void {
  wanted = on;
  $('btnTower').hidden = !on || !tower;
  if (!on) { tower?.stop(); return; }
  load().then(t => {
    if (!t || !wanted) return;
    $('btnTower').hidden = false;
    t.start();
    ready?.(t);
  });
}

export const tower3d = (): Tower3D | null => (wanted ? tower : null);

// Вкладка у фоні — нічого не малюємо
document.addEventListener('visibilitychange', () => {
  if (!tower || !wanted) return;
  if (document.hidden) tower.stop(); else tower.start();
});
