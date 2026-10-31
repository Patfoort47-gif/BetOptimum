-- BET-125 : après V27. Nouvelle réservation pour un changement explicite d’horaire.
-- Aucun consentement modifié, aucun email envoyé par la migration.
begin;
alter table public.notification_preferences
 add column if not exists daily_revision bigint not null default 0,
 add column if not exists daily_not_before timestamptz;
alter table public.notification_briefing_runs add column if not exists revision bigint not null default 0;
alter table public.notification_briefing_runs drop constraint if exists notification_briefing_runs_pkey;
alter table public.notification_briefing_runs add primary key(user_id,local_date,kind,revision);
create or replace function public.save_notification_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare daily boolean:=coalesce((p->>'daily_briefing')::boolean,false); favorites boolean:=coalesce((p->>'favorite_briefing')::boolean,false);
 oldpref notification_preferences; changed boolean; current_minute int;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if (daily or favorites) and (not coalesce((p->>'enabled')::boolean,false) or not coalesce(p->'channels' ? 'email',false)) then raise exception 'BRIEFING_EMAIL_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 select * into oldpref from notification_preferences where user_id=auth.uid();
 changed:=oldpref.user_id is not null and (coalesce((p->>'briefing_minute')::int,oldpref.briefing_minute)<>oldpref.briefing_minute or p->>'timezone' is distinct from oldpref.timezone);
 perform save_notification_preferences_before_briefings(p);
 update notification_preferences set daily_briefing=daily,favorite_briefing=favorites,
 briefing_minute=coalesce((p->>'briefing_minute')::int,briefing_minute,900),favorite_lead_minutes=coalesce((p->>'favorite_lead_minutes')::int,120)
 where user_id=auth.uid();
 if changed then
  select extract(hour from now() at time zone timezone)::int*60+extract(minute from now() at time zone timezone)::int into current_minute from notification_preferences where user_id=auth.uid();
  update notification_preferences set daily_revision=oldpref.daily_revision+1,
   daily_not_before=case when briefing_minute>current_minute then now() else (((now() at time zone timezone)::date+1)::timestamp at time zone timezone) end
   where user_id=auth.uid();
 end if;
 return my_notifications();
end $$;
revoke all on function public.save_notification_preferences(jsonb) from public,anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;

create or replace function public.enqueue_notification_briefing(p_user uuid,p_event jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare pref notification_preferences; lim notification_plans; kinds text[]; eid bigint; day date;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_preferences where user_id=p_user and enabled and 'email'=any(channels);
 if not found or not exists(select 1 from notification_endpoints where user_id=p_user and channel='email') then return false;end if;
 day:=(now() at time zone pref.timezone)::date;
 if (p_event->>'date')::date<>day or (p_event->>'kickoff')::timestamptz<=now() then return false;end if;
 select array_agg(distinct k order by k) into kinds from jsonb_array_elements_text(p_event->'kinds')k
 where ((k='daily' and pref.daily_briefing and coalesce((p_event->>'daily_revision')::bigint,0)=pref.daily_revision and (pref.daily_not_before is null or now()>=pref.daily_not_before)) or (k='favorites' and pref.favorite_briefing))
 and not exists(select 1 from notification_briefing_runs r where r.user_id=p_user and r.local_date=day and r.kind=k and r.revision=case when k='daily' then pref.daily_revision else 0 end);
 if coalesce(cardinality(kinds),0)=0 then return false;end if;
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=p_user),'free');
 insert into notification_events(user_id,event_key,payload)
 values(p_user,'briefing:'||day::text||':'||array_to_string(kinds,',')||':'||pref.daily_revision::text,p_event||jsonb_build_object('briefing',true,'kinds',to_jsonb(kinds),'daily_revision',pref.daily_revision)) returning id into eid;
 insert into notification_briefing_runs(user_id,local_date,kind,revision,event_id) select p_user,day,k,case when k='daily' then pref.daily_revision else 0 end,eid from unnest(kinds)k;
 insert into notification_deliveries(event_id,user_id,channel,due_at,priority) values(eid,p_user,'email',now(),lim.priority);
 -- La réservation survit à la purge des événements pendant 30 jours. Pas de donnée de compte dans le payload.
 delete from notification_briefing_runs where local_date<day-30;
 return true;
end $$;
revoke all on function public.enqueue_notification_briefing(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_notification_briefing(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
