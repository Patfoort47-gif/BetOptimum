import { readdir, readFile, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
const root = resolve(new URL('../', import.meta.url).pathname),
  files = [];
async function walk(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'vendor', '_site', 'work'].includes(entry.name)) continue;
    const name = resolve(path, entry.name);
    if (entry.isDirectory()) await walk(name);
    else if (name.endsWith('.md')) files.push(name);
  }
}
await walk(root);
const errors = [];
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const [, raw] of text.matchAll(/!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const path = raw.replace(/^<|>$/g, '').split('#')[0];
    if (!path || /^(?:[a-z]+:|\/\/)/i.test(path)) continue;
    try {
      await access(resolve(dirname(file), decodeURIComponent(path)));
    } catch {
      errors.push(relative(root, file) + ': ' + raw);
    }
  }
}
if (errors.length) throw Error('Liens internes manquants :\n' + errors.join('\n'));
console.log(files.length + ' documents : liens internes vérifiés.');
