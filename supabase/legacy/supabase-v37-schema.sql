-- BET-168 : lecture privée paginée et agrégats calculés sur le serveur.
begin;
create or replace function public.my_bet_dashboard(p_days integer default null, p_status text default 'all', p_search text default '', p_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); since timestamptz; acct public.player_accounts; output jsonb;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_days is not null and p_days not in (7,30,90) then raise exception 'PERIOD_INVALID'; end if;
  if p_status not in ('all','settled','pending','won','lost','void') or length(coalesce(p_search,''))>100 or p_page<1 then raise exception 'FILTER_INVALID'; end if;
  since := case when p_days is null then '-infinity'::timestamptz else ((now() at time zone 'Europe/Paris')::date-p_days)::timestamp at time zone 'Europe/Paris' end;
  select * into acct from public.player_accounts where user_id=uid;
  with own as materialized (select * from public.bets where user_id=uid),
  filtered as (select * from own where placed_at>=since and (p_status='all' or status=p_status or (p_status='settled' and status<>'pending'))
    and (coalesce(p_search,'')='' or exists(select 1 from jsonb_array_elements(selections) s where strpos(lower(concat_ws(' ',s->>'match',s->>'label',s->>'league')),lower(p_search))>0))),
  cnt as (select count(*) n from filtered),
  pg as (select * from filtered order by placed_at desc,id desc limit 20 offset ((least(p_page,greatest(1,ceil((select n from cnt)/20.0)::int))-1)*20)),
  flows as (select placed_at event_at, -stake delta, 'mise' kind from own union all select settled_at,payout,'règlement' from own where status<>'pending' and settled_at is not null union all select created_at,amount,'apport' from public.capital_events where user_id=uid),
  opening as (select acct.bankroll-coalesce(sum(delta),0) balance from flows),
  days as (select (event_at at time zone 'Europe/Paris')::date as day,sum(delta) delta,sum(delta) filter(where kind='apport') deposit from flows group by 1),
  curve as (select day,(select balance from opening)+sum(delta) over(order by day) balance,delta,coalesce(deposit,0) deposit from days),
  results as (select date_trunc(case when p_days in (7,30) then 'week' else 'month' end,settled_at at time zone 'Europe/Paris')::date period,sum(stake) staked,sum(payout) returned,sum(payout-stake) net from own where status<>'pending' and settled_at>=since group by 1),
  stats as (select count(*) total,count(*) filter(where status='pending') pending,count(*) filter(where status='won') won,count(*) filter(where status='lost') lost,count(*) filter(where status='void') void,
    coalesce(sum(stake),0) staked,coalesce(sum(stake) filter(where status='pending'),0) engaged,
    coalesce(sum(case when bet_type='multiple' then (select sum((l->>'stake')::numeric*(l->>'odds')::numeric) from jsonb_array_elements(system_lines) l) else stake*odds end) filter(where status='pending'),0) potential
    from own where placed_at>=since),
  settled as (select count(*) filter(where status in ('won','lost')) decided,count(*) filter(where status='won') wins,count(*) settled,coalesce(sum(payout),0) returned,coalesce(sum(payout-stake),0) net from own where status<>'pending' and settled_at>=since),
  period_start as (select acct.bankroll-coalesce((select sum(delta) from flows where event_at>=since),0) balance)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(pg) order by placed_at desc,id desc) from pg),'[]'::jsonb),'total',(select n from cnt),'page',least(p_page,greatest(1,ceil((select n from cnt)/20.0)::int)),
    'summary',(select to_jsonb(stats) from stats)|| (select to_jsonb(s) from settled s)||jsonb_build_object('bankroll',acct.bankroll,'opening',(select balance from period_start),'change',acct.bankroll-(select balance from period_start),'deposits',coalesce((select sum(delta) from flows where kind='apport' and event_at>=since),0)),
    'curve',coalesce((select jsonb_agg(to_jsonb(c) order by day) from curve c where day>=(since at time zone 'Europe/Paris')::date),'[]'::jsonb),
    'bars',coalesce((select jsonb_agg(to_jsonb(r) order by period) from results r),'[]'::jsonb),
    'history',jsonb_build_object('form',(select string_agg(case when status='won' then 'V' else 'D' end,'' order by placed_at desc,id desc) from (select status,placed_at,id from own where status in ('won','lost') order by placed_at desc,id desc limit 10) recent),'total',(select count(*) from own),'settled',(select count(*) from own where status in ('won','lost')),'wins',(select count(*) from own where status='won'),'pending',(select count(*) from own where status='pending'),'void',(select count(*) from own where status='void'),'staked',coalesce((select sum(stake) from own where status in ('won','lost')),0),'returned',coalesce((select sum(payout) from own where status in ('won','lost')),0)),
    'openingDate',case when p_days is null then acct.created_at else since end,'baseline',(select balance from period_start)) into output;
  return output;
end $$;
revoke all on function public.my_bet_dashboard(integer,text,text,integer) from public,anon;
grant execute on function public.my_bet_dashboard(integer,text,text,integer) to authenticated;
commit;
