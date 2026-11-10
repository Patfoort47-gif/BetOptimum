// Produit seulement le SQL de reprise d’historique ; ne se connecte à aucune base.
import { readFile, writeFile } from 'node:fs/promises';
const target = process.argv[2];
if (!target) throw Error('Usage : node scripts/prepare-migration-baseline.mjs fichier.sql');
const { migrations } = JSON.parse(
  await readFile(new URL('../supabase/migrations.json', import.meta.url), 'utf8')
);
const values = migrations
  .map((m) => `('${m.version}','${m.file.slice(15, -4)}','${m.sha256}')`)
  .join(',\n');
const sql = `-- BET-313 : métadonnées seulement, après comparaison du schéma reconstruit.
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations(version text primary key,statements text[],name text);
create table if not exists supabase_migrations.betoptimum_checksums(version text primary key references supabase_migrations.schema_migrations(version),sha256 text not null);
revoke all on schema supabase_migrations from public,anon,authenticated;
revoke all on all tables in schema supabase_migrations from public,anon,authenticated;
create temporary table baseline_versions(version text,name text,sha256 text) on commit drop;
insert into baseline_versions values ${values};
do $$begin if exists(select 1 from supabase_migrations.schema_migrations m where not exists(select 1 from baseline_versions b where b.version=m.version)) then raise exception 'Historique distant inattendu';end if;end$$;
insert into supabase_migrations.schema_migrations(version,name,statements) select version,name,array[]::text[] from baseline_versions on conflict(version) do nothing;
insert into supabase_migrations.betoptimum_checksums(version,sha256) select version,sha256 from baseline_versions on conflict(version) do nothing;
do $$begin if exists(select 1 from supabase_migrations.betoptimum_checksums c join baseline_versions b using(version) where c.sha256<>b.sha256) then raise exception 'Empreinte distante différente';end if;end$$;
commit;
`;
await writeFile(target, sql);
console.log(
  'SQL de reprise généré : ' + migrations.length + ' versions, aucune migration rejouée.'
);
