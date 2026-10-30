# Recette des parcours publics et du Club

L’application reste sans dépendance npm de production. Les outils ci-dessous sont uniquement destinés à la recette locale.

Prérequis vérifiés : Node 24, Chromium, Playwright 1.62.1 et axe-core 4.14.0. Si nécessaire, installer les outils hors du dépôt :

```sh
npm install --prefix /tmp/bet-ui-tools --no-audit --no-fund playwright@1.62.1 axe-core@4.14.0
```

Dans `/workspace/BetOptimum`, lancer `npm start` dans un terminal, puis dans un second :

```sh
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-public-ui.cjs
```

Le script refuse un serveur distant et simule le module comptes et les réponses de données. Aucun email, compte, achat ou pari réel n’est créé. Il vérifie les erreurs et confirmations de l’interface ; il ne remplace pas les tests des RPC de production. Les appels externes sont bloqués pour garder une recette déterministe.

Variables facultatives : `BET_BASE_URL` (serveur local), `BET_CHROMIUM` (exécutable), `BET_UI_TOOLS` (installation d’axe-core), `BET_UI_REPORT` (rapports JSON et captures, `/tmp/bet-ui-report` par défaut).

Scénarios : stockage interdit, aides au clavier, Club non configuré, détails conservés, double clic, envoi incertain, cote refusée, match commencé/annulé, filtres et échantillon vide, panne réseau avec/sans calendrier, connexion simulée sans pari automatique, liens directs personnels, navigation clavier et retour de fiche. Les assertions ne sont pas remplacées par une simple présence de port ou une capture.

`npm test` complète cette recette avec les tests du domaine, notamment envois idempotents, calcul du bilan et dates des sources.
