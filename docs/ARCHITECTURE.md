# Architecture actuelle

## Sources

| Domaine | Contenu principal |
|---|---|
| `src/core/` | chargement, cache, format français, PWA et composants généraux |
| `src/model/` | Poisson, marchés, cotes, règles de règlement et analyse en worker |
| `src/matches/` | calendrier, direct ESPN, fiches et cartes de match |
| `src/ticket/` | composition, mises, copie, partage et restauration |
| `src/account/` | Auth, inscription, profil, préférences et configuration publique |
| `src/club/` | classements, ligues privées, défi quotidien, progression existante |
| `src/history/` | historique personnel et résultats du modèle |
| `src/avatar/` | configuration et rendu 3D chargé à la demande |
| `src/notifications/` | préférences, planification pure et adaptateurs serveur |
| `src/server/` | ancien aperçu public de coupon, conservé pour compatibilité |

`app.js` orchestre l’état et le rendu HTML. `theme-bootstrap.js` applique la préférence système ou manuelle avant les styles. `notification-sw.js` reste à la racine pour couvrir toute l’application. Les imports historiques publiés restent disponibles via les alias générés ; les sources maintenues ne sont pas dupliquées à la racine.

## Données et exécution

Les workflows produisent le calendrier compact `data/fixtures.json`, les offres détaillées `data/offers/YYYY-MM-DD.json` et le registre durable des résultats. Le site lit ces fichiers ; le calendrier léger utilise Cache API, jamais localStorage. Le pipeline et le navigateur partagent les fonctions pures de src/model/. Les scores et fiches ESPN se rafraîchissent côté navigateur ; les paris certifiés se règlent côté serveur.

Supabase conserve comptes, profils, paris, bankroll et classements avec RLS. Les écritures métier passent par les RPC ; les clés privilégiées restent dans Actions et les fonctions Edge. Les migrations actives sont horodatées et contrôlées par un manifeste d’empreintes. Les anciennes versions manuelles et fonctions retirées restent en archive.

La préparation Pages suit les imports du navigateur, inclut les styles, données, images et dépendances vendor nécessaires, puis génère les alias publics et le manifeste hors ligne. Elle n’inclut ni outils npm ni modules serveur non accessibles depuis le navigateur.

## Guides actifs

- [Installation Supabase](../SUPABASE_SETUP.md)
- [Priorité produit](PRODUCT_FOCUS.md), [apparence et économie retirée](PROFILE_CLEANUP.md)
- [Notifications smartphone](PWA_PUSH.md), [sécurité](SECURITY_LOT15.md)
- [Marchés](MARKETS_SETUP.md), [cotes fournisseur](PROPLINE_SETUP.md)
- [Barème](LEAGUE_SCORING.md), [rang confirmé](RANKING_CONFIRMATION.md)
- [Historique personnel](PERSONAL_DASHBOARD.md), [partage de ticket](TICKET_SHARING.md)

Les audits, procédures supersédées et mesures ponctuelles sont conservés dans docs/archive/. Ils servent de preuves historiques ; les guides actifs et les consignes communes déterminent le comportement actuel.
