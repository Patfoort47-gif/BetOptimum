-- BET-131 : barème V2 et départage commun. Après V29 et les migrations d'activation du Club.
-- Aucun résultat déjà attribué ni aucune bankroll n'est recalculé.
begin;
-- DEFAULT 1 lors de l'ajout préserve aussi les pronostics historiques en attente.
alter table public.bets add column if not exists scoring_version smallint not null default 1 check (scoring_version in (1,2));
alter table public.daily_picks add column if not exists scoring_version smallint not null default 1 check (scoring_version in (1,2));
alter table public.special_picks add column if not exists scoring_version smallint not null default 1 check (scoring_version in (1,2));
alter table public.bets alter column scoring_version set default 2;
alter table public.daily_picks alter column scoring_version set default 2;
alter table public.special_picks alter column scoring_version set default 2;

create or replace function public.freeze_scoring_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.scoring_version is distinct from old.scoring_version then raise exception 'BAREME_IMMUABLE'; end if;
  else
    new.scoring_version := 2;
    if tg_table_name = 'special_picks' then
      if new.bet_id is not null then
        select scoring_version into new.scoring_version from public.bets where id = new.bet_id;
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.freeze_scoring_version() from public, anon, authenticated;
create or replace trigger freeze_scoring_version before insert or update on public.bets for each row execute function public.freeze_scoring_version();
create or replace trigger freeze_scoring_version before insert or update on public.daily_picks for each row execute function public.freeze_scoring_version();
create or replace trigger freeze_scoring_version before insert or update on public.special_picks for each row execute function public.freeze_scoring_version();

create or replace function public.league_score(p_status text, p_odd numeric, p_version smallint)
returns numeric language sql immutable set search_path = public as $$
  select case when p_status = 'lost' then -10 when p_status = 'won' and p_odd >= 1 and p_odd < 'Infinity'::numeric
    then round((least(p_odd, case when p_version = 1 then 10 else 5 end) - 1) * 10, 2) else 0 end;
$$;


-- Cote V2 indépendante des arrondis monétaires. Les annulations suivent buildResults.
create or replace function public.league_ticket_odd(p_selections jsonb, p_fallback numeric)
returns numeric language plpgsql stable set search_path = public as $$
declare selection jsonb; odd numeric := 1; cancelled boolean;
begin
  if jsonb_array_length(p_selections) = 0 then return p_fallback; end if;
  for selection in select value from jsonb_array_elements(p_selections) loop
    select f.voided or (not f.completed and f.kickoff < now() - interval '10 days') into cancelled
      from public.fixtures f where f.id = selection->>'matchId';
    if not coalesce(cancelled, false) then odd := odd * (selection->>'odd')::numeric; end if;
  end loop;
  return odd;
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
    values (b.id, b.user_id, 'general', public.league_score(p_status, case when b.scoring_version = 1 then b.payout / nullif(b.stake, 0) else public.league_ticket_odd(b.selections, b.odds) end, b.scoring_version), b.week_start, public.football_season(now()), now())
    on conflict (bet_id, league) do nothing;
  end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else public.league_score(p_status, case when b.scoring_version = 1 then b.payout / nullif(b.stake, 0) else public.league_ticket_odd(b.selections, b.odds) end, b.scoring_version) end, settled_at = now()
  where bet_id = b.id and status = 'pending';
  return true;
end $$;

create or replace function public.settle_daily_pick(p_id bigint, p_status text, p_points numeric)
returns boolean language plpgsql security definer set search_path = public as $$
declare d public.daily_picks;
begin
  if p_status not in ('won','lost','void') then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.daily_picks set status = p_status, points = case when p_status = 'void' then 0 else public.league_score(p_status, odd, scoring_version) end, settled_at = now()
  where id = p_id and status = 'pending' returning * into d;
  if d.id is null then return false; end if;
  insert into public.league_entries (daily_pick_id, user_id, league, points, week_start, season, settled_at)
  values (d.id, d.user_id, 'general', d.points, date_trunc('week', d.placed_at at time zone 'Europe/Paris')::date,
          public.football_season(now()), now())
  on conflict do nothing;
  return true;
end $$;

create or replace function public.settle_special_pick(p_id bigint, p_status text, p_points numeric)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('won','lost','void') then raise exception 'REGLEMENT_INVALIDE'; end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else public.league_score(p_status, odd, scoring_version) end, settled_at = now()
  where id = p_id and status = 'pending' and source = 'grid';
  return found;
end $$;

create or replace function public.repair_league_history(p_user uuid default null, p_league text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_b public.bets; lm record; reason text; repaired int := 0; changed int; pts numeric;
begin
  -- Sérialise les relances du pipeline ; les insertions gardent leurs clés uniques.
  perform pg_advisory_xact_lock(770019);
  if p_league is null then
    insert into public.league_entries (bet_id, user_id, league, points, week_start, season, settled_at)
    select b.id, b.user_id, 'general', public.league_score(b.status, case when b.scoring_version = 1 then b.payout / nullif(b.stake, 0) else public.league_ticket_odd(b.selections, b.odds) end, b.scoring_version),
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
        pts := public.league_score(v_b.status, case when v_b.scoring_version = 1 then v_b.payout / nullif(v_b.stake, 0) else public.league_ticket_odd(v_b.selections, v_b.odds) end, v_b.scoring_version);
        update public.special_picks set status = v_b.status, points = pts, placed_at = v_b.placed_at, settled_at = v_b.settled_at
          where bet_id = v_b.id and league_id = lm.league_id;
        repaired := repaired + 1;
      end if;
    end loop;
  end loop;
  return repaired;
end $$;

create or replace function public.private_league_ranking(p_league uuid, p_season text default null)
returns table (user_id uuid, nickname text, avatar text, avatar_config jsonb, points numeric, picks bigint, wins bigint, roi numeric, rank bigint)
language plpgsql stable security definer set search_path = public as $$
declare v_season text := coalesce(p_season, public.football_season(now()));
begin
  if not public.is_private_member(p_league) then raise exception 'MEMBRE_REQUIS'; end if;
  return query
  select r.user_id, r.nickname, r.avatar, r.avatar_config, r.points, r.picks, r.wins, r.roi, row_number() over (order by r.points desc, r.roi desc, r.wins desc, r.user_id)
  from (
    select m.user_id, p.nickname, p.avatar, p.avatar_config, coalesce(sum(e.points), 0)::numeric as points, count(e.id) as picks, count(e.id) filter (where e.points > 0) as wins,
           coalesce(round(sum(e.points) / nullif(count(e.id) filter (where e.points <> 0) * 10, 0) * 100, 1), 0) as roi, m.joined_at
    from public.private_league_members m
    join public.profiles p on p.user_id = m.user_id
    left join public.league_entries e on e.user_id = m.user_id and e.league = 'general' and e.season = v_season
    where m.league_id = p_league
    group by m.user_id, p.nickname, p.avatar, p.avatar_config, m.joined_at
  ) r
  order by 9;
end $$;

create or replace view public.public_ranking_season as
select e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id,
       sum(e.points)::numeric(12,2) as points, count(*) as picks, count(*) filter (where e.points > 0) as wins,
       rank() over (order by sum(e.points) desc,
         coalesce(round(sum(e.points) / nullif(count(*) filter (where e.points <> 0) * 10, 0) * 100, 1), 0) desc,
         count(*) filter (where e.points > 0) desc, e.user_id) as rank
from public.league_entries e join public.profiles p on p.user_id = e.user_id left join public.player_league pl on pl.user_id = e.user_id
where e.league = 'general' and e.season = public.football_season(now())
group by e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id;


create or replace view public.public_ranking_alltime as
select e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id,
       sum(e.points)::numeric(12,2) as points, count(*) as picks, count(*) filter (where e.points > 0) as wins,
       rank() over (order by sum(e.points) desc,
         coalesce(round(sum(e.points) / nullif(count(*) filter (where e.points <> 0) * 10, 0) * 100, 1), 0) desc,
         count(*) filter (where e.points > 0) desc, e.user_id) as rank
from public.league_entries e join public.profiles p on p.user_id = e.user_id left join public.player_league pl on pl.user_id = e.user_id
where e.league = 'general' 
group by e.user_id, p.nickname, p.avatar, p.avatar_config, pl.echelon, p.heart_club_id;


-- Participation individualisée : uniquement les occasions disponibles depuis l'arrivée,
-- déjà commencées et non annulées ; même dénominateur pour un absent et un participant.
create or replace view public.daily_participation as
with opportunities as (
  select pl.user_id, c.day, pick->>'matchId' as match_id
  from public.player_league pl
  join public.daily_challenges c on c.day >= (pl.joined_at at time zone 'Europe/Paris')::date
  cross join lateral jsonb_array_elements(c.picks) pick
  left join public.fixtures f on f.id = pick->>'matchId'
  where (pick->>'kickoff')::timestamptz >= pl.joined_at
    and (pick->>'kickoff')::timestamptz <= now()
    and not coalesce(f.voided, false)
), scoped as (
  select o.*, public.football_season(o.day::timestamp at time zone 'Europe/Paris') as season from opportunities o
  union all select o.*, to_char(o.day, 'YYYY-MM') from opportunities o
)
select o.user_id, o.season,
       count(d.id) filter (where d.status <> 'void') as played,
       count(d.id) filter (where d.status = 'won') as good,
       count(*) filter (where d.status is distinct from 'void') as offered
from scoped o left join public.daily_picks d on d.user_id = o.user_id and d.day = o.day and d.match_id = o.match_id
group by o.user_id, o.season;
revoke all on function public.settle_bet(uuid,text,numeric,numeric), public.settle_daily_pick(bigint,text,numeric), public.settle_special_pick(bigint,text,numeric), public.repair_league_history(uuid,text) from public, anon, authenticated;
grant execute on function public.settle_bet(uuid,text,numeric,numeric), public.settle_daily_pick(bigint,text,numeric), public.settle_special_pick(bigint,text,numeric), public.repair_league_history(uuid,text) to service_role;
notify pgrst, 'reload schema';
-- Les signatures existantes et leurs droits service_role sont conservés.
commit;
