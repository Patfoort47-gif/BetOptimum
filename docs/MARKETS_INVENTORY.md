# Matrice des marchés PropLine (BET-170)

## Décision du propriétaire du 4 novembre 2026 : H1 uniquement avant clôture

Le propriétaire autorise désormais l’abandon des autres extensions et demande explicitement de **terminer H1, puis publier et clôturer BET-170**. Cette décision remplace l’exigence antérieure de terminer les lots 2 à 7. Aucun autre ticket n’est créé pour les extensions abandonnées.

Périmètre conservé : premier lot déjà livré, seuil de dix bookmakers, correctif exchanges/DFS et H1 1N2 / totaux match 0,5, 1,5, 2,5. H1 reste sans modèle ni recommandation. Composites, H2, mi-temps/fin, lignes asiatiques/fractionnées, chronologie, joueurs, corners/cartons ne seront pas activés. Leurs preuves et préparations historiques restent documentées comme telles, sans être déclarées livrées. V44 composites n’est pas appliquée. La migration H1 V45 est indépendante de V44 et s’applique après la V43 déjà en production. Procédure : [H1](MARKETS_H1_PRODUCTION.md).

Les mentions historiques « reste ouvert jusqu’à tous les lots » ci-dessous décrivent la demande précédente ; la clôture dépend maintenant de la livraison effective de H1 et de la vérification de production.

## Suivi du périmètre complet au 4 novembre 2026

BET-170 reste **En cours** : le propriétaire demande de terminer les lots restants avant clôture. Le premier lot est en production (V40/V41, étape 3), mais les lots 2 à 7 ne sont pas livrés. Les paragraphes historiques ci-dessous décrivent la livraison initiale ; depuis BET-175, les probabilités/value du premier lot existent.

Travail du lot 2 sur `BET-170-composites` : identités canoniques `combo…`, probabilité jointe sur la même grille de scores (aucun produit de probabilités marginales), résultat conjoint, annulations et systèmes. V44 est préparée et testée en PostgreSQL isolé : labels JS/SQL, dix bookmakers, expiration, refus des doublons et des cotes falsifiées. **V44 n’est pas appliquée en production, l’étape 4 n’est pas activée et aucun parseur fournisseur composite n’est annoncé comme validé.**

[Diagnostic de prix du 4 novembre](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41833278549), commit `b6e8d284748f0c4db13ed880ffe965291021c28c`, artefact `13324580825` : huit requêtes, aucun incident, seize rencontres dans huit compétitions. Quatre familles figurent sur les seize rencontres ; `double_chance_btts` sur douze. Ce constat porte sur les clés présentes dans les réponses de prix, pas sur la validité de chaque sélection ni sur dix bookmakers par choix. Le rapport complet `propline-prices.json` est nécessaire pour vérifier les libellés, lignes et périodes avant d’écrire les parseurs. L’artefact a été téléchargé et examiné dans l’environnement reconfiguré ; la preuve complète est conservée dans [le relevé de prix](evidence/propline-composites-2026-11-04.json). Le blocage réseau précédent est levé pour ce domaine.

### Audit des sélections composites réelles

Les cinq parseurs stricts sont implémentés dans `scripts/propline-composites.mjs` et branchés sur la collecte à l’étape 4. Cette étape reste désactivée en production. Le garde de déploiement exige V44. Les descriptions, lignes numériques et composants du libellé doivent concorder ; périodes, joueurs, promotions, suspensions et identités ambiguës sont rejetés. Aucun prix n’est fabriqué à partir des composants. Les variantes non observées restent soumises à ces contrôles stricts.

Audit reproductible : `node scripts/check-markets-composites.mjs docs/evidence/propline-composites-2026-11-04.json`.

| Famille | Rencontres | Choix distincts par rencontre cumulés | Maximum de bookmakers par choix | Choix avec au moins dix bookmakers |
|---|---:|---:|---:|---:|
| BTTS + total | 16 | 32 | 4 | 0 |
| Double chance + BTTS | 12 | 24 | 1 | 0 |
| Double chance + total | 16 | 330 | 4 | 0 |
| Résultat + BTTS | 16 | 48 | 3 | 0 |
| Résultat + total | 16 | 282 | 4 | 0 |

Huit compétitions pour chacune des familles. Les 28 occurrences de libellés non rapprochables sans ambiguïté restent rejetées (ex. `Paris FC` contre l’identité événement `Paris`, `FC Kairat Almaty` contre `Kairat`). Elles ne sont pas des preuves d’offres supplémentaires. La couverture réelle exploitable est **nulle au seuil obligatoire de dix**, sur cet échantillon seulement. Le lot 2 reste donc ouvert et non livré : V44 non appliquée, étape 4 non activée. Une augmentation de couverture fournisseur reste nécessaire ; ne pas abaisser le seuil, additionner les bookmakers de choix différents ni compter deux fois une même identité.

Les diagnostics manuels `remaining`, `h1`, `h2` préparent les preuves des lots 3 à 7 : huit requêtes groupées maximum par lancement, aucun déploiement ni collecte planifiée supplémentaire. `requestedPeriod` conserve le filtre demandé ; le champ `period` du marché renvoyé reste intact et doit prouver la période réelle. Une réponse identique au match entier n’autorise aucun pari H1/H2.

Les [preuves détaillées des lots 3 à 7](MARKETS_REMAINING_EVIDENCE.md) sont maintenant conservées : périodes H1/H2 réelles, 142 choix H1 au seuil de dix, aucun H2, formats asiatiques/joueurs/corners et six résumés serveur ESPN. Ces lots restent non livrés. Les autres lots conservent leurs conditions de passage détaillées ci-dessous. Aucun marché nécessitant des données absentes ne doit être activé ni considéré comme terminé.

## Décision fondée sur le relevé réel

Source : [inventaire Actions du 3 novembre 2026](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41619288458), lancé à 11 h 26 Paris, commit `93d52de8c32d8bf2c686b5bb3981acd649cea87e`, artefact `13222224565` (`propline-inventory`). Le [JSON d’origine conservé](evidence/propline-inventory-2026-11-03.json) permet une revue après l’expiration de l’artefact le 10 novembre. Il est conservé sans régénération ni correction des données historiques.

56 requêtes sur 56, 16 matchs, 8 compétitions, aucun incident ni réponse non reconnue. **35 clés distinctes, 105 couples clé/période demandée**. Ce sont des présences dans un catalogue, pas des preuves de prix disponibles ou de règlement fiable. Le premier lot est désormais implémenté et prêt à être activé à l’étape 3 après V40 : voir [la procédure de production](MARKETS_PRODUCTION.md). L’étape 2 de BET-153 reste la seule étape de collecte de production ; voir [son guide](MARKETS_SETUP.md).

Limites constatées :

- Le fournisseur renvoie `outcomes_count`, ignoré par le parseur d’origine. Ses `maxOutcomes: 0` signifient ici « inconnu », pas absence d’offres. Les extraits bruts contiennent quelques vrais compteurs ; on ne reconstruit pas les autres à partir d’un extrait tronqué.
- Les catalogues agrégés `full`, `h1` et `h2` sont identiques (clés, matchs, compétitions et compteurs inconnus). Les trois extraits bruts conservés sont eux aussi identiques. Cela ne prouve ni que le filtre est ignoré, ni que les offres de mi-temps existent. La période de chaque sélection doit être vérifiée dans une réponse de prix.
- Aucune identité de sélection, ligne, cote, bookmaker, région, date de cote ou condition de règlement n’est fournie dans ce rapport. La présence d’une clé ne valide pas le format ni les conditions de cette famille.
- Le relevé ne conserve pas les identifiants des 16 événements ni leurs sélections. Il ne permet pas de reproduire exactement l’échantillon ni de mesurer les prix réellement jouables chez Betclic FR/Winamax FR.
- `2plus_goals` / `3plus_goals` ne sont pas des totaux match confirmés. Leur famille Joueurs est indicative en attendant une sélection explicite. `winning_margin` relève de Résultat. `player_cards` reste dans Joueurs.

## Matrice complète : match entier

Couverture = nombre de matchs où la clé figure au catalogue, sur les 16 échantillonnés. Les compétitions exactes, pour chaque clé et chaque période demandée, sont dans le JSON source. Aucun pourcentage n’est extrapolé au calendrier ou à un bookmaker.

Les probabilités « dérivables » ne sont **pas implémentées ni exposées** pour ces nouveaux marchés. Seuls les marchés BET-153 ont une probabilité existante ; aucune nouvelle value ou recommandation ne doit apparaître sur la seule base d’une cote.

| Clé fournisseur | Matchs / compétitions | Données nécessaires | Probabilités disponibles | Règlement serveur et décision | Lot |
|---|---|---|---|---|---|
| `both_teams_to_score` | 16/16 · 8/8 | Score réglementaire | Oui : grille Poisson | Actif BET-153 : Oui/Non | 0 |
| `double_chance` | 16/16 · 8/8 | Score réglementaire | Oui : somme des issues 1N2 | Actif BET-153 : 1N, N2, 12 | 0 |
| `draw_no_bet` | 16/16 · 8/8 | Score réglementaire | Oui : victoire et nul séparés | Actif BET-153 : nul remboursé | 0 |
| `h2h` | 16/16 · 8/8 | Score réglementaire | Oui : 1N2 | Actif BET-153, identités home/draw/away conservées | 0 |
| `totals` | 16/16 · 8/8 | Score réglementaire + ligne exacte | Oui pour 1,5 / 2,5 / 3,5 | Actif en étape 2 sur ces lignes ; nouvelles demi-lignes 0,5 et 4,5 à 9,5 prêtes en étape 3 sans modèle ; entières/quarts désactivées | 0/1/4 |
| `correct_score` | 16/16 · 8/8 | Score réglementaire + score sélectionné | Non exposée ; grille exploitable après validation, queue >8 à traiter | Prêt en étape 3 : scores explicites 0 à 15, ordre domicile/extérieur strict ; issues « autre score » exclues | 1 |
| `european_handicap` | 16/16 · 8/8 | Score réglementaire + handicap entier orienté + issue 1/N/2 | Non exposée ; dérivable après validation | Prêt en étape 3 : bloc trois issues vérifié, handicap domicile entier -9 à +9 ; aucun remboursement au nul corrigé | 1 |
| `winning_margin` | 16/16 · 8/8 | Score réglementaire + équipe + intervalle exact | Non exposée ; dérivable de la grille après validation | Prêt en étape 3 : écarts exacts et seuils explicites, nul 0 - 0 / nul avec buts séparés | 1 |
| `btts_total_goals` | 16/16 · 8/8 | Score réglementaire + BTTS + sens + ligne | Non exposée ; probabilité jointe à calculer | Désactivé : demi-lignes d’abord ; entière/quart reportée au lot 4 | 2 |
| `double_chance_btts` | 6/16 · 3/8 | Score réglementaire + double chance + BTTS | Non exposée ; probabilité jointe à calculer | Désactivé : une sélection composite fournisseur indivisible | 2 |
| `double_chance_total_goals` | 16/16 · 8/8 | Score réglementaire + double chance + sens + ligne | Non exposée ; probabilité jointe à calculer | Désactivé : demi-lignes d’abord ; entière/quart reportée au lot 4 | 2 |
| `result_btts` | 16/16 · 8/8 | Score réglementaire + issue + BTTS | Non exposée ; probabilité jointe à calculer, jamais produit des marginales | Désactivé : une sélection composite fournisseur indivisible | 2 |
| `result_total_goals` | 16/16 · 8/8 | Score réglementaire + issue + sens + ligne | Non exposée ; probabilité jointe à calculer | Désactivé : demi-lignes d’abord ; entière/quart reportée au lot 4 | 2 |
| `half_time_full_time` | 16/16 · 8/8 | Scores H1 et réglementaire vérifiés + deux issues | Non : aucune distribution jointe H1/fin disponible | Désactivé : persistance H1 et règle de période nécessaires | 3 |
| `spreads` | 16/16 · 8/8 | Score réglementaire + handicap orienté, ligne exacte | Non exposée ; nouvelle logique de remboursement nécessaire | Désactivé : entiers, demi-gains et demi-pertes sur quarts de ligne à implémenter | 4 |
| `first_team_to_score` | 16/16 · 8/8 | Chronologie complète des buts, équipe et corrections VAR | Non : aucun modèle chronologique | Désactivé : aucun but, CSC, match interrompu et ordre à fiabiliser | 5 |
| `2plus_goals` | 16/16 · 8/8 | Joueur/équipe et seuil à confirmer sur les sélections | Non | Désactivé : clé ambiguë ; classée Joueurs à titre indicatif, aucun sens déduit du nom | 6 |
| `3plus_goals` | 12/16 · 6/8 | Joueur/équipe et seuil à confirmer sur les sélections | Non | Désactivé : même ambiguïté que 2plus_goals | 6 |
| `anytime_goal_scorer` | 16/16 · 8/8 | Identité joueur stable + participation + buts officiels | Non : aucun modèle joueur | Désactivé : absent/remplaçant, CSC et corrections à définir | 6 |
| `first_goal_scorer` | 16/16 · 8/8 | Identité joueur + participation au premier but + chronologie | Non : aucun modèle joueur/chronologique | Désactivé : absent, entrée après premier but, aucun but et CSC à définir | 6 |
| `goal_or_assist` | 13/16 · 7/8 | Identité joueur + participation + buts et passes officiels | Non : aucun modèle joueur | Désactivé : jointure joueur et règles de passe non établies | 6 |
| `goalie_saves` | 6/16 · 3/8 | Identité gardien + participation + arrêts officiels | Non : aucun modèle d’arrêts | Désactivé : source et définition des arrêts non certifiées | 6 |
| `player_assists` | 12/16 · 6/8 | Identité joueur + participation + passes officielles de même définition | Non : aucun modèle joueur | Désactivé : définition de la passe et corrections fournisseur non établies | 6 |
| `player_cards` | 6/16 · 3/8 | Identité joueur + participation + sanctions officielles horodatées | Non : aucun modèle de cartons | Désactivé : banc, second jaune, rouge et après-match à définir | 6 |
| `player_shots` | 8/16 · 4/8 | Identité joueur + participation + tirs officiels | Non : aucun modèle de tirs | Désactivé : source serveur et définition des tirs non certifiées | 6 |
| `player_shots_on_target` | 16/16 · 8/8 | Identité joueur + participation + tirs cadrés officiels | Non : aucun modèle de tirs | Désactivé : source serveur et définition des tirs cadrés non certifiées | 6 |
| `player_tackles` | 2/16 · 1/8 | Identité joueur + participation + tacles officiels | Non : aucun modèle de tacles | Désactivé : source et définition des tacles non certifiées | 6 |
| `corners_european_handicap` | 12/16 · 6/8 | Corners par équipe + handicap entier + issue 1/N/2 | Non : aucun modèle de corners | Désactivé : source certifiée et règlement trois issues requis | 7 |
| `corners_spread` | 15/16 · 8/8 | Corners par équipe + handicap orienté + période | Non : aucun modèle de corners | Désactivé : source certifiée et règlement asiatique requis | 7 |
| `team_cards` | 6/16 · 3/8 | Sanctions officielles par équipe + unité + période + ligne | Non : aucun modèle de cartons | Désactivé : même blocage que total_cards + attribution équipe | 7 |
| `team_corners` | 15/16 · 8/8 | Corners officiels par équipe + période + ligne | Non : aucun modèle de corners | Désactivé : identité équipe, source et corrections non certifiées | 7 |
| `total_cards` | 6/16 · 3/8 | Sanctions officielles + unité (cartons/points) + période + ligne | Non : aucun modèle de cartons | Désactivé : seconde jaune, rouge, banc et unité à confirmer | 7 |
| `total_corners` | 16/16 · 8/8 | Total officiel des corners + période + ligne | Non : aucun modèle de corners | Désactivé : source persistée et corrections non certifiées | 7 |
| `bet_builder_boost` | 2/16 · 1/8 | Composition complète, prix joint, conditions de boost et règlement bookmaker | Non : aucun modèle joint général | Exclu : composition/promotion opaques ; aucun produit naïf des cotes | Exclu |
| `h2h_early_payout` | 16/16 · 8/8 | Chronologie des scores + seuil et règles propres au bookmaker | Non : aucun modèle de trajectoire | Exclu : ne jamais fusionner avec h2h ; promotion à règlement différent | Exclu |

## Périodes, absences et offres particulières

Les **35 lignes ci-dessus s’appliquent aussi séparément aux demandes `h1` et `h2`**, avec cette surcharge obligatoire de la matrice : couverture de catalogue identique dans ce relevé, couverture de prix de période **non confirmée**, aucune probabilité de période disponible, aucun nouveau règlement de période et aucune sélection jouable. Elles relèvent du lot 3 au plus tôt, et des dépendances des lots 4 à 7 pour leurs autres règles. `half_time_full_time` est déjà un marché joint de périodes : une variante limitée à H1/H2 ne doit pas être inventée d’après le paramètre de requête.

`team_totals` est **absent des trois catalogues**, comme des diagnostics de prix du 2 novembre. Son parseur, ses demi-lignes 0,5 à 5,5, ses probabilités et son règlement existent en étape 2, mais aucune couverture réelle n’est validée. Ne pas fabriquer une offre depuis `totals`. Les totaux équipe entiers/quarts restent désactivés (lot 4). Aucune autre clé n’est observée : toute future clé inconnue reste ignorée jusqu’à ajout explicite à cette matrice et validation.

Les exchanges et marchés prédictifs restent exclus par `propLineOffers` (type ou clé fournisseur). Les variantes régionales gardent des identités distinctes : `betclic_fr` n’est jamais fusionné avec une variante DE, idem pour Winamax. Une commission d’exchange, un boost, un remboursement promotionnel ou un early payout exige un règlement spécifique ; ne jamais les moyenner avec une offre classique. Le catalogue actuel ne permet pas d’en mesurer la couverture.

## Lots ordonnés et conditions de passage

L’ordre privilégie le score final déjà persisté et la couverture observée. Il décrit une mise en œuvre progressive, **pas des lots déjà activés**. Une famille dont les preuves manquent reste fermée même si une autre famille du même lot passe sa recette.

| Lot | Contenu et priorité | Critère propre à la famille avant activation |
|---|---|---|
| 0 : preuve fournisseur | Corriger `outcomes_count`, signaler les catalogues de périodes identiques, conserver le relevé et établir cette matrice. Livré dans cette branche. | Tests sur le format réel ; aucune nouvelle sélection jouable. |
| 1 : score final simple | Demi-lignes supplémentaires `totals`, `correct_score`, `winning_margin`, `european_handicap` : forte couverture, score réglementaire disponible. | Exemples réels de sélections/prix ; définition des issues « autre », des intervalles et du handicap orienté ; score à 90 min fiable même après prolongation. Ne pas généraliser le modèle à sa queue tronquée. |
| 2 : composites à score final | Les cinq marchés combinés nommés de la matrice ; couverture 16/16 sauf double chance + BTTS (6/16). | Prix joint fournisseur unique, composants normalisés et règlement conjoint ; aucune multiplication de cotes corrélées, aucun ajout de deux sélections du même match au ticket. Une seule sélection composite peut représenter le marché. |
| 3 : périodes | H1, H2 et mi-temps/fin pour les seules familles validées. | Période explicite sur une sélection cotée réelle, scores H1 et H2 persistés côté serveur, arrêts de jeu rattachés à la bonne période, prolongations/tirs au but exclus ; absence d’un score = attente de vérification. Pas de simple division par deux du modèle final. |
| 4 : règlement fractionné | Totaux entiers/quarts, totaux équipe et handicaps asiatiques. | Signes et lignes exacts sans arrondi ; remboursement, demi-gain et demi-perte représentés dans simples, combinés et chaque ligne de système, ainsi que ROI/ligues/historique ; paris existants inchangés. |
| 5 : chronologie | Première équipe à marquer, couverture 16/16 mais source événementielle nécessaire. | Flux serveur complet et corrigé des buts ; règle aucun but/CSC/VAR/annulation validée avec les conditions du fournisseur. Le score final seul ne suffit pas. |
| 6 : joueurs | Buteurs avant passes, puis statistiques et cartons ; couverture de 2 à 16 matchs selon marché. | Identifiant joueur durable, rapprochement fournisseur/ESPN univoque, participation officielle ; contrats de règlement pour absent, remplaçant, CSC, premier but et corrections ; source statistique persistée avec définition identique. Pas de règlement par nom de joueur ou composition probable. |
| 7 : corners et cartons équipe | Totaux/demi-lignes avant handicaps et variantes, couverture de 6 à 16 matchs. | Source serveur certifiée par période et équipe ; unités des cartons, second jaune/rouge/banc/après-match et corrections définies ; lignes fractionnées dépendantes du lot 4. La fiche ESPN dans le navigateur n’est pas une preuve de règlement serveur. |
| Exclus | Early payout, boosts opaques, exchanges/prédictifs. | Nouvelle étude de prix, règles et données dédiée ; aucune activation dans les lots précédents. |

## Contrat commun pour chaque activation

1. **Preuves fournisseur** : conserver des réponses réelles expurgées par famille, sur plusieurs matchs et compétitions, avec identités de bookmaker/région, sélection, période, équipe/joueur, ligne, issue, prix et horodatage. Vérifier explicitement les absences et les périodes. Aucun exemple simulé ne prouve la couverture réelle. Un nouveau relevé du catalogue corrige les compteurs, mais ne remplace pas les réponses de prix.
2. **Identité et collecte** : identité canonique `(match ESPN, marché, période, équipe/joueur, ligne exacte, issue)` plus provenance par bookmaker/région. Rapprochement univoque seulement. Prix valides >1 après conversion explicite, non futurs, non périmés, non suspendus, non retirés ; absence et cache distingués. Les retraits/suspensions doivent invalider le cache correspondant au lieu de ressusciter un prix. Ne pas mélanger lignes, périodes, joueurs, régions ou conditions promotionnelles.
3. **Résultats et règlement** : preuve serveur persistée, règles écrites avant code, mêmes choix acceptés en RPC et réglables côté serveur. Absence de donnée = attente de vérification, sans inventer de résultat ni rembourser automatiquement une issue inconnue. Tester gagnant/perdant/remboursé, absent, report/annulation, corrections, périodes et prolongations, lignes entières/quarts, idempotence et systèmes. Conserver les cotes et identités des anciens paris. Toute règle de délai de remboursement doit être explicite dans le Règlement du club.
4. **Sécurité et SQL** : migration après V39, validation exhaustive des clés/périodes/lignes/entités, cote réelle et coup d’envoi contrôlés côté serveur ; aucun montant, gain, statut ou statistique écrit par le navigateur. Tests de rejet des paramètres falsifiés, corrélations non prises en charge et doublons. Recette SQL isolée avant toute migration de production ; ligues, ROI et archives vérifiés sans réécriture des paris historiques.
5. **Interface** : familles dépliables, puis filtres période/équipe/joueur, avec cinq choix essentiels conservés. Libellé et règle complets dans ticket, comparaison et historique. Aucun bouton jouable si la donnée manque. Sans modèle validé : aucune probabilité, value ou recommandation ; simple cote réelle datée. Recette clavier, thèmes et largeurs 320/1280 px pour chaque famille activée.
6. **Publication** : tests fournisseur simulés + diagnostic réel, règlement et guides actualisés, migration et moteur serveur prêts avant collecte et interface. Activation explicite par famille, désactivée par défaut, réversible ; conserver le moteur des paris déjà acceptés lors d’une désactivation.

## Quota et données supplémentaires

Les deux collectes de production restent à **6 h et 18 h Paris**, aucun appel PropLine depuis le navigateur. Le collecteur actuel fait au plus huit appels groupés (un par compétition éligible) à chaque créneau. Ajouter des clés à une requête groupée peut augmenter le coût fournisseur : le relevé `/markets` ne documente pas ce coût. Il faut le mesurer avant activation, et ne pas supposer qu’une requête vaut un crédit pour toutes les familles.

L’inventaire ponctuel a consommé 56 requêtes (8 listes de matchs + 16 × 3 catalogues), plafond 60, sans nouvelle tentative ; ne pas l’ajouter à la planification. Les futurs diagnostics de prix doivent avoir un budget explicite, s’arrêter sur 401/403/429 et être exécutés hors créneaux de collecte. Les appels par événement/période/joueur et les nouvelles données de résultat représentent un budget supplémentaire non encore chiffré : aucune activation ne doit les ajouter silencieusement. Les secrets restent dans Actions.

## Validation et état de livraison

La branche BET-170 livre la matrice exhaustive, les décisions d’exclusion, les lots, la correction du diagnostic et [le premier lot déployable](MARKETS_PRODUCTION.md). Les tests utilisent l’extrait réel pour `outcomes_count` et un faux fournisseur pour les périodes identiques et les limites de requêtes. Les nouveaux choix de l’étape 3 étendent la RPC, l’interface et le règlement ; aucune migration ni activation de production n’est appliquée par cette branche.

**Premier lot livré** : un [diagnostic de prix réel](MARKETS_PRODUCTION.md) complète maintenant ce catalogue, et le code de collecte, règlement, SQL et interface est implémenté pour les formats explicites du lot 1. Les autres familles restent désactivées ; la procédure de production précise les formats et bornes pris en charge. **Reste nécessaire pour les autres lots** : preuves de sélection et de période, sources fiables et recettes serveur/SQL/interface par famille. Le ticket reste ouvert ; un inventaire réussi ne constitue pas une recette de paris. L’accès local ne dispose pas de la clé PropLine, qui existe uniquement dans Actions.
