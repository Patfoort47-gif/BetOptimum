-- BET-393 : une adresse modifiée ne conserve ni la destination ni son accord email.
begin;

create or replace function public.reset_notification_email_on_address_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_endpoints
  where user_id = new.id and channel = 'email';

  update public.notification_preferences
  set channels = array_remove(channels, 'email'),
      enabled = enabled and cardinality(array_remove(channels, 'email')) > 0,
      daily_briefing = false,
      favorite_briefing = false,
      consent_at = case when cardinality(array_remove(channels, 'email')) > 0 then consent_at end,
      updated_at = now()
  where user_id = new.id and 'email' = any(channels);

  update public.notification_deliveries
  set status = 'cancelled', error = 'Réassociez votre adresse email confirmée'
  where user_id = new.id and channel = 'email' and status in ('pending', 'sending');

  return new;
end;
$$;

revoke all on function public.reset_notification_email_on_address_change() from public, anon, authenticated;
drop trigger if exists reset_notification_email_on_address_change on auth.users;
create trigger reset_notification_email_on_address_change
after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function public.reset_notification_email_on_address_change();

commit;
