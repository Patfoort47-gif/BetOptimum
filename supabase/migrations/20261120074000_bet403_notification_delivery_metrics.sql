-- BET-403 : agrégats privés sur une fenêtre de 24 h, y compris entre deux passages.
begin;

create or replace function public.notification_delivery_metrics()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with recent as (
    select
      d.user_id, d.channel, d.status, d.due_at, d.sent_at, d.error,
      case
        when pg_input_is_valid(e.payload->>'expires_at', 'timestamptz')
          then (e.payload->>'expires_at')::timestamptz
        when pg_input_is_valid(e.payload->>'kickoff', 'timestamptz')
          then (e.payload->>'kickoff')::timestamptz
      end as deadline,
      case
        when e.payload ? 'test_channel' then 'test'
        when e.payload->'briefing' = 'true'::jsonb then 'briefing'
        when e.payload->'daily_summary' = 'true'::jsonb then 'daily'
        when e.payload->'favorite_reminder' = 'true'::jsonb then 'favorite'
        when e.payload->'result_validated' = 'true'::jsonb then 'result'
        else 'other'
      end as category
    from public.notification_deliveries d
    join public.notification_events e on e.id = d.event_id
    where d.channel in ('email', 'web')
      and case when d.status = 'sent' then d.sent_at else d.due_at end
        between now() - interval '24 hours' and now()
  ), categories as (
    select category, channel,
      count(*) filter (where status = 'sent') as accepted,
      count(*) filter (where status = 'failed') as failed,
      count(*) filter (where status = 'unknown') as uncertain,
      count(*) filter (where status = 'pending') as pending,
      count(*) filter (where status = 'cancelled') as cancelled,
      count(*) filter (where status in ('pending','cancelled') and deadline < now())
        as past_deadline_without_acceptance,
      count(*) filter (where error in ('Quota du fournisseur atteint', 'Plafond quotidien navigateur atteint')) as quota,
      coalesce(max(greatest(0, floor(extract(epoch from sent_at - due_at))))
        filter (where status = 'sent'), 0) as max_late_seconds
    from recent
    group by category, channel
  ), both_channels as (
    select user_id
    from recent
    where status = 'sent' and category not in ('test', 'other')
    group by user_id
    having count(distinct channel) = 2
  )
  select jsonb_build_object(
    'window_hours', 24,
    'multi_channel_accepted', (select count(*) from both_channels),
    'categories', coalesce(
      (select jsonb_agg(to_jsonb(c) order by c.category, c.channel) from categories c),
      '[]'::jsonb
    )
  );
$$;

revoke all on function public.notification_delivery_metrics() from public, anon, authenticated;
grant execute on function public.notification_delivery_metrics() to service_role;

commit;
