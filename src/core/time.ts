/* Чиста арифметика годинника — без DOM, щоб її можна було тестувати. */

export const pad = (n: number): string => String(n).padStart(2, '0');

/** 0 → 12, 13 → 1: години так, як їх пише циферблат. */
export const norm12 = (h: number): number => ((((h - 1) % 12) + 12) % 12) + 1;

/** Запис часу на 12-годинному циферблаті: «3:05». */
export const digital = (h: number, m: number): string => norm12(h) + ':' + pad(m);

/** Запис на електронному 24-годинному табло: «15:05». */
export const digital24 = (h24: number, m: number): string => pad(((h24 % 24) + 24) % 24) + ':' + pad(m);

/** Хвилини від 12:00 (0..719) — стан аналогового циферблата. */
export const toDial = (h: number, m: number): number => ((h % 12) * 60 + m + 720) % 720;

export const fromDial = (total: number): { h: number; m: number } => {
  const t = ((Math.round(total) % 720) + 720) % 720;
  return { h: norm12(Math.floor(t / 60)), m: t % 60 };
};

/** Кут годинної стрілки: вона рухається плавно, пів градуса на хвилину. */
export const hourAngle = (mins: number): number => ((mins % 720) + 720) % 720 / 720 * 360;
export const minuteAngle = (mins: number): number => (((mins % 60) + 60) % 60) * 6;

/** Кут точки відносно центру, 0° — на 12, за годинниковою стрілкою. */
export const angleOf = (dx: number, dy: number): number =>
  (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;

export const angleDist = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** Додає хвилини з переносом годин. */
export const addMinutes = (h: number, m: number, d: number): { h: number; m: number } =>
  fromDial(toDial(h, m) + d);
