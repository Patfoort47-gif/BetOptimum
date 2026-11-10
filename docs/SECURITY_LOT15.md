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

Déployer d’abord l’interface compatible avec anciens et nouveaux formats et ces refus JSON, puis appliquer `supabase/migrations/20261110000102_legacy_v62.sql` via Management API. Vérifier les définitions en production avant remplacement pour ne pas écraser un changement concurrent. Migration transactionnelle et réexécutable ; aucune suppression de ligue ou d’adhésion. Les onglets ouverts avant publication doivent être rechargés pour afficher les nouveaux messages.

Recette SQL isolée avec le vrai pgcrypto : `PGLITE_MODULE=/chemin/node_modules/@electric-sql/pglite/dist/index.js node scripts/check-private-security-sql.mjs`. Deux applications de V62, 1 000 codes distincts et valides, ancien/nouveau code, adhésion idempotente, dix échecs persistants entre appels, blocage même sur un code valide, expiration et isolation de deux utilisateurs, accès anonyme/table du compteur interdits. Intégrée à la CI.

## Interpolations HTML · BET-305

Les données de compétition, équipes, identifiants, libellés archivés et heures sont échappées dans les filtres, favoris, attributs des fiches, cartes, rail et ticket. Textes et attributs HTML entre guillemets utilisent `html.js`. Les fragments HTML construits par les composants et les valeurs numériques calculées restent du HTML ou des nombres, pas des textes doublement échappés. Le titre de composition probable dans `details.js` était déjà échappé au dernier rendu ; ce chemin est isolé et testé pour éviter un double échappement. L’échappement ne remplace pas la validation des URL et des styles.

Recette : `NODE_PATH=/chemin/node_modules node scripts/check-html-security.cjs`. Une compétition et deux équipes contenant une balise et des guillemets restent du texte ; les attributs conservent la valeur d’origine, le filtre reste utilisable et aucun élément injecté n’est créé. Tests Node du titre de compo et des caractères spéciaux. Un hash de lien privé mal encodé est aussi ignoré sans arrêter le site.

## Recherche de pseudos · BET-306

Arbitrage : aucune requête anonyme de disponibilité pendant la saisie ou avant l’inscription. Le formulaire valide le format localement, puis utilise l’inscription Auth habituelle. Le serveur conserve le souhait s’il est libre, sinon attribue un pseudo disponible, comme le faisait déjà le déclencheur d’inscription. Le formulaire l’annonce ; le profil charge ensuite le pseudo réellement attribué, modifiable selon la règle existante. Aucun nouveau compte intermédiaire ni CAPTCHA tiers ajouté.

V63 retire l’exécution anonyme de `pseudo_disponible` et limite les appels authentifiés à 20 par minute glissante, avec compteur privé et verrou par compte. Le générateur interne `pseudo_libre` était aussi exécutable par anon et authenticated via les privilèges effectifs de production : ces deux accès sont retirés pour ne pas laisser de contournement. Les déclencheurs d’inscription security definer conservent l’accès interne. L’annuaire public reste public : ce changement ferme les RPC de vérification, il ne rend pas secrets les pseudos déjà publiés.

Déployer le nouveau formulaire et les modules versionnés avant V63 ; recharger les onglets d’inscription ouverts avec l’ancienne version. Appliquer ensuite `supabase/migrations/20261110000103_legacy_v63.sql`, transactionnelle et réexécutable. Aucun profil ni pseudo existant modifié. Les compteurs ne stockent ni pseudos recherchés ni codes essayés ; la confidentialité décrit leurs horodatages et leur suppression avec le compte.

Recettes : `scripts/check-nickname-security-sql.mjs` avec PGlite (double application, accès anon et helper interne refusés, quota persistant, expiration, isolation, attribution d’un pseudo en déclencheur security definer malgré les retraits de droits) ; `scripts/check-signup-security.cjs` avec Chromium à 390 et 1440 px (identité, préférences, confirmation sans appel de recherche de pseudo ; connexion, récupération et Google simulés sans envoi). Les tests du vrai SDK local restent dans `tests/vendor.test.js`. Une connexion à une identité personnelle et la réception d’un email réel ne sont pas simulées par ces recettes.
