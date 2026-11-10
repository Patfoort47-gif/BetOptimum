# Partage du défi du jour (BET-318)

Le bouton réservé au joueur connecté montre les carrés et la série avant partage. Le PNG 1200 × 630 est produit localement : date, carrés (gagné/perdu/en attente/autre), série des choix réglés dans l'ordre de placement, invitation à jouer et avertissement 18+. La série porte sur les 200 derniers choix chargés ; si aucun échec n'y apparaît, la carte indique « au moins ». Ce n'est pas une série de journées parfaites.

Le partage natif transmet le PNG, le texte et le lien canonique `#defi-du-jour`. Sans partage de fichiers, le navigateur télécharge le PNG ; le lien reste visible pour l'ajouter au message. Aucune mise, bankroll, identité, adresse email ni détail de compte n'est inclus. Aucun téléversement, service de stockage ou envoi automatique à une messagerie.

Validation : tests purs du contenu et recette Chromium avec partage natif simulé à 390/1440 px, PNG et URL vérifiés. L'affichage réel des pièces jointes et l'association texte/lien/image dans WhatsApp et iMessage exigent une vérification manuelle sur ces applications ; la simulation ne prouve pas leur rendu et aucun message réel n'est envoyé pour la recette.
