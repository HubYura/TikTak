/* Вікно відеопояснення. Субтитри будуються зі сценарію, якщо окремого .vtt немає. */

import type { VideoClip } from '../core/videos';
import { SFX } from '../lib/audio';
import { Videos } from '../lib/video';
import { Voice } from '../lib/voice';
import { $, h } from './state';

let onClose: (() => void) | null = null;

export function initVideo(): void {
  $('vClose').addEventListener('click', closeVideo);
  $('videoModal').addEventListener('click', e => { if (e.target === $('videoModal')) closeVideo(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('videoModal').hidden) closeVideo(); });
}

/** Кнопка «▶ Відео», або null, якщо кліпа ще немає. */
export function videoButton(clip: VideoClip, label = '▶ Відео', after?: () => void): HTMLButtonElement | null {
  if (!Videos.has(clip.id)) return null;
  const b = h('button', { class: 'video-btn', type: 'button', text: label, title: clip.title });
  b.addEventListener('click', () => openVideo(clip, after));
  return b;
}

/** Рівномірно розкладає речення сценарію по тривалості кліпу. */
function scriptCues(video: HTMLVideoElement, text: string): void {
  const add = () => {
    const d = video.duration;
    if (!Number.isFinite(d) || d <= 0 || typeof VTTCue === 'undefined') return;
    const parts = text.match(/[^.!?]+[.!?]*/g)?.map(s => s.trim()).filter(Boolean) || [text];
    const total = parts.reduce((s, p) => s + p.length, 0);
    const track = video.addTextTrack('subtitles', 'Українська', 'uk');
    let t = 0;
    for (const p of parts) {
      const len = d * p.length / total;
      track.addCue(new VTTCue(t, t + len, p));
      t += len;
    }
    track.mode = 'showing';
  };
  if (video.readyState >= 1) add(); else video.addEventListener('loadedmetadata', add, { once: true });
}

export function openVideo(clip: VideoClip, after?: () => void): void {
  const file = Videos.get(clip.id);
  if (!file) return;
  Voice.stop();
  SFX.swipe();
  onClose = after || null;

  $('vTitle').textContent = clip.title;
  const box = $('vBox');
  box.innerHTML = '';
  const video = h('video', { controls: '', playsinline: '', preload: 'metadata', crossorigin: 'anonymous' }) as HTMLVideoElement;
  video.src = file.src;
  if (file.poster) video.poster = file.poster;
  if (file.vtt) {
    video.append(h('track', { kind: 'subtitles', src: file.vtt, srclang: 'uk', label: 'Українська', default: '' }));
  } else {
    scriptCues(video, clip.say);
  }
  video.addEventListener('error', () => {
    box.innerHTML = '';
    box.append(h('p', { class: 'v-fallback', text: clip.say }));
  });
  box.append(video);
  $('videoModal').hidden = false;
  video.play().catch(() => { /* автозапуск заборонено — дитина натисне ▶ сама */ });
  $('vClose').focus();
}

export function closeVideo(): void {
  const v = $('vBox').querySelector('video');
  v?.pause();
  $('vBox').innerHTML = '';
  $('videoModal').hidden = true;
  const f = onClose;
  onClose = null;
  f?.();
}
