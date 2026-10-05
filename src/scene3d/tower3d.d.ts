/* Типи для tower3d.js — 3D-сцени режиму «Урок». */

export interface Tower3D {
  /** Етап уроку 0..10. */
  setStage(i: number, animate?: boolean): void;
  /** Стрілки: хвилини від 0:00 і частка хвилини (0..1) для секундної. */
  setTime(mins: number, sec?: number): void;
  /** Час доби для етапу «Ранок, день, вечір, ніч», хвилини від півночі; null — полудень. */
  setDay(mins: number | null): void;
  overview(): void;
  /** Вільна від панелей частина полотна (CSS-пікселі): вежа центрується в ній. null — усе полотно. */
  setFrame(r: { x: number; y: number; w: number; h: number } | null): void;
  /** Тло без завдання: планета повільно обертається. */
  ambient(): void;
  /** Режим «Гри»: готова вежа, камера впритул до циферблата. */
  setPractice(on: boolean): void;
  /** Точка дотику на циферблаті (1 — край), або null. */
  dialPoint(clientX: number, clientY: number): { x: number; y: number } | null;
  start(): void;
  stop(): void;
  setQuality(high: boolean): void;
  readonly high: boolean;
  dispose(): void;
}

export function createTower3D(canvas: HTMLCanvasElement, opts?: { high?: boolean }): Tower3D;
