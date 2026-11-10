# Sécurité du navigateur et du Club · lot 15

## Clients locaux · BET-302

Supabase JS 2.81.1 et Three.js 0.170.0 sont figés dans `vendor/`. Voir `vendor/README.md` pour les licences, empreintes et reconstruction. Aucun JavaScript jsDelivr requis. Les tests du vrai SDK utilisent un transport simulé : aucun compte créé ni email envoyé en production, aucune connexion à une identité Google personnelle.

## Politique de contenu · BET-303

La balise CSP précède tous les chargements dans `index.html`. Scripts et workers uniquement sur l’origine du site, aucun script inline ni eval. Le thème est un module externe précoce ; les replis des logos utilisent une écoute d’événement, sans attribut onerror. Les styles inline restent autorisés pour les styles dynamiques existants (barres, graphiques, couleurs d’avatar). Objets, cadres et base URL sont interdits. Connexions limitées à l’origine, ESPN et au seul projet Supabase configuré ; images limitées au site, ESPN, Storage du projet et données locales. Polices locales. Google OAuth utilise une navigation de premier niveau, pas une iframe.

GitHub Pages ne fournit pas d’en-têtes personnalisés : la CSP meta ne protège pas l’encadrement du site par un tiers (`frame-ancestors` exige un en-tête). Aucun report-uri meta ni promesse de protection du serveur. Tout changement de projet Supabase ou de service doit adapter explicitement la CSP.

Recette : `NODE_PATH=/chemin/vers/node_modules node scripts/check-security-ui.cjs`, serveur local sur 4173 et Playwright/Chromium disponibles. Navigation des onglets et ancienne route boutique (redirigée vers le profil, boutique retirée), studio Three local réellement rendu, aucune violation CSP pendant les parcours normaux. Vérification distincte du blocage d’un script et d’un gestionnaire inline injectés. Recette à 390 et 1440 px, données et compte simulés, sans accès aux comptes de production.

## Invitations privées · BET-304

V62 remplace la génération des nouveaux codes par huit octets `pgcrypto.gen_random_bytes` (40 bits utiles pour huit caractères d’un alphabet de 32 signes, sans biais modulo). Les anciens codes de quatre caractères restent valides et ne sont pas divulgués ni régénérés. Les propriétaires peuvent utiliser l’action de régénération existante pour obtenir un nouveau code long.

Dix échecs de recherche par compte sur une heure glissante bloquent toute nouvelle adhésion jusqu’à expiration des échecs. Les réussites ne réinitialisent pas les échecs. Compteur privé sous RLS et verrou par joueur, adhésion sous verrou de ligue pour préserver la limite de 50 membres. Le refus attendu est un résultat JSON (`CODE_INVALIDE`, `TROP_ESSAIS_LIGUE`, `LIGUE_PLEINE`) interprété par l’interface : lever une exception SQL annulerait le compteur et rendrait la limite inefficace. Les erreurs d’authentification restent des exceptions.

Déployer d’abord l’interface compatible avec anciens et nouveaux formats et ces refus JSON, puis appliquer `supabase/migrations/supabase-v62-schema.sql` via Management API. Vérifier les définitions en production avant remplacement pour ne pas écraser un changement concurrent. Migration transactionnelle et réexécutable ; aucune suppression de ligue ou d’adhésion. Les onglets ouverts avant publication doivent être rechargés pour afficher les nouveaux messages.

Recette SQL isolée avec le vrai pgcrypto : `PGLITE_MODULE=/chemin/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-private-security-sql.mjs`. Deux applications de V62, 1 000 codes distincts et valides, ancien/nouveau code, adhésion idempotente, dix échecs persistants entre appels, blocage même sur un code valide, expiration et isolation de deux utilisateurs, accès anonyme/table du compteur interdits. Intégrée à la CI.

## Interpolations HTML · BET-305

Les données de compétition, équipes, identifiants, libellés archivés et heures sont échappées dans les filtres, favoris, attributs des fiches, cartes, rail et ticket. Textes et attributs HTML entre guillemets utilisent `html.js`. Les fragments HTML construits par les composants et les valeurs numériques calculées restent du HTML ou des nombres, pas des textes doublement échappés. Le titre de composition probable dans `details.js` était déjà échappé au dernier rendu ; ce chemin est isolé et testé pour éviter un double échappement. L’échappement ne remplace pas la validation des URL et des styles.

Recette : `NODE_PATH=/chemin/node_modules node scripts/check-html-security.cjs`. Une compétition et deux équipes contenant une balise et des guillemets restent du texte ; les attributs conservent la valeur d’origine, le filtre reste utilisable et aucun élément injecté n’est créé. Tests Node du titre de compo et des caractères spéciaux. Un hash de lien privé mal encodé est aussi ignoré sans arrêter le site.
