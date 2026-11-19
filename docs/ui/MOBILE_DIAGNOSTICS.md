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
