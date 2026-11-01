# Défi du jour : finalisation BET-54

Le défi utilise le barème commun BET-132 : mise de référence de 10 points, cote plafonnée à 5, perte de 10 points, annulation à zéro. Il ne débite aucune bankroll. La sélection et les cotes restent figées ; les places libres peuvent être complétées avant le coup d'envoi. Les règles de qualification courantes sont celles de `docs/LEAGUE_SCORING.md`.

## Corrections de finition

- Le texte du défi mentionne désormais le plafond appliqué par le serveur et les annulations.
- Pendant un enregistrement, les trois choix du match sont désactivés et un état d'attente est visible. Un autre match reste jouable. Une erreur rend les choix disponibles sans effacer le dernier pronostic confirmé.
- Chaque choix possède un nom accessible avec les équipes, le pronostic et la cote ; le nombre de bookmakers reste visible après enregistrement ou fermeture.
- Le texte d'un défi fermé conserve un contraste lisible ; les boutons ont une hauteur minimale de 44 pixels.

## Vérifications du 1er novembre 2026

Le flux publié et `daily_challenges` contiennent quatre matchs. Trois pronostics sont enregistrés côté serveur sur des matchs non terminés : leur attente est normale à la date de contrôle. Les tables privées ont RLS activé. Ces observations utilisent seulement des comptes agrégés, sans destination de notification ni donnée d'identité.

`npm test` couvre sélection de 0, 2, 4 et plus de 4 matchs, importance, départage, changement de jour à Paris, figement et règlement des pronostics. La sélection d'un match ne doit pas augmenter la bankroll ou créer un pari payant.

Recette navigateur isolée (Chromium, serveur local, réponses simulées) :

```sh
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-daily-ui.cjs
```

Elle vérifie 320, 390 et 1280 pixels, clair/sombre, coup d'envoi fermé, attente d'enregistrement, compteur, panne et reprise, bankroll inchangée, absence de débordement et audit axe WCAG A/AA. Les dépendances de recette sont installées hors du dépôt.

Recette SQL isolée avec `@electric-sql/pglite`, sans connexion à la production :

```sh
NODE_PATH=/tmp/bet-sql-tools/node_modules node scripts/check-daily-sql.cjs
```

La recette utilise V7 et les fonctions pertinentes de V20, V30 et V31. Elle vérifie l'authentification, le refus après coup d'envoi ou annulation, les cotes figées, la modification sans doublon, l'idempotence, le plafond, les annulations, RLS et les droits réservés au serveur. Une seconde exécution a utilisé les définitions de ces mêmes fonctions lues dans la production (option `BET_DAILY_FUNCTIONS` : fichier JSON local de lignes `{definition}`). Aucun utilisateur ni pronostic de recette n'a été créé en production.

La validation ne prétend pas avoir observé le règlement réel de matchs encore non terminés, ni testé physiquement Safari/iOS. Aucune migration SQL n'est nécessaire pour cette finition.
