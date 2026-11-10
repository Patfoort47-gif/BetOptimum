-- BET-199 : après V48. Retrait de l'économie virtuelle, sans destruction d'historique.
begin;
alter table public.profiles add column if not exists profile_frame text not null default 'none' check(profile_frame in ('none','lime','blue','gold'));
create or replace function public.set_profile_frame(p_frame text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if p_frame not in ('none','lime','blue','gold') or p_frame is null then raise exception 'AVATAR_INVALIDE';end if;
 update profiles set profile_frame=p_frame,updated_at=now() where user_id=auth.uid();
 return found;
end $$;
revoke all on function public.set_profile_frame(text) from public,anon;
grant execute on function public.set_profile_frame(text) to authenticated;
-- Ajout d'une colonne publique sans changer l'ordre ni les protections de la vue existante.
do $$ declare definition text; begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_profiles' and column_name='profile_frame') then
  definition:=rtrim(pg_get_viewdef('public.public_profiles'::regclass,true),'; '||chr(10));
  execute 'create or replace view public.public_profiles as select previous.*,p.profile_frame from ('||definition||') previous join public.profiles p on p.user_id=previous.user_id';
 end if;
end $$;
-- Les anciens RPC ne sont plus appelables depuis un ancien client ni depuis la console.
do $$ declare item record; begin
 for item in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('buy_item','sell_item','equip_item','unequip_slot','buy_shield','refill_bankroll','create_duel','accept_duel','close_duel') loop
  execute format('revoke all on function %s from public,anon,authenticated',item.signature);
 end loop;
end $$;
revoke all on public.inventories,public.equipped_items,public.streak_shields,public.duels,public.token_ledger from public,anon,authenticated;
revoke all on public.my_token_balance,public.hall_fortune from public,anon,authenticated;
-- Les ligues gratuites restent accessibles ; aucune entrée payante depuis un ancien client.
do $$ begin
 if to_regprocedure('public.join_special_league_before_cleanup(text)') is null then
  alter function public.join_special_league(text) rename to join_special_league_before_cleanup;
 end if;
end $$;
revoke all on function public.join_special_league_before_cleanup(text) from public,anon,authenticated;
create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 if not exists(select 1 from special_leagues where id=p_league and access='free') then raise exception 'LIGUE_INDISPONIBLE';end if;
 return join_special_league_before_cleanup(p_league);
end $$;
revoke all on function public.join_special_league(text) from public,anon;
grant execute on function public.join_special_league(text) to authenticated;
-- Les données historiques sont archivées : aucune suppression du profil, de l'avatar ou des paris.
notify pgrst,'reload schema';
commit;
