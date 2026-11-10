-- Extension V6 : points de ligue et quota hebdomadaire de 10 paris libres (BET-53).
-- À exécuter dans le SQL Editor Supabase après supabase-v5-schema.sql. Réexécutable.
-- Règles : un ticket « compte en ligue » si le joueur le demande, s'il reste du quota sur la semaine de Paris
-- (lundi 00:00 au dimanche 23:59) et si aucun match du ticket n'a déjà servi à un ticket compté (un seul prono par match et par ligue).
-- Les systèmes ne comptent jamais. Les points sont calculés au règlement par scripts/sync-supabase.mjs (leaguePoints de model.js).
do $$ begin
  if to_regclass('public.bets') is null then
    raise exception 'Exécutez d''abord supabase-v5-schema.sql.';
  end if;
end $$;

alter table public.bets add column if not exists week_start date;
alter table public.bets add column if not exists league_note text check (league_note in ('QUOTA','MATCH_DEJA_COMPTE'));
update public.bets set week_start = date_trunc('week', placed_at at time zone 'Europe/Paris')::date where week_start is null;
create index if not exists bets_quota_idx on public.bets (user_id, week_start) where counts_general;

-- Décision prise à l'insertion, dans la transaction de place_bet (verrouillée par joueur) : la demande du navigateur
-- n'est qu'une préférence, le serveur applique quota et unicité par match.
create or replace function public.bets_prepare_league()
returns trigger language plpgsql security definer set search_path = public as $$
declare used int; ids text[];
begin
  new.week_start := date_trunc('week', new.placed_at at time zone 'Europe/Paris')::date;
  new.league_note := null;
  if new.bet_type = 'multiple' then new.counts_general := false; end if;
  if new.counts_general then
    select count(*) into used from public.bets where user_id = new.user_id and counts_general and week_start = new.week_start;
    ids := array(select s->>'matchId' from jsonb_array_elements(new.selections) s);
    if used >= 10 then
      new.counts_general := false; new.league_note := 'QUOTA';
    elsif exists (
      select 1 from public.bets b, jsonb_array_elements(b.selections) s
      where b.user_id = new.user_id and b.counts_general and (s->>'matchId') = any(ids)
    ) then
      new.counts_general := false; new.league_note := 'MATCH_DEJA_COMPTE';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.bets_prepare_league() from public;
drop trigger if exists bets_prepare_league on public.bets;
create trigger bets_prepare_league before insert on public.bets for each row execute function public.bets_prepare_league();

-- Points de ligue : une ligne par pari compté et par ligue, créée au règlement. season = mois civil de Paris du règlement.
create table if not exists public.league_entries (
  id bigint generated always as identity primary key,
  bet_id uuid not null references public.bets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  league text not null default 'general',
  points numeric(10,2) not null,
  week_start date not null,
  season text not null,
  settled_at timestamptz not null default now(),
  unique (bet_id, league)
);
create index if not exists league_entries_user_idx on public.league_entries (user_id, season);
create index if not exists league_entries_season_idx on public.league_entries (league, season);
alter table public.league_entries enable row level security;
drop policy if exists "Players read their league entries" on public.league_entries;
create policy "Players read their league entries" on public.league_entries for select using (auth.uid() = user_id);
revoke all on table public.league_entries from anon, authenticated;
grant select on table public.league_entries to authenticated;

-- Règlement : même fonction qu'en V5 avec les points de ligue calculés par le script (clé service_role seulement).
drop function if exists public.settle_bet(uuid, text, numeric);
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
  return true;
end $$;
revoke all on function public.settle_bet(uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.settle_bet(uuid, text, numeric, numeric) to service_role;
