# Repères du dépôt

## Application

- `index.html`, `styles.css`, `app.js` à la racine : structure, présentation et interface.
- `model.js` et modules de règles : calculs partagés avec le pipeline.
- `details.js`, `account.js`, `join.js`, `profile.js`, `shop-page.js` : fiches et espaces du Club.
- `avatar*.js` : configuration, affichage et studio 3D.
- `data/` : calendrier généré et registre durable des pronostics. Ne pas nettoyer ces fichiers à la main.

## Exploitation

- [Installation Supabase](../SUPABASE_SETUP.md) : ordre des migrations SQL, regroupées dans `supabase/migrations/`, sans modification de leur SQL.
- [Notifications](../NOTIFICATIONS_SETUP.md) et [newsletter](../NEWSLETTER_SETUP.md).
- `scripts/` : mises à jour, synchronisation, moteurs serveur et outils de recette.
- `.github/workflows/` : automatisation et déploiement GitHub Pages.
- `supabase/functions/` : fonctions Edge.

## Qualité et recherche

- [Recette UI](../TESTING_UI.md), [responsive](RESPONSIVE.md), [accessibilité](../ACCESSIBILITY_AUDIT.md), [mesures UI existantes](../UI_PERFORMANCE.md).
- [Méthodes de pronostic](PREDICTION_METHODS.md) et [évaluation xG](../XG_EVALUATION.md).
- [Cadre juridique](../VALIDATION_JURIDIQUE.md).
- `tests/*.test.js` : tests Node, lancés par `npm test`.
- `examples/notification-emails/` : aperçus reproductibles, utiles pour la revue des emails.

Les modules du navigateur restent à la racine ; les styles sont répartis entre `styles.css` et `styles/`. Tests et migrations ont des dossiers dédiés, avec chemins mis à jour. Les fichiers locaux de recette et les dépendances externes sont exclus par `.gitignore`.

[Audit du dépôt et recommandations du 31 octobre 2026](REPOSITORY_AUDIT.md).

[Mesures et validation de BET-126](PERFORMANCE_BET126.md).
