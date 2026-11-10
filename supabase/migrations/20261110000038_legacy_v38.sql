-- BET-169 : proposition validée explicitement le 3 novembre 2026.
-- Points V2 inchangés. V3 ne concerne que les périodes commençant le 9 novembre ou après.
begin;
create or replace function public.ranking_version(p_start date) returns integer language sql immutable as $$select case when p_start>=date '2026-11-09' then 3 else 2 end$$;
create or replace function public.ranking_period_start(p_scope text) returns date language sql immutable as $$select case when length(p_scope)=9 then (left(p_scope,4)||'-07-01')::date else (p_scope||'-01')::date end$$;
-- Vue interne : le statut officiel distingue un gain à cote 1 d’un remboursement.
create or replace view public.league_ranking_entries as
select e.id,e.user_id,e.season,e.settled_at,e.points,
 coalesce(coalesce(b.status,d.status) in ('won','lost'),e.points<>0) decided
from public.league_entries e left join public.bets b on b.id=e.bet_id left join public.daily_picks d on d.id=e.daily_pick_id where e.league='general';
revoke all on public.league_ranking_entries from anon,authenticated;
grant select on public.league_ranking_entries to service_role;
alter table public.standings add column if not exists decided integer not null default 0,add column if not exists confirmed boolean not null default true,add column if not exists ranking_version integer not null default 2;
alter table public.special_standings add column if not exists decided integer not null default 0,add column if not exists confirmed boolean not null default true,add column if not exists ranking_version integer not null default 2;
alter table public.season_results add column if not exists ranking_version integer not null default 2;
alter table public.special_titles add column if not exists ranking_version integer not null default 2;
create or replace function public.stamp_ranking_archive() returns trigger language plpgsql set search_path=public as $$begin
 if TG_TABLE_NAME='season_results' then new.ranking_version:=public.ranking_version(public.ranking_period_start(new.season));
 else new.ranking_version:=public.ranking_version((select season_start from special_leagues where id=new.league_id));end if;
 return new;end$$;
drop trigger if exists stamp_ranking_archive on public.season_results;
create trigger stamp_ranking_archive before insert on public.season_results for each row execute function public.stamp_ranking_archive();
drop trigger if exists stamp_ranking_archive on public.special_titles;
create trigger stamp_ranking_archive before insert on public.special_titles for each row execute function public.stamp_ranking_archive();
create or replace function public.league_round_ranking(p_week date)
returns table(user_id uuid,points numeric,picks bigint,wins bigint,roi numeric,daily_good bigint,qualified boolean,weekend_points numeric,decided bigint,confirmed boolean,ranking_version integer)
language sql stable security definer set search_path=public as $$
 select r.*,coalesce(d.n,0),public.ranking_version(p_week)<3 or coalesce(d.n,0)>=10,public.ranking_version(p_week)
 from public.league_round_standings(p_week) r left join (select e.user_id,count(*) filter(where e.decided) n from public.league_ranking_entries e
 where e.settled_at>=p_week::timestamp at time zone 'Europe/Paris' and e.settled_at<(p_week+7)::timestamp at time zone 'Europe/Paris' group by e.user_id) d on d.user_id=r.user_id;
$$;
revoke all on function public.league_round_ranking(date) from public;
grant execute on function public.league_round_ranking(date) to anon,authenticated,service_role;
create or replace view public.public_weekly_standings as
select p.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,m.group_id,g.label as group_label,r.points,r.picks,r.wins,r.roi,r.qualified,
 case when r.confirmed then row_number() over(partition by m.group_id order by r.confirmed desc,r.points desc,r.roi desc,r.wins desc,p.user_id) end as rank,
 r.decided,r.confirmed,r.ranking_version
from public.league_round_ranking(date_trunc('week',now() at time zone 'Europe/Paris')::date) r
join public.profiles p on p.user_id=r.user_id join public.player_league pl on pl.user_id=r.user_id
left join public.group_members m on m.user_id=r.user_id and m.season=public.football_season()
left join public.league_groups g on g.id=m.group_id where not pl.inactive;
create or replace function public.league_global_ranking(p_alltime boolean default false)
returns table(user_id uuid,nickname text,avatar text,avatar_config jsonb,echelon integer,heart_club_id text,points numeric,picks bigint,wins bigint,rank bigint,roi numeric,decided bigint,confirmed boolean,ranking_version integer)
language sql stable security definer set search_path=public as $$
 with totals as (select e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id,sum(e.points)::numeric(12,2) points,count(*) picks,count(*) filter(where e.points>0) wins,
 coalesce(round(sum(e.points)/nullif(count(*) filter(where e.points<>0)*10,0)*100,1),0) roi,count(*) filter(where e.decided) decided,
 public.ranking_version(case when p_alltime then (now() at time zone 'Europe/Paris')::date else public.ranking_period_start(public.football_season()) end) ranking_version
 from public.league_ranking_entries e join public.profiles p on p.user_id=e.user_id left join public.player_league pl on pl.user_id=e.user_id
 where p_alltime or e.season=public.football_season() group by e.user_id,p.nickname,p.avatar,p.avatar_config,pl.echelon,p.heart_club_id),
 rows as (select t.*,t.ranking_version<3 or t.decided>=10 confirmed from totals t)
 select r.user_id,r.nickname,r.avatar,r.avatar_config,r.echelon,r.heart_club_id,r.points,r.picks,r.wins,
 case when r.confirmed then row_number() over(order by r.confirmed desc,r.points desc,r.roi desc,r.wins desc,r.user_id) end,r.roi,r.decided,r.confirmed,r.ranking_version from rows r;
$$;
revoke all on function public.league_global_ranking(boolean) from public;
grant execute on function public.league_global_ranking(boolean) to anon,authenticated,service_role;
create or replace view public.public_ranking_season as select user_id,nickname,avatar,avatar_config,echelon,heart_club_id,points::numeric(12,2) points,picks,wins,rank,roi,decided,confirmed,ranking_version from public.league_global_ranking(false);
create or replace view public.public_ranking_alltime as select user_id,nickname,avatar,avatar_config,echelon,heart_club_id,points::numeric(12,2) points,picks,wins,rank,roi,decided,confirmed,ranking_version from public.league_global_ranking(true);
create or replace view public.public_standings as
select s.season,s.group_id,g.echelon as group_echelon,g.label as group_label,pl.echelon,s.user_id,p.nickname,p.avatar,p.avatar_config,s.points,s.picks,s.wins,s.roi,s.form,s.daily_good,s.qualified,
 case when s.confirmed then s.rank end rank,s.prev_rank,s.decided,s.confirmed,s.ranking_version
from public.standings s join public.profiles p on p.user_id=s.user_id left join public.league_groups g on g.id=s.group_id left join public.player_league pl on pl.user_id=s.user_id;
create or replace view public.public_special_standings as
select s.league_id,s.scope,s.user_id,p.nickname,p.avatar,p.avatar_config,s.points,s.picks,s.wins,s.roi,case when s.confirmed then s.rank end rank,s.played_rounds,s.decided,s.confirmed,s.ranking_version
from public.special_standings s join public.profiles p on p.user_id=s.user_id;
drop function public.private_league_ranking(uuid,text);
create function public.private_league_ranking(p_league uuid,p_season text default null)
returns table(user_id uuid,nickname text,avatar text,avatar_config jsonb,points numeric,picks bigint,wins bigint,roi numeric,rank bigint,decided bigint,confirmed boolean,ranking_version integer)
language plpgsql stable security definer set search_path=public as $$
declare v_season text:=coalesce(p_season,public.football_season());v_version integer;
begin
 if not public.is_private_member(p_league) then raise exception 'MEMBRE_REQUIS';end if;
 v_version:=public.ranking_version(public.ranking_period_start(v_season));
 return query with totals as (
 select m.user_id,p.nickname,p.avatar,p.avatar_config,coalesce(sum(e.points),0)::numeric points,count(e.id) picks,count(e.id) filter(where e.points>0) wins,
 coalesce(round(sum(e.points)/nullif(count(e.id) filter(where e.points<>0)*10,0)*100,1),0) roi,count(e.id) filter(where e.decided) decided
 from public.private_league_members m join public.profiles p on p.user_id=m.user_id left join public.league_ranking_entries e on e.user_id=m.user_id and e.season=v_season
 where m.league_id=p_league group by m.user_id,p.nickname,p.avatar,p.avatar_config),
 rows as(select t.*,v_version<3 or t.decided>=10 confirmed from totals t)
 select r.user_id,r.nickname,r.avatar,r.avatar_config,r.points,r.picks,r.wins,r.roi,
 case when r.confirmed then row_number() over(order by r.confirmed desc,r.points desc,r.roi desc,r.wins desc,r.user_id) end,r.decided,r.confirmed,v_version from rows r
 order by r.confirmed desc,r.points desc,r.roi desc,r.wins desc,r.user_id;
end$$;
revoke all on function public.private_league_ranking(uuid,text) from public,anon;
grant execute on function public.private_league_ranking(uuid,text) to authenticated;
-- Snapshots hebdomadaires : version de la période, jamais de réécriture des snapshots existants.
do $$begin
 if to_regprocedure('public.apply_league_round_before_v3(date,jsonb,jsonb)') is null then alter function public.apply_league_round(date,jsonb,jsonb) rename to apply_league_round_before_v3;end if;
end$$;
revoke all on function public.apply_league_round_before_v3(date,jsonb,jsonb) from public,anon,authenticated;
create or replace function public.apply_league_round(p_week date,p_results jsonb,p_groups jsonb)
returns boolean language sql security definer set search_path=public as $$
 select public.apply_league_round_before_v3(p_week,coalesce((select jsonb_agg(x||jsonb_build_object('ranking_version',public.ranking_version(p_week))) from jsonb_array_elements(p_results) x),'[]'::jsonb),p_groups);
$$;
revoke all on function public.apply_league_round(date,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.apply_league_round(date,jsonb,jsonb) to service_role;
revoke all on function public.stamp_ranking_archive() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
