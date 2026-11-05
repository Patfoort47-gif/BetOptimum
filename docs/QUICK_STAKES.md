# BET-185 · Mise rapide

Dans Mon ticket : +5 €, +10 € et +50 € ajoutent leur montant à la mise ; Réinitialiser remet à zéro. Ces boutons ne focalisent pas le champ et ne soumettent jamais de pari. Saisie manuelle focalise le champ décimal. Le minimum de mise reste 1 €, avec deux décimales au maximum ; le total engagé, y compris plusieurs simples, doit être couvert par la bankroll. Une erreur conserve le ticket et affiche la cause.

1 Unité remplace la mise par le montant configuré dans « Configurer mon unité ». Sans configuration, ce bouton est désactivé avec une explication. Laisser le montant vide puis enregistrer désactive l’unité. Cette préférence privée est conservée avec le profil de l’état utilisateur et synchronisée par le mécanisme existant pour les comptes ; elle ne modifie ni le compte serveur ni le modèle de pronostic. Confidentialité et Mentions légales l’indiquent.

`stake-controls.js` traite les ajustements en centimes entiers et refuse les valeurs non finies, les décimales excessives et les débordements. Les contrôles sont verrouillés pendant un envoi ou une confirmation incertaine ; seule la vérification du même envoi reste disponible.

Recette locale : serveur `npm start`, puis `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-quick-stakes.cjs`. Compte simulé, aucune écriture serveur distante. Largeurs 375, 390, 430, 767, 768, 1023, 1024, 1440 : 0 → 5 → 15 → 65, unité 12,34 €, rafale de dix clics, absence de focus du champ, saisie décimale, erreurs minimum/précision/solde sans perte de sélection, confirmation unique avec identité et mise exactes. Rechargement de la préférence et confirmation incertaine sans doublon vérifiés. Trois tests Node couvrent les centimes, unités et bornes.
