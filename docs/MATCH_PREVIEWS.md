# Aperçus factuels en deux phrases (BET-320)

Le pipeline des collectes de 6 h et 18 h Paris prépare deux phrases par match à venir. La première décrit les moyennes de buts réellement observées sur l’échantillon disponible ; à défaut elle nomme explicitement les buts estimés du modèle. La seconde reprend le pronostic figé et sa probabilité estimée, ou l’absence de sélection admissible. L’élimination directe est mentionnée uniquement lorsque le calendrier l’indique. Aucune importance sportive, blessure ou autre information absente n’est inventée.

La génération utilise des modèles de phrase déterministes, sans API de texte, sans clé et sans fournisseur supplémentaire. Coût externe : 0 € par collecte, 0 € par match. Complexité linéaire dans le nombre de matchs ; pas d’appel depuis le navigateur. La mention « estimation / aucune garantie » reste visible.

Le navigateur échappe le texte avant affichage. Les matchs commencés ne reçoivent pas de nouveau texte rétrospectif. Les aperçus arrivent avec la prochaine collecte normale ; aucune réservation de cotes supplémentaire n’est déclenchée par la publication du code.
