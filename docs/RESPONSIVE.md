# Recette responsive (BET-114)

La page, l’en-tête et le pied de page partagent `--page-width` (1 600 px) et `--page-gutter`. Les panneaux partagent `--radius` et `--panel-padding`. Le fil des matchs passe en colonne à 1 440 px ; le combiné reste fixe dès 1 101 px.

Entre 701 et 1 599 px, la navigation occupe une seconde ligne et conserve ses libellés. `--header-offset` réserve sa hauteur pour les éléments collants. Sur téléphone, les sept destinations restent présentes ; « Équipes » garde son nom accessible complet.

Installer les outils hors du dépôt, puis lancer le serveur local :

```sh
npm install --prefix /tmp/bet-ui-tools --no-audit --no-fund playwright@1.62.1 axe-core@4.14.0
npm start
# Dans un second terminal :
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-responsive.cjs
npm test
```

La recette utilise Chromium (`/usr/bin/chromium`, ou `BET_CHROMIUM`) et un serveur local (`BET_BASE_URL`, défaut `http://127.0.0.1:4173`). Les données et le compte sont simulés, les appels externes bloqués. Aucun compte ni pari n’est créé.

Elle parcourt les cinq destinations principales à 17 largeurs de 320 à 2 560 px, dans les deux thèmes. Elle contrôle les débordements, les libellés visibles, les chevauchements avec les actions du compte et la hauteur réservée sous l’en-tête, puis ouvre et ferme le ticket mobile. Rapports et captures : `/tmp/bet-ui-report` (`BET_UI_REPORT` pour changer la destination).

## Cotes et conseil sur téléphone (BET-322)

Les cartes de match conservent la sélection conseillée, sa cote, tous les marchés mis en avant et les familles secondaires sur téléphone. Les prix restent soumis au seuil de dix bookmakers par sélection ; les marchés insuffisamment couverts restent absents et le calendrier affiche son état vide si aucun match n’est admissible. La grille mobile présente deux marchés par ligne, avec la source des cotes et leur date.

`NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-mobile-cards.cjs` vérifie de 320 à 1 440 px, dans les deux thèmes : visibilité du conseil, des prix et des sources, absence de débordement, ajout unique au ticket et états de chargement, vide, erreur et couverture insuffisante. Les données et confirmations de paris sont simulées ; aucun pari réel n’est envoyé. La recette ferme le ticket avant de revenir aux matchs et suit l’action actuelle du calendrier vide.
