# BET-192 · Détails secondaires par match

Inventaire replié : forme et statistiques synthétiques, comparaison des bookmakers et accès à la fiche complète. Équipes, horaire/statut, sélection, cote, EV numérique, action et réserves essentielles restent visibles. Le bouton Voir les détails (44 px minimum) contrôle un panneau identifié par le match ; aria-controls, aria-expanded et région nommée sont cohérents.

Le contenu de ce panneau provient du calendrier déjà chargé : aucune récupération réseau supplémentaire, donc aucun état artificiel de chargement ou Réessayer n’est ajouté. Les données de forme absentes gardent leur explication. La comparaison conserve son chargement DOM à la demande ; la fiche complète conserve son propre mécanisme de récupération et ses états d’erreur. L’état ouvert est indépendant par match, conservé après sélection, favori, filtrage ou nouveau rendu. Le cache de rendu ignore uniquement les attributs d’ouverture pour préserver les nœuds et le focus. Apparition 120 ms, désactivée avec réduire les animations.

Recette : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-match-details-panel.cjs`, huit largeurs 375 à 1440, clair/sombre : fermeture initiale, contenu essentiel visible, activation Espace, attributs, indépendance, sélection et filtre, fermeture sans ajout de pari ni perte de focus. 385 tests Node réussis.

BET-345 : « Comprendre le pronostic » ouvre un accordéon natif utilisable au clavier. Le panneau comprend la forme sur cinq matchs, les moyennes de buts marqués et encaissés et une table cote réelle / cote juste (`1 / probabilité`, remboursement pris en compte pour DNB). Aucune cote juste ne remplace une offre réelle ; les données absentes sont signalées. L'état ouvert persiste par match après un nouveau rendu.
