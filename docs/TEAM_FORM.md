# BET-201

Chaque équipe affiche cinq pastilles sous son nom. Le groupe est tactile et focusable ; un clic sur une pastille montre le match passé et le score lorsqu’ils sont disponibles. Le pipeline conserve ces métadonnées lors de la prochaine collecte. Les données anciennes restent utilisables avec une indication de détail indisponible. Le score live et son rafraîchissement ESPN existants sont conservés.

Validation : suite Node complète et recette navigateur locale avec données fictives ; aucun envoi réel ni modification des paris de production.

BET-341 : si football-data.org ne fournit pas au moins deux matchs pour une équipe à venir (notamment les sélections nationales), le pipeline complète sa forme avec le calendrier ESPN de cette équipe et de cette compétition. Identités contrôlées par identifiant, uniquement scores officiels terminés, dates antérieures à la collecte et datant de moins d’un an, déduplication par événement. Les scores après prolongation sont écartés si les scores à 90 minutes ne sont pas disponibles. Deux saisons au maximum, quatre appels simultanés, délai de huit secondes par appel et plafond de 80 requêtes publiques ; aucun nouvel appel au fournisseur de cotes.

Le même calcul de buts attendus est conservé : moyenne attaque/défense observée, facteurs domicile/extérieur et bornes existantes. Il faut toujours au moins deux observations pour chaque équipe ; sinon le modèle reste indisponible. La provenance réelle est publiée dans statsSource et dans chaque forme. Les instantanés de pronostics commencés et les historiques ne sont pas réécrits.
