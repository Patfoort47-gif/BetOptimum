# Repères des cotes (BET-140)

L'ancien contour animé dépendait de `has-value` : il était absent lorsqu'aucune cote réelle ne dépassait le seuil de value. Le contour vert visible sur une tuile peut aussi être un simple survol. Le cas Newcastle / Everton de la capture ne suffisait donc pas à conclure à une panne d'animation.

Chaque match ouvert possède désormais un repère de confiance maximale, choisi selon l'ordre de confiance déjà utilisé dans la grille. En cas d'égalité, seul le premier choix de cet ordre est retenu. Le badge « Confiance max. estimée » accompagne le contour animé. Il ne garantit ni résultat ni gain et n'indique pas à lui seul une value positive. Les différents marchés ne sont pas des événements exclusifs ; leurs probabilités ne s'additionnent pas.

Le calcul de value et son seuil restent inchangés : les cotes réelles concernées conservent leur badge de value et un contour fixe. Les estimations, sources, dates, moyennes bookmaker et indications de cache restent visibles. Les matchs fermés n'affichent aucun choix sélectionnable ni contour de recommandation.

Le choix ajouté au ticket garde son fond d'accent, l'état `aria-pressed` et le texte « Choisi » sur ordinateur comme sur mobile. L'animation s'arrête pour ce choix. Avec réduction des mouvements, le repère de confiance devient un contour statique. Un navigateur ne prenant pas en charge le dégradé conserve une bordure fixe.

## Vérifications

`npm test` vérifie les règles métier existantes. Les scripts navigateur ci-dessous utilisent uniquement un serveur local avec des données et un module compte simulés ; ils ne placent aucun pari réel.

```sh
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-market-highlight.cjs
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-match-resources.cjs
NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-performance.cjs
```

Le premier couvre 320/390/430/1280 pixels dans les deux thèmes : cotes réelles avec/sans value, estimation, ancien cache, match fermé, un seul maximum, animation effective, réduction des mouvements, focus, sélection, actualisation, absence de débordement et audit axe. Le deuxième couvre la réorganisation BET-139 ; il est disponible après intégration de ce ticket. Le troisième vérifie la stabilité des cartes et du chargement des fiches.

Validation réalisée dans Chromium. Les appareils Android/iOS physiques et Safari ne sont pas déclarés testés par cette recette.

## Lecture simplifiée (BET-141)

Les cartes présentent d'abord le pronostic, puis deux chiffres séparés : cote et confiance estimée. Les titres sur deux lignes, les chiffres et la zone de repères s'alignent entre les cartes. La confiance maximale est libellée « Confiance max. » ; la mention complète et son caractère estimé restent dans le nom accessible et l'explication. Le calcul de value ne change pas.

La source reste visible (« MOYENNE », « CACHE » ou « ESTIMÉE »). L'ancienneté est raccourcie (« Il y a 7 h », « Offre ancienne · 18 h », « Date inconnue »). « Sources et dates des cotes », juste sous la grille, fournit le nombre de bookmakers, les dates complètes en heure de Paris, l'ancienneté précise et les explications. Son ouverture n'ajoute aucune sélection et reste conservée pendant l'actualisation.

Recette dédiée : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-market-readability.cjs`. Huit combinaisons largeur/thème, comparaison des prix et confiances avec le modèle, dates complètes, ancienneté visible, noms longs, alignement ordinateur, sélection et revalidation, audit axe. Les tests purs de `tests/market-card.test.js` vérifient aussi les dates absentes, les estimations et l'échappement des libellés. Aucun fournisseur supplémentaire n'est contacté.
