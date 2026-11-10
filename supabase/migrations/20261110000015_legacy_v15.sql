-- Extension V15 : hub communauté, suivis, fil d'activité et hall of fame (BET-60).
-- À exécuter dans le SQL Editor Supabase après supabase-v14-schema.sql. Réexécutable.
-- Abonnements et fil d'activité sont publics ; un profil privé n'apparaît ni dans le fil ni dans les suggestions.
-- Le fil n'affiche jamais la bankroll ni les montants misés : il est alimenté par le serveur (scripts/activity-engine.mjs).
do $$ begin
  if to_regclass('public.private_leagues') is null then
    raise exception 'Exécutez d''abord supabase-v14-schema.sql.';
  end if;
end $$;

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows (followed_id);
alter table public.follows enable row level security;
drop policy if exists "Players read their follows" on public.follows;
create policy "Players read their follows" on public.follows for select using (auth.uid() = follower_id);
revoke all on table public.follows from anon, authenticated;
grant select on table public.follows to authenticated;

-- Abonnés par joueur (public) et suivre / ne plus suivre par RPC : 200 suivis au plus, profil public requis.
create or replace view public.public_follow_counts as select followed_id as user_id, count(*)::int as followers from public.follows group by followed_id;
grant select on table public.public_follow_counts to anon, authenticated;
create or replace function public.follow_player(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_user = uid then raise exception 'SUIVI_IMPOSSIBLE'; end if;
  if not exists (select 1 from public.profiles where user_id = p_user and is_public) then raise exception 'PROFIL_PRIVE'; end if;
  if (select count(*) from public.follows where follower_id = uid) >= 200 then raise exception 'SUIVIS_MAX'; end if;
  insert into public.follows (follower_id, followed_id) values (uid, p_user) on conflict do nothing;
end $$;
create or replace function public.unfollow_player(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.follows where follower_id = auth.uid() and followed_id = p_user;
$$;
revoke all on function public.follow_player(uuid), public.unfollow_player(uuid) from public, anon;
grant execute on function public.follow_player(uuid), public.unfollow_player(uuid) to authenticated;

-- Fil d'activité : écrit uniquement par le serveur, lisible par les abonnés d'un joueur au profil public. Aucun montant dans payload.
create table if not exists public.activities (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null check (kind in ('combo-win','promotion','title','badge','level','private-join','overtake')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (actor_id, event_key)
);
create index if not exists activities_actor_idx on public.activities (actor_id, created_at desc);
alter table public.activities enable row level security;
drop policy if exists "Followers read activities" on public.activities;
create policy "Followers read activities" on public.activities for select using (
  exists (select 1 from public.follows f where f.follower_id = auth.uid() and f.followed_id = actor_id)
  and exists (select 1 from public.profiles p where p.user_id = actor_id and p.is_public)
);
revoke all on table public.activities from anon, authenticated;
grant select on table public.activities to authenticated;

-- Classements généraux de la saison en cours et de tous les temps, avec échelon et club de cœur pour les filtres (rang global calculé avant filtre).
create or replace view public.public_ranking_season as
select e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id,
       sum(e.points)::numeric(12,2) as points, count(*) as picks, count(*) filter (where e.points > 0) as wins,
       rank() over (order by sum(e.points) desc, count(*) filter (where e.points > 0) desc, e.user_id) as rank
from public.league_entries e join public.profiles p on p.user_id = e.user_id left join public.player_league pl on pl.user_id = e.user_id
where e.league = 'general' and e.season = to_char(now() at time zone 'Europe/Paris', 'YYYY-MM')
group by e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id;
create or replace view public.public_ranking_alltime as
select e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id,
       sum(e.points)::numeric(12,2) as points, count(*) as picks, count(*) filter (where e.points > 0) as wins,
       rank() over (order by sum(e.points) desc, count(*) filter (where e.points > 0) desc, e.user_id) as rank
from public.league_entries e join public.profiles p on p.user_id = e.user_id left join public.player_league pl on pl.user_id = e.user_id
where e.league = 'general'
group by e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id;
grant select on table public.public_ranking_season, public.public_ranking_alltime to anon, authenticated;

-- Hall of fame : champions du Master de chaque saison, champions des ligues spéciales, classement Fortune (jetons gagnés depuis l'inscription).
create or replace view public.hall_master_champions as
select r.season, r.user_id, p.nickname, p.avatar, p.avatar_config, r.points
from public.season_results r join public.profiles p on p.user_id = r.user_id
where r.from_echelon = 16 and r.group_rank = 1 and r.outcome <> 'INACTIF';
create or replace view public.hall_special_champions as
select t.league_id, l.name as league_name, t.season, t.user_id, p.nickname, p.avatar, p.avatar_config
from public.special_titles t join public.special_leagues l on l.id = t.league_id join public.profiles p on p.user_id = t.user_id
where t.kind = 'champion';
create or replace view public.hall_fortune as
select f.user_id, p.nickname, p.avatar, p.avatar_config, f.earned,
       rank() over (order by f.earned desc, f.user_id) as rank
from public.public_fortune f join public.profiles p on p.user_id = f.user_id;
grant select on table public.hall_master_champions, public.hall_special_champions, public.hall_fortune to anon, authenticated;
