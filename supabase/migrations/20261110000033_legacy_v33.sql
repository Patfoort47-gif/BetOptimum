-- BET-143 : un briefing par date locale, même après replanification. Après V32.
begin;
-- Ne modifie aucun consentement. Les anciens favoris consentis passent au rendez-vous quotidien.
update public.notification_preferences set daily_briefing=daily_briefing or favorite_briefing,favorite_briefing=false where favorite_briefing;
-- Une ancienne réservation non tentée sera remplacée au créneau quotidien.
update public.notification_deliveries d set status='cancelled',error='Briefing quotidien unique'
from public.notification_events e where e.id=d.event_id and e.payload->>'briefing'='true' and d.status='pending' and d.attempts=0;
create or replace function public.enqueue_notification_briefing(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_preferences; lim notification_plans; eid bigint; day date; old notification_deliveries;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_preferences where user_id=p_user and enabled and 'email'=any(channels);
 if not found or not (pref.daily_briefing or pref.favorite_briefing) or not exists(select 1 from notification_endpoints where user_id=p_user and channel='email') then return false;end if;
 day:=(now() at time zone pref.timezone)::date;
 if (p_event->>'date')::date is distinct from day or (p_event->>'kickoff')::timestamptz<=now()
 or coalesce((p_event->>'daily_revision')::bigint,0)<>pref.daily_revision
 or (pref.daily_not_before is not null and now()<pref.daily_not_before) then return false;end if;
 -- Les anciennes réservations, toutes révisions et types confondus, comptent aussi.
 if exists(select 1 from notification_briefing_runs r join notification_deliveries d on d.event_id=r.event_id
 where r.user_id=p_user and r.local_date=day and (d.attempts>0 or d.status in ('sent','sending','unknown'))) then return false;end if;
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=p_user),'free');
 insert into notification_events(user_id,event_key,payload)
 values(p_user,'briefing-unique:'||day,p_event||jsonb_build_object('briefing',true,'kinds',jsonb_build_array('daily')))
 on conflict(user_id,event_key) do nothing returning id into eid;
 if eid is null then
  select id into eid from notification_events where user_id=p_user and event_key='briefing-unique:'||day;
  select * into old from notification_deliveries where event_id=eid and channel='email';
  if old.attempts>0 or old.status<>'cancelled' then return false;end if;
  update notification_events set payload=p_event||jsonb_build_object('briefing',true,'kinds',jsonb_build_array('daily')) where id=eid;
  update notification_deliveries set status='pending',due_at=now(),error=null where id=old.id;
 else
  insert into notification_deliveries(event_id,user_id,channel,due_at,priority) values(eid,p_user,'email',now(),lim.priority);
 end if;
 insert into notification_briefing_runs(user_id,local_date,kind,revision,event_id) values(p_user,day,'daily',pref.daily_revision,eid)
 on conflict(user_id,local_date,kind,revision) do update set event_id=excluded.event_id;
 return true;
end $$;
-- Le snapshot reprend toujours les favoris du compte, sans copie manuelle dans les alertes.
create or replace function public.notification_briefing_snapshot(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('account',(select jsonb_build_object('bankroll',a.bankroll) from player_accounts a where a.user_id=p_user),
 'bets',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'status',b.status,'bet_type',b.bet_type,'stake',b.stake,'odds',b.odds,'selections',b.selections)) from bets b where b.user_id=p_user and b.status='pending'),'[]'::jsonb),
 'favorites',jsonb_build_object('teams',coalesce((select state->'favoriteTeams' from user_states where user_id=p_user),'[]'::jsonb),
 'leagues',coalesce((select state->'favoriteLeagues' from user_states where user_id=p_user),'[]'::jsonb)));
$$;
revoke all on function public.enqueue_notification_briefing(uuid,jsonb),public.notification_briefing_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.enqueue_notification_briefing(uuid,jsonb),public.notification_briefing_snapshot(uuid) to service_role;
notify pgrst,'reload schema';
commit;
