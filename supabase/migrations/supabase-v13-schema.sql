-- Extension V13 : page profil, confidentialité et suppression de compte (BET-50).
-- À exécuter dans le SQL Editor Supabase après supabase-v12-schema.sql. Réexécutable.
-- Profil public par défaut, détail des paris masqué par défaut, pseudo modifiable une fois par mois (RPC change_nickname),
-- export des données en JSON et suppression du compte (RPC delete_my_account).
do $$ begin
  if to_regclass('public.token_ledger') is null or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'heart_club_id') then
    raise exception 'Exécutez d''abord supabase-v12-schema.sql.';
  end if;
end $$;

alter table public.profiles add column if not exists is_public boolean not null default true;
alter table public.profiles add column if not exists show_bets boolean not null default false;
alter table public.profiles add column if not exists nickname_changed_at timestamptz;
alter table public.profiles add column if not exists joined_at timestamptz not null default now();
update public.profiles p set joined_at = u.created_at from auth.users u where u.id = p.user_id and p.joined_at > u.created_at + interval '1 minute';

-- Le navigateur choisit la visibilité de son profil ; le pseudo ne change plus que par la RPC (une fois par mois).
revoke update on table public.profiles from authenticated;
grant update (avatar, avatar_config, updated_at, heart_club_id, heart_club_name, is_public, show_bets) on table public.profiles to authenticated;
revoke insert on table public.profiles from authenticated;
grant insert (user_id, nickname, avatar, avatar_config, updated_at, heart_club_id, heart_club_name) on table public.profiles to authenticated;

create or replace function public.change_nickname(p_nickname text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last timestamptz;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.pseudo_valide(p_nickname) then raise exception 'PSEUDO_INVALIDE'; end if;
  select nickname_changed_at into last from public.profiles where user_id = uid;
  if last is not null and last > now() - interval '1 month' then raise exception 'PSEUDO_RECENT: %', to_char((last + interval '1 month') at time zone 'Europe/Paris', 'YYYY-MM-DD'); end if;
  if exists (select 1 from public.profiles where lower(nickname) = lower(p_nickname) and user_id <> uid) then raise exception 'PSEUDO_PRIS'; end if;
  update public.profiles set nickname = p_nickname, nickname_changed_at = now(), updated_at = now() where user_id = uid;
  return p_nickname;
end $$;
revoke all on function public.change_nickname(text) from public, anon;
grant execute on function public.change_nickname(text) to authenticated;

-- Profils publics : colonnes précédentes, puis visibilité et date d'inscription.
create or replace view public.public_profiles as
select p.user_id, p.nickname, p.avatar, p.avatar_config, p.challenge_stats, p.updated_at,
  coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0)) as metrics,
  jsonb_build_object('day', coalesce(s.day, public.stats_obj(0, 0, 0, 0, 0)), 'week', coalesce(s.week, public.stats_obj(0, 0, 0, 0, 0)),
    'month', coalesce(s.month, public.stats_obj(0, 0, 0, 0, 0)), 'season', coalesce(s.season, public.stats_obj(0, 0, 0, 0, 0)),
    'all', coalesce(s."all", public.stats_obj(0, 0, 0, 0, 0))) as period_stats,
  p.heart_club_id, p.heart_club_name, p.is_public, p.show_bets, p.joined_at
from public.profiles p left join public.public_player_stats s on s.user_id = p.user_id;
grant select on table public.public_profiles to anon, authenticated;

-- Paris visibles des autres joueurs : seulement si le profil est public ET que le joueur a activé l'option. Jamais de mise, de gain ni de bankroll.
create or replace view public.public_bets as
select b.id, b.user_id, b.placed_at, b.bet_type, b.odds, b.status, b.settled_at, b.selections
from public.bets b join public.profiles p on p.user_id = b.user_id
where p.is_public and p.show_bets;
grant select on table public.public_bets to anon, authenticated;

-- Chiffres bruts de la carte joueur (les attributs sont calculés par cardAttributes de model.js) : paris réglés, cotes moyennes, volume et jours actifs sur 30 jours.
create or replace view public.public_player_card as
select b.user_id,
  count(*) filter (where b.status in ('won','lost')) as settled,
  count(*) filter (where b.status = 'won') as wins,
  coalesce(sum(b.stake) filter (where b.status in ('won','lost')), 0) as staked,
  coalesce(sum(b.payout) filter (where b.status in ('won','lost')), 0) as returned,
  coalesce(avg(b.odds) filter (where b.bet_type <> 'multiple'), 0) as avg_odds,
  count(*) filter (where b.placed_at >= now() - interval '30 days') as tickets_30,
  count(distinct (b.placed_at at time zone 'Europe/Paris')::date) filter (where b.placed_at >= now() - interval '30 days') as active_days_30,
  coalesce(avg(b.stake / nullif(a.initial, 0)), 0) as avg_stake_ratio
from public.bets b join public.player_accounts a on a.user_id = b.user_id
group by b.user_id;
grant select on table public.public_player_card to anon, authenticated;

-- Frise des saisons : résultats de saison de chaque joueur (sans les déblocages ni l'indicateur de lecture).
create or replace view public.public_season_results as
select season, user_id, from_echelon, to_echelon, outcome, group_rank, group_size, points from public.season_results;
grant select on table public.public_season_results to anon, authenticated;

-- Export de toutes les données du joueur connecté (RGPD) en un seul JSON.
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.user_id = uid),
    'state', (select state from public.user_states where user_id = uid),
    'account', (select to_jsonb(a) from public.player_accounts a where a.user_id = uid),
    'capital_events', coalesce((select jsonb_agg(to_jsonb(c)) from public.capital_events c where c.user_id = uid), '[]'::jsonb),
    'bets', coalesce((select jsonb_agg(to_jsonb(b) order by b.placed_at) from public.bets b where b.user_id = uid), '[]'::jsonb),
    'daily_picks', coalesce((select jsonb_agg(to_jsonb(d)) from public.daily_picks d where d.user_id = uid), '[]'::jsonb),
    'special_picks', coalesce((select jsonb_agg(to_jsonb(s)) from public.special_picks s where s.user_id = uid), '[]'::jsonb),
    'league_entries', coalesce((select jsonb_agg(to_jsonb(e)) from public.league_entries e where e.user_id = uid), '[]'::jsonb),
    'season_results', coalesce((select jsonb_agg(to_jsonb(r)) from public.season_results r where r.user_id = uid), '[]'::jsonb),
    'xp_events', coalesce((select jsonb_agg(to_jsonb(x)) from public.xp_events x where x.user_id = uid), '[]'::jsonb),
    'badges', coalesce((select jsonb_agg(to_jsonb(g)) from public.user_badges g where g.user_id = uid), '[]'::jsonb),
    'token_ledger', coalesce((select jsonb_agg(to_jsonb(t)) from public.token_ledger t where t.user_id = uid), '[]'::jsonb)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Suppression du compte : efface le profil, l'état, les paris et toutes les données du joueur (cascades), puis le compte d'authentification.
-- La confirmation (saisie du pseudo) est vérifiée ici : un appel direct sans le bon pseudo est refusé.
create or replace function public.delete_my_account(p_confirm text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); nick text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select nickname into nick from public.profiles where user_id = uid;
  if nick is null or lower(btrim(coalesce(p_confirm, ''))) <> lower(nick) then raise exception 'CONFIRMATION_INVALIDE'; end if;
  delete from public.bets where user_id = uid;
  delete from public.user_states where user_id = uid;
  delete from public.profiles where user_id = uid;
  delete from auth.users where id = uid;
end $$;
revoke all on function public.delete_my_account(text) from public, anon;
grant execute on function public.delete_my_account(text) to authenticated;

-- Durcissement : aucune suppression directe de profil (la suppression passe par delete_my_account) et l'état synchronisé n'est jamais exposé au rôle anonyme.
revoke delete on table public.profiles from authenticated;
revoke all on table public.user_states from anon;
