-- BET-260 : purge horaire des images expirées ou dont le compte n’existe plus.
create or replace function public.tick_ticket_preview_cleanup()
returns bigint language plpgsql security definer set search_path=pg_catalog,public as $$
declare endpoint text; secret text; request_id bigint;
begin
 select replace(s.endpoint,'/notifications','/ticket-preview') into endpoint from public.notification_scheduler s where singleton;
 select decrypted_secret into secret from vault.decrypted_secrets where name='betoptimum_notification_scheduler';
 if endpoint is null or secret is null then return null;end if;
 select net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-scheduler-secret',secret),body:='{}'::jsonb,timeout_milliseconds:=55000) into request_id;return request_id;
end $$;
revoke all on function public.tick_ticket_preview_cleanup() from public,anon,authenticated,service_role;
select cron.schedule('betoptimum-ticket-previews-cleanup','12 * * * *','select public.tick_ticket_preview_cleanup();');
