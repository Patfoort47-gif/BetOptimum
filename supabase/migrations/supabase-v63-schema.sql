-- BET-306 : après V62. Aucun accès anonyme au vérificateur de pseudo.
begin;
create table if not exists public.nickname_check_attempts(
 user_id uuid primary key references auth.users(id) on delete cascade,
 attempts timestamptz[] not null default '{}',
 updated_at timestamptz not null default now(),
 constraint nickname_check_attempts_bound check(cardinality(attempts)<=20)
);
alter table public.nickname_check_attempts enable row level security;
revoke all on table public.nickname_check_attempts from public,anon,authenticated;
create or replace function public.pseudo_disponible(p_nickname text)
returns boolean language plpgsql volatile security definer set search_path=public as $$
declare uid uuid:=auth.uid();recent timestamptz[];stamp timestamptz:=clock_timestamp();
begin
 if uid is null then raise exception 'AUTH_REQUIRED';end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,306));
 insert into public.nickname_check_attempts(user_id) values(uid) on conflict(user_id) do nothing;
 select coalesce(array_agg(t order by t),'{}'::timestamptz[]) into recent from public.nickname_check_attempts a cross join lateral unnest(a.attempts) t where a.user_id=uid and t>stamp-interval '1 minute';
 -- Les vingt appels précédents sont déjà validés ; l'exception suivante ne peut annuler ces appels.
 if cardinality(recent)>=20 then raise exception 'TROP_VERIFICATIONS_PSEUDO';end if;
 update public.nickname_check_attempts set attempts=array_append(recent,stamp),updated_at=stamp where user_id=uid;
 return public.pseudo_valide(p_nickname) and not exists(select 1 from public.profiles where lower(nickname)=lower(p_nickname) and user_id is distinct from uid);
end $$;
-- Le générateur interne révèle aussi si le souhait est déjà pris : aucun appel RPC direct.
revoke all on function public.pseudo_libre(text) from public,anon,authenticated;
revoke all on function public.pseudo_disponible(text) from public,anon;
grant execute on function public.pseudo_disponible(text) to authenticated;
commit;
