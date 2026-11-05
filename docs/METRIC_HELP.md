# BET-187 · Aides des indicateurs

Inventaire : cote décimale réelle, EV estimée et confiance dans les cartes ; ROI du bilan public et de la bankroll ; ROI de classement distinct dans la Communauté. Aucune cote théorique « algo » n’est inventée : la cote affichée est celle du marché réel, la confiance est celle du modèle. Les textes sont centralisés dans `metric-help.js` et n’annoncent aucune garantie.

Une aide non interactive (`role=tooltip`, lien `aria-describedby` sur le bouton actif) apparaît au survol après 200 ms ou au focus. Elle est survolable, se ferme à Échap sans déplacer le focus, puis à la sortie ou au clic extérieur. Un toucher ouvre la même explication ; un second toucher ou un toucher extérieur ferme. Le popover natif place l’aide au premier plan, y compris dans une fenêtre, avec repli sans Popover API. Position limitée au viewport, largeur 280 px maximum, couleurs du thème.

Recette locale : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-metric-help.cjs`. Huit largeurs 375 à 1440 px en clair et sombre, contexte tactile sous 768 : focus, description, Échap, focus conservé, limites du viewport, survol de l’aide, sortie et toucher extérieur. 383 tests Node réussis. Aucun calcul ni accès au classement modifié.
