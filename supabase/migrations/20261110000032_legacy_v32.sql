-- BET-133 : journées hebdomadaires indépendantes du cumul de saison.
begin;
-- Une archive annuelle peut conserver un joueur encore en placement.
alter table public.season_results alter column to_echelon drop not null;
create table if not exists public.league_rounds (
 week_start date primary key, season text not null, closed_at timestamptz,
 check(extract(isodow from week_start)=1)
);
create table if not exists public.league_round_results (
 week_start date not null references public.league_rounds(week_start),
 user_id uuid not null references auth.users(id) on delete cascade,
 result jsonb not null, primary key(week_start,user_id)
);
alter table public.league_rounds enable row level security;
alter table public.league_round_results enable row level security;
revoke all on public.league_rounds,public.league_round_results from anon,authenticated;
grant select on public.league_rounds to anon,authenticated;
drop policy if exists "Weekly calendar readable" on public.league_rounds;
create policy "Weekly calendar readable" on public.league_rounds for select using(true);
create or replace function public.league_round_standings(p_week date)
returns table(user_id uuid, points numeric, picks bigint, wins bigint, roi numeric, daily_good bigint, qualified boolean, weekend_points numeric)
language sql stable security definer set search_path=public as $$
 with entries as (
 select e.* from league_entries e where e.league='general'
 and e.settled_at >= p_week::timestamp at time zone 'Europe/Paris'
 and e.settled_at < (p_week+7)::timestamp at time zone 'Europe/Paris'
 ), opportunities as (
 select pl.user_id,c.day,pick->>'matchId' match_id from player_league pl
 join daily_challenges c on c.day>=p_week and c.day<p_week+7
 cross join lateral jsonb_array_elements(c.picks) pick
 left join fixtures f on f.id=pick->>'matchId'
 where (pick->>'kickoff')::timestamptz>=pl.joined_at and (pick->>'kickoff')::timestamptz<=now() and not coalesce(f.voided,false)
 ), daily as (
 select o.user_id,count(d.id) filter(where d.status<>'void') played,
 count(d.id) filter(where d.status='won') good,count(*) filter(where d.status is distinct from 'void') offered
 from opportunities o left join daily_picks d on d.user_id=o.user_id and d.day=o.day and d.match_id=o.match_id group by o.user_id
 )
 select pl.user_id,coalesce(sum(e.points),0),count(e.id),count(e.id) filter(where e.points>0),
 coalesce(round(sum(e.points)/nullif(count(e.id) filter(where e.points<>0)*10,0)*100,1),0),
 coalesce(d.good,0),count(e.id) filter(where e.points<>0)>=10 and coalesce(d.played,0)>=coalesce(d.offered,0)*.5,
 coalesce(sum(e.points) filter(where e.daily_pick_id is not null and (e.settled_at at time zone 'Europe/Paris')::date>=p_week+5),0)
 from player_league pl left join entries e on e.user_id=pl.user_id left join daily d on d.user_id=pl.user_id
 group by pl.user_id,d.good,d.played,d.offered;
$$;
revoke all on function public.league_round_standings(date) from public,anon,authenticated;
grant execute on function public.league_round_standings(date) to service_role;
create or replace function public.apply_league_round(p_week date,p_results jsonb,p_groups jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_season text; g jsonb; r jsonb; gid bigint; v_item text;
begin
 perform pg_advisory_xact_lock(770133);
 select season into v_season from league_rounds where week_start=p_week and closed_at is null for update;
 if v_season is null then return false; end if;
 v_season := public.football_season();
 if p_week+7 > (now() at time zone 'Europe/Paris')::date then raise exception 'JOURNEE_NON_TERMINEE'; end if;
 insert into league_round_results select p_week,(x->>'user_id')::uuid,x from jsonb_array_elements(p_results) x;
 update player_league pl set echelon=x.to_echelon, protected=x.protected, inactive=x.inactive,updated_at=now()
 from jsonb_to_recordset(p_results) x(user_id uuid,to_echelon int,protected boolean,inactive boolean) where pl.user_id=x.user_id;
 for r in select * from jsonb_array_elements(p_results) loop
  for v_item in select jsonb_array_elements_text(r->'unlocks') loop
   insert into player_unlocks(user_id,item,season) values((r->>'user_id')::uuid,v_item,v_season) on conflict do nothing;
  end loop;
  for v_item in select jsonb_array_elements_text(r->'revoke') loop
   delete from player_unlocks u where u.user_id=(r->>'user_id')::uuid and u.item=v_item;
  end loop;
 end loop;
 if jsonb_array_length(p_results)>0 then
  insert into league_seasons(season) values(v_season) on conflict do nothing;
  delete from group_members where season=v_season;
  for g in select * from jsonb_array_elements(p_groups) loop
   insert into league_groups(season,echelon,label) values(v_season,(g->>'echelon')::int,g->>'label')
    on conflict(season,echelon,label) do update set label=excluded.label returning id into gid;
   insert into group_members(season,group_id,user_id) select v_season,gid,m::uuid from jsonb_array_elements_text(g->'members') m;
  end loop;
  -- Le rang précédent appartient à un autre groupe : le réinitialiser.
  update standings s set group_id=m.group_id,prev_rank=null from group_members m where m.season=v_season and s.season=m.season and s.user_id=m.user_id;
 end if;
 update league_rounds set closed_at=now() where week_start=p_week;
 return true;
end $$;
revoke all on function public.apply_league_round(date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_league_round(date,jsonb,jsonb) to service_role;
insert into league_rounds(week_start,season) values(date_trunc('week',now() at time zone 'Europe/Paris')::date,public.football_season()) on conflict do nothing;
-- Statistiques publiques identiques aux autres classements, limitées à la journée courante.
grant execute on function public.league_round_standings(date) to anon,authenticated;
create or replace view public.public_weekly_standings as
select p.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,m.group_id,g.label as group_label,
 r.points,r.picks,r.wins,r.roi,r.qualified,
 row_number() over(partition by m.group_id order by r.points desc,r.roi desc,r.wins desc,p.user_id) as rank
from public.league_round_standings(date_trunc('week',now() at time zone 'Europe/Paris')::date) r
join public.profiles p on p.user_id=r.user_id join public.player_league pl on pl.user_id=r.user_id
left join public.group_members m on m.user_id=r.user_id and m.season=public.football_season()
left join public.league_groups g on g.id=m.group_id
where not pl.inactive;
grant select on public.public_weekly_standings to anon,authenticated;
create or replace view public.public_ranking_season as
 select e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id,
 sum(e.points)::numeric(12,2) points,count(*) picks,count(*) filter(where e.points>0) wins,
 rank() over(order by sum(e.points) desc,coalesce(round(sum(e.points)/nullif(count(*) filter(where e.points<>0)*10,0)*100,1),0) desc,count(*) filter(where e.points>0) desc,e.user_id) rank,
 coalesce(round(sum(e.points)/nullif(count(*) filter(where e.points<>0)*10,0)*100,1),0) roi
 from league_entries e join profiles p on p.user_id=e.user_id left join player_league pl on pl.user_id=e.user_id
 where e.league='general' and e.season=public.football_season() group by e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id;
create or replace view public.public_ranking_alltime as
 select e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id,
 sum(e.points)::numeric(12,2) points,count(*) picks,count(*) filter(where e.points>0) wins,
 rank() over(order by sum(e.points) desc,coalesce(round(sum(e.points)/nullif(count(*) filter(where e.points<>0)*10,0)*100,1),0) desc,count(*) filter(where e.points>0) desc,e.user_id) rank,
 coalesce(round(sum(e.points)/nullif(count(*) filter(where e.points<>0)*10,0)*100,1),0) roi
 from league_entries e join profiles p on p.user_id=e.user_id left join player_league pl on pl.user_id=e.user_id
 where e.league='general'  group by e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id;
notify pgrst, 'reload schema';
commit;
