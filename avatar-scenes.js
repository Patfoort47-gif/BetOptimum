// Dessins 2D de l'avatar 3D (BET-49) : fonds et stades, maillots, iris, joues, gazon. Tout est généré dans des <canvas> et servi comme texture par avatar.js.
// Aucune image externe, aucun logo, aucun nom de club ou de sponsor : les stades sont reconnaissables à leur silhouette générique.
import { KITS, SOLID_BACKGROUNDS } from './avatar-config.js';

const rng = seed => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h = Math.imul(h ^ h >>> 15, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
const mix = (a, b, t) => { const p = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)), x = p(a), y = p(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`; };
const luminance = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255); return .2126 * r + .7152 * g + .0722 * b; };
const make = size => { const c = document.createElement('canvas'); c.width = c.height = size; return c; };
const linear = (ctx, x0, y0, x1, y1, stops) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([t, color]) => g.addColorStop(t, color)); return g; };
const radial = (ctx, x, y, r0, r1, stops) => { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([t, color]) => g.addColorStop(t, color)); return g; };
const glow = (ctx, x, y, r, color, alpha = 1) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.fillStyle = radial(ctx, x, y, 0, r, [[0, color], [.25, `${color}aa`], [1, `${color}00`]]); ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.restore(); };

// Flou de profondeur de champ qui marche partout (le filtre canvas n'existe pas sur tous les navigateurs) : réduction puis agrandissement lissé.
function soften(canvas, factor = 7, strength = .75) {
  const small = document.createElement('canvas'), w = Math.max(8, Math.round(canvas.width / factor));
  small.width = w; small.height = Math.max(8, Math.round(canvas.height / factor));
  const sctx = small.getContext('2d'), ctx = canvas.getContext('2d');
  sctx.imageSmoothingQuality = 'high'; sctx.drawImage(canvas, 0, 0, small.width, small.height);
  ctx.save(); ctx.globalAlpha = strength; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(small, 0, 0, canvas.width, canvas.height); ctx.restore();
}
const FLOOR = .76; // ligne de sol commune à tous les fonds : 70 % de la hauteur, l'avatar y pose les pieds

function night(ctx, W, H, top = '#050816', mid = '#142048', low = '#27386b') { ctx.fillStyle = linear(ctx, 0, 0, 0, H * .62, [[0, top], [.6, mid], [1, low]]); ctx.fillRect(0, 0, W, H); const r = rng('stars'); ctx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = .15 + r() * .5; ctx.fillRect(r() * W, r() * H * .3, 1.4, 1.4); } ctx.globalAlpha = 1; }
function pitch(ctx, W, H, far = .6, base = '#1d6b2f', alt = '#238138') {
  const floor = H * FLOOR;
  ctx.fillStyle = linear(ctx, 0, H * far, 0, H, [[0, mix(base, '#000000', .25)], [1, mix(base, '#7bd13a', .25)]]); ctx.fillRect(0, H * far, W, H - H * far);
  for (let i = 0; i < 12; i++) { const y0 = H * far + (H - H * far) * (i / 12) ** 1.7, y1 = H * far + (H - H * far) * ((i + 1) / 12) ** 1.7; if (i % 2) { ctx.fillStyle = alt; ctx.globalAlpha = .55; ctx.fillRect(0, y0, W, y1 - y0); } } ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, H * far + 6); ctx.lineTo(W, H * far + 6); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(W / 2, floor + H * .12, W * .36, H * .06, 0, Math.PI, 2 * Math.PI); ctx.stroke();
  ctx.fillStyle = radial(ctx, W / 2, floor, 10, W * .5, [[0, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, floor - H * .1, W, H * .3);
}
function crowd(ctx, W, y0, y1, colors, seed, curve = 40, density = 1) {
  const r = rng(seed), top = x => y0 + curve * ((x / W - .5) * 2) ** 2, bottom = x => y1 + curve * ((x / W - .5) * 2) ** 2;
  ctx.beginPath(); ctx.moveTo(0, top(0)); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, top(x)); for (let x = W; x >= 0; x -= 16) ctx.lineTo(x, bottom(x)); ctx.closePath();
  ctx.fillStyle = mix(colors[0], '#000000', .62); ctx.fill(); ctx.save(); ctx.clip();
  for (let i = 0; i < 1500 * density; i++) { const x = r() * W, y = top(x) + r() * (y1 - y0 + curve), size = 3 + r() * 4; ctx.fillStyle = colors[Math.floor(r() * colors.length)]; ctx.globalAlpha = .6 + r() * .4; ctx.fillRect(x, y, size, size * 1.3); }
  ctx.globalAlpha = 1; ctx.fillStyle = linear(ctx, 0, y0, 0, y1 + curve, [[0, 'rgba(0,0,0,.3)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, y0, W, y1 - y0 + curve); ctx.restore();
}
function tower(ctx, x, y, size) { ctx.fillStyle = '#10142a'; ctx.fillRect(x - 5, y, 10, size * 2.4); ctx.fillStyle = '#20264a'; ctx.fillRect(x - size, y - size * .5, size * 2, size); ctx.fillStyle = '#fff'; for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) ctx.fillRect(x - size + 5 + i * (size * 2 - 10) / 4, y - size * .5 + 5 + j * size / 2.2, size / 2.6, size / 3); glow(ctx, x, y, size * 3.4, '#cfe3ff', .9); }

const STADIUM = {
  rio: { name: 'Rio', crowd: ['#2f6bff', '#f5d418', '#ffffff', '#1d4ed8'], sky: ['#04101f', '#0d2a52', '#1c4a7a'], accent: '#f5d418' },
  barcelona: { name: 'Barcelone', crowd: ['#1d4ed8', '#a21c3a', '#2f6bff', '#7a1530'], sky: ['#070a1c', '#17204a', '#34306b'], accent: '#a21c3a' },
  madrid: { name: 'Madrid', crowd: ['#f4f4f0', '#c9ccd4', '#8a90a0', '#e8e8f0'], sky: ['#050915', '#101b3d', '#26346b'], accent: '#dfe4ff' },
  paris: { name: 'Paris', crowd: ['#2a3a8c', '#c8d0e0', '#b8202c', '#2a3a8c'], sky: ['#06091a', '#141d44', '#2a3472'], accent: '#7da2ff' },
  munich: { name: 'Munich', crowd: ['#d91f26', '#ff4d4f', '#ffffff', '#a8141a'], sky: ['#12040a', '#3a0f1c', '#611a2b'], accent: '#ff3b3f' },
  london: { name: 'Londres', crowd: ['#f4f4f0', '#dc2626', '#c9ccd4', '#ffffff'], sky: ['#060a18', '#142046', '#2c3a78'], accent: '#ffffff' }
};

function stadiumInside(ctx, W, H, key) {
  const p = STADIUM[key], floor = H * FLOOR;
  night(ctx, W, H, ...p.sky);
  tower(ctx, W * .27, H * .13, 30); tower(ctx, W * .73, H * .13, 30);
  crowd(ctx, W, H * .3, H * .44, p.crowd, `${key}1`, 46, 1); crowd(ctx, W, H * .44, H * .54, p.crowd, `${key}2`, 30, .8); crowd(ctx, W, H * .54, H * .6, p.crowd, `${key}3`, 18, .6);
  ctx.strokeStyle = 'rgba(210,225,255,.55)'; ctx.lineWidth = 5; ctx.beginPath(); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * .3 + 46 * ((x / W - .5) * 2) ** 2 - 4); ctx.stroke();
  { const r = rng(`${key}bokeh`); for (let i = 0; i < 46; i++) glow(ctx, r() * W, H * (.31 + r() * .27), 10 + r() * 20, p.crowd[Math.floor(r() * p.crowd.length)], .55); glow(ctx, W / 2, H * .46, W * .5, '#ffe9c0', .16); }
  if (key === 'rio') { ctx.strokeStyle = '#f8fafc'; ctx.lineWidth = 34; ctx.beginPath(); ctx.ellipse(W / 2, H * .22, W * .62, H * .14, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke(); }
  if (key === 'london') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 22; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.moveTo(W * .02, H * .38); ctx.quadraticCurveTo(W / 2, -H * .26, W * .98, H * .38); ctx.stroke(); ctx.shadowBlur = 0; }
  if (key === 'madrid') { ctx.fillStyle = 'rgba(235,240,255,.9)'; for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(W * (i / 14), H * .02); ctx.lineTo(W * ((i + 1) / 14) - 4, H * .02); ctx.lineTo(W * ((i + 1) / 14) - 4, H * .27 + Math.sin(i) * 8); ctx.lineTo(W * (i / 14), H * .25); ctx.fill(); } }
  if (key === 'paris') { ctx.fillStyle = 'rgba(190,198,215,.85)'; for (let i = 0; i < 22; i++) { const x = W * (i + .5) / 22; ctx.beginPath(); ctx.moveTo(x - 9, H * .27); ctx.lineTo(x + 9, H * .27); ctx.lineTo(x + 4, H * .3 + 46 * ((x / W - .5) * 2) ** 2); ctx.lineTo(x - 4, H * .3 + 46 * ((x / W - .5) * 2) ** 2); ctx.fill(); } }
  if (key === 'munich') { ctx.fillStyle = linear(ctx, 0, H * .26, 0, H * .62, [[0, 'rgba(255,40,50,.45)'], [1, 'rgba(255,40,50,.05)']]); ctx.fillRect(0, H * .26, W, H * .36); glow(ctx, W / 2, H * .45, W * .6, '#ff3b3f', .35); }
  if (key === 'barcelona') { for (const y of [.44, .54]) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 3; ctx.beginPath(); for (let x = 0; x <= W; x += 16) ctx.lineTo(x, H * y + 40 * ((x / W - .5) * 2) ** 2); ctx.stroke(); } }
  pitch(ctx, W, H, .6); glow(ctx, W / 2, H * .5, W * .55, p.accent, .12);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H * .585, W, 14);
}
function stadiumOutside(ctx, W, H, key) {
  const p = STADIUM[key], floor = H * FLOOR, r = rng(`${key}out`);
  night(ctx, W, H, ...p.sky);
  const body = (y0, y1, color) => { ctx.fillStyle = color; ctx.fillRect(0, y0, W, y1 - y0); };
  if (key === 'rio') { body(H * .42, floor, '#101a34'); ctx.strokeStyle = '#f2f6ff'; ctx.lineWidth = 26; ctx.beginPath(); ctx.ellipse(W / 2, H * .38, W * .62, H * .09, 0, 0, 2 * Math.PI); ctx.stroke(); for (let i = 0; i < 22; i++) { ctx.fillStyle = i % 2 ? '#2f6bff' : '#f5d418'; ctx.globalAlpha = .55; ctx.fillRect(W * i / 22, H * .45, W / 22 - 3, floor - H * .45); } ctx.globalAlpha = 1; }
  else if (key === 'barcelona') { for (let i = 0; i < 3; i++) { ctx.fillStyle = ['#161a33', '#1c2142', '#232a52'][i]; ctx.beginPath(); ctx.ellipse(W / 2, floor - i * H * .05, W * (.66 - i * .06), H * (.2 - i * .02), 0, Math.PI, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = i % 2 ? '#a21c3a' : '#2f6bff'; ctx.lineWidth = 6; ctx.stroke(); } }
  else if (key === 'madrid') { body(H * .3, floor, '#c5cbd8'); ctx.fillStyle = 'rgba(40,50,80,.5)'; for (let x = 0; x < W; x += 14) { ctx.fillRect(x, H * .3, 5, floor - H * .3); } for (let y = H * .3; y < floor; y += 22) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 5); ctx.stroke(); } ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(0, H * .3, W, 20); }
  else if (key === 'paris') { ctx.fillStyle = '#c7ccd8'; ctx.beginPath(); ctx.ellipse(W / 2, floor, W * .7, H * .32, 0, Math.PI, 2 * Math.PI); ctx.fill(); ctx.fillStyle = '#7e86a0'; for (let i = 0; i < 30; i++) { const x = W * (i + .5) / 30; ctx.fillRect(x - 6, H * .38 + Math.abs(x - W / 2) * .12, 12, floor - H * .38 - Math.abs(x - W / 2) * .12); } glow(ctx, W / 2, H * .5, W * .5, '#7da2ff', .22); }
  else if (key === 'munich') { ctx.fillStyle = '#2a0c14'; ctx.beginPath(); ctx.ellipse(W / 2, floor, W * .72, H * .3, 0, Math.PI, 2 * Math.PI); ctx.fill(); ctx.save(); ctx.clip(); for (let y = H * .38; y < floor; y += 30) for (let x = (y / 30 % 2) * 22 - 22; x < W; x += 44) { ctx.fillStyle = `rgba(255,${40 + r() * 60},${50 + r() * 40},${.55 + r() * .35})`; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x + 22, y); ctx.lineTo(x, y + 14); ctx.lineTo(x - 22, y); ctx.closePath(); ctx.fill(); } ctx.restore(); glow(ctx, W / 2, H * .55, W * .6, '#ff2b36', .45); }
  else if (key === 'london') { body(H * .44, floor, '#1b2142'); for (let i = 0; i < 28; i++) { ctx.fillStyle = '#f5d98a'; ctx.globalAlpha = .4 + r() * .4; ctx.fillRect(W * (i + .2) / 28, H * .5 + r() * 40, 10, 14); } ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 24; ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 36; ctx.beginPath(); ctx.moveTo(W * .08, floor); ctx.quadraticCurveTo(W / 2, -H * .32, W * .92, floor); ctx.stroke(); ctx.shadowBlur = 0; }
  glow(ctx, W * .5, H * .3, W * .5, p.accent, .08);
  ctx.fillStyle = linear(ctx, 0, floor - 4, 0, H, [[0, '#2a2f45'], [1, '#0c0f1c']]); ctx.fillRect(0, floor - 4, W, H - floor + 4);
  for (let i = 0; i < 8; i++) { const x = W * (i + .5) / 8; ctx.fillStyle = linear(ctx, 0, floor, 0, H, [[0, `${p.accent}55`], [1, `${p.accent}00`]]); ctx.fillRect(x - 5, floor, 10, H - floor); glow(ctx, x, H * .27 + (i % 2) * 20, 46, '#ffe9b0', .7); }
  ctx.fillStyle = linear(ctx, 0, floor, 0, H, [[0, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, floor, W, H - floor);
}
function training(ctx, W, H) {
  const floor = H * FLOOR, r = rng('training');
  ctx.fillStyle = linear(ctx, 0, 0, 0, H * .55, [[0, '#2a4f86'], [.55, '#8fb4dd'], [1, '#f3d9b0']]); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2f5a3a'; for (let i = 0; i < 18; i++) { ctx.beginPath(); ctx.arc(W * (i / 17), H * .52 + r() * 14, 46 + r() * 38, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#e9edf5'; ctx.fillRect(W * .62, H * .42, 160, 8); ctx.fillRect(W * .62, H * .42, 8, 80); ctx.fillRect(W * .62 + 152, H * .42, 8, 80);
  ctx.fillStyle = '#1f2b44'; ctx.fillRect(W * .06, H * .36, 130, H * .2); for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(W * .06 + 14 + x * 38, H * .38 + y * 30, 22, 16); }
  pitch(ctx, W, H, .56, '#2c8a3a', '#34a045');
  for (const [x, y] of [[.22, .78], [.78, .8], [.34, .9]]) { ctx.fillStyle = '#ff7a00'; ctx.beginPath(); ctx.moveTo(W * x, H * y - 34); ctx.lineTo(W * x + 20, H * y); ctx.lineTo(W * x - 20, H * y); ctx.fill(); }
  glow(ctx, W * .85, H * .1, 280, '#ffd9a0', .45);
}
function lockers(ctx, W, H) {
  const floor = H * FLOOR;
  ctx.fillStyle = linear(ctx, 0, 0, 0, floor, [[0, '#1b2230'], [1, '#2a3446']]); ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 8; i++) { const x = i * (W / 8); ctx.fillStyle = i % 2 ? '#2f6bff' : '#244fc0'; ctx.fillRect(x + 4, H * .16, W / 8 - 8, floor - H * .16 - 20); ctx.fillStyle = 'rgba(0,0,0,.25)'; for (let v = 0; v < 6; v++) ctx.fillRect(x + 20, H * .2 + v * 8, W / 8 - 40, 3); ctx.fillStyle = '#cfd6e4'; ctx.fillRect(x + W / 8 - 28, H * .45, 6, 26); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x + 4, H * .16, 10, floor - H * .16 - 20); }
  ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, floor - 36, W, 22); ctx.fillStyle = '#5b3a1a'; ctx.fillRect(0, floor - 14, W, 10);
  ctx.fillStyle = linear(ctx, 0, floor, 0, H, [[0, '#3a3f4a'], [1, '#14171e']]); ctx.fillRect(0, floor - 4, W, H - floor + 4);
  for (let i = 0; i < 4; i++) { ctx.fillStyle = '#fff6dd'; ctx.fillRect(W * (i + .5) / 4 - 90, H * .06, 180, 12); glow(ctx, W * (i + .5) / 4, H * .07, 230, '#ffe9b0', .75); }
}
function tunnel(ctx, W, H) {
  const floor = H * FLOOR; ctx.fillStyle = '#05070d'; ctx.fillRect(0, 0, W, H);
  for (let i = 14; i >= 0; i--) { const t = i / 14, w = W * (.12 + t * .95), h = H * (.1 + t * .95), cx = W / 2, cy = H * .42; ctx.fillStyle = i % 2 ? '#10162a' : '#171f3a'; ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, 7); ctx.fill(); ctx.strokeStyle = `rgba(120,160,255,${.1 + (1 - t) * .5})`; ctx.lineWidth = 3; ctx.stroke(); }
  ctx.fillStyle = radial(ctx, W / 2, H * .42, 0, W * .14, [[0, '#ffffff'], [.5, '#bcd7ff'], [1, '#bcd7ff00']]); ctx.fillRect(0, 0, W, H); glow(ctx, W / 2, H * .42, W * .5, '#8ab4ff', .5);
  ctx.fillStyle = linear(ctx, 0, floor, 0, H, [[0, '#262c40'], [1, '#080a12']]); ctx.fillRect(0, floor - 4, W, H - floor + 4);
  ctx.fillStyle = linear(ctx, W / 2, floor, W / 2, H, [[0, 'rgba(160,200,255,.35)'], [1, 'rgba(160,200,255,0)']]); ctx.fillRect(W * .35, floor, W * .3, H - floor);
}
function solid(ctx, W, H, id) {
  const [, , c1, c2] = SOLID_BACKGROUNDS.find(entry => entry[0] === id) ?? SOLID_BACKGROUNDS[1];
  ctx.fillStyle = radial(ctx, W / 2, H * .42, 20, W * .75, [[0, c1], [1, c2]]); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = radial(ctx, W / 2, H * FLOOR, 10, W * .45, [[0, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]); ctx.save(); ctx.translate(0, H * FLOOR); ctx.scale(1, .22); ctx.translate(0, -H * FLOOR); ctx.fillRect(0, H * FLOOR - W / 2, W, W); ctx.restore();
  ctx.fillStyle = radial(ctx, W / 2, H / 2, W * .35, W * .8, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.45)']]); ctx.fillRect(0, 0, W, H);
}
// Dessine le fond choisi dans le canvas (carré) : la ligne de sol est toujours à FLOOR de la hauteur.
export function drawBackground(canvas, id) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (id.startsWith('solid-')) solid(ctx, W, H, id);
  else if (id === 'bg-training') { training(ctx, W, H); soften(canvas, 6, .7); }
  else if (id === 'bg-lockers') { lockers(ctx, W, H); soften(canvas, 6, .7); }
  else if (id === 'bg-tunnel') { tunnel(ctx, W, H); soften(canvas, 7, .55); }
  else { const [, key, side] = id.match(/^bg-([a-z]+)-(in|out)$/) ?? []; if (STADIUM[key]) { (side === 'in' ? stadiumInside : stadiumOutside)(ctx, W, H, key); soften(canvas, 7, .45); } else solid(ctx, W, H, 'solid-1'); }
  const vignette = ctx.createRadialGradient(W / 2, H * .5, W * .3, W / 2, H * .5, W * .85); vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
  return canvas;
}
export const backgroundAccent = id => id.startsWith('solid-') ? (SOLID_BACKGROUNDS.find(entry => entry[0] === id)?.[2] ?? '#9db8ff') : (STADIUM[(id.match(/^bg-([a-z]+)-/) ?? [])[1]]?.accent ?? '#9db8ff');
export const FLOOR_LINE = FLOOR;

// Maillot : motif, couleurs, maille, col, numéro et nom au dos (u = 0 devant, 0,5 derrière).
export function drawKit(canvas, kitId, number, name) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, kit = KITS[kitId] ?? KITS['start-lime'], { c1, c2, pattern } = kit;
  ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
  const stripe = (x, y, w, h, color, alpha = 1) => { ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1; };
  if (pattern === 'vertical') for (let i = 0; i < 12; i++) if (i % 2) stripe(W * i / 12, 0, W / 12, H, c2);
  if (pattern === 'band') stripe(0, H * .34, W, H * .17, c2);
  if (pattern === 'hoops') for (let i = 0; i < 10; i++) if (i % 2) stripe(0, H * i / 10, W, H / 10, c2);
  if (pattern === 'scarf') { stripe(0, H * .3, W, H * .2, c2); stripe(0, H * .34, W, H * .02, c1); stripe(0, H * .44, W, H * .02, c1); ctx.fillStyle = c1; for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(W * i / 24, H * .4); ctx.lineTo(W * (i + .5) / 24, H * .36); ctx.lineTo(W * (i + 1) / 24, H * .4); ctx.lineTo(W * (i + .5) / 24, H * .44); ctx.fill(); } }
  if (pattern === 'retro70') { stripe(0, H * .3, W, H * .14, c2); stripe(0, H * .47, W, H * .035, mix(c1, '#000000', .35)); stripe(0, H * .52, W, H * .02, c2); }
  if (pattern === 'retro90') { ctx.fillStyle = c2; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(W * i / 16, H * .5); ctx.lineTo(W * (i + .5) / 16, H * .24); ctx.lineTo(W * (i + 1) / 16, H * .5); ctx.fill(); } ctx.globalAlpha = .6; ctx.fillStyle = mix(c1, '#ffffff', .4); for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(W * (i + .25) / 16, H * .52); ctx.lineTo(W * (i + .75) / 16, H * .52); ctx.lineTo(W * (i + .5) / 16, H * .4); ctx.fill(); } ctx.globalAlpha = 1; }
  if (pattern === 'legend') { for (let i = 0; i < 40; i++) stripe(W * i / 40, 0, 2, H, c2, .55); stripe(0, H * .3, W, H * .035, c2); stripe(0, H * .4, W, H * .035, c2); }
  if (pattern === 'champion') { ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, mix(c1, '#ffffff', .35)], [.5, c1], [1, mix(c1, '#000000', .45)]]); ctx.fillRect(0, 0, W, H); ctx.strokeStyle = c2; ctx.lineWidth = 14; ctx.globalAlpha = .85; for (let k = 0; k < 3; k++) for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(W * i / 8, H * (.22 + k * .1)); ctx.lineTo(W * (i + .5) / 8, H * (.3 + k * .1)); ctx.lineTo(W * (i + 1) / 8, H * (.22 + k * .1)); ctx.stroke(); } ctx.globalAlpha = 1; }
  stripe(0, 0, W, H * .05, kit.c2, pattern === 'plain' ? .8 : 1);
  ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = 1; for (let y = 0; y < H; y += 3) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < W; x += 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  const ink = luminance(c1) > .55 ? (luminance(c2) < .4 ? c2 : '#14161a') : (luminance(c2) > .6 ? c2 : '#f6f6f2');
  ctx.textAlign = 'center'; ctx.fillStyle = ink;
  const label = String(name ?? '').trim();
  if (label) { ctx.font = `800 ${label.length > 8 ? 30 : 38}px Impact, "Arial Narrow", sans-serif`; ctx.fillText(label, W / 2, H * .24, W * .3); }
  if (number != null) { ctx.font = '900 150px Impact, "Arial Narrow", sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = mix(c1, '#000000', .4); ctx.globalAlpha = .6; ctx.strokeText(String(number), W / 2, H * .52); ctx.globalAlpha = 1; ctx.fillText(String(number), W / 2, H * .52, W * .3); ctx.font = '800 54px Impact, "Arial Narrow", sans-serif'; ctx.fillText(String(number), 0, H * .34); ctx.fillText(String(number), W, H * .34); }
  return canvas;
}
// Petite pastille du maillot pour la liste d'options du studio et de la boutique.
export function kitSwatch(kitId, size = 72) { const canvas = make(size * 2); drawKit(canvas, kitId, null, ''); return canvas.toDataURL('image/png'); }
export function backgroundSwatch(id, size = 96) { const canvas = make(size * 2); drawBackground(canvas, id); const out = make(size); out.getContext('2d').drawImage(canvas, 0, canvas.height * .15, canvas.width, canvas.height * .7, 0, 0, size, size); return out.toDataURL('image/webp', .7); }

export function irisTexture(color) {
  const c = make(128), ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 62, 0, 7); ctx.clip();
  ctx.fillStyle = radial(ctx, 64, 64, 6, 62, [[0, mix(color, '#ffffff', .45)], [.55, color], [.9, mix(color, '#000000', .55)], [1, '#0b0b10']]); ctx.fillRect(0, 0, 128, 128);
  const r = rng(color); ctx.lineWidth = 1.2; for (let i = 0; i < 70; i++) { const a = r() * 7, l0 = 14 + r() * 8, l1 = 40 + r() * 20; ctx.strokeStyle = r() > .5 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.moveTo(64 + Math.cos(a) * l0, 64 + Math.sin(a) * l0); ctx.lineTo(64 + Math.cos(a) * l1, 64 + Math.sin(a) * l1); ctx.stroke(); }
  ctx.fillStyle = '#05050a'; ctx.beginPath(); ctx.arc(64, 64, 20, 0, 7); ctx.fill();
  return c;
}
export function blushTexture() { const c = make(64), ctx = c.getContext('2d'); ctx.fillStyle = radial(ctx, 32, 32, 0, 32, [[0, 'rgba(255,92,110,.85)'], [.6, 'rgba(255,92,110,.28)'], [1, 'rgba(255,92,110,0)']]); ctx.fillRect(0, 0, 64, 64); return c; }
export function glowTexture(color = '#ffffff') { const c = make(128), ctx = c.getContext('2d'); ctx.fillStyle = radial(ctx, 64, 64, 0, 64, [[0, color], [.35, `${color}66`], [1, `${color}00`]]); ctx.fillRect(0, 0, 128, 128); return c; }
export function shadowTexture() { const c = make(128), ctx = c.getContext('2d'); ctx.fillStyle = radial(ctx, 64, 64, 0, 64, [[0, 'rgba(0,0,0,.62)'], [.55, 'rgba(0,0,0,.24)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, 0, 128, 128); return c; }
export function grassTexture() {
  const c = make(256), ctx = c.getContext('2d'), r = rng('grass'); ctx.fillStyle = '#2e8b3d'; ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.08)'; ctx.fillRect(0, i * 32, 256, 32); }
  for (let i = 0; i < 2600; i++) { ctx.fillStyle = r() > .5 ? '#46b04f' : '#1f6d2d'; ctx.globalAlpha = .55; ctx.fillRect(r() * 256, r() * 256, 1.4, 3 + r() * 4); } ctx.globalAlpha = 1; return c;
}
export function weaveTexture() { const c = make(64), ctx = c.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 64, 64); for (let y = 0; y < 64; y += 2) for (let x = (y / 2 % 2) * 1; x < 64; x += 2) { ctx.fillStyle = '#a0a0a0'; ctx.fillRect(x, y, 1, 1); } return c; }
export function ballTexture(light = '#f7f7f2', dark = '#15171a') {
  const c = make(512), ctx = c.getContext('2d'); ctx.fillStyle = light; ctx.fillRect(0, 0, 512, 512);
  const phi = (1 + Math.sqrt(5)) / 2, dirs = []; for (const a of [-1, 1]) for (const b of [-phi, phi]) { dirs.push([0, a, b], [a, b, 0], [b, 0, a]); }
  ctx.fillStyle = dark;
  for (const [x, y, z] of dirs) { const l = Math.hypot(x, y, z), lon = Math.atan2(x / l, z / l), lat = Math.asin(y / l), px = (lon / (2 * Math.PI) + .5) * 512, py = (.5 - lat / Math.PI) * 512, rx = 38 / Math.max(.25, Math.cos(lat)); for (const dx of [-512, 0, 512]) { ctx.beginPath(); ctx.ellipse(px + dx, py, Math.min(rx, 120), 38, 0, 0, 7); ctx.fill(); } }
  ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2; for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.moveTo(0, 64 * i + 20); ctx.bezierCurveTo(170, 64 * i - 40, 340, 64 * i + 80, 512, 64 * i + 20); ctx.stroke(); }
  return c;
}
