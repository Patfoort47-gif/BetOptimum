# BetMaster / BotPari

> Pour activer les comptes et retrouver la même bankroll sur plusieurs appareils, suivez [le guide Supabase](SUPABASE_SETUP.md).

Application web statique d’aide à la décision pour des paris sportifs **virtuels**. Elle analyse des matchs avec une distribution de Poisson, repère les écarts de valeur, construit des combinés et suit une bankroll locale.

## Lancer le projet

```bash
npm start
```

Ouvrir ensuite `http://localhost:4173`. Aucun build, compte ou secret n’est nécessaire.

## Tests

```bash
npm test
```

Sans compte, les données utilisateur restent dans `localStorage`. Avec un compte Supabase, les paris sont enregistrés et réglés côté serveur (tickets certifiés), la bankroll vit sur le serveur, favoris et profil sont synchronisés ; le nom d’utilisateur, l’avatar et les statistiques calculées par le serveur alimentent les classements publics. Les probabilités sont indicatives et ne garantissent aucun résultat. 18+ — jouez de façon responsable.

## Données sportives

Le workflow `Actualiser les matchs` consolide chaque jour les calendriers ESPN, les résultats historiques de football-data.org et les cotes de The Odds API. Il enregistre les sept prochains jours dans `data/fixtures.json`, puis republie GitHub Pages. Toutes les cotes 1N2, Over 2,5 et BTTS sont rafraîchies ensemble à 7 h, 14 h et 19 h, heure de Paris, sans appel nocturne. Les marchés Over 2,5 et BTTS couvrent les rencontres des prochaines 48 heures dans les régions Europe et Royaume-Uni. Lorsqu’un bookmaker ne renvoie temporairement plus l’un de ces marchés, sa dernière cote réelle est conservée en cache. Les autres valeurs restent des estimations internes clairement identifiées.

Deux secrets GitHub Actions sont requis : `FOOTBALL_DATA_TOKEN` et `THE_ODDS_API_KEY`. Ils ne sont jamais envoyés au navigateur ni écrits dans les données publiées.

Les scores ESPN des sept derniers jours sont également conservés dans le flux. À chaque chargement, les paris virtuels en attente sont réglés automatiquement : la mise est débitée au placement, un ticket gagnant crédite `mise × cote`, et un ticket perdant ne crédite aucun retour. Un ticket ne peut être réglé qu’une seule fois.

Chaque pronostic conseillé terminé est archivé sans limite de durée dans `data/predictions-history.json`. La page « Bilan des pronos » permet de filtrer cette archive par période, compétition, marché et résultat ; elle publie le taux de réussite, le ROI et le profit théorique avec une mise identique de 10 € sur chaque proposition, sans retirer les échecs de l’historique. Ce fichier versionné sert de registre public durable sans ajouter de coût de base de données.
