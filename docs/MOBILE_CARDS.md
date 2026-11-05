# BET-182 · Cartes mobiles

La carte réutilise les données, le calcul du modèle et les événements existants. Sous 1024 px, le résumé et les pronostics se lisent sur une colonne, avec un padding de 16 px. La sélection principale affiche sa cote réelle, son EV estimée et « Ajouter au ticket ». EV désigne l’espérance estimée selon le modèle, sans garantie de bénéfice ; les conditions d’admissibilité des cotes restent inchangées.

Le chargement initial montre des squelettes sans fausse cote. Un calendrier vide est une réponse valide. Une panne sans calendrier conservé propose Réessayer ; un filtre sans résultat propose Réinitialiser les filtres. Les dernières données restent conservées en cas de panne après un chargement réussi.

Recette : serveur `npm start`, puis `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-mobile-cards.cjs`. Chromium système, compte et données simulés, réseau externe bloqué. Vérifications en clair/sombre à 375, 390, 430, 767, 768, 1023, 1024 et 1440 px : noms longs, absence de débordement, résumé vertical, EV/action, sélection du bon match/marché/cote et une seule confirmation après double clic. Chargement retardé, réponse vide, panne/réessayer et neuf bookmakers vérifiés séparément. Les règles du modèle et du classement ne sont pas modifiées. `npm test` : 377 succès. Préparation Pages : 52 modules.
