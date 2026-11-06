-- BET-243 : installer après V55. Réservé à l'administration Supabase.
-- Le secret doit aussi être configuré comme NOTIFICATION_SCHEDULER_SECRET dans la fonction Edge.
-- Ne jamais placer sa valeur dans ce fichier, dans cron.job ou dans le navigateur.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.tick_notification_scheduler()
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare config public.notification_scheduler; scheduler_secret text; request_id bigint;
begin
 select * into config from public.notification_scheduler where singleton;
 if not coalesce(config.enabled,false) or config.endpoint is null or config.lease_until>now() then return null;end if;
 select decrypted_secret into scheduler_secret from vault.decrypted_secrets where name='betoptimum_notification_scheduler';
 if scheduler_secret is null or length(scheduler_secret)<32 then raise exception 'NOTIFICATION_SCHEDULER_SECRET_REQUIRED';end if;
 select net.http_post(
  url:=config.endpoint,
  headers:=jsonb_build_object('Content-Type','application/json','x-scheduler-secret',scheduler_secret),
  body:=jsonb_build_object('action','scheduled-reminders','dry_run',config.dry_run),
  timeout_milliseconds:=55000
 ) into request_id;
 return request_id;
end $$;
revoke all on function public.tick_notification_scheduler() from public,anon,authenticated,service_role;
select cron.schedule('betoptimum-favorite-reminders','* * * * *','select public.tick_notification_scheduler();');
