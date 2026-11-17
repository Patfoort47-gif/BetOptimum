# BET-182 · Cartes mobiles

La carte réutilise les données, le calcul du modèle et les événements existants. Sous 1024 px, le résumé et les pronostics se lisent sur une colonne, avec un padding de 16 px. La sélection principale affiche sa cote réelle, son EV estimée et « Ajouter au ticket ». EV désigne l’espérance estimée selon le modèle, sans garantie de bénéfice ; les conditions d’admissibilité des cotes restent inchangées.

Le chargement initial montre des squelettes sans fausse cote. Un calendrier vide est une réponse valide. Une panne sans calendrier conservé propose Réessayer ; un filtre sans résultat propose Réinitialiser les filtres. Les dernières données restent conservées en cas de panne après un chargement réussi.

Recette : serveur `npm start`, puis `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-mobile-cards.cjs`. Chromium système, compte et données simulés, réseau externe bloqué. Vérifications en clair/sombre à 375, 390, 430, 767, 768, 1023, 1024 et 1440 px : noms longs, absence de débordement, résumé vertical, EV/action, sélection du bon match/marché/cote et une seule confirmation après double clic. Chargement retardé, réponse vide, panne/réessayer et neuf bookmakers vérifiés séparément. Les règles du modèle et du classement ne sont pas modifiées. `npm test` : 377 succès. Préparation Pages : 52 modules.

BET-353 : issues 1/N/2 directement tactiles, cote réelle et probabilité. Tap sur une issue active : retrait ; tap sur une autre issue : remplacement du choix du match. Une cote insuffisamment couverte reste désactivée. Autres marchés et conseil dans un volet repliable ; mêmes contrôles métier. Filtres en pilules horizontales.

## BET-359 : bandeau et identité des équipes

Le bandeau mesure désormais 120 px à toutes les largeurs. Les images des équipes mesurent 36 × 36 px en `object-fit: contain`, dans un cercle translucide de 38 px avec contour. Le logo ESPN fourni est prioritaire ; à défaut de source pour un club, son identifiant stable permet d’essayer son blason ESPN. Une erreur conduit aux initiales. Pour les sélections dont ESPN ne fournit qu’un drapeau, celui-ci est utilisé comme secours ; si un blason et un drapeau sont fournis, l’ordre est blason, drapeau, initiales, sans boucle. Aucun blason de fédération n’est inventé lorsque la source ne le propose pas.

Les erreurs sont traitées par écoute d’événement en capture, sans attribut JavaScript inline. Photos et logos conservent `loading="lazy"`. Le catalogue des stades, le dégradé sombre et le WebP d’ambiance de 37 490 octets de BET-358 sont conservés.

Recette : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-team-logos.cjs`, puis `scripts/check-stadium-banner.cjs`. Huit largeurs de 320 à 1440 px en clair/sombre, logo présent, 404, drapeau, initiales, hauteur et dimensions, absence de débordement et erreur de photo. Les images et réponses de données sont simulées ; aucun téléphone physique n’est utilisé.
