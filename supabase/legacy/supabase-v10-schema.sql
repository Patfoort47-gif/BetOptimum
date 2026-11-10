-- Extension V10 : XP, niveaux, trophées et défis hebdomadaires (BET-57).
-- À exécuter dans le SQL Editor Supabase après supabase-v9-schema.sql. Réexécutable.
-- Les XP, trophées et résultats de défis sont écrits uniquement par scripts/xp-engine.mjs (clé service_role) :
-- le navigateur ne peut ni s'attribuer de l'XP, ni de trophée, ni modifier un score de défi.
do $$ begin
  if to_regclass('public.special_leagues') is null then
    raise exception 'Exécutez d''abord supabase-v9-schema.sql.';
  end if;
end $$;

-- Pari gagné sur un value bet (calculé au règlement avec le modèle du site), pour le trophée « Chasseur de value » et le défi du même nom.
alter table public.bets add column if not exists value_bet boolean not null default false;

-- Journal d'XP : un seul enregistrement par événement (clé unique par joueur). Rien pour les achats, les connexions et les pronos perdus.
create table if not exists public.xp_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  kind text not null,
  xp int not null check (xp > 0),
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);
create index if not exists xp_events_user_idx on public.xp_events (user_id, created_at desc);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge)
);

create table if not exists public.challenge_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null check (challenge_id in ('safe-week','value-hunter','perfect-five')),
  week_start date not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, challenge_id, week_start)
);
create table if not exists public.challenge_results (
  week_start date not null,
  challenge_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  score int not null,
  bets int not null,
  wins int not null,
  rank int not null,
  primary key (week_start, challenge_id, user_id)
);

alter table public.xp_events enable row level security;
alter table public.user_badges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.challenge_results enable row level security;
drop policy if exists "Players read their xp" on public.xp_events;
create policy "Players read their xp" on public.xp_events for select using (auth.uid() = user_id);
drop policy if exists "Badges are readable" on public.user_badges;
create policy "Badges are readable" on public.user_badges for select using (true);
drop policy if exists "Players read their challenge entries" on public.challenge_entries;
create policy "Players read their challenge entries" on public.challenge_entries for select using (auth.uid() = user_id);
drop policy if exists "Challenge results are readable" on public.challenge_results;
create policy "Challenge results are readable" on public.challenge_results for select using (true);
revoke all on table public.xp_events, public.user_badges, public.challenge_entries, public.challenge_results from anon, authenticated;
grant select on table public.xp_events, public.challenge_entries to authenticated;
grant select on table public.user_badges, public.challenge_results to anon, authenticated;

-- XP total par joueur (public : niveau et titre apparaissent dans les classements).
create or replace view public.public_xp as select user_id, sum(xp)::int as xp from public.xp_events group by user_id;
grant select on table public.public_xp to anon, authenticated;

-- Participation à un défi hebdomadaire (semaine de Paris en cours) ; réservée aux joueurs avec un compte de jeu.
create or replace function public.join_challenge(p_challenge text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_challenge not in ('safe-week','value-hunter','perfect-five') then raise exception 'DEFI_INCONNU'; end if;
  perform public.ensure_player_account();
  insert into public.challenge_entries (user_id, challenge_id, week_start)
  values (uid, p_challenge, date_trunc('week', now() at time zone 'Europe/Paris')::date) on conflict do nothing;
end $$;
create or replace function public.leave_challenge(p_challenge text)
returns void language sql security definer set search_path = public as $$
  delete from public.challenge_entries where user_id = auth.uid() and challenge_id = p_challenge and week_start = date_trunc('week', now() at time zone 'Europe/Paris')::date;
$$;
revoke all on function public.join_challenge(text), public.leave_challenge(text) from public, anon;
grant execute on function public.join_challenge(text), public.leave_challenge(text) to authenticated;

-- Marque les paris gagnés sur un value bet (service_role seulement).
create or replace function public.mark_value_bets(p_ids uuid[])
returns int language sql security definer set search_path = public as $$
  with done as (update public.bets set value_bet = true where id = any(p_ids) and status = 'won' returning 1) select count(*)::int from done;
$$;
revoke all on function public.mark_value_bets(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_value_bets(uuid[]) to service_role;
