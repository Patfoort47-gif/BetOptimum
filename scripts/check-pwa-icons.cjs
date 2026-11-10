const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  { browser, page } = require('./ui-mobile-fixtures.cjs');
(async () => {
  const manifest = JSON.parse(fs.readFileSync('_site/manifest.webmanifest', 'utf8'));
  for (const icon of manifest.icons) assert.ok(fs.existsSync('_site/' + icon.src));
  const cached = JSON.parse(fs.readFileSync('_site/offline-assets.json', 'utf8'));
  for (const name of [
    'icons/favicon.svg',
    'icons/apple-touch-icon.png',
    ...manifest.icons.map((i) => i.src)
  ])
    assert.ok(cached.includes(name), name);
  const b = await browser();
  try {
    const p = await page(b, { width: 390 });
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Page.enable');
    const actual = await cdp.send('Page.getAppManifest');
    assert.equal(actual.errors.length, 0);
    assert.deepEqual(JSON.parse(actual.data), manifest);
    assert.equal(await p.locator('link[rel=apple-touch-icon]').getAttribute('sizes'), '180x180');
    const results = await p.evaluate(async () => {
      const load = async (src) => {
          const i = new Image();
          i.src = src;
          await i.decode();
          return i;
        },
        source = await load('icons/favicon.svg'),
        results = [];
      for (const [file, size] of [
        ['icon-192x192.png', 192],
        ['icon-512x512.png', 512],
        ['apple-touch-icon.png', 180],
        ['icon-maskable.png', 512]
      ]) {
        const i = await load('icons/' + file);
        if (i.naturalWidth !== size || i.naturalHeight !== size) throw Error('Dimensions ' + file);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        if (file === 'apple-touch-icon.png' || file === 'icon-maskable.png') {
          ctx.fillStyle = '#C8F03C';
          ctx.fillRect(0, 0, size, size);
        }
        const inset = file === 'icon-maskable.png' ? size * 0.1 : 0;
        ctx.drawImage(source, inset, inset, size - inset * 2, size - inset * 2);
        const expected = ctx.getImageData(0, 0, size, size).data;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(i, 0, 0);
        const pixels = ctx.getImageData(0, 0, size, size).data;
        if (!pixels.every((v, n) => v === expected[n])) throw Error('Logo différent ' + file);
        if (file === 'icon-maskable.png') {
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              const n = (y * size + x) * 4;
              if (pixels[n + 3] !== 255) throw Error('Transparence maskable');
              if (pixels[n] < 80 && Math.hypot(x - size / 2, y - size / 2) > size * 0.4)
                throw Error('Logo hors zone sûre');
            }
        }
        results.push(file + ' ' + size + 'px fidèle au SVG');
      }
      return results;
    });
    console.log('OK manifest Chrome, assets publiés/hors ligne, Apple 180px et zone sûre Android');
    console.log(results.join('\n'));
    assert.deepEqual(p.__errors, []);
    await p.close();
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
