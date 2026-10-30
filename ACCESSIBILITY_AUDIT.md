# BET-108 · Audit des parcours principaux

Audit Chromium du 30 octobre 2026, avec axe-core 4.14.0, clavier et arbre d’accessibilité. Résultats reproductibles par `scripts/check-public-ui.cjs`, instructions dans TESTING_UI.md.

## Périmètre et résultats

- Accueil et matchs : 320, 360 et 1280 px, thèmes clair/sombre, réduction des animations. Aucun débordement horizontal sur les profils testés ; 320 px couvre la redistribution d’un écran 1280 px à 400 %.
- Bilan, connexion et boutique : 360 px, thèmes clair/sombre. Formulaire de connexion contrôlé avec un serveur simulé ; aucune donnée de compte réelle.
- Douze combinaisons automatisées : zéro écart axe détecté sur les règles WCAG 2 A/AA, 2.1 AA et 2.2 AA exécutées. Cela ne constitue pas une certification de conformité de l’ensemble du produit.
- Clavier : ouverture/fermeture d’aide et de fiche, retour au déclencheur, favoris, focus préservé après sélection, onglets fléchés, boucle Tab/Shift+Tab et isolation du fond pour la connexion.
- Lecteurs d’écran : noms, rôles, sélection, libellés de formulaires et contenu de la connexion examinés dans l’arbre d’accessibilité Chromium. La navigation vocale réelle avec NVDA/VoiceOver n’est pas exécutée dans cet environnement.

## Écarts constatés et correction

| Priorité | Écart et reproduction | Correction / nouvelle vérification |
| --- | --- | --- |
| Haute | Ouvrir un dialogue statique sans nom accessible | aria-labelledby sur les dialogues ; titres de fiche présents dès l’ouverture |
| Haute | Ouvrir la connexion puis naviguer dans le fond au clavier | Fond inert, boucle du focus, fermeture Échap et restauration |
| Haute | Favoris intégrés à un bouton équipe, sans accès clavier autonome | Boutons séparés, nom explicite, aria-pressed et maintien du focus |
| Moyenne | Favoris : contraste observé de 4,22:1 en clair et 4,26:1 en sombre | Couleurs de thème adaptées ; aucune alerte après correction |
| Moyenne | Textes de navigation et indice trop transparents pendant l’entrée animée | Suppression des animations d’entrée concernées et opacité du texte à 1 |
| Moyenne | Mot de passe nommé avec le texte du bouton Afficher | Label autonome associé au champ ; onglets avec tabulation mobile |
| Moyenne | Classement des équipes sur quatre lignes à 360 px | Libellé visible Équipes, nom accessible complet conservé, zones tactiles agrandies |

## Limites et suites de recette

L’audit porte sur les parcours cités, pas sur chaque onglet du produit. Les écritures serveur, les règles RLS, les achats et le rendu WebGL n’ont pas été validés par ces tests d’interface. Une passe humaine NVDA/VoiceOver et un contrôle sur des appareils physiques restent recommandés avant une déclaration globale d’accessibilité. Les résultats automatisés sont des preuves limitées aux règles et états exécutés ; aucune conformité globale n’est annoncée.
