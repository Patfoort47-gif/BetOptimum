-- BET-92 : réparer l’adhésion aux ligues de championnats (après V16 au minimum).
-- Réexécutable. Ne modifie ni les inscriptions existantes ni la bankroll.
begin;
do $$ begin
  if to_regclass('public.special_leagues') is null or to_regclass('public.token_ledger') is null then
    raise exception 'Exécutez les migrations du Club jusqu’à V16 avant V21.';
  end if;
end $$;
create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_league public.special_leagues; v_balance int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Même joueur, même verrou : deux onglets ne débitent pas deux entrées premium.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 79));
  select * into v_league from public.special_leagues
    where id = p_league and open and kind = 'competition' for share;
  if not found then raise exception 'LIGUE_FERMEE'; end if;
  if exists (select 1 from public.league_members where league_id = p_league and user_id = v_user) then
    return jsonb_build_object('joined', true);
  end if;
  -- Rejoindre une ligue n’exige pas de créer ou de migrer un compte de bankroll.
  -- Les paris continuent à passer exclusivement par les RPC certifiées habituelles.
  if v_league.access = 'premium' and v_league.token_price > 0 and not exists (
    select 1 from public.token_ledger where user_id = v_user and reason = 'league-entry' and ref = 'league:' || v_league.id
  ) then
    v_balance := public.lock_tokens(v_user);
    if v_balance < v_league.token_price then raise exception 'SOLDE_INSUFFISANT'; end if;
    insert into public.token_ledger(user_id, delta, reason, ref)
      values(v_user, -v_league.token_price, 'league-entry', 'league:' || v_league.id);
  end if;
  insert into public.league_members(league_id, user_id) values(p_league, v_user) on conflict do nothing;
  return jsonb_build_object('joined', true);
end $$;
revoke all on function public.join_special_league(text) from public, anon;
grant execute on function public.join_special_league(text) to authenticated;
notify pgrst, 'reload schema';
commit;
