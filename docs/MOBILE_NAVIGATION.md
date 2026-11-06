# Navigation mobile · BET-183

Sous 768 px : Grille, Bankroll, Communauté et Algorithme. Les routes existantes restent inchangées, notamment `#communaute`. Les clics mobiles ajoutent une entrée à l’historique ; Retour restaure la rubrique et son état actif. Ticket reste accessible par « Mon ticket », Compte dans l’en-tête.

Recette locale : serveur `npm start`, puis `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-mobile-navigation.cjs` (Playwright et Chromium système). Les services externes sont bloqués, le compte est simulé et aucune donnée distante n’est écrite.

Vérifications automatisées aux largeurs 375, 390, 430, 767, 768, 1023, 1024 et 1440 : visibilité au seuil, quatre commandes, dimensions des cibles, historique Retour, état `aria-current`, absence de débordement et d’erreur JavaScript. Le bas du contenu conserve une marge pour la barre et la zone sûre. La recette de performance historique reste bloquée avant interaction : ses deux cartes simulées ne sont pas rendues. La conservation des sélections n’est donc pas validée par cette recette pour ce ticket.

BET-235 : les quatre destinations restent isolées (Matchs, Bankroll, Communauté, Algorithme). Un changement de destination repart immédiatement en haut, y compris via les URL historiques et retour navigateur. Le ticket mobile est un tiroir indépendant du contenu actif ; sa bulle reste disponible avec des sélections dans tous les onglets. Le compte reste accessible dans l’en-tête.
