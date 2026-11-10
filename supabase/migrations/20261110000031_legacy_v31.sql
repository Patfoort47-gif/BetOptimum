-- BET-132 : barème unique et recalcul des points de tout l'historique. Après V30.
-- Mises, gains, statuts, dates et récompenses déjà versées sont conservés.
begin;
create or replace function public.freeze_scoring_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Compatibilité de stockage : aucune version ne permet de choisir un autre barème.
  new.scoring_version := 2;
  return new;
end $$;

create or replace function public.league_score(p_status text, p_odd numeric, p_version smallint)
returns numeric language sql immutable set search_path = public as $$
  select case when p_status = 'lost' then -10 when p_status = 'won' and p_odd >= 1 and p_odd < 'Infinity'::numeric
    then round((least(p_odd, 5) - 1) * 10, 2) else 0 end;
$$;

-- Évaluer les annulations à la date du règlement : un ancien match réglé ne
-- devient pas annulé au seul motif que sa ligne de calendrier a vieilli.
create or replace function public.league_ticket_odd_at(p_selections jsonb, p_fallback numeric, p_settled_at timestamptz)
returns numeric language plpgsql stable set search_path = public as $$
declare selection jsonb; odd numeric := 1; cancelled boolean;
begin
  if p_selections is null or jsonb_array_length(p_selections) = 0 then return p_fallback; end if;
  for selection in select value from jsonb_array_elements(p_selections) loop
    select f.voided or (not f.completed and f.kickoff < coalesce(p_settled_at, now()) - interval '10 days') into cancelled
      from public.fixtures f where f.id = selection->>'matchId';
    if not coalesce(cancelled, false) then odd := odd * (selection->>'odd')::numeric; end if;
  end loop;
  return odd;
end $$;

create or replace function public.league_ticket_odd(p_selections jsonb, p_fallback numeric)
returns numeric language sql stable set search_path = public as $$
  select public.league_ticket_odd_at(p_selections, p_fallback, now());
$$;


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
    values (b.id, b.user_id, 'general', public.league_score(p_status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), b.scoring_version), b.week_start, public.football_season(now()), now())
    on conflict (bet_id, league) do nothing;
  end if;
  update public.special_picks set status = p_status, points = case when p_status = 'void' then 0 else public.league_score(p_status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), b.scoring_version) end, settled_at = now()
  where bet_id = b.id and status = 'pending';
  return true;
end $$;

create or replace function public.repair_league_history(p_user uuid default null, p_league text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_b public.bets; lm record; reason text; repaired int := 0; changed int; pts numeric;
begin
  -- Sérialise les relances du pipeline ; les insertions gardent leurs clés uniques.
  perform pg_advisory_xact_lock(770019);
  if p_league is null then
    insert into public.league_entries (bet_id, user_id, league, points, week_start, season, settled_at)
    select b.id, b.user_id, 'general', public.league_score(b.status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), b.scoring_version),
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
        pts := public.league_score(v_b.status, public.league_ticket_odd_at(v_b.selections, v_b.odds, v_b.settled_at), v_b.scoring_version);
        update public.special_picks set status = v_b.status, points = pts, placed_at = v_b.placed_at, settled_at = v_b.settled_at
          where bet_id = v_b.id and league_id = lm.league_id;
        repaired := repaired + 1;
      end if;
    end loop;
  end loop;
  return repaired;
end $$;

-- Exécution exceptionnelle de reconstruction, réservée au serveur. Ne règle
-- aucun pari et ne réattribue aucune promotion ni récompense.
create or replace function public.rescore_league_history()
returns jsonb language plpgsql security definer set search_path = public as $$
declare general_changed int; daily_changed int; special_changed int;
begin
  perform pg_advisory_xact_lock(770019);
  lock table public.bets, public.daily_picks, public.special_picks, public.league_entries in share row exclusive mode;
  update public.bets set scoring_version = 2 where scoring_version <> 2;
  update public.daily_picks set scoring_version = 2 where scoring_version <> 2;
  update public.special_picks set scoring_version = 2 where scoring_version <> 2;

  update public.daily_picks d set points = public.league_score(d.status, d.odd, 2::smallint)
    where d.status <> 'pending' and d.points is distinct from public.league_score(d.status, d.odd, 2::smallint);
  get diagnostics daily_changed = row_count;

  update public.league_entries e set points = public.league_score(b.status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), 2::smallint)
    from public.bets b where e.bet_id = b.id and b.status <> 'pending'
      and e.points is distinct from public.league_score(b.status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), 2::smallint);
  get diagnostics general_changed = row_count;
  update public.league_entries e set points = d.points from public.daily_picks d
    where e.daily_pick_id = d.id and d.status <> 'pending' and e.points is distinct from d.points;

  update public.special_picks sp set points = public.league_score(b.status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), 2::smallint)
    from public.bets b where sp.bet_id = b.id and sp.status <> 'pending'
      and sp.points is distinct from public.league_score(b.status, public.league_ticket_odd_at(b.selections, b.odds, b.settled_at), 2::smallint);
  get diagnostics special_changed = row_count;
  update public.special_picks sp set points = public.league_score(sp.status, sp.odd, 2::smallint)
    where sp.source = 'grid' and sp.status <> 'pending'
      and sp.points is distinct from public.league_score(sp.status, sp.odd, 2::smallint);

  -- Reconstituer aussi les archives mensuelles, dont V20 avait rattaché les
  -- écritures à la saison de football. Ne pas doubler les écritures mensuelles.
  drop table if exists pg_temp.bet132_history;
  create temporary table bet132_history on commit drop as
    select e.id, e.user_id, e.season, e.points, e.settled_at from public.league_entries e where e.league = 'general'
    union all
    select e.id, e.user_id, to_char(e.settled_at at time zone 'Europe/Paris', 'YYYY-MM'), e.points, e.settled_at
      from public.league_entries e where e.league = 'general' and length(e.season) = 9;

  with totals as (
    select s.season, s.user_id, coalesce(sum(e.points),0) as points, count(e.id) as picks,
      count(e.id) filter(where e.points > 0) as wins, count(e.id) filter(where e.points <> 0) as decided,
      coalesce(round(sum(e.points) / nullif(count(e.id) filter(where e.points <> 0) * 10,0) * 100,1),0) as roi,
      left(coalesce(string_agg(case when e.points > 0 then 'V' when e.points < 0 then 'D' else 'N' end, '' order by e.settled_at desc, e.id desc) filter(where e.id is not null),''),5) as form
    from public.standings s left join bet132_history e on e.user_id = s.user_id and e.season = s.season
    group by s.season, s.user_id
  ) update public.standings s set points=t.points, picks=t.picks, wins=t.wins, roi=t.roi, form=t.form,
      daily_good=coalesce(d.good,0), qualified=t.decided >= 10 and (coalesce(d.offered,0)=0 or coalesce(d.played,0) >= d.offered*.5), updated_at=now()
    from totals t left join public.daily_participation d on d.user_id=t.user_id and d.season=t.season
    where s.user_id=t.user_id and s.season=t.season;

  with ranked as (
    select season,user_id,row_number() over(partition by season,group_id order by points desc,roi desc,wins desc,user_id) as rank from public.standings
  ) update public.standings s set rank=r.rank, prev_rank=r.rank from ranked r where s.user_id=r.user_id and s.season=r.season;

  with totals as (
    select r.season,r.user_id,coalesce(sum(e.points),0) as points
      from public.season_results r left join bet132_history e on e.user_id=r.user_id and e.season=r.season
      group by r.season,r.user_id
  ) update public.season_results r set points=t.points from totals t where r.user_id=t.user_id and r.season=t.season;
  update public.season_results r set group_rank=s.rank from public.standings s where r.user_id=s.user_id and r.season=s.season;

  -- Toutes les ligues, ouvertes ou archivées, et tous les mois déjà affichés.
  with totals as (
    select s.league_id,s.scope,s.user_id,coalesce(sum(p.points) filter(where p.status <> 'pending'),0) as points,
      count(p.id) filter(where p.status <> 'pending') as picks,
      count(p.id) filter(where p.status <> 'pending' and p.points > 0) as wins,
      coalesce(round(sum(p.points) filter(where p.status <> 'pending') / nullif(count(p.id) filter(where p.status <> 'pending' and p.points <> 0)*10,0)*100,1),0) as roi,
      count(distinct p.round_id) as played_rounds
    from public.special_standings s left join public.special_picks p on p.league_id=s.league_id and p.user_id=s.user_id
      and (s.scope='season' or to_char(p.settled_at at time zone 'Europe/Paris','YYYY-MM')=s.scope)
    group by s.league_id,s.scope,s.user_id
  ) update public.special_standings s set points=t.points,picks=t.picks,wins=t.wins,roi=t.roi,played_rounds=t.played_rounds,updated_at=now()
    from totals t where s.league_id=t.league_id and s.scope=t.scope and s.user_id=t.user_id;
  with ranked as (
    select league_id,scope,user_id,row_number() over(partition by league_id,scope order by points desc,roi desc,wins desc,user_id) as rank from public.special_standings
  ) update public.special_standings s set rank=r.rank from ranked r where s.league_id=r.league_id and s.scope=r.scope and s.user_id=r.user_id;

  return jsonb_build_object('general_tickets_changed',general_changed,'daily_changed',daily_changed,'special_tickets_changed',special_changed);
end $$;
revoke all on function public.rescore_league_history() from public, anon, authenticated;
grant execute on function public.rescore_league_history() to service_role;
-- Préserver les droits des fonctions de règlement remplacées.
revoke all on function public.settle_bet(uuid,text,numeric,numeric), public.repair_league_history(uuid,text), public.freeze_scoring_version() from public, anon, authenticated;
grant execute on function public.settle_bet(uuid,text,numeric,numeric), public.repair_league_history(uuid,text) to service_role;
select public.rescore_league_history();
notify pgrst, 'reload schema';
commit;
