-- BET-246 : plafond commun aux opportunités, rappels, résultats et tests. Après V55.
begin;
alter table public.notification_web_preferences add column if not exists essential boolean not null default false;
do $$ begin
 if to_regprocedure('public.save_web_notifications_before_essential(jsonb)') is null then
  alter function public.save_web_notifications(jsonb) rename to save_web_notifications_before_essential;
 end if;
end $$;
revoke all on function public.save_web_notifications_before_essential(jsonb) from public,anon,authenticated;
create or replace function public.save_web_notifications(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 perform save_web_notifications_before_essential(p);
 update notification_web_preferences set essential=coalesce((p->>'essential')::boolean,false) where user_id=auth.uid();
 return my_web_notifications();
end $$;
grant execute on function public.save_web_notifications(jsonb) to authenticated;
create or replace function public.enqueue_web_notification(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_web_preferences; eid bigint; event_key text; test boolean:=coalesce(p_event->>'test_channel'='web',false); reminder boolean:=coalesce((p_event->>'favorite_reminder')::boolean,false);
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_web_preferences where user_id=p_user and enabled;
 if pref.essential and not test then return false;end if;
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

create or replace function public.claim_web_notification_batch(p_reminders_only boolean)
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare item record; row notification_deliveries; pref notification_web_preferences; payload jsonb; minute int; day date;
begin
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where channel='web' and status='sending' and claimed_at<now()-interval '10 minutes';
 for item in select id,user_id from notification_deliveries where channel='web' and status='pending' and due_at<=now() and exists(select 1 from notification_events e where e.id=notification_deliveries.event_id and (coalesce((e.payload->>'favorite_reminder')::boolean,false)=p_reminders_only or coalesce((e.payload->>'result_validated')::boolean,false))) order by id limit 50 loop
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
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  if (case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end) then
   update notification_deliveries set due_at=now()+interval '5 minutes' where id=row.id;continue;
  end if;
  day:=(now() at time zone pref.timezone)::date;
  if (select count(*) from notification_deliveries d where d.user_id=row.user_id and d.channel='web' and d.id<>row.id and d.attempts>0 and (d.claimed_at at time zone pref.timezone)::date=day)>=pref.max_per_day then
   update notification_deliveries set status='cancelled',error='Plafond quotidien navigateur atteint' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;return next row;
 end loop;
end $$;

-- Uniquement une transition réellement validée par le serveur, jamais de rattrapage d’anciennes alertes.
create or replace function public.notify_validated_bet()
returns trigger language plpgsql security definer set search_path=public as $$
declare eid bigint;
begin
 if old.status<>'pending' or new.status not in ('won','lost','void') then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,69));
 if not exists(select 1 from notification_web_preferences where user_id=new.user_id and enabled and essential) or not exists(select 1 from notification_endpoints where user_id=new.user_id and channel='web') then return new;end if;
 insert into notification_events(user_id,event_key,payload) values(new.user_id,'validated-result:'||new.id,jsonb_build_object('result_validated',true,'bet_id',new.id,'status',new.status,'web',true,'kickoff',now()+interval '24 hours','expires_at',now()+interval '24 hours')) on conflict do nothing returning id into eid;
 if eid is not null then insert into notification_deliveries(event_id,user_id,channel,due_at) values(eid,new.user_id,'web',now());end if;
 return new;
end $$;
drop trigger if exists bets_notify_validated on public.bets;
create trigger bets_notify_validated after update of status on public.bets for each row execute function public.notify_validated_bet();
revoke all on function public.notify_validated_bet() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
