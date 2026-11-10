# Audit et recette des parcours BET-136, BET-137, BET-138

## Priorités et corrections vérifiables

| Priorité | Parcours et problème avant | Correction | Vérification |
| --- | --- | --- | --- |
| P1 | Mes paris : table large, retour à zéro pendant l'attente, potentiel secondaire | Cartes ; mise, retour potentiel non acquis ou retour réel et résultat net nommés séparément | Simple gagné/perdu, remboursement, combiné en attente/perdu, système avec retour inférieur à la mise |
| P1 | Mes paris : annulation affichée comme une sélection à venir | Texte et symbole de remboursement, score annulé sans nombres absents | Sélection annulée et ticket remboursé |
| P1 | Mes paris : lecture de tout l'historique obligatoire | Période, statut, recherche équipes/compétition/pronostic et réinitialisation | Combiner filtres, vider la recherche, conserver les détails ouverts |
| P1 | Matchs : analyses et propositions développées dans chaque carte | Analyses sur demande ; noms longs et cotes adaptés au téléphone | 320, 360, 390 et 430 px, portrait et paysage |
| P1 | Matchs : contexte des filtres dispersé | Résumé date/équipes/compétitions, remise à zéro, aide dans l'état vide | Favoris vides puis réinitialisation |
| P1 | Ticket : sélection confirmée seulement par couleur | Texte « Choisi », confirmation sur carte et annonce ; compteur conservé | Choisir, rouvrir, retirer, vérifier sans doublon |
| P1 | Ticket mobile : focus peut quitter le panneau | Rôle dialogue, focus initial et boucle Tab, Échap et restitution du focus | Clavier, fermeture sans déplacement de la liste |
| P2 | Champs et petites actions : tailles et focus variables selon les modules | Focus commun, actions principales 44 px, champs mobiles 16 px, boutons multilignes | Compte, Club, filtres, fenêtres et zoom 200 % |
| P2 | Chiffres et états vides : densité et alignement variables | Chiffres tabulaires, interligne commun, états vides aérés | Clair/sombre, montants longs, noms longs |
| P2 | Animations et fenêtres : comportements différents | Réduction des mouvements commune, marge de défilement et confinement des fenêtres | Préférence système, fenêtre longue et navigation clavier |

Les cartes personnelles lisent les montants enregistrés sans modifier le règlement.
Le bilan de période est indépendant des filtres de statut et de recherche, comme l'indique son aide.
Un retour serveur absent reste indisponible. Les résultats en direct n'accordent aucun gain.
Les styles réutilisent les variables de thème et la cascade existante, sans service tiers ajouté.

## Validation et limites

Les vérifications automatiques utilisent un serveur local et des réponses simulées : aucun pari réel ou compte réel n'est créé. La suite Node couvre les calculs et la régression des parcours ; la recette navigateur couvre navigation, petit écran, thèmes, focus et conservation des cartes. Les scénarios et résultats précis sont consignés dans le compte rendu de livraison.

À réaliser avec des appareils physiques : iOS Safari, Android Chrome, lecteur d'écran vocal et réseau mobile réel. Une session avec une personne novice reste nécessaire pour valider la compréhension sans explication extérieure. Aucun test automatisé ne remplace cette validation utilisateur.
