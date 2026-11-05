-- BET-200 : navigateur facultatif, distinct de l'email. Après V48. Aucun abonnement automatique.
begin;
create table if not exists public.notification_web_preferences (
 user_id uuid primary key references auth.users on delete cascade,
 enabled boolean not null default false,
 min_value numeric not null default .10 check(min_value between .10 and 1),
 min_confidence numeric not null default .65 check(min_confidence between .65 and .95),
 max_per_day int not null default 2 check(max_per_day between 1 and 2),
 quiet_start int not null default 1320 check(quiet_start between 0 and 1439),
 quiet_end int not null default 480 check(quiet_end between 0 and 1439),
 timezone text not null default 'Europe/Paris',consent_at timestamptz,updated_at timestamptz not null default now()
);
alter table public.notification_web_preferences enable row level security;
revoke all on public.notification_web_preferences from public,anon,authenticated;
grant all on public.notification_web_preferences to service_role;
create or replace function public.my_web_notifications()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 insert into notification_web_preferences(user_id,timezone) values(auth.uid(),coalesce((select timezone from notification_preferences where user_id=auth.uid()),'Europe/Paris')) on conflict do nothing;
 return (select jsonb_build_object('preferences',to_jsonb(p),'associated',exists(select 1 from notification_endpoints where user_id=auth.uid() and channel='web')) from notification_web_preferences p where user_id=auth.uid());
end $$;
create or replace function public.save_web_notifications(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare active boolean:=coalesce((p->>'enabled')::boolean,false);
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'NOTIFICATION_INVALID';end if;
 if active and not exists(select 1 from notification_endpoints where user_id=auth.uid() and channel='web') then raise exception 'NOTIFICATION_ENDPOINT';end if;
 insert into notification_web_preferences(user_id,enabled,min_value,min_confidence,max_per_day,quiet_start,quiet_end,timezone,consent_at)
 values(auth.uid(),active,(p->>'min_value')::numeric,(p->>'min_confidence')::numeric,(p->>'max_per_day')::int,(p->>'quiet_start')::int,(p->>'quiet_end')::int,p->>'timezone',case when active then now() end)
 on conflict(user_id) do update set enabled=excluded.enabled,min_value=excluded.min_value,min_confidence=excluded.min_confidence,max_per_day=excluded.max_per_day,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,timezone=excluded.timezone,consent_at=case when excluded.enabled then coalesce(notification_web_preferences.consent_at,now()) end,updated_at=now();
 update notification_deliveries set status='cancelled',error='Préférences navigateur modifiées' where user_id=auth.uid() and channel='web' and status='pending';
 return my_web_notifications();
end $$;
create or replace function public.disconnect_web_notifications()
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 update notification_web_preferences set enabled=false,consent_at=null,updated_at=now() where user_id=auth.uid();
 delete from notification_endpoints where user_id=auth.uid() and channel='web';
 update notification_deliveries set status='cancelled',error='Désabonnement navigateur' where user_id=auth.uid() and channel='web' and status in ('pending','sending');
 return true;
end $$;
-- Ce snapshot ne contient ni bankroll ni pari ni destination.
create or replace function public.notification_web_snapshot(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('preferences',to_jsonb(p),'favorites',jsonb_build_object(
 'teams',coalesce((select state->'favoriteTeams' from user_states where user_id=p_user),'[]'::jsonb),
 'leagues',coalesce((select state->'favoriteLeagues' from user_states where user_id=p_user),'[]'::jsonb)))
 from notification_web_preferences p where user_id=p_user;
$$;
create or replace function public.enqueue_web_notification(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_web_preferences; eid bigint; event_key text; test boolean:=p_event->>'test_channel'='web';
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_web_preferences where user_id=p_user and enabled;
 if not found or not exists(select 1 from notification_endpoints where user_id=p_user and channel='web') then return false;end if;
 if not coalesce(test,false) and (not coalesce((p_event->>'web')::boolean,false) or coalesce((p_event->>'value')::numeric,0)<pref.min_value or coalesce((p_event->>'confidence')::numeric,0)<pref.min_confidence or coalesce((p_event->>'expires_at')::timestamptz,now())<=now() or coalesce((p_event->>'kickoff')::timestamptz,now())<=now()) then return false;end if;
 -- Un seul signal par match et jour, même si le palier, les réglages ou le marché changent.
 event_key:=case when test then 'web-test:'||floor(extract(epoch from now())/3600)::text else 'web:'||(now() at time zone pref.timezone)::date||':'||(p_event->>'match_id') end;
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
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  if (case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end) then
   update notification_deliveries set due_at=now()+interval '5 minutes' where id=row.id;continue;
  end if;
  day:=(now() at time zone pref.timezone)::date;
  if not(payload ? 'test_channel') and (select count(*) from notification_deliveries d join notification_events e on e.id=d.event_id where d.user_id=row.user_id and d.channel='web' and d.id<>row.id and d.attempts>0 and (d.claimed_at at time zone pref.timezone)::date=day and not(e.payload ? 'test_channel'))>=pref.max_per_day then
   update notification_deliveries set status='cancelled',error='Plafond quotidien navigateur atteint' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;return next row;
 end loop;
end $$;
-- Le désabonnement global arrête aussi navigateur, sans modifier le briefing autrement.
do $$ begin
 if to_regprocedure('public.unsubscribe_notifications_before_web()') is null then
  alter function public.unsubscribe_notifications() rename to unsubscribe_notifications_before_web;
 end if;
end $$;
revoke all on function public.unsubscribe_notifications_before_web() from public,anon,authenticated;
create or replace function public.unsubscribe_notifications()
returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform disconnect_web_notifications();return unsubscribe_notifications_before_web();
end $$;
revoke all on function public.my_web_notifications(),public.save_web_notifications(jsonb),public.disconnect_web_notifications(),public.notification_web_snapshot(uuid),public.enqueue_web_notification(uuid,jsonb),public.claim_web_notifications(),public.unsubscribe_notifications() from public,anon,authenticated;
grant execute on function public.my_web_notifications(),public.save_web_notifications(jsonb),public.disconnect_web_notifications(),public.unsubscribe_notifications() to authenticated;
grant execute on function public.notification_web_snapshot(uuid),public.enqueue_web_notification(uuid,jsonb),public.claim_web_notifications() to service_role;
-- L'export existant inclut les préférences privées, jamais les destinations.
do $$ begin
 if to_regprocedure('public.export_my_data_before_web()') is null and to_regprocedure('public.export_my_data()') is not null then
  alter function public.export_my_data() rename to export_my_data_before_web;
 end if;
end $$;
do $$ begin
 if to_regprocedure('public.export_my_data_before_web()') is not null then
  execute 'revoke all on function public.export_my_data_before_web() from public,anon,authenticated';
  execute $ddl$create or replace function public.export_my_data() returns jsonb language plpgsql security definer set search_path=public as $fn$begin if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;return export_my_data_before_web()||jsonb_build_object('web_notifications',my_web_notifications());end; $fn$ $ddl$;
  execute 'revoke all on function public.export_my_data() from public,anon';
  execute 'grant execute on function public.export_my_data() to authenticated';
 end if;
end $$;

notify pgrst,'reload schema';
commit;
