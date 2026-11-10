const fs = require('node:fs'),
  { chromium } = require('playwright');
(async () => {
  const source = fs.readFileSync('icons/favicon.svg', 'utf8');
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const p = await b.newPage();
    for (const [name, size, maskable] of [
      ['icon-192x192.png', 192, false],
      ['icon-512x512.png', 512, false],
      ['apple-touch-icon.png', 180, false],
      ['icon-maskable.png', 512, true]
    ]) {
      const bytes = await p.evaluate(
        async ({ source, size, maskable }) => {
          const image = new Image();
          image.src = 'data:image/svg+xml,' + encodeURIComponent(source);
          await image.decode();
          const c = document.createElement('canvas');
          c.width = c.height = size;
          const ctx = c.getContext('2d');
          if (maskable || size === 180) {
            ctx.fillStyle = '#C8F03C';
            ctx.fillRect(0, 0, size, size);
          }
          const inset = maskable ? size * 0.1 : 0;
          ctx.drawImage(image, inset, inset, size - inset * 2, size - inset * 2);
          return c.toDataURL('image/png').split(',')[1];
        },
        { source, size, maskable }
      );
      fs.writeFileSync('icons/' + name, Buffer.from(bytes, 'base64'));
    }
    for (const size of [192, 512])
      fs.copyFileSync(`icons/icon-${size}x${size}.png`, `icons/app-${size}.png`);
    console.log('Icônes générées depuis le favicon SVG exact');
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
