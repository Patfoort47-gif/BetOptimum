import test from 'node:test';
import assert from 'node:assert/strict';
// BET-163 · célébration automatique d'un prono gagné, préférence son, couleurs des effets
const C = await import('../celebration-model.js'),
  V = await import('../victory-effects.js'),
  A = await import('../avatar-config.js');
const ev = (kind, created_at, xp = 10) => ({ kind, xp, created_at });
test('un nouveau prono gagné déclenche une célébration, puis la marque avance', () => {
  const events = [
    ev('won', '2026-11-03T10:00:00.123456+00:00'),
    ev('counted', '2026-11-03T09:00:00+00:00', 2),
    ev('won', '2026-11-02T20:00:00+00:00')
  ];
  const due = C.celebrationDue(events, '2026-11-02T21:00:00.000Z');
  assert.deepEqual(due, { celebrate: true, count: 1, mark: '2026-11-03T10:00:00.123456+00:00' });
  assert.deepEqual(C.celebrationDue(events, '2026-11-01T00:00:00Z'), {
    celebrate: true,
    count: 2,
    mark: '2026-11-03T10:00:00.123456+00:00'
  });
});
test('un prono gagné déjà vu ne se célèbre pas deux fois', () => {
  const events = [ev('won', '2026-11-03T10:00:00+00:00')],
    first = C.celebrationDue(events, '2026-11-03T09:00:00Z');
  assert.equal(first.celebrate, true);
  const again = C.celebrationDue(events, first.mark);
  assert.deepEqual(again, { celebrate: false, count: 0, mark: first.mark });
});
test('premier passage sans marque : aucune rafale pour les anciens gains, marque posée sur le dernier gain ou sur maintenant', () => {
  const events = [
    ev('won', '2026-11-01T10:00:00+00:00'),
    ev('won', '2026-11-03T10:00:00+00:00'),
    ev('won', '2026-11-02T10:00:00+00:00')
  ];
  assert.deepEqual(C.celebrationDue(events, ''), {
    celebrate: false,
    count: 0,
    mark: '2026-11-03T10:00:00+00:00'
  });
  assert.deepEqual(C.celebrationDue(events, null).celebrate, false);
  const now = Date.parse('2026-11-03T12:00:00Z'),
    empty = C.celebrationDue([], '', now);
  assert.deepEqual(empty, { celebrate: false, count: 0, mark: '2026-11-03T12:00:00.000Z' });
  assert.equal(
    C.celebrationDue([ev('won', '2026-11-03T13:00:00+00:00')], empty.mark).celebrate,
    true
  );
  assert.equal(C.celebrationDue(events, 'pas une date').celebrate, false);
});
test('les événements autres que « won » sont ignorés, comme les dates invalides', () => {
  const events = [
    ev('counted', '2026-11-03T10:00:00+00:00', 2),
    ev('streak', '2026-11-03T11:00:00+00:00', 15),
    ev('badge', '2026-11-03T12:00:00+00:00', 50),
    ev('won', 'pas une date'),
    { kind: 'won' }
  ];
  assert.deepEqual(C.celebrationDue(events, '2026-11-01T00:00:00Z'), {
    celebrate: false,
    count: 0,
    mark: '2026-11-01T00:00:00Z'
  });
  assert.equal(C.celebrationDue(null, '2026-11-01T00:00:00Z').celebrate, false);
});
test('le son des célébrations est coupé par défaut', () => {
  assert.equal(C.soundEnabled(undefined), false);
  assert.equal(C.soundEnabled({}), false);
  assert.equal(C.soundEnabled({ nickname: 'Parieur', avatar: 'lime' }), false);
  assert.equal(C.soundEnabled({ celebrationSound: 'true' }), false);
  assert.equal(C.soundEnabled({ celebrationSound: 1 }), false);
  assert.equal(C.soundEnabled({ celebrationSound: true }), true);
});
test('objet équipé : identifiant de la boutique ou rien', () => {
  assert.equal(C.equippedOf({ effect: 'effect-confetti' }, 'effect'), 'effect-confetti');
  assert.equal(C.equippedOf({}, 'sound'), null);
  assert.equal(C.equippedOf(undefined, 'effect'), null);
  assert.equal(C.equippedOf({ effect: '<img>' }, 'effect'), null);
});
test('couleurs des effets : maillot de l’avatar, sinon repli (null) sur l’accent du site', () => {
  assert.deepEqual(C.celebrationColors(A.defaultAvatar()), [
    A.KITS['start-lime'].c1,
    A.KITS['start-lime'].c2
  ]);
  assert.deepEqual(C.celebrationColors(A.applyItem(A.defaultAvatar(), 'kit-plain-red')), [
    '#e02424',
    '#f4f4f0'
  ]);
  assert.equal(C.celebrationColors(null), null);
  assert.equal(C.celebrationColors({ avatar: 'lime' }), null);
});
test('chaque effet et chaque son de la boutique a un rendu, et rien ne se joue hors navigateur', async () => {
  const S = await import('../shop.js');
  for (const item of S.CATALOG.filter((e) => e.category === 'effect'))
    assert.ok(V.effectKind(item.id), item.id);
  for (const item of S.CATALOG.filter((e) => e.category === 'sound'))
    assert.ok(V.soundKind(item.id), item.id);
  assert.equal(V.effectKind('effect-inconnu'), null);
  assert.equal(V.soundKind('celeb-jump'), null);
  assert.equal(V.effectKind(null), null);
  assert.equal(typeof V.playEffect('effect-confetti'), 'function');
  assert.equal(V.playSound('sound-siren'), false);
});
// BET-163 (relecture) : à l'ouverture du site, sans geste du joueur, le son attend le premier geste pendant la célébration.
test('le son de la célébration attend le premier geste du joueur, sauf clic sur Fermer', () => {
  const listeners = {},
    sounds = [],
    node = () => ({
      className: '',
      innerHTML: '',
      setAttribute() {},
      remove() {
        this.removed = true;
      },
      querySelector: () => ({
        addEventListener(type, fn) {
          node.closeFn = fn;
        }
      })
    });
  const saved = {
    document: globalThis.document,
    navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
    AudioContext: globalThis.AudioContext
  };
  const gain = () => ({
      gain: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        value: 0
      },
      connect() {}
    }),
    osc = () => ({
      type: '',
      frequency: {
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        value: 0
      },
      connect() {},
      start() {},
      stop() {}
    });
  globalThis.document = {
    querySelector: () => null,
    createElement: node,
    body: { append() {} },
    addEventListener(type, fn) {
      listeners[type] = fn;
    },
    removeEventListener(type) {
      delete listeners[type];
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { userActivation: { hasBeenActive: false } },
    configurable: true
  });
  globalThis.AudioContext = class {
    constructor() {
      sounds.push(1);
      this.currentTime = 0;
      this.destination = {};
    }
    createGain() {
      return gain();
    }
    createOscillator() {
      return osc();
    }
    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect() {} };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  };
  try {
    const close = V.showVictory({ sound: 'sound-siren' });
    assert.equal(sounds.length, 0);
    assert.ok(listeners.pointerup && listeners.keydown);
    navigator.userActivation.hasBeenActive = true;
    listeners.pointerup({ target: { closest: () => null } });
    assert.equal(sounds.length, 1);
    assert.equal(listeners.pointerup, undefined);
    close();
    navigator.userActivation.hasBeenActive = false;
    V.showVictory({ sound: 'sound-siren' });
    listeners.pointerup({
      target: { closest: (sel) => (sel === '[data-victory-close]' ? {} : null) }
    });
    assert.equal(sounds.length, 1);
    assert.ok(listeners.pointerup);
    node.closeFn();
    assert.equal(listeners.pointerup, undefined);
  } finally {
    globalThis.document = saved.document;
    globalThis.AudioContext = saved.AudioContext;
    if (saved.navigator) Object.defineProperty(globalThis, 'navigator', saved.navigator);
    else delete globalThis.navigator;
  }
});
