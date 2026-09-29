/* Тік — маскот. Одне SVG на всі розміри; вираз обличчя й жести перемикає CSS через data-mood. */

export const TIK_SVG = `
<svg viewBox="0 0 72 90" class="tik">
  <ellipse class="b-limb" cx="36" cy="87" rx="17" ry="2.6" fill="#26364a" opacity=".12"/>
  <g class="b-limb">
    <path d="M28 70 L27 82 M44 70 L45 82" stroke="#d98a1c" stroke-width="3.4" stroke-linecap="round"/>
    <ellipse cx="24.5" cy="84" rx="5.6" ry="3.1" fill="#26364a"/>
    <ellipse cx="47.5" cy="84" rx="5.6" ry="3.1" fill="#26364a"/>
  </g>
  <path d="M36 4 L36 14" stroke="#d98a1c" stroke-width="4" stroke-linecap="round"/>
  <circle cx="36" cy="4" r="4" fill="#ffc93c"/>
  <circle cx="36" cy="44" r="30" fill="#ffc93c" stroke="#d98a1c" stroke-width="3"/>
  <circle cx="36" cy="44" r="23" fill="#fffaf0"/>
  <path d="M36 25 L36 29 M55 44 L51 44 M36 63 L36 59 M17 44 L21 44" stroke="#e7cf9f" stroke-width="2.4" stroke-linecap="round"/>
  <g class="b-look">
    <g class="b-eyes">
      <ellipse cx="28" cy="40" rx="3.6" ry="4.6" fill="#26364a"/>
      <ellipse cx="44" cy="40" rx="3.6" ry="4.6" fill="#26364a"/>
      <circle cx="29.2" cy="38.4" r="1.2" fill="#fff"/>
      <circle cx="45.2" cy="38.4" r="1.2" fill="#fff"/>
    </g>
  </g>
  <g class="b-eyes-happy">
    <path d="M24 41 q4 -5 8 0" stroke="#26364a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M40 41 q4 -5 8 0" stroke="#26364a" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
  <path class="b-mouth-idle" d="M30 53 q6 4 12 0" stroke="#26364a" stroke-width="2.8" fill="none" stroke-linecap="round"/>
  <path class="b-mouth-happy" d="M28 51 q8 9 16 0 q-8 4 -16 0" fill="#26364a"/>
  <ellipse class="b-mouth-oops" cx="36" cy="54" rx="4" ry="5" fill="#26364a"/>
  <path class="b-mouth-think" d="M31 55 q3 -2 6 0 q3 2 5 -1" stroke="#26364a" stroke-width="2.6" fill="none" stroke-linecap="round"/>
  <g class="b-blush">
    <circle cx="22" cy="50" r="3.4" fill="#ff6b6b" opacity=".4"/>
    <circle cx="50" cy="50" r="3.4" fill="#ff6b6b" opacity=".4"/>
  </g>
  <g class="b-limb b-arm b-arm-l">
    <path d="M8 52 L8 68" stroke="#d98a1c" stroke-width="3.8" stroke-linecap="round"/>
    <circle cx="8" cy="70" r="4.4" fill="#fff" stroke="#e3d5bb" stroke-width="1.3"/>
  </g>
  <g class="b-limb b-arm b-arm-r">
    <path d="M64 52 L64 68" stroke="#d98a1c" stroke-width="3.8" stroke-linecap="round"/>
    <circle cx="64" cy="70" r="4.4" fill="#fff" stroke="#e3d5bb" stroke-width="1.3"/>
  </g>
</svg>`;

/** Маленькі Тіки (логотип, кнопка відео) — лише голова, без рук і ніг. */
const COMPACT = new Set(['logo', 'video']);

export function mountTik(): void {
  document.querySelectorAll<HTMLElement>('[data-tik]').forEach(n => {
    n.innerHTML = COMPACT.has(n.dataset.tik!) ? TIK_SVG.replace('viewBox="0 0 72 90"', 'viewBox="0 0 72 78"') : TIK_SVG;
  });
}
