// Effets de victoire et ambiance sonore (BET-163), chargés à la demande : canvas 2D et Web Audio, sans dépendance ni ressource externe.
// Jamais Three.js ici : l'animation légère de l'onglet Matchs n'utilise que l'image enregistrée de l'avatar. Toutes les ressources sont libérées à la fin.
import { CELEBRATION_MS } from './celebration-model.js';

export const reducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const accent = () => {
  try {
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#C8F03C'
    );
  } catch {
    return '#C8F03C';
  }
};
const palette = (colors) => [
  ...(Array.isArray(colors) ? colors.filter(Boolean) : []),
  accent(),
  '#F4F7F2'
];
const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// Particules par effet : init crée l'état, step le fait avancer (dt en secondes) et dessine. t : temps écoulé, end : durée totale.
const EFFECTS = {
  confetti: {
    init: (w, h, colors) =>
      Array.from({ length: Math.round(Math.min(180, w / 6)) }, () => ({
        x: random(0, w),
        y: random(-h * 0.6, -10),
        vx: random(-60, 60),
        vy: random(80, 220),
        r: random(0, Math.PI),
        vr: random(-6, 6),
        s: random(6, 12),
        c: pick(colors)
      })),
    step(ctx, parts, dt, t, end) {
      const fade = Math.min(1, (end - t) / 500);
      for (const p of parts) {
        p.vy += 260 * dt;
        p.vx *= 0.99;
        p.x += (p.vx + Math.sin(t / 300 + p.r) * 30) * dt;
        p.y += p.vy * dt * 0.6;
        p.r += p.vr * dt;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
    }
  },
  smoke: {
    init: () => ({ puffs: [], clock: 0 }),
    step(ctx, state, dt, t, end, w, h, colors) {
      state.clock += dt;
      if (t < end - 900)
        while (state.clock > 0.025) {
          state.clock -= 0.025;
          for (const side of [0, 1])
            state.puffs.push({
              x: side ? w - random(20, 80) : random(20, 80),
              y: h + 20,
              vx: side ? random(-90, -20) : random(20, 90),
              vy: random(-220, -120),
              r: random(20, 40),
              life: 0,
              max: random(1.6, 2.4),
              c: colors[side % colors.length]
            });
        }
      state.puffs = state.puffs.filter((p) => (p.life += dt) < p.max);
      for (const p of state.puffs) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r += 38 * dt;
        const alpha = 0.35 * (1 - p.life / p.max),
          g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.c);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = alpha;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  fireworks: {
    init: () => ({ rockets: [], sparks: [], next: 0 }),
    step(ctx, state, dt, t, end, w, h, colors) {
      state.next -= dt;
      if (state.next <= 0 && t < end - 1100) {
        state.next = random(0.28, 0.5);
        state.rockets.push({
          x: random(w * 0.15, w * 0.85),
          y: h,
          vy: random(-h * 1.1, -h * 0.8),
          top: random(h * 0.15, h * 0.45),
          c: pick(colors)
        });
      }
      for (const r of state.rockets) {
        r.y += r.vy * dt;
        ctx.fillStyle = r.c;
        ctx.fillRect(r.x - 1.5, r.y, 3, 10);
        if (r.y <= r.top) {
          r.done = true;
          for (let i = 0; i < 56; i++) {
            const angle = (i / 56) * Math.PI * 2,
              speed = random(80, 240);
            state.sparks.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              life: 0,
              max: random(0.8, 1.3),
              c: Math.random() < 0.2 ? '#F4F7F2' : r.c
            });
          }
        }
      }
      state.rockets = state.rockets.filter((r) => !r.done);
      state.sparks = state.sparks.filter((s) => (s.life += dt) < s.max);
      for (const s of state.sparks) {
        s.vy += 160 * dt;
        s.vx *= 0.985;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        ctx.globalAlpha = 1 - s.life / s.max;
        ctx.fillStyle = s.c;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
};
export const effectKind = (id) => {
  const kind = String(id ?? '').replace(/^effect-/, '');
  return Object.hasOwn(EFFECTS, kind) ? kind : null;
};

// Joue l'effet équipé en surimpression (canvas plein écran, aucun clic intercepté). Renvoie une fonction d'arrêt ; rien avec « réduire les animations ».
export function playEffect(id, { colors = null, duration = CELEBRATION_MS } = {}) {
  const kind = effectKind(id);
  if (!kind || reducedMotion() || typeof document === 'undefined') return () => {};
  const canvas = document.createElement('canvas'),
    ratio = Math.min(2, globalThis.devicePixelRatio || 1),
    w = innerWidth,
    h = innerHeight,
    effect = EFFECTS[kind],
    list = palette(colors);
  canvas.className = 'victory-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = Math.round(w * ratio);
  canvas.height = Math.round(h * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  ctx.scale(ratio, ratio);
  document.body.append(canvas);
  let state = effect.init(w, h, list),
    frame = 0,
    last = performance.now(),
    stopped = false;
  const start = last,
    stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      canvas.remove();
      canvas.width = canvas.height = 0;
      state = null;
    };
  const tick = (now) => {
    if (stopped) return;
    const t = now - start,
      dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);
    effect.step(ctx, state, dt, t, duration, w, h, list);
    if (t >= duration) stop();
    else frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return stop;
}

// Sons synthétisés : enveloppes simples, contexte audio créé à la demande puis fermé à la fin du son.
const SOUNDS = {
  siren(audio, out, t) {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    for (let i = 0; i < 3; i++) {
      osc.frequency.setValueAtTime(620, t + i * 0.55);
      osc.frequency.linearRampToValueAtTime(1180, t + i * 0.55 + 0.3);
      osc.frequency.linearRampToValueAtTime(620, t + i * 0.55 + 0.55);
    }
    osc.connect(out);
    osc.start(t);
    osc.stop(t + 1.65);
    return 1.7;
  },
  drums(audio, out, t) {
    [0, 0.25, 0.5, 0.62, 0.75, 1, 1.25, 1.37].forEach((at) => {
      const osc = audio.createOscillator(),
        gain = audio.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, t + at);
      osc.frequency.exponentialRampToValueAtTime(48, t + at + 0.18);
      gain.gain.setValueAtTime(1, t + at);
      gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.22);
      osc.connect(gain).connect(out);
      osc.start(t + at);
      osc.stop(t + at + 0.25);
    });
    return 1.7;
  },
  horn(audio, out, t) {
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.connect(out);
    [218, 221, 327].forEach((freq) => {
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + 1.4);
    });
    return 1.5;
  }
};
export const soundKind = (id) => {
  const kind = String(id ?? '').replace(/^sound-/, '');
  return Object.hasOwn(SOUNDS, kind) ? kind : null;
};
// Le navigateur n'autorise le son qu'après un geste du joueur : sans geste connu, aucun contexte audio n'est créé.
export const audioAllowed = () =>
  typeof navigator === 'undefined' || navigator.userActivation?.hasBeenActive !== false;
// Durée d'affichage de la célébration quand le son attend le premier geste du joueur.
export const DEFERRED_SOUND_MS = 8000;
export function playSound(id, { volume = 0.18 } = {}) {
  const kind = soundKind(id),
    Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!kind || !Context || !audioAllowed()) return false;
  try {
    const audio = new Context(),
      out = audio.createGain(),
      t = audio.currentTime + 0.02;
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(volume, t + 0.05);
    out.connect(audio.destination);
    const length = SOUNDS[kind](audio, out, t);
    out.gain.setValueAtTime(volume, t + length - 0.2);
    out.gain.linearRampToValueAtTime(0, t + length);
    audio.resume?.().catch(() => {});
    setTimeout(() => audio.close?.().catch(() => {}), (length + 0.3) * 1000);
    return true;
  } catch {
    return false;
  }
}

// Animation légère de l'onglet Matchs : image de l'avatar qui saute, effet équipé au-dessus, 2 à 3 s, fermable, sans bloquer l'interface.
export function showVictory({
  avatar = '',
  effect = null,
  sound = null,
  colors = null,
  count = 1,
  onClose = () => {}
} = {}) {
  if (typeof document === 'undefined') return () => {};
  document.querySelector('.victory-pop')?.remove();
  const pop = document.createElement('div');
  pop.className = 'victory-pop';
  pop.setAttribute('role', 'status');
  pop.setAttribute('aria-live', 'polite');
  pop.innerHTML = `<div class="victory-avatar">${avatar}</div><div class="victory-text"><strong>Prono gagné !</strong><small>${count > 1 ? `${count} pronos gagnés depuis votre dernière visite` : 'Bravo, votre pronostic est validé'}</small></div><button class="icon-button" type="button" data-victory-close aria-label="Fermer la célébration"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  document.body.append(pop);
  const stopEffect = playEffect(effect, { colors });
  // Sans geste du joueur à l'ouverture du site, le son attend son premier geste tant que la célébration est affichée (sauf clic sur Fermer).
  const deferred = Boolean(sound && soundKind(sound) && !audioAllowed());
  if (sound && !deferred) playSound(sound);
  const onGesture = (event) => {
    if (event.target?.closest?.('[data-victory-close]')) return;
    stopListening();
    playSound(sound);
  };
  const stopListening = () => {
    document.removeEventListener('pointerup', onGesture, true);
    document.removeEventListener('keydown', onGesture, true);
  };
  if (deferred) {
    document.addEventListener('pointerup', onGesture, true);
    document.addEventListener('keydown', onGesture, true);
  }
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    stopListening();
    stopEffect();
    pop.remove();
    onClose();
  };
  const timer = setTimeout(close, deferred ? DEFERRED_SOUND_MS : CELEBRATION_MS + 400);
  pop.querySelector('[data-victory-close]').addEventListener('click', close);
  return close;
}
