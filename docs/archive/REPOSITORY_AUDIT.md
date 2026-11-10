# État des lieux et intervention du 31 octobre 2026

Audit initial de la révision 6768596 : 164 fichiers suivis, dont 122 à la racine, 30 fichiers de tests et 28 scripts SQL. Dépôt initialement propre. Application statique HTML/CSS et JavaScript sans framework ni build, sur GitHub Pages. GitHub Actions alimente les JSON et Supabase ; les RPC et RLS gèrent les comptes et paris. ESPN fournit aussi les fiches et le direct. Three.js reste réservé aux avatars.

## Intervention BET-126

- Suppression des restes du splash désactivé et ajout de .gitignore.
- Tests regroupés dans tests/, SQL dans supabase/migrations/, styles dans styles.css et styles/. Chemins des imports, guides et scripts adaptés. Les 28 fichiers SQL restent strictement identiques. Modules navigateur gardés à la racine pour conserver les URL et liens existants.
- Mise à jour des seules sections utiles : les onglets cachés évitent leurs rendus les plus coûteux. Le ticket ne redessine plus les cartes. La liste réutilise les cartes inchangées et conserve les détails ouverts.
- Revalidation HTTP des JSON avec URL stables, requêtes simultanées mutualisées et erreurs réessayables. Le calendrier ne dépend plus du chargement de l’archive ; l’archive reste chargée après le calendrier pour alimenter l’indice d’accueil et le bilan. Pas de rendu complet si le calendrier est identique. Rafraîchissement périodique suspendu lorsque la page est cachée.
- Fiches importées à leur première ouverture, y compris via lien direct ou Classements. Le module comptes reste initialisé au démarrage pour restaurer les sessions et traiter les retours de connexion.
- Publication depuis _site/ : seuls les modules navigateur accessibles, styles et données sont copiés. Tests, SQL, guides et traitements serveur sont exclus. Les trois workflows Pages partagent une stratégie de concurrence.

Aucune donnée sportive ou règle de pari modifiée ; aucune migration appliquée à une base. Aucun changement de framework. Les historiques, recettes et recherches sont conservés.

## Vigilance sur les données

Le calendrier audité est généré le 31 octobre à 19 h 27, heure de Paris ; oddsRefreshedAt indique le 22 octobre à 10 h 57 et huit entrées figurent dans failures. Il faut vérifier les quotas, le fournisseur et les logs Actions. L’optimisation du front conserve les dates réelles et ne prétend pas rafraîchir les cotes fournisseur.

## Validation

Tests Node, recette publique Chromium avec Axe, recette responsive et tests spécifiques de stabilité des cartes. L’échec du test d’évaluation observé pendant l’audit venait des restrictions de sous-processus de l’environnement : il passe avec l’exécution autorisée et n’a pas nécessité de changer le modèle. Les résultats et limites des mesures locales sont dans PERFORMANCE_BET126.md.

Les améliorations suivantes, à évaluer selon les mesures en production : résumé de calendrier séparant les offres détaillées, cache des calculs par match, découpage plus fin des espaces Club. Elles ne sont pas nécessaires au rangement actuel.

Validation finale : 229 tests Node réussis, recette publique réussie avec zéro violation Axe détectée, 34 configurations responsive validées, recette de stabilité réussie à 360 et 1280 px. La racine contient désormais 66 fichiers suivis, contre 122 initialement. Aucun déploiement effectué pendant l’intervention.
