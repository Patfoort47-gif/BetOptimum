-- BET-253 : perte de classement à -1 sur tout l’historique. Après V56.
-- Les gains, bankrolls, statuts et promotions passées restent inchangés.
begin;
create or replace function public.league_score(p_status text, p_odd numeric, p_version smallint)
returns numeric language sql immutable set search_path = public as $$
  select case when p_status = 'lost' then -1 when p_status = 'won' and p_odd >= 1 and p_odd < 'Infinity'::numeric
    then round((least(p_odd, 5) - 1) * 10, 2) else 0 end;
$$;


-- Recalcul V31 conservé ; les rangs provisoires V38 restent NULL.
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
    select season,user_id,case when confirmed then row_number() over(partition by season,group_id order by confirmed desc,points desc,roi desc,wins desc,user_id) end as rank from public.standings
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
    select league_id,scope,user_id,case when confirmed then row_number() over(partition by league_id,scope order by confirmed desc,points desc,roi desc,wins desc,user_id) end as rank from public.special_standings
  ) update public.special_standings s set rank=r.rank from ranked r where s.league_id=r.league_id and s.scope=r.scope and s.user_id=r.user_id;

  return jsonb_build_object('general_tickets_changed',general_changed,'daily_changed',daily_changed,'special_tickets_changed',special_changed);
end $$;
revoke all on function public.rescore_league_history() from public, anon, authenticated;
grant execute on function public.rescore_league_history() to service_role;
select public.rescore_league_history();
notify pgrst, 'reload schema';
commit;
