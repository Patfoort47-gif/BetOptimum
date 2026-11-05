# BET-194 · Inventaire des micro-textes

Les libellés partagés sont dans `ui-copy.js` : textes statiques annotés data-copy et textes dynamiques des cartes, du compositeur, de la communauté, du bilan et de l’historique. Les définitions EV/ROI/Unité passent par le composant accessible de BET-187. Les erreurs financières et les mentions obligatoires n’ont pas été raccourcies.

| Écran et emplacement | Avant | Après et contexte |
| --- | --- | --- |
| Grille, action d’accueil | Générer un combiné | Composer un ticket : même parcours existant |
| Grille, compositeur | Composer mon ticket | Composer le ticket |
| Grille, instruction de composition | La recherche utilise les matchs de la période et des filtres affichés. | Choisissez une cible, puis composez le ticket. Les règles restent dans Comment fonctionne la recherche ? |
| Grille, titre des choix | Pronostics à explorer | Choisir un pronostic |
| Grille, statistiques dans le panneau | Stats des équipes et du match + longue description | Voir les statistiques, sous-texte Équipes et match ; les états direct/terminé gardent leur description |
| Grille, détails locaux | Voir les détails | Libellé conservé et centralisé ; état annoncé par aria-expanded |
| Ticket, unité sans configuration | 1 Unité indisponible : configurez son montant ci-dessous. | 1 unité indisponible : définissez son montant. |
| Ticket, conversion | 1 Unité = montant : remplace la mise, sans placer de pari. | 1 unité = montant. Remplace la mise, sans placer de pari. Aide Unité séparée, sans modifier la mise |
| Bankroll, rafraîchissement | Actualiser les paris | Actualiser, dans le contexte de l’historique |
| Bankroll, progression et erreur | Charger plus / Réessayer | Libellés conservés et centralisés ; état et nombre ajouté restent annoncés |
| Bankroll, explications secondaires | Paragraphe sur les filtres, règlements et solde | Les filtres s’appliquent à l’historique et aux indicateurs. Conventions complètes dans Comprendre les indicateurs ; Paris virtuels · 18+ · Aucune garantie reste visible |
| Communauté, description Classement | Choisissez une compétition, retrouvez votre place et visez le podium. | Choisissez un classement. |
| Communauté, autres descriptions | Paragraphes descriptifs Général/Suivis/Ligues privées/Challenges | Recherchez un joueur ou filtrez le classement ; Consultez les joueurs suivis ; Créez une ligue ou rejoignez-la avec un code ; Consultez vos défis et vos trophées |
| Algorithme, filtres | Votre angle de lecture | Filtrer les résultats |
| Algorithme, introduction | Derrière chaque prédiction, un résultat. Retrouvez ce qui a marché, ce qui a moins bien fonctionné et le bilan complet du modèle. | Consultez les résultats des pronostics archivés. |
| Algorithme, accès au journal | Explorer les pronostics | Voir les pronostics |
| Algorithme, aide détaillée | Réussite, profit, ROI : comment lire les chiffres ? | Comprendre les résultats ; définition et limites conservées dans le panneau |

Préservés : messages de précision/minimum/solde, conservation du ticket en erreur, confirmation serveur, résultat incertain sans rejeu, mise et retour potentiel, règles du modèle et du classement, risques/18+/paris virtuels/absence de garantie. Les exemples du ticket ne justifient pas un libellé trompeur Ajouter à la bankroll : une cote reste ajoutée au ticket, puis confirmée par le parcours existant.

Validation : 387 tests Node ; script `scripts/check-ui-copy.cjs` sur les quatre écrans aux huit largeurs 375 à 1440, noms lisibles et aide Unité à Échap sans déplacement de focus ni modification de mise, erreur minimale et réserves visibles. Recettes croisées mises rapides/confirmation incertaine, curseur d’historique, KPI complets et cibles tactiles avec texte doublé. Recettes SQL V47/V48 conservées. Aucun nouveau service ni nouvelle donnée collectée.
