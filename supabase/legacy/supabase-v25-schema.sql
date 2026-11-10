-- BET-69 : inscription facultative à la newsletter, sans campagne ni envoi automatique.
-- Après V23. Réexécutable ; les comptes existants ne sont jamais inscrits automatiquement.
begin;
create table if not exists public.newsletter_subscriptions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check(status in ('pending','subscribed','unsubscribed')),
 consent_at timestamptz default now(),
 confirmed_at timestamptz,
 unsubscribed_at timestamptz,
 source text not null check(source in ('signup','profile'))
);
alter table public.newsletter_subscriptions enable row level security;
revoke all on public.newsletter_subscriptions from public,anon,authenticated;
grant all on public.newsletter_subscriptions to service_role;
create or replace function public.capture_newsletter_signup()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if TG_OP='INSERT' then
  if new.raw_user_meta_data->'newsletter_opt_in'='true'::jsonb then
   insert into newsletter_subscriptions(user_id,status,confirmed_at,source)
   values(new.id,case when new.email_confirmed_at is not null then 'subscribed' else 'pending' end,new.email_confirmed_at,'signup')
   on conflict do nothing;
  end if;
 elsif new.email_confirmed_at is not null then
  update newsletter_subscriptions set status='subscribed',confirmed_at=new.email_confirmed_at
   where user_id=new.id and status='pending';
 end if;
 return new;
end $$;
revoke all on function public.capture_newsletter_signup() from public,anon,authenticated;
drop trigger if exists newsletter_signup on auth.users;
create trigger newsletter_signup after insert or update of email_confirmed_at on auth.users
 for each row execute function public.capture_newsletter_signup();
create or replace function public.my_newsletter()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return coalesce((select to_jsonb(n)-'user_id' from newsletter_subscriptions n where user_id=auth.uid()),'{"status":"unsubscribed"}'::jsonb);
end $$;
create or replace function public.set_newsletter(p_subscribed boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); confirmed timestamptz;
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 select email_confirmed_at into confirmed from auth.users where id=uid;
 insert into newsletter_subscriptions(user_id,status,consent_at,confirmed_at,unsubscribed_at,source)
 values(uid,case when p_subscribed is true then case when confirmed is not null then 'subscribed' else 'pending' end else 'unsubscribed' end,
 case when p_subscribed is true then now() else null end,case when p_subscribed is true then confirmed else null end,case when p_subscribed is true then null else now() end,'profile')
 on conflict(user_id) do update set status=excluded.status,consent_at=case when p_subscribed is true then now() else newsletter_subscriptions.consent_at end,
 confirmed_at=excluded.confirmed_at,unsubscribed_at=excluded.unsubscribed_at,source='profile';
 return my_newsletter();
end $$;
revoke all on function public.my_newsletter(),public.set_newsletter(boolean) from public,anon,authenticated;
grant execute on function public.my_newsletter(),public.set_newsletter(boolean) to authenticated;
do $$begin
 if to_regprocedure('public.export_my_data_before_newsletter()') is null then
  alter function public.export_my_data() rename to export_my_data_before_newsletter;
 end if;
end$$;
revoke all on function public.export_my_data_before_newsletter() from public,anon,authenticated;
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return export_my_data_before_newsletter() || jsonb_build_object('newsletter',my_newsletter());
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
notify pgrst,'reload schema';
commit;
