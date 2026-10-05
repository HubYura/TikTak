/* 3D-сцена «Уроку»: вантажиться лише тоді, коли дитина відкриває урок.
   Без WebGL (старий телефон, вимкнене прискорення) лишається пласка SVG-вежа. */

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
        $('scene3d').hidden = !t;
        return t;
      });
  }
  return loading;
}

export type Scene3DMode = 'learn' | 'practice' | null;
let mode: Scene3DMode = null;

/** Яка сцена на екрані: 3D для «Уроку» чи для «Гри», або null — пласка SVG-сцена.
    Поза цими режимами 3D-сцена не малюється. */
export function show3D(next: Scene3DMode, ready?: (t: Tower3D) => void): void {
  mode = next;
  wanted = !!next;
  $('btnTower').hidden = next !== 'learn' || !tower;
  if (!next) {
    document.body.classList.remove('show-3d');
    tower?.stop();
    return;
  }
  load().then(t => {
    if (!t || mode !== next) return;
    document.body.classList.add('show-3d');
    $('btnTower').hidden = next !== 'learn';
    t.setPractice(next === 'practice');
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
