/* «Зоряний ЧасоПарк»: 3D-сцена режиму «Урок» (three.js).

   Перенесено з артефакту «Зоряний ЧасоПарк». Маленька планета, де жителі не знають, що таке час:
   Тік будує для них годинникову вежу за ті самі 11 етапів, що й урок гри.
   Етап, положення стрілок і час доби задає гра (див. src/ui/learn.ts) — сцена лише показує.
   Кубики й міні-тест з артефакту не перенесено: для вправ є режим «Гра». */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Розділ уроку для кожного з 11 етапів: від нього залежить, де стоїть Тік. */
const STAGE_CH = [0, 0, 1, 2, 2, 3, 3, 3, 3, 4, 5];
export function createTower3D(canvas, opts = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  let high = opts.high ?? !mobile;
  let stage = 1;
  const railings = [];    // поручні балкона: у грі ховаємо, бо вони заступають низ циферблата
  /* ---------- Рендер ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2400);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 90;
  controls.autoRotateSpeed = 0.35;

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- Помічники ---------- */
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, ...o });
  const glow = c => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });
  const rng = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);
  function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
  function canvasTex(w, h, draw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const animated = [];
  const smooth = THREE.MathUtils.smoothstep;
  const UP = new THREE.Vector3(0, 1, 0);
  const h3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  function vnoise3(x, y, z) {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let fx = x - ix, fy = y - iy, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const L = (a, b, t) => a + (b - a) * t;
    const c = (dx, dy, dz) => h3(ix + dx, iy + dy, iz + dz);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), fx), L(c(0, 1, 0), c(1, 1, 0), fx), fy), L(L(c(0, 0, 1), c(1, 0, 1), fx), L(c(0, 1, 1), c(1, 1, 1), fx), fy), fz);
  }
  function fbm3(x, y, z, o = 4) { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * vnoise3(x, y, z); x *= 2.03; y *= 2.03; z *= 2.03; a *= 0.5; } return s / (1 - Math.pow(0.5, o)); }

  /* ---------- Світло: одне далеке сонце ---------- */
  scene.add(new THREE.HemisphereLight(0x8FE6E0, 0x3A1630, 0.22));
  const SUN_DIR = new THREE.Vector3(0.62, 0.32, 0.72).normalize();
  const key = new THREE.DirectionalLight(0xFFF1DD, 2.9); scene.add(key); scene.add(key.target);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 80 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(0x6FE8FF, 0.35); rim.position.set(-50, 12, -60); scene.add(rim);

  /* ---------- Небо: яскрава туманність ---------- */
  const skyU = { uTime: { value: 0 }, uOct: { value: high ? 5 : 3 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 32), new THREE.ShaderMaterial({
    uniforms: skyU, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform float uTime; uniform float uOct;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z); }
      float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++){ if (float(i) >= uOct) break; s += a*noise(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vDir);
        float n = fbm(d * 1.8 + vec3(0.0, uTime * 0.003, 0.0));
        float m = fbm(d * 4.2 + 7.3);
        float w = fbm(d * 9.0 - 2.0);
        vec3 col = vec3(0.008, 0.03, 0.05);
        col = mix(col, vec3(0.02, 0.20, 0.26), smoothstep(0.32, 0.72, n));
        col = mix(col, vec3(0.05, 0.42, 0.44), smoothstep(0.55, 0.85, n * (0.6 + m * 0.6)) * 0.7);
        col = mix(col, vec3(0.52, 0.10, 0.36), smoothstep(0.5, 0.86, m * n * 1.8) * 0.8);
        col += vec3(1.0, 0.46, 0.22) * pow(smoothstep(0.62, 0.95, n * m * 1.9), 2.0) * 0.5;
        col *= 0.55 + 0.45 * smoothstep(0.25, 0.6, w);                        // темні пилові прожилки
        vec3 q = d * 300.0; vec3 id = floor(q); float h = hash(id);
        float st = step(0.978, h) * smoothstep(0.32, 0.0, length(fract(q) - 0.5));
        col += mix(vec3(0.7, 0.9, 1.0), vec3(1.0, 0.85, 0.7), h) * st * (0.6 + 0.4 * sin(uTime * 1.7 + h * 60.0)) * (0.5 + h);
        gl_FragColor = vec4(col, 1.0);
      }`
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  // сонце
  const sunPos = SUN_DIR.clone().multiplyScalar(800);
  add(scene, new THREE.SphereGeometry(18, 32, 20), glow(0xFFF6E0), sunPos.x, sunPos.y, sunPos.z);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,246,224,1)'); gr.addColorStop(0.18, 'rgba(255,220,150,.75)'); gr.addColorStop(0.45, 'rgba(255,170,90,.22)'); gr.addColorStop(1, 'rgba(255,140,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  corona.scale.set(170, 170, 1); corona.position.copy(sunPos); scene.add(corona);

  /* ---------- Велика планета з кільцями і супутник (освітлені тим самим сонцем) ---------- */
  const FRONT = new THREE.Vector3(0.26, 0, 0.97).normalize();
  const SIDE = new THREE.Vector3().crossVectors(UP, FRONT).normalize();
  function skyBody(radius, tex, pos) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 40), new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uSun: { value: SUN_DIR } },
      vertexShader: 'varying vec3 vN; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec3 uSun; varying vec3 vN; varying vec2 vUv;
        void main(){ float l = max(dot(normalize(vN), uSun), 0.0); vec3 c = texture2D(map, vUv).rgb; c = c * c;
          gl_FragColor = vec4(c * (l * 1.3 + 0.015), 1.0); }`
    }));
    m.position.copy(pos); scene.add(m); return m;
  }
  const gasTex = canvasTex(512, 256, (g, w, h) => {
    const bands = ['#F4D9C6', '#E7A98F', '#F7E6D5', '#D9867A', '#F2C7A6', '#C97A86', '#F6E2CF', '#E3A08A'];
    let y = 0; while (y < h) { const bh = 6 + rng() * 26; g.fillStyle = bands[Math.floor(rng() * bands.length)]; g.fillRect(0, y, w, bh + 1); y += bh; }
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${rng() * 0.08})`; g.fillRect(rng() * w, rng() * h, 20 + rng() * 60, 2); }
    g.fillStyle = 'rgba(190,90,80,.55)'; g.beginPath(); g.ellipse(w * 0.62, h * 0.62, 26, 12, 0, 0, Math.PI * 2); g.fill();
  });
  const GR = 70;
  const giant = skyBody(GR, gasTex, FRONT.clone().multiplyScalar(-0.85).addScaledVector(SIDE, -0.5).add(new THREE.Vector3(0, 0.12, 0)).normalize().multiplyScalar(560));
  giant.rotation.z = 0.35;
  const ringTex = canvasTex(512, 8, (g, w, h) => {
    for (let x = 0; x < w; x++) {
      const t = x / w, a = (0.25 + 0.55 * Math.abs(Math.sin(t * 37) * Math.sin(t * 11 + 1))) * (t > 0.62 && t < 0.67 ? 0.1 : 1) * smooth(t, 0, 0.06) * (1 - smooth(t, 0.9, 1));
      g.fillStyle = `rgba(${235 + 20 * Math.sin(t * 20) | 0},${205 + 25 * Math.sin(t * 13) | 0},190,${a})`; g.fillRect(x, 0, 1, h);
    }
  });
  const ringGeo = new THREE.RingGeometry(GR * 1.35, GR * 2.35, 160, 1);
  { const p = ringGeo.attributes.position, uv = ringGeo.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); uv.setXY(i, (v.length() - GR * 1.35) / GR, 0.5); } }
  const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
    uniforms: { map: { value: ringTex }, uSun: { value: SUN_DIR }, uC: { value: giant.position }, uR: { value: GR } },
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vW = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D map; uniform vec3 uSun; uniform vec3 uC; uniform float uR; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 t = texture2D(map, vUv);
        vec3 rel = vW - uC; float along = dot(rel, uSun); vec3 perp = rel - along * uSun;
        float sh = (along < 0.0) ? smoothstep(uR * 0.96, uR * 1.04, length(perp)) : 1.0;   // тінь планети на кільцях
        gl_FragColor = vec4(t.rgb * t.rgb * (0.06 + 1.0 * sh), t.a); }`
  }));
  giant.add(ring); ring.rotation.x = -Math.PI / 2 + 0.22;
  const moonTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#B9C6D8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { const x = rng() * w, y = rng() * h, r = 3 + rng() * 16; g.fillStyle = 'rgba(80,90,120,.28)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.7, 0, 7); g.fill(); }
  });
  // супутник обертається навколо планети з вежею; його фази видно, бо він куля, освітлена сонцем
  const moon = skyBody(1.5, moonTex, new THREE.Vector3(0, 0, 0));
  animated.push(t => { const a = t * (Math.PI * 2 / 120) + 2.2; moon.position.set(Math.cos(a) * 23, 2 + Math.sin(a) * 3, Math.sin(a) * 23); moon.rotation.y = -a; });

  /* ---------- Атмосфера (світіння по краю) ---------- */
  function atmosphere(r, color, power = 3, k = 1.3) {
    return new THREE.Mesh(new THREE.SphereGeometry(r * 1.14, 48, 32), new THREE.ShaderMaterial({
      uniforms: { c: { value: new THREE.Color(color) }, p: { value: power }, k: { value: k }, uSun: { value: SUN_DIR } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vW = normalize(mat3(modelMatrix)*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform vec3 c; uniform float p; uniform float k; uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), p); float lit = 0.08 + 0.92 * smoothstep(-0.25, 0.35, dot(normalize(vW), uSun)); gl_FragColor = vec4(c*f*k*lit, f*lit); }',
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
    }));
  }

  /* ---------- Маленька планета з вежею: пласкі грані, коралова трава, рожеві скелі ---------- */
  const HOME_R = 6.5;
  const home = new THREE.Group(); scene.add(home);
  // висота рельєфу: на «маківці», де стоїть вежа, рівно
  function surfH(n) {
    const f = 1 - smooth(n.y, 0.72, 0.84);
    const base = (fbm3(n.x * 1.7 + 3, n.y * 1.7, n.z * 1.7) - 0.5) * 1.3;
    const ridge = Math.pow(Math.max(0, fbm3(n.x * 3.2, n.y * 3.2 + 5, n.z * 3.2) - 0.55), 1.5) * 3.2;
    return (base + ridge) * f;
  }
  const WATER = HOME_R - 0.22;
  {
    const geo = new THREE.IcosahedronGeometry(HOME_R, high ? 30 : 20);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); v.multiplyScalar(HOME_R + surfH(v)); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal, col = new Float32Array(p.count * 3), c = new THREE.Color(), cen = new THREE.Vector3(), fn = new THREE.Vector3();
    const grassA = new THREE.Color(0xC8402C), grassB = new THREE.Color(0xE8742E), grassC = new THREE.Color(0x9A2C2E);
    const rockA = new THREE.Color(0x9A86CC), rockB = new THREE.Color(0xEAA2AE), rockC = new THREE.Color(0xF6D2C0), sand = new THREE.Color(0xF2B8A0), snow = new THREE.Color(0xE8F1FF);
    for (let t = 0; t < p.count; t += 3) {
      cen.set(0, 0, 0); for (let j = 0; j < 3; j++) cen.add(v.fromBufferAttribute(p, t + j)); cen.divideScalar(3);
      const r = cen.length(), h = r - HOME_R; fn.fromBufferAttribute(nrm, t);
      const slope = fn.dot(cen.normalize()), n = fbm3(cen.x * 4, cen.y * 4, cen.z * 4, 3);
      if (r < WATER + 0.07) c.copy(sand);
      else if (h > 0.75 + n * 0.3 && slope > 0.8) c.copy(snow);
      else if (slope < 0.86) { const b = Math.sin(h * 7 + n * 3) * 0.5 + 0.5; c.copy(rockA).lerp(b > 0.6 ? rockC : rockB, b); }
      else c.copy(grassA).lerp(grassB, n * 0.9).lerp(grassC, smooth(n, 0.62, 0.9) * 0.6);
      c.offsetHSL(0, 0, (h3(cen.x, cen.y, cen.z) - 0.5) * 0.05);
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (t + j) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = add(home, geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
    m.receiveShadow = true;
  }
  add(home, new THREE.IcosahedronGeometry(WATER, 12), std(0x2FB8B2, { roughness: 0.35, metalness: 0.2, transparent: true, opacity: 0.85, flatShading: true }));
  home.add(atmosphere(HOME_R, 0x6FF0E0, 2.6, 1.35));
  // поставити предмет на поверхню за напрямком n
  function placeN(parent, n, lift = 0) {
    n = n.clone().normalize();
    const g = new THREE.Group(); g.position.copy(n).multiplyScalar(HOME_R + surfH(n) + lift); g.quaternion.setFromUnitVectors(UP, n); parent.add(g); return g;
  }
  const randDir = (minFromTop = 0.75) => { for (;;) { const v = new THREE.Vector3().randomDirection(); if (v.y < Math.cos(minFromTop) && HOME_R + surfH(v) > WATER + 0.1) return v; } };
  // плита під вежею і площа
  const plazaTex = canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#B9AED6'; g.fillRect(0, 0, w, w);
    for (let ring = 0; ring < 9; ring++) { const r0 = ring * 28, n = 8 + ring * 6;
      for (let i = 0; i < n; i++) { g.fillStyle = `hsl(${255 + rng() * 25}, ${16 + rng() * 12}%, ${70 + rng() * 12}%)`; g.beginPath(); g.arc(w / 2, w / 2, r0 + 26, i / n * 6.283 + 0.01, (i + 1) / n * 6.283 - 0.01); g.arc(w / 2, w / 2, r0 + 2, (i + 1) / n * 6.283 - 0.01, i / n * 6.283 + 0.01, true); g.fill(); } }
  });
  const plaza = add(home, new THREE.CylinderGeometry(3.2, 3.0, 1.4, 40), [std(0x8F84AE, { flatShading: true }), std(0xFFFFFF, { map: plazaTex, roughness: 0.9 }), std(0x8F84AE)], 0, HOME_R - 0.65, 0);
  plaza.receiveShadow = true; plaza.castShadow = true;
  const nightLights = [];
  const ON = new THREE.Color(0xFFD98A), OFF = new THREE.Color(0x1E4E58);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8, g = new THREE.Group(); g.position.set(Math.sin(a) * 2.95, HOME_R + 0.05, Math.cos(a) * 2.95); home.add(g);
    add(g, new THREE.CylinderGeometry(0.035, 0.05, 0.9, 8), std(0x3A3550, { metalness: 0.4, roughness: 0.5 }), 0, 0.45, 0).castShadow = true;
    const bulb = add(g, new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6B5E50, toneMapped: false }), 0, 0.95, 0);
    nightLights.push({ obj: g, mat: bulb.material });
  }

  /* ---------- Вежа: будується по 11 етапах ---------- */
  const parts = [];
  // Ще не збудоване — тонке креслення: майже прозора заливка й тьмяні лінії, без світіння (toneMapped — щоб bloom їх не підхоплював)
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0x6FE8FF, transparent: true, opacity: 0.03, depthWrite: false });
  const ghostLine = new THREE.LineBasicMaterial({ color: 0x9FEFFF, transparent: true, opacity: 0.18, depthWrite: false });
  const tower = new THREE.Group(); tower.position.y = HOME_R + 0.05; home.add(tower);
  function part(stage, order = 0) { const g = new THREE.Group(); g.userData = { stage, order, built: null, t0: 0 }; tower.add(g); parts.push(g); return g; }

  // текстури вежі в стилі планети: шаруватий пісковик, рожево-бузкові блоки, бірюзова черепиця
  const plasterTex = canvasTex(256, 256, (g, w, h) => {
    const bands = ['#F6E2CF', '#F7D4C4', '#F2C7B4', '#F6E2CF', '#EFB9AE', '#F9E8D8'];
    let y = 0, i = 0; while (y < h) { const bh = 14 + rng() * 30; g.fillStyle = bands[i++ % bands.length]; g.fillRect(0, y, w, bh + 1); y += bh; }
    for (let k = 0; k < 120; k++) { g.fillStyle = rng() < .5 ? 'rgba(190,120,110,.10)' : 'rgba(255,255,255,.18)'; const x = rng() * w, yy = rng() * h; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 10 + rng() * 20, yy + 3); g.lineTo(x + 4, yy + 8 + rng() * 8); g.fill(); }
  });
  plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
  const stoneTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#B59BDB'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = (y / 64) % 2 ? -60 : 0; x < w; x += 120) {
      g.fillStyle = ['#EFA7B2', '#D98BA6', '#C9A8E0', '#F2B9A6'][Math.floor(rng() * 4)];
      g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 116, y + 6); g.lineTo(x + 114, y + 60); g.lineTo(x + 6, y + 58); g.fill();
      g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + 116, y + 6); g.lineTo(x + 60, y + 30); g.fill();
    }
  });
  stoneTex.wrapS = stoneTex.wrapT = THREE.RepeatWrapping;
  const shingleTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#16747A'; g.fillRect(0, 0, w, h);
    for (let r = 0; r < 9; r++) for (let c = -1; c < 9; c++) {
      const x = c * 32 + (r % 2 ? 16 : 0), y = r * 30;
      g.fillStyle = ['#2EC4B6', '#26AFA6', '#3BD3C2'][(r + c + 9) % 3];
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18); g.lineTo(x + 16, y + 32); g.lineTo(x + 32, y + 18); g.lineTo(x + 32, y); g.closePath(); g.fill();
      g.fillStyle = 'rgba(160,250,235,.35)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y + 32); g.lineTo(x, y + 18); g.fill();
    }
  });
  shingleTex.wrapS = shingleTex.wrapT = THREE.RepeatWrapping; shingleTex.repeat.set(6, 3);
  const woodTex = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#1E5A62'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = ['#246A72', '#1B525A', '#22646C', '#1D5860'][x / 32]; g.fillRect(x + 2, 0, 28, h); }
    g.fillStyle = '#FF7A2E'; g.fillRect(0, 60, w, 10); g.fillRect(0, 190, w, 10);
    g.fillStyle = '#6FF0FF'; g.fillRect(w / 2 - 3, 80, 6, 100);
  });
  const flat = o => ({ flatShading: true, ...o });
  const T = {
    cream: std(0xF6E2CF, flat()), lav: std(0xE8A0AE, flat()), pink: std(0xFF7A4A, flat()), purple: std(0x1A8A90, flat({ roughness: 0.55 })),
    gold: std(0xFFB43C, flat({ metalness: 0.55, roughness: 0.35 })), stone: std(0xFFFFFF, flat({ map: stoneTex, roughness: 0.9 })),
    plaster: std(0xFFFFFF, flat({ map: plasterTex, roughness: 0.85 })), trim: std(0xF7D4C4, flat({ roughness: 0.7 })),
    roof: std(0xFFFFFF, flat({ map: shingleTex, roughness: 0.6 })), wood: std(0xFFFFFF, flat({ map: woodTex, roughness: 0.6, metalness: 0.3 })),
    dark: std(0x173A44, flat({ roughness: 0.5 })), iron: std(0x24414A, flat({ metalness: 0.4, roughness: 0.5 }))
  };
  const glass = () => { const m = new THREE.MeshBasicMaterial({ color: 0x6B5E50, toneMapped: false }); nightLights.push({ obj: tower, mat: m }); return m; };
  function archShape(w, h) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(-w / 2, h - w / 2); sh.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); sh.lineTo(w / 2, 0); sh.lineTo(-w / 2, 0); return sh; }
  const arch = (w, h, d) => new THREE.ExtrudeGeometry(archShape(w, h), { depth: d, bevelEnabled: false, curveSegments: 5 });
  // усі чотири фасади: f — номер боку, z — відстань фасаду від центру
  function onFace(parent, f, z, build) { const g = new THREE.Group(); g.rotation.y = f * Math.PI / 2; parent.add(g); const inner = new THREE.Group(); inner.position.z = z; g.add(inner); build(inner, f); return g; }
  function archWindow(parent, x, y, w, h) {
    add(parent, arch(w + 0.16, h + 0.08, 0.06), T.trim, x, y - 0.04, 0.0);
    add(parent, arch(w, h, 0.04), glass(), x, y, 0.03);
    add(parent, new THREE.BoxGeometry(0.035, h - w / 2, 0.02), T.trim, x, y + (h - w / 2) / 2, 0.075);
    add(parent, new THREE.BoxGeometry(w + 0.24, 0.07, 0.16), T.trim, x, y - 0.06, 0.06);
  }

  // 1. фундамент: двоярусна восьмикутна основа зі сходами
  const p1 = part(1);
  { const c1 = add(p1, new THREE.CylinderGeometry(2.25, 2.4, 0.38, 8), T.stone, 0, 0.19, 0); c1.rotation.y = Math.PI / 8; c1.material = std(0xFFFFFF, { map: stoneTex.clone(), roughness: 0.9 }); c1.material.map.repeat.set(4, 1); c1.material.map.needsUpdate = true;
    const c2 = add(p1, new THREE.CylinderGeometry(1.95, 2.05, 0.3, 8), T.stone, 0, 0.53, 0); c2.rotation.y = Math.PI / 8;
    for (let i = 0; i < 3; i++) add(p1, new RoundedBoxGeometry(1.25, 0.2, 0.36, 2, 0.04), T.stone, 0, 0.1 + i * 0.2, 2.45 - i * 0.3);
    for (const sx of [-1, 1]) add(p1, new RoundedBoxGeometry(0.22, 0.75, 0.9, 2, 0.04), T.stone, sx * 0.72, 0.38, 2.2);
  }

  // 2а. нижній ярус: штукатурка, кутові камені, двері, вікна
  const Y1 = 0.68, H1 = 2.6, W1 = 2.4;
  const p2a = part(2, 0);
  { add(p2a, new THREE.BoxGeometry(W1, H1, W1), T.plaster, 0, Y1 + H1 / 2, 0);
    add(p2a, new THREE.BoxGeometry(W1 + 0.14, 0.22, W1 + 0.14), T.stone, 0, Y1 + 0.11, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) for (let i = 0; i < 8; i++) {
      const big = i % 2 === 0, bw = big ? 0.5 : 0.34;
      add(p2a, new RoundedBoxGeometry(bw, 0.3, bw, 1, 0.03), T.stone, x * (W1 / 2 - bw / 2 + 0.05), Y1 + 0.38 + i * 0.3, z * (W1 / 2 - bw / 2 + 0.05));
    }
    onFace(p2a, 0, W1 / 2, (g) => {
      add(g, arch(1.12, 1.78, 0.08), T.stone, 0, Y1 + 0.1, 0);
      const dr = add(g, arch(0.82, 1.58, 0.06), T.wood, 0, Y1 + 0.12, 0.04);
      dr.geometry.computeBoundingBox(); { const bb = dr.geometry.boundingBox, uv = dr.geometry.attributes.uv, pos = dr.geometry.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)); }
      add(g, new THREE.SphereGeometry(0.05, 10, 8), T.gold, 0.26, Y1 + 0.85, 0.13);
      for (const yy of [0.45, 1.15]) add(g, new THREE.BoxGeometry(0.42, 0.05, 0.02), T.iron, -0.17, Y1 + yy, 0.115);
      const can = add(g, new THREE.BoxGeometry(1.4, 0.08, 0.5), std(0xE8558E), 0, Y1 + 2.02, 0.2); can.rotation.x = 0.35;
      for (const sx of [-1, 1]) add(g, new THREE.BoxGeometry(0.06, 0.32, 0.06), T.trim, sx * 0.62, Y1 + 1.86, 0.36).rotation.x = -0.6;
    });
    for (const f of [1, 2, 3]) onFace(p2a, f, W1 / 2, (g) => { archWindow(g, 0, Y1 + 1.05, 0.48, 0.9); });
    // круглі віконця над дверима з боків
    onFace(p2a, 0, W1 / 2, (g) => { for (const sx of [-1, 1]) { add(g, new THREE.TorusGeometry(0.15, 0.04, 8, 20), T.trim, sx * 0.85, Y1 + 1.95, 0.02); add(g, new THREE.CircleGeometry(0.13, 20), glass(), sx * 0.85, Y1 + 1.95, 0.015); } });
    add(p2a, new THREE.BoxGeometry(W1 + 0.2, 0.2, W1 + 0.2), T.trim, 0, Y1 + H1 + 0.1, 0);
  }

  // 2б. середній ярус: високі вікна й балкон з балюстрадою
  const Y2 = Y1 + H1 + 0.2, H2 = 1.5, W2 = 2.2;
  const p2b = part(2, 1);
  { add(p2b, new THREE.BoxGeometry(W2, H2, W2), T.plaster, 0, Y2 + H2 / 2, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(p2b, new THREE.BoxGeometry(0.2, H2, 0.2), T.lav, x * W2 / 2, Y2 + H2 / 2, z * W2 / 2);
    for (const f of [0, 1, 2, 3]) onFace(p2b, f, W2 / 2, (g) => { archWindow(g, -0.42, Y2 + 0.28, 0.34, 0.95); archWindow(g, 0.42, Y2 + 0.28, 0.34, 0.95); });
    const YB = Y2 + H2;
    add(p2b, new THREE.BoxGeometry(3.0, 0.14, 3.0), T.trim, 0, YB + 0.07, 0);
    for (let f = 0; f < 4; f++) {
      const g = new THREE.Group(); g.rotation.y = f * Math.PI / 2; p2b.add(g); railings.push(g);
      for (let i = 0; i < 9; i++) add(g, new THREE.CylinderGeometry(0.035, 0.045, 0.32, 8), T.cream, -1.35 + i * 0.3375, YB + 0.3, 1.42);
      add(g, new THREE.BoxGeometry(2.96, 0.06, 0.1), T.trim, 0, YB + 0.48, 1.42);
    }
  }

  // 2в. будка годинника: пілястри, фриз, карниз
  const Y3 = Y2 + H2 + 0.14, H3 = 2.2, W3 = 2.6, CYD = Y3 + H3 / 2, DR = 0.9;
  const p2c = part(2, 2);
  { add(p2c, new THREE.BoxGeometry(W3, H3, W3), T.plaster, 0, CYD, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      add(p2c, new THREE.BoxGeometry(0.3, H3, 0.3), T.purple, x * W3 / 2, CYD, z * W3 / 2);
      add(p2c, new THREE.BoxGeometry(0.4, 0.12, 0.4), T.trim, x * W3 / 2, Y3 + 0.06, z * W3 / 2);
    }
    for (let f = 0; f < 4; f++) {
      const g = new THREE.Group(); g.rotation.y = f * Math.PI / 2; p2c.add(g);
      for (let i = -5; i <= 5; i++) add(g, new THREE.BoxGeometry(0.11, 0.11, 0.1), T.trim, i * 0.2, Y3 + H3 - 0.12, W3 / 2 + 0.04);
      add(g, new THREE.TorusGeometry(DR + 0.13, 0.05, 8, 48), T.trim, 0, CYD, W3 / 2 + 0.01);
    }
    add(p2c, new THREE.BoxGeometry(3.0, 0.2, 3.0), T.trim, 0, Y3 + H3 + 0.1, 0);
    add(p2c, new THREE.BoxGeometry(2.8, 0.12, 2.8), T.purple, 0, Y3 + H3 + 0.26, 0);
  }

  // 2г. відкрита дзвіниця з дзвоном
  const Y4 = Y3 + H3 + 0.32, H4 = 1.35, W4 = 2.0;
  const p2d = part(2, 3);
  const bell = new THREE.Group();
  { add(p2d, new THREE.BoxGeometry(W4 + 0.1, 0.1, W4 + 0.1), T.trim, 0, Y4 + 0.05, 0);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(p2d, new THREE.BoxGeometry(0.3, H4, 0.3), T.plaster, x * (W4 / 2 - 0.15), Y4 + H4 / 2, z * (W4 / 2 - 0.15));
    for (let f = 0; f < 4; f++) {
      const g = new THREE.Group(); g.rotation.y = f * Math.PI / 2; p2d.add(g);
      const a = add(g, new THREE.TorusGeometry(0.55, 0.09, 8, 20, Math.PI), T.trim, 0, Y4 + H4 - 0.55, W4 / 2 - 0.15);
      add(g, new THREE.BoxGeometry(W4, 0.3, 0.2), T.plaster, 0, Y4 + H4 - 0.15, W4 / 2 - 0.15);
      add(g, new THREE.BoxGeometry(1.3, 0.08, 0.14), T.trim, 0, Y4 + 0.4, W4 / 2 - 0.15);
    }
    add(p2d, new THREE.BoxGeometry(W4 + 0.3, 0.14, W4 + 0.3), T.purple, 0, Y4 + H4 + 0.07, 0);
    const prof = [[0, -0.02], [0.36, 0], [0.33, 0.08], [0.25, 0.28], [0.21, 0.5], [0.18, 0.58], [0.08, 0.64], [0, 0.65]].map(([x, y]) => new THREE.Vector2(x, y));
    add(bell, new THREE.LatheGeometry(prof, 28), std(0xE0A62E, { metalness: 0.85, roughness: 0.28, side: THREE.DoubleSide }), 0, -0.65, 0);
    add(bell, new THREE.SphereGeometry(0.07, 10, 8), T.dark, 0, -0.58, 0);
    add(bell, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), T.iron, 0, 0.08, 0);
    bell.position.y = Y4 + H4 - 0.08; p2d.add(bell);
  }

  // 2ґ. черепичний дах, башточки, куля й флюгер
  const Y5 = Y4 + H4 + 0.14;
  const p2e = part(2, 4);
  const vane = new THREE.Group();
  { const cone = add(p2e, new THREE.ConeGeometry(1.5, 3.3, 8, 6), T.roof, 0, Y5 + 1.65, 0); cone.rotation.y = Math.PI / 8;
    // ребра вздовж граней даху: від кожного кута основи до вершини
    const apex = new THREE.Vector3(0, Y5 + 3.3, 0);
    for (let i = 0; i < 8; i++) {
      const th = i / 8 * Math.PI * 2 + Math.PI / 8;
      const base = new THREE.Vector3(Math.sin(th) * 1.5, Y5 + 0.02, Math.cos(th) * 1.5);
      const dir = apex.clone().sub(base), len = dir.length();
      const rib = add(p2e, new THREE.CylinderGeometry(0.03, 0.05, len, 6), T.trim);
      rib.position.copy(base).addScaledVector(dir, 0.5);
      rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      add(p2e, new THREE.CylinderGeometry(0.13, 0.15, 0.45, 8), T.plaster, x * 1.12, Y5 + 0.22, z * 1.12);
      add(p2e, new THREE.ConeGeometry(0.19, 0.75, 8), T.roof, x * 1.12, Y5 + 0.82, z * 1.12);
      add(p2e, new THREE.SphereGeometry(0.06, 8, 6), T.gold, x * 1.12, Y5 + 1.24, z * 1.12);
    }
    add(p2e, new THREE.SphereGeometry(0.17, 16, 12), T.gold, 0, Y5 + 3.38, 0);
    add(p2e, new THREE.CylinderGeometry(0.025, 0.025, 0.95, 6), T.iron, 0, Y5 + 3.85, 0);
    for (const [dx, dz] of [[1, 0], [0, 1]]) add(p2e, new THREE.BoxGeometry(dx ? 0.5 : 0.02, 0.02, dz ? 0.5 : 0.02), T.iron, 0, Y5 + 3.7, 0);
    add(vane, new THREE.BoxGeometry(0.9, 0.035, 0.035), T.iron);
    const tip = add(vane, new THREE.ConeGeometry(0.08, 0.22, 4), T.gold, 0.52, 0, 0); tip.rotation.z = -Math.PI / 2;
    add(vane, new THREE.BoxGeometry(0.22, 0.2, 0.02), T.gold, -0.42, 0.05, 0);
    vane.position.y = Y5 + 4.15; p2e.add(vane);
  }
  animated.push(t => { vane.rotation.y = Math.sin(t * 0.15) * 1.2 + 0.4; bell.rotation.z = Math.sin(t * 1.3) * 0.04; });

  // 3–10. циферблати: базовий шар, сектори, мітки хвилин, поділки, стрілки
  const faceTex = canvasTex(512, 512, (g, sz) => {
    g.fillStyle = '#FFFBF2'; g.beginPath(); g.arc(sz / 2, sz / 2, sz / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#E4D6F7'; g.lineWidth = 14; g.beginPath(); g.arc(sz / 2, sz / 2, sz * 0.47, 0, Math.PI * 2); g.stroke();
    g.font = '700 74px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const cols = ['#4FA8C4', '#E08A1E', '#E0679B'];
    for (let n = 1; n <= 12; n++) { const a = n / 12 * Math.PI * 2; g.fillStyle = cols[n % 3]; g.fillText(String(n), sz / 2 + Math.sin(a) * sz * 0.33, sz / 2 - Math.cos(a) * sz * 0.33 + 4); }
  });
  const minTex = canvasTex(512, 512, (g, sz) => {
    g.font = '700 30px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#D8433A';
    for (let n = 1; n <= 12; n++) { const a = n / 12 * Math.PI * 2; g.fillText(String((n * 5) % 60).padStart(2, '0'), sz / 2 + Math.sin(a) * sz * 0.43, sz / 2 - Math.cos(a) * sz * 0.43); }
  });
  const tickTex = canvasTex(512, 512, (g, sz) => {
    g.strokeStyle = '#4A3F7A'; g.lineCap = 'round';
    for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, big = i % 5 === 0; g.lineWidth = big ? 8 : 3.5; const r1 = sz * 0.485, r2 = sz * (big ? 0.445 : 0.465); g.beginPath(); g.moveTo(sz / 2 + Math.sin(a) * r1, sz / 2 - Math.cos(a) * r1); g.lineTo(sz / 2 + Math.sin(a) * r2, sz / 2 - Math.cos(a) * r2); g.stroke(); }
  });
  function handShape(kind) {
    const sh = new THREE.Shape();
    if (kind === 'h') { // годинна з «лопаткою»
      sh.moveTo(-0.045, -0.12); sh.lineTo(-0.045, 0.28); sh.quadraticCurveTo(-0.15, 0.34, -0.06, 0.44); sh.lineTo(0, 0.56); sh.lineTo(0.06, 0.44); sh.quadraticCurveTo(0.15, 0.34, 0.045, 0.28); sh.lineTo(0.045, -0.12); sh.lineTo(-0.045, -0.12);
    } else { // хвилинна з противагою
      sh.moveTo(-0.03, -0.1); sh.lineTo(-0.03, 0.68); sh.lineTo(0, 0.8); sh.lineTo(0.03, 0.68); sh.lineTo(0.03, -0.1); sh.lineTo(-0.03, -0.1);
      const cw = new THREE.Shape(); cw.absarc(0, -0.17, 0.075, 0, Math.PI * 2, false); return [sh, cw];
    }
    return [sh];
  }
  const extr = shapes => new THREE.ExtrudeGeometry(shapes, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
  const HG = extr(handShape('h')), MG = extr(handShape('m'));
  const SG = new THREE.BoxGeometry(0.018, 0.92, 0.012).translate(0, 0.3, 0);
  const hands = { h: [], m: [], s: [] };
  /* «Підсвітка» уроку: те, що вивчаємо на етапі, м'яко пульсує (стрілка, цифри хвилин чи рисочки) */
  const focusable = { nums: [], ticks: [] };
  let focusKey = null;
  let frontFace = null;   // циферблат, що дивиться в камеру в режимі гри — на ньому крутять стрілки
  const pD = part(3), pH = part(4), pM = part(5), pHalf = part(6), pQ = part(7), pMin = part(8), pTick = part(9), pS = part(10);
  for (let f = 0; f < 4; f++) {
    const a = f * Math.PI / 2;
    const anchor = (p) => { const g = new THREE.Group(); g.position.set(Math.sin(a) * (W3 / 2 + 0.02), CYD, Math.cos(a) * (W3 / 2 + 0.02)); g.rotation.y = a; p.add(g); return g; };
    const d = anchor(pD);
    add(d, new THREE.CylinderGeometry(DR + 0.07, DR + 0.07, 0.06, 48), T.dark, 0, 0, 0.01).rotation.x = Math.PI / 2;
    add(d, new THREE.TorusGeometry(DR + 0.04, 0.07, 12, 56), T.gold, 0, 0, 0.06);
    const faceMesh = add(d, new THREE.CircleGeometry(DR, 56), new THREE.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, emissive: 0xFFFFFF, emissiveIntensity: 0.18, roughness: 0.55 }), 0, 0, 0.045);
    if (f === 0) frontFace = faceMesh;
    add(d, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), T.gold, 0, 0, 0.17).rotation.x = Math.PI / 2;
    const sector = (p, start, len, z) => { const g = anchor(p); add(g, new THREE.CircleGeometry(DR * 0.93, 40, start, len), new THREE.MeshBasicMaterial({ color: 0xFFE27A, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }), 0, 0, z); };
    sector(pHalf, -Math.PI / 2, Math.PI, 0.05); sector(pQ, 0, Math.PI / 2, 0.051);
    focusable.nums.push(add(anchor(pMin), new THREE.PlaneGeometry(DR * 2, DR * 2), new THREE.MeshBasicMaterial({ map: minTex, transparent: true, depthWrite: false }), 0, 0, 0.055));
    focusable.ticks.push(add(anchor(pTick), new THREE.PlaneGeometry(DR * 2, DR * 2), new THREE.MeshBasicMaterial({ map: tickTex, transparent: true, depthWrite: false }), 0, 0, 0.056));
    hands.h.push(add(anchor(pH), HG, std(0xFF5A5F, { roughness: 0.45 }), 0, 0, 0.08));   // ті самі кольори, що в уроці й відео: годинна червона
    hands.m.push(add(anchor(pM), MG, std(0x2D8CFF, { roughness: 0.45 }), 0, 0, 0.11));   // хвилинна синя
    const sh = add(anchor(pS), SG, glow(0xFF9F1A), 0, 0, 0.145);   // секундна помаранчева
    add(sh, new THREE.CircleGeometry(0.05, 12), glow(0xFF9F1A), 0, -0.12, 0.007);
    hands.s.push(sh);
  }

  // 11. ліхтарі на сходах і гірлянда вздовж балкона: вмикаються вночі
  const pL = part(11);
  for (const sx of [-1, 1]) {
    add(pL, new THREE.CylinderGeometry(0.04, 0.05, 1.0, 8), T.iron, sx * 0.72, 1.25, 2.2);
    add(pL, new THREE.ConeGeometry(0.17, 0.14, 4), T.iron, sx * 0.72, 2.0, 2.2).rotation.y = Math.PI / 4;
    add(pL, new RoundedBoxGeometry(0.22, 0.28, 0.22, 2, 0.04), glass(), sx * 0.72, 1.8, 2.2);
  }
  for (let f = 0; f < 4; f++) for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); g.rotation.y = f * Math.PI / 2; pL.add(g);
    const x = -1.2 + i * 0.4, sag = Math.sin((i + 0.5) / 7 * Math.PI) * 0.06;
    add(g, new THREE.SphereGeometry(0.05, 8, 6), glass(), x, Y2 + H2 + 0.62 - sag, 1.45);
  }

  // пласкі грані, як у планети: менше сегментів на всіх круглих деталях
  const lowRad = r => r < 0.12 ? 6 : r < 0.5 ? 8 : 12;
  for (const g of parts) g.traverse(o => {
    if (!o.isMesh || !o.geometry.parameters) return;
    const P = o.geometry.parameters, t = o.geometry.type; let ng = null;
    if (t === 'CylinderGeometry' && P.radialSegments > 6) ng = new THREE.CylinderGeometry(P.radiusTop, P.radiusBottom, P.height, Math.min(P.radialSegments, lowRad(Math.max(P.radiusTop, P.radiusBottom))), P.heightSegments, P.openEnded, P.thetaStart, P.thetaLength);
    else if (t === 'ConeGeometry' && P.radialSegments > 6) ng = new THREE.ConeGeometry(P.radius, P.height, Math.min(P.radialSegments, lowRad(P.radius)), P.heightSegments, P.openEnded, P.thetaStart, P.thetaLength);
    else if (t === 'SphereGeometry') ng = new THREE.SphereGeometry(P.radius, Math.min(P.widthSegments, 9), Math.min(P.heightSegments, 6), P.phiStart, P.phiLength, P.thetaStart, P.thetaLength);
    else if (t === 'TorusGeometry') ng = new THREE.TorusGeometry(P.radius, P.tube, Math.min(P.radialSegments, 5), Math.min(P.tubularSegments, 24), P.arc);
    else if (t === 'LatheGeometry') ng = new THREE.LatheGeometry(P.points, Math.min(P.segments, 9), P.phiStart, P.phiLength);
    if (ng) { o.geometry.dispose(); o.geometry = ng; }
    if (o.material.isMeshStandardMaterial && !o.material.map?.image?.width === 512) o.material.flatShading = true;
  });
  // світні бірюзові смуги на стиках ярусів — технологічний акцент
  {
    const pG = part(2, 5), neon = glow(0x6FF0FF);
    for (const [y, w] of [[Y2 + 0.02, W2 + 0.08], [Y3 + 0.04, W3 + 0.1], [Y4 + 0.02, W4 + 0.1]])
      for (let f = 0; f < 4; f++) { const m = add(pG, new THREE.BoxGeometry(w, 0.05, 0.05), neon, 0, y, 0); m.rotation.y = f * Math.PI / 2; m.translateZ(w / 2); }
  }

  // контури-креслення для непобудованого
  for (const g of parts) g.traverse(o => {
    if (!o.isMesh) return;
    o.userData.mat = o.material;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 25), ghostLine);
    e.visible = false; o.add(e); o.userData.edges = e;
  });

  tower.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  /* ---------- Коралова трава, що гойдається ---------- */
  const windU = { value: 0 };
  function windy(mat, amp = 0.18) {
    mat.onBeforeCompile = sh => {
      sh.uniforms.uWind = windU;
      sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ip = instanceMatrix[3].xyz;
        float sw = sin(uWind * 1.6 + ip.x * 1.8 + ip.z * 1.1) + 0.4 * sin(uWind * 3.1 + ip.y * 2.0);
        transformed.x += sw * ${amp.toFixed(3)} * position.y * position.y;
        transformed.z += sw * ${(amp * 0.5).toFixed(3)} * position.y * position.y;`);
    };
    return mat;
  }
  const tuftGeo = (() => {
    const v = [];
    for (let b = 0; b < 4; b++) {
      const a = b / 4 * Math.PI * 2 + rng(), lean = 0.15 + rng() * 0.25, hgt = 0.55 + rng() * 0.5, w = 0.07;
      const dx = Math.cos(a), dz = Math.sin(a), ox = Math.cos(a + 1.57) * w, oz = Math.sin(a + 1.57) * w;
      v.push(-ox, 0, -oz, ox, 0, oz, dx * lean, hgt, dz * lean);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(v.length / 3).fill([0, 1, 0]).flat(), 3));
    return g;
  })();
  const GRASS_MAX = 5200;
  const grass = new THREE.InstancedMesh(tuftGeo, windy(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.9 })), GRASS_MAX);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), c = new THREE.Color(); let n = 0, guard = 0;
    while (n < GRASS_MAX && guard++ < GRASS_MAX * 5) {
      const d = new THREE.Vector3().randomDirection(); if (d.y > 0.86) continue;
      const r = HOME_R + surfH(d); if (r < WATER + 0.15 || r > HOME_R + 0.6) continue;
      const s = 0.22 + rng() * 0.2;
      q.setFromUnitVectors(UP, d).multiply(q2.setFromAxisAngle(UP, rng() * 6.28));
      m.compose(d.clone().multiplyScalar(r - 0.02), q, new THREE.Vector3(s, s * (0.8 + rng() * 0.6), s));
      grass.setMatrixAt(n, m); grass.setColorAt(n, c.setHSL(0.01 + rng() * 0.05, 0.8, 0.5 + rng() * 0.14)); n++;
    }
    grass.count = n; grass.userData.max = n;
  }
  grass.receiveShadow = true; home.add(grass);

  /* ---------- Скелі-«зуби» з рожевими шарами ---------- */
  function jitter(geo, amt) {
    const p = geo.attributes.position, v = new THREE.Vector3(), map = new Map();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const k = v.x.toFixed(2) + ',' + v.y.toFixed(2) + ',' + v.z.toFixed(2);
      if (!map.has(k)) map.set(k, [(rng() - .5) * amt, (rng() - .5) * amt * 0.6, (rng() - .5) * amt]);
      const d = map.get(k); p.setXYZ(i, v.x + d[0], v.y + d[1], v.z + d[2]);
    }
    return geo;
  }
  function strata(geo, cols, scale) {
    geo = geo.index ? geo.toNonIndexed() : geo;
    const p = geo.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let t = 0; t < p.count; t += 3) {
      const y = (p.getY(t) + p.getY(t + 1) + p.getY(t + 2)) / 3, b = Math.floor(y * scale + 100) % cols.length;
      c.set(cols[b]).offsetHSL(0, 0, (rng() - .5) * 0.05);
      for (let j = 0; j < 3; j++) col.set([c.r, c.g, c.b], (t + j) * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals(); return geo;
  }
  const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const ROCK_COLS = [0xEFA7B2, 0xF7D4C4, 0xD98BA6, 0xB59BDB, 0xF2B9A6];
  for (let i = 0; i < 16; i++) {
    const d = randDir(0.95), h = 0.9 + rng() * 1.8, r = 0.25 + rng() * 0.35;
    const g = placeN(home, d, -0.2);
    const m = add(g, strata(jitter(new THREE.CylinderGeometry(r * (0.15 + rng() * 0.3), r, h, 7, 5), r * 0.35), ROCK_COLS, 4), rockMat, 0, h / 2, 0);
    m.rotation.set((rng() - .5) * 0.2, rng() * 6, (rng() - .5) * 0.2); m.castShadow = true; m.receiveShadow = true;
  }
  // кам'яна арка
  {
    const g = placeN(home, FRONT.clone().multiplyScalar(-0.7).addScaledVector(SIDE, 0.7).add(new THREE.Vector3(0, 0.2, 0)), -0.25);
    const m = add(g, strata(jitter(new THREE.TorusGeometry(1.1, 0.28, 7, 18, Math.PI), 0.15), ROCK_COLS, 5), rockMat);
    m.castShadow = true;
  }
  // валуни
  {
    const geo = jitter(new THREE.IcosahedronGeometry(1, 0), 0.5); geo.computeVertexNormals();
    const bm = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xFFFFFF, flatShading: true, roughness: 0.9 }), 40);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
    for (let i = 0; i < 40; i++) {
      const d = randDir(0.6), s = 0.08 + Math.pow(rng(), 2) * 0.3;
      m.compose(d.clone().multiplyScalar(HOME_R + surfH(d) + s * 0.1), q.setFromEuler(e.set(rng() * 3, rng() * 3, rng() * 3)), new THREE.Vector3(s, s * 0.7, s));
      bm.setMatrixAt(i, m); bm.setColorAt(i, c.set(ROCK_COLS[i % 5]));
    }
    bm.castShadow = true; bm.receiveShadow = true; home.add(bm);
  }

  /* ---------- Світна флора: цибулини, грибні дерева, корали ---------- */
  function glowBulbs(center, n, spread) {
    const stalk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.015, 0.03, 1, 5), std(0x2E6B6A), n);
    const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0xFFFFFF, toneMapped: false }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const d = center.clone().add(v.randomDirection().multiplyScalar(rng() * spread)).normalize(), r = HOME_R + surfH(d), h = 0.25 + rng() * 0.5;
      q.setFromUnitVectors(UP, d);
      m.compose(d.clone().multiplyScalar(r + h / 2), q, new THREE.Vector3(1, h, 1)); stalk.setMatrixAt(i, m);
      const s = 0.7 + rng() * 0.8; m.compose(d.clone().multiplyScalar(r + h + 0.04), q, new THREE.Vector3(s, s * 1.2, s)); bulb.setMatrixAt(i, m);
      bulb.setColorAt(i, c.setHSL([0.48, 0.52, 0.86, 0.9][i % 4], 0.9, 0.62));
    }
    stalk.castShadow = true; home.add(stalk, bulb);
  }
  const capTex = canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#2EC4B6'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.fillStyle = rng() < .5 ? '#9FF5E6' : '#1A8F9A'; g.beginPath(); g.arc(rng() * w, rng() * h * 0.8, 3 + rng() * 7, 0, 7); g.fill(); } });
  const capMat = std(0xFFFFFF, { map: capTex, roughness: 0.6, emissive: 0x0B6F6A, emissiveIntensity: 0.35 });
  function mushTree(d, h) {
    const g = placeN(home, d, -0.05); g.rotateX((rng() - .5) * 0.3);
    add(g, new THREE.CylinderGeometry(0.06, 0.12, h, 8), std(0xF3E6D2, { roughness: 0.8 }), 0, h / 2, 0).castShadow = true;
    const R = 0.45 + h * 0.2;
    const cap = add(g, new THREE.SphereGeometry(R, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), capMat, 0, h - 0.05, 0); cap.scale.y = 0.55; cap.castShadow = true;
    add(g, new THREE.CircleGeometry(R, 20), std(0xF7B8C8, { side: THREE.DoubleSide }), 0, h - 0.05, 0).rotation.x = Math.PI / 2;
  }
  function coral(d, n) {
    const geo = new THREE.ConeGeometry(0.045, 0.45, 5); geo.translate(0, 0.22, 0);
    const im = new THREE.InstancedMesh(geo, windy(std(0xFFFFFF, { roughness: 0.6 }), 0.05), n * 7);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color(), v = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < n; i++) {
      const dd = d.clone().add(v.randomDirection().multiplyScalar(0.12)).normalize(), r = HOME_R + surfH(dd), hue = [0.1, 0.13, 0.95][i % 3];
      for (let j = 0; j < 7; j++) {
        const s = 0.6 + rng() * 0.9;
        q.setFromUnitVectors(UP, dd).multiply(q2.setFromEuler(e.set((rng() - .5) * 1.1, rng() * 6, (rng() - .5) * 1.1)));
        m.compose(dd.clone().multiplyScalar(r - 0.03), q, new THREE.Vector3(s, s, s)); im.setMatrixAt(k, m); im.setColorAt(k, c.setHSL(hue, 0.85, 0.6)); k++;
      }
    }
    im.castShadow = true; home.add(im);
  }
  for (let i = 0; i < 9; i++) mushTree(randDir(0.85), 0.7 + rng() * 0.9);
  for (let i = 0; i < 4; i++) glowBulbs(randDir(0.9), 22, 0.18);
  for (let i = 0; i < 8; i++) coral(randDir(0.8), 3);
  // біля площі — кілька світних цибулин і грибів у кадрі
  glowBulbs(FRONT.clone().multiplyScalar(0.62).addScaledVector(SIDE, 0.45).add(new THREE.Vector3(0, 0.75, 0)).normalize(), 18, 0.12);
  mushTree(FRONT.clone().multiplyScalar(-0.55).addScaledVector(SIDE, -0.6).add(new THREE.Vector3(0, 0.6, 0)), 1.3);
  mushTree(FRONT.clone().multiplyScalar(0.3).addScaledVector(SIDE, -0.75).add(new THREE.Vector3(0, 0.6, 0)), 1.0);

  /* ---------- Смугасті травоїдні: вигаданий вид, гуляють довкола планети ---------- */
  const stripeTex = canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = '#F6E3C2'; g.fillRect(0, 0, w, h);
    for (let x = 6; x < w; x += 22) { g.fillStyle = '#E0742E'; g.beginPath(); g.moveTo(x, 0); g.quadraticCurveTo(x + 8, h / 2, x, h); g.lineTo(x + 9, h); g.quadraticCurveTo(x + 16, h / 2, x + 9, 0); g.fill(); }
  });
  const critters = [];
  function critter(axis, start, speed, scale) {
    const body = new THREE.Group();
    const skin = std(0xFFFFFF, { map: stripeTex, roughness: 0.7 }), belly = std(0xF6E3C2), dark = std(0x4A2C3A);
    const torso = add(body, new THREE.SphereGeometry(1, 20, 14), skin, 0, 1.9, 0); torso.scale.set(0.95, 0.8, 1.6);
    const neck = new THREE.Group(); neck.position.set(0, 2.2, 1.2); body.add(neck);
    add(neck, new THREE.CylinderGeometry(0.22, 0.35, 1.6, 10), skin, 0, 0.7, 0.3).rotation.x = 0.45;
    const head = new THREE.Group(); head.position.set(0, 1.45, 0.75); neck.add(head);
    add(head, new THREE.SphereGeometry(0.42, 16, 12), belly).scale.set(0.9, 0.85, 1.25);
    for (const s of [-1, 1]) {
      add(head, new THREE.SphereGeometry(0.1, 10, 8), dark, s * 0.24, 0.12, 0.3);
      add(head, new THREE.SphereGeometry(0.03, 6, 4), glow(0xFFFFFF), s * 0.25, 0.16, 0.38);
      add(head, new THREE.ConeGeometry(0.06, 0.55, 6), std(0x7FE0D8, { emissive: 0x1A6E6A, emissiveIntensity: 0.6 }), s * 0.18, 0.5, -0.1).rotation.z = -s * 0.35;
    }
    const tail = add(body, new THREE.ConeGeometry(0.16, 1.2, 8), skin, 0, 2.0, -1.9); tail.rotation.x = -1.9;
    const legs = [];
    for (const [lx, lz] of [[-0.5, 0.9], [0.5, 0.9], [-0.5, -0.9], [0.5, -0.9]]) {
      const leg = new THREE.Group(); leg.position.set(lx, 1.6, lz); body.add(leg);
      add(leg, new THREE.CylinderGeometry(0.13, 0.09, 1.6, 8), skin, 0, -0.8, 0);
      add(leg, new THREE.SphereGeometry(0.14, 8, 6), dark, 0, -1.6, 0.04);
      legs.push(leg);
    }
    body.traverse(o => { if (o.isMesh) o.castShadow = true; });
    body.scale.setScalar(scale);
    const holder = new THREE.Group(); holder.add(body); home.add(holder);
    critters.push({ holder, body, neck, legs, tail, axis: axis.normalize(), start: start.normalize(), speed, ph: rng() * 6, a: 0 });
  }
  critter(FRONT.clone().addScaledVector(SIDE, 0.4).add(new THREE.Vector3(0, -0.3, 0)), new THREE.Vector3(0, 0.45, 1).addScaledVector(SIDE, 1.2), 0.05, 0.13);
  critter(FRONT.clone().addScaledVector(SIDE, 0.6).add(new THREE.Vector3(0, -0.25, 0)), new THREE.Vector3(0.2, 0.42, 1).addScaledVector(SIDE, 1.5), 0.05, 0.1);
  critter(SIDE.clone().add(new THREE.Vector3(0, 0.2, 0.3)), FRONT.clone().negate().add(new THREE.Vector3(0, 0.3, 0)), -0.04, 0.12);
  const _n = new THREE.Vector3(), _n2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
  function updateCritters(t, dt) {
    for (const c of critters) {
      // ходить і зупиняється попастися
      const walking = Math.sin(t * 0.35 + c.ph) > -0.3;
      if (walking) c.a += dt * c.speed;
      _n.copy(c.start).projectOnPlane(c.axis).normalize().applyAxisAngle(c.axis, c.a);
      _n2.copy(c.start).projectOnPlane(c.axis).normalize().applyAxisAngle(c.axis, c.a + 0.01 * Math.sign(c.speed));
      const r = HOME_R + surfH(_n);
      c.holder.position.copy(_n).multiplyScalar(Math.max(r, WATER + 0.02) - 0.01);
      const fwd = _n2.sub(_n).normalize();
      _m.lookAt(new THREE.Vector3(), fwd, _n); c.holder.quaternion.setFromRotationMatrix(_m); c.holder.rotateY(Math.PI);
      c.ph += 0; const lp = t * 7 + c.ph;
      c.legs.forEach((l, i) => l.rotation.x = walking ? Math.sin(lp + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.45 : 0);
      c.neck.rotation.x += ((walking ? 0 : 1.0) - c.neck.rotation.x) * Math.min(1, dt * 3);
      c.tail.rotation.z = Math.sin(t * 3 + c.ph) * 0.3;
    }
  }

  /* ---------- Жителі планети: приходять до вежі, щоб дізнатися, що таке час ---------- */
  const bubbleTex = sym => canvasTex(128, 128, (g, w) => {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(64, 56, 46, 0, 7); g.fill();
    g.beginPath(); g.moveTo(48, 96); g.lineTo(40, 122); g.lineTo(70, 100); g.fill();
    if (sym === 'clock') {
      g.strokeStyle = '#173A44'; g.lineWidth = 7; g.beginPath(); g.arc(64, 56, 28, 0, 7); g.stroke();
      g.lineCap = 'round'; g.beginPath(); g.moveTo(64, 56); g.lineTo(64, 38); g.moveTo(64, 56); g.lineTo(78, 62); g.stroke();
    } else { g.fillStyle = sym === '?' ? '#1A8A90' : '#FF7A2E'; g.font = '700 70px Nunito, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(sym, 64, 60); }
  });
  const BUB = { q: bubbleTex('?'), ex: bubbleTex('!'), clock: bubbleTex('clock') };
  const locals = [];
  function makeLocal(col, a, r) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const skin = std(col, { flatShading: true, roughness: 0.6 });
    const b = add(body, new THREE.SphereGeometry(0.22, 9, 7), skin, 0, 0.26, 0); b.scale.set(1, 1.15, 0.95);
    add(body, new THREE.SphereGeometry(0.1, 10, 8), std(0xFFFFFF, { roughness: 0.3 }), 0, 0.33, 0.17);
    add(body, new THREE.SphereGeometry(0.055, 8, 6), std(0x173A44, { roughness: 0.2 }), 0, 0.33, 0.24);
    add(body, new THREE.SphereGeometry(0.018, 6, 4), glow(0xFFFFFF), 0.02, 0.35, 0.29);
    for (const s of [-1, 1]) {
      const st = add(body, new THREE.CylinderGeometry(0.01, 0.014, 0.2, 5), skin, s * 0.08, 0.55, 0); st.rotation.z = -s * 0.4;
      add(body, new THREE.ConeGeometry(0.045, 0.12, 5), glow(0x9FF5E6), s * 0.13, 0.66, 0).rotation.z = -s * 0.4;
      add(body, new THREE.SphereGeometry(0.06, 7, 5), std(0x173A44), s * 0.1, 0.04, 0.04).scale.set(1, 0.6, 1.4);
    }
    body.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const bub = new THREE.Sprite(new THREE.SpriteMaterial({ map: BUB.q, depthWrite: false })); bub.scale.set(0.32, 0.32, 1); bub.position.set(0.18, 0.95, 0); g.add(bub);
    // стоять на площі біля вежі й дивляться на неї
    const dir = FRONT.clone().applyAxisAngle(UP, a);
    g.position.copy(dir).multiplyScalar(r).setY(HOME_R + 0.05); home.add(g);
    const lk = dir.clone().multiplyScalar(-0.45).addScaledVector(FRONT, 0.55); g.rotation.y = Math.atan2(lk.x, lk.z);  // напівоберт: видно і обличчя, і що дивляться на вежу
    g.scale.setScalar(1.45); g.visible = false;
    locals.push({ g, body, bub, ph: rng() * 6, hop: 0 });
  }
  [[0xB59BDB, -1.05, 2.7], [0x2EC4B6, 0.6, 2.75], [0xFF9E6E, -1.5, 2.65], [0xF0A0C8, 1.05, 2.7], [0x7CF0A8, 1.5, 2.6]].forEach(([c, a, r]) => makeLocal(c, a, r));
  let localsSeen = 0, bubbleUntil = 0;
  function updateLocals(t, now) {
    const want = Math.min(locals.length, stage + 1);
    locals.forEach((L, i) => {
      if (i < want && !L.g.visible) { L.g.visible = true; L.hop = now; }
      if (i >= want) L.g.visible = false;
      const since = (now - L.hop) / 1000;
      L.body.position.y = since < 0.9 ? Math.abs(Math.sin(since * Math.PI * 2.2)) * 0.25 * (1 - since / 0.9) : Math.abs(Math.sin(t * 2 + L.ph)) * 0.02;
      L.body.rotation.z = Math.sin(t * 1.5 + L.ph) * 0.06;
      const sym = stage <= 2 ? BUB.q : stage === 11 ? BUB.clock : (now < bubbleUntil ? BUB.ex : null);
      L.bub.visible = !!sym; if (sym && L.bub.material.map !== sym) { L.bub.material.map = sym; L.bub.material.needsUpdate = true; }
      L.bub.position.y = 0.95 + Math.sin(t * 2 + L.ph) * 0.03;
    });
  }
  function cheerLocals() { const now = performance.now(); bubbleUntil = now + 2600; locals.forEach((L, i) => { if (L.g.visible) L.hop = now + i * 90; }); }

  /* ---------- Кораблі ---------- */
  function makeCraft(scale, paint) {
    const g = new THREE.Group();
    const hull = std(paint, { roughness: 0.45, metalness: 0.25 }), white = std(0xF3F1EC, { roughness: 0.5, metalness: 0.2 }), darkM = std(0x2C3340, { roughness: 0.6, metalness: 0.5 });
    const fus = add(g, new THREE.CapsuleGeometry(0.9, 3.4, 6, 16), white); fus.rotation.x = Math.PI / 2; fus.scale.set(1, 1, 0.8);
    add(g, new THREE.CapsuleGeometry(0.92, 1.6, 6, 16), hull, 0, 0.02, -0.6).rotation.x = Math.PI / 2;
    const cock = add(g, new THREE.SphereGeometry(0.75, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0x3FD0E0, { roughness: 0.08, metalness: 0.6, emissive: 0x0A3A44 }), 0, 0.45, 1.0); cock.scale.set(0.9, 0.7, 1.5);
    for (const s of [-1, 1]) {
      const w = add(g, new THREE.BoxGeometry(2.6, 0.12, 1.4), hull, s * 1.8, -0.1, -0.7); w.rotation.z = s * -0.12; w.rotation.y = s * 0.25;
      add(g, new THREE.BoxGeometry(0.5, 0.14, 1.5), white, s * 2.9, -0.24, -0.9).rotation.z = s * -0.12;
      const eng = add(g, new THREE.CylinderGeometry(0.42, 0.5, 1.6, 14), darkM, s * 1.0, -0.15, -2.1); eng.rotation.x = Math.PI / 2;
      add(g, new THREE.CircleGeometry(0.36, 16), glow(0x6FF0FF), s * 1.0, -0.15, -2.92).rotation.y = Math.PI;
    }
    add(g, new THREE.BoxGeometry(0.12, 1.1, 1.2), hull, 0, 0.75, -1.9).rotation.x = -0.3;
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(scale); return g;
  }
  // корабель Тіка на посадковому майданчику
  {
    const g = placeN(home, FRONT.clone().multiplyScalar(0.55).addScaledVector(SIDE, -0.62).add(new THREE.Vector3(0, 0.55, 0)), 0.02);
    add(g, new THREE.CylinderGeometry(1.0, 1.1, 0.12, 8), std(0x5B5F78, { roughness: 0.6, metalness: 0.3 }), 0, 0, 0).receiveShadow = true;
    add(g, new THREE.RingGeometry(0.75, 0.84, 8), glow(0xFFB43C), 0, 0.07, 0).rotation.x = -Math.PI / 2;
    const ship = makeCraft(0.24, 0xFF7A2E); ship.position.y = 0.38; ship.rotation.y = 2.2; g.add(ship);
    for (const [lx, lz] of [[0, 1.6], [-1.3, -1.4], [1.3, -1.4]]) add(ship, new THREE.CylinderGeometry(0.07, 0.1, 1.5, 6), std(0x2C3340, { metalness: 0.5 }), lx, -0.9, lz);
  }
  // кораблі на орбіті зі слідами
  const flyers = [];
  for (let i = 0; i < 2; i++) {
    const craft = makeCraft(0.16, [0x7C6CFF, 0x2EC4B6][i]); craft.traverse(o => o.castShadow = false); scene.add(craft);
    const N = high ? 80 : 40, geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(N), 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = clamp(260.0 * (0.4 + (1.0-alpha)*1.2) / -mv.z, 1.5, 40.0); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying float vA; void main(){ float d = length(gl_PointCoord-0.5); gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * smoothstep(0.5, 0.0, d) * vA * 0.55, 1.0); }'
    });
    const trail = new THREE.Points(geo, mat); trail.frustumCulled = false; scene.add(trail);
    const axis = new THREE.Vector3(i ? 0.3 : -0.4, 1, i ? -0.5 : 0.2).normalize();
    flyers.push({ craft, geo, hist: [], N, axis, R: 11 + i * 3, speed: (i ? -1 : 1) * (0.32 - i * 0.08), ph: i * 2.5 });
  }
  const _v = new THREE.Vector3();
  function updateFlyers(t) {
    for (const f of flyers) {
      const base = new THREE.Vector3(1, 0, 0).projectOnPlane(f.axis).normalize().multiplyScalar(f.R);
      const p = base.clone().applyAxisAngle(f.axis, t * f.speed + f.ph), p2 = base.clone().applyAxisAngle(f.axis, t * f.speed + f.ph + 0.02 * Math.sign(f.speed));
      f.craft.position.copy(p); f.craft.up.copy(p).normalize(); f.craft.lookAt(p2);
      f.hist.unshift(p.clone()); if (f.hist.length > f.N) f.hist.length = f.N;
      const P = f.geo.attributes.position, A = f.geo.attributes.alpha;
      for (let i = 0; i < f.N; i++) { const h = f.hist[Math.min(i, f.hist.length - 1)]; P.setXYZ(i, h.x, h.y, h.z); A.setX(i, i < f.hist.length ? 1 - i / f.N : 0); }
      P.needsUpdate = A.needsUpdate = true;
    }
  }

  /* ---------- Тік-астронавт з реактивним ранцем ---------- */
  function makeTik() {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const yel = std(0xFFC93C, { emissive: 0x3A2600, roughness: 0.45 }), gold = std(0xE39A12, { roughness: 0.4 }), suit = std(0xF3F1EC, { roughness: 0.55 }), orange = std(0xFF7A2E, { roughness: 0.5 });
    const disk = add(body, new THREE.CylinderGeometry(0.75, 0.75, 0.42, 32), yel, 0, 1.45, 0); disk.rotation.x = Math.PI / 2;
    add(body, new THREE.TorusGeometry(0.75, 0.08, 10, 32), gold, 0, 1.45, 0);
    const faceT = canvasTex(256, 256, (cx, s) => {
      cx.fillStyle = '#FFFBEF'; cx.beginPath(); cx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = '#EAD8A8'; cx.lineWidth = 8; cx.lineCap = 'round';
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; cx.beginPath(); cx.moveTo(s / 2 + Math.sin(a) * s * 0.44, s / 2 - Math.cos(a) * s * 0.44); cx.lineTo(s / 2 + Math.sin(a) * s * 0.36, s / 2 - Math.cos(a) * s * 0.36); cx.stroke(); }
      cx.fillStyle = 'rgba(255,120,150,.45)'; cx.beginPath(); cx.arc(s * 0.27, s * 0.6, 18, 0, Math.PI * 2); cx.fill(); cx.beginPath(); cx.arc(s * 0.73, s * 0.6, 18, 0, Math.PI * 2); cx.fill();
      cx.strokeStyle = '#2E2640'; cx.lineWidth = 9; cx.beginPath(); cx.arc(s / 2, s * 0.6, 26, 0.15 * Math.PI, 0.85 * Math.PI); cx.stroke();
    });
    add(body, new THREE.CircleGeometry(0.62, 32), new THREE.MeshStandardMaterial({ map: faceT, roughness: 0.5 }), 0, 1.45, 0.22);
    const eyes = [];
    for (const sx of [-1, 1]) {
      const e = add(body, new THREE.SphereGeometry(0.1, 16, 12), std(0x2E2640, { roughness: 0.2 }), sx * 0.22, 1.55, 0.25); e.scale.set(0.9, 1.3, 0.5); eyes.push(e);
      add(body, new THREE.SphereGeometry(0.032, 8, 6), glow(0xFFFFFF), sx * 0.22 + 0.03, 1.6, 0.3);
    }
    const helmet = add(body, new THREE.SphereGeometry(1.0, 32, 20), new THREE.MeshStandardMaterial({ color: 0xBFF6FF, transparent: true, opacity: 0.16, roughness: 0.05, depthWrite: false }), 0, 1.5, 0);
    add(body, new THREE.TorusGeometry(1.0, 0.03, 8, 40), new THREE.MeshBasicMaterial({ color: 0xE0FFFF, transparent: true, opacity: 0.35, toneMapped: false }), 0, 1.5, 0).rotation.y = 0.5;
    add(body, new THREE.TorusGeometry(0.62, 0.12, 10, 28), suit, 0, 0.66, 0).rotation.x = Math.PI / 2;
    add(body, new THREE.CylinderGeometry(0.03, 0.03, 0.4, 6), gold, 0.45, 2.55, -0.1).rotation.z = -0.3;
    add(body, new THREE.SphereGeometry(0.08, 10, 8), glow(0xFF4F8F), 0.52, 2.75, -0.1);
    add(body, new RoundedBoxGeometry(0.9, 1.0, 0.45, 3, 0.12), suit, 0, 1.35, -0.75);
    add(body, new RoundedBoxGeometry(0.6, 0.18, 0.47, 2, 0.06), orange, 0, 1.6, -0.75);
    const flames = [];
    for (const sx of [-1, 1]) {
      add(body, new THREE.CylinderGeometry(0.11, 0.14, 0.3, 10), std(0x3A3550, { metalness: 0.5 }), sx * 0.25, 0.75, -0.8);
      const f = add(body, new THREE.ConeGeometry(0.12, 0.7, 10), glow(0x7FF0FF), sx * 0.25, 0.3, -0.8); f.rotation.x = Math.PI; flames.push(f);
    }
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(sx * 0.75, 1.4, 0); body.add(arm);
      add(arm, new THREE.CapsuleGeometry(0.08, 0.4, 4, 8), suit, sx * 0.18, -0.15, 0).rotation.z = sx * 0.9;
      add(arm, new THREE.SphereGeometry(0.13, 12, 8), orange, sx * 0.38, -0.32, 0);
      arms.push(arm);
    }
    const legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sx * 0.28, 0.75, 0); body.add(leg);
      add(leg, new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), suit, 0, -0.15, 0);
      add(leg, new RoundedBoxGeometry(0.28, 0.17, 0.38, 2, 0.06), orange, 0, -0.38, 0.05);
      legs.push(leg);
    }
    g.traverse(o => { if (o.isMesh && o !== helmet) o.castShadow = true; });
    g.userData = { body, eyes, arms, legs, flames };
    return g;
  }
  const tik = makeTik(); tik.scale.setScalar(0.42); home.add(tik);
  const puffN = 50, puffGeo = new THREE.BufferGeometry(); puffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(puffN * 3), 3));
  const puffs = new THREE.Points(puffGeo, new THREE.PointsMaterial({ color: 0xC8FBFF, size: 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  puffs.frustumCulled = false; home.add(puffs);
  const puffHist = [];
  let waveUntil = 0;

  /* ---------- Ракурси: камера показує ту частину вежі, яку будують (координати планети) ---------- */
  function stageView(s) {
    const B = HOME_R;
    const turn = a => FRONT.clone().applyAxisAngle(UP, a);
    const at = (dir, dist, ty, lift) => ({ pos: dir.clone().multiplyScalar(dist).add(new THREE.Vector3(0, B + ty + lift, 0)), target: new THREE.Vector3(0, B + ty, 0) });
    const dial = (a, dist, lift) => { const v = at(turn(a), dist, CYD, lift); v.target.z += W3 / 2; v.pos.z += W3 / 2; return v; };
    if (s === 1) return at(turn(-0.3), 12.5, -0.4, 6.5);
    if (s === 2) return at(turn(0.3), 28, 4.5, 6);
    if (s === 10) return dial(0.1, 7.5, 0.5);
    if (s === 9) return dial(-0.08, 6.5, 0.3);
    return dial(s % 2 ? 0.16 : -0.1, 10 - (s - 3) * 0.3, 1.0);
  }
  const OVER = { pos: FRONT.clone().multiplyScalar(36).addScaledVector(SIDE, -10).add(new THREE.Vector3(0, 14, 0)), target: new THREE.Vector3(0, 5, 0) };
  // доба: дивимося вздовж осі обертання — видно і денний, і нічний бік
  const SPIN_AXIS = new THREE.Vector3().crossVectors(SUN_DIR, UP).normalize();
  const SUN_PERP = new THREE.Vector3().crossVectors(SPIN_AXIS, SUN_DIR).normalize();
  const DAY_VIEW = (() => {
    const sg = SPIN_AXIS.dot(FRONT) > 0 ? 1 : -1;
    return { pos: SPIN_AXIS.clone().multiplyScalar(sg * 46).add(new THREE.Vector3(0, 10, 0)), target: new THREE.Vector3(0, 4.5, 0) };
  })();
  let spin = 0;
  const upOf = a => UP.clone().applyAxisAngle(SPIN_AXIS, a);
  const solarAngle = a => { const n = upOf(a); return Math.atan2(n.dot(SUN_PERP), n.dot(SUN_DIR)); };
  const SPIN_SIGN = Math.sign(solarAngle(0.01) - solarAngle(0)) || 1;
  function localTime(a) { let h = 12 + SPIN_SIGN * solarAngle(a) / (Math.PI * 2) * 24; return ((h % 24) + 24) % 24; }
  function dayName(h) { return h >= 5 && h < 11 ? 'ранок' : h >= 11 && h < 17 ? 'день' : h >= 17 && h < 22 ? 'вечір' : 'ніч'; }
  const CH_FIRST = [1, 3, 4, 6, 10, 11];
  function cubeHome(k) {
    if (k === 5) return new THREE.Vector3().addScaledVector(SIDE, 2.0).addScaledVector(FRONT, 1.6).setY(HOME_R + 1.2);
    const v = stageView(CH_FIRST[k]), dir = v.pos.clone().setY(0).normalize(), side = new THREE.Vector3().crossVectors(UP, dir);
    if (k === 0) return dir.multiplyScalar(2.2).addScaledVector(side, 1.7).setY(HOME_R + 1.6);
    return dir.multiplyScalar(2.4).addScaledVector(side, 2.3).setY(v.target.y + 0.2);
  }
  function tikSpot(k) {
    // Біля підніжжя Тік ширяє над площею між ліхтарями й жителями, а не стоїть серед них на сходах
    if (k === 0 || k === 5) return FRONT.clone().multiplyScalar(3.7).addScaledVector(SIDE, k ? 0.1 : -0.05).setY(HOME_R + (k ? 1.1 : 1.3));
    const v = stageView(CH_FIRST[k]), dir = v.pos.clone().setY(0).normalize(), side = new THREE.Vector3().crossVectors(UP, dir);
    return dir.multiplyScalar(1.6).addScaledVector(side, -2.2).setY(v.target.y - 0.7);
  }

  /* ---------- Будівництво ---------- */
  function applyStage(animate) {
    const now = performance.now();
    for (const g of parts) {
      const built = g.userData.stage <= stage;
      if (g.userData.built === built) continue;
      const became = built && g.userData.built === false;
      g.userData.built = built;
      g.traverse(o => { if (!o.isMesh) return; o.material = built ? o.userData.mat : ghostMat; o.castShadow = built; if (o.userData.edges) o.userData.edges.visible = !built; });
      if (became && animate && !reduced) g.userData.t0 = now + g.userData.order * 220;
    }
  }

  /* ---------- Переліт камери ---------- */
  let fly = null, mode = 'intro';
  function flyTo(pos, target, dur = 2200, then) {
    const from = camera.position.clone(), ft = controls.target.clone();
    const mid = from.clone().lerp(pos, 0.5); mid.y += from.distanceTo(pos) * 0.15;
    fly = { curve: new THREE.QuadraticBezierCurve3(from, mid, pos.clone()), ft, tt: target.clone(), t0: performance.now(), dur: reduced ? 1 : dur, then };
    controls.enabled = false; controls.autoRotate = false;
  }
  function goOverview() { mode = 'over'; flyTo(OVER.pos, OVER.target, 2400, () => { controls.autoRotate = !reduced; }); }
  let tikTarget = tikSpot(0);


  /* ---------- Керування з гри ---------- */
  let handMins = 540, secFrac = 0, dayMins = null;
  let running = false, raf = 0, last = 0, firstStage = true;
  let locked = false;
  let interactive = false;   // «Тепер ти!» в уроці: дитина тягне стрілки, камера не крутиться     // у грі камеру не крутимо: дитина тягне стрілки
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();

  /* Якість: 2 — повна, 1 — простіша (телефони), 0 — мінімальна для слабких пристроїв.
     Сцена на весь екран, тож якщо кадрів замало, сама знижує якість на ступінь (і назад не піднімає — без миготіння). */
  let tier = high ? 2 : 1;
  function applyQuality() {
    // Телефони мають щільні екрани (2–3×): менше 2× — уже помітні «драбинки», тож економимо на ефектах, а не на чіткості
    renderer.setPixelRatio(Math.min(devicePixelRatio, [1.25, 2, 2][tier]));
    bloom.enabled = tier === 2;
    key.castShadow = tier === 2;
    skyU.uOct.value = tier === 2 ? 5 : 3;
    grass.count = Math.floor(grass.userData.max * [0.15, 0.4, 1][tier]);
    resize();
  }
  let perfT = 0, perfN = 0, perfSkip = 3;   // перші секунди не рахуємо: компіляція шейдерів, підвантаження
  function watchPerf(dt) {
    if (tier === 0 || !dt) return;
    if (perfSkip > 0) { perfSkip -= dt; return; }
    perfT += dt; perfN++;
    if (perfT < 2.5) return;
    const fps = perfN / perfT;
    perfT = 0; perfN = 0;
    if (fps < 38) { tier--; high = tier === 2; applyQuality(); perfSkip = 1.5; }
  }

  /* Полотно може лежати під панелями на весь екран. view — вільна від них частина (у пікселях полотна):
     вежу центруємо саме в ній, а кут огляду рахуємо так, ніби полотно було лише такого розміру. */
  let view = null;
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    const f = view && view.w > 40 && view.h > 40 ? view : { x: 0, y: 0, w, h };
    const fov0 = f.w / f.h < 0.8 ? 60 : 42;
    camera.fov = 2 * Math.atan(Math.tan(fov0 * Math.PI / 360) * h / f.h) * 180 / Math.PI;
    const dx = w / 2 - (f.x + f.w / 2), dy = h / 2 - (f.y + f.h / 2);
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) camera.clearViewOffset();
    else camera.setViewOffset(w, h, dx, dy, w, h);
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Дотик зупиняє автоповорот, щоб дитина могла сама роздивитися вежу
  canvas.addEventListener('pointerdown', () => { controls.autoRotate = false; });

  /** Кут обертання планети, за якого на маківці (біля вежі) — година h. */
  const spinFor = h => {
    let a = (h - 12) / 24 * Math.PI * 2 - solarAngle(0) * SPIN_SIGN;
    return Math.atan2(Math.sin(a), Math.cos(a));
  };

  const ease = p => p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), qq = new THREE.Quaternion(), camL = new THREE.Vector3();

  function frame(now) {
    if (!running) return;
    const t = now / 1000, dt = Math.min(0.05, last ? t - last : 0); last = t;
    skyU.uTime.value = t; windU.value = t;
    for (const f of animated) f(t, dt);

    // Доба: планета повертається так, щоб біля вежі був час уроку; поза етапом 11 — полудень
    const want = stage === 11 && dayMins != null ? spinFor(dayMins / 60) : 0;
    let ds = want - spin; ds = Math.atan2(Math.sin(ds), Math.cos(ds));
    spin += ds * Math.min(1, dt * (stage === 11 ? 6 : 2));
    home.quaternion.setFromAxisAngle(SPIN_AXIS, spin);
    home.updateMatrixWorld();
    tower.getWorldPosition(key.target.position);
    key.position.copy(key.target.position).addScaledVector(SUN_DIR, 40);

    for (const L of nightLights) {
      L.obj.getWorldQuaternion(qq);
      const n = tmp.set(0, 1, 0).applyQuaternion(qq);
      L.mat.color.copy(OFF).lerp(ON, THREE.MathUtils.smoothstep(-n.dot(SUN_DIR), -0.05, 0.2));
    }
    const hm = ((handMins % 720) + 720) % 720;
    hands.h.forEach(x => x.rotation.z = -hm / 720 * Math.PI * 2);
    hands.m.forEach(x => x.rotation.z = -(hm % 60) / 60 * Math.PI * 2);
    hands.s.forEach(x => x.rotation.z = -secFrac * Math.PI * 2);
    {
      const pk = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(now * 0.006);
      for (const k of ['h', 'm', 's']) hands[k].forEach(x => {
        const on = focusKey === k && x.material !== ghostMat;
        x.scale.setScalar(on ? 1 + 0.14 * pk : 1);
        const e = x.material === ghostMat ? null : x.material.emissive;
        if (e) { if (on) e.copy(x.material.color).multiplyScalar(0.55 * pk); else e.setRGB(0, 0, 0); }
      });
      // Лише збудовані: непобудовані ділять матеріал креслення (ghostMat), його прозорість не чіпаємо
      for (const k of ['nums', 'ticks']) focusable[k].forEach(x => { if (x.material !== ghostMat) x.material.opacity = focusKey === k ? 0.45 + 0.55 * pk : 1; });
    }

    for (const g of parts) {
      if (!g.userData.t0) continue;
      const p = Math.min(1, Math.max(0, (now - g.userData.t0) / 700)), k = 1 - Math.pow(1 - p, 3);
      g.position.y = (1 - k) * 3; g.scale.setScalar(0.85 + 0.15 * k);
      if (p >= 1) { g.userData.t0 = 0; g.position.y = 0; g.scale.setScalar(1); }
    }

    updateCritters(t, dt);
    updateLocals(t, now);
    updateFlyers(t);

    // Тік: літає на ранці від частини до частини вежі (у координатах планети)
    const U = tik.userData;
    const toT = tmp.copy(tikTarget).sub(tik.position), dist = toT.length();
    const moving = dist > 0.04;
    if (moving) tik.position.addScaledVector(toT, Math.min(1, dt * 1.8));
    else if (!U.arrived) { U.arrived = true; waveUntil = now + 1600; }
    if (moving) U.arrived = false;
    const flying = moving || tik.position.y > HOME_R + 0.2;
    U.body.position.y = flying ? Math.sin(t * 2.2) * 0.12 : 0;
    camL.copy(camera.position); home.worldToLocal(camL);
    const look = moving && dist > 2.5 ? Math.atan2(toT.x, toT.z) : Math.atan2(camL.x - tik.position.x, camL.z - tik.position.z);
    let dh = look - tik.rotation.y; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); tik.rotation.y += dh * Math.min(1, dt * 4);
    U.flames.forEach(f => { f.visible = flying; f.scale.set(1, 0.7 + Math.random() * 0.6, 1); });
    U.legs.forEach(l => l.rotation.x = flying ? 0.25 : 0);
    const blink = (t % 3.2) < 0.12; U.eyes.forEach(e => e.scale.y = blink ? 0.15 : 1.3);
    U.arms[1].rotation.z = now < waveUntil ? 2.2 + Math.sin(t * 14) * 0.4 : 0.15 * Math.sin(t * 2);
    U.arms[0].rotation.z = -0.15 * Math.sin(t * 2);
    if (flying) { tik.updateMatrix(); tmp2.set(0, 0.2, -0.8).applyMatrix4(tik.matrix); puffHist.unshift(tmp2.clone()); } else puffHist.pop();
    if (puffHist.length > puffN) puffHist.length = puffN;
    for (let i = 0; i < puffN; i++) { const v = puffHist[i]; if (v) { v.y -= dt * 0.6; puffGeo.attributes.position.setXYZ(i, v.x, v.y, v.z); } else puffGeo.attributes.position.setXYZ(i, 0, 0, 0); }
    puffGeo.attributes.position.needsUpdate = true;

    if (fly) {
      const p = Math.min(1, (now - fly.t0) / fly.dur), k = ease(p);
      camera.position.copy(fly.curve.getPoint(k));
      controls.target.copy(fly.ft).lerp(fly.tt, k);
      camera.lookAt(controls.target);
      if (p >= 1) { const th = fly.then; fly = null; controls.enabled = !locked && !interactive; if (th) th(); }
    } else if (!locked) controls.update();

    composer.render();
    watchPerf(dt);
    raf = requestAnimationFrame(frame);
  }

  applyQuality();
  for (const g of parts) g.userData.built = null;
  applyStage(false);
  tik.position.copy(tikSpot(0));
  camera.position.set(90, 60, 200); controls.target.set(0, 5, 0);

  return {
    /** Етап уроку 0..10. animate — підлітають нові частини вежі. */
    setStage(i, animate = true) {
      if (locked) this.setPractice(false);
      const next = Math.max(1, Math.min(11, i + 1));
      const moved = next !== stage;
      stage = next;
      applyStage(animate && !firstStage);
      tikTarget = tikSpot(STAGE_CH[stage - 1]);
      if (moved || firstStage) cheerLocals();
      const v = stage === 11 ? DAY_VIEW : stageView(stage);
      mode = 'chapter';
      // Уперше камера прилітає здалеку — так дитина бачить планету цілком
      flyTo(v.pos, v.target, firstStage ? 4200 : 2200);
      firstStage = false;
    },
    /** Режим «Гри»: вежа готова, камера впритул до циферблата, підказки-сектори й секундна стрілка сховані. */
    setPractice(on) {
      if (on === locked) return;
      locked = on;
      focusKey = null;
      pHalf.visible = pQ.visible = pS.visible = pL.visible = !on;
      railings.forEach(g => { g.visible = !on; });
      if (!on) { controls.enabled = true; return; }
      stage = 11;
      dayMins = null;
      applyStage(false);
      tikTarget = tikSpot(3);
      controls.autoRotate = false;
      controls.enabled = false;
      // Дивимося трохи згори — понад поручнем балкона, що стоїть під циферблатом
      const target = new THREE.Vector3(0, HOME_R + 0.05 + CYD - 0.08, W3 / 2 + 0.05);
      const pos = target.clone().add(new THREE.Vector3(0.17, 1.3, 3.5));
      mode = 'practice';
      flyTo(pos, target, firstStage ? 3200 : 1600);
      firstStage = false;
    },
    /** Точка дотику на циферблаті: x праворуч, y угору, 1 — край циферблата. null — повз циферблат. */
    dialPoint(clientX, clientY) {
      if (!frontFace) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      // Перетинаємо площину циферблата, а не сам диск — так стрілку можна тягнути й трохи за краєм
      const n = new THREE.Vector3(0, 0, 1).transformDirection(frontFace.matrixWorld);
      const o = new THREE.Vector3().setFromMatrixPosition(frontFace.matrixWorld);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, o);
      if (!ray.ray.intersectPlane(plane, hit)) return null;
      const local = frontFace.worldToLocal(hit.clone());
      return { x: local.x / DR, y: local.y / DR };
    },
    /** Положення стрілок: хвилини від 0:00 і частка хвилини для секундної стрілки. */
    setTime(mins, sec = 0) { handMins = mins; secFrac = sec; },
    /** Час доби для етапу 11 (хвилини від півночі) або null. */
    setDay(mins) { dayMins = mins; },
    overview() { goOverview(); },
    /** Що пульсує на циферблаті: 'h' | 'm' | 's' | 'nums' | 'ticks' або null. */
    setFocus(k) { focusKey = k; },
    /** Урок: дитина щось робить на вежі — камеру пальцем не крутимо. */
    setInteractive(on) { interactive = on; if (!fly) controls.enabled = !locked && !on; if (on) controls.autoRotate = false; },
    /** Вільна від панелей частина полотна { x, y, w, h } у CSS-пікселях; null — усе полотно. */
    setFrame(r) {
      const same = r && view && ['x', 'y', 'w', 'h'].every(k => Math.abs(r[k] - view[k]) < 1);
      if (same || (!r && !view)) return;
      view = r;
      resize();
    },
    /** Тло без завдання: стрілки не потрібні, планета повільно обертається. */
    ambient() {
      if (locked) this.setPractice(false);
      if (mode !== 'over') goOverview();
    },
    start() { if (running) return; running = true; last = 0; perfSkip = 1.5; perfT = 0; perfN = 0; resize(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    setQuality(h) { high = h; tier = h ? 2 : 1; applyQuality(); },
    get high() { return high; },
    dispose() { this.stop(); ro.disconnect(); renderer.dispose(); }
  };
}
