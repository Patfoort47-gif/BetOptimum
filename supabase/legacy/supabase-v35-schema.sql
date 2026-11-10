-- BET-145 : après V34. Lecture contrôlée, sans ouvrir la table follows.
begin;
create or replace function public.profile_connections(p_user uuid, p_kind text default null, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not exists (select 1 from public.profiles p where p.user_id=p_user and (p.is_public or p.user_id=auth.uid())) then
    raise exception 'PROFIL_PRIVE';
  end if;
  if p_kind is null then
    return jsonb_build_object('followers',(select count(*) from public.follows where followed_id=p_user), 'following',(select count(*) from public.follows where follower_id=p_user));
  end if;
  if p_kind not in ('followers','following') or p_offset < 0 then raise exception 'PARAMETRE_INVALIDE'; end if;
  with people as (
    select p.user_id,p.nickname from public.follows f join public.profiles p
      on p.user_id=case when p_kind='followers' then f.follower_id else f.followed_id end
    where (case when p_kind='followers' then f.followed_id else f.follower_id end)=p_user
      and (p.is_public or p.user_id=auth.uid())
    order by p.nickname,p.user_id limit 26 offset p_offset
  ), numbered as (select *,row_number() over (order by nickname,user_id) as n from people)
  select jsonb_build_object('rows',coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'nickname',nickname) order by n) filter(where n<=25),'[]'::jsonb),'more',count(*)>25) into result from numbered;
  return result;
end $$;
revoke all on function public.profile_connections(uuid,text,integer) from public;
grant execute on function public.profile_connections(uuid,text,integer) to anon,authenticated;
commit;
