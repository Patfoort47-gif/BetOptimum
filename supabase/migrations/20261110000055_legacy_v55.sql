-- BET-243 : ordonnanceur privé et lots distincts pour les rappels. Après V54.
begin;
create table if not exists public.notification_scheduler (
 singleton boolean primary key default true check(singleton),
 endpoint text check(endpoint ~ '^https://[a-z0-9]+[.]supabase[.]co/functions/v1/notifications$'),
 enabled boolean not null default false,
 dry_run boolean not null default true,
 lease_until timestamptz,
 last_started_at timestamptz,
 last_finished_at timestamptz,
 last_success_at timestamptz,
 last_ok boolean,
 last_queued int not null default 0,
 last_sent int not null default 0
);
insert into public.notification_scheduler(singleton) values(true) on conflict do nothing;
alter table public.notification_scheduler enable row level security;
revoke all on public.notification_scheduler from public,anon,authenticated;
grant select,update on public.notification_scheduler to service_role;
create or replace function public.claim_notification_scheduler()
returns boolean language plpgsql security definer set search_path=public as $$
begin
 update notification_scheduler set lease_until=now()+interval '2 minutes',last_started_at=now()
 where singleton and enabled and not dry_run and coalesce(lease_until,'-infinity'::timestamptz)<=now();
 return found;
end $$;
create or replace function public.finish_notification_scheduler(p_ok boolean,p_queued int,p_sent int)
returns void language sql security definer set search_path=public as $$
 update notification_scheduler set lease_until=null,last_finished_at=now(),last_ok=p_ok,
 last_success_at=case when p_ok then now() else last_success_at end,last_queued=p_queued,last_sent=p_sent where singleton;
$$;
create or replace function public.claim_web_notification_batch(p_reminders_only boolean)
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare item record; row notification_deliveries; pref notification_web_preferences; payload jsonb; minute int; day date;
begin
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where channel='web' and status='sending' and claimed_at<now()-interval '10 minutes';
 for item in select id,user_id from notification_deliveries where channel='web' and status='pending' and due_at<=now() and exists(select 1 from notification_events e where e.id=notification_deliveries.event_id and coalesce((e.payload->>'favorite_reminder')::boolean,false)=p_reminders_only) order by id limit 50 loop
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
create or replace function public.claim_web_notifications()
returns setof public.notification_deliveries language sql security definer set search_path=public as $$
 select * from claim_web_notification_batch(false);
$$;
create or replace function public.claim_favorite_reminders()
returns setof public.notification_deliveries language sql security definer set search_path=public as $$
 select * from claim_web_notification_batch(true);
$$;
revoke all on function public.claim_notification_scheduler(),public.finish_notification_scheduler(boolean,int,int),public.claim_web_notification_batch(boolean),public.claim_web_notifications(),public.claim_favorite_reminders() from public,anon,authenticated;
grant execute on function public.claim_notification_scheduler(),public.finish_notification_scheduler(boolean,int,int),public.claim_web_notification_batch(boolean),public.claim_web_notifications(),public.claim_favorite_reminders() to service_role;
notify pgrst,'reload schema';
commit;
