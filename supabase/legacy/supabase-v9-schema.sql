-- Extension V9 : ligues spéciales, compétitions et clubs (BET-56).
-- À exécuter dans le SQL Editor Supabase après supabase-v8-schema.sql. Réexécutable.
-- Règles : 3 ligues spéciales au plus par joueur, une journée = 1 match phare imposé en 1N2 + 3 pronos libres (2 en élimination directe),
-- ligue club : 1N2 + 1 autre marché sur le match du club. Un seul prono par match et par ligue (hors ligue club).
-- Un ticket compte dans toutes les ligues concernées si toutes ses sélections les concernent ; la grille de journée est gratuite, sans mise.
do $$ begin
  if to_regclass('public.league_seasons') is null then
    raise exception 'Exécutez d''abord supabase-v8-schema.sql.';
  end if;
end $$;

create table if not exists public.special_leagues (
  id text primary key,
  kind text not null check (kind in ('competition','club')),
  name text not null,
  league_label text,
  team_id text,
  season_start date not null,
  season_end date not null,
  access text not null default 'free' check (access in ('free','premium')),
  token_price int not null default 0 check (token_price >= 0),
  difficulty numeric(4,2) not null default 1,
  open boolean not null default true,
  check ((kind = 'competition' and league_label is not null) or (kind = 'club' and team_id is not null))
);
-- Catalogue de lancement : liste extensible par simple insertion (team_id = identifiant ESPN de l'équipe, league_label = libellé de compétition du site).
insert into public.special_leagues (id, kind, name, league_label, team_id, season_start, season_end, difficulty, open) values
 ('ldc','competition','Ligue des champions','Ligue des champions',null,'2026-08-01','2027-06-30',1.5,true),
 ('liga','competition','Liga','La Liga',null,'2026-08-01','2027-06-30',1.25,true),
 ('l1','competition','Ligue 1','Ligue 1',null,'2026-08-01','2027-06-30',1.25,true),
 ('pl','competition','Premier League','Premier League',null,'2026-08-01','2027-06-30',1.25,true),
 ('cdm','competition','Coupe du monde','Coupe du monde',null,'2026-08-01','2027-06-30',2,false),
 ('club-83','club','FC Barcelone',null,'83','2026-08-01','2027-06-30',1,true),
 ('club-86','club','Real Madrid',null,'86','2026-08-01','2027-06-30',1,true),
 ('club-132','club','Bayern Munich',null,'132','2026-08-01','2027-06-30',1,true),
 ('club-160','club','Paris Saint-Germain',null,'160','2026-08-01','2027-06-30',1,true),
 ('club-176','club','Marseille',null,'176','2026-08-01','2027-06-30',1,true),
 ('club-382','club','Manchester City',null,'382','2026-08-01','2027-06-30',1,true),
 ('club-364','club','Liverpool',null,'364','2026-08-01','2027-06-30',1,true),
 ('club-359','club','Arsenal',null,'359','2026-08-01','2027-06-30',1,true),
 ('club-111','club','Juventus',null,'111','2026-08-01','2027-06-30',1,true),
 ('club-110','club','Inter',null,'110','2026-08-01','2027-06-30',1,true),
 ('club-103','club','Milan',null,'103','2026-08-01','2027-06-30',1,true),
 ('club-124','club','Borussia Dortmund',null,'124','2026-08-01','2027-06-30',1,true)
on conflict (id) do nothing;

create table if not exists public.league_members (
  league_id text not null references public.special_leagues(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on public.league_members (user_id);
create table if not exists public.league_leaves (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  left_at timestamptz not null default now()
);
create index if not exists league_leaves_user_idx on public.league_leaves (user_id, left_at);

-- Journées, calculées par le pipeline (scripts/sync-supabase.mjs, planRounds de special.js).
create table if not exists public.special_rounds (
  id text primary key,
  league_id text not null references public.special_leagues(id),
  label text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  match_ids jsonb not null,
  anchor text not null,
  knockout boolean not null default false,
  free_slots int not null check (free_slots between 1 and 3)
);
create index if not exists special_rounds_league_idx on public.special_rounds (league_id, starts_at);

create table if not exists public.special_picks (
  id bigint generated always as identity primary key,
  league_id text not null references public.special_leagues(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_id text not null references public.special_rounds(id) on delete cascade,
  match_ids text[] not null,
  kind text not null check (kind in ('anchor','free')),
  source text not null check (source in ('grid','bet')),
  bet_id uuid references public.bets(id) on delete cascade,
  key text,
  odd numeric(10,4) not null check (odd > 1),
  status text not null default 'pending' check (status in ('pending','won','lost','void')),
  points numeric(10,2) not null default 0,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);
create unique index if not exists special_picks_bet_key on public.special_picks (bet_id, league_id) where bet_id is not null;
create index if not exists special_picks_user_idx on public.special_picks (user_id, league_id, round_id);
create index if not exists special_picks_pending_idx on public.special_picks (status) where status = 'pending';

create table if not exists public.special_standings (
  league_id text not null references public.special_leagues(id),
  scope text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  points numeric(10,2) not null default 0,
  picks int not null default 0,
  wins int not null default 0,
  roi numeric(8,1) not null default 0,
  rank int not null,
  played_rounds int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (league_id, scope, user_id)
);
create table if not exists public.special_titles (
  league_id text not null references public.special_leagues(id),
  season text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('champion','top1','top10')),
  awarded_at timestamptz not null default now(),
  primary key (league_id, season, user_id, kind)
);

alter table public.special_leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_leaves enable row level security;
alter table public.special_rounds enable row level security;
alter table public.special_picks enable row level security;
alter table public.special_standings enable row level security;
alter table public.special_titles enable row level security;
drop policy if exists "Special data is readable" on public.special_leagues;
create policy "Special data is readable" on public.special_leagues for select using (true);
drop policy if exists "Special data is readable" on public.league_members;
create policy "Special data is readable" on public.league_members for select using (true);
drop policy if exists "Special data is readable" on public.special_rounds;
create policy "Special data is readable" on public.special_rounds for select using (true);
drop policy if exists "Special data is readable" on public.special_standings;
create policy "Special data is readable" on public.special_standings for select using (true);
drop policy if exists "Special data is readable" on public.special_titles;
create policy "Special data is readable" on public.special_titles for select using (true);
drop policy if exists "Players read their special picks" on public.special_picks;
create policy "Players read their special picks" on public.special_picks for select using (auth.uid() = user_id);
drop policy if exists "Players read their leaves" on public.league_leaves;
create policy "Players read their leaves" on public.league_leaves for select using (auth.uid() = user_id);
revoke all on table public.special_leagues, public.league_members, public.league_leaves, public.special_rounds, public.special_picks, public.special_standings, public.special_titles from anon, authenticated;
grant select on table public.special_leagues, public.league_members, public.special_rounds, public.special_standings, public.special_titles to anon, authenticated;
grant select on table public.special_picks, public.league_leaves to authenticated;

-- Décision d'un prono dans une ligue (règles de special.js). Renvoie null si le prono est compté, sinon le motif.
create or replace function public.special_try_pick(p_user uuid, p_league text, p_selections jsonb, p_source text, p_bet uuid, p_odd numeric)
returns text language plpgsql security definer set search_path = public as $$
declare lg public.special_leagues; rnd public.special_rounds; ids text[]; n int := jsonb_array_length(p_selections); k text; anchor_taken boolean; free_used int; pick_kind text;
begin
  select * into lg from public.special_leagues where id = p_league and open;
  if not found then return 'LIGUE_FERMEE'; end if;
  if not exists (select 1 from public.league_members where league_id = p_league and user_id = p_user) then return 'NON_INSCRIT'; end if;
  ids := array(select s->>'matchId' from jsonb_array_elements(p_selections) s);
  select * into rnd from public.special_rounds where league_id = p_league and match_ids @> to_jsonb(ids[1]) order by starts_at limit 1;
  if not found then return 'HORS_LIGUE'; end if;
  if exists (select 1 from unnest(ids) m where not (rnd.match_ids @> to_jsonb(m))) then return 'HORS_LIGUE'; end if;
  if lg.kind <> 'club' and exists (select 1 from public.special_picks where league_id = p_league and user_id = p_user and match_ids && ids) then return 'MATCH_DEJA_COMPTE'; end if;
  k := p_selections->0->>'key';
  select exists (select 1 from public.special_picks where league_id = p_league and user_id = p_user and round_id = rnd.id and kind = 'anchor') into anchor_taken;
  select count(*) into free_used from public.special_picks where league_id = p_league and user_id = p_user and round_id = rnd.id and kind = 'free';
  if n = 1 and ids[1] = rnd.anchor and k in ('home','draw','away') and not anchor_taken then
    pick_kind := 'anchor';
  else
    if lg.kind = 'club' then
      if n <> 1 then return 'CLUB_SIMPLE_SEULEMENT'; end if;
      if k in ('home','draw','away') then return 'QUOTA_JOURNEE'; end if;
    end if;
    if free_used >= rnd.free_slots then return 'QUOTA_JOURNEE'; end if;
    pick_kind := 'free';
  end if;
  insert into public.special_picks (league_id, user_id, round_id, match_ids, kind, source, bet_id, key, odd)
  values (p_league, p_user, rnd.id, ids, pick_kind, p_source, p_bet, case when n = 1 then k end, p_odd);
  return null;
end $$;
revoke all on function public.special_try_pick(uuid, text, jsonb, text, uuid, numeric) from public, anon, authenticated;

-- Un ticket (simple ou combiné) compte dans chaque ligue spéciale du joueur dont il respecte les règles.
create or replace function public.bets_attach_special()
returns trigger language plpgsql security definer set search_path = public as $$
declare lm record;
begin
  if new.bet_type = 'multiple' then return new; end if;
  for lm in select league_id from public.league_members where user_id = new.user_id loop
    perform public.special_try_pick(new.user_id, lm.league_id, new.selections, 'bet', new.id, new.odds);
  end loop;
  return new;
end $$;
revoke all on function public.bets_attach_special() from public;
drop trigger if exists bets_attach_special on public.bets;
create trigger bets_attach_special after insert on public.bets for each row execute function public.bets_attach_special();

create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.special_leagues where id = p_league and open) then raise exception 'LIGUE_FERMEE'; end if;
  perform public.ensure_player_account();
  if exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then return jsonb_build_object('joined', true); end if;
  if (select count(*) from public.league_members where user_id = uid) >= 3 then raise exception 'LIGUES_MAX'; end if;
  insert into public.league_members (league_id, user_id) values (p_league, uid);
  return jsonb_build_object('joined', true);
end $$;

-- Quitter une ligue fait perdre ses points (pronos supprimés) ; un seul changement par mois (heure de Paris).
create or replace function public.leave_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then return jsonb_build_object('joined', false); end if;
  if exists (select 1 from public.league_leaves where user_id = uid and to_char(left_at at time zone 'Europe/Paris', 'YYYY-MM') = to_char(now() at time zone 'Europe/Paris', 'YYYY-MM')) then raise exception 'CHANGEMENT_MENSUEL'; end if;
  delete from public.special_picks where league_id = p_league and user_id = uid;
  delete from public.special_standings where league_id = p_league and user_id = uid;
  delete from public.league_members where league_id = p_league and user_id = uid;
  insert into public.league_leaves (user_id, league_id) values (uid, p_league);
  return jsonb_build_object('joined', false);
end $$;

-- Grille de la journée : prono gratuit, sans mise, avant le coup d'envoi ; remplace le prono précédent sur ce match.
create or replace function public.play_special_pick(p_league text, p_match text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); fx public.fixtures; odd numeric; reason text; picked public.special_picks;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_key is null or p_key not in ('home','draw','away','over','btts') then raise exception 'SELECTIONS_INVALIDES'; end if;
  select * into fx from public.fixtures where id = p_match;
  if not found then raise exception 'MATCH_INCONNU: %', p_match; end if;
  if fx.completed or fx.voided or fx.kickoff <= now() then raise exception 'MATCH_COMMENCE: %', p_match; end if;
  odd := nullif(fx.odds->>p_key, '')::numeric;
  if odd is null or odd <= 1 then raise exception 'MARCHE_INDISPONIBLE: %', p_match; end if;
  -- Remplace le prono de grille précédent sur ce match (en ligue club : celui du même type, 1N2 ou autre marché).
  delete from public.special_picks where user_id = uid and league_id = p_league and source = 'grid' and status = 'pending' and match_ids = array[p_match]
    and ((select kind from public.special_leagues where id = p_league) <> 'club' or (key in ('home','draw','away')) = (p_key in ('home','draw','away')));
  reason := public.special_try_pick(uid, p_league, jsonb_build_array(jsonb_build_object('matchId', p_match, 'key', p_key, 'odd', odd)), 'grid', null, odd);
  if reason is not null then raise exception 'SPECIAL_%', reason; end if;
  select * into picked from public.special_picks where user_id = uid and league_id = p_league and source = 'grid' and match_ids = array[p_match] and key = p_key and status = 'pending' order by id desc limit 1;
  return to_jsonb(picked);
end $$;

-- Retire un prono de la grille avant le coup d'envoi.
create or replace function public.clear_special_pick(p_league text, p_match text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists (select 1 from public.fixtures where id = p_match and (kickoff <= now() or completed)) then raise exception 'MATCH_COMMENCE: %', p_match; end if;
  delete from public.special_picks where user_id = auth.uid() and league_id = p_league and source = 'grid' and status = 'pending' and match_ids = array[p_match];
end $$;

-- Règlement des pronos de grille (service_role seulement, idempotent).
create or replace function public.settle_special_pick(p_id bigint, p_status text, p_points numeric)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('won','lost','void') then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else round(coalesce(p_points, 0), 2) end, settled_at = now()
  where id = p_id and status = 'pending' and source = 'grid';
  return found;
end $$;

-- Règlement d'un ticket : même fonction qu'en V6, les pronos de ligue spéciale issus du ticket suivent son résultat.
create or replace function public.settle_bet(p_bet_id uuid, p_status text, p_payout numeric, p_points numeric default 0)
returns boolean language plpgsql security definer set search_path = public as $$
declare b public.bets; paid numeric := round(coalesce(p_payout, 0), 2);
begin
  if p_status not in ('won','lost','void') or paid < 0 then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.bets set status = p_status, payout = case when p_status = 'lost' then 0 else paid end, settled_at = now()
  where id = p_bet_id and status = 'pending' returning * into b;
  if b.id is null then return false; end if;
  if p_status <> 'lost' then
    update public.player_accounts set bankroll = bankroll + paid, updated_at = now() where user_id = b.user_id;
  end if;
  if b.counts_general then
    insert into public.league_entries (bet_id, user_id, league, points, week_start, season, settled_at)
    values (b.id, b.user_id, 'general', round(coalesce(p_points, 0), 2), b.week_start, to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'), now())
    on conflict (bet_id, league) do nothing;
  end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else round(coalesce(p_points, 0), 2) end, settled_at = now()
  where bet_id = b.id and status = 'pending';
  return true;
end $$;

revoke all on function public.join_special_league(text), public.leave_special_league(text), public.play_special_pick(text, text, text), public.clear_special_pick(text, text) from public, anon;
grant execute on function public.join_special_league(text), public.leave_special_league(text), public.play_special_pick(text, text, text), public.clear_special_pick(text, text) to authenticated;
revoke all on function public.settle_special_pick(bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.settle_special_pick(bigint, text, numeric) to service_role;
revoke all on function public.settle_bet(uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.settle_bet(uuid, text, numeric, numeric) to service_role;

-- Nombre de membres par ligue et classements publics.
create or replace view public.special_league_counts as select league_id, count(*)::int as members from public.league_members group by league_id;
grant select on table public.special_league_counts to anon, authenticated;
create or replace view public.public_special_standings as
select s.league_id, s.scope, s.user_id, p.nickname, p.avatar, p.avatar_config, s.points, s.picks, s.wins, s.roi, s.rank, s.played_rounds
from public.special_standings s join public.profiles p on p.user_id = s.user_id;
grant select on table public.public_special_standings to anon, authenticated;
