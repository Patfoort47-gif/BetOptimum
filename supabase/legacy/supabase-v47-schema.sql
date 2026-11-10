-- BET-189 : ajoute les mises décidées au bilan filtré, sans changer les agrégats existants.
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
  -- Les graphiques suivent les tickets pris pendant la période, comme la liste.
  days as (select (settled_at at time zone 'Europe/Paris')::date as day,sum(payout-stake) delta
    from filtered where status<>'pending' and settled_at is not null group by 1),
  curve as (select day,sum(delta) over(order by day) balance,delta,0::numeric deposit from days),
  results as (select date_trunc(case when p_days in (7,30) then 'week' else 'month' end,settled_at at time zone 'Europe/Paris')::date period,sum(stake) staked,sum(payout) returned,sum(payout-stake) net from filtered where status<>'pending' and settled_at is not null group by 1),
  stats as (select count(*) total,count(*) filter(where status='pending') pending,count(*) filter(where status='won') won,count(*) filter(where status='lost') lost,count(*) filter(where status='void') void,
    coalesce(sum(stake),0) staked,coalesce(sum(stake) filter(where status='pending'),0) engaged,
    coalesce(sum(case when bet_type='multiple' then (select sum((l->>'stake')::numeric*(l->>'odds')::numeric) from jsonb_array_elements(system_lines) l) else stake*odds end) filter(where status='pending'),0) potential
    from filtered),
  settled as (select count(*) filter(where status in ('won','lost')) decided,count(*) filter(where status='won') wins,count(*) settled,coalesce(sum(stake) filter(where status in ('won','lost')),0) decided_staked,coalesce(sum(payout),0) returned,coalesce(sum(payout-stake),0) net from filtered where status<>'pending'),
  period_start as (select 0::numeric balance)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(pg) order by placed_at desc,id desc) from pg),'[]'::jsonb),'total',(select n from cnt),'page',least(p_page,greatest(1,ceil((select n from cnt)/20.0)::int)),
    'summary',(select to_jsonb(stats) from stats)|| (select to_jsonb(s) from settled s)||jsonb_build_object('bankroll',acct.bankroll,'opening',(select balance from period_start),'change',(select net from settled),'deposits',0),
    'curve',coalesce((select jsonb_agg(to_jsonb(c) order by day) from curve c),'[]'::jsonb),
    'bars',coalesce((select jsonb_agg(to_jsonb(r) order by period) from results r),'[]'::jsonb),
    'history',jsonb_build_object('form',(select string_agg(case when status='won' then 'V' else 'D' end,'' order by placed_at desc,id desc) from (select status,placed_at,id from own where status in ('won','lost') order by placed_at desc,id desc limit 10) recent),'total',(select count(*) from own),'settled',(select count(*) from own where status in ('won','lost')),'wins',(select count(*) from own where status='won'),'pending',(select count(*) from own where status='pending'),'void',(select count(*) from own where status='void'),'staked',coalesce((select sum(stake) from own where status in ('won','lost')),0),'returned',coalesce((select sum(payout) from own where status in ('won','lost')),0)),
    'openingDate',case when p_days is null then acct.created_at else since end,'baseline',0,'chartKind','filtered-net') into output;
  return output;
end $$;
revoke all on function public.my_bet_dashboard(integer,text,text,integer) from public,anon;
grant execute on function public.my_bet_dashboard(integer,text,text,integer) to authenticated;
commit;
