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
