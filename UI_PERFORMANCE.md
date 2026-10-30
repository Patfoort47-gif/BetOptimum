# BET-110 · Accès aux actions et aux matchs

Mesure locale du 30 octobre 2026 : Chromium, écran 360 × 900, CPU ralenti ×4 avant navigation, latence 50 ms, débit descendant 2 Mbit/s et montant 1 Mbit/s. Trois contextes neufs par version, puis une seconde visite dans chaque contexte. Aucune interception Playwright : cache HTTP activé et confirmé par les événements CDP (22 ressources servies du cache avant, 17 après, lors des secondes visites).

Deux instantanés statiques sont servis : version originale `e608e4c` et candidate `3c77ead`. Le même calendrier synthétique à un match à venir et les mêmes données d’historique vides sont placés dans les copies de recherche, jamais dans le dépôt. La configuration publique locale du Club est vide ; ces mesures n’exécutent pas de connexion ou de pari.

L’action est considérée disponible après l’arrivée des cartes, lorsque le bouton est visible et l’éventuel écran d’introduction disparu. La carte est ensuite amenée à l’écran, et son opacité ainsi que celle de tous ses ancêtres sont vérifiées. Les mesures comprennent chargement, parsing et script ; ce ne sont pas des scores Core Web Vitals ni des mesures sur de vrais téléphones.

| Médiane de trois essais | Avant | Après |
| --- | ---: | ---: |
| Action d’accueil, cache froid | 3 232 ms | 2 410 ms |
| Première carte lisible après défilement, cache froid | 3 882 ms | 2 484 ms |
| Action d’accueil, cache chaud | 379 ms | 370 ms |
| Première carte lisible après défilement, cache chaud | 507 ms | 396 ms |

Le gain à froid est net sur cet échantillon ; la différence de 9 ms sur l’action à chaud ne permet pas de conclure à une amélioration sensible. Les premières mesures avec interception des requêtes ont été écartées pour la comparaison cache froid/chaud, car l’interception désactive le cache HTTP.

Changements : suppression du splash et de son délai de deux secondes, apparition immédiate du texte et des conteneurs interactifs, cartes sans délai de révélation, respect de prefers-reduced-motion pour les animations CSS, compteurs et défilements JavaScript. Les retours de sélection restent présents. Il s’agit d’une comparaison de l’ensemble des améliorations ; elle n’isole pas statistiquement l’effet d’une seule animation.

Reproduction : extraire les deux révisions dans des dossiers temporaires avec `git archive`, y placer le même calendrier de recette, les servir avec `python3 -m http.server` sur les ports 4174 et 4175, puis exécuter `node scripts/measure-ui.cjs`. Playwright est un outil de recette externe au dépôt, voir TESTING_UI.md. Les variables BET_BENCH_BEFORE_URL, BET_BENCH_AFTER_URL et BET_BENCH_REPORT permettent d’adapter les deux adresses locales et le rapport. Le script refuse des sites distants.
