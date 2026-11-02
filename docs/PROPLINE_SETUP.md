# Complément PropLine pour les cotes françaises

BET-151 : le diagnostic du 2 novembre 2026 a confirmé que The Odds API ne renvoyait ni BTTS, ni totaux, ni totaux alternatifs pour Betclic FR et Winamax FR/DE sur Newcastle-Everton, même en ciblant explicitement ces identifiants. PropLine est un complément pour les deux variantes françaises uniquement.

## Configuration et vérification

Ajouter le secret Actions `PROPLINE_API_KEY` au dépôt. La clé reste dans Actions, transmise à `api.prop-line.com` par l’en-tête `X-API-Key`. Elle ne va ni dans le dépôt ni dans les fichiers Pages. Sans clé, le complément est désactivé.

Le workflow manuel `audit-french-odds.yml` lance `scripts/check-propline.mjs` : un seul appel groupé sur la Premier League, sans modification du calendrier ni publication de cotes. Le rapport filtre les champs fournisseur et montre les marchés reçus et les offres utilisables. Valider au moins un prix réel avant la mise en service. Ce diagnostic remplace le précédent diagnostic manuel The Odds API ; il ne relance pas le pipeline complet.

## Collecte et fusion

`update-fixtures.yml` fournit le secret à `scripts/update-fixtures.mjs`. Le complément utilise les compétitions déjà présentes dans `providerMap`, seulement si elles ont une rencontre à venir dans les 48 h. Une requête groupée par compétition demande `totals,both_teams_to_score` et `bookmakers=betclic,winamax`. Au maximum huit appels par collecte, donc 24 par jour aux trois créneaux existants (7 h, 14 h, 19 h de Paris). Aucun appel The Odds API supplémentaire.

Le rapprochement exige une date à 15 minutes près et une correspondance ESPN unique, ou à défaut une correspondance unique des deux équipes dans le même ordre. Un identifiant ESPN contradictoire interdit le repli par noms. Pas d’utilisation d’événements en direct.

Les cotes PropLine `price` sont américaines : conversion explicite en décimal, ou utilisation de `price_decimal` si fourni. Seuls le total du match Over à 2,5 et BTTS Yes en temps réglementaire sont retenus. Mi-temps, totaux équipe, valeurs invalides/masquées, retraits déjà signalés et marchés de plus d’une heure sont exclus.

Les clés PropLine `betclic` et `winamax` deviennent `betclic_fr` et `winamax_fr`. Elles complètent les cellules absentes des réponses The Odds API avant la fusion du cache, sans écraser une cote primaire fraîche ni compter deux fois le bookmaker. Les dates et la provenance par marché restent présentes en cache. Les cotes conservées restent marquées « cache » et peuvent être anciennes. Une erreur PropLine laisse fonctionner les autres sources et est indiquée dans `failures` ; un refus d’accès ou quota atteint arrête les appels PropLine suivants.

Les compteurs `propLineRequested`, `propLineSucceeded` et `propLineMatches` permettent de vérifier chaque collecte dans `coverage`. Les moyennes, effectifs de bookmakers et marchés réels sont recalculés à partir des offres fusionnées. Le règlement du club utilise le calendrier publié comme auparavant.

## Références et limites

- Documentation : https://prop-line.com/docs
- Conditions d’utilisation : https://prop-line.com/terms (valeurs individuelles dans une application ; pas de redistribution de corpus fournisseur).
- Tests : `node tests/propline-odds.test.js`, puis `npm test`.

La disponibilité annoncée n’est pas une garantie de couverture de chaque rencontre. Sans réponse ou sans rapprochement certain, aucune cote n’est inventée et le cache suit ses règles existantes. Le diagnostic ne donne pas à lui seul la preuve de couverture de toutes les compétitions.
