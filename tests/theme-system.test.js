import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../theme-bootstrap.js', import.meta.url), 'utf8');
function boot({ stored = null, dark = false, blocked = false } = {}) {
  const handlers = {},
    button = {
      setAttribute() {},
      addEventListener(name, fn) {
        handlers[name] = fn;
      }
    },
    media = {
      matches: dark,
      addEventListener(name, fn) {
        handlers.system = fn;
      }
    },
    ctx = {
      document: {
        documentElement: {
          classList: {
            toggle(name, value) {
              ctx.light = value;
            }
          }
        },
        querySelector: () => null,
        getElementById: () => button
      },
      localStorage: {
        getItem() {
          if (blocked) throw Error();
          return stored;
        },
        setItem(_, value) {
          if (blocked) throw Error();
          stored = value;
        },
        removeItem() {
          if (blocked) throw Error();
          stored = null;
        }
      },
      matchMedia: () => media,
      addEventListener(name, fn) {
        handlers[name] = fn;
      }
    };
  vm.runInNewContext(source, ctx);
  return {
    ctx,
    media,
    handlers,
    get stored() {
      return stored;
    }
  };
}
test('le thème est appliqué avant le rendu, suit l’OS et donne priorité au choix explicite', () => {
  for (const dark of [true, false]) {
    const s = boot({ dark });
    assert.equal(s.ctx.light, !dark);
    s.media.matches = !dark;
    s.handlers.system();
    assert.equal(s.ctx.light, dark);
    s.ctx.betOptimumTheme.bind();
    s.ctx.betOptimumTheme.choose(s.ctx.light ? 'dark' : 'light');
    const chosen = s.ctx.light;
    s.media.matches = dark;
    s.handlers.system();
    assert.equal(s.ctx.light, chosen);
    assert.equal(s.stored, chosen ? 'light' : 'dark');
  }
});
test('préférence valide, invalide, stockage bloqué et suppression inter-onglets', () => {
  assert.equal(boot({ stored: 'dark' }).ctx.light, false);
  assert.equal(boot({ stored: 'invalid', dark: true }).ctx.light, false);
  const s = boot({ blocked: true });
  s.ctx.betOptimumTheme.bind();
  s.ctx.betOptimumTheme.choose(s.ctx.light ? 'dark' : 'light');
  assert.equal(s.ctx.light, false);
  s.handlers.storage({ key: 'betmaster-theme', newValue: null });
  assert.equal(s.ctx.light, true);
});

test('retour au système après choix manuel et validation des valeurs', () => {
  const s = boot({ stored: 'light', dark: true });
  s.ctx.betOptimumTheme.choose('system');
  assert.equal(s.ctx.light, false);
  assert.equal(s.stored, null);
  assert.equal(s.ctx.betOptimumTheme.preference(), 'system');
  s.ctx.betOptimumTheme.choose('invalid');
  assert.equal(s.ctx.betOptimumTheme.preference(), 'system');
  s.media.matches = false;
  s.handlers.system();
  assert.equal(s.ctx.light, true);
});
