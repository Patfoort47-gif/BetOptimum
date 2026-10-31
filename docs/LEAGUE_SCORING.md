# BET-131 : points et équité des classements

Le classement reste une somme de résultats à mise fixe : il récompense le résultat des choix et leur difficulté, sans donner d'avantage à une grosse bankroll. Ce n'est pas une estimation statistique certaine du niveau d'un joueur.

## Barème V2

- Gagné : `(min(cote effective, 5) - 1) × 10`, arrondi au centième.
- Perdu : -10. Annulé : 0. Les systèmes restent exclus.
- Un combiné est un seul ticket. Sa cote effective est le produit des sélections gagnées ; les sélections annulées sont retirées. La cote ne provient pas du gain monétaire arrondi, pour ne pas favoriser certaines mises.
- Aucun multiplicateur lié à la division, au niveau, à la série ou aux jetons.
- Même formule pour la ligue générale, les grilles et les compétitions. Les ligues privées reprennent la ligue générale.

Le plafond à 5 limite un succès isolé à +40 contre +90 précédemment. Il diminue la variance sans supprimer la récompense des choix difficiles. Il favorise davantage les paris prudents que l'ancien plafond : ce compromis est explicite, pas une garantie d'équité parfaite.

## Participation et classement

Les quotas existants restent inchangés : 10 tickets libres/semaine de Paris, un ticket compté par match, jusqu'à 4 pronos communs/jour en supplément ; compétitions : un match phare et 3 libres (2 en élimination directe). Le défi commun peut peser plus lourd que les tickets libres : aucune pondération cachée.

Départage commun : points, ROI normalisé arrondi à 0,1 %, victoires, UUID stable. Le dernier critère rend l'affichage déterministe ; il n'exprime pas une différence de mérite. L'ancienneté et la bankroll ne départagent plus les joueurs.

Le ROI de classement est `points / (10 × résultats non nuls) × 100` ; les annulations n'affectent ni ROI ni minimum de participation. Ce ROI reste distinct du ROI financier fictif des paris.

Promotion : au moins 10 résultats décidés et 50 % des pronos du défi accessibles depuis l'arrivée du joueur dans la saison. Le dénominateur exclut les matchs annulés et ceux qui n'ont pas commencé. Les absents ont aussi un dénominateur : une absence de ligne de participation ne doit pas masquer les défis manqués. Si aucune occasion n'existe, seul le minimum de 10 s'applique. La qualification conditionne la promotion, pas l'ordre des points affichés. Les règles existantes de placement, de descente et les titres de compétitions (60 % des journées) restent distincts.

## Transition et déploiement

1. Appliquer `supabase/migrations/supabase-v30-schema.sql` après V29. La migration est transactionnelle et réexécutable.
2. Déployer les modules JS et l'aide HTML, puis lancer la synchronisation habituelle pour recalculer groupes et compétitions. Les vues générales et privées lisent directement les points ; les instantanés de groupe sont actualisés par le pipeline.
3. Vérifier un joueur sur les deux écrans à périmètre égal, puis l'aide au clavier et sur téléphone.

V1 : toutes les lignes déjà présentes, même en attente, conservent le plafond à 10 et leur ancien mode de calcul. V2 : les nouveaux pronostics reçoivent leur version côté serveur, immuable ensuite. Une adhésion tardive de compétition conserve la version du ticket source. La réparation d'historique tient compte de cette version et ne réécrit aucun résultat déjà enregistré. Aucun solde, jeton ou gain de bankroll n'est recalculé.

Le serveur dérive les points des cotes et de la version ; il ignore le paramètre historique `p_points` pour empêcher les divergences entre versions de scripts. Les droits de règlement restent réservés au rôle serveur. Le retrait des sélections annulées utilise les mêmes critères que `buildResults` : annulation officielle ou match non terminé dix jours après son coup d'envoi.

Ne pas réexécuter les anciennes migrations de règlement ou le paquet d'activation V18-V22 après V30 sans réappliquer V30 : ils redéfinissent les fonctions serveur. Pour un retour du code seul, la base continue de faire autorité sur les points ; ne pas supprimer les colonnes de version.

## Validation reproductible

`npm test`

Recette PostgreSQL en mémoire, indépendante du service de production :

```sh
npm install --cache /tmp/bet-ranking-npm-cache --prefix /tmp/bet-ranking-tools @electric-sql/pglite
PGLITE_MODULE=/tmp/bet-ranking-tools/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-ranking-sql.mjs
```

Elle vérifie la migration deux fois, la correspondance JS/SQL sur 66 cas, les versions historiques, les règlements idempotents, l'absence de contournement via `p_points`, les annulations, la réparation historique, l'arrivée tardive, la participation des absents et le même départage dans les groupes, le général et le privé. Aucun accès réseau ni donnée réelle n'est requis par cette recette.
