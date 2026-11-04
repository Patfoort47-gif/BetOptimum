# BET-170 : première mi-temps

## Périmètre retenu par le propriétaire

Décision du 4 novembre 2026 : terminer H1 puis publier et clôturer ; abandonner les autres extensions. Le premier lot déjà en production et le seuil de dix restent acquis. H2, mi-temps/fin, composites et lots 4 à 7 ne sont pas activés ni présentés comme livrés.

H1 : 1N2 et totaux match 0,5 / 1,5 / 2,5, neuf clés canoniques `h1Home`, `h1Draw`, `h1Away`, `h1Over05`, `h1Under05`, `h1Over15`, `h1Under15`, `h1Over25`, `h1Under25`. Uniquement les choix à dix bookmakers distincts, réels, datés et non expirés. Les autres choix n’apparaissent pas. Famille « 1re mi-temps » dépliable, ticket et historique avec période explicite. Aucune probabilité, value, mise conseillée ou recommandation H1 sans modèle validé.

## Collecte et résultats

`PROPLINE_H1_ENABLED=true` est indépendant de l’étape 3 ; les composites ne sont pas activés. Un seul appel groupé par compétition, au plus huit comme auparavant, avec `period=all` ; seules les lignes du match entier déjà validées et les neuf identités H1 sont acceptées. H2 et totaux équipe restent exclus de H1. Les deux créneaux restent 6 h / 14 h Paris, aucun appel de cotes navigateur. Prix H1 de plus d’une heure refusés à la collecte, sans repli cache ; expiration serveur/navigateur à vingt heures, seuil par choix.

Les scripts de calendrier et de résultats prélèvent les résumés serveur ESPN des matchs terminés : au plus seize appels supplémentaires par exécution, cache six heures et vérification des corrections. Ce budget ne concerne pas PropLine. L’identité événement, l’orientation des équipes, les scores finaux et la cohérence des lignes sont vérifiés ; les buts de H1 proviennent des deux premières lignes de périodes, jamais du score final divisé par deux, ni d’un commentaire.

Les arrêts de jeu sont inclus dans la période officielle. Les lignes de prolongation et de tirs au but sont ignorées. Preuves : six résumés finaux multi-compétitions et [finale Argentine-France après tirs au but](evidence/espn-h1-extra-time-2026-11-04.json.gz), dont score H1 2 - 0 distinct du 3 - 3 final et du 4 - 2 aux tirs au but.

Le résultat `periodScores` est publié dans les données et persisté dans `fixtures.period_scores`, avec source, identifiants, date de vérification et score final de contrôle. Un score absent, incohérent ou contredit par un score final corrigé laisse le pari en attente. Le règlement H1 intervient après la fin de la rencontre, pas au direct de la mi-temps. Une annulation rembourse ; un combiné/système retire la sélection remboursée à cote 1. Ligues/ROI utilisent les gains et cotes figés habituels. Les écritures de résultat restent côté serveur ; une correction est revalidée avant de régler un pari encore en attente, sans rejouer un versement déjà acquis.

## Ordre de publication

1. Recettes Node, SQL isolée et interface avant activation. Rejouer le diagnostic manuel `h1-release`, budget huit, pour vérifier `period=all`, les prix H1 au seuil de dix et les compteurs de quota `X-Daily-*`.
2. Appliquer V45 dans BetMaster après V43. **V44 composites reste volontairement non appliquée et n’est pas une dépendance de V45.** La recette teste V45 directement après le schéma des marchés V41 et deux exécutions de V45. La migration ajoute `period_scores`, les neuf labels et les contrôles de la RPC. Aucun pari historique n’est réécrit.
3. Vérifier colonne et labels en lecture seule. Fusionner la PR #105 ; les workflows activent H1 explicitement et vérifient V45 avant collecte. La production conserve `PROPLINE_MARKET_STAGE=3`.
4. Vérifier le déploiement Pages, lancer manuellement Actualiser les matchs et contrôler la collecte, les compteurs par choix, les expirations et la synchronisation Supabase. Vérifier l’interface sur les cotes réelles.
5. Clôturer BET-170 après ces preuves, en distinguant H1 livré des extensions abandonnées par décision du propriétaire.

## Vérification et retour arrière

`npm test`, `node scripts/prepare-pages.mjs`, `PGLITE_MODULE=… node scripts/check-markets-h1-sql.mjs`. Recette SQL : neuf labels JS/SQL, migration réexécutable indépendante de V44, seuil 9/10, prix falsifiés, expiration, périodes/lignes invalides et doublons. Tests serveur : sources réelles, absence/incohérence, prolongation/tirs au but, cache borné, correction, annulation, combinés et systèmes, points de ligue et persistance. Recette interface : clavier, thèmes, 320/1280 px, comparaison, ticket et historique ; aucune valeur de modèle inventée.

Retour arrière : remettre `PROPLINE_H1_ENABLED=false` dans `update-fixtures.yml`, puis relancer une collecte. Garder `PROPLINE_H1_ENABLED=true` dans `update-results.yml` pour le règlement des paris acceptés. Conserver V45, `period_scores` et le moteur H1 tant que des paris acceptés en dépendent. Les scripts de résultats doivent rester activés pour terminer ces paris ; ne pas supprimer leur source de résultat avec les nouvelles cotes.

## Diagnostic de la requête de production avant activation

[Run 41841671085](https://github.com/Patfoort47-gif/BetOptimum/actions/runs/41841671085), commit `8f78bf0e15956ff3ed5700bf5a6e8848ea146024`, artefact 13329001896 : huit requêtes réussies, seize rencontres, huit compétitions, aucune erreur. La requête groupée réelle `period=all` renvoie simultanément les marchés du match entier et H1. L’audit du parseur retrouve 142 choix H1 au seuil de dix, **dont 52 dans la fenêtre jouable de 48 heures**. Les 90 autres attendent cette fenêtre ; ils ne sont pas annoncés comme jouables immédiatement. Les choix du match entier restent séparés.

[Réponse intégrale compressée](evidence/propline-h1-release-2026-11-04.json.gz), [audit et compteurs](evidence/propline-h1-release-audit-2026-11-04.json). Les en-têtes observés indiquent une limite quotidienne de 1 000 et au moins 953 requêtes restantes. Les compteurs de réponses mises en cache ne sont pas monotones ; ils sont conservés tels quels et ne permettent pas d’inventer un débit exact de crédits. La collecte H1 conserve huit requêtes groupées maximum par passage et les deux créneaux existants.

V45 appliquée et vérifiée sur BetMaster le 4 novembre 2026 avant fusion : colonne `period_scores` présente, labels H1 corrects, labels historiques conservés, H2 et composites refusés. Le corps de `place_bet` en production a été comparé à V41 avant remplacement pour vérifier l’absence de changement concurrent à écraser. V44 composites n’a pas été appliquée. Les références finales de déploiement et de collecte seront conservées dans BET-170.
