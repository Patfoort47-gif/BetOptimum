# PropLine : source unique des cotes (BET-152)

Le pipeline demande `h2h,totals,both_teams_to_score` en une requête par compétition ayant un match à venir. 1N2 couvre sept jours ; Over exactement 2,5 et BTTS Oui restent limités à 48 heures. Les autres lignes ne sont pas activées par cette migration.

Le secret Actions `PROPLINE_API_KEY` est envoyé uniquement à `api.prop-line.com` via `X-API-Key`. Aucun secret dans Pages. The Odds API n’est plus appelé par le pipeline ; son ancien cache reste lisible avec ses dates et sa provenance.

Tous les bookmakers renvoyés sont examinés. Les identifiants régionaux restent distincts ; seules les clés historiques `betclic` et `winamax` correspondent respectivement à `betclic_fr` et `winamax_fr`. Une même clé ne compte qu’une fois par sélection. Les exchanges (Betfair, Matchbook, Smarkets et types exchange), marchés prédictifs (Polymarket, Kalshi et type prediction_market) sont exclus : prix, commissions et liquidité ne sont pas comparables aux prix fixes retenus.

Les prix américains sont convertis en décimal. Les périodes partielles, totaux équipe, offres masquées ou retirées et prix datant de plus d’une heure sont rejetés. Le rapprochement exige une orientation et un horaire cohérents, sans ambiguïté. Une réponse partielle conserve le dernier cache, clairement marqué comme tel ; aucune cote estimée n’est transformée en cote réelle.

Les collectes ont lieu à 6 h et 18 h Europe/Paris. Le cron couvre les deux décalages UTC ; le contrôle local élimine les deux passages supplémentaires. Aucun appel au rechargement du site. Maximum huit requêtes par collecte, seize par jour, sans nouvelle tentative automatique. `maxRequests` permet de réduire ce budget ; il faut confronter ce plafond au quota réel du compte avant activation. Un refus 401, 403 ou 429 arrête les appels suivants. Une clé absente est signalée comme échec, sans exposer de secret.

## Validation avant fusion

Exécuter le diagnostic `scripts/check-propline.mjs` avec le secret Actions, sur plusieurs compétitions et rencontres. Vérifier 1N2, Over 2,5 et BTTS Oui chez plusieurs bookmakers et les identifiants régionaux. Les tests simulés ne prouvent pas la couverture réelle du fournisseur. Vérifier les données publiées après la première collecte, les moyennes et compteurs, les dates et les replis en cache. Le direct ESPN et le règlement restent inchangés.

## Inventaire (BET-154)

Le diagnostic `scripts/propline-inventory.mjs` est lancé à la main et consomme au plus 60 requêtes (56 par défaut), en plus des seize requêtes quotidiennes de la collecte. Le lancer en dehors des créneaux de 6 h et 18 h et vérifier le quota du compte avant. Voir `docs/MARKETS_SETUP.md`.
