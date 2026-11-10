-- Extension V16 : boutique et usages des jetons (BET-62).
-- À exécuter dans le SQL Editor Supabase après supabase-v15-schema.sql. Réexécutable.
-- Les jetons n'ont aucune valeur : jamais achetables avec de l'argent réel, jamais convertibles. Tout passe par des fonctions serveur :
-- aucun achat, aucune revente, aucun duel n'est possible depuis la console du navigateur (pas d'écriture directe, solde recalculé sur le journal).
do $$ begin
  if to_regclass('public.follows') is null then
    raise exception 'Exécutez d''abord supabase-v15-schema.sql.';
  end if;
end $$;

-- Catalogue : écrit par scripts/sync-supabase.mjs depuis shop.js (noms génériques, prix validés par les tests).
create table if not exists public.shop_items (
  id text primary key,
  category text not null,
  name text not null,
  rarity text not null check (rarity in ('common','rare','epic','legendary','exclusive')),
  price int not null check (price >= 0),
  exclusive boolean not null default false,
  min_division int check (min_division between 0 and 6),
  collection text,
  asset text,
  pack_of jsonb,
  available_from timestamptz,
  available_until timestamptz,
  check ((exclusive and price = 0) or (not exclusive and price > 0))
);
create table if not exists public.shop_weekly (week date primary key, item_id text not null references public.shop_items(id));
create table if not exists public.inventories (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  price_paid int not null default 0 check (price_paid >= 0),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create table if not exists public.equipped_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  slot text not null,
  item_id text not null references public.shop_items(id),
  primary key (user_id, slot)
);
create table if not exists public.streak_shields (
  user_id uuid not null references auth.users(id) on delete cascade,
  league text not null,
  season text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, league, season)
);
create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  creator_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  stake int not null check (stake between 50 and 5000),
  status text not null default 'pending' check (status in ('pending','accepted','settled','refunded','declined','cancelled','expired')),
  winner_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (creator_id <> opponent_id)
);
create index if not exists duels_users_idx on public.duels (creator_id, opponent_id, day);

alter table public.shop_items enable row level security;
alter table public.shop_weekly enable row level security;
alter table public.inventories enable row level security;
alter table public.equipped_items enable row level security;
alter table public.streak_shields enable row level security;
alter table public.duels enable row level security;
drop policy if exists "Shop is readable" on public.shop_items;
create policy "Shop is readable" on public.shop_items for select using (true);
drop policy if exists "Shop is readable" on public.shop_weekly;
create policy "Shop is readable" on public.shop_weekly for select using (true);
drop policy if exists "Players read their inventory" on public.inventories;
create policy "Players read their inventory" on public.inventories for select using (auth.uid() = user_id);
drop policy if exists "Players read their equipment" on public.equipped_items;
create policy "Players read their equipment" on public.equipped_items for select using (auth.uid() = user_id);
drop policy if exists "Players read their shields" on public.streak_shields;
create policy "Players read their shields" on public.streak_shields for select using (auth.uid() = user_id);
drop policy if exists "Duelists read their duels" on public.duels;
create policy "Duelists read their duels" on public.duels for select using (auth.uid() in (creator_id, opponent_id));
revoke all on table public.shop_items, public.shop_weekly, public.inventories, public.equipped_items, public.streak_shields, public.duels from anon, authenticated;
grant select on table public.shop_items, public.shop_weekly to anon, authenticated;
grant select on table public.inventories, public.equipped_items, public.streak_shields, public.duels to authenticated;

-- Titre et cadre équipés, visibles de tous (seuls objets affichés en dehors de l'avatar 3D).
create or replace view public.public_equipped as
select e.user_id, e.slot, e.item_id, i.name, i.asset from public.equipped_items e join public.shop_items i on i.id = e.item_id where e.slot in ('title','frame');
grant select on table public.public_equipped to anon, authenticated;

-- Division (0 District ... 6 Master) d'un échelon ; -1 pendant la saison de placement.
create or replace function public.division_of(p_echelon int)
returns int language sql immutable as $$ select case when p_echelon is null then -1 when p_echelon >= 15 then p_echelon - 10 else p_echelon / 3 end $$;

-- Solde du journal, verrouillé par joueur pour que deux achats simultanés ne dépensent jamais deux fois les mêmes jetons.
create or replace function public.lock_tokens(p_user uuid)
returns int language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('tokens:' || p_user::text, 0));
  return coalesce((select sum(delta) from public.token_ledger where user_id = p_user), 0)::int;
end $$;
revoke all on function public.lock_tokens(uuid) from public, anon, authenticated;

create or replace function public.buy_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.shop_items; balance int; price int; weekly text; division int; comp text; sum_price int := 0; c public.shop_items;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into it from public.shop_items where id = p_item;
  if not found then raise exception 'OBJET_INCONNU'; end if;
  if it.exclusive then raise exception 'OBJET_EXCLUSIF'; end if;
  if (it.available_from is not null and it.available_from > now()) or (it.available_until is not null and it.available_until < now()) then raise exception 'OBJET_INDISPONIBLE'; end if;
  balance := public.lock_tokens(uid);
  if exists (select 1 from public.inventories where user_id = uid and item_id = it.id) then raise exception 'OBJET_POSSEDE'; end if;
  select public.division_of(echelon) into division from public.player_league where user_id = uid;
  if it.min_division is not null and coalesce(division, -1) < it.min_division then raise exception 'DIVISION_INSUFFISANTE'; end if;
  select item_id into weekly from public.shop_weekly where week = date_trunc('week', now() at time zone 'Europe/Paris')::date;
  if it.category = 'pack' then
    for comp in select jsonb_array_elements_text(it.pack_of) loop select * into c from public.shop_items where id = comp; sum_price := sum_price + coalesce(c.price, 0); end loop;
    price := round(sum_price * 0.8);
  else
    price := case when it.id = weekly then round(it.price * 0.7) else it.price end;
  end if;
  if balance < price then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -price, 'shop', 'buy:' || it.id || ':' || gen_random_uuid()::text);
  if it.category = 'pack' then
    for comp in select jsonb_array_elements_text(it.pack_of) loop
      select * into c from public.shop_items where id = comp;
      insert into public.inventories (user_id, item_id, price_paid) values (uid, comp, round(c.price * 0.8)) on conflict do nothing;
    end loop;
  else
    insert into public.inventories (user_id, item_id, price_paid) values (uid, it.id, price);
  end if;
  return jsonb_build_object('item_id', it.id, 'price', price, 'balance', balance - price);
end $$;

-- Revente à 30 % du prix payé ; l'objet est retiré de l'équipement.
create or replace function public.sell_item(p_item text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); paid int; refund int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.lock_tokens(uid);
  delete from public.inventories where user_id = uid and item_id = p_item returning price_paid into paid;
  if paid is null then raise exception 'OBJET_ABSENT'; end if;
  delete from public.equipped_items where user_id = uid and item_id = p_item;
  refund := floor(paid * 0.3);
  if refund > 0 then insert into public.token_ledger (user_id, delta, reason, ref) values (uid, refund, 'shop-sell', 'sell:' || p_item || ':' || gen_random_uuid()::text); end if;
  return jsonb_build_object('item_id', p_item, 'refund', refund);
end $$;

create or replace function public.equip_item(p_item text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_slot text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.inventories where user_id = uid and item_id = p_item) then raise exception 'OBJET_ABSENT'; end if;
  select category into v_slot from public.shop_items where id = p_item;
  insert into public.equipped_items (user_id, slot, item_id) values (uid, v_slot, p_item) on conflict (user_id, slot) do update set item_id = excluded.item_id;
end $$;
create or replace function public.unequip_slot(p_slot text)
returns void language sql security definer set search_path = public as $$
  delete from public.equipped_items where user_id = auth.uid() and slot = p_slot;
$$;

-- Bouclier de série : 800 jetons, une fois par saison et par ligue ('general' ou identifiant de ligue spéciale rejointe) ; une défaite ne casse pas la série.
create or replace function public.buy_shield(p_league text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_season text; balance int; sl public.special_leagues;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_league = 'general' then v_season := to_char(now() at time zone 'Europe/Paris', 'YYYY-MM');
  else
    select * into sl from public.special_leagues where id = p_league and open;
    if not found or not exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then raise exception 'LIGUE_INCONNUE'; end if;
    v_season := to_char(sl.season_start, 'YYYY') || '-' || to_char(sl.season_end, 'YY');
  end if;
  balance := public.lock_tokens(uid);
  if exists (select 1 from public.streak_shields where user_id = uid and league = p_league and season = v_season) then raise exception 'BOUCLIER_DEJA'; end if;
  if balance < 800 then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.streak_shields (user_id, league, season) values (uid, p_league, v_season);
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -800, 'shield', 'shield:' || p_league || ':' || v_season);
end $$;

-- Recharge de la bankroll : 1 000 € fictifs contre 500 jetons, seulement si la bankroll est sous 50 €.
create or replace function public.refill_bankroll()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); acct public.player_accounts; balance int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.ensure_player_account();
  balance := public.lock_tokens(uid);
  select * into acct from public.player_accounts where user_id = uid for update;
  if acct.bankroll >= 50 then raise exception 'BANKROLL_SUFFISANTE'; end if;
  if balance < 500 then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -500, 'refill', 'refill:' || gen_random_uuid()::text);
  update public.player_accounts set bankroll = bankroll + 1000, updated_at = now() where user_id = uid returning * into acct;
  insert into public.capital_events (user_id, amount) values (uid, 1000);
  return to_jsonb(acct);
end $$;

-- Duels entre amis sur le défi du jour : chacun engage des jetons, le meilleur total de points du jour remporte le tout, égalité remboursée.
create or replace function public.create_duel(p_opponent uuid, p_stake int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'Europe/Paris')::date; duel public.duels; balance int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_opponent is null or p_opponent = uid then raise exception 'ADVERSAIRE_INVALIDE'; end if;
  if p_stake is null or p_stake < 50 or p_stake > 5000 then raise exception 'MISE_INVALIDE'; end if;
  if not exists (select 1 from public.follows where follower_id = uid and followed_id = p_opponent) then raise exception 'AMI_REQUIS'; end if;
  if not exists (select 1 from public.profiles where user_id = p_opponent and is_public) then raise exception 'PROFIL_PRIVE'; end if;
  if not exists (select 1 from public.daily_challenges c, jsonb_array_elements(c.picks) p where c.day = today and (p->>'kickoff')::timestamptz > now()) then raise exception 'DEFI_FERME'; end if;
  if exists (select 1 from public.duels where day = today and status in ('pending','accepted') and least(creator_id, opponent_id) = least(uid, p_opponent) and greatest(creator_id, opponent_id) = greatest(uid, p_opponent)) then raise exception 'DUEL_EXISTANT'; end if;
  balance := public.lock_tokens(uid);
  if balance < p_stake then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.duels (day, creator_id, opponent_id, stake) values (today, uid, p_opponent, p_stake) returning * into duel;
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -p_stake, 'duel-stake', 'duel:' || duel.id || ':creator');
  return to_jsonb(duel);
end $$;
create or replace function public.accept_duel(p_duel uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); duel public.duels; balance int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into duel from public.duels where id = p_duel and opponent_id = uid for update;
  if not found or duel.status <> 'pending' then raise exception 'DUEL_INDISPONIBLE'; end if;
  if duel.day <> (now() at time zone 'Europe/Paris')::date or not exists (select 1 from public.daily_challenges c, jsonb_array_elements(c.picks) p where c.day = duel.day and (p->>'kickoff')::timestamptz > now()) then raise exception 'DEFI_FERME'; end if;
  balance := public.lock_tokens(uid);
  if balance < duel.stake then raise exception 'SOLDE_INSUFFISANT'; end if;
  insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -duel.stake, 'duel-stake', 'duel:' || duel.id || ':opponent');
  update public.duels set status = 'accepted' where id = duel.id returning * into duel;
  return to_jsonb(duel);
end $$;
-- Refus par l'adversaire ou annulation par l'auteur d'un duel en attente : la mise de l'auteur est remboursée.
create or replace function public.close_duel(p_duel uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); duel public.duels;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into duel from public.duels where id = p_duel and uid in (creator_id, opponent_id) for update;
  if not found or duel.status <> 'pending' then raise exception 'DUEL_INDISPONIBLE'; end if;
  update public.duels set status = case when uid = creator_id then 'cancelled' else 'declined' end where id = duel.id;
  insert into public.token_ledger (user_id, delta, reason, ref) values (duel.creator_id, duel.stake, 'duel-refund', 'duel:' || duel.id || ':creator') on conflict do nothing;
end $$;
-- Règlement (service_role seulement, idempotent) : p_winner null = remboursement des deux mises ; un duel jamais accepté expire et rembourse son auteur.
create or replace function public.settle_duel(p_duel uuid, p_winner uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare duel public.duels;
begin
  select * into duel from public.duels where id = p_duel for update;
  if not found or duel.status not in ('pending','accepted') then return false; end if;
  if duel.status = 'pending' then
    update public.duels set status = 'expired' where id = duel.id;
    insert into public.token_ledger (user_id, delta, reason, ref) values (duel.creator_id, duel.stake, 'duel-refund', 'duel:' || duel.id || ':creator') on conflict do nothing;
    return true;
  end if;
  if p_winner is not null and p_winner not in (duel.creator_id, duel.opponent_id) then raise exception 'GAGNANT_INVALIDE'; end if;
  if p_winner is null then
    update public.duels set status = 'refunded' where id = duel.id;
    insert into public.token_ledger (user_id, delta, reason, ref) values (duel.creator_id, duel.stake, 'duel-refund', 'duel:' || duel.id || ':creator'), (duel.opponent_id, duel.stake, 'duel-refund', 'duel:' || duel.id || ':opponent') on conflict do nothing;
  else
    update public.duels set status = 'settled', winner_id = p_winner where id = duel.id;
    insert into public.token_ledger (user_id, delta, reason, ref) values (p_winner, duel.stake * 2, 'duel-win', 'duel:' || duel.id || ':win') on conflict do nothing;
  end if;
  return true;
end $$;

-- Ligues premium payées en jetons : même fonction qu'en V9, avec le prix d'entrée (une seule fois par ligue et par joueur).
create or replace function public.join_special_league(p_league text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lg public.special_leagues; balance int;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into lg from public.special_leagues where id = p_league and open;
  if not found then raise exception 'LIGUE_FERMEE'; end if;
  perform public.ensure_player_account();
  if exists (select 1 from public.league_members where league_id = p_league and user_id = uid) then return jsonb_build_object('joined', true); end if;
  if (select count(*) from public.league_members where user_id = uid) >= 3 then raise exception 'LIGUES_MAX'; end if;
  if lg.access = 'premium' and lg.token_price > 0 and not exists (select 1 from public.token_ledger where user_id = uid and reason = 'league-entry' and ref = 'league:' || lg.id) then
    balance := public.lock_tokens(uid);
    if balance < lg.token_price then raise exception 'SOLDE_INSUFFISANT'; end if;
    insert into public.token_ledger (user_id, delta, reason, ref) values (uid, -lg.token_price, 'league-entry', 'league:' || lg.id);
  end if;
  insert into public.league_members (league_id, user_id) values (p_league, uid);
  return jsonb_build_object('joined', true);
end $$;

revoke all on function public.buy_item(text), public.sell_item(text), public.equip_item(text), public.unequip_slot(text), public.buy_shield(text), public.refill_bankroll(), public.create_duel(uuid, int), public.accept_duel(uuid), public.close_duel(uuid), public.join_special_league(text) from public, anon;
grant execute on function public.buy_item(text), public.sell_item(text), public.equip_item(text), public.unequip_slot(text), public.buy_shield(text), public.refill_bankroll(), public.create_duel(uuid, int), public.accept_duel(uuid), public.close_duel(uuid), public.join_special_league(text) to authenticated;
revoke all on function public.settle_duel(uuid, uuid) from public, anon, authenticated;
grant execute on function public.settle_duel(uuid, uuid) to service_role;
