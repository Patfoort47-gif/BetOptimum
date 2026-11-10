-- BET-203 : provenance de copie vérifiée. Après V48 ; compatible avec le retrait H1 V49.
begin;
create or replace function public.place_bet(p_selections jsonb, p_stake numeric, p_counts_general boolean default false,
  p_bet_type text default 'combined', p_formula text default null, p_client_ref uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); acct public.player_accounts; bet public.bets; sel jsonb; fx public.fixtures;
  stake numeric := round(p_stake, 2); n int; k text; announced numeric; stored numeric; items jsonb := '[]'::jsonb;
  total numeric := 1; seen text[] := array[]::text[]; lines jsonb; line jsonb; leg int; line_count int; line_odds numeric; line_stake numeric;
  source_nickname text;
  line_json jsonb := '[]'::jsonb; avg_odds numeric := 0; leg_label text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_bet_type not in ('single','combined','multiple') then raise exception 'TYPE_INVALIDE'; end if;
  if jsonb_typeof(p_selections) <> 'array' then raise exception 'SELECTIONS_INVALIDES'; end if;
  n := jsonb_array_length(p_selections);
  if n < 1 or n > 12 or (p_bet_type = 'single' and n <> 1) or (p_bet_type = 'combined' and n < 2) or (p_bet_type = 'multiple' and n < 3) then
    raise exception 'SELECTIONS_INVALIDES';
  end if;
  if stake is null or stake <= 0 or stake > 1000000 then raise exception 'MISE_INVALIDE'; end if;
  perform public.ensure_player_account();
  select * into acct from public.player_accounts where user_id = uid for update;
  if p_client_ref is not null then
    select * into bet from public.bets where user_id = uid and client_ref = p_client_ref;
    if found then return to_jsonb(bet); end if;
  end if;
  if stake > acct.bankroll then raise exception 'BANKROLL_INSUFFISANTE'; end if;

  for sel in select * from jsonb_array_elements(p_selections) loop
    k := sel->>'key';
    if k is null or public.market_label(k, '', '') is null then raise exception 'SELECTIONS_INVALIDES'; end if;
    select * into fx from public.fixtures where id = sel->>'matchId';
    if not found then raise exception 'MATCH_INCONNU: %', coalesce(sel->>'matchId', ''); end if;
    if fx.completed or fx.voided or fx.kickoff <= now() then raise exception 'MATCH_COMMENCE: %', fx.id; end if;
    if fx.id = any(seen) then raise exception 'MATCH_EN_DOUBLE: %', fx.id; end if;
    seen := seen || fx.id;
    stored := nullif(fx.odds->>k, '')::numeric;
    if stored is null or stored <= 1 then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    begin announced := (sel->>'odd')::numeric; exception when others then announced := null; end;
    if announced is null or abs(announced - stored) / stored > 0.02 then raise exception 'COTE_CHANGEE: %', fx.id; end if;
    if k not in ('home','draw','away','over','btts') and coalesce(fx.odds_source->>k,'') <> 'real' then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    if k ~ '^(score|eh|homeMargin|awayMargin|marginDraw|combo|h1)' or k ~ '^(over|under)(05|45|55|65|75|85|95)$' then
      if coalesce((fx.market_valid_until->>k)::timestamptz <= now(), true) then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    end if;
    if coalesce((fx.odds_bookmaker_counts->>k)::int,0)<10 or coalesce(fx.odds_source->>k,'')<>'real' then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    leg_label := public.market_label(k, fx.home, fx.away);
    items := items || jsonb_build_object('matchId', fx.id, 'key', k, 'label', leg_label, 'odd', stored,
      'home', fx.home, 'away', fx.away, 'match', fx.home || ' - ' || fx.away, 'league', fx.league,
      'kickoff', fx.kickoff, 'date', to_char(fx.kickoff at time zone 'Europe/Paris', 'YYYY-MM-DD'),
      'time', to_char(fx.kickoff at time zone 'Europe/Paris', 'HH24:MI'));
    if sel ? 'sourceBetId' then
      source_nickname := null;
      select p.nickname into source_nickname from public.public_bets b join public.public_profiles p on p.user_id=b.user_id
      where b.id=(sel->>'sourceBetId')::uuid and b.selections @> jsonb_build_array(jsonb_build_object('matchId',fx.id,'key',k));
      if source_nickname is null then raise exception 'SELECTIONS_INVALIDES'; end if;
      items := jsonb_set(items,array[(jsonb_array_length(items)-1)::text],items->(jsonb_array_length(items)-1)||jsonb_build_object('sourceBetId',sel->>'sourceBetId','sourceNickname',source_nickname));
    end if;
    total := total * stored;
  end loop;

  if p_bet_type = 'multiple' then
    lines := public.system_lines(n, coalesce(p_formula, 'auto'));
    line_count := jsonb_array_length(lines);
    if line_count = 0 then raise exception 'FORMULE_INVALIDE'; end if;
    line_stake := round(stake / line_count, 6);
    for line in select * from jsonb_array_elements(lines) loop
      line_odds := 1;
      for leg in select value::int from jsonb_array_elements_text(line) loop
        line_odds := line_odds * (items->leg->>'odd')::numeric;
      end loop;
      line_json := line_json || jsonb_build_object('indexes', line, 'odds', round(line_odds, 4), 'stake', line_stake);
      avg_odds := avg_odds + line_odds;
    end loop;
    total := avg_odds / line_count;
  end if;

  update public.player_accounts set bankroll = bankroll - stake, updated_at = now() where user_id = uid;
  insert into public.bets (user_id, client_ref, bet_type, stake, odds, counts_general, system_formula, system_lines, selections)
  values (uid, p_client_ref, p_bet_type, stake, round(total, 4), coalesce(p_counts_general, false) and p_bet_type <> 'multiple',
          case when p_bet_type = 'multiple' then coalesce(p_formula, 'auto') end,
          case when p_bet_type = 'multiple' then line_json end, items)
  returning * into bet;
  return to_jsonb(bet);
end $$;
commit;
