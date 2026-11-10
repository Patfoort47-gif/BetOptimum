# Fiabilité du bilan public · lot 14

BET-299 : le bilan et ses graphiques utilisent les cotes réelles vérifiées par défaut. Le filtre Origine des cotes permet de consulter les cotes synthétiques, inconnues ou toute l’archive. Une cote synthétique ne correspond pas à une offre réalisable. Aucun résultat n’est supprimé ni recalculé après le match.

Les nouvelles entrées conservent `oddsSource`, la version du modèle et l’heure de capture lorsqu’elles existent. L’archive historique est annotée par `python3 scripts/mark-prediction-provenance.py` : concordance exacte du choix, de la cote et de la probabilité avec un pronostic stocké dans Git, puis indicateur `real` / `basis` ou couverture `realOddsMarkets` du même prix. L’absence de couverture réelle dans ces anciennes fixtures correspond au repli synthétique du collecteur historique. Sans preuve suffisante, l’origine reste inconnue. Le commit justificatif est conservé dans chaque ligne. Ces preuves identifient l’origine du prix, pas la qualité de la capture prématch.

Validation : tests Node et navigateur Chromium à 390 et 1440 px, filtres, réinitialisation, conservation des 362 entrées, absence de débordement et d’erreur JavaScript. Les chiffres détaillés et le déploiement sont consignés dans YouTrack.
