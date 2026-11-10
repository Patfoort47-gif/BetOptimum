-- BET-242 : rappels de favoris à H-2, distincts des opportunités. Après V50.
begin;
alter table public.notification_web_preferences add column if not exists favorite_reminders boolean not null default false;

create or replace function public.save_web_notifications(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare active boolean:=coalesce((p->>'enabled')::boolean,false);
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'NOTIFICATION_INVALID';end if;
 if active and not exists(select 1 from notification_endpoints where user_id=auth.uid() and channel='web') then raise exception 'NOTIFICATION_ENDPOINT';end if;
 insert into notification_web_preferences(user_id,enabled,min_value,min_confidence,max_per_day,quiet_start,quiet_end,timezone,consent_at,favorite_reminders)
 values(auth.uid(),active,(p->>'min_value')::numeric,(p->>'min_confidence')::numeric,(p->>'max_per_day')::int,(p->>'quiet_start')::int,(p->>'quiet_end')::int,p->>'timezone',case when active then now() end,coalesce((p->>'favorite_reminders')::boolean,false))
 on conflict(user_id) do update set enabled=excluded.enabled,favorite_reminders=excluded.favorite_reminders,min_value=excluded.min_value,min_confidence=excluded.min_confidence,max_per_day=excluded.max_per_day,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,timezone=excluded.timezone,consent_at=case when excluded.enabled then coalesce(notification_web_preferences.consent_at,now()) end,updated_at=now();
 update notification_deliveries set status='cancelled',error='Préférences navigateur modifiées' where user_id=auth.uid() and channel='web' and status='pending';
 return my_web_notifications();
end $$;

create or replace function public.enqueue_web_notification(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_web_preferences; eid bigint; event_key text; test boolean:=coalesce(p_event->>'test_channel'='web',false); reminder boolean:=coalesce((p_event->>'favorite_reminder')::boolean,false);
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_web_preferences where user_id=p_user and enabled;
 if not found or not exists(select 1 from notification_endpoints where user_id=p_user and channel='web') then return false;end if;
 if not test and (not coalesce((p_event->>'web')::boolean,false) or coalesce((p_event->>'expires_at')::timestamptz,now())<=now() or coalesce((p_event->>'kickoff')::timestamptz,now())<=now()) then return false;end if;
 if reminder then
  if not pref.favorite_reminders or test or coalesce(p_event->>'match_id','')='' or
     (p_event->>'kickoff')::timestamptz-interval '2 hours'>now() or
     (p_event->>'kickoff')::timestamptz-interval '105 minutes'<=now() then return false;end if;
 elsif not test and (coalesce((p_event->>'value')::numeric,0)<pref.min_value or coalesce((p_event->>'confidence')::numeric,0)<pref.min_confidence) then return false;
 end if;
 -- Un seul rappel par match, y compris après report, reconnexion ou changement de jour.
 event_key:=case when reminder then 'favorite-reminder:'||(p_event->>'match_id') when test then 'web-test:'||floor(extract(epoch from now())/3600)::text else 'web:'||(now() at time zone pref.timezone)::date||':'||(p_event->>'match_id') end;
 insert into notification_events(user_id,event_key,payload) values(p_user,event_key,p_event) on conflict do nothing returning id into eid;
 if eid is null then return false;end if;
 insert into notification_deliveries(event_id,user_id,channel,due_at) values(eid,p_user,'web',now());return true;
end $$;

create or replace function public.claim_web_notifications()
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare item record; row notification_deliveries; pref notification_web_preferences; payload jsonb; minute int; day date;
begin
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where channel='web' and status='sending' and claimed_at<now()-interval '10 minutes';
 for item in select id,user_id from notification_deliveries where channel='web' and status='pending' and due_at<=now() order by id limit 50 loop
  perform pg_advisory_xact_lock(hashtextextended(item.user_id::text,69));
  select * into row from notification_deliveries where id=item.id and status='pending' for update skip locked;
  if not found then continue;end if;
  select * into pref from notification_web_preferences where user_id=row.user_id;
  select e.payload into payload from notification_events e where e.id=row.event_id;
  if not coalesce(pref.enabled,false) or not exists(select 1 from notification_endpoints where user_id=row.user_id and channel='web') or coalesce((payload->>'kickoff')::timestamptz,now())<=now() or (not(payload ? 'test_channel') and coalesce((payload->>'expires_at')::timestamptz,now())<=now()) then
   update notification_deliveries set status='cancelled' where id=row.id;continue;
  end if;
  if coalesce((payload->>'favorite_reminder')::boolean,false) and (not pref.favorite_reminders or (payload->>'kickoff')::timestamptz-interval '105 minutes'<=now()) then
   update notification_deliveries set status='cancelled',error='Rappel désactivé ou expiré' where id=row.id;continue;
  end if;
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  if (case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end) then
   update notification_deliveries set due_at=now()+interval '5 minutes' where id=row.id;continue;
  end if;
  day:=(now() at time zone pref.timezone)::date;
  if not(payload ? 'test_channel') and not coalesce((payload->>'favorite_reminder')::boolean,false) and (select count(*) from notification_deliveries d join notification_events e on e.id=d.event_id where d.user_id=row.user_id and d.channel='web' and d.id<>row.id and d.attempts>0 and (d.claimed_at at time zone pref.timezone)::date=day and not(e.payload ? 'test_channel') and not coalesce((e.payload->>'favorite_reminder')::boolean,false))>=pref.max_per_day then
   update notification_deliveries set status='cancelled',error='Plafond quotidien navigateur atteint' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;return next row;
 end loop;
end $$;

revoke all on function public.save_web_notifications(jsonb),public.enqueue_web_notification(uuid,jsonb),public.claim_web_notifications() from public,anon,authenticated;
grant execute on function public.save_web_notifications(jsonb) to authenticated;
grant execute on function public.enqueue_web_notification(uuid,jsonb),public.claim_web_notifications() to service_role;
notify pgrst,'reload schema';
commit;
