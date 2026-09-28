/* Ефекти: конфеті на canvas і тактильний відгук. */

const COLORS = ['#ffc93c', '#2fc172', '#2d8cff', '#ff5a5f', '#ff8c42', '#a45cff', '#5fd6c4'];

interface Bit { x: number; y: number; vx: number; vy: number; w: number; h: number; rot: number; vr: number; life: number; fade: number; col: string }

export const reducedMotion = (): boolean =>
  !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const FX = (() => {
  let canvas: HTMLCanvasElement | null = null;
  let c2d: CanvasRenderingContext2D | null = null;
  let raf = 0;
  let bits: Bit[] = [];

  const W = () => window.innerWidth;
  const H = () => window.innerHeight;

  /* Шар накриває все вікно: кнопки відповідей живуть у панелі, а не на сцені */
  function mount(): void {
    canvas = document.createElement('canvas');
    canvas.className = 'fx-layer';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    c2d = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize(): void {
    if (!canvas || !c2d) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(W() * dpr));
    canvas.height = Math.max(1, Math.round(H() * dpr));
    canvas.style.width = W() + 'px';
    canvas.style.height = H() + 'px';
    c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x: number, y: number, n: number, power = 5): void {
    if (reducedMotion() || !c2d) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (0.4 + Math.random()) * power;
      bits.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3,
        w: 5 + Math.random() * 6, h: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        life: 1, fade: 0.008 + Math.random() * 0.008,
        col: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    if (bits.length > 400) bits = bits.slice(-400);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function cheer(shots = 5): void {
    for (let i = 0; i < shots; i++) setTimeout(() => burst(W() * (i + 0.5) / shots, H() * 0.3, 26, 7), i * 110);
  }

  function fromElement(node: Element | null, n = 18): void {
    if (!node) return;
    const a = node.getBoundingClientRect();
    burst(a.left + a.width / 2, a.top + a.height / 2, n, 5);
  }

  function loop(): void {
    if (!c2d) return;
    const ctx = c2d;
    ctx.clearRect(0, 0, W(), H());
    bits = bits.filter(p => {
      p.vy += 0.16; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life -= p.fade;
      if (p.life <= 0 || p.y > H() + 40) return false;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
      return true;
    });
    if (bits.length) raf = requestAnimationFrame(loop);
    else { raf = 0; ctx.clearRect(0, 0, W(), H()); }
  }

  /* До першого дотику браузер блокує вібрацію й пише помилку в консоль */
  let tapped = false;
  (['pointerdown', 'keydown'] as const).forEach(ev =>
    window.addEventListener(ev, () => { tapped = true; }, { once: true, capture: true }));

  function buzz(pattern: number | number[]): void {
    if (!tapped) return;
    try { navigator.vibrate?.(pattern); } catch { /* немає вібрації */ }
  }

  return { mount, burst, cheer, fromElement, buzz, resize };
})();
