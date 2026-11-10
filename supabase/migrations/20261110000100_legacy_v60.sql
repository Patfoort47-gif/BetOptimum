-- BET-258 : retrait définitif du canal et de ses destinations privées. Après V59.
begin;
-- Les tables des deux canaux actifs et leurs consentements sont conservés.
delete from public.notification_events e where e.payload->>'telegram'='true' or e.payload->>'test_channel'='telegram' or e.event_key like 'telegram:%' or e.event_key like 'telegram-test:%' or (exists(select 1 from public.notification_deliveries d where d.event_id=e.id and d.channel='telegram') and not exists(select 1 from public.notification_deliveries d where d.event_id=e.id and d.channel<>'telegram'));
delete from public.notification_deliveries where channel='telegram';
delete from public.notification_endpoints where channel='telegram';
update public.notification_events set payload=payload-'telegram' where payload?'telegram';
update public.notification_preferences set channels=array_remove(channels,'telegram') where 'telegram'=any(channels);
create or replace function public.unsubscribe_notifications()
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 perform disconnect_web_notifications();
 update notification_preferences set enabled=false,channels='{}',consent_at=null,updated_at=now() where user_id=auth.uid();
 delete from notification_endpoints where user_id=auth.uid();
 update notification_deliveries set status='cancelled' where user_id=auth.uid() and status in ('pending','sending');
 return true;
end $$;
drop function if exists public.unsubscribe_notifications_before_web();
drop function if exists public.unsubscribe_notifications_before_telegram();
-- L'export revient aux seules préférences actives sans changer les autres données du compte.
do $$ begin
 if to_regprocedure('public.export_my_data_before_push()') is null and to_regprocedure('public.export_my_data_before_telegram()') is not null then
  alter function public.export_my_data_before_telegram() rename to export_my_data_before_push;
 end if;
 if to_regprocedure('public.export_my_data_before_push()') is not null then
  execute 'revoke all on function public.export_my_data_before_push() from public,anon,authenticated';
  execute $ddl$create or replace function public.export_my_data() returns jsonb language plpgsql security definer set search_path=public as $fn$begin if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;return export_my_data_before_push()||jsonb_build_object('web_notifications',my_web_notifications());end; $fn$ $ddl$;
 end if;
end $$;
drop function if exists public.export_my_data_before_web();
drop function if exists public.my_telegram_notifications();
drop function if exists public.save_telegram_notifications(jsonb);
drop function if exists public.disconnect_telegram_notifications();
drop function if exists public.notification_telegram_snapshot(uuid);
drop function if exists public.enqueue_telegram_notification(uuid,jsonb);
drop function if exists public.claim_telegram_notifications();
drop table if exists public.notification_telegram_preferences;
drop table if exists public.notification_pairings;
do $$ declare c record;begin
 for c in select conname,conrelid::regclass rel from pg_constraint where contype='c' and conrelid in ('public.notification_preferences'::regclass,'public.notification_endpoints'::regclass) and pg_get_constraintdef(oid) like '%telegram%' loop
  execute format('alter table %s drop constraint %I',c.rel,c.conname);
 end loop;
end $$;
alter table public.notification_preferences drop constraint if exists notification_active_channels;
alter table public.notification_preferences add constraint notification_active_channels check(channels <@ array['web','email','discord']::text[]);
alter table public.notification_endpoints drop constraint if exists notification_active_endpoint;
alter table public.notification_endpoints add constraint notification_active_endpoint check(channel in ('web','email','discord'));
alter table public.notification_deliveries drop constraint if exists notification_active_delivery;
alter table public.notification_deliveries add constraint notification_active_delivery check(channel in ('web','email','discord'));
notify pgrst,'reload schema';
commit;
