-- Extension V12 : page « Rejoindre le club » (BET-46) : club de cœur public sur le profil.
-- À exécuter dans le SQL Editor Supabase après supabase-v11-schema.sql. Réexécutable.
-- La connexion Google se règle dans Authentication > Providers (voir SUPABASE_SETUP.md) : rien à créer ici.
do $$ begin
  if to_regclass('public.token_ledger') is null then
    raise exception 'Exécutez d''abord supabase-v11-schema.sql.';
  end if;
end $$;

alter table public.profiles add column if not exists heart_club_id text check (heart_club_id ~ '^[0-9]{1,8}$');
alter table public.profiles add column if not exists heart_club_name text check (char_length(heart_club_name) <= 40);
grant insert (heart_club_id, heart_club_name) on table public.profiles to authenticated;
grant update (heart_club_id, heart_club_name) on table public.profiles to authenticated;

-- Profils publics : mêmes colonnes qu'en V5, club de cœur ajouté à la fin.
create or replace view public.public_profiles as
select p.user_id, p.nickname, p.avatar, p.avatar_config, p.challenge_stats, p.updated_at,
  coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0)) as metrics,
  jsonb_build_object('day', coalesce(s.day, public.stats_obj(0, 0, 0, 0, 0)), 'week', coalesce(s.week, public.stats_obj(0, 0, 0, 0, 0)),
    'month', coalesce(s.month, public.stats_obj(0, 0, 0, 0, 0)), 'season', coalesce(s.season, public.stats_obj(0, 0, 0, 0, 0)),
    'all', coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0))) as period_stats,
  p.heart_club_id, p.heart_club_name
from public.profiles p left join public.public_player_stats s on s.user_id = p.user_id;
grant select on table public.public_profiles to anon, authenticated;
