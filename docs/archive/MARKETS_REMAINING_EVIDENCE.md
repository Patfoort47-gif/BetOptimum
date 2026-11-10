# Preuves des lots 3 à 7 de BET-170, 4 novembre 2026

État historique des diagnostics avant la décision du propriétaire : H1 doit être terminé ; les autres extensions sont abandonnées avec son accord. Les preuves ci-dessous ne constituent pas une livraison de ces autres extensions. Voir [la procédure H1](../MARKETS_H1_PRODUCTION.md).

## Provenance et reproduction

Trois diagnostics manuels sur le commit `3f8f3656df78d1d82493e919e26e90ab6e1fde64` : huit requêtes chacun, aucun incident, seize rencontres chacun dans huit compétitions. Secrets PropLine exclusivement dans Actions. Aucun changement de données de production.

- Familles restantes : [run 41836877280](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41836877280), artefact 13327066182, [JSON intégral compressé](../evidence/propline-remaining-2026-11-04.json.gz).
- H1 : [run 41836887334](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41836887334), artefact 13325747613, [JSON intégral compressé](../evidence/propline-h1-2026-11-04.json.gz).
- H2 : [run 41836894765](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41836894765), artefact 13327855882, [JSON intégral compressé](../evidence/propline-h2-2026-11-04.json.gz).

Compression gzip sans modification du JSON source. Audit : `node scripts/audit-market-evidence.mjs docs/evidence/propline-h1-2026-11-04.json.gz` (idem `h2` et `remaining`). [Audit conservé](../evidence/propline-lots-audit-2026-11-04.json).

## Périodes : preuve réelle, mais pas encore de livraison

Les marchés renvoyés portent explicitement `period: h1` ou `period: h2`. Les périodes ne sont plus une simple hypothèse issue du catalogue. La normalisation diagnostique réutilise les marchés de score déjà connus, isolément pour chaque période et sans créer de cote de production.

| Période | Rencontres | Choix distincts cumulés par rencontre | Maximum de bookmakers par choix | Choix au seuil de dix |
|---|---:|---:|---:|---:|
| H1 | 16 | 318 | 23 | 142 |
| H2 | 16 | 264 | 6 | 0 |

Les choix H1 atteignant le seuil dans cet échantillon : 1N2 et totaux match 0,5 / 1,5 / 2,5, dans les deux sens. Ce constat ne vaut pas pour toutes les rencontres. Aucun double chance, BTTS ou DNB H1 ne franchit dix ici. H2 et mi-temps/fin restent sous le seuil de dix dans l’échantillon (cinq bookmakers au total pour mi-temps/fin).

Attention : le fournisseur renvoie aussi des totaux équipe sous `totals`, avec `team` renseigné. L’audit les exclut des totaux match. Leur présence ne prouve pas une offre de la clé `team_totals`. Les lignes entières/quarts ne deviennent pas des demi-lignes.

Avant activation H1 : identité canonique incluant la période, collecte budgétée, résultat de période persisté et transmis au règlement, attente si absent, SQL/RPC, interface et historique explicites, tests serveur/SQL/interface et preuve de coût. Ne pas diviser arbitrairement les probabilités finales par deux. H2 et mi-temps/fin gardent les mêmes travaux et la condition supplémentaire de couverture par sélection.

## Autres familles

**Bookmakers globaux par famille**, sur tout le relevé : il ne s’agit pas de comptes par sélection. En dessous de dix, aucun choix ne peut franchir le seuil sur cet échantillon. Au-dessus, il reste à normaliser et mesurer chaque sélection, ligne, joueur et région séparément. Les identifiants `espn:…` sont comptés comme présents, sans présumer qu’ils sont justes ni que la participation est validée.

| Clé | Rencontres | Sources globales brutes | Sources globales admissibles hors exchanges/DFS | Issues joueurs avec identifiant ESPN / issues joueurs |
|---|---:|---:|---:|---:|
| `total_corners` | 16 | 18 | 16 | sans objet |
| `total_cards` | 12 | 4 | 4 | sans objet |
| `spreads` | 16 | 39 | 31 | sans objet |
| `2plus_goals` | 16 | 10 | 7 | 1000/1822 |
| `anytime_goal_scorer` | 16 | 18 | 14 | 5416/5957 |
| `player_shots_on_target` | 16 | 12 | 7 | 3830/4073 |
| `first_goal_scorer` | 16 | 6 | 6 | 2872/3231 |
| `player_shots` | 13 | 11 | 7 | 4315/4548 |
| `corners_spread` | 16 | 4 | 4 | sans objet |
| `team_corners` | 14 | 5 | 4 | sans objet |
| `team_cards` | 8 | 2 | 2 | sans objet |
| `goalie_saves` | 14 | 4 | 3 | 374/396 |
| `player_tackles` | 4 | 1 | 1 | 733/818 |
| `player_assists` | 14 | 6 | 4 | 925/1048 |
| `first_team_to_score` | 16 | 4 | 4 | sans objet |
| `goal_or_assist` | 16 | 8 | 5 | 807/1306 |
| `half_time_full_time` | 16 | 5 | 5 | sans objet |
| `3plus_goals` | 12 | 1 | 1 | 0/45 |
| `player_cards` | 11 | 2 | 2 | 328/430 |
| `corners_european_handicap` | 14 | 1 | 1 | sans objet |

Les handicaps `spreads` contiennent effectivement des lignes entières et des quarts, dont ±0,25, ±0,75 et ±1,25. Leur règlement fractionné reste à implémenter dans les simples, combinés, systèmes, historiques, ROI et ligues. Les formats montrent deux issues avec handicaps opposés ; ne pas les confondre avec les handicaps européens à trois issues.

`2plus_goals` et `3plus_goals` sont bien des marchés joueurs dans les prix observés, avec des descriptions de joueur et/ou un seuil explicite. `3plus_goals` ne fournit aucun identifiant joueur sur les 45 issues examinées : aucune jointure par le seul nom n’est autorisée. Cette preuve clarifie le classement de la famille, sans lever les conditions de règlement.

## Preuves de résultat côté serveur

`scripts/market-results-evidence.mjs` prélève au plus huit résumés ESPN, un match terminé par compétition connue, identifiant de réponse vérifié. Commande locale dans cet environnement : `node --use-env-proxy scripts/market-results-evidence.mjs /workspace/work/market-results-evidence.json`. Le drapeau conserve le proxy réseau configuré. Aucun secret nécessaire, aucun règlement ni écriture en production.

[Projection de six résumés ESPN](../evidence/espn-market-results-2026-11-04.json.gz) : Premier League, Serie A, La Liga, Ligue 1, Bundesliga, Ligue des champions, six requêtes réussies. Les URL de provenance et l’heure du relevé sont conservées. Champs retenus : header, boxscore, rosters, keyEvents, format. Articles, vidéos et commentaires textuels hors preuve exclus.

Les six réponses contiennent : scores de mi-temps dans `competitors.linescores[].displayValue`, événements avec période, effectifs avec identifiants et statistiques numériques, totaux d’équipe `wonCorners`, jaunes et rouges. Le scoreboard seul ne contient pas les scores par période sur le match examiné. Ces données ne sont actuellement pas persistées ni utilisées par le règlement des nouveaux marchés.

Points à résoudre avant de les utiliser :

- Périodes : valider les formats après prolongation/tirs au but, cohérence des sommes et absence de score ; aucune conversion d’une valeur absente en zéro.
- Chronologie : intégrité des buts, CSC, VAR, ordre et corrections ; le texte anglais d’un événement ne suffit pas à décider du bénéficiaire.
- Joueurs : participation et identité concordantes, buts/passes/CSC et définitions des tirs, arrêts et tacles ; absence et remplaçant selon le contrat du marché. Les identifiants de prix seuls ne prouvent pas la présence au match.
- Corners/cartons : vérifier la définition fournisseur, les prolongations, les périodes, second jaune, banc et après-match. Un total jaune + rouge n’est pas une règle de comptage validée.
- Tous : persistance serveur, moteur conservant l’identité des paris historiques, corrections sans double versement, migrations dans l’ordre et recettes avant activation.

La présence des champs sur six résumés n’établit ni une couverture générale ni une équivalence des définitions entre ESPN et chaque bookmaker. Les contrats fournisseur et les cas limites doivent être documentés. Aucun des lots 3 à 7 n’est annoncé terminé.

## Vérification de la documentation fournisseur

[Documentation officielle PropLine](https://prop-line.com/docs), consultée le 4 novembre 2026 : sections Authentication, Bookmakers, Period Markets, Prop Results et Markets. Elle confirme `h1`/`h2`, l’identité `espn:…`, les totaux équipe dans `totals.team` et les compteurs `X-Daily-*`. Les futurs diagnostics ne conservent que ces quatre compteurs numériques, pour mesurer l’usage sans exposer d’en-têtes sensibles. Les relevés déjà faits ne les contenaient pas ; aucun coût mesuré n’est reconstruit a posteriori.

Le filtre de collecte exclut maintenant aussi SX Bet, Novig, ProphetX, Betdaq et les identités DFS à prix synthétique documentées, même lorsque `type` est absent. Les nombres bruts de sources du rapport initial incluent ces identités ; la colonne admissible les retire. Les prix individuels doivent encore être vérifiés. H1/H2 et les composites ne changent pas de comptes.

`/results` et `/bets/settle` sont des pistes de contre-vérification, pas des remplacements déjà validés du règlement serveur. La documentation indique que les tacles joueurs ne sont pas gradués. Aucune nouvelle dépendance de production ou règle de règlement n’est adoptée sur la seule lecture de la documentation.
