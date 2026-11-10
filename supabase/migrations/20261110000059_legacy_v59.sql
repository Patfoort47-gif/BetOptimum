-- BET-257 : résumé éditorial quotidien, opt-in distinct et unicité par compte/date. Après V58.
begin;
alter table public.notification_web_preferences add column if not exists daily_summary boolean not null default false;
create or replace function public.save_web_notifications(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform save_web_notifications_before_essential(p);
 update notification_web_preferences set essential=coalesce((p->>'essential')::boolean,false),daily_summary=coalesce((p->>'daily_summary')::boolean,false) where user_id=auth.uid();
 return my_web_notifications();
end $$;
create or replace function public.enqueue_daily_web_summary(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_web_preferences; eid bigint; minute int;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_web_preferences where user_id=p_user and enabled and daily_summary and not essential;
 if not found or not exists(select 1 from notification_endpoints where user_id=p_user and channel='web') then return false;end if;
 minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
 if minute<540 or minute>=555 or not coalesce((p_event->>'daily_summary')::boolean,false) or p_event->>'date'<>(now() at time zone pref.timezone)::date::text or p_event->>'timezone'<>pref.timezone or jsonb_typeof(p_event->'picks') is distinct from 'array' then return false;end if;
 if jsonb_array_length(p_event->'picks') not between 1 and 3 or coalesce((p_event->>'expires_at')::timestamptz,now())<=now() then return false;end if;
 insert into notification_events(user_id,event_key,payload) values(p_user,'daily-summary:'||(p_event->>'date'),p_event) on conflict do nothing returning id into eid;
 if eid is null then return false;end if;
 insert into notification_deliveries(event_id,user_id,channel,due_at) values(eid,p_user,'web',now());return true;
end $$;
revoke all on function public.enqueue_daily_web_summary(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_daily_web_summary(uuid,jsonb) to service_role;
create or replace function public.claim_web_notification_batch(p_reminders_only boolean)
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare item record; row notification_deliveries; pref notification_web_preferences; payload jsonb; minute int; day date;
begin
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where channel='web' and status='sending' and claimed_at<now()-interval '10 minutes';
 for item in select id,user_id from notification_deliveries where channel='web' and status='pending' and due_at<=now() and exists(select 1 from notification_events e where e.id=notification_deliveries.event_id and ((coalesce((e.payload->>'favorite_reminder')::boolean,false) or coalesce((e.payload->>'daily_summary')::boolean,false))=p_reminders_only or coalesce((e.payload->>'result_validated')::boolean,false))) order by id limit 50 loop
  perform pg_advisory_xact_lock(hashtextextended(item.user_id::text,69));
  select * into row from notification_deliveries where id=item.id and status='pending' for update skip locked;
  if not found then continue;end if;
  select * into pref from notification_web_preferences where user_id=row.user_id;
  select e.payload into payload from notification_events e where e.id=row.event_id;
  if (pref.essential and not coalesce((payload->>'result_validated')::boolean,false) and not(payload ? 'test_channel')) or not coalesce(pref.enabled,false) or not exists(select 1 from notification_endpoints where user_id=row.user_id and channel='web') or coalesce((payload->>'kickoff')::timestamptz,now())<=now() or (not(payload ? 'test_channel') and coalesce((payload->>'expires_at')::timestamptz,now())<=now()) then
   update notification_deliveries set status='cancelled' where id=row.id;continue;
  end if;
  if coalesce((payload->>'favorite_reminder')::boolean,false) and (not pref.favorite_reminders or (payload->>'kickoff')::timestamptz-interval '105 minutes'<=now()) then
   update notification_deliveries set status='cancelled',error='Rappel désactivé ou expiré' where id=row.id;continue;
  end if;
  if coalesce((payload->>'daily_summary')::boolean,false) and (not pref.daily_summary or payload->>'date'<>(now() at time zone pref.timezone)::date::text or payload->>'timezone'<>pref.timezone) then update notification_deliveries set status='cancelled' where id=row.id;continue;end if;
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  if (case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end) then
   update notification_deliveries set due_at=now()+interval '5 minutes' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;return next row;
 end loop;
end $$;

notify pgrst,'reload schema';
commit;
