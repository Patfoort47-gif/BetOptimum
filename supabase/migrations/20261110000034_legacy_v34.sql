-- BET-144 : après V33. Aucun nouvel abonnement ni envoi depuis la migration.
begin;
alter table public.notification_preferences alter column briefing_minute set default 660;
-- Sans briefing activé ni autre horaire, l’ancien défaut devient 11 h.
-- Les horaires des abonnés sont conservés : aucune preuve d’un choix explicite à 15 h n’était stockée.
update public.notification_preferences set briefing_minute=660 where not daily_briefing and not favorite_briefing and briefing_minute=900;
update public.notification_preferences set channels=array_remove(channels,'web'),quiet_start=0,quiet_end=0;
update public.notification_deliveries set status='cancelled',error='Canal navigateur supprimé' where channel='web' and status='pending';
-- Conserve les paramètres avancés existants, force la nouvelle forme même depuis un ancien client.
do $$ begin
 if to_regprocedure('public.save_notification_preferences_before_unique(jsonb)') is null then
  alter function public.save_notification_preferences(jsonb) rename to save_notification_preferences_before_unique;
 end if;
end $$;
revoke all on function public.save_notification_preferences_before_unique(jsonb) from public,anon,authenticated;
create or replace function public.save_notification_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare old notification_preferences; normalized jsonb; daily boolean;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,69));
 select * into old from notification_preferences where user_id=auth.uid();
 daily:=coalesce((p->>'enabled')::boolean,false) and (coalesce((p->>'daily_briefing')::boolean,false) or coalesce((p->>'favorite_briefing')::boolean,false));
 normalized:=p||jsonb_build_object('channels',case when daily then jsonb_build_array('email') else '[]'::jsonb end,
 'daily_briefing',daily,'favorite_briefing',false,'teams','[]'::jsonb,'leagues','[]'::jsonb,'quiet_start',0,'quiet_end',0,
 'timezone',coalesce(p->>'timezone',old.timezone,'Europe/Paris'),
 'briefing_minute',coalesce((p->>'briefing_minute')::int,old.briefing_minute,660),
 'min_value',coalesce((p->>'min_value')::numeric,old.min_value,.05),
 'min_confidence',coalesce((p->>'min_confidence')::numeric,old.min_confidence,.6),
 'max_per_hour',coalesce(old.max_per_hour,3));
 return save_notification_preferences_before_unique(normalized);
end $$;
revoke all on function public.save_notification_preferences(jsonb) from public,anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;
create or replace function public.claim_notification_deliveries()
returns setof public.notification_deliveries language plpgsql security definer set search_path=public as $$
declare row notification_deliveries; pref notification_preferences; lim notification_plans; minute int; quiet boolean;
begin
 -- Un worker interrompu après remise au fournisseur n’est pas relancé automatiquement : résultat incertain, risque de doublon.
 update notification_deliveries set status='unknown',error='Résultat de livraison inconnu' where status='sending' and claimed_at<now()-interval '10 minutes';
 for row in select * from notification_deliveries where status='pending' and due_at<=now() order by priority desc,due_at,id limit 50 for update skip locked loop
  perform pg_advisory_xact_lock(hashtextextended(row.user_id::text,69));
  select * into pref from notification_preferences where user_id=row.user_id;
  select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=row.user_id),'free');
  if row.channel='web' or not pref.enabled or not row.channel=any(pref.channels) or not exists(select 1 from notification_endpoints where user_id=row.user_id and channel=row.channel) or exists(select 1 from notification_events where id=row.event_id and (payload->>'kickoff')::timestamptz<=now()) then
   update notification_deliveries set status='cancelled' where id=row.id;continue;
  end if;
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  quiet:=case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end;
  if quiet and not exists(select 1 from notification_events where id=row.event_id and payload->>'briefing'='true') then update notification_deliveries set due_at=now()+interval '1 minute' where id=row.id;continue;end if;
  if (select count(*) from notification_deliveries where user_id=row.user_id and channel=row.channel and claimed_at>now()-interval '1 hour')>=least(pref.max_per_hour,lim.max_per_hour) then
   update notification_deliveries set due_at=now()+interval '10 minutes' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;
  return next row;
 end loop;
end $$;
revoke all on function public.claim_notification_deliveries() from public,anon,authenticated;
grant execute on function public.claim_notification_deliveries() to service_role;
notify pgrst,'reload schema';
commit;
