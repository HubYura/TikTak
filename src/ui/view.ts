/* Спільне керування сценою: що видно, небо, стрілки, парк. */

import { PARK, STAGES, parkUnlocked, totalStars } from '../core/content';
import { hourAngle, minuteAngle } from '../core/time';
import { CX, CY, placeSun, skyFor } from '../scene/scene';
import { $, app } from './state';

export const FACE_IDS = ['fDial', 'fQuarters', 'fTicksMin', 'fTicksHour', 'fNumsHour', 'fNumsMin', 'fHour', 'fMin', 'fSec', 'fHub'];

export function visibleIds(upTo: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= upTo; i++) STAGES[i].show.forEach(id => set.add(id));
  return set;
}

export function applyRevealSet(vis: Set<string>): void {
  for (const [id, p] of Object.entries(app.S.parts)) {
    const on = vis.has(id);
    if (p.kids) {
      p.kids.forEach((k, i) => {
        k.style.transitionDelay = on ? (i * 45) + 'ms' : '0ms';
        k.classList.toggle('on', on);
      });
    } else {
      p.el.classList.toggle('on', on);
    }
  }
}

/** Приглушує все на циферблаті, крім того, що зараз вивчаємо. */
export function applyFocus(focus: string[] | null, pulse: string | null, visible: Set<string>): void {
  const S = app.S;
  S.face.classList.toggle('focus', !!focus);
  const keep = new Set(focus || FACE_IDS);
  keep.add('fDial');
  keep.add('fHub');
  for (const id of FACE_IDS) {
    const p = S.parts[id];
    if (!p) continue;
    // .dim має вищу специфічність за .part: приглушуємо лише вже відкрите
    const shown = p.kids ? true : visible.has(id);
    p.el.classList.toggle('dim', shown && !keep.has(id));
    p.el.classList.toggle('pulse', pulse === id);
  }
}

let lastSky = -1;
export function setSky(h24: number): void {
  if (h24 === lastSky) return;
  lastSky = h24;
  const { a, b, dark } = skyFor(h24);
  app.S.skyA.setAttribute('stop-color', a);
  app.S.skyB.setAttribute('stop-color', b);
  $('sceneWrap').style.background = 'linear-gradient(180deg,' + a + ',' + b + ')';
  app.S.world.style.filter = dark ? 'brightness(' + (1 - dark * 0.5) + ') saturate(' + (1 - dark * 0.3) + ')' : '';
  app.S.stars.setAttribute('opacity', String(dark >= 0.4 ? 1 : 0));
  $('sceneWrap').classList.toggle('night', dark >= 0.4);
}

export function showSun(mins: number | null): void {
  app.S.parts.sun.el.classList.toggle('on', mins != null);
  if (mins != null) placeSun(app.S, mins);
}

export function renderHands(mins: number, secFrac = 0): void {
  const S = app.S;
  S.hourHand.setAttribute('transform', `rotate(${hourAngle(mins)} ${CX} ${CY})`);
  S.minHand.setAttribute('transform', `rotate(${minuteAngle(mins)} ${CX} ${CY})`);
  S.secHand.setAttribute('transform', `rotate(${secFrac * 360} ${CX} ${CY})`);
}

/** Показує атракціони, заслужені зірками. Повертає ті, що з'явилися вперше. */
export function applyPark(): string[] {
  const got = parkUnlocked(totalStars(app.p)).map(a => a.id);
  for (const a of PARK) app.S.park[a.id].classList.toggle('on', got.includes(a.id));
  return got.filter(id => !app.p.park.includes(id));
}
