# BET-191 · Présentation des opportunités EV

Table validée explicitement par le propriétaire dans la conversation : EV réelle > 3 % = Fort potentiel (vert) ; 0 < EV ≤ 3 % = À surveiller (orange) ; EV ≤ 0 = aucun badge d’opportunité, avec explication ; donnée absente ou cote inadmissible = EV indisponible. Les comparaisons précèdent l’arrondi. Aucun seuil du moteur ni ordre de recommandation n’est changé ; le filtre EV+ conserve sa règle >3 %.

Le libellé et la couleur sont affichés ensemble, avec EV numérique (deux décimales maximum). Les aides rappellent la table et l’absence de garantie. Les dates, cache et avertissements restent visibles. Les catégories ne rendent jamais une cote inadmissible sélectionnable.

Recette : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-opportunity-badges.cjs`, huit largeurs 375 à 1440 en clair/sombre, seuils, numérique, absence expliquée, changement de thème, sélection conservée et audit de contraste des badges. Deux tests Node couvrent les bornes exactes et les données manquantes/non réelles/non admissibles. 387 tests Node réussis.
