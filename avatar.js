// Scène 3D de l'avatar (BET-49), chargée à la demande (studio, page profil) : Three.js figé depuis jsDelivr, jamais chargé sur les autres pages.
// Rendu : éclairage studio (environnement PMREM, lumière principale, contre-jours), tons ACES, ombres douces, ombre de contact, fond en profondeur de champ.
// Qualité selon l'appareil (haut / moyen / bas), pause hors écran, libération des ressources à la fermeture, « réduire les animations » respecté.
import { QUALITY, qualityFor, sanitizeAvatar } from './avatar-config.js';
import { buildCharacter, DIM, EXPRESSIONS } from './avatar-parts.js';
import { drawBackground, backgroundAccent, FLOOR_LINE } from './avatar-scenes.js';

export const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
let loading = null;
export const loadThree = () => loading ??= import(THREE_URL).catch(error => { loading = null; throw error; });
export function webglSupported() { try { const canvas = document.createElement('canvas'); return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl')); } catch { return false; } }
export const deviceQuality = () => qualityFor({ coarse: matchMedia('(pointer: coarse)').matches, memory: navigator.deviceMemory ?? 8, cores: navigator.hardwareConcurrency ?? 8, saveData: navigator.connection?.saveData === true });
export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Poses : valeurs cibles des articulations (radians). Bras : x négatif = vers l'avant, z positif = vers l'extérieur (côté gauche du personnage, à droite de l'écran).
const BASE = { aLx: 0, aLy: 0, aLz: .13, eLx: -.2, eLy: 0, eLz: 0, aRx: 0, aRy: 0, aRz: -.13, eRx: -.2, eRy: 0, eRz: 0, lLx: 0, lLy: 0, lLz: .04, kLx: 0, lRx: 0, lRy: 0, lRz: -.04, kRx: 0, tx: 0, ty: 0, tz: 0, hx: 0, hy: 0, hz: 0, ry: 0, rz: 0, rrx: 0, bx: 0, by: .125, bz: .5, bs: 0 };
export const POSE_TARGETS = {
  idle: {},
  arms: { aLx: -.5, aLz: .02, eLx: -1.9, eLz: -1.45, aRx: -.5, aRz: -.02, eRx: -1.9, eRz: 1.45, lLz: .06, lRz: -.06, hx: .04, tx: -.03 },
  ball: { aLx: .18, aLz: .62, eLx: -1.15, eLz: .0, eLy: 0, aRx: .1, aRz: -.5, eRx: -1.45, eRz: .75, bx: .33, by: .8, bz: .1, bs: 1, tz: -.05, hy: -.12, lLz: .05, lRz: -.05 },
  foot: { lRx: -.62, kRx: .7, lRz: -.1, aLz: .7, aLx: -.1, eLx: -1.45, eLz: -.55, aRz: -.78, aRx: -.1, eRx: -1.45, eRz: .55, bx: -.11, by: .125, bz: .36, bs: 1, tx: .07, hx: .05, hy: .18, lLz: .05 }
};
// Célébrations : fonction du temps (secondes) qui renvoie les écarts de pose, le saut et l'expression.
const lerp = (a, b, t) => a + (b - a) * t, ease = t => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2, clamp01 = v => Math.min(1, Math.max(0, v));
export const CELEBRATIONS = {
  'celeb-jump': { dur: 1.9, at: t => { const hop = Math.abs(Math.sin(t / 1.9 * Math.PI * 3)) * .24; return { pose: { aLx: -2.85, aLz: .3, aRx: -2.85, aRz: -.3, eLx: -.15, eRx: -.15, hx: -.28, ry: 0, kLx: hop * 1.4, kRx: hop * 1.4, lLx: -hop * .7, lRx: -hop * .7, tx: -.05 }, rootY: hop, expr: 'joy' }; } },
  'celeb-fist': { dur: 2.3, at: t => { const pump = Math.sin(t * 9) * .22; return { pose: { aRx: -2.55 + pump * .4, aRz: -.25, eRx: -.5 - pump, aLz: .35, aLx: .1, eLx: -.9, hx: -.18, tx: -.08, ty: .12, hy: -.2, lLz: .12, lRz: -.12 }, rootY: Math.max(0, Math.sin(t * 9 + 1.6)) * .05, expr: 'joy' }; } },
  'celeb-slide': { dur: 2.8, at: t => { const u = clamp01(t / 2.8), run = ease(clamp01(u / .38)), rise = ease(clamp01((u - .8) / .2)), down = run * (1 - rise); return { pose: { lLx: lerp(0, -.15, down), kLx: lerp(0, 2.3, down), lRx: lerp(0, -.15, down), kRx: lerp(0, 2.3, down), tx: lerp(0, .55, down), hx: lerp(0, -.35, down), aLx: -.2 * down, aLz: lerp(.13, 1.25, down), aRx: -.2 * down, aRz: lerp(-.13, -1.25, down), eLx: -.3, eRx: -.3, rrx: 0 }, rootY: -.41 * down, rootZ: .55 * ease(clamp01(u / .55)) * (1 - rise * .9), expr: 'joy' }; } },
  'celeb-flip': { dur: 1.7, at: t => { const u = clamp01((t - .25) / 1.2), air = Math.sin(u * Math.PI), tuck = Math.sin(clamp01(u * 1.2) * Math.PI) ** 2; return { pose: { lLx: -1.55 * tuck, kLx: 2 * tuck, lRx: -1.55 * tuck, kRx: 2 * tuck, aLx: -1.1 * tuck, aRx: -1.1 * tuck, aLz: .35, aRz: -.35, eLx: -1.4 * tuck, eRx: -1.4 * tuck, hx: .2 * tuck }, rootY: air * 1.05, rrx: -Math.PI * 2 * ease(u), expr: 'joy' }; } }
};
const FRAMES = { full: { y: 1.02, h: 2.45, w: 2.15 }, bust: { y: 1.66, h: 1.28, w: 1.05 } };

function makeEnvironment(T, renderer) {
  const pm = new T.PMREMGenerator(renderer), env = new T.Scene(), dome = new T.SphereGeometry(10, 32, 16), colors = [], p = dome.attributes.position, top = new T.Color('#9fb4e8'), mid = new T.Color('#3b4152'), low = new T.Color('#16181f');
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10, c = y > 0 ? mid.clone().lerp(top, y ** .7) : mid.clone().lerp(low, -y); colors.push(c.r, c.g, c.b); }
  dome.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  env.add(new T.Mesh(dome, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const panel = (w, h, color, power, x, y, z) => { const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(power), side: T.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 1, 0); env.add(m); };
  panel(5, 3.4, '#fff1dc', 22, 4.5, 5.5, 5.5); panel(3, 5, '#a9c1ff', 7, -6, 2.5, 4); panel(8, 1.2, '#ffffff', 16, 0, 4, -7); panel(2.4, 4, '#ffd9b0', 6, 6.5, 1.5, -2);
  const target = pm.fromScene(env, .04); pm.dispose(); env.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  return target;
}

export async function createStage(host, options = {}) {
  if (!webglSupported()) throw new Error('WEBGL');
  const T = await loadThree(), quality = options.quality ?? deviceQuality(), q = QUALITY[quality], reduced = prefersReducedMotion();
  const canvas = document.createElement('canvas'); canvas.className = 'avatar-canvas'; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', options.label ?? 'Avatar 3D'); canvas.tabIndex = options.interactive === false ? -1 : 0;
  host.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: q.msaa, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio)); renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.setClearColor(0x0b0e14);
  const scene = new T.Scene(), camera = new T.PerspectiveCamera(28, 1, .1, 60), envTarget = makeEnvironment(T, renderer);
  scene.environment = envTarget.texture; scene.environmentIntensity = .7;
  const key = new T.DirectionalLight('#fff0dc', 2.4); key.position.set(2.4, 3.8, 3.4); key.castShadow = true; key.shadow.mapSize.set(q.shadow, q.shadow); key.shadow.camera.left = -1.6; key.shadow.camera.right = 1.6; key.shadow.camera.top = 2.6; key.shadow.camera.bottom = -.4; key.shadow.camera.near = .5; key.shadow.camera.far = 12; key.shadow.bias = -.0004; key.shadow.normalBias = .02;
  const fill = new T.DirectionalLight('#9db8ff', .75); fill.position.set(-3.2, 1.6, 2.6);
  const rimA = new T.DirectionalLight('#ffffff', 2.4), rimB = new T.DirectionalLight('#ffffff', 1.6); rimA.position.set(-2, 2.8, -3.4); rimB.position.set(2.6, 2.2, -3);
  scene.add(key, fill, rimA, rimB, new T.HemisphereLight('#aab8e6', '#1b1d24', .35));
  // Fond : plan fixe derrière le personnage, aligné sur la ligne de sol commune.
  const BACK_Z = -3.2, BACK_SIZE = 9, textures = new Map(), backMat = new T.MeshBasicMaterial({ toneMapped: false }), backdrop = new T.Mesh(new T.PlaneGeometry(BACK_SIZE, BACK_SIZE), backMat); backdrop.position.z = BACK_Z; scene.add(backdrop);
  const backgroundTexture = id => { if (!textures.has(id)) { const c = document.createElement('canvas'); c.width = c.height = q.segments > 30 ? 1536 : 1024; drawBackground(c, id); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; textures.set(id, t); } return textures.get(id); };

  const state = { look: sanitizeAvatar(options.look), structural: '', character: null, view: options.view ?? 'full', zoom: 1, yaw: .38, vel: 0, lastTouch: performance.now(), pointer: { x: 0, y: 0, tx: 0, ty: 0 }, cur: { ...BASE }, expression: 'smile', celebrating: null, blinkAt: 2, blink: 0, rim: '#ffffff', disposed: false, visible: true, paused: false };
  const camState = { y: FRAMES[state.view].y, h: FRAMES[state.view].h, w: FRAMES[state.view].w };
  const holder = new T.Group(); scene.add(holder);
  const structuralKey = look => JSON.stringify({ ...look, pose: 0, expression: 0, celebration: 0, rev: 0 });

  function applyLook(look, rebuild = true) {
    state.look = look;
    const key2 = structuralKey(look);
    if (rebuild && key2 !== state.structural) {
      state.structural = key2;
      if (state.character) { holder.remove(state.character.root); state.character.dispose(); }
      state.character = buildCharacter(T, look, q); holder.add(state.character.root);
    }
    const map = backgroundTexture(look.background); backMat.map = map; backMat.needsUpdate = true;
    rimA.color.set(backgroundAccent(look.background)); rimA.intensity = look.background.startsWith('solid-') ? 2.2 : 3;
    state.expression = look.expression; wake();
  }
  const worldToNdcY = (x, y, z) => { const v = new T.Vector3(x, y, z).project(camera); return v.y; };
  function updateCamera() {
    const frame = FRAMES[state.view], k = reduced ? 1 : .12; camState.y += (frame.y - camState.y) * (state.snap ? 1 : k); camState.h += (frame.h - camState.h) * (state.snap ? 1 : k); camState.w += (frame.w - camState.w) * (state.snap ? 1 : k);
    const half = Math.tan(camera.fov * Math.PI / 360), dist = Math.max(camState.h / 2 / half, camState.w / 2 / half / camera.aspect) * state.zoom;
    camera.position.set(0, camState.y + dist * .07, dist); camera.lookAt(0, camState.y, 0); camera.updateMatrixWorld();
    // Aligne la ligne de sol du fond sur le dessous du socle.
    const feet = state.character?.baseTop ?? .07, ndcY = worldToNdcY(0, feet, 0), ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(0, ndcY), camera);
    const t = (BACK_Z - ray.ray.origin.z) / ray.ray.direction.z, hitY = ray.ray.origin.y + ray.ray.direction.y * t, hitX = ray.ray.origin.x + ray.ray.direction.x * t;
    backdrop.position.set(hitX, hitY - ((1 - FLOOR_LINE) - .5) * BACK_SIZE, BACK_Z);
    // Échelle fixée sur le cadrage en pied : le fond se rapproche comme la caméra (parallaxe) au lieu de se rétrécir.
    const fullDist = Math.max(FRAMES.full.h / 2 / half, FRAMES.full.w / 2 / half / camera.aspect), need = 2 * half * (fullDist + -BACK_Z) * Math.max(1, camera.aspect) * 1.15; backdrop.scale.setScalar(need / BACK_SIZE);
    backdrop.position.y = hitY - ((1 - FLOOR_LINE) - .5) * BACK_SIZE * backdrop.scale.y;
  }
  function size() { const w = Math.max(2, host.clientWidth), h = Math.max(2, host.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); wake(); }
  const observer = new ResizeObserver(size); observer.observe(host);

  function applyPose(dt, time) {
    const c = state.character; if (!c) return;
    const base = { ...BASE, ...POSE_TARGETS[state.look.pose] }; let target = base, expr = state.look.expression, rootY = 0, rootZ = 0, rrx = 0;
    if (state.celebrating) {
      const t = (performance.now() - state.celebrating.start) / 1000, spec = CELEBRATIONS[state.celebrating.id] ?? CELEBRATIONS['celeb-jump'];
      if (t >= spec.dur) state.celebrating = null; else { const frame = spec.at(t); target = { ...base, ...frame.pose, bs: 0 }; rootY = frame.rootY ?? 0; rootZ = frame.rootZ ?? 0; rrx = frame.rrx ?? 0; expr = frame.expr ?? expr; }
    }
    const a = reduced ? 1 : 1 - Math.exp(-dt * (state.celebrating ? 16 : 9)), cur = state.cur;
    for (const k in target) cur[k] += (target[k] - cur[k]) * (k === 'bs' ? 1 : a);
    const breath = reduced ? 0 : Math.sin(time * 1.9), sway = reduced ? 0 : Math.sin(time * .8);
    const { arms, legs, torso, head, hips } = c;
    arms.L.shoulder.rotation.set(cur.aLx + breath * .012, cur.aLy, cur.aLz + breath * .01); arms.L.elbow.rotation.set(cur.eLx, cur.eLy, cur.eLz);
    arms.R.shoulder.rotation.set(cur.aRx + breath * .012, cur.aRy, cur.aRz - breath * .01); arms.R.elbow.rotation.set(cur.eRx, cur.eRy, cur.eRz);
    legs.L.thigh.rotation.set(cur.lLx, cur.lLy, cur.lLz); legs.L.knee.rotation.x = cur.kLx; legs.R.thigh.rotation.set(cur.lRx, cur.lRy, cur.lRz); legs.R.knee.rotation.x = cur.kRx;
    legs.L.foot.rotation.x = -(cur.lLx + cur.kLx) * .55; legs.R.foot.rotation.x = -(cur.lRx + cur.kRx) * .55;
    torso.rotation.set(cur.tx + breath * .006, cur.ty + sway * .02, cur.tz); torso.scale.set(1 + breath * .006, 1 + breath * .012, 1 + breath * .006);
    const p = state.pointer; p.x += (p.tx - p.x) * Math.min(1, dt * 6); p.y += (p.ty - p.y) * Math.min(1, dt * 6);
    head.rotation.set(cur.hx + (reduced ? 0 : -p.y * .16 + breath * .008), cur.hy + (reduced ? 0 : p.x * .34 + sway * .03), cur.hz);
    for (const e of c.eyes) { e.iris.position.x = (reduced ? 0 : p.x) * .011; e.iris.position.y = (reduced ? 0 : p.y) * .009; }
    hips.position.set(0, DIM.hip + rootY, rootZ); hips.rotation.x = rrx;
    c.ball.visible = cur.bs > .5; c.ball.position.set(cur.bx, cur.by, cur.bz); c.ball.rotation.y = time * .0;
    // Visage : expression, paupières, clignement, sourcils, bouche.
    const spec = EXPRESSIONS[expr] ?? EXPRESSIONS.smile;
    state.blink = Math.max(0, state.blink - dt * 7); if (!reduced && time > state.blinkAt) { state.blink = 1; state.blinkAt = time + 2.4 + Math.random() * 3.4; }
    const closeAmount = state.blink > 0 ? Math.sin(state.blink * Math.PI) : 0;
    c.lids.forEach((lid, i) => { const wanted = spec.lid[i], blinkTo = .85; lid.rotation.x += (lerp(wanted, blinkTo, closeAmount) - lid.rotation.x) * Math.min(1, dt * 22); lid.scale.setScalar(spec.scale); });
    c.eyes.forEach(e => e.group.scale.setScalar(spec.scale));
    c.brows.forEach((brow, i) => { const side = i === 0 ? -1 : 1, lift = spec.brow[i]; brow.position.y += (.122 + lift - brow.position.y) * Math.min(1, dt * 12); brow.rotation.z += (-spec.tilt * side - brow.rotation.z) * Math.min(1, dt * 12); });
    for (const k in c.mouths) c.mouths[k].visible = k === spec.mouth;
    if (c.neon) c.neon.material.emissiveIntensity = 1.4 + Math.sin(time * 2.4) * .4;
    if (c.glow) c.glow.material.opacity = .45 + Math.sin(time * 2.4) * .12;
  }

  let raf = 0, last = performance.now();
  const animating = () => !reduced || state.celebrating || state.dragging || Math.abs(state.vel) > .0003;
  function render(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; const time = now / 1000;
    if (!reduced) { const idle = now - state.lastTouch; if (Math.abs(state.vel) > .0003) { state.yaw += state.vel; state.vel *= .93; } else if (idle > 3500 && !state.dragging) state.yaw += (.38 - state.yaw) * Math.min(1, dt * 1.4); }
    holder.rotation.y = state.yaw; applyPose(dt, time); updateCamera(); renderer.render(scene, camera);
  }
  function frame(now) { raf = 0; if (state.disposed) return; render(now); if (animating() && !state.paused && state.visible) raf = requestAnimationFrame(frame); }
  function wake() { if (!raf && !state.paused && state.visible && !state.disposed) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  // Interactions : glisser pour tourner, molette ou pincement pour zoomer, regard qui suit le pointeur.
  let drag = null; const pointers = new Map();
  const interactive = options.interactive !== false;
  const down = e => { if (!interactive) return; canvas.setPointerCapture?.(e.pointerId); pointers.set(e.pointerId, e); drag = { x: e.clientX, yaw: state.yaw }; state.dragging = true; state.vel = 0; state.lastTouch = performance.now(); canvas.classList.add('grabbing'); };
  const move = e => {
    const r = canvas.getBoundingClientRect(); state.pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - .5) * 2)); state.pointer.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - .55) * 2)); wake();
    if (!interactive || !pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, e);
    if (pointers.size === 2) { const [a, b] = [...pointers.values()], now = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); if (state.pinch) state.zoom = Math.min(1.35, Math.max(.7, state.zoom * state.pinch / now)); state.pinch = now; wake(); return; }
    if (drag) { const next = drag.yaw + (e.clientX - drag.x) * .012; state.vel = next - state.yaw; state.yaw = next; state.lastTouch = performance.now(); wake(); }
  };
  const up = e => { pointers.delete(e.pointerId); state.pinch = 0; if (!pointers.size) { drag = null; state.dragging = false; canvas.classList.remove('grabbing'); state.lastTouch = performance.now(); } };
  const leave = () => { state.pointer.tx = 0; state.pointer.ty = 0; };
  const wheel = e => { if (!interactive) return; e.preventDefault(); state.zoom = Math.min(1.35, Math.max(.7, state.zoom * (1 + Math.sign(e.deltaY) * .06))); state.lastTouch = performance.now(); wake(); };
  const keys = e => { if (!interactive) return; if (e.key === 'ArrowLeft') { state.yaw -= .25; wake(); } else if (e.key === 'ArrowRight') { state.yaw += .25; wake(); } else return; e.preventDefault(); state.lastTouch = performance.now(); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('pointerleave', leave); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', keys);
  canvas.style.touchAction = 'pan-y';
  const lost = e => { e.preventDefault(); options.onLost?.(); };
  canvas.addEventListener('webglcontextlost', lost);
  const io = new IntersectionObserver(entries => { state.visible = entries.some(entry => entry.isIntersecting); if (state.visible) wake(); }, { threshold: .01 }); io.observe(host);
  const vis = () => { state.paused = document.hidden; if (!state.paused) wake(); }; document.addEventListener('visibilitychange', vis);

  applyLook(state.look); size(); wake();
  return {
    canvas, quality, get look() { return state.look; },
    setLook(next) { applyLook(sanitizeAvatar(next)); wake(); },
    setView(view) { if (!FRAMES[view]) return; state.view = view; wake(); },
    setZoom(value) { state.zoom = Math.min(1.35, Math.max(.7, value)); wake(); },
    resetCamera() { state.yaw = .38; state.vel = 0; state.zoom = 1; wake(); },
    celebrate(id) { state.celebrating = { id: id ?? state.look.celebration, start: performance.now() }; if (reduced) { setTimeout(() => { state.celebrating = null; wake(); }, 1200); } wake(); },
    pause(value) { state.paused = Boolean(value); if (!state.paused) wake(); },
    // Image de l'avatar : buste (512 px) ou en pied (768 x 1024), avec le fond, au format WebP (JPEG si le navigateur ne sait pas l'écrire).
    async snapshot(kind = 'bust') {
      const w = kind === 'bust' ? 512 : 768, h = kind === 'bust' ? 512 : 1024, backup = { view: state.view, yaw: state.yaw, zoom: state.zoom, cur: { ...state.cur }, celebrating: state.celebrating, ratio: renderer.getPixelRatio(), cam: { ...camState }, bs: state.blinkAt };
      state.celebrating = null; state.view = kind === 'bust' ? 'bust' : 'full'; state.yaw = .3; state.zoom = 1; state.snap = true; state.blink = 0; state.blinkAt = Infinity;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      for (let i = 0; i < 12; i++) { holder.rotation.y = state.yaw; applyPose(1, 0); updateCamera(); }
      renderer.render(scene, camera);
      const webp = canvas.toDataURL('image/webp', .5).startsWith('data:image/webp'), blob = await new Promise(resolve => canvas.toBlob(resolve, webp ? 'image/webp' : 'image/jpeg', .9));
      state.snap = false; Object.assign(camState, backup.cam); state.view = backup.view; state.yaw = backup.yaw; state.zoom = backup.zoom; state.celebrating = backup.celebrating; state.blinkAt = backup.bs;
      renderer.setPixelRatio(backup.ratio); size(); wake(); return blob;
    },
    dispose() {
      state.disposed = true; cancelAnimationFrame(raf); observer.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('pointerleave', leave); canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keys); canvas.removeEventListener('webglcontextlost', lost);
      state.character?.dispose(); for (const t of textures.values()) t.dispose(); backMat.dispose(); backdrop.geometry.dispose(); envTarget.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); canvas.remove();
    }
  };
}
