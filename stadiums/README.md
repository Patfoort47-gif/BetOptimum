# Photos des cartes de match (BET-162)

Le catalogue généré `stadium-catalog.js` associe chaque photographie locale à un `venue.id` ESPN vérifié. Aucun rapprochement par nom, logo ou chaîne approximative n’est utilisé. Les quatre associations historiques par `homeId` restent uniquement compatibles avec les anciens calendriers dépourvus de lieu.

Le pipeline complète `neutralSite` et `venue.id` depuis le résumé ESPN de chaque rencontre, après vérification de l’identifiant du match et des deux équipes. Un terrain neutre peut ainsi afficher la photo de son lieu réel. Un lieu explicite inconnu du catalogue utilise l’illustration d’ambiance avec son nom et la mention « photo à venir » : le stade habituel n’est jamais substitué à un stade temporaire. En l’absence de lieu dans un ancien calendrier, la photo est identifiée comme celle du stade habituel et ne constitue pas une confirmation du lieu de la rencontre.

Chaque entrée doit donner le nom, l’identifiant ESPN du stade lorsqu’il a été vérifié, le fichier WebP local, l’auteur, la page source, la licence et son URL. Le nom du stade ouvre la page source et son libellé accessible porte les crédits, sans ajouter de message dans la carte. Une image dont les droits ou l’association ne sont pas vérifiés ne doit pas être ajoutée. Les adaptations sous CC BY-SA gardent la licence d’origine.

Les fichiers sont redimensionnés à 960 pixels de large au maximum et encodés en WebP (moins de 100 Ko chacun). Le navigateur les recadre avec `object-fit: cover`, les décode de manière asynchrone et les charge en différé. Aucun hébergeur tiers n’est contacté pour les photos lors de la consultation. Un bandeau dédié laisse la photo visible dans les deux thèmes. En cas d’échec, l’illustration locale reste affichée.

La publication doit inclure le dossier `stadiums/` et les crédits. Vérifier les cartes à 320/390/768/1440 px, dans les deux thèmes, ainsi que le terrain neutre, le stade inconnu, le stade temporaire, la réponse 404, les favoris, les sélections, les matchs terminés/annulés/en direct et le chargement hors écran.

## Catalogue publié le 3 novembre 2026

Le catalogue contient 182 photographies de stades et couvre 196 des 211 rencontres du calendrier au moment de la publication. Les 15 lieux restants utilisent l’illustration d’ambiance locale. Le contrôle de couverture est relancé après chaque collecte du calendrier.

`sources.json` conserve les pages sources, auteurs, licences, métadonnées Wikimedia et références ESPN vérifiées. Chaque fichier WebP est une adaptation redimensionnée de la photo indiquée, sous sa licence libre d’origine. Les crédits et liens de licence figurent aussi dans le catalogue et sur chaque carte. Les photos ne sont pas couvertes par une éventuelle licence du code.

## Extension internationale du 17 novembre 2026 (BET-324)

Ajout de 20 photographies locales pour les lieux des matchs internationaux du calendrier, dont le Stade Atlantique (France), le stade Roi Baudouin (Belgique), le stade olympique de Berlin (Allemagne), Ullevaal (Norvège), Friends Arena (Suède) et la National Arena de Bucarest (Roumanie). Chaque association a été revérifiée dans le résumé ESPN avec l’identifiant de la rencontre et ses deux équipes. Les pages Wikimedia, auteurs et licences libres sont conservés dans `sources.json`.

Les nouvelles images sont recadrées à 960 × 540 pixels et pèsent chacune moins de 100 Ko. Le catalogue atteint 202 photos. Sur le calendrier contrôlé pour ce ticket, la couverture passe de 72 à 92 matchs sur 191 ; 20 rencontres internationales supplémentaires disposent donc de la photo de leur lieu réel. Cette mesure dépend du calendrier collecté, et ne garantit pas une couverture complète des rencontres à venir. Relancer `node scripts/check-stadium-coverage.mjs --report` après chaque collecte pour repérer les lieux encore absents.

## Couverture des championnats et sélections (BET-325)

Le périmètre de `coverage-targets.json` est vérifié auprès d’ESPN le 17 novembre 2026 : les 96 clubs de Ligue 1, Premier League, Liga, Serie A et Bundesliga, ainsi que les 18 clubs de Ligue 2. Les lieux des deux derniers matchs à domicile de chaque club ont été contrôlés dans les résumés ESPN avec les deux équipes. Tous ces clubs disposent d’une photo locale pour les lieux répertoriés, y compris Bernabéu, Mendizorrotza et Bonal, ajoutés dans ce lot.

L’inventaire couvre aussi les enceintes utilisées à domicile par 19 sélections : Argentine, Belgique, Brésil, Croatie, Danemark, Angleterre, France, Allemagne, Italie, Japon, Mexique, Maroc, Pays-Bas, Portugal, Sénégal, Espagne, Suisse, États-Unis et Uruguay. Une sélection peut utiliser plusieurs stades. Les domiciles organisés à l’étranger et les terrains d’entraînement sont exclus de ce périmètre national ; ils ne donnent jamais lieu à une substitution par un stade national dans les cartes. Chaque carte conserve le lieu réel vérifié de la rencontre.

Commandes de contrôle :

- `node scripts/check-stadium-targets.mjs --clubs-only --require-photos` vérifie tous les clubs du périmètre. Ce contrôle est également exécuté par la CI pour éviter une régression du catalogue.
- `node scripts/check-stadium-targets.mjs` détaille aussi la couverture des sélections et les photos encore manquantes.
- `node scripts/check-stadium-coverage.mjs --report` contrôle le calendrier courant.

Cet inventaire est une photographie de la saison vérifiée, pas une garantie pour les changements de stade, les terrains temporaires ou les équipes promues des prochaines saisons. Pour l’actualiser, vérifier les effectifs des championnats et les résumés ESPN, puis actualiser les lieux et leurs références dans `coverage-targets.json`. Ajouter les images et crédits vérifiés dans `sources.json`, compiler avec `node scripts/build-stadium-catalog.mjs`, puis appliquer Prettier au catalogue généré.

Les huit rencontres du 17 novembre disposent toutes d’une photo. Les terrains de La Florida (Portugalete) et Santa Ana (Utebo) restent en attente : les résultats examinés ne montrent pas de photographie libre vérifiée de ces enceintes. Une photo d’un parc, d’une église ou d’un autre stade n’est pas utilisée à leur place.

Pour le stade Abdoulaye-Wade (Sénégal), aucune photo libre de la bonne enceinte n’a été trouvée parmi les sources examinées. Il reste explicitement présent dans l’inventaire et signalé par le contrôle des sélections. La Dakar Arena, salle de basket de Diamniadio, n’est pas utilisée comme remplacement.

Ce lot ajoute 43 photographies et porte le catalogue à 245 stades. Les 114 clubs vérifiés des six championnats sont couverts. Les lieux répertoriés sont entièrement illustrés pour 18 des 19 sélections ; seul Abdoulaye-Wade reste sans photo. Sur le calendrier contrôlé, la couverture passe de 92 à 104 matchs sur 191, dont 8 sur 8 le 17 novembre.
