/* Тік у панелі: репліки, вираз обличчя, озвучка. І велика похвала поверх сцени. */

import { Voice } from '../lib/voice';
import { $, app } from './state';

type Mood = 'idle' | 'happy' | 'cheer' | 'oops';

let buddyTimer = 0, popTimer = 0;
let lastSpoken = '';

const voiceOn = () => app.p.settings.voice && Voice.available();

export function say(text: string, mood: Mood = 'idle', ms = 2200, speak = true): void {
  const buddy = $('buddy'), bubble = $('buddySay');
  if (text) {
    bubble.textContent = text;
    bubble.classList.remove('fresh');
    void bubble.offsetWidth;
    bubble.classList.add('fresh');
  }
  clearTimeout(buddyTimer);
  buddy.dataset.mood = 'idle';
  void buddy.offsetWidth;
  buddy.dataset.mood = mood;
  if (mood !== 'idle') buddyTimer = window.setTimeout(() => { buddy.dataset.mood = 'idle'; }, ms);
  if (speak && text) speakNow(text);
}

/** Говорить уголос, якщо озвучка ввімкнена. Остання фраза доступна для повтору. */
export function speakNow(text: string): void {
  lastSpoken = text;
  $('btnReplay').hidden = !voiceOn();
  if (voiceOn() && app.p.settings.autoRead) Voice.speak(text);
}

export function replay(): void {
  if (lastSpoken && Voice.available()) Voice.speak(lastSpoken);
}

export function popover(text: string, bad = false): void {
  const p = $('popover');
  p.hidden = false;
  p.className = 'popover' + (bad ? ' bad' : '');
  p.textContent = text;
  p.style.animation = 'none';
  void p.offsetWidth;
  p.style.animation = '';
  clearTimeout(popTimer);
  popTimer = window.setTimeout(() => { p.hidden = true; }, 1400);
}

export function bump(node: Element): void {
  node.classList.remove('bump');
  void (node as HTMLElement).offsetWidth;
  node.classList.add('bump');
  setTimeout(() => node.classList.remove('bump'), 280);
}
