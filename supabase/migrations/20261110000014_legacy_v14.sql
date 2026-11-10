-- Extension V14 : ligues privées entre amis (BET-61).
-- À exécuter dans le SQL Editor Supabase après supabase-v13-schema.sql. Réexécutable.
-- 5 ligues privées au plus par joueur, 50 membres au plus par ligue, code d'invitation BM-XXXX. Elles ne prennent pas d'emplacement de ligue spéciale.
-- Le classement reprend les points de la ligue générale (mêmes pronos, aucun prono en plus). Ligue et classement visibles des seuls membres.
do $$ begin
  if to_regclass('public.public_season_results') is null then
    raise exception 'Exécutez d''abord supabase-v13-schema.sql.';
  end if;
end $$;

create table if not exists public.private_leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 30),
  emblem text not null check (emblem in ('ball','trophy','star','bolt','shield','flame','crown','target','rocket','lion','eagle','wolf')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^BM-[A-HJ-NP-Z2-9]{4}$'),
  created_at timestamptz not null default now()
);
create table if not exists public.private_league_members (
  league_id uuid not null references public.private_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists private_league_members_user_idx on public.private_league_members (user_id);

alter table public.private_leagues enable row level security;
alter table public.private_league_members enable row level security;
-- Un joueur lit uniquement les ligues dont il est membre et la liste de leurs membres (fonction security definer : évite la récursion de politique).
create or replace function public.is_private_member(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.private_league_members where league_id = p_league and user_id = auth.uid())
$$;
revoke all on function public.is_private_member(uuid) from public, anon;
grant execute on function public.is_private_member(uuid) to authenticated;
drop policy if exists "Members read their private leagues" on public.private_leagues;
create policy "Members read their private leagues" on public.private_leagues for select using (public.is_private_member(id));
drop policy if exists "Members read their league members" on public.private_league_members;
create policy "Members read their league members" on public.private_league_members for select using (public.is_private_member(league_id));
revoke all on table public.private_leagues, public.private_league_members from anon, authenticated;
grant select on table public.private_leagues, public.private_league_members to authenticated;

create or replace function public.private_league_code()
returns text language plpgsql volatile as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; candidate text; i int;
begin
  loop
    candidate := 'BM-';
    for i in 1..4 loop candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.private_leagues where code = candidate);
  end loop;
  return candidate;
end $$;
revoke all on function public.private_league_code() from public, anon, authenticated;

create or replace function public.create_private_league(p_name text, p_emblem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); league public.private_leagues;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 3 and 30 then raise exception 'NOM_INVALIDE'; end if;
  if (select count(*) from public.private_league_members where user_id = uid) >= 5 then raise exception 'LIGUES_PRIVEES_MAX'; end if;
  perform public.ensure_player_account();
  insert into public.private_leagues (name, emblem, owner_id, code) values (btrim(p_name), coalesce(p_emblem, 'ball'), uid, public.private_league_code()) returning * into league;
  insert into public.private_league_members (league_id, user_id) values (league.id, uid);
  return to_jsonb(league);
end $$;

create or replace function public.join_private_league(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); league public.private_leagues; clean text := upper(btrim(coalesce(p_code, '')));
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if clean ~ '^BM[A-HJ-NP-Z2-9]{4}$' then clean := 'BM-' || substr(clean, 3); end if;
  select * into league from public.private_leagues where code = clean;
  if not found then raise exception 'CODE_INVALIDE'; end if;
  if exists (select 1 from public.private_league_members where league_id = league.id and user_id = uid) then return to_jsonb(league); end if;
  if (select count(*) from public.private_league_members where user_id = uid) >= 5 then raise exception 'LIGUES_PRIVEES_MAX'; end if;
  if (select count(*) from public.private_league_members where league_id = league.id) >= 50 then raise exception 'LIGUE_PLEINE'; end if;
  perform public.ensure_player_account();
  insert into public.private_league_members (league_id, user_id) values (league.id, uid);
  return to_jsonb(league);
end $$;

-- Quitter : le propriétaire qui part transmet la ligue au plus ancien membre ; le dernier membre qui part supprime la ligue.
create or replace function public.leave_private_league(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); heir uuid;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.private_league_members where league_id = p_league and user_id = uid) then return; end if;
  delete from public.private_league_members where league_id = p_league and user_id = uid;
  select user_id into heir from public.private_league_members where league_id = p_league order by joined_at, user_id limit 1;
  if heir is null then delete from public.private_leagues where id = p_league;
  elsif exists (select 1 from public.private_leagues where id = p_league and owner_id = uid) then update public.private_leagues set owner_id = heir where id = p_league; end if;
end $$;

create or replace function public.kick_private_member(p_league uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.private_leagues where id = p_league and owner_id = auth.uid()) then raise exception 'PROPRIETAIRE_REQUIS'; end if;
  if p_user = auth.uid() then raise exception 'EXCLUSION_IMPOSSIBLE'; end if;
  delete from public.private_league_members where league_id = p_league and user_id = p_user;
end $$;

create or replace function public.regenerate_private_code(p_league uuid)
returns text language plpgsql security definer set search_path = public as $$
declare fresh text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.private_leagues where id = p_league and owner_id = auth.uid()) then raise exception 'PROPRIETAIRE_REQUIS'; end if;
  fresh := public.private_league_code();
  update public.private_leagues set code = fresh where id = p_league;
  return fresh;
end $$;

create or replace function public.delete_private_league(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.private_leagues where id = p_league and owner_id = auth.uid()) then raise exception 'PROPRIETAIRE_REQUIS'; end if;
  delete from public.private_leagues where id = p_league;
end $$;

-- Classement d'une saison (AAAA-MM, mois en cours par défaut) : points de la ligue générale des membres, mêmes pronos et même formule.
create or replace function public.private_league_ranking(p_league uuid, p_season text default null)
returns table (user_id uuid, nickname text, avatar text, avatar_config jsonb, points numeric, picks bigint, wins bigint, roi numeric, rank bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_season text := coalesce(p_season, to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'));
begin
  if not public.is_private_member(p_league) then raise exception 'MEMBRE_REQUIS'; end if;
  return query
  select r.user_id, r.nickname, r.avatar, r.avatar_config, r.points, r.picks, r.wins, r.roi, row_number() over (order by r.points desc, r.roi desc, r.wins desc, r.joined_at, r.user_id)
  from (
    select m.user_id, p.nickname, p.avatar, p.avatar_config, coalesce(sum(e.points), 0)::numeric as points, count(e.id) as picks, count(e.id) filter (where e.points > 0) as wins,
           case when count(e.id) > 0 then round(coalesce(sum(e.points), 0) / (count(e.id) * 10) * 100, 1) else 0 end as roi, m.joined_at
    from public.private_league_members m
    join public.profiles p on p.user_id = m.user_id
    left join public.league_entries e on e.user_id = m.user_id and e.league = 'general' and e.season = v_season
    where m.league_id = p_league
    group by m.user_id, p.nickname, p.avatar, p.avatar_config, m.joined_at
  ) r
  order by 9;
end $$;

-- Saisons disponibles pour l'historique : celles où au moins un membre a des points.
create or replace function public.private_league_seasons(p_league uuid)
returns setof text language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_private_member(p_league) then raise exception 'MEMBRE_REQUIS'; end if;
  return query select distinct e.season from public.league_entries e join public.private_league_members m on m.user_id = e.user_id and m.league_id = p_league where e.league = 'general' order by 1 desc;
end $$;

revoke all on function public.create_private_league(text, text), public.join_private_league(text), public.leave_private_league(uuid), public.kick_private_member(uuid, uuid), public.regenerate_private_code(uuid), public.delete_private_league(uuid), public.private_league_ranking(uuid, text), public.private_league_seasons(uuid) from public, anon;
grant execute on function public.create_private_league(text, text), public.join_private_league(text), public.leave_private_league(uuid), public.kick_private_member(uuid, uuid), public.regenerate_private_code(uuid), public.delete_private_league(uuid), public.private_league_ranking(uuid, text), public.private_league_seasons(uuid) to authenticated;
