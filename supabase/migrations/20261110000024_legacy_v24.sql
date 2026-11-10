-- BET-69 : préserver et reprendre les tests annulés sans tentative d’envoi.
-- Après V23. Réexécutable. Aucun envoi automatique ni réactivation du consentement.
begin;
create or replace function public.save_notification_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); lim notification_plans; ch text[]; tm text[]; lg text[]; en boolean;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,69));
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=uid),'free');
 select coalesce(array_agg(distinct v),'{}') into ch from jsonb_array_elements_text(p->'channels')v;
 select coalesce(array_agg(distinct v),'{}') into tm from jsonb_array_elements_text(p->'teams')v;
 select coalesce(array_agg(distinct v),'{}') into lg from jsonb_array_elements_text(p->'leagues')v;
 if cardinality(tm)+cardinality(lg)>lim.max_favorites or (select count(*) from unnest(ch)c where c<>'web')>lim.max_external then raise exception 'NOTIFICATION_LIMIT'; end if;
 if exists(select 1 from unnest(tm||lg)v where length(v)>100) or not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'NOTIFICATION_INVALID'; end if;
 en:=coalesce((p->>'enabled')::boolean,false);
 if en and exists(select 1 from unnest(ch)c where not exists(select 1 from notification_endpoints where user_id=uid and channel=c)) then raise exception 'NOTIFICATION_ENDPOINT'; end if;
 insert into notification_preferences(user_id,enabled,channels,teams,leagues,min_value,min_confidence,quiet_start,quiet_end,timezone,max_per_hour,consent_at)
 values(uid,en,ch,tm,lg,(p->>'min_value')::numeric,(p->>'min_confidence')::numeric,(p->>'quiet_start')::int,(p->>'quiet_end')::int,p->>'timezone',least((p->>'max_per_hour')::int,lim.max_per_hour),case when en then now() else null end)
 on conflict(user_id) do update set enabled=excluded.enabled,channels=excluded.channels,teams=excluded.teams,leagues=excluded.leagues,min_value=excluded.min_value,min_confidence=excluded.min_confidence,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,timezone=excluded.timezone,max_per_hour=excluded.max_per_hour,consent_at=excluded.consent_at,updated_at=now();
 -- Les tests restent pertinents après modification des favoris ou des heures silencieuses.
 update notification_deliveries d set status='cancelled',error='Préférences modifiées'
 where d.user_id=uid and d.status='pending' and not (
  en and d.channel=any(ch)
  and exists(select 1 from notification_endpoints e where e.user_id=uid and e.channel=d.channel)
  and exists(select 1 from notification_events e where e.id=d.event_id and e.payload->>'test_channel'=d.channel)
 );
 return my_notifications();
end $$;

create or replace function public.enqueue_notification(p_user uuid,p_key text,p_event jsonb,p_due timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare eid bigint; pref notification_preferences; lim notification_plans;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,69));
 select * into pref from notification_preferences where user_id=p_user and enabled;
 if not found or p_due>=(p_event->>'kickoff')::timestamptz then return false;end if;
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=p_user),'free');
 insert into notification_events(user_id,event_key,payload) values(p_user,p_key,p_event) on conflict do nothing returning id into eid;
 if eid is null then
  -- Un nouveau clic peut reprendre uniquement un test annulé AVANT remise au fournisseur.
  if not (p_event ? 'test_channel') then return false;end if;
  select id into eid from notification_events where user_id=p_user and event_key=p_key
   and payload->>'test_channel'=p_event->>'test_channel' for update;
  if eid is null then return false;end if;
  update notification_deliveries d set status='pending',due_at=p_due,error=null
   where d.event_id=eid and d.channel=p_event->>'test_channel' and d.status='cancelled'
   and d.claimed_at is null and d.attempts=0 and d.channel=any(pref.channels)
   and exists(select 1 from notification_endpoints e where e.user_id=p_user and e.channel=d.channel);
  if not found then return false;end if;
  update notification_events set payload=p_event where id=eid;
  return true;
 end if;
 insert into notification_deliveries(event_id,user_id,channel,due_at,priority)
 select eid,p_user,c,p_due,lim.priority from unnest(pref.channels)c join notification_endpoints e on e.user_id=p_user and e.channel=c where not(p_event ? 'test_channel') or c=p_event->>'test_channel';
 return true;
end $$;

notify pgrst,'reload schema';
commit;
