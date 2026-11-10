# Plan du dépôt

## Développer et publier

- [Architecture et domaines du code](ARCHITECTURE.md)
- [Supabase : CLI et migrations](../SUPABASE_SETUP.md)
- [Recettes UI](ui/TESTING_UI.md), [responsive](RESPONSIVE.md), [accessibilité](ui/ACCESSIBILITY_AUDIT.md)
- [Configuration des notifications](operations/NOTIFICATIONS_SETUP.md), [PWA et consentements](PWA_PUSH.md), [newsletter](operations/NEWSLETTER_SETUP.md)

`src/` regroupe les sources par domaine. `scripts/` contient la collecte, la synchronisation et les recettes ; `tests/` les tests Node ; `supabase/` le SQL et les fonctions Edge. `vendor/` conserve les dépendances du navigateur, leurs licences et leurs empreintes. Les outils npm restent réservés au développement.

`app.js`, `theme-bootstrap.js` et `notification-sw.js` restent à la racine pour leurs URL et leur portée. Les autres anciennes URL de modules sont conservées par des alias générés lors de `prepare-pages.mjs`, sans dupliquer les sources maintenues.

## Règles et domaines

- [Priorité produit](PRODUCT_FOCUS.md), [apparence et économie retirée](PROFILE_CLEANUP.md), [cadre juridique](../VALIDATION_JURIDIQUE.md)
- [Données et fraîcheur](data/DATA_FRESHNESS.md), [cotes PropLine](PROPLINE_SETUP.md), [marchés actifs](MARKETS_SETUP.md)
- [Méthodes du modèle](PREDICTION_METHODS.md), [évaluation xG](research/XG_EVALUATION.md)
- [Barème des ligues](LEAGUE_SCORING.md), [classement confirmé](RANKING_CONFIRMATION.md), [défi du jour](DAILY_CHALLENGE_VALIDATION.md)
- [Historique personnel](PERSONAL_DASHBOARD.md), [partage des tickets](TICKET_SHARING.md), [connexion Google](GOOGLE_SIGN_IN.md)
- [Sécurité](SECURITY_LOT15.md), [états d’erreur](ui/ERROR_STATES.md)

Les [archives](archive/README.md) conservent les audits, mesures et procédures remplacées. Les données générées de `data/` et les preuves de `docs/evidence/` ne sont pas nettoyées à la main.

[Aperçus factuels des matchs](MATCH_PREVIEWS.md).

## Lot 18

- [Recherche de force des équipes](TEAM_STRENGTH.md), [dernières cotes observées](CLOSING_ODDS.md)
- [Partage du défi](DAILY_SHARING.md), [comparatif joueur/modèle](MODEL_COMPARISON.md)
- [Invitations privées et lien email](PRIVATE_INVITATIONS.md)
