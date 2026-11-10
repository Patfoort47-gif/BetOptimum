-- Extension V7 : défi du jour (BET-54).
-- À exécuter dans le SQL Editor Supabase après supabase-v6-schema.sql. Réexécutable.
-- 4 matchs imposés à tous chaque jour (heure de Paris), pronostic 1N2 gratuit (aucune mise), réglé avec les autres paris :
-- (cote - 1) × 10 si le prono est bon, -10 sinon, 0 si annulé. Un match non joué vaut 0.
do $$ begin
  if to_regclass('public.league_entries') is null then
    raise exception 'Exécutez d''abord supabase-v6-schema.sql.';
  end if;
end $$;

-- Sélection du jour, figée par le pipeline : picks = [{matchId, league, home, away, kickoff, odds:{home,draw,away}, bookmakers}].
create table if not exists public.daily_challenges (
  day date primary key,
  picks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.daily_challenges enable row level security;
drop policy if exists "Daily challenges are readable" on public.daily_challenges;
create policy "Daily challenges are readable" on public.daily_challenges for select using (true);
revoke all on table public.daily_challenges from anon, authenticated;
grant select on table public.daily_challenges to anon, authenticated;

create table if not exists public.daily_picks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  match_id text not null,
  pick text not null check (pick in ('home','draw','away')),
  odd numeric(8,2) not null check (odd > 1),
  placed_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','won','lost','void')),
  points numeric(10,2) not null default 0,
  settled_at timestamptz,
  unique (user_id, match_id)
);
create index if not exists daily_picks_user_day_idx on public.daily_picks (user_id, day);
create index if not exists daily_picks_pending_idx on public.daily_picks (status) where status = 'pending';
alter table public.daily_picks enable row level security;
drop policy if exists "Players read their daily picks" on public.daily_picks;
create policy "Players read their daily picks" on public.daily_picks for select using (auth.uid() = user_id);
revoke all on table public.daily_picks from anon, authenticated;
grant select on table public.daily_picks to authenticated;

-- Les points du défi alimentent la ligue générale : league_entries peut désormais pointer un pari ou un prono du défi.
alter table public.league_entries alter column bet_id drop not null;
alter table public.league_entries add column if not exists daily_pick_id bigint references public.daily_picks(id) on delete cascade;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'league_entries_source_check') then
    alter table public.league_entries add constraint league_entries_source_check check ((bet_id is not null) <> (daily_pick_id is not null));
  end if;
end $$;
create unique index if not exists league_entries_daily_key on public.league_entries (daily_pick_id, league) where daily_pick_id is not null;

-- Prono du défi : avant le coup d'envoi seulement, cote figée du défi, modifiable jusqu'au coup d'envoi.
create or replace function public.play_daily_pick(p_match_id text, p_pick text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ch public.daily_challenges; item jsonb; fx public.fixtures; row public.daily_picks;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_pick is null or p_pick not in ('home','draw','away') then raise exception 'SELECTIONS_INVALIDES'; end if;
  select * into ch from public.daily_challenges c where c.picks @> jsonb_build_array(jsonb_build_object('matchId', p_match_id)) order by day desc limit 1;
  if not found then raise exception 'DEFI_INCONNU'; end if;
  select p into item from jsonb_array_elements(ch.picks) p where p->>'matchId' = p_match_id;
  select * into fx from public.fixtures where id = p_match_id;
  if not found then raise exception 'MATCH_INCONNU: %', p_match_id; end if;
  if fx.completed or fx.voided or fx.kickoff <= now() then raise exception 'MATCH_COMMENCE: %', p_match_id; end if;
  insert into public.daily_picks (user_id, day, match_id, pick, odd)
  values (uid, ch.day, p_match_id, p_pick, (item->'odds'->>p_pick)::numeric)
  on conflict (user_id, match_id) do update set pick = excluded.pick, odd = excluded.odd, placed_at = now()
  where public.daily_picks.status = 'pending'
  returning * into row;
  return to_jsonb(row);
end $$;
revoke all on function public.play_daily_pick(text, text) from public, anon;
grant execute on function public.play_daily_pick(text, text) to authenticated;

-- Règlement (service_role seulement, idempotent) : crédite les points dans la ligue générale.
create or replace function public.settle_daily_pick(p_id bigint, p_status text, p_points numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare d public.daily_picks;
begin
  if p_status not in ('won','lost','void') then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.daily_picks set status = p_status, points = case when p_status = 'void' then 0 else round(coalesce(p_points, 0), 2) end, settled_at = now()
  where id = p_id and status = 'pending' returning * into d;
  if d.id is null then return false; end if;
  insert into public.league_entries (daily_pick_id, user_id, league, points, week_start, season, settled_at)
  values (d.id, d.user_id, 'general', d.points, date_trunc('week', d.placed_at at time zone 'Europe/Paris')::date,
          to_char(now() at time zone 'Europe/Paris', 'YYYY-MM'), now())
  on conflict do nothing;
  return true;
end $$;
revoke all on function public.settle_daily_pick(bigint, text, numeric) from public, anon, authenticated;
grant execute on function public.settle_daily_pick(bigint, text, numeric) to service_role;

-- Participation et bons pronos par mois : règle de classement (au moins 50 % des défis du mois) et départage.
create or replace view public.daily_participation as
select m.user_id, m.season, m.played, m.good, coalesce(o.offered, 0) as offered
from (select user_id, to_char(day, 'YYYY-MM') as season, count(*) as played, count(*) filter (where status = 'won') as good
      from public.daily_picks group by user_id, to_char(day, 'YYYY-MM')) m
left join (select to_char(day, 'YYYY-MM') as season, sum(jsonb_array_length(picks)) as offered
           from public.daily_challenges group by to_char(day, 'YYYY-MM')) o on o.season = m.season;
revoke all on table public.daily_participation from anon, authenticated;
