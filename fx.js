/* ============================================================
   Ефекти: конфеті на canvas і тактильний відгук.
   ============================================================ */

'use strict';

const FX = (function () {
  const COLORS = ['#f2a33c', '#4a9e57', '#3a7ca5', '#e05a45', '#f6b757', '#8e6fb5', '#7ff0c4'];

  let canvas = null, c2d = null, raf = 0;
  let parts = [];
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Шар накриває все вікно, а не тільки сцену: кнопки відповідей живуть
     у бічній панелі, і конфеті з них інакше народжувалося б за межами канви. */
  function mount() {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-layer';
    document.body.appendChild(canvas);
    c2d = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W() * dpr));
    canvas.height = Math.max(1, Math.round(H() * dpr));
    canvas.style.width = W() + 'px';
    canvas.style.height = H() + 'px';
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, n, power) {
    if (reduced || !c2d) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * (power || 5);
      parts.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 3,
        w: 5 + Math.random() * 6,
        h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.35,
        life: 1,
        fade: 0.008 + Math.random() * 0.008,
        col: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    if (parts.length > 400) parts = parts.slice(-400);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  /** Салют згори через усю ширину — для рівня чи значка. */
  function cheer(n) {
    const shots = n || 5;
    for (let i = 0; i < shots; i++) {
      setTimeout(() => burst(W() * (i + 0.5) / shots, H() * 0.3, 26, 7), i * 110);
    }
  }

  /** Салют із точки елемента — наприклад із кнопки правильної відповіді. */
  function fromElement(el, n) {
    if (!el) return;
    const a = el.getBoundingClientRect();
    burst(a.left + a.width / 2, a.top + a.height / 2, n || 18, 5);
  }

  function loop() {
    c2d.clearRect(0, 0, W(), H());

    parts = parts.filter(p => {
      p.vy += 0.16;
      p.vx *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= p.fade;
      if (p.life <= 0 || p.y > H() + 40) return false;

      c2d.save();
      c2d.globalAlpha = Math.max(0, Math.min(1, p.life));
      c2d.translate(p.x, p.y);
      c2d.rotate(p.rot);
      c2d.fillStyle = p.col;
      c2d.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      c2d.restore();
      return true;
    });

    if (parts.length) raf = requestAnimationFrame(loop);
    else { raf = 0; c2d.clearRect(0, 0, W(), H()); }
  }

  /* До першого дотику браузер блокує вібрацію й пише помилку в консоль —
     причому не через виняток, тож try/catch тут не рятує. Чекаємо на жест. */
  let tapped = false;
  ['pointerdown', 'keydown'].forEach(ev =>
    window.addEventListener(ev, () => { tapped = true; }, { once: true, capture: true }));

  function buzz(pattern) {
    if (!tapped) return;
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  return { mount, burst, cheer, fromElement, buzz, resize };
})();
