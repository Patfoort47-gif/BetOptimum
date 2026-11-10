-- BET-310 : après V64. Aucun nouvel abonnement des comptes existants.
begin;
alter table public.notification_web_preferences add column if not exists daily_challenge_reminder boolean not null default false;
alter table public.notification_web_preferences add column if not exists daily_challenge_consent_at timestamptz;
create or replace function public.clear_daily_challenge_consent()
returns trigger language plpgsql set search_path=public as $$
begin
 if not new.enabled then new.daily_challenge_reminder:=false;end if;
 if not new.daily_challenge_reminder then new.daily_challenge_consent_at:=null;end if;
 return new;
end $$;
drop trigger if exists clear_daily_challenge_consent on public.notification_web_preferences;
create trigger clear_daily_challenge_consent before insert or update on public.notification_web_preferences for each row execute function public.clear_daily_challenge_consent();
revoke all on function public.clear_daily_challenge_consent() from public,anon,authenticated;
create or replace function public.save_web_notifications(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare opted boolean:=coalesce((p->>'daily_challenge_reminder')::boolean,false);
begin
 perform save_web_notifications_before_essential(p);
 update notification_web_preferences set essential=coalesce((p->>'essential')::boolean,false),daily_summary=coalesce((p->>'daily_summary')::boolean,false),daily_challenge_reminder=opted,
 daily_challenge_consent_at=case when opted then coalesce(daily_challenge_consent_at,now()) else null end where user_id=auth.uid();
 return my_web_notifications();
end $$;
-- Le snapshot ne révèle aucun pronostic choisi, montant, cote, ni destination.
create or replace function public.notification_challenge_snapshot(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object('challenge',jsonb_build_object('day',c.day,'picks',coalesce((select jsonb_agg(jsonb_build_object('matchId',f.id,'kickoff',f.kickoff))
 from jsonb_array_elements(c.picks) item join fixtures f on f.id=item->>'matchId'
 where not f.completed and not f.voided and f.kickoff>now() and exists(select 1 from unnest(array['home','draw','away']) k where coalesce((f.odds_bookmaker_counts->>k)::int,0)>=10 and f.odds_source->>k='real' and coalesce((item->'odds'->>k)::numeric,0)>1 and (coalesce((item->'bookmakerCounts'->>k)::int,0)>=10 or (item->'odds'->>k)::numeric=(f.odds->>k)::numeric))),'[]'::jsonb)),
 'played',coalesce((select jsonb_agg(d.match_id) from daily_picks d where d.user_id=p_user and d.day=c.day),'[]'::jsonb))
 from daily_challenges c where c.day=(now() at time zone 'Europe/Paris')::date;
$$;
create or replace function public.daily_challenge_reminder_current(p_user uuid,p_event jsonb)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare pref notification_web_preferences; minute int; snap jsonb; expiry timestamptz; window_end timestamptz;
begin
 select * into pref from notification_web_preferences where user_id=p_user;
 if not found or not pref.enabled or not pref.daily_challenge_reminder or pref.daily_challenge_consent_at is null or pref.daily_challenge_consent_at>now() or pref.essential or not exists(select 1 from notification_endpoints where user_id=p_user and channel='web') then return false;end if;
 minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
 if minute<600 or minute>=615 or (case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end) then return false;end if;
 window_end:=((now() at time zone pref.timezone)::date+time '10:15') at time zone pref.timezone;
 expiry:=(p_event->>'expires_at')::timestamptz;
 if (coalesce((p_event->>'daily_challenge_reminder')::boolean,false) and p_event->>'challenge_day'=(now() at time zone 'Europe/Paris')::date::text and p_event->>'date'=(now() at time zone pref.timezone)::date::text and p_event->>'timezone'=pref.timezone and expiry>now() and expiry<=window_end and (p_event->>'kickoff')::timestamptz=expiry) is not true then return false;end if;
 snap:=notification_challenge_snapshot(p_user);
 return coalesce(exists(select 1 from jsonb_array_elements(snap->'challenge'->'picks') pick where not (coalesce(snap->'played','[]'::jsonb) ? (pick->>'matchId')) and (pick->>'kickoff')::timestamptz>now()),false);
end $$;
create or replace function public.enqueue_daily_challenge_reminder(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare eid bigint;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 if not daily_challenge_reminder_current(p_user,p_event) then return false;end if;
 insert into notification_events(user_id,event_key,payload) values(p_user,'daily-challenge:'||(p_event->>'challenge_day'),p_event) on conflict do nothing returning id into eid;
 if eid is null then return false;end if;
 insert into notification_deliveries(event_id,user_id,channel,due_at) values(eid,p_user,'web',now());return true;
end $$;
create or replace function public.claim_web_notification_batch(p_reminders_only boolean)
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare item record; row notification_deliveries; pref notification_web_preferences; payload jsonb; minute int; day date;
begin
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where channel='web' and status='sending' and claimed_at<now()-interval '10 minutes';
 for item in select id,user_id from notification_deliveries where channel='web' and status='pending' and due_at<=now() and exists(select 1 from notification_events e where e.id=notification_deliveries.event_id and ((coalesce((e.payload->>'favorite_reminder')::boolean,false) or coalesce((e.payload->>'daily_summary')::boolean,false) or coalesce((e.payload->>'daily_challenge_reminder')::boolean,false))=p_reminders_only or coalesce((e.payload->>'result_validated')::boolean,false))) order by id limit 50 loop
  perform pg_advisory_xact_lock(hashtextextended(item.user_id::text,69));
  select * into row from notification_deliveries where id=item.id and status='pending' for update skip locked;
  if not found then continue;end if;
  select * into pref from notification_web_preferences where user_id=row.user_id;
  select e.payload into payload from notification_events e where e.id=row.event_id;
  if (pref.essential and not coalesce((payload->>'result_validated')::boolean,false) and not(payload ? 'test_channel')) or not coalesce(pref.enabled,false) or not exists(select 1 from notification_endpoints where user_id=row.user_id and channel='web') or coalesce((payload->>'kickoff')::timestamptz,now())<=now() or (not(payload ? 'test_channel') and coalesce((payload->>'expires_at')::timestamptz,now())<=now()) then
   update notification_deliveries set status='cancelled' where id=row.id;continue;
  end if;
  if coalesce((payload->>'daily_challenge_reminder')::boolean,false) and not daily_challenge_reminder_current(row.user_id,payload) then update notification_deliveries set status='cancelled',error='Rappel du défi désactivé ou expiré' where id=row.id;continue;end if;
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

revoke all on function public.notification_challenge_snapshot(uuid),public.daily_challenge_reminder_current(uuid,jsonb),public.enqueue_daily_challenge_reminder(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.notification_challenge_snapshot(uuid),public.daily_challenge_reminder_current(uuid,jsonb),public.enqueue_daily_challenge_reminder(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
