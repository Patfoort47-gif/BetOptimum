-- BET-170 : après V39. Premier lot : choix manuels réglables au score à 90 minutes.
-- Aucune réécriture des sélections ou cotes historiques.
begin;
alter table public.fixtures add column if not exists market_valid_until jsonb not null default '{}'::jsonb;
create or replace function public.market_label(k text, home_team text, away_team text)
returns text language plpgsql immutable set search_path=public as $$
declare side text; direction text; line text; parts text[]; handicap int;
begin
 parts := regexp_match(k, '^score([0-9]|1[0-5])_([0-9]|1[0-5])$');
 if parts is not null then return 'Score exact ' || parts[1] || ' - ' || parts[2]; end if;
 parts := regexp_match(k, '^eh(Home|Draw|Away)(P[0-9]|M[1-9])$');
 if parts is not null then
  handicap := right(parts[2],1)::int * case when left(parts[2],1)='M' then -1 else 1 end;
  return 'Handicap européen ' || case when handicap>=0 then '+' else '' end || handicap::text || ' à domicile : ' || case parts[1] when 'Home' then home_team when 'Away' then away_team else 'Match nul' end;
 end if;
 parts := regexp_match(k, '^(home|away)Margin([1-9])(Plus)?$');
 if parts is not null then return case parts[1] when 'home' then home_team else away_team end || ' gagne de ' || parts[2] || ' but' || case when parts[2]='1' then '' else 's' end || case when parts[3]='Plus' then ' ou plus' else '' end; end if;
 if k='marginDraw0' then return 'Match nul 0 - 0'; end if;
 if k='marginDrawGoals' then return 'Match nul avec des buts'; end if;
 parts := regexp_match(k, '^(over|under)(05|45|55|65|75|85|95)$');
 if parts is not null then return case parts[1] when 'over' then 'Plus' else 'Moins' end || ' de ' || replace((parts[2]::numeric/10)::numeric(3,1)::text,'.',',') || ' buts'; end if;
 if k ~ '^(home|away)(Over|Under)(05|15|25|35|45|55)$' then
   side := case when k like 'home%' then home_team else away_team end;
   direction := case when k like '%Over%' then 'plus' else 'moins' end;
   line := replace(((right(k,2)::numeric)/10)::text,'.',',');
   return side || ' : ' || direction || ' de ' || line || ' buts';
 end if;
 return case k when 'home' then home_team when 'away' then away_team when 'draw' then 'Match nul'
 when 'over' then 'Plus de 2,5 buts' when 'under' then 'Moins de 2,5 buts'
 when 'over15' then 'Plus de 1,5 buts' when 'under15' then 'Moins de 1,5 buts'
 when 'over35' then 'Plus de 3,5 buts' when 'under35' then 'Moins de 3,5 buts'
 when 'btts' then 'Les deux marquent' when 'bttsNo' then 'Les deux ne marquent pas'
 when 'homeDraw' then 'Double chance 1N' when 'drawAway' then 'Double chance N2' when 'homeAway' then 'Double chance 12'
 when 'homeDnb' then home_team || ' remboursé si nul' when 'awayDnb' then away_team || ' remboursé si nul' end;
end $$;
create or replace function public.place_bet(p_selections jsonb, p_stake numeric, p_counts_general boolean default false,
  p_bet_type text default 'combined', p_formula text default null, p_client_ref uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); acct public.player_accounts; bet public.bets; sel jsonb; fx public.fixtures;
  stake numeric := round(p_stake, 2); n int; k text; announced numeric; stored numeric; items jsonb := '[]'::jsonb;
  total numeric := 1; seen text[] := array[]::text[]; lines jsonb; line jsonb; leg int; line_count int; line_odds numeric; line_stake numeric;
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
    if k ~ '^(score|eh|homeMargin|awayMargin|marginDraw)' or k ~ '^(over|under)(05|45|55|65|75|85|95)$' then
      if coalesce((fx.market_valid_until->>k)::timestamptz <= now(), true) then raise exception 'MARCHE_INDISPONIBLE: %', fx.id; end if;
    end if;
    leg_label := public.market_label(k, fx.home, fx.away);
    items := items || jsonb_build_object('matchId', fx.id, 'key', k, 'label', leg_label, 'odd', stored,
      'home', fx.home, 'away', fx.away, 'match', fx.home || ' - ' || fx.away, 'league', fx.league,
      'kickoff', fx.kickoff, 'date', to_char(fx.kickoff at time zone 'Europe/Paris', 'YYYY-MM-DD'),
      'time', to_char(fx.kickoff at time zone 'Europe/Paris', 'HH24:MI'));
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


revoke all on function public.place_bet(jsonb,numeric,boolean,text,text,uuid) from public,anon;
grant execute on function public.place_bet(jsonb,numeric,boolean,text,text,uuid) to authenticated;
commit;
