# BET-370 · Mesures mobiles

Le paramètre explicite `?diagnostic-mobile` active les marques User Timing `bet-mobile:*` dans la page. Les marques contiennent un libellé fixe et un temps relatif à la navigation. Aucun identifiant, événement métier détaillé, stockage persistant ou envoi réseau n’est ajouté. La page ordinaire ne produit aucune marque. L’outil de recette charge web-vitals localement depuis son propre environnement.

## Lecture des mesures

| Marques | Définition |
| --- | --- |
| `reseau-requete`, `reseau-corps-recu`, `reseau-json-parse` | Début du fetch, corps intégralement lu et décodage JSON terminé. La recette lit le texte puis appelle JSON.parse pour distinguer ces étapes. |
| `reseau-analyse-debut/fin` et `cache-analyse-debut/fin` | Préparation des analyses, avec worker ou repli selon la taille et le navigateur. |
| `cache-lu` | Un calendrier local a été accepté comme candidat avant l’application des données réseau. |
| `calendrier-utilisable` et `calendrier-match`, `calendrier-apercu` ou `calendrier-vide` | Premier calendrier consultable avec la sélection de dates, y compris l’aperçu. Le squelette et l’erreur initiale sont exclus. Émis une seule fois par navigation dans le document. |
| `calendrier-enrichi` | Premier affichage à partir des données complètes. |
| `ouverture-analyse`, `ajout-favori`, `consultation-resultats`, `intention-synchronisation` | Action d’ouverture des stats d’un match, ajout d’une équipe ou compétition, ouverture volontaire de Mes paris ou du bilan, clic du mode invité vers la création d’un compte. |

## Comparer deux versions

Préparer le site avec `node scripts/prepare-pages.mjs`. Servir `_site` avec compression sur le port 4174, par exemple avec `npx --yes serve@14.2.5 --listen tcp://127.0.0.1:4174 _site`. Installer Playwright et web-vitals hors du dépôt de production, puis exécuter `NODE_PATH=/chemin/vers/node_modules node scripts/check-mobile-diagnostics.cjs`. Le script utilise Chromium à 390 × 844 px, 1,6 Mbit/s descendant, 150 ms de latence et CPU ×4. Il produit une navigation à froid et une dans le même contexte à chaud. Répéter au moins trois fois par version et comparer les médianes avec le même calendrier, même profil matériel et mêmes actions. En cas de donnée absente, la noter comme non mesurée. Les Core Web Vitals issus du script sont des observations de laboratoire sur ces interactions.

## Mesures terrain à cadrer avant activation

- Activation mobile : part des premières visites mobiles ouvrant une analyse. Distinguer la lecture effective du clic quand l’ouverture asynchrone échoue.
- Rétention J7 : parmi cette cohorte activée, part qui revient au septième jour civil (Europe/Paris) et ouvre une analyse, un favori ou un résultat. Garder séparés les visiteurs sans possibilité de rapprochement, les données manquantes et les jours sans matchs.
- Segmenter par semaine d’arrivée, invité/compte sous forme de catégorie, cache froid/chaud et calendrier chargé/vide. Publier les volumes avec les taux. Une intention de synchroniser est un clic, distinct d’un compte créé.
- Cibles terrain au p75 : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. Valider avant collecte les règles de consentement, la durée de conservation, les agrégats, et la méthode de calcul des cohortes. Aucun service de télémétrie ni suivi intervisites n’est activé par ce lot.

## Première référence de laboratoire

Le 19 novembre 2026, sur le calendrier du dépôt (135 matchs, journée vide à l’ouverture puis passage aux sept jours), une exécution a donné les valeurs suivantes. Les chiffres constituent un point de comparaison local. L’interaction sur les sept jours fait partie du scénario INP.

| Navigation | Calendrier utilisable | LCP | CLS | INP |
| --- | ---: | ---: | ---: | ---: |
| Froide | 6 853 ms | 1 392 ms | 0,261 | 1 600 ms |
| Chaude | 1 714 ms | 244 ms | 0,261 | 2 008 ms |

## BET-382 · Taille des documents synchronisés

Le 19 novembre 2026, une requête agrégée en lecture seule a mesuré trois
documents de production. Taille JSON minimale 74 494 octets, médiane
81 358 octets, maximale 191 234 octets. Les copies exactes des pronostics de
l’archive publique représentaient 329 684 des 347 086 octets (95 %). Parmi les
1 039 entrées, aucun identifiant n’était absent de l’archive du dépôt. La
comparaison d’égalité porte sur la ligne JSON entière, ce qui protège une
variante même si l’identifiant est également public.

Les statistiques SQL recensent 611 appels d’écriture cumulés, sans rattachement
à une session. Un document avait été mis à jour au cours des dernières 24 h.
Le mode `?diagnostic-mobile` ajoute une marque `bet-mobile:ecriture-compte` par
tentative, avec les octets du document avant transport dans `detail.bytes`.
Pour une session, compter ces marques et relever les tailles. Elles restent en
mémoire, sans identifiant ni envoi.

Le client reconstruit le bilan avec l’archive et garde sa copie locale. Les
documents historiques sont allégés lorsqu’un client mis à jour réconcilie un
document avec l’archive chargée. Si l’archive échoue, les entrées reçues restent
conservées. Il n’y a aucune réécriture en masse du stockage de production. Les
écritures inchangées d’un même navigateur sont évitées et le dernier document en
attente peut être renvoyé depuis le menu Compte. Les écritures concurrentes de
deux appareils suivent toujours l’ordre de réception du serveur.

## BET-416 · Parcours Matchs, Ticket et Mes paris

Le 20 novembre 2026, la recette a comparé les fichiers préparés par
`scripts/prepare-pages.mjs` au commit de l’audit `8b10669`. GitHub Pages
indiquait un déploiement réussi de ce commit. L’accès HTTPS au site public
renvoyait 403 depuis l’environnement de recette.

À 360 × 844, le bas du bouton « Ajouter au ticket » passe de 844 à 698 px.
La navigation commence à 779 px. Le bouton tient également au premier écran
à 320 et 390 px avec le calendrier de la recette. Le contrôle desktop à
1 280 px inclut la suppression de la jauge d’accueil et l’accès au calcul
de l’indice depuis le bilan.

Médianes de trois navigations Chromium à 360 × 844 par condition, sur
un serveur HTTP local avec gzip. Le temps va du début de la navigation
au rendu des cartes avec leur action d’ajout. Le cache chaud réutilise
le même contexte. Le profil limité applique 1,6 Mbit/s en réception,
150 ms de latence et un ralentissement CPU ×4.

| Profil | Cache | Commit de l’audit | Après le lot |
| --- | --- | ---: | ---: |
| Normal | Froid | 931 ms | 642 ms |
| Normal | Chaud | 402 ms | 203 ms |
| Limité | Froid | 5 510 ms | 4 931 ms |
| Limité | Chaud | 1 466 ms | 1 041 ms |

Le calendrier compressé représente 84 283 octets de corps HTTP, soit 84 583
octets transférés avec les en-têtes à froid. L’archive représente 16 321
octets de corps et 16 621 octets transférés à froid. La page Matchs du mode
invité charge le calendrier. L’archive se charge à l’ouverture du bilan ou
du profil. Les offres détaillées restent consultables par match à la demande.
Les analyses des dates secondaires se calculent lors de leur consultation.

La marque `calendrier-premier-ajout` date le rendu de la première action
d’ajout disponible. L’ancienne recette BET-370 mesure le calendrier
consultable, y compris l’aperçu. La comparaison BET-372 doit conserver le
même calendrier et le même profil de réseau. Pour relever poids et temps,
utiliser `scripts/check-mobile-diagnostics.cjs` avec `BET_NETWORK=normal`,
puis avec la limitation par défaut. Le champ `first` contient les ressources
relevées avant les interactions de recette.

Le parcours Chromium a conservé un retour potentiel de 58,63 € et un
bénéfice potentiel de 38,13 € pour une mise de 20,50 € à 2,86, y compris
après rechargement. La recette `scripts/check-mobile-navigation.cjs` couvre
aussi le retrait, le retour du focus après fermeture, la sauvegarde dans
un compte simulé et la confirmation d’un pari par un serveur simulé. Le
contrôle du clavier réduit la hauteur visible à 530 px. Le guide
d’installation s’ouvre depuis le lien de pied de page. La fiche Stats et
le classement proposent de réessayer lorsque les requêtes ESPN échouent.

Dans le bac à sable, `tests/prediction-evaluation.test.js` échoue sur la
lecture du JSON de sortie. Le diagnostic du processus enfant indique
`spawnSync … EPERM` avec une sortie vide. Le test réussit lorsque le
sous-processus Node est autorisé.

La recette sur Safari iPhone et Chrome Android physiques, la synchronisation
avec un compte réel et la réception des alertes restent à valider. Reprendre
les recettes BET-407 et BET-401 sur les appareils concernés et consigner la
version publiée ainsi que les conditions de réseau.
