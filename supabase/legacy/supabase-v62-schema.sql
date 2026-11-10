-- BET-304 : après V61. Réexécutable, codes historiques conservés.
begin;
do $$ begin
  if to_regprocedure('extensions.gen_random_bytes(integer)') is null then raise exception 'pgcrypto requis dans le schéma extensions'; end if;
end $$;
alter table public.private_leagues drop constraint if exists private_leagues_code_check;
alter table public.private_leagues add constraint private_leagues_code_check check (code ~ '^BM-([A-HJ-NP-Z2-9]{4}|[A-HJ-NP-Z2-9]{8})$');
create table if not exists public.private_join_attempts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 failures timestamptz[] not null default '{}',
 updated_at timestamptz not null default now(),
 constraint private_join_attempts_bound check (cardinality(failures)<=10)
);
alter table public.private_join_attempts enable row level security;
revoke all on table public.private_join_attempts from public,anon,authenticated;
create or replace function public.private_league_code()
returns text language plpgsql volatile security definer set search_path=public as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; candidate text; entropy bytea; i integer;
begin
 loop
  entropy:=extensions.gen_random_bytes(8);candidate:='BM-';
  for i in 0..7 loop candidate:=candidate||substr(alphabet,1+(get_byte(entropy,i)%32),1);end loop;
  exit when not exists(select 1 from public.private_leagues where code=candidate);
 end loop;
 return candidate;
end $$;
revoke all on function public.private_league_code() from public,anon,authenticated;
create or replace function public.join_private_league(p_code text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); league public.private_leagues; clean text:=upper(btrim(coalesce(p_code,''))); recent timestamptz[]; stamp timestamptz:=clock_timestamp();
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 -- Une erreur levée annulerait le compteur : les refus attendus sont des résultats JSON.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,304));
 insert into public.private_join_attempts(user_id) values(uid) on conflict(user_id) do nothing;
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into recent
 from public.private_join_attempts a cross join lateral unnest(a.failures) t where a.user_id=uid and t>stamp-interval '1 hour';
 if cardinality(recent)>=10 then return jsonb_build_object('error','TROP_ESSAIS_LIGUE');end if;
 if clean ~ '^BM([A-HJ-NP-Z2-9]{4}|[A-HJ-NP-Z2-9]{8})$' then clean:='BM-'||substr(clean,3);end if;
 select * into league from public.private_leagues where code=clean for update;
 if not found then
  update public.private_join_attempts set failures=array_append(recent,stamp),updated_at=stamp where user_id=uid;
  return jsonb_build_object('error','CODE_INVALIDE');
 end if;
 update public.private_join_attempts set failures=recent,updated_at=stamp where user_id=uid;
 if exists(select 1 from public.private_league_members where league_id=league.id and user_id=uid) then return to_jsonb(league);end if;
 if (select count(*) from public.private_league_members where league_id=league.id)>=50 then return jsonb_build_object('error','LIGUE_PLEINE');end if;
 perform public.ensure_player_account();
 insert into public.private_league_members(league_id,user_id) values(league.id,uid) on conflict do nothing;
 return to_jsonb(league);
end $$;
revoke all on function public.join_private_league(text) from public,anon;
grant execute on function public.join_private_league(text) to authenticated;
commit;
