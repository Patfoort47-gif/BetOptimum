import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const { migrations } = JSON.parse(
  await readFile(new URL('supabase/migrations.json', root), 'utf8')
);
const actual = (await readdir(new URL('supabase/migrations/', root)))
  .filter((name) => name.endsWith('.sql'))
  .sort();
if (
  actual.join('\n') !==
  migrations
    .map((m) => m.file)
    .sort()
    .join('\n')
)
  throw Error('Liste des migrations différente du manifeste');
const versions = new Set();
for (const migration of migrations) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(migration.file) || versions.has(migration.version))
    throw Error('Version de migration invalide');
  versions.add(migration.version);
  const data = await readFile(new URL('supabase/migrations/' + migration.file, root));
  if (createHash('sha256').update(data).digest('hex') !== migration.sha256)
    throw Error('Migration modifiée : ' + migration.file);
}
console.log(migrations.length + ' migrations horodatées, empreintes et versions vérifiées.');
