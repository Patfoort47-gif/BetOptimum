-- BET-193 : historique par curseur, cinq tickets par lot, agrégats complets.
begin;
create or replace function public.my_bet_history(p_days integer default null, p_status text default 'all', p_search text default '', p_cursor jsonb default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); since timestamptz; acct public.player_accounts; output jsonb; cursor_time timestamptz; cursor_id uuid; snapshot_at timestamptz := statement_timestamp();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_days is not null and p_days not in (7,30,90) then raise exception 'PERIOD_INVALID'; end if;
  if p_status not in ('all','settled','pending','won','lost','void') or length(coalesce(p_search,''))>100 then raise exception 'FILTER_INVALID'; end if;
  if p_cursor is not null then
    if jsonb_typeof(p_cursor)<>'object' or not (p_cursor ?& array['placed_at','id','snapshot_at']) then raise exception 'CURSOR_INVALID'; end if;
    begin
      cursor_time := (p_cursor->>'placed_at')::timestamptz;
      cursor_id := (p_cursor->>'id')::uuid;
      snapshot_at := (p_cursor->>'snapshot_at')::timestamptz;
    exception when others then raise exception 'CURSOR_INVALID'; end;
    if cursor_time is null or cursor_id is null or snapshot_at is null or snapshot_at>statement_timestamp() or cursor_time>snapshot_at then raise exception 'CURSOR_INVALID'; end if;
  end if;
  since := case when p_days is null then '-infinity'::timestamptz else ((snapshot_at at time zone 'Europe/Paris')::date-p_days)::timestamp at time zone 'Europe/Paris' end;
  select * into acct from public.player_accounts where user_id=uid;
  with own as materialized (select * from public.bets where user_id=uid),
  filtered as (select * from own where placed_at>=since and placed_at<=snapshot_at and (p_status='all' or status=p_status or (p_status='settled' and status<>'pending'))
    and (coalesce(p_search,'')='' or exists(select 1 from jsonb_array_elements(selections) s where strpos(lower(concat_ws(' ',s->>'match',s->>'label',s->>'league')),lower(p_search))>0))),
  cnt as (select count(*) n from filtered),
  batch as (select * from filtered where cursor_time is null or (placed_at,id)<(cursor_time,cursor_id) order by placed_at desc,id desc limit 6),
  pg as (select * from batch order by placed_at desc,id desc limit 5),
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
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(pg) order by placed_at desc,id desc) from pg),'[]'::jsonb),'total',(select n from cnt),'has_more',(select count(*)>5 from batch),'next_cursor',case when (select count(*)>5 from batch) then (select jsonb_build_object('placed_at',placed_at,'id',id,'snapshot_at',snapshot_at) from pg order by placed_at,id limit 1) else null end,
    'summary',(select to_jsonb(stats) from stats)|| (select to_jsonb(s) from settled s)||jsonb_build_object('bankroll',acct.bankroll,'opening',(select balance from period_start),'change',(select net from settled),'deposits',0),
    'curve',coalesce((select jsonb_agg(to_jsonb(c) order by day) from curve c),'[]'::jsonb),
    'bars',coalesce((select jsonb_agg(to_jsonb(r) order by period) from results r),'[]'::jsonb),
    'openingDate',case when p_days is null then acct.created_at else since end,'baseline',0,'chartKind','filtered-net') into output;
  return output;
end $$;
revoke all on function public.my_bet_history(integer,text,text,jsonb) from public,anon;
grant execute on function public.my_bet_history(integer,text,text,jsonb) to authenticated;
commit;
