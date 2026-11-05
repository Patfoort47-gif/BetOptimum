# BET-189 · Trois indicateurs de bankroll

Le bandeau affiche Capital actuel, ROI et Bénéfice net. Le capital est le solde global disponible du compte serveur, après apports et mises engagées. Le net correspond aux retours moins mises des tickets réglés de la période et des filtres ; les apports en sont exclus. Le ROI divise ce net par les seules mises gagnées/perdues ; annulations et attentes sont exclues. Sans dénominateur, il affiche `-` avec une aide. Les montants positifs ont un signe explicite.

V47 après V46 ajoute seulement `decided_staked` à la réponse `my_bet_dashboard`, à partir du même ensemble filtré et dans la même requête. Les anciens champs, droits et règles métier restent identiques. Le navigateur ne recalcule rien à partir des lignes visibles et n’écrit pas la bankroll. Le bandeau est mis à jour avec le même numéro de requête que le reste du bilan ; une réponse obsolète est ignorée. Chargement : squelette ; erreur : indisponibilité et Réessayer, sans zéro inventé. Le détail comptable existant est replié.

Appliquer `supabase/migrations/supabase-v47-schema.sql` avant publication. La RPC de production a été comparée à V46 en lecture seule avant modification et est identique.

Validation : 385 tests Node, recette PostgreSQL isolée (96 combinaisons période/statut/recherche, mises décidées exactes, mêmes agrégats sur toutes les pages, isolation des comptes, authentification obligatoire) et recette Chromium `scripts/check-bankroll-kpis.cjs` aux huit largeurs 375 à 1440 px. Les contrôles navigateur couvrent chargement, montant signé, ROI, conservation après pagination, mise à jour, aide, état sans décision, erreur et reprise. Données et comptes simulés, services externes bloqués.
