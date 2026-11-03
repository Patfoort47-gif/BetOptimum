# Photos des cartes de match (BET-162)

Le catalogue généré `stadium-catalog.js` associe chaque photographie locale à un `venue.id` ESPN vérifié. Aucun rapprochement par nom, logo ou chaîne approximative n’est utilisé. Les quatre associations historiques par `homeId` restent uniquement compatibles avec les anciens calendriers dépourvus de lieu.

Le pipeline complète `neutralSite` et `venue.id` depuis le résumé ESPN de chaque rencontre, après vérification de l’identifiant du match et des deux équipes. Un terrain neutre peut ainsi afficher la photo de son lieu réel. Un lieu explicite inconnu du catalogue utilise l’illustration d’ambiance avec son nom et la mention « photo à venir » : le stade habituel n’est jamais substitué à un stade temporaire. En l’absence de lieu dans un ancien calendrier, la photo est identifiée comme celle du stade habituel et ne constitue pas une confirmation du lieu de la rencontre.

Chaque entrée doit donner le nom, l’identifiant ESPN du stade lorsqu’il a été vérifié, le fichier WebP local, l’auteur, la page source, la licence et son URL. Le nom du stade ouvre la page source et son libellé accessible porte les crédits, sans ajouter de message dans la carte. Une image dont les droits ou l’association ne sont pas vérifiés ne doit pas être ajoutée. Les adaptations sous CC BY-SA gardent la licence d’origine.

Les fichiers sont redimensionnés à 960 pixels de large au maximum et encodés en WebP (moins de 100 Ko chacun). Le navigateur les recadre avec `object-fit: cover`, les décode de manière asynchrone et les charge en différé. Aucun hébergeur tiers n’est contacté pour les photos lors de la consultation. Un bandeau dédié laisse la photo visible dans les deux thèmes. En cas d’échec, l’illustration locale reste affichée.

La publication doit inclure le dossier `stadiums/` et les crédits. Vérifier les cartes à 320/390/768/1440 px, dans les deux thèmes, ainsi que le terrain neutre, le stade inconnu, le stade temporaire, la réponse 404, les favoris, les sélections, les matchs terminés/annulés/en direct et le chargement hors écran.

## Catalogue publié le 3 novembre 2026

Le catalogue contient 182 photographies de stades et couvre 196 des 211 rencontres du calendrier au moment de la publication. Les 15 lieux restants utilisent l’illustration d’ambiance locale. Le contrôle de couverture est relancé après chaque collecte du calendrier.

`sources.json` conserve les pages sources, auteurs, licences, métadonnées Wikimedia et références ESPN vérifiées. Chaque fichier WebP est une adaptation redimensionnée de la photo indiquée, sous sa licence libre d’origine. Les crédits et liens de licence figurent aussi dans le catalogue et sur chaque carte. Les photos ne sont pas couvertes par une éventuelle licence du code.
