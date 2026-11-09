# Classement confirmé V3 (BET-169)

Comparatif : `docs/studies/BET-169-proposal.md`. Validation explicite reçue le 3 novembre 2026 dans le chat et inscrite dans YouTrack avant l’implémentation : seuil 10, pertes -10, zone provisoire séparée et prochaine période sans réécriture des archives.

## Déploiement et transition

Appliquer V38 après V37 **avant** de publier les scripts et le site. Le barème numérique reste V2 (gain plafonné à cote 5, perte -1 depuis BET-253, remboursement 0). La version de classement est distincte : V3 à compter d’une période démarrant le 9 novembre 2026 ou après.

- Groupe hebdomadaire : prochaine journée, lundi **9 novembre 2026 à 00 h Paris** (8 novembre à 23 h UTC).
- Classements mensuels spéciaux : **1er décembre 2026**.
- Saison générale et ligues privées : prochaine saison complète, **1er juillet 2027**. Les archives consultées conservent leur règle de période.
- Saison de ligue spéciale : son prochain début de saison situé après l’activation.
- Classement cumulatif « tous les temps » : nouvelle règle d’affichage à partir du 9 novembre ; aucun rang archivé n’est réécrit.

La migration n’exécute aucun UPDATE des résultats, points, bankrolls, cotes, quotas, récompenses ou archives. Les nouveaux snapshots hebdomadaires sont estampillés côté serveur. Les anciennes archives restent V2. Les futures lignes annuelles et titres spéciaux reçoivent leur version à l’insertion.

## Calcul et présentation

Le serveur compte les statuts gagnés/perdus officiels, jamais les paris en attente ou remboursés. Un gain à cote effective 1 reste une décision, même si son score est nul. Les décisions à statut historique manquant se rabattent sur un score non nul. Le ROI et les critères de promotion existants ne sont pas changés dans ce ticket.

V3 : 10 décisions ou plus donnent un rang confirmé. En dessous, `confirmed=false` et le rang public vaut NULL. Les points bruts restent visibles dans une table « Provisoires », avec compteur n/10. Aucun podium ni titre de champion/top ne prend ces joueurs ; pas de prime de classement mensuelle. Les tirelires et gains déjà acquis ne sont pas supprimés. Une période trop courte peut finir sans champion confirmé.

Les tables internes gardent un entier d’ordre pour la compatibilité des traitements, mais tous les écrans utilisent les vues publiques et le booléen certifié pour présenter le rang. Le placement initial attend une journée confirmée au lieu de consacrer une seule victoire. Les joueurs déjà classés conservent les critères de mouvement existants et les provisoires ne reçoivent pas de rang de champion.

Départage : points, ROI existant hors annulations, victoires, UUID. Même classement dans les écrans d’un même périmètre ; ne pas confondre semaine, mois, saison et cumul tous les temps.

## Recette

- `npm test` : seuil 9/10, annulations, gain à zéro point, classement, période V2/V3, titres, récompenses mensuelles, placement et table accessible.
- `PGLITE_MODULE=../work/ui/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-confirmed-ranking.mjs` : V38 réelle sur PostgreSQL isolé, réexécution, SQL public/privé identique sur 1/1 vs 5/11 vs 10/20, snapshot estampillé, archives intactes, droits privés conservés.
- Migration répétée en transaction annulée sur le schéma réel avant application ; aucune bascule anticipée cette semaine.

## Livraison vérifiée

V38 appliquée le 3 novembre 2026 dans une transaction répétable, avec comparaison avant/après des paris, comptes, entrées de ligue, pronostics journaliers/spéciaux, résultats hebdomadaires/annuels, titres, journal de jetons et trois classements publics. Aucun changement des données ni des rangs actuels ; V2 cette semaine et V3 prête pour le 9 novembre. 291 tests Node passent. Captures V3 de données de test : `docs/recette/BET-169-*.png` (desktop, 320 px clair et sombre, zones nommées dans l’arbre accessible).

BET-253 actualise les points des défaites existantes à -1 sans modifier les seuils de confirmation. Le comparatif BET-169 ci-dessus décrit le barème historique à sa date.
