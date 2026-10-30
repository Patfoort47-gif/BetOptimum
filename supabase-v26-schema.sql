-- BET-98 : après V24 (V25 newsletter indépendante). Réexécutable, aucun opt-in automatique.
begin;
alter table public.notification_preferences
 add column if not exists daily_briefing boolean not null default false,
 add column if not exists favorite_briefing boolean not null default false,
 add column if not exists briefing_minute int not null default 480 check(briefing_minute between 0 and 1439),
 add column if not exists favorite_lead_minutes int not null default 120 check(favorite_lead_minutes between 15 and 720);
-- Une réservation par compte / date locale / type, même après fusion ou annulation.
create table if not exists public.notification_briefing_runs (
 user_id uuid not null references auth.users on delete cascade,
 local_date date not null, kind text not null check(kind in ('daily','favorites')),
 event_id bigint references public.notification_events on delete set null,
 primary key(user_id,local_date,kind)
);
alter table public.notification_briefing_runs enable row level security;
revoke all on public.notification_briefing_runs from public,anon,authenticated;
grant all on public.notification_briefing_runs to service_role;
-- Conserver les validations V24 et sa règle de préservation des tests.
do $$ begin
 if to_regprocedure('public.save_notification_preferences_before_briefings(jsonb)') is null then
  alter function public.save_notification_preferences(jsonb) rename to save_notification_preferences_before_briefings;
 end if;
end $$;
revoke all on function public.save_notification_preferences_before_briefings(jsonb) from public,anon,authenticated;
create or replace function public.save_notification_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare daily boolean:=coalesce((p->>'daily_briefing')::boolean,false); favorites boolean:=coalesce((p->>'favorite_briefing')::boolean,false);
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if (daily or favorites) and (not coalesce((p->>'enabled')::boolean,false) or not coalesce(p->'channels' ? 'email',false)) then raise exception 'BRIEFING_EMAIL_REQUIRED';end if;
 perform save_notification_preferences_before_briefings(p);
 update notification_preferences set daily_briefing=daily,favorite_briefing=favorites,
 briefing_minute=coalesce((p->>'briefing_minute')::int,480),favorite_lead_minutes=coalesce((p->>'favorite_lead_minutes')::int,120)
 where user_id=auth.uid();
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
 where ((k='daily' and pref.daily_briefing) or (k='favorites' and pref.favorite_briefing))
 and not exists(select 1 from notification_briefing_runs r where r.user_id=p_user and r.local_date=day and r.kind=k);
 if coalesce(cardinality(kinds),0)=0 then return false;end if;
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=p_user),'free');
 insert into notification_events(user_id,event_key,payload)
 values(p_user,'briefing:'||day::text||':'||array_to_string(kinds,','),p_event||jsonb_build_object('briefing',true,'kinds',to_jsonb(kinds))) returning id into eid;
 insert into notification_briefing_runs(user_id,local_date,kind,event_id) select p_user,day,k,eid from unnest(kinds)k;
 insert into notification_deliveries(event_id,user_id,channel,due_at,priority) values(eid,p_user,'email',now(),lim.priority);
 -- La réservation survit à la purge des événements pendant 30 jours. Pas de donnée de compte dans le payload.
 delete from notification_briefing_runs where local_date<day-30;
 return true;
end $$;
revoke all on function public.enqueue_notification_briefing(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_notification_briefing(uuid,jsonb) to service_role;
-- Une seule requête / un même snapshot PostgreSQL pour le compte et les paris privés.
create or replace function public.notification_briefing_snapshot(p_user uuid)
returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'account',(select jsonb_build_object('bankroll',bankroll) from player_accounts where user_id=p_user),
 'bets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'status',status,'bet_type',bet_type,'stake',stake,'odds',odds,'selections',selections)) from bets where user_id=p_user and status='pending'),'[]'::jsonb))
$$;
revoke all on function public.notification_briefing_snapshot(uuid) from public,anon,authenticated;
grant execute on function public.notification_briefing_snapshot(uuid) to service_role;
notify pgrst,'reload schema';
commit;
