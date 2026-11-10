const { migrationFile } = require('./migration-file.cjs');
// Recette SQL isolée : aucun accès à la production.
const { PGlite } = require('@electric-sql/pglite'),
  fs = require('node:fs'),
  assert = require('node:assert/strict');
const definition = (version, name) => {
  const sql = fs.readFileSync(migrationFile(version), 'utf8'),
    start = sql.indexOf(`create or replace function public.${name}(`),
    end = sql.indexOf('$$;', start) + 3;
  assert.ok(start >= 0 && end > start);
  return sql.slice(start, end);
};
(async () => {
  const db = new PGlite();
  await db.exec(
    `create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,email_confirmed_at timestamptz);create table profiles(user_id uuid primary key,nickname text,avatar text,avatar_config jsonb);create table inventories(user_id uuid,item_id text);create table player_unlocks(user_id uuid,item text);`
  );
  for (const [v, name] of [
    [4, 'pseudo_valide'],
    [4, 'pseudo_libre'],
    [17, 'avatar_int'],
    [17, 'avatar_slot'],
    [22, 'avatar_config_valid'],
    [17, 'avatar_item_ids'],
    [17, 'avatar_unlock_id'],
    [17, 'profiles_check_avatar']
  ])
    await db.exec(definition(v, name));
  await db.exec(
    `create trigger profiles_check_avatar before insert or update of avatar_config on profiles for each row execute function profiles_check_avatar();`
  );
  const migration = fs.readFileSync('supabase/migrations/20261110000042_legacy_v42.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(
    `create trigger creer_profil_inscription after insert on auth.users for each row execute function creer_profil_inscription();`
  );
  const { defaultAvatar } = await import('../avatar-config.js'),
    chosen = {
      ...defaultAvatar(),
      skin: 4,
      hair: 5,
      kit: { item: 'start-blue', name: 'VICTOR', number: 47 },
      rev: 42
    };
  let n = 0;
  const signup = async (meta) => {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [
        id,
        JSON.stringify(meta)
      ]);
      return id;
    },
    profile = async (id) =>
      (await db.query('select * from profiles where user_id=$1', [id])).rows[0];
  const id = await signup({ username: 'Victor', avatar2: chosen });
  assert.deepEqual((await profile(id)).avatar_config, { ...chosen, rev: 0 });
  assert.equal((await profile(id)).avatar, 'blue');
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id]);
  assert.deepEqual((await profile(id)).avatar_config, { ...chosen, rev: 0 });
  await db.query('update profiles set avatar_config=$2 where user_id=$1', [
    id,
    JSON.stringify({ ...chosen, hair: 8 })
  ]);
  await db.query('update auth.users set email_confirmed_at=now() where id=$1', [id]);
  assert.equal((await profile(id)).avatar_config.hair, 8);
  for (const avatar2 of [
    null,
    { v: 2 },
    'invalid',
    { ...chosen, kit: { ...chosen.kit, item: 'kit-gold' } },
    { ...chosen, accessories: ['acc-crown'] },
    { ...chosen, hairColor: 8 }
  ]) {
    const uid = await signup({ avatar2 });
    assert.equal((await profile(uid)).avatar_config.avatar, 'lime');
  }
  assert.equal((await profile(await signup({}))).avatar, 'lime');
  await db.close();
  console.log(
    'OK SQL : personnalisation, confirmation, reconnexion par profil, défaut, métadonnées invalides, objets verrouillés, migration réexécutable.'
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
