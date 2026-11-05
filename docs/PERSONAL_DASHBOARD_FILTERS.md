# BET-180 : filtres et graphiques de Mes paris

Appliquer `supabase/migrations/supabase-v46-schema.sql` avant de publier le nouveau module `personal-dashboard.js`. Cette migration remplace seulement la fonction privée de lecture `my_bet_dashboard` ; elle ne modifie aucun pari, solde ou règlement. Elle est réexécutable et indépendante de V44, après V45.

Période, statut et recherche sélectionnent un ensemble commun de tickets, par date de prise. Liste paginée, montants, réussite, répartition et graphiques utilisent cet ensemble. Les agrégats portent sur toutes les pages. Les résultats sont regroupés par date de règlement de ces tickets. L’historique global du profil (`history`) est conservé, indépendant de ces filtres.

La courbe représente désormais le résultat net cumulé des tickets filtrés, départ à zéro, sans apports et sans gains potentiels. Ce n’est pas une reconstitution du solde du compte. La bankroll disponible reste le solde réel global fourni par `player_accounts`, explicitement indiqué sous les filtres ; appliquer une recherche ne peut pas changer ce solde. Les chiffres des graphiques sont en HTML à taille native, hors redimensionnement SVG. Les valeurs exactes restent consultables sous chaque graphique.

Recettes locales, sans données ni écritures de production :

```sh
npm test
npm install --prefix /tmp/bet-ui-tools --cache /tmp/bet-npm-cache @electric-sql/pglite playwright
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-personal-dashboard-sql.cjs
# Serveur local : python3 -m http.server 4173 --bind 127.0.0.1
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-personal-dashboard-ui.cjs
```

La recette SQL exécute la véritable migration dans PostgreSQL embarqué et vérifie 96 combinaisons de filtres, la cohérence des agrégats, l’isolation entre comptes et le refus hors connexion. La recette Chromium vérifie 360 et 1280 px, les filtres combinés, la réinitialisation, les réponses périmées, la taille native des chiffres et l’absence de débordement ou d’erreur JavaScript.
