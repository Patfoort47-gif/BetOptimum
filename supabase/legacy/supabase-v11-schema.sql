-- Extension V11 : jetons et récompenses de saison (BET-58).
-- À exécuter dans le SQL Editor Supabase après supabase-v10-schema.sql. Réexécutable.
-- Les jetons sont une monnaie fictive : sans valeur, jamais achetables avec de l'argent réel, jamais convertibles, pas de transfert entre joueurs.
-- Le journal est alimenté uniquement par des fonctions serveur (clé service_role) : le solde en découle, aucune écriture depuis le navigateur.
do $$ begin
  if to_regclass('public.xp_events') is null then
    raise exception 'Exécutez d''abord supabase-v10-schema.sql.';
  end if;
end $$;

-- Journal des jetons : delta positif (gain) ou négatif (dépense, BET-62). Une référence unique par raison et par joueur rend chaque gain idempotent.
create table if not exists public.token_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null,
  ref text not null,
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref)
);
create index if not exists token_ledger_user_idx on public.token_ledger (user_id, created_at desc);

-- Série en cours, meilleure série et tirelire de la saison, par ligue ('general' ou identifiant d'une ligue spéciale).
create table if not exists public.league_streaks (
  user_id uuid not null references auth.users(id) on delete cascade,
  league text not null,
  season text not null,
  current int not null default 0,
  best int not null default 0,
  multiplier numeric(3,1) not null default 1,
  piggy numeric(12,2) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, league, season)
);

-- Détail du calcul de fin de saison, une ligne par joueur, ligue et saison (contrainte unique : calcul idempotent).
create table if not exists public.season_rewards (
  season text not null,
  league text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  piggy numeric(12,2) not null,
  regularity numeric(3,2) not null,
  prize int not null,
  difficulty numeric(4,2) not null,
  feats jsonb not null default '[]'::jsonb,
  total int not null check (total >= 0),
  created_at timestamptz not null default now(),
  primary key (season, league, user_id)
);

alter table public.season_results add column if not exists barrage boolean not null default false;

alter table public.token_ledger enable row level security;
alter table public.league_streaks enable row level security;
alter table public.season_rewards enable row level security;
drop policy if exists "Players read their tokens" on public.token_ledger;
create policy "Players read their tokens" on public.token_ledger for select using (auth.uid() = user_id);
drop policy if exists "Players read their streaks" on public.league_streaks;
create policy "Players read their streaks" on public.league_streaks for select using (auth.uid() = user_id);
drop policy if exists "Players read their season rewards" on public.season_rewards;
create policy "Players read their season rewards" on public.season_rewards for select using (auth.uid() = user_id);
revoke all on table public.token_ledger, public.league_streaks, public.season_rewards from anon, authenticated;
grant select on table public.token_ledger, public.league_streaks, public.season_rewards to authenticated;

-- Solde du joueur connecté (somme du journal) ; jamais lisible pour un autre joueur.
create or replace view public.my_token_balance as select user_id, sum(delta)::int as balance from public.token_ledger where user_id = auth.uid() group by user_id;
revoke all on table public.my_token_balance from anon, authenticated;
grant select on table public.my_token_balance to authenticated;
-- Fortune publique (hall of fame) : jetons gagnés depuis l'inscription, hors dépenses.
create or replace view public.public_fortune as select user_id, sum(delta)::int as earned from public.token_ledger where delta > 0 group by user_id;
grant select on table public.public_fortune to anon, authenticated;

-- Clôture atomique d'une saison : même fonction qu'en V8, avec le marqueur de barrage gagné (prime d'exploit).
create or replace function public.apply_season_close(p_season text, p_next text, p_results jsonb, p_groups jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare g jsonb; gid bigint; r jsonb; v_item text;
begin
  if coalesce((select status from public.league_seasons where season = p_season), 'open') = 'closed' then return false; end if;
  insert into public.league_seasons (season) values (p_season) on conflict (season) do nothing;
  insert into public.league_seasons (season) values (p_next) on conflict (season) do nothing;
  insert into public.season_results (season, user_id, from_echelon, to_echelon, outcome, group_rank, group_size, points, unlocks, barrage)
  select p_season, x.user_id, x.from_echelon, x.to_echelon, x.outcome, x.group_rank, x.group_size, coalesce(x.points, 0), coalesce(x.unlocks, '[]'::jsonb), coalesce(x.barrage, false)
  from jsonb_to_recordset(p_results) as x(user_id uuid, from_echelon int, to_echelon int, outcome text, group_rank int, group_size int, points numeric, unlocks jsonb, barrage boolean)
  on conflict (season, user_id) do nothing;
  update public.player_league pl set echelon = x.to_echelon, protected = coalesce(x.protected, false), inactive = coalesce(x.inactive, false), updated_at = now()
  from jsonb_to_recordset(p_results) as x(user_id uuid, to_echelon int, protected boolean, inactive boolean) where pl.user_id = x.user_id;
  for r in select * from jsonb_array_elements(p_results) loop
    for v_item in select jsonb_array_elements_text(coalesce(r->'unlocks', '[]'::jsonb)) loop
      insert into public.player_unlocks (user_id, item, season) values ((r->>'user_id')::uuid, v_item, p_season) on conflict do nothing;
    end loop;
    for v_item in select jsonb_array_elements_text(coalesce(r->'revoke', '[]'::jsonb)) loop
      delete from public.player_unlocks where user_id = (r->>'user_id')::uuid and public.player_unlocks.item = v_item;
    end loop;
  end loop;
  if not exists (select 1 from public.league_groups where season = p_next) then
    for g in select * from jsonb_array_elements(p_groups) loop
      insert into public.league_groups (season, echelon, label) values (p_next, (g->>'echelon')::int, g->>'label') returning id into gid;
      insert into public.group_members (season, group_id, user_id) select p_next, gid, m::uuid from jsonb_array_elements_text(g->'members') m on conflict do nothing;
    end loop;
  end if;
  update public.league_seasons set status = 'closed', closed_at = now() where season = p_season;
  return true;
end $$;
revoke all on function public.apply_season_close(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_season_close(text, text, jsonb, jsonb) to service_role;
