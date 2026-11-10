const { readFileSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'supabase/migrations.json'), 'utf8'));
function migrationFile(version) {
  if (version === 44) return path.join(root, 'supabase/legacy/supabase-v44-schema.sql');
  const migration = manifest.migrations.find((m) =>
    m.file.endsWith(`_legacy_v${String(version).padStart(2, '0')}.sql`)
  );
  if (!migration) throw Error('Migration historique inconnue : ' + version);
  return path.join(root, 'supabase/migrations', migration.file);
}
module.exports = { migrationFile };
