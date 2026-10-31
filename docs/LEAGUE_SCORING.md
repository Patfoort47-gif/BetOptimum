# BET-132 : barème unique pour tous les classements

Le classement additionne les résultats à mise fixe : il récompense le résultat des choix et leur difficulté, sans donner d'avantage à une grosse bankroll. Ce n'est pas une estimation statistique certaine du niveau d'un joueur.

## Points

- Gagné : `(min(cote effective, 5) - 1) × 10`, arrondi au centième.
- Perdu : -10. Annulé : 0. Les systèmes restent exclus.
- Un combiné est un seul ticket. Sa cote effective est le produit des sélections gagnées ; les sélections annulées sont retirées. La cote ne provient pas du gain monétaire arrondi, pour ne pas favoriser certaines mises.
- Aucun multiplicateur lié à la division, au niveau, à la série ou aux jetons.
- Même formule pour tous les pronostics éligibles, historique compris : ligue générale, grilles et compétitions. Les ligues privées reprennent la ligue générale.

Le plafond de +40 limite le poids d'un succès isolé sans supprimer la récompense des choix difficiles. Le score reste sensible à la variance des résultats : il ne garantit pas une mesure parfaite du niveau.

## Participation et classement

Les quotas restent explicites : 10 tickets libres/semaine de Paris, un ticket compté par match, jusqu'à 4 pronos communs/jour en supplément ; compétitions : un match phare et 3 libres (2 en élimination directe). Le défi commun peut peser plus lourd que les tickets libres : aucune pondération cachée.

Départage commun : points, ROI normalisé arrondi à 0,1 %, victoires, UUID stable. Le dernier critère rend l'affichage déterministe ; il n'exprime pas une différence de mérite. L'ancienneté et la bankroll ne départagent pas les joueurs.

Le ROI de classement est `points / (10 × résultats non nuls) × 100` ; les annulations n'affectent ni ROI ni minimum de participation. Ce ROI reste distinct du ROI financier fictif des paris.

Promotion : au moins 10 résultats décidés et 50 % des pronos du défi accessibles depuis l'arrivée du joueur dans la saison. Le dénominateur exclut les matchs annulés et ceux qui n'ont pas commencé. Les absents ont aussi un dénominateur. Si aucune occasion n'existe, seul le minimum de 10 s'applique. La qualification conditionne la promotion, pas l'ordre des points affichés. Les règles de placement, de descente et les titres de compétitions (60 % des journées) restent distincts.

## Recalcul de l'historique et déploiement

1. Appliquer `supabase/migrations/supabase-v31-schema.sql` après V30. La migration est transactionnelle et réexécutable.
2. Déployer les modules JS et l'aide HTML, puis lancer la synchronisation habituelle pour actualiser les classements courants.
3. Vérifier qu'aucun pronostic enregistré ne conserve un autre calcul et que les totaux du général, du groupe et des ligues concordent avec leurs sources.

`rescore_league_history()` est réservé au serveur. Il recalcule les points des paris réglés, des défis, des grilles et des pronostics de compétitions. Il reconstruit les totaux, ROI, formes et rangs des groupes et des compétitions, y compris les mois archivés et les bilans de saison. Les classements généraux et privés lisent directement les écritures recalculées. Les paris encore en attente seront réglés avec le même barème.

Le recalcul ne réexécute aucun règlement financier : mises, payouts, bankrolls, statuts, dates, récompenses versées et décisions de promotion passées sont conservés. Seuls les points et les statistiques de classement sont reconstruits. Les snapshots mensuels sont reconstruits depuis la date de règlement des écritures rattachées aux saisons de football pour éviter une perte d'historique.

La date de règlement enregistrée sert à évaluer les annulations pour ancienneté des matchs. Un match historique réglé ne doit pas devenir annulé parce que sa ligne de calendrier n'a plus été actualisée depuis. Les scripts de réparation et les futurs règlements utilisent le même plafond de cote. Le champ technique `scoring_version` reste à 2 pour compatibilité avec les clients existants ; il ne sélectionne plus de règle de calcul.

Ne pas réinstaller les fonctions de migrations antérieures après V31 sans réappliquer V31. Les signatures de RPC sont conservées ; le serveur ignore les points proposés par un script et applique lui-même le calcul.

## Validation reproductible

`npm test`

Recette PostgreSQL en mémoire, indépendante de la production :

```sh
npm install --cache /tmp/bet-ranking-npm-cache --prefix /tmp/bet-ranking-tools @electric-sql/pglite
PGLITE_MODULE=/tmp/bet-ranking-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-ranking-sql.mjs
```

Elle vérifie la transition de schéma, la correspondance JS/SQL sur 66 cas, le recalcul intégral et son idempotence, les archives et rangs, les paris en attente, les annulations, les permissions et la conservation des bankrolls, gains, statuts et dates. Aucun accès réseau ni donnée réelle n'est requis par cette recette.
