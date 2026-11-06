# Parcours mobile BET-225 à BET-235

Les onze tickets sont livrés séparément. BET-229 vérifie le mécanisme de thème système déjà présent : aucune seconde implémentation n’est nécessaire. La barre inférieure conserve les quatre espaces du produit, avec un seul espace affiché à la fois et un retour en haut à chaque changement. Le compte reste accessible dans l’en-tête.

La sparkline mobile de BET-228 représente le résultat net réglé des tickets filtrés, à côté du KPI Bénéfice net. Les données existantes du serveur sont une série de résultats nets, pas un historique complet du capital disponible : le libellé ne doit pas confondre les deux. Les graphiques détaillés restent disponibles sur ordinateur ; les montants de synthèse restent visibles sur mobile.

Le partage génère un PNG local carré ou vertical avec le blason BetOptimum, les choix, les cotes, la mise et le retour potentiel virtuels. L’aperçu précise la présence de la mise. Le partage de fichiers natif n’est proposé que s’il est supporté ; le téléchargement PNG reste possible. Aucun service tiers de génération, aucune publication automatique. Les systèmes indiquent les cotes par sous-pari plutôt qu’une cote cumulée fictive.

Les pastilles distinguent les nouveaux règlements et les trophées/résultats hebdomadaires réellement reçus du serveur. La première lecture initialise les éléments connus sans signaler tout l’historique. L’état est séparé par compte et conservé localement, puis effacé à la visite de l’espace concerné. Aucun pari ni montant n’est enregistré dans cet état.

## Recette locale

Lancer le serveur sur 4173 puis, avec Playwright accessible dans NODE_PATH :

```sh
node scripts/check-mobile-navigation.cjs
node scripts/check-mobile-ux.cjs
node scripts/check-mobile-ux-state.cjs
```

Les recettes interceptent les services externes : aucun vrai pari, aucun envoi et aucune modification de données serveur. Elles couvrent les petits écrans et le bureau, les mises en pourcentage, les fermetures du tiroir, le partage en image, la confirmation serveur, les onglets, les puces, les états vides, les pastilles et la sparkline. `npm test` couvre les calculs et les modèles purs ; `node scripts/prepare-pages.mjs` vérifie l’inclusion des nouveaux modules.
