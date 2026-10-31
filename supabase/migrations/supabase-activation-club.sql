-- BET-77 BET-78 BET-79 BET-82 BET-83 BET-84 BET-85 BET-92
-- Généré par node scripts/prepare-club-activation.mjs. Réexécutable après V17.
-- Ne remplace pas V23 et ne touche pas aux préférences ou secrets des alertes.
-- En cas d’erreur, toute cette transaction est annulée.
begin;
do $$ begin
 if to_regprocedure('public.avatar_config_valid(jsonb)') is null or to_regclass('public.special_rounds') is null then
  raise exception 'Installez les migrations du Club jusqu’à V17 avant cette activation.';
 end if;
end $$;

-- Source : supabase-v18-schema.sql
-- BET-79 : après V17, réexécutable. Ferme les ligues de clubs sans effacer leur historique.

update public.special_leagues set open = false where kind = 'club';
create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lg public.special_leagues; balance int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into lg from public.special_leagues where id = p_league and open and kind = 'competition';
  if not found then raise exception 'LIGUE_FERMEE'; end if;
  perform public.ensure_player_account();
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 79));
  if exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then return jsonb_build_object('joined', true); end if;
  if lg.access = 'premium' and lg.token_price > 0 and not exists (select 1 from public.token_ledger where user_id = uid and reason = 'league-entry' and ref = 'league:' || lg.id) then
    balance := public.lock_tokens(uid);
    if balance < lg.token_price then raise exception 'SOLDE_INSUFFISANT'; end if;
    insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -lg.token_price, 'league-entry', 'league:' || lg.id);
  end if;
  insert into public.league_members (league_id, user_id) values (p_league, uid);
  return jsonb_build_object('joined', true);
end $$;
create or replace function public.create_private_league(p_name text, p_emblem text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); league public.private_leagues;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 3 and 30 then raise exception 'NOM_INVALIDE'; end if;
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
  if (select count(*) from public.private_league_members where league_id = league.id) >= 50 then raise exception 'LIGUE_PLEINE'; end if;
  perform public.ensure_player_account();
  insert into public.private_league_members (league_id, user_id) values (league.id, uid);
  return to_jsonb(league);
end $$;


-- Source : supabase-v19-schema.sql
-- BET-77 : après V18. Réparation idempotente des paris certifiés éligibles ; jamais d’import des paris du navigateur.

create or replace function public.repair_league_history(p_user uuid default null, p_league text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_b public.bets; lm record; reason text; repaired int := 0; changed int; pts numeric;
begin
  -- Sérialise les relances du pipeline ; les insertions gardent leurs clés uniques.
  perform pg_advisory_xact_lock(770019);
  if p_league is null then
    insert into public.league_entries (bet_id, user_id, league, points, week_start, season, settled_at)
    select b.id, b.user_id, 'general', case when b.status = 'won' then round(10 * (least(10, b.payout / nullif(b.stake, 0)) - 1), 2) when b.status = 'lost' then -10 else 0 end,
      b.week_start, to_char(b.settled_at at time zone 'Europe/Paris', 'YYYY-MM'), b.settled_at
    from public.bets b
    where b.counts_general and b.bet_type <> 'multiple' and b.status in ('won','lost','void')
      and (p_user is null or b.user_id = p_user)
      and not exists (select 1 from public.league_seasons s where s.season = to_char(b.settled_at at time zone 'Europe/Paris', 'YYYY-MM') and s.status = 'closed')
    on conflict (bet_id, league) do nothing;
    get diagnostics changed = row_count; repaired := repaired + changed;
  end if;
  for lm in select m.user_id, m.league_id, l.season_start, l.season_end
    from public.league_members m join public.special_leagues l on l.id = m.league_id
    where l.open and l.kind = 'competition' and (p_user is null or m.user_id = p_user) and (p_league is null or m.league_id = p_league)
  loop
    -- Chronologie de placement : mêmes quotas et unicité par match que les nouveaux paris.
    for v_b in select * from public.bets b where b.user_id = lm.user_id and b.bet_type <> 'multiple'
      and (b.placed_at at time zone 'Europe/Paris')::date between lm.season_start and lm.season_end
      and exists (select 1 from public.special_rounds r where r.league_id = lm.league_id
        and (r.starts_at at time zone 'Europe/Paris')::date >= lm.season_start
        and (r.ends_at at time zone 'Europe/Paris')::date <= lm.season_end
        and r.match_ids @> (select jsonb_agg(s->>'matchId') from jsonb_array_elements(b.selections) s))
      and not exists (select 1 from public.special_picks sp where sp.bet_id = b.id and sp.league_id = lm.league_id)
      order by b.placed_at, b.id
    loop
      reason := public.special_try_pick(v_b.user_id, lm.league_id, v_b.selections, 'bet', v_b.id, v_b.odds);
      if reason is null then
        pts := case when v_b.status = 'won' then round(10 * (least(10, v_b.payout / nullif(v_b.stake, 0)) - 1), 2) when v_b.status = 'lost' then -10 else 0 end;
        update public.special_picks set status = v_b.status, points = pts, placed_at = v_b.placed_at, settled_at = v_b.settled_at
          where bet_id = v_b.id and league_id = lm.league_id;
        repaired := repaired + 1;
      end if;
    end loop;
  end loop;
  return repaired;
end $$;
revoke all on function public.repair_league_history(uuid, text) from public, anon, authenticated;
grant execute on function public.repair_league_history(uuid, text) to service_role;


-- Source : supabase-v20-schema.sql
-- BET-78 : après V19, transaction réexécutable ; archives mensuelles conservées.

create or replace function public.football_season(p_date timestamptz default now())
returns text language sql stable set search_path = public as $$
  select y::text || '-' || (y + 1)::text from
    (select extract(year from p_date at time zone 'Europe/Paris')::int - case when extract(month from p_date at time zone 'Europe/Paris') < 7 then 1 else 0 end as y) t;
$$;
alter table public.league_seasons drop constraint if exists league_seasons_season_check;
alter table public.league_seasons add constraint league_seasons_season_check
  check (season ~ '^[0-9]{4}-[0-9]{2}$' or (season ~ '^[0-9]{4}-[0-9]{4}$' and split_part(season,'-',2)::int = split_part(season,'-',1)::int + 1));

-- Reprend le dernier groupe mensuel et les points de l’année sportive courante.
-- Les instantanés standings/season_results mensuels restent inchangés pour la consultation.
do $$
declare current_season text := public.football_season(); old_season text;
begin
  if not exists (select 1 from public.league_seasons where season = current_season) then
    select max(season) into old_season from public.league_seasons where status = 'open' and length(season) = 7;
    insert into public.league_seasons(season, started_at) values(current_season, (split_part(current_season,'-',1) || '-07-01')::timestamp at time zone 'Europe/Paris');
    insert into public.league_groups(season,echelon,label)
      select current_season,echelon,label from public.league_groups where season = old_season on conflict do nothing;
    insert into public.group_members(season,group_id,user_id)
      select current_season, ng.id, m.user_id from public.group_members m join public.league_groups g on g.id = m.group_id
        join public.league_groups ng on ng.season = current_season and ng.echelon = g.echelon and ng.label = g.label
      where m.season = old_season on conflict do nothing;
    update public.league_entries set season = current_season where league = 'general' and public.football_season(settled_at) = current_season;
    update public.league_seasons set status = 'closed', closed_at = now() where status = 'open' and length(season) = 7;
  end if;
end $$;
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
    values (b.id, b.user_id, 'general', round(coalesce(p_points, 0), 2), b.week_start, public.football_season(now()), now())
    on conflict (bet_id, league) do nothing;
  end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else round(coalesce(p_points, 0), 2) end, settled_at = now()
  where bet_id = b.id and status = 'pending';
  return true;
end $$;
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
          public.football_season(now()), now())
  on conflict do nothing;
  return true;
end $$;
create or replace function public.enrol_player_league()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.player_league (user_id, echelon, joined_season) values (new.user_id, null, public.football_season(now()))
  on conflict (user_id) do nothing;
  return new;
end $$;
create or replace function public.buy_shield(p_league text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_season text; balance int; sl public.special_leagues;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_league = 'general' then v_season := public.football_season(now());
  else
    select * into sl from public.special_leagues where id = p_league and open;
    if not found or not exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then raise exception 'LIGUE_INCONNUE'; end if;
    v_season := to_char(sl.season_start, 'YYYY') || '-' || to_char(sl.season_end, 'YY');
  end if;
  balance := public.lock_tokens(uid);
  if exists (select 1 from public.streak_shields where user_id = uid and league = p_league and season = v_season) then raise exception 'BOUCLIER_DEJA'; end if;
  if balance < 800 then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.streak_shields (user_id, league, season) values (uid, p_league, v_season);
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -800, 'shield', 'shield:' || p_league || ':' || v_season);
end $$;
create or replace function public.private_league_ranking(p_league uuid, p_season text default null)
returns table (user_id uuid, nickname text, avatar text, avatar_config jsonb, points numeric, picks bigint, wins bigint, roi numeric, rank bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_season text := coalesce(p_season, public.football_season(now()));
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
create or replace function public.repair_league_history(p_user uuid default null, p_league text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_b public.bets; lm record; reason text; repaired int := 0; changed int; pts numeric;
begin
  -- Sérialise les relances du pipeline ; les insertions gardent leurs clés uniques.
  perform pg_advisory_xact_lock(770019);
  if p_league is null then
    insert into public.league_entries (bet_id, user_id, league, points, week_start, season, settled_at)
    select b.id, b.user_id, 'general', case when b.status = 'won' then round(10 * (least(10, b.payout / nullif(b.stake, 0)) - 1), 2) when b.status = 'lost' then -10 else 0 end,
      b.week_start, public.football_season(b.settled_at), b.settled_at
    from public.bets b
    where b.counts_general and b.bet_type <> 'multiple' and b.status in ('won','lost','void')
      and (p_user is null or b.user_id = p_user)
      and not exists (select 1 from public.league_seasons s where s.season = public.football_season(b.settled_at) and s.status = 'closed')
    on conflict (bet_id, league) do nothing;
    get diagnostics changed = row_count; repaired := repaired + changed;
  end if;
  for lm in select m.user_id, m.league_id, l.season_start, l.season_end
    from public.league_members m join public.special_leagues l on l.id = m.league_id
    where l.open and l.kind = 'competition' and (p_user is null or m.user_id = p_user) and (p_league is null or m.league_id = p_league)
  loop
    -- Chronologie de placement : mêmes quotas et unicité par match que les nouveaux paris.
    for v_b in select * from public.bets b where b.user_id = lm.user_id and b.bet_type <> 'multiple'
      and (b.placed_at at time zone 'Europe/Paris')::date between lm.season_start and lm.season_end
      and exists (select 1 from public.special_rounds r where r.league_id = lm.league_id
        and (r.starts_at at time zone 'Europe/Paris')::date >= lm.season_start
        and (r.ends_at at time zone 'Europe/Paris')::date <= lm.season_end
        and r.match_ids @> (select jsonb_agg(s->>'matchId') from jsonb_array_elements(b.selections) s))
      and not exists (select 1 from public.special_picks sp where sp.bet_id = b.id and sp.league_id = lm.league_id)
      order by b.placed_at, b.id
    loop
      reason := public.special_try_pick(v_b.user_id, lm.league_id, v_b.selections, 'bet', v_b.id, v_b.odds);
      if reason is null then
        pts := case when v_b.status = 'won' then round(10 * (least(10, v_b.payout / nullif(v_b.stake, 0)) - 1), 2) when v_b.status = 'lost' then -10 else 0 end;
        update public.special_picks set status = v_b.status, points = pts, placed_at = v_b.placed_at, settled_at = v_b.settled_at
          where bet_id = v_b.id and league_id = lm.league_id;
        repaired := repaired + 1;
      end if;
    end loop;
  end loop;
  return repaired;
end $$;
create or replace view public.public_ranking_season as
select e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id,
       sum(e.points)::numeric(12,2) as points, count(*) as picks, count(*) filter (where e.points > 0) as wins,
       rank() over (order by sum(e.points) desc, count(*) filter (where e.points > 0) desc, e.user_id) as rank
from public.league_entries e join public.profiles p on p.user_id = e.user_id left join public.player_league pl on pl.user_id = e.user_id
where e.league = 'general' and e.season = public.football_season(now())
group by e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id;
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
  public.stats_obj(count(*) filter (where b.settled_at >= (split_part(public.football_season(), '-', 1) || '-07-01')::timestamp at time zone 'Europe/Paris'),
    count(*) filter (where b.settled_at >= (split_part(public.football_season(), '-', 1) || '-07-01')::timestamp at time zone 'Europe/Paris' and b.status = 'won'),
    sum(b.stake) filter (where b.settled_at >= (split_part(public.football_season(), '-', 1) || '-07-01')::timestamp at time zone 'Europe/Paris'),
    sum(b.payout) filter (where b.settled_at >= (split_part(public.football_season(), '-', 1) || '-07-01')::timestamp at time zone 'Europe/Paris'),
    max(b.odds) filter (where b.settled_at >= (split_part(public.football_season(), '-', 1) || '-07-01')::timestamp at time zone 'Europe/Paris' and b.status = 'won')) as season,
  public.stats_obj(count(*), count(*) filter (where b.status = 'won'), sum(b.stake), sum(b.payout), max(b.odds) filter (where b.status = 'won')) as "all"
from public.bets b
where b.status in ('won','lost')
group by b.user_id;
create or replace view public.daily_participation as
select m.user_id, m.season, m.played, m.good, coalesce(o.offered,0) as offered
from (select user_id, public.football_season(day::timestamp at time zone 'Europe/Paris') as season, count(*) as played, count(*) filter(where status = 'won') as good
      from public.daily_picks group by user_id, public.football_season(day::timestamp at time zone 'Europe/Paris')
      union all
      select user_id, to_char(day,'YYYY-MM'), count(*), count(*) filter(where status = 'won') from public.daily_picks group by user_id,to_char(day,'YYYY-MM')) m
left join (select public.football_season(day::timestamp at time zone 'Europe/Paris') as season, sum(jsonb_array_length(picks)) as offered from public.daily_challenges group by public.football_season(day::timestamp at time zone 'Europe/Paris')
      union all select to_char(day,'YYYY-MM'), sum(jsonb_array_length(picks)) from public.daily_challenges group by to_char(day,'YYYY-MM')) o on o.season = m.season;


-- Source : supabase-v21-schema.sql
-- BET-92 : réparer l’adhésion aux ligues de championnats (après V16 au minimum).
-- Réexécutable. Ne modifie ni les inscriptions existantes ni la bankroll.

do $$ begin
  if to_regclass('public.special_leagues') is null or to_regclass('public.token_ledger') is null then
    raise exception 'Exécutez les migrations du Club jusqu’à V16 avant V21.';
  end if;
end $$;
create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_league public.special_leagues; v_balance int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Même joueur, même verrou : deux onglets ne débitent pas deux entrées premium.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 79));
  select * into v_league from public.special_leagues
    where id = p_league and open and kind = 'competition' for share;
  if not found then raise exception 'LIGUE_FERMEE'; end if;
  if exists (select 1 from public.league_members where league_id = p_league and user_id = v_user) then
    return jsonb_build_object('joined', true);
  end if;
  -- Rejoindre une ligue n’exige pas de créer ou de migrer un compte de bankroll.
  -- Les paris continuent à passer exclusivement par les RPC certifiées habituelles.
  if v_league.access = 'premium' and v_league.token_price > 0 and not exists (
    select 1 from public.token_ledger where user_id = v_user and reason = 'league-entry' and ref = 'league:' || v_league.id
  ) then
    v_balance := public.lock_tokens(v_user);
    if v_balance < v_league.token_price then raise exception 'SOLDE_INSUFFISANT'; end if;
    insert into public.token_ledger(user_id, delta, reason, ref)
      values(v_user, -v_league.token_price, 'league-entry', 'league:' || v_league.id);
  end if;
  insert into public.league_members(league_id, user_id) values(p_league, v_user) on conflict do nothing;
  return jsonb_build_object('joined', true);
end $$;
revoke all on function public.join_special_league(text) from public, anon;
grant execute on function public.join_special_league(text) to authenticated;
notify pgrst, 'reload schema';


-- Source : supabase-v22-schema.sql
-- BET-82 à BET-85 : nouveaux objets de personnalisation. Après V17, réexécutable.

create or replace function public.avatar_config_valid(cfg jsonb)
returns boolean language plpgsql immutable set search_path = public as $$
declare kit jsonb;
begin
  if cfg is null or jsonb_typeof(cfg) <> 'object' or length(cfg::text) > 1500 then return false; end if;
  -- Ancien avatar (couleur, expression, accessoire).
  if not (cfg ? 'v') or cfg->>'v' = '1' then
    return coalesce(cfg->>'avatar' in ('lime','blue','purple','orange') and cfg->>'face' in ('smile','cool','focused','wink') and cfg->>'accessory' in ('none','glasses','cap','crown'), false);
  end if;
  if cfg->>'v' <> '2' then return false; end if;
  if exists (select 1 from jsonb_object_keys(cfg) k where k not in ('v','body','skin','face','eyes','expression','hair','hairColor','kit','boots','pose','accessories','base','background','showcase','celebration','rev')) then return false; end if;
  if not (public.avatar_int(cfg->'skin', 0, 4) and public.avatar_int(cfg->'face', 0, 5) and public.avatar_int(cfg->'eyes', 0, 5) and public.avatar_int(cfg->'hair', 0, 11)
    and public.avatar_int(cfg->'hairColor', 0, 8) and public.avatar_int(cfg->'boots', 0, 3) and public.avatar_int(cfg->'rev', 0, 4294967295)) then return false; end if;
  if not (coalesce(jsonb_typeof(cfg->'body') = 'string' and cfg->>'body' in ('m','f'), false)
    and coalesce(jsonb_typeof(cfg->'expression') = 'string' and cfg->>'expression' in ('smile','focus','wink','confident','joy','surprise'), false)
    and coalesce(jsonb_typeof(cfg->'pose') = 'string' and cfg->>'pose' in ('idle','arms','ball','foot'), false)
    and coalesce(jsonb_typeof(cfg->'base') = 'string' and cfg->>'base' in ('base-classic','base-grass','base-silver','base-gold','base-neon'), false)
    and coalesce(jsonb_typeof(cfg->'celebration') = 'string' and cfg->>'celebration' in ('celeb-jump','celeb-fist','celeb-slide','celeb-flip','celeb-heart','celeb-archer','celeb-dance'), false)
    and coalesce(jsonb_typeof(cfg->'background') = 'string' and (cfg->>'background' ~ '^solid-[0-5]$' or cfg->>'background' in ('bg-training','bg-lockers','bg-tunnel','bg-rooftop','bg-sunset')
      or cfg->>'background' ~ '^bg-(rio|barcelona|madrid|paris|munich|london|aurora|coastal)-(in|out)$'), false)) then return false; end if;
  kit := cfg->'kit';
  if jsonb_typeof(kit) <> 'object' or exists (select 1 from jsonb_object_keys(kit) k where k not in ('item','number','name')) then return false; end if;
  if not (coalesce(jsonb_typeof(kit->'item') = 'string' and kit->>'item' in ('start-lime','start-blue','start-purple','start-orange','kit-plain-lime','kit-plain-blue','kit-plain-red','kit-plain-white','kit-plain-black','kit-plain-orange','kit-stripe-vertical','kit-stripe-band','kit-stripe-hoops','kit-stripe-scarf','kit-retro-70','kit-retro-90','kit-retro-champion','kit-champion','kit-gold','kit-chevron','kit-diagonal','kit-mosaic'), false)
    and (kit->'number' is null or jsonb_typeof(kit->'number') = 'null' or public.avatar_int(kit->'number', 0, 99))
    and coalesce(jsonb_typeof(kit->'name') = 'string' and kit->>'name' ~ '^[A-Z0-9 .-]{0,12}$', false)) then return false; end if;
  if jsonb_typeof(cfg->'accessories') <> 'array' or jsonb_array_length(cfg->'accessories') > 5 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'accessories') e where jsonb_typeof(e) <> 'string' or public.avatar_slot(e #>> '{}') is null) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'accessories')) <> (select count(distinct public.avatar_slot(e)) from jsonb_array_elements_text(cfg->'accessories') e) then return false; end if;
  if jsonb_typeof(cfg->'showcase') <> 'array' or jsonb_array_length(cfg->'showcase') > 3 then return false; end if;
  if exists (select 1 from jsonb_array_elements(cfg->'showcase') e where jsonb_typeof(e) <> 'string' or (e #>> '{}') not in ('trophy-cup','trophy-pichichi','trophy-boot','trophy-glove','trophy-ball','trophy-crystal','trophy-laurel')) then return false; end if;
  if (select count(*) from jsonb_array_elements_text(cfg->'showcase')) <> (select count(distinct e) from jsonb_array_elements_text(cfg->'showcase') e) then return false; end if;
  return true;
end $$;
-- Catalogue initial : prix et règles identiques à shop.js. Les inventaires ne sont pas modifiés.
insert into public.shop_items(id,category,name,rarity,price,exclusive,min_division,collection,asset,pack_of)
select id,category,name,rarity,price,exclusive,min_division,collection,asset,pack_of from jsonb_to_recordset($catalog$[{"id":"kit-chevron","category":"kit","name":"Maillot Élan","rarity":"rare","price":1900,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"kit-diagonal","category":"kit","name":"Maillot Diagonale","rarity":"rare","price":2100,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"kit-mosaic","category":"kit","name":"Maillot Mosaïque","rarity":"rare","price":2400,"exclusive":false,"min_division":null,"collection":"atelier","asset":null,"pack_of":null},{"id":"trophy-crystal","category":"trophy","name":"Étoile de cristal","rarity":"epic","price":6500,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"trophy-laurel","category":"trophy","name":"Lauriers du fair-play","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"bg-aurora-in","category":"background","name":"Stade de l’Aurore, vu de l'intérieur","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":"stade-aurora","asset":null,"pack_of":null},{"id":"bg-aurora-out","category":"background","name":"Stade de l’Aurore, vu de l'extérieur","rarity":"rare","price":2800,"exclusive":false,"min_division":null,"collection":"stade-aurora","asset":null,"pack_of":null},{"id":"bg-coastal-in","category":"background","name":"Stade de la Côte, vu de l'intérieur","rarity":"rare","price":2900,"exclusive":false,"min_division":null,"collection":"stade-coastal","asset":null,"pack_of":null},{"id":"bg-coastal-out","category":"background","name":"Stade de la Côte, vu de l'extérieur","rarity":"rare","price":2900,"exclusive":false,"min_division":null,"collection":"stade-coastal","asset":null,"pack_of":null},{"id":"bg-rooftop","category":"background","name":"Terrain sur les toits","rarity":"rare","price":1800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"bg-sunset","category":"background","name":"Entraînement au couchant","rarity":"common","price":800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-heart","category":"celebration","name":"Cœur aux supporters","rarity":"common","price":800,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-archer","category":"celebration","name":"L’Archer","rarity":"rare","price":1900,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"celeb-dance","category":"celebration","name":"Pas de victoire","rarity":"rare","price":2300,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":null},{"id":"pack-aurora","category":"pack","name":"Pack stade de l’Aurore","rarity":"rare","price":5200,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":["bg-aurora-in","bg-aurora-out","kit-plain-lime","acc-scarf"]},{"id":"pack-coastal","category":"pack","name":"Pack stade de la Côte","rarity":"rare","price":5360,"exclusive":false,"min_division":null,"collection":null,"asset":null,"pack_of":["bg-coastal-in","bg-coastal-out","kit-plain-lime","acc-scarf"]}]$catalog$::jsonb) as r(id text,category text,name text,rarity text,price integer,exclusive boolean,min_division integer,collection text,asset text,pack_of jsonb)
on conflict(id) do update set name=excluded.name,price=excluded.price,rarity=excluded.rarity,pack_of=excluded.pack_of;
notify pgrst, 'reload schema';


-- Rattache les paris certifiés éligibles, sans double comptage ni modification des mises.
select public.repair_league_history() as rattachements_repares;
notify pgrst, 'reload schema';
commit;
