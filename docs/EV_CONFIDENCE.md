# BET-271 : EV, marché et qualité des données

L’EV payable reste `P_modèle × cote proposée − 1` (plus la probabilité de remboursement pour DNB). Le prix proposé est la moyenne réelle affichée, pas une cote juste reconstruite. Les prix synthétiques ne produisent aucune EV. Les règles d’éligibilité à dix bookmakers et le classement des recommandations par probabilité sont conservés. Les snapshots déjà archivés ne sont pas réécrits.

La nouvelle référence sans marge est la moyenne des probabilités proportionnelles normalisées **par bookmaker**, sur un marché complet 1N2, oui/non ou over/under d’une même ligne. Identités dédupliquées, prix > 1, somme inverse entre 0,9 et 1,3, dates connues et espacées d’une heure au maximum au sein de chaque offre, antérieures au coup d’envoi. Double chance, DNB, scores incomplets et combinaisons ne sont pas normalisés. La référence est descriptive à la date des offres : elle n’affirme pas que des prix en cache sont actuels. Les contrôles de fraîcheur et d’éligibilité existants continuent de s’appliquer. Le delta est exprimé en points de probabilité ; il ne remplace pas l’EV payable.

La qualité des données vaut `30 % volume + 30 % consensus + 40 % récent`, arrondie sur 100. Elle n’est ni calibrée comme probabilité de succès ni une garantie de gain.

- Volume : moyenne des deux historiques d’équipe (saturation à 20 observations) et de la compétition (saturation à 100 observations). `competitionSample` absent vaut zéro ; le pipeline actuel ne fournit pas cette profondeur par compétition.
- Consensus : `max(0, 1 − CV / 0,20) × min(1, bookmakers / 10)` sur les prix comparables du marché, au moins deux bookmakers. CV = écart type population / moyenne.
- Récent : moitié stabilité des résultats V/N/D des cinq derniers matchs antérieurs au coup d’envoi, moitié xG observés. Résultats normalisés 1/0,5/0 ; stabilité `max(0, 1 − 2 × écart type)`, moyenne des équipes pondérée par leur couverture sur cinq matchs. Une régularité dans la défaite peut donc être stable : cet indicateur décrit la stabilité et ne récompense pas artificiellement une équipe favorite.
- Aucun fournisseur de xG observés n’est actuellement intégré. Ce sous-facteur vaut explicitement zéro ; `homeGoals`/`awayGoals` ne sont jamais présentés comme des xG observés. Les poids absents ne sont pas redistribués : maximum 80/100 sans xG et 70/100 sans profondeur de compétition. La couverture est présentée séparément.

## Exécution et validation

Cache borné de 1 024 analyses, invalidé sur le contenu du match (prix, dates, historique inclus). Les objets rendus sont isolés. Au-delà de 100 matchs, préparation dans un Worker module avant application du calendrier, y compris le cache local ; repli coopératif par lots de dix si le navigateur refuse le Worker. Les filtres réutilisent les analyses. Le pipeline importe le même modèle, sans Worker et sans changement de snapshots historiques.

La grille Poisson s’arrête lorsque la masse individuelle devient inférieure à 1e-15 après le mode (maximum 40), et compile une seule fois les prédicats des marchés combinés. Les tests déterministes contrôlent notamment normalisation, probabilités analytiques, variantes Dixon-Coles, EV, données manquantes, invalidation et Worker.

Mesure Chromium 154 headless, Linux cloud, sans ralentissement CPU, calendrier réel de 235 matchs, jusqu’à 127 marchés par match : 1 205 ms à froid, 30 ms à chaud, 783 ms pour le Worker et ses transferts. La mesure à froid avant optimisation était 2 176 ms. Le budget de 50 ms est atteint à chaud seulement ; il ne faut pas annoncer ce critère satisfait à froid, ni déduire 60 fps d’un simple chronométrage. Le matériel client et les coûts DOM restent à mesurer indépendamment.

L’évaluation historique existante (`docs/prediction-evaluation.json`, 177 rencontres du 21 au 29 octobre) reste valable pour les probabilités inchangées ; elle ne valide pas ce nouvel indicateur de qualité. Pas de réestimation de rendement ni de calibration du score sans snapshots de qualité prématch. Le corpus court et l’absence de xG interdisent une revendication d’amélioration prédictive.
