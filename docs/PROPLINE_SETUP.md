# PropLine : source unique des cotes (BET-152)

Le pipeline demande `h2h,totals,both_teams_to_score` en une requête par compétition ayant un match à venir. Tous les marchés de match complet activés couvrent les sept prochains jours, y compris les totaux, BTTS, doubles chances, handicaps et scores exacts (BET-262). Le seuil de dix bookmakers par sélection et l’expiration des marchés étendus restent applicables. La même réponse groupée est utilisée, sans appel supplémentaire.

Le secret Actions `PROPLINE_API_KEY` est envoyé uniquement à `api.prop-line.com` via `X-API-Key`. Aucun secret dans Pages. The Odds API n’est plus appelé par le pipeline ; son ancien cache reste lisible avec ses dates et sa provenance.

Tous les bookmakers renvoyés sont examinés. Les identifiants régionaux restent distincts ; seules les clés historiques `betclic` et `winamax` correspondent respectivement à `betclic_fr` et `winamax_fr`. Une même clé ne compte qu’une fois par sélection. Les exchanges (Betfair, Matchbook, Smarkets et types exchange), marchés prédictifs (Polymarket, Kalshi et type prediction_market) sont exclus : prix, commissions et liquidité ne sont pas comparables aux prix fixes retenus.

Les prix américains sont convertis en décimal. Les périodes partielles, totaux équipe, offres masquées ou retirées et prix datant de plus d’une heure sont rejetés. Le rapprochement exige une orientation et un horaire cohérents, sans ambiguïté. Une réponse partielle conserve le dernier cache, clairement marqué comme tel ; aucune cote estimée n’est transformée en cote réelle.

Les collectes ont lieu à 6 h et 18 h Europe/Paris. Le cron couvre les deux décalages UTC ; le contrôle local élimine les deux passages supplémentaires. Aucun appel au rechargement du site. Maximum huit requêtes par collecte, seize par jour, sans nouvelle tentative automatique. `maxRequests` permet de réduire ce budget ; il faut confronter ce plafond au quota réel du compte avant activation. Un refus 401, 403 ou 429 arrête les appels suivants. Une clé absente est signalée comme échec, sans exposer de secret.

## Validation avant fusion

Exécuter le diagnostic `scripts/check-propline.mjs` avec le secret Actions, sur plusieurs compétitions et rencontres. Vérifier 1N2, Over 2,5 et BTTS Oui chez plusieurs bookmakers et les identifiants régionaux. Les tests simulés ne prouvent pas la couverture réelle du fournisseur. Vérifier les données publiées après la première collecte, les moyennes et compteurs, les dates et les replis en cache. Le direct ESPN et le règlement restent inchangés.

## Inventaire (BET-154)

Le diagnostic `scripts/propline-inventory.mjs` est lancé à la main et consomme au plus 60 requêtes (56 par défaut), en plus des seize requêtes quotidiennes de la collecte. Le lancer en dehors des créneaux de 6 h et 18 h et vérifier le quota du compte avant. Voir `docs/MARKETS_SETUP.md`.

## Compétitions du calendrier (BET-251)

La collecte utilise `scripts/propline-competitions.mjs`, indépendante de l’historique football-data.org. Ligue des nations et DFB-Pokal rejoignent les huit compétitions historiques. Pour les autres compétitions à venir, une requête au catalogue `GET /v1/sports` résout le libellé ou un alias exact vers la clé canonique : Coupe de France, Copa del Rey (Coupe du Roi), FA Cup, Carabao Cup, Coppa Italia, Ligue 2, Supercoupe d’Europe, Coupe du monde des clubs et qualifications européennes. Aucune clé de coupe n’est devinée ; une correspondance absente, inactive ou ambiguë est signalée dans `failures` et `coverage.propLineUnavailableLeagues`. La disponibilité des prix et le minimum de dix bookmakers restent dépendants du fournisseur.

Le catalogue compte dans le plafond existant de huit requêtes par collecte. Il n’est interrogé que si une compétition à venir n’a pas de correspondance connue. Les appels de cotes sont ordonnés par prochain coup d’envoi ; si le budget est insuffisant, une erreur partielle le signale. Aucun changement aux réservations espacées de douze heures. Le diagnostic `check-propline.mjs` utilise la même découverte. La validation réelle doit lire le rapport Actions avec la clé de production ; les tests locaux utilisent des réponses simulées.

Référence fournisseur : https://www.prop-line.com/docs (`GET /v1/sports`), https://www.prop-line.com/llms-full.txt (clés Ligue des nations et DFB-Pokal).

## Collecte manuelle forcée (BET-252)

Sur demande explicite du propriétaire, lancer le workflow `update-fixtures.yml` avec `force_odds_sync=true` permet une collecte immédiate malgré le délai de douze heures ou les deux tentatives sur vingt-quatre heures. L’option est désactivée par défaut et n’est transmise au script de quota que pour `workflow_dispatch`. La tentative supplémentaire reste dans le journal durable avant tout appel ; les collectes automatiques suivantes la comptent normalement. Le plafond de huit requêtes, l’arrêt sur 401/403/429 et les contrôles de cotes restent appliqués.
