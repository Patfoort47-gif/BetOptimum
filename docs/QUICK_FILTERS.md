# BET-188 · Filtres rapides

La barre propose Cotes > 1,80, Matchs du jour, EV+ et Championnats (sélection multiple et compteur). Les critères cote/EV doivent être satisfaits par une même sélection admissible du match ; les championnats sont réunis par union. EV+ reprend le seuil du site : cote réelle et value strictement supérieure à 3 %. Le jour suit Paris comme le calendrier. Les calculs du modèle restent inchangés.

Les boutons gardent le focus et annoncent leur état ; le nombre de rencontres est une région de statut. La barre se replie sur deux colonnes sous 768 px et reste collante sous l’en-tête, dont la hauteur est mesurée. Réinitialiser efface aussi ces filtres. Les sélections et la mise du ticket sont conservées. Les états vide et erreur réutilisent Réinitialiser et Réessayer.

Recette : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-quick-filters.cjs` avec serveur local 4173, services externes bloqués. Huit largeurs 375 à 1440 px : intersection, championnats, compteur, focus conservé, dimensions tactiles, position collante et absence de débordement. Deux tests Node vérifient les seuils stricts, la même sélection, les cotes indisponibles et la date.
