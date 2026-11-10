-- BET-69 : alertes privées. Après V17. Réexécutable, aucun envoi activé par défaut.
begin;
create table if not exists public.notification_plans (
 id text primary key, max_favorites int not null check(max_favorites between 1 and 10000),
 max_external int not null check(max_external between 0 and 3), max_per_hour int not null check(max_per_hour between 1 and 100),
 odds_step numeric not null check(odds_step between .01 and 1), priority int not null default 0
);
insert into public.notification_plans values ('free',5,1,3,.1,0),('premium',10000,3,20,.05,10) on conflict do nothing;
create table if not exists public.notification_entitlements (user_id uuid primary key references auth.users on delete cascade, plan text not null references public.notification_plans);
create table if not exists public.notification_preferences (
 user_id uuid primary key references auth.users on delete cascade, enabled boolean not null default false,
 channels text[] not null default '{}', teams text[] not null default '{}', leagues text[] not null default '{}',
 min_value numeric not null default .05 check(min_value between 0 and 10), min_confidence numeric not null default .6 check(min_confidence between 0 and 1),
 quiet_start int not null default 1320 check(quiet_start between 0 and 1439), quiet_end int not null default 480 check(quiet_end between 0 and 1439),
 timezone text not null default 'Europe/Paris', max_per_hour int not null default 3 check(max_per_hour between 1 and 100),
 consent_at timestamptz, updated_at timestamptz not null default now(),
 check(channels <@ array['web','telegram','discord','email']::text[]), check(cardinality(channels)<=4)
);
create table if not exists public.notification_endpoints (
 user_id uuid references auth.users on delete cascade, channel text check(channel in ('web','telegram','discord','email')),
 encrypted text not null, created_at timestamptz not null default now(), primary key(user_id,channel)
);
create table if not exists public.notification_pairings (
 code_hash text primary key, user_id uuid not null references auth.users on delete cascade, expires_at timestamptz not null default now()+interval '10 minutes', unique(user_id)
);
create table if not exists public.notification_events (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade,
 event_key text not null, payload jsonb not null, created_at timestamptz not null default now(), unique(user_id,event_key)
);
create table if not exists public.notification_deliveries (
 id bigint generated always as identity primary key, event_id bigint not null references public.notification_events on delete cascade,
 user_id uuid not null references auth.users on delete cascade, channel text not null,
 status text not null default 'pending' check(status in ('pending','sending','sent','failed','unknown','cancelled')),
 due_at timestamptz not null, attempts int not null default 0, sent_at timestamptz, claimed_at timestamptz,
 error text, priority int not null default 0, unique(event_id,channel)
);
create index if not exists notification_queue on public.notification_deliveries(status,due_at,priority);
alter table public.notification_plans enable row level security;
alter table public.notification_entitlements enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_endpoints enable row level security;
alter table public.notification_pairings enable row level security;
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
-- Seuls les RPC contrôlés exposent les données du propriétaire. Les destinations chiffrées restent réservées au serveur.
revoke all on public.notification_plans,public.notification_entitlements,public.notification_preferences,public.notification_endpoints,public.notification_pairings,public.notification_events,public.notification_deliveries from anon,authenticated;
grant all on public.notification_plans,public.notification_entitlements,public.notification_preferences,public.notification_endpoints,public.notification_pairings,public.notification_events,public.notification_deliveries to service_role;
grant usage,select on sequence public.notification_events_id_seq,public.notification_deliveries_id_seq to service_role;
create or replace function public.my_notifications()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
 if uid is null then raise exception 'AUTH_REQUIRED'; end if;
 insert into notification_preferences(user_id) values(uid) on conflict do nothing;
 select jsonb_build_object('preferences',to_jsonb(p),'plan',to_jsonb(l),
 'endpoints',coalesce((select jsonb_agg(channel) from notification_endpoints where user_id=uid),'[]'),
 'history',coalesce((select jsonb_agg(to_jsonb(d)) from (select channel,status,due_at,sent_at,error from notification_deliveries where user_id=uid order by id desc limit 50)d),'[]')) into result
 from notification_preferences p join notification_plans l on l.id=coalesce((select plan from notification_entitlements where user_id=uid),'free') where p.user_id=uid;
 return result;
end $$;
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
 update notification_deliveries set status='cancelled' where user_id=uid and status='pending';
 return my_notifications();
end $$;
create or replace function public.unsubscribe_notifications()
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 update notification_preferences set enabled=false,channels='{}',consent_at=null,updated_at=now() where user_id=auth.uid();
 delete from notification_endpoints where user_id=auth.uid();delete from notification_pairings where user_id=auth.uid();
 update notification_deliveries set status='cancelled' where user_id=auth.uid() and status in ('pending','sending');
 return true;
end $$;
-- Appelé uniquement par le détecteur serveur : la contrainte unique rend les passages suivants idempotents.
create or replace function public.enqueue_notification(p_user uuid,p_key text,p_event jsonb,p_due timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare eid bigint; pref notification_preferences; lim notification_plans;
begin
 select * into pref from notification_preferences where user_id=p_user and enabled;
 if not found or p_due>=(p_event->>'kickoff')::timestamptz then return false;end if;
 select * into lim from notification_plans where id=coalesce((select plan from notification_entitlements where user_id=p_user),'free');
 insert into notification_events(user_id,event_key,payload) values(p_user,p_key,p_event) on conflict do nothing returning id into eid;
 if eid is null then return false;end if;
 insert into notification_deliveries(event_id,user_id,channel,due_at,priority)
 select eid,p_user,c,p_due,lim.priority from unnest(pref.channels)c join notification_endpoints e on e.user_id=p_user and e.channel=c where not(p_event ? 'test_channel') or c=p_event->>'test_channel';
 return true;
end $$;
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
  if not pref.enabled or not row.channel=any(pref.channels) or not exists(select 1 from notification_endpoints where user_id=row.user_id and channel=row.channel) or exists(select 1 from notification_events where id=row.event_id and (payload->>'kickoff')::timestamptz<=now()) then
   update notification_deliveries set status='cancelled' where id=row.id;continue;
  end if;
  minute:=extract(hour from now() at time zone pref.timezone)::int*60+extract(minute from now() at time zone pref.timezone)::int;
  quiet:=case when pref.quiet_start=pref.quiet_end then false when pref.quiet_start<pref.quiet_end then minute>=pref.quiet_start and minute<pref.quiet_end else minute>=pref.quiet_start or minute<pref.quiet_end end;
  if quiet then update notification_deliveries set due_at=now()+interval '1 minute' where id=row.id;continue;end if;
  if (select count(*) from notification_deliveries where user_id=row.user_id and channel=row.channel and claimed_at>now()-interval '1 hour')>=least(pref.max_per_hour,lim.max_per_hour) then
   update notification_deliveries set due_at=now()+interval '10 minutes' where id=row.id;continue;
  end if;
  update notification_deliveries set status='sending',claimed_at=now(),attempts=attempts+1 where id=row.id returning * into row;
  return next row;
 end loop;
end $$;
revoke all on function public.my_notifications(),public.save_notification_preferences(jsonb),public.unsubscribe_notifications(),public.enqueue_notification(uuid,text,jsonb,timestamptz),public.claim_notification_deliveries() from public,anon,authenticated;
grant execute on function public.my_notifications(),public.save_notification_preferences(jsonb),public.unsubscribe_notifications() to authenticated;
grant execute on function public.enqueue_notification(uuid,text,jsonb,timestamptz),public.claim_notification_deliveries() to service_role;
-- Étend l’export existant sans exposer les destinations chiffrées ni les secrets.
do $$ begin
 if to_regprocedure('public.export_my_data_before_notifications()') is null then
  alter function public.export_my_data() rename to export_my_data_before_notifications;
 end if;
end $$;
revoke all on function public.export_my_data_before_notifications() from public,anon,authenticated;
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 return export_my_data_before_notifications() || jsonb_build_object('notifications',my_notifications());
end $$;
revoke all on function public.export_my_data() from public,anon;
grant execute on function public.export_my_data() to authenticated;
notify pgrst,'reload schema';
commit;
