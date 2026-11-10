import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { preparePages } from '../scripts/prepare-pages.mjs';
test('la publication contient les modules différés, styles et données, sans tests ni serveur', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bet-pages-')),
    out = pathToFileURL(dir + '/');
  try {
    const modules = await preparePages(out),
      names = await readdir(out);
    for (const name of [
      'app.js',
      'src/matches/details.js',
      'src/account/account.js',
      'src/account/profile.js',
      'src/avatar/avatar.js',
      'notification-sw.js',
      'src/account/supabase-config.js'
    ])
      assert.ok(modules.includes(name), name);
    for (const name of [
      'data/fixtures.json',
      'data/predictions-history.json',
      'data/offers/2026-11-12.json',
      'styles/details.css',
      'styles/components.css',
      'fonts/inter-latin-400-normal.woff2',
      'fonts/barlow-condensed-latin-700-normal.woff2',
      'stadiums/README.md',
      'index.html',
      '.nojekyll'
    ])
      await access(new URL(name, out));
    assert.ok(
      !names.some(
        (name) =>
          name.endsWith('.sql') ||
          name.endsWith('.test.js') ||
          [
            'tests',
            'supabase',
            'scripts',
            'docs',
            'AGENTS.md',
            'CLAUDE.md',
            'work',
            '.git',
            'src/notifications/notification-delivery.js',
            'src/notifications/notification-email.js'
          ].includes(name)
      )
    );
    const html = await readFile(new URL('index.html', out), 'utf8');
    assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)\.com/);
    for (const [, href] of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"#]*)?)"/g)) {
      if (/^https?:/.test(href)) continue;
      await access(new URL(href.split('?')[0], out));
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
