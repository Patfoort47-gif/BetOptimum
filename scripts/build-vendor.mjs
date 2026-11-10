// npm ci depuis les manifestes vendor/ copiés dans work/vendor-build, puis VENDOR_MODULES=.../node_modules node scripts/build-vendor.mjs
import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const modules = resolve(process.env.VENDOR_MODULES || 'work/vendor-build/node_modules'),
  { build } = await import(pathToFileURL(join(modules, 'esbuild/lib/main.js')));
await mkdir('vendor', { recursive: true });
await build({
  entryPoints: [join(modules, '@supabase/supabase-js/dist/module/index.js')],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'eof',
  outfile: 'vendor/supabase-js-2.81.1.js'
});
await copyFile(join(modules, 'three/build/three.module.min.js'), 'vendor/three-0.170.0.js');
const licenses = [];
for (const name of [
  '@supabase/supabase-js',
  '@supabase/auth-js',
  '@supabase/functions-js',
  '@supabase/postgrest-js',
  '@supabase/realtime-js',
  '@supabase/storage-js',
  '@supabase/phoenix',
  'iceberg-js',
  'tslib',
  'ws',
  'three'
]) {
  try {
    const pkg = JSON.parse(await readFile(join(modules, name, 'package.json'), 'utf8')),
      files = await readdir(join(modules, name)),
      license = files.find((f) => /^licen[cs]e(?:\.|$)/i.test(f));
    licenses.push({
      name,
      version: pkg.version,
      license: pkg.license,
      text: license ? await readFile(join(modules, name, license), 'utf8') : null
    });
  } catch {}
}
await writeFile('vendor/LICENSES.json', JSON.stringify(licenses, null, 2) + '\n');
const hashes = Object.fromEntries(
  await Promise.all(
    ['supabase-js-2.81.1.js', 'three-0.170.0.js'].map(async (name) => [
      name,
      createHash('sha256')
        .update(await readFile('vendor/' + name))
        .digest('hex')
    ])
  )
);
await writeFile('vendor/SHA256.json', JSON.stringify(hashes, null, 2) + '\n');
