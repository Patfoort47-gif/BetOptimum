# Sécurité du navigateur et du Club · lot 15

## Clients locaux · BET-302

Supabase JS 2.81.1 et Three.js 0.170.0 sont figés dans `vendor/`. Voir `vendor/README.md` pour les licences, empreintes et reconstruction. Aucun JavaScript jsDelivr requis. Les tests du vrai SDK utilisent un transport simulé : aucun compte créé ni email envoyé en production, aucune connexion à une identité Google personnelle.

## Politique de contenu · BET-303

La balise CSP précède tous les chargements dans `index.html`. Scripts et workers uniquement sur l’origine du site, aucun script inline ni eval. Le thème est un module externe précoce ; les replis des logos utilisent une écoute d’événement, sans attribut onerror. Les styles inline restent autorisés pour les styles dynamiques existants (barres, graphiques, couleurs d’avatar). Objets, cadres et base URL sont interdits. Connexions limitées à l’origine, ESPN et au seul projet Supabase configuré ; images limitées au site, ESPN, Storage du projet et données locales. Polices locales. Google OAuth utilise une navigation de premier niveau, pas une iframe.

GitHub Pages ne fournit pas d’en-têtes personnalisés : la CSP meta ne protège pas l’encadrement du site par un tiers (`frame-ancestors` exige un en-tête). Aucun report-uri meta ni promesse de protection du serveur. Tout changement de projet Supabase ou de service doit adapter explicitement la CSP.

Recette : `NODE_PATH=/chemin/vers/node_modules node scripts/check-security-ui.cjs`, serveur local sur 4173 et Playwright/Chromium disponibles. Navigation des onglets et ancienne route boutique (redirigée vers le profil, boutique retirée), studio Three local réellement rendu, aucune violation CSP pendant les parcours normaux. Vérification distincte du blocage d’un script et d’un gestionnaire inline injectés. Recette à 390 et 1440 px, données et compte simulés, sans accès aux comptes de production.
