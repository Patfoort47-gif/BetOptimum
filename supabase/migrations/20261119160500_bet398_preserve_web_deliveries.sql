-- BET-398 : préserver les push en attente quand les préférences email changent.
begin;

create or replace function public.save_notification_preferences_before_briefings(p jsonb)
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
 -- Les push sont gérés séparément par les préférences navigateur.
 update notification_deliveries d set status='cancelled',error='Préférences modifiées'
 where d.user_id=uid and d.status='pending' and d.channel<>'web' and not (
  en and d.channel=any(ch)
  and exists(select 1 from notification_endpoints e where e.user_id=uid and e.channel=d.channel)
  and exists(select 1 from notification_events e where e.id=d.event_id and e.payload->>'test_channel'=d.channel)
 );
 return my_notifications();
end $$;

commit;
