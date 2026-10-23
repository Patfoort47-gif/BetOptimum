-- Extension V5 : tickets certifiés (BET-52).
-- À exécuter dans le SQL Editor Supabase après supabase-v4-schema.sql. Réexécutable.
-- Les paris sont enregistrés et réglés côté serveur : le navigateur ne peut plus écrire ni bankroll, ni statut, ni statistique.
-- Écritures réservées aux fonctions ci-dessous (security definer) et à la clé service_role des workflows GitHub.
do $$ begin
  if to_regprocedure('public.pseudo_disponible(text)') is null then
    raise exception 'Exécutez d''abord supabase-v4-schema.sql.';
  end if;
end $$;

-- Matchs : alimentés par les scripts du pipeline (clé service_role), lisibles par tous.
create table if not exists public.fixtures (
  id text primary key,
  league text not null,
  round text,
  home text not null,
  away text not null,
  home_id text,
  away_id text,
  kickoff timestamptz not null,
  status text not null default 'Programmé',
  completed boolean not null default false,
  voided boolean not null default false,
  home_score int,
  away_score int,
  odds jsonb not null default '{}'::jsonb,
  odds_source jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff);
alter table public.fixtures enable row level security;
drop policy if exists "Fixtures are readable" on public.fixtures;
create policy "Fixtures are readable" on public.fixtures for select using (true);
revoke all on table public.fixtures from anon, authenticated;
grant select on table public.fixtures to anon, authenticated;

-- Compte de jeu : bankroll fictive et capital initial, modifiés uniquement par les fonctions du serveur.
create table if not exists public.player_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bankroll numeric(14,2) not null check (bankroll >= 0),
  initial numeric(14,2) not null check (initial >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.capital_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists capital_events_user_idx on public.capital_events (user_id, created_at desc);

-- Paris : sélections figées avec les cotes du serveur. status : pending, won, lost ou void (remboursé).
create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_ref uuid,
  placed_at timestamptz not null default now(),
  bet_type text not null check (bet_type in ('single','combined','multiple')),
  stake numeric(14,2) not null check (stake > 0),
  odds numeric(14,4) not null check (odds > 0),
  status text not null default 'pending' check (status in ('pending','won','lost','void')),
  payout numeric(14,2) not null default 0 check (payout >= 0),
  settled_at timestamptz,
  counts_general boolean not null default false,
  system_formula text,
  system_lines jsonb,
  selections jsonb not null,
  unique (user_id, client_ref)
);
create index if not exists bets_user_placed_idx on public.bets (user_id, placed_at desc);
create index if not exists bets_pending_idx on public.bets (status) where status = 'pending';
create index if not exists bets_user_settled_idx on public.bets (user_id, settled_at) where status in ('won','lost');

alter table public.player_accounts enable row level security;
alter table public.capital_events enable row level security;
alter table public.bets enable row level security;
drop policy if exists "Players read their account" on public.player_accounts;
create policy "Players read their account" on public.player_accounts for select using (auth.uid() = user_id);
drop policy if exists "Players read their capital events" on public.capital_events;
create policy "Players read their capital events" on public.capital_events for select using (auth.uid() = user_id);
drop policy if exists "Players read their bets" on public.bets;
create policy "Players read their bets" on public.bets for select using (auth.uid() = user_id);
revoke all on table public.player_accounts, public.capital_events, public.bets from anon, authenticated;
grant select on table public.player_accounts, public.capital_events, public.bets to authenticated;

-- Création du compte de jeu. La bankroll de l'ancien état est reprise une seule fois (bornée), les mises
-- des paris encore en attente avant la saison 1 sont restituées. Les anciens paris restent dans le navigateur.
create or replace function public.ensure_player_account()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); acct public.player_accounts; st jsonb; b numeric := 1000; i numeric := 1000; pending numeric := 0;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into acct from public.player_accounts where user_id = uid;
  if not found then
    select state into st from public.user_states where user_id = uid;
    if jsonb_typeof(st->'bankroll') = 'number' then b := (st->>'bankroll')::numeric; end if;
    if jsonb_typeof(st->'initial') = 'number' then i := (st->>'initial')::numeric; end if;
    if jsonb_typeof(st->'history') = 'array' then
      select coalesce(sum((h->>'stake')::numeric), 0) into pending
      from jsonb_array_elements(st->'history') h
      where h->>'status' = 'pending' and (h->>'stake') ~ '^[0-9]{1,9}(\.[0-9]{1,4})?$';
    end if;
    insert into public.player_accounts (user_id, bankroll, initial)
    values (uid, round(least(greatest(b + pending, 0), 100000), 2), round(least(greatest(i, 0), 100000), 2))
    on conflict (user_id) do nothing;
    select * into acct from public.player_accounts where user_id = uid;
  end if;
  return to_jsonb(acct);
end $$;

-- Apport de capital fictif.
create or replace function public.add_capital(p_amount numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); acct public.player_accounts; amount numeric := round(p_amount, 2);
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if amount is null or amount <= 0 or amount > 100000 then raise exception 'MONTANT_INVALIDE'; end if;
  perform public.ensure_player_account();
  update public.player_accounts set bankroll = bankroll + amount, updated_at = now() where user_id = uid returning * into acct;
  insert into public.capital_events (user_id, amount) values (uid, amount);
  return to_jsonb(acct);
end $$;

-- Lignes d'un pari système : tableau JSON d'index de sélections, d'après la formule (mêmes règles que systemLines de model.js).
create or replace function public.system_lines(p_count int, p_formula text)
returns jsonb language plpgsql immutable as $$
declare picks int[]; need int; mask int; bits int; k int; idx jsonb; lines jsonb := '[]'::jsonb; pick int;
begin
  need := case p_formula when 'trixie' then 3 when 'yankee' then 4 when '2of3' then 3 when '2of4' then 4 when '3of4' then 4 else null end;
  if (need is not null and p_count <> need) or p_count < 3 or p_count > 8 then return lines; end if;
  picks := case p_formula when 'trixie' then array[2,3] when 'yankee' then array[2,3,4] when '2of3' then array[2] when '2of4' then array[2] when '3of4' then array[3] else array[greatest(2, p_count - 1)] end;
  foreach pick in array picks loop
    for mask in 1..(1 << p_count) - 1 loop
      bits := 0; idx := '[]'::jsonb;
      for k in 0..p_count - 1 loop
        if (mask & (1 << k)) <> 0 then bits := bits + 1; idx := idx || to_jsonb(k); end if;
      end loop;
      if bits = pick then lines := lines || jsonb_build_array(idx); end if;
    end loop;
  end loop;
  return lines;
end $$;

-- Placement d'un pari. Contrôles : joueur connecté, aucun match commencé, cotes annoncées à 2 % près des cotes
-- stockées, mise positive et couverte par la bankroll. Débite la bankroll et renvoie le pari.
-- p_selections : [{"matchId":"espn-1","key":"home","odd":1.9}, ...]. Ré-appelable sans risque avec le même p_client_ref.
create or replace function public.place_bet(p_selections jsonb, p_stake numeric, p_counts_general boolean default false,
  p_bet_type text default 'combined', p_formula text default null, p_client_ref uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); acct public.player_accounts; bet public.bets; sel jsonb; fx public.fixtures;
  stake numeric := round(p_stake, 2); n int; k text; announced numeric; stored numeric; items jsonb := '[]'::jsonb;
  total numeric := 1; seen text[] := array[]::text[]; lines jsonb; line jsonb; leg int; line_count int; line_odds numeric; line_stake numeric;
  line_json jsonb := '[]'::jsonb; avg_odds numeric := 0; leg_label text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet_type not in ('single','combined','multiple') then raise exception 'TYPE_INVALIDE'; end if;
  if jsonb_typeof(p_selections) <> 'array' then raise exception 'SELECTIONS_INVALIDES'; end if;
  n := jsonb_array_length(p_selections);
  if n < 1 or n > 12 or (p_bet_type = 'single' and n <> 1) or (p_bet_type = 'combined' and n < 2) or (p_bet_type = 'multiple' and n < 3) then
    raise exception 'SELECTIONS_INVALIDES';
  end if;
  if stake is null or stake <= 0 or stake > 1000000 then raise exception 'MISE_INVALIDE'; end if;
  perform public.ensure_player_account();
  select * into acct from public.player_accounts where user_id = uid for update;
  if p_client_ref is not null then
    select * into bet from public.bets where user_id = uid and client_ref = p_client_ref;
    if found then return to_jsonb(bet); end if;
  end if;
  if stake > acct.bankroll then raise exception 'BANKROLL_INSUFFISANTE'; end if;

  for sel in select * from jsonb_array_elements(p_selections) loop
    k := sel->>'key';
    if k is null or k not in ('home','draw','away','over','btts') then raise exception 'SELECTIONS_INVALIDES'; end if;
    select * into fx from public.fixtures where id = sel->>'matchId';
    if not found then raise exception 'MATCH_INCONNU: %', coalesce(sel->>'matchId', ''); end if;
    if fx.completed or fx.voided or fx.kickoff <= now() then raise exception 'MATCH_COMMENCE: %', fx.id; end if;
    if fx.id = any(seen) then raise exception 'MATCH_EN_DOUBLE: %', fx.id; end if;
    seen := seen || fx.id;
    stored := nullif(fx.odds->>k, '')::numeric;
    if stored is null or stored <= 1 then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    begin announced := (sel->>'odd')::numeric; exception when others then announced := null; end;
    if announced is null or abs(announced - stored) / stored > 0.02 then raise exception 'COTE_CHANGEE: %', fx.id; end if;
    leg_label := case k when 'home' then fx.home when 'away' then fx.away when 'draw' then 'Match nul'
                        when 'over' then 'Plus de 2,5 buts' else 'Les deux marquent' end;
    items := items || jsonb_build_object('matchId', fx.id, 'key', k, 'label', leg_label, 'odd', stored,
      'home', fx.home, 'away', fx.away, 'match', fx.home || ' - ' || fx.away, 'league', fx.league,
      'kickoff', fx.kickoff, 'date', to_char(fx.kickoff at time zone 'Europe/Paris', 'YYYY-MM-DD'),
      'time', to_char(fx.kickoff at time zone 'Europe/Paris', 'HH24:MI'));
    total := total * stored;
  end loop;

  if p_bet_type = 'multiple' then
    lines := public.system_lines(n, coalesce(p_formula, 'auto'));
    line_count := jsonb_array_length(lines);
    if line_count = 0 then raise exception 'FORMULE_INVALIDE'; end if;
    line_stake := round(stake / line_count, 6);
    for line in select * from jsonb_array_elements(lines) loop
      line_odds := 1;
      for leg in select value::int from jsonb_array_elements_text(line) loop
        line_odds := line_odds * (items->leg->>'odd')::numeric;
      end loop;
      line_json := line_json || jsonb_build_object('indexes', line, 'odds', round(line_odds, 4), 'stake', line_stake);
      avg_odds := avg_odds + line_odds;
    end loop;
    total := avg_odds / line_count;
  end if;

  update public.player_accounts set bankroll = bankroll - stake, updated_at = now() where user_id = uid;
  insert into public.bets (user_id, client_ref, bet_type, stake, odds, counts_general, system_formula, system_lines, selections)
  values (uid, p_client_ref, p_bet_type, stake, round(total, 4), coalesce(p_counts_general, false) and p_bet_type <> 'multiple',
          case when p_bet_type = 'multiple' then coalesce(p_formula, 'auto') end,
          case when p_bet_type = 'multiple' then line_json end, items)
  returning * into bet;
  return to_jsonb(bet);
end $$;

-- Règlement d'un pari : réservé à la clé service_role. Idempotent : un pari déjà réglé n'est jamais crédité deux fois.
create or replace function public.settle_bet(p_bet_id uuid, p_status text, p_payout numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare owner uuid; paid numeric := round(coalesce(p_payout, 0), 2);
begin
  if p_status not in ('won','lost','void') or paid < 0 then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.bets set status = p_status, payout = case when p_status = 'lost' then 0 else paid end, settled_at = now()
  where id = p_bet_id and status = 'pending' returning user_id into owner;
  if owner is null then return false; end if;
  if p_status <> 'lost' then
    update public.player_accounts set bankroll = bankroll + paid, updated_at = now() where user_id = owner;
  end if;
  return true;
end $$;

revoke all on function public.ensure_player_account() from public, anon;
revoke all on function public.add_capital(numeric) from public, anon;
revoke all on function public.place_bet(jsonb, numeric, boolean, text, text, uuid) from public, anon;
revoke all on function public.settle_bet(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.system_lines(int, text) from public;
grant execute on function public.ensure_player_account() to authenticated;
grant execute on function public.add_capital(numeric) to authenticated;
grant execute on function public.place_bet(jsonb, numeric, boolean, text, text, uuid) to authenticated;
grant execute on function public.settle_bet(uuid, text, numeric) to service_role;
grant execute on function public.system_lines(int, text) to authenticated, service_role;

-- Statistiques publiques calculées depuis les paris réglés (le navigateur n'écrit plus aucune statistique).
-- Fenêtres glissantes : jour (24 h), semaine (7 j), mois (30 j) ; saison = mois civil de Paris ; all = depuis le début.
create or replace function public.stats_obj(p_bets bigint, p_wins bigint, p_staked numeric, p_returned numeric, p_best numeric)
returns jsonb language sql immutable as $$
  select jsonb_build_object('bets', coalesce(p_bets, 0), 'wins', coalesce(p_wins, 0),
    'roi', case when coalesce(p_staked, 0) > 0 then round((p_returned - p_staked) / p_staked * 100, 1) else 0 end,
    'bestOdd', coalesce(p_best, 0))
$$;

create or replace view public.public_player_stats as
select b.user_id,
  public.stats_obj(count(*) filter (where b.settled_at >= now() - interval '1 day'), count(*) filter (where b.settled_at >= now() - interval '1 day' and b.status = 'won'),
    sum(b.stake) filter (where b.settled_at >= now() - interval '1 day'), sum(b.payout) filter (where b.settled_at >= now() - interval '1 day'),
    max(b.odds) filter (where b.settled_at >= now() - interval '1 day' and b.status = 'won')) as day,
  public.stats_obj(count(*) filter (where b.settled_at >= now() - interval '7 days'), count(*) filter (where b.settled_at >= now() - interval '7 days' and b.status = 'won'),
    sum(b.stake) filter (where b.settled_at >= now() - interval '7 days'), sum(b.payout) filter (where b.settled_at >= now() - interval '7 days'),
    max(b.odds) filter (where b.settled_at >= now() - interval '7 days' and b.status = 'won')) as week,
  public.stats_obj(count(*) filter (where b.settled_at >= now() - interval '30 days'), count(*) filter (where b.settled_at >= now() - interval '30 days' and b.status = 'won'),
    sum(b.stake) filter (where b.settled_at >= now() - interval '30 days'), sum(b.payout) filter (where b.settled_at >= now() - interval '30 days'),
    max(b.odds) filter (where b.settled_at >= now() - interval '30 days' and b.status = 'won')) as month,
  public.stats_obj(count(*) filter (where b.settled_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    count(*) filter (where b.settled_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' and b.status = 'won'),
    sum(b.stake) filter (where b.settled_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    sum(b.payout) filter (where b.settled_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris'),
    max(b.odds) filter (where b.settled_at >= date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' and b.status = 'won')) as season,
  public.stats_obj(count(*), count(*) filter (where b.status = 'won'), sum(b.stake), sum(b.payout), max(b.odds) filter (where b.status = 'won')) as "all"
from public.bets b
where b.status in ('won','lost')
group by b.user_id;
revoke all on table public.public_player_stats from anon, authenticated;

-- Profils publics lus par le site : pseudo, avatar et statistiques serveur (aucune bankroll, aucun détail de pari).
create or replace view public.public_profiles as
select p.user_id, p.nickname, p.avatar, p.avatar_config, p.challenge_stats, p.updated_at,
  coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0)) as metrics,
  jsonb_build_object('day', coalesce(s.day, public.stats_obj(0, 0, 0, 0, 0)), 'week', coalesce(s.week, public.stats_obj(0, 0, 0, 0, 0)),
    'month', coalesce(s.month, public.stats_obj(0, 0, 0, 0, 0)), 'season', coalesce(s.season, public.stats_obj(0, 0, 0, 0, 0)),
    'all', coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0))) as period_stats
from public.profiles p left join public.public_player_stats s on s.user_id = p.user_id;
grant select on table public.public_profiles to anon, authenticated;

-- Le navigateur ne peut plus écrire que pseudo, avatar et date de mise à jour de son profil.
-- Saison 1 à zéro : les anciennes statistiques déclarées par le navigateur sont effacées.
update public.profiles set metrics = '{}'::jsonb, period_stats = '{}'::jsonb, challenge_stats = '{}'::jsonb
where metrics <> '{}'::jsonb or period_stats <> '{}'::jsonb or challenge_stats <> '{}'::jsonb;
revoke insert, update on table public.profiles from authenticated;
grant insert (user_id, nickname, avatar, avatar_config, updated_at) on table public.profiles to authenticated;
grant update (nickname, avatar, avatar_config, updated_at) on table public.profiles to authenticated;
