/* Відео живуть поза застосунком (CDN / Vercel Blob) і вантажаться лише на вимогу.
   Адреса сховища — VITE_VIDEO_BASE під час збірки. Поруч із кліпами лежить manifest.json:
   { "clips": { "stage-1": { "src": "stage-1.mp4", "poster": "stage-1.jpg", "vtt": "stage-1.vtt" } } }
   Кнопки відео з'являються лише для кліпів, які є в маніфесті. Офлайн — просто не показуємо. */

export interface ClipFile { src: string; poster?: string; vtt?: string }

type Listener = () => void;

const clips = new Map<string, ClipFile>();
const listeners: Listener[] = [];

const resolve = (base: string, path: string): string => {
  try { return new URL(path, base.endsWith('/') ? base : base + '/').href; } catch { return path; }
};

/** Розбирає маніфест, відкидаючи все некоректне. Чиста функція — для тестів. */
export function parseManifest(raw: unknown, base: string): Map<string, ClipFile> {
  const out = new Map<string, ClipFile>();
  if (!raw || typeof raw !== 'object') return out;
  const list = (raw as { clips?: unknown }).clips;
  if (!list || typeof list !== 'object') return out;
  for (const [id, v] of Object.entries(list as Record<string, unknown>)) {
    if (!/^[a-z0-9-]+$/i.test(id) || !v || typeof v !== 'object') continue;
    const f = v as Record<string, unknown>;
    if (typeof f.src !== 'string' || !f.src) continue;
    out.set(id, {
      src: resolve(base, f.src),
      poster: typeof f.poster === 'string' ? resolve(base, f.poster) : undefined,
      vtt: typeof f.vtt === 'string' ? resolve(base, f.vtt) : undefined
    });
  }
  return out;
}

export const Videos = {
  has: (id: string): boolean => clips.has(id),
  get: (id: string): ClipFile | undefined => clips.get(id),
  onChange(l: Listener): void { listeners.push(l); },
  async load(base: string | undefined): Promise<void> {
    if (!base) return;
    try {
      const res = await fetch(resolve(base, 'manifest.json'), { cache: 'no-cache' });
      if (!res.ok) return;
      const parsed = parseManifest(await res.json(), base);
      parsed.forEach((v, k) => clips.set(k, v));
      listeners.forEach(l => l());
    } catch { /* офлайн або сховище недоступне — гра працює без відео */ }
  }
};
