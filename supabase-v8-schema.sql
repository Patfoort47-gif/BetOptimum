-- Extension V8 : ligue générale, 17 échelons, groupes, saisons mensuelles (BET-55).
-- À exécuter dans le SQL Editor Supabase après supabase-v7-schema.sql. Réexécutable.
-- Tout est écrit par scripts/close-season.mjs et scripts/sync-supabase.mjs (clé service_role) : le navigateur ne fait que lire.
do $$ begin
  if to_regclass('public.daily_picks') is null then
    raise exception 'Exécutez d''abord supabase-v7-schema.sql.';
  end if;
end $$;

create table if not exists public.league_seasons (
  season text primary key check (season ~ '^[0-9]{4}-[0-9]{2}$'),
  status text not null default 'open' check (status in ('open','closed')),
  started_at timestamptz not null default now(),
  closed_at timestamptz
);

-- Échelon courant de chaque joueur : null = saison de placement. echelon 0 = District III ... 14 = Élite I, 15 = Champions, 16 = Master.
create table if not exists public.player_league (
  user_id uuid primary key references auth.users(id) on delete cascade,
  echelon int check (echelon between 0 and 16),
  protected boolean not null default false,
  inactive boolean not null default false,
  joined_season text not null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_groups (
  id bigint generated always as identity primary key,
  season text not null references public.league_seasons(season),
  echelon int not null check (echelon between 0 and 16),
  label text not null,
  unique (season, echelon, label)
);

create table if not exists public.group_members (
  season text not null references public.league_seasons(season),
  group_id bigint references public.league_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (season, user_id)
);
create index if not exists group_members_group_idx on public.group_members (group_id);

create table if not exists public.standings (
  season text not null references public.league_seasons(season),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id bigint references public.league_groups(id) on delete cascade,
  points numeric(10,2) not null default 0,
  picks int not null default 0,
  wins int not null default 0,
  roi numeric(8,1) not null default 0,
  form text not null default '',
  daily_good int not null default 0,
  qualified boolean not null default true,
  rank int not null default 1,
  prev_rank int,
  snapshot_date date,
  updated_at timestamptz not null default now(),
  primary key (season, user_id)
);
create index if not exists standings_group_idx on public.standings (season, group_id, rank);

create table if not exists public.season_results (
  season text not null references public.league_seasons(season),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_echelon int,
  to_echelon int not null,
  outcome text not null check (outcome in ('PROMU','MAINTENU','RELEGUE','PLACE','INACTIF')),
  group_rank int,
  group_size int,
  points numeric(10,2) not null default 0,
  unlocks jsonb not null default '[]'::jsonb,
  seen boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (season, user_id)
);

-- Éléments d'avatar débloqués par une division (acquis même après une descente).
create table if not exists public.player_unlocks (
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  season text not null,
  primary key (user_id, item)
);

alter table public.league_seasons enable row level security;
alter table public.player_league enable row level security;
alter table public.league_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.standings enable row level security;
alter table public.season_results enable row level security;
alter table public.player_unlocks enable row level security;
drop policy if exists "League data is readable" on public.league_seasons;
create policy "League data is readable" on public.league_seasons for select using (true);
drop policy if exists "League data is readable" on public.player_league;
create policy "League data is readable" on public.player_league for select using (true);
drop policy if exists "League data is readable" on public.league_groups;
create policy "League data is readable" on public.league_groups for select using (true);
drop policy if exists "League data is readable" on public.group_members;
create policy "League data is readable" on public.group_members for select using (true);
drop policy if exists "League data is readable" on public.standings;
create policy "League data is readable" on public.standings for select using (true);
drop policy if exists "Players read their season results" on public.season_results;
create policy "Players read their season results" on public.season_results for select using (auth.uid() = user_id);
drop policy if exists "Players read their unlocks" on public.player_unlocks;
create policy "Players read their unlocks" on public.player_unlocks for select using (auth.uid() = user_id);
revoke all on table public.league_seasons, public.player_league, public.league_groups, public.group_members, public.standings, public.season_results, public.player_unlocks from anon, authenticated;
grant select on table public.league_seasons, public.player_league, public.league_groups, public.group_members, public.standings to anon, authenticated;
grant select on table public.season_results, public.player_unlocks to authenticated;

-- Tout nouveau compte de jeu entre dans la ligue en saison de placement.
create or replace function public.enrol_player_league()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.player_league (user_id, echelon, joined_season) values (new.user_id, null, to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'))
  on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function public.enrol_player_league() from public;
drop trigger if exists enrol_player_league on public.player_accounts;
create trigger enrol_player_league after insert on public.player_accounts for each row execute function public.enrol_player_league();
insert into public.player_league (user_id, echelon, joined_season)
select user_id, null, to_char(now() at time zone 'Europe/Paris', 'YYYY-MM') from public.player_accounts on conflict (user_id) do nothing;

-- Écran de fin de saison : affiché une seule fois (le joueur marque ses résultats comme vus).
create or replace function public.mark_season_seen(p_season text)
returns void language sql security definer set search_path = public as $$
  update public.season_results set seen = true where season = p_season and user_id = auth.uid();
$$;
revoke all on function public.mark_season_seen(text) from public, anon;
grant execute on function public.mark_season_seen(text) to authenticated;

-- Classement lisible par tous : une ligne par joueur de la saison avec pseudo, avatar, échelon et groupe.
create or replace view public.public_standings as
select s.season, s.group_id, g.echelon as group_echelon, g.label as group_label, pl.echelon as echelon, s.user_id, p.nickname, p.avatar, p.avatar_config,
       s.points, s.picks, s.wins, s.roi, s.form, s.daily_good, s.qualified, s.rank, s.prev_rank
from public.standings s
join public.profiles p on p.user_id = s.user_id
left join public.league_groups g on g.id = s.group_id
left join public.player_league pl on pl.user_id = s.user_id;
grant select on table public.public_standings to anon, authenticated;

-- Clôture atomique d'une saison (service_role seulement, idempotente : une saison déjà close est ignorée).
-- p_results : [{user_id, from_echelon, to_echelon, outcome, group_rank, group_size, points, unlocks:[], revoke:[], protected, inactive}]
-- p_groups : [{echelon, label, members:[user_id]}] pour la saison suivante.
create or replace function public.apply_season_close(p_season text, p_next text, p_results jsonb, p_groups jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare g jsonb; gid bigint; r jsonb; v_item text;
begin
  if coalesce((select status from public.league_seasons where season = p_season), 'open') = 'closed' then return false; end if;
  insert into public.league_seasons (season) values (p_season) on conflict (season) do nothing;
  insert into public.league_seasons (season) values (p_next) on conflict (season) do nothing;
  insert into public.season_results (season, user_id, from_echelon, to_echelon, outcome, group_rank, group_size, points, unlocks)
  select p_season, x.user_id, x.from_echelon, x.to_echelon, x.outcome, x.group_rank, x.group_size, coalesce(x.points, 0), coalesce(x.unlocks, '[]'::jsonb)
  from jsonb_to_recordset(p_results) as x(user_id uuid, from_echelon int, to_echelon int, outcome text, group_rank int, group_size int, points numeric, unlocks jsonb)
  on conflict (season, user_id) do nothing;
  update public.player_league pl set echelon = x.to_echelon, protected = coalesce(x.protected, false), inactive = coalesce(x.inactive, false), updated_at = now()
  from jsonb_to_recordset(p_results) as x(user_id uuid, to_echelon int, protected boolean, inactive boolean) where pl.user_id = x.user_id;
  for r in select * from jsonb_array_elements(p_results) loop
    for v_item in select jsonb_array_elements_text(coalesce(r->'unlocks', '[]'::jsonb)) loop
      insert into public.player_unlocks (user_id, item, season) values ((r->>'user_id')::uuid, v_item, p_season) on conflict do nothing;
    end loop;
    for v_item in select jsonb_array_elements_text(coalesce(r->'revoke', '[]'::jsonb)) loop
      delete from public.player_unlocks where user_id = (r->>'user_id')::uuid and public.player_unlocks.item = v_item;
    end loop;
  end loop;
  if not exists (select 1 from public.league_groups where season = p_next) then
    for g in select * from jsonb_array_elements(p_groups) loop
      insert into public.league_groups (season, echelon, label) values (p_next, (g->>'echelon')::int, g->>'label') returning id into gid;
      insert into public.group_members (season, group_id, user_id) select p_next, gid, m::uuid from jsonb_array_elements_text(g->'members') m on conflict do nothing;
    end loop;
  end if;
  update public.league_seasons set status = 'closed', closed_at = now() where season = p_season;
  return true;
end $$;
revoke all on function public.apply_season_close(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_season_close(text, text, jsonb, jsonb) to service_role;
