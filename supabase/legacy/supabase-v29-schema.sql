-- BET-128 : après V28. Participation aux compétitions publiques gratuites.
-- Ajoute seulement les adhésions : aucun point, prono ou historique recalculé.
begin;
create or replace function public.enrol_public_competitions()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_TABLE_NAME = 'users' then
    insert into public.league_members(league_id,user_id)
      select id,new.id from public.special_leagues
      where open and kind='competition' and access='free'
      on conflict do nothing;
  elsif new.open and new.kind='competition' and new.access='free' then
    insert into public.league_members(league_id,user_id)
      select new.id,id from auth.users on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function public.enrol_public_competitions() from public,anon,authenticated;
drop trigger if exists users_public_competitions on auth.users;
create trigger users_public_competitions after insert on auth.users
  for each row execute function public.enrol_public_competitions();
drop trigger if exists leagues_public_competitions on public.special_leagues;
create trigger leagues_public_competitions after insert or update of open,kind,access on public.special_leagues
  for each row execute function public.enrol_public_competitions();
insert into public.league_members(league_id,user_id)
  select l.id,u.id from public.special_leagues l cross join auth.users u
  where l.open and l.kind='competition' and l.access='free'
  on conflict do nothing;
-- Protéger l’ancien RPC avant qu’il puisse supprimer les points d’une ligue automatique.
do $$ begin
  if to_regprocedure('public.leave_special_league_before_auto(text)') is null then
    alter function public.leave_special_league(text) rename to leave_special_league_before_auto;
  end if;
end $$;
revoke all on function public.leave_special_league_before_auto(text) from public,anon,authenticated;
create or replace function public.leave_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if exists(select 1 from public.special_leagues where id=p_league and kind='competition' and access='free') then
    raise exception 'PARTICIPATION_AUTOMATIQUE';
  end if;
  return public.leave_special_league_before_auto(p_league);
end $$;
revoke all on function public.leave_special_league(text) from public,anon;
grant execute on function public.leave_special_league(text) to authenticated;
notify pgrst,'reload schema';
commit;
