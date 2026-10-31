-- BET-98 : après V26. Nouveau défaut à 15 h dans le fuseau utilisateur.
-- Les horaires déjà enregistrés et tous les consentements sont conservés.
begin;
alter table public.notification_preferences alter column briefing_minute set default 900;
create or replace function public.save_notification_preferences(p jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare daily boolean:=coalesce((p->>'daily_briefing')::boolean,false); favorites boolean:=coalesce((p->>'favorite_briefing')::boolean,false);
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if (daily or favorites) and (not coalesce((p->>'enabled')::boolean,false) or not coalesce(p->'channels' ? 'email',false)) then raise exception 'BRIEFING_EMAIL_REQUIRED';end if;
 perform save_notification_preferences_before_briefings(p);
 update notification_preferences set daily_briefing=daily,favorite_briefing=favorites,
 briefing_minute=coalesce((p->>'briefing_minute')::int,briefing_minute,900),favorite_lead_minutes=coalesce((p->>'favorite_lead_minutes')::int,120)
 where user_id=auth.uid();
 return my_notifications();
end $$;
revoke all on function public.save_notification_preferences(jsonb) from public,anon;
grant execute on function public.save_notification_preferences(jsonb) to authenticated;

notify pgrst,'reload schema';
commit;
