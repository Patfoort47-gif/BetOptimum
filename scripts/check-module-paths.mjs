import { readFile, access, readdir } from 'node:fs/promises';
const root = new URL('../', import.meta.url),
  paths = JSON.parse(await readFile(new URL('config/module-paths.json', root), 'utf8'));
for (const [legacy, target] of Object.entries(paths)) {
  await access(new URL(target, root));
  const published = new URL('_site/' + target, root);
  try {
    await access(published);
  } catch {
    continue;
  }
  const alias = await readFile(new URL('_site/' + legacy, root), 'utf8');
  if (alias !== `export * from './${target}';\n`) throw Error('Alias public invalide : ' + legacy);
}
const remaining = (await readdir(root)).filter((name) => name.endsWith('.js'));
if (
  remaining.sort().join() !== ['app.js', 'notification-sw.js', 'theme-bootstrap.js'].sort().join()
)
  throw Error('Module non rangé à la racine');
console.log(Object.keys(paths).length + ' modules classés, alias publiés vérifiés.');
