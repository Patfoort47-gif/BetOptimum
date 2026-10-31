-- Recette de sécurité des tickets certifiés (BET-52). À exécuter à la main dans le SQL Editor Supabase APRÈS supabase-v5-schema.sql.
-- Chaque bloc imite un joueur connecté (role authenticated + identifiant) : chaque requête marquée « doit échouer » doit renvoyer une erreur,
-- chaque requête marquée « doit renvoyer 0 ligne » ne doit rien montrer. Remplacez les deux identifiants par ceux de deux comptes de test.
-- Les blocs sont encadrés par begin / rollback : rien n'est conservé. Une erreur annule la transaction en cours :
-- exécutez chaque requête « doit échouer » dans son propre bloc (avec son begin, ses deux set et son rollback).

-- 1. Joueur A : lit ses paris, jamais ceux de B.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select count(*) as mes_paris from public.bets;                                               -- seulement les paris de A
select count(*) as paris_de_b from public.bets where user_id = '00000000-0000-0000-0000-00000000000b';  -- doit renvoyer 0
rollback;

-- 2. Joueur A ne peut ni modifier un statut, ni créer, ni supprimer un pari, ni toucher à une bankroll (chaque ligne doit échouer : permission denied).
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
update public.bets set status = 'won', payout = 9999;                                        -- doit échouer
insert into public.bets (user_id, bet_type, stake, odds, status, selections) values ('00000000-0000-0000-0000-00000000000a', 'single', 1, 50, 'won', '[]'); -- doit échouer
delete from public.bets;                                                                      -- doit échouer
update public.player_accounts set bankroll = 1000000000;                                      -- doit échouer
update public.fixtures set odds = '{"home": 99}';                                             -- doit échouer
update public.profiles set metrics = '{"roi": 999}';                                          -- doit échouer (colonne non modifiable)
select public.settle_bet(gen_random_uuid(), 'won', 1000000);                                  -- doit échouer (réservé au service)
rollback;

-- 3. Pari après le coup d'envoi : refusé (MATCH_COMMENCE). Remplacez espn-XXXX par un match déjà commencé de la table fixtures.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select public.place_bet('[{"matchId":"espn-XXXX","key":"home","odd":1.5}]'::jsonb, 10, false, 'single');  -- doit échouer
rollback;

-- 4. Cote falsifiée : refusée (COTE_CHANGEE) dès que l'écart dépasse 2 %. Remplacez espn-YYYY par un match à venir.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select public.place_bet('[{"matchId":"espn-YYYY","key":"home","odd":50}]'::jsonb, 10, false, 'single');   -- doit échouer
rollback;

-- 5. Visiteur anonyme : ne voit ni paris, ni comptes, ni statistiques brutes ; voit les matchs et les profils publics.
begin;
set local role anon;
select count(*) from public.bets;                                                             -- doit échouer
select count(*) from public.player_accounts;                                                  -- doit échouer
select count(*) from public.public_player_stats;                                              -- doit échouer
select count(*) from public.fixtures;                                                         -- doit réussir
select nickname, metrics from public.public_profiles limit 5;                                 -- doit réussir (agrégats uniquement)
rollback;
