# BET-186 · Grille et ticket desktop

Dès 1024 px, la zone utile est divisée en 65/35 hors gouttière de 24 px. Le fil latéral devient le fil au-dessus des cartes pour ne pas créer une troisième colonne. Le volet utilise sticky avec la hauteur réelle de l’en-tête, une hauteur maximale basée sur 100dvh et un défilement interne. Les enfants ne rétrécissent pas ; le bas du ticket reste accessible. Entre 768 et 1023 px, les blocs sont dans le flux sur une colonne. Le tiroir téléphone existant reste disponible.

Recette Chromium : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-desktop-ticket.cjs`, serveur local 4173 et données simulées. Mesures 65/35 et 24 px à 1024/1280/1440, sticky, accès au dernier bouton par défilement/focus ; redimensionnement à 1023 puis 375 avec sélection et mise 32,45 € conservées. 382 tests Node réussis. Aucun calcul métier modifié.
