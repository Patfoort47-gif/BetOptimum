# BET-107 · États et récupération

| État | Présentation | Action |
| --- | --- | --- |
| Chargement calendrier | Statut annoncé | Attendre |
| Calendrier vide pour le filtre | Aucun match sur la période | Changer période / compétition |
| Échec réseau avec données | Dernier calendrier conservé, échec visible | Actualiser, vérifier dates |
| Échec réseau sans données | Démonstration indiquée | Actualiser |
| Club non configuré | Dialogue sans identifiants | Analyses et bilan publics |
| Session absente / expirée | Connexion requise | Se reconnecter ; aucune soumission automatique |
| Refus de cote, match commencé, mise invalide | Motif français fourni par le serveur | Corriger puis confirmer |
| Envoi au résultat incertain | Ticket figé, bouton Vérifier | Relecture des client_ref, puis reprise idempotente des seuls envois manquants |
| Relecture serveur en échec | Envoi toujours incertain | Nouvelle vérification ; aucune écriture supplémentaire |

Les références restent les mêmes lors de la reprise. Aucun rejeu d’un simple confirmé. Les commentaires techniques, clés et réponses brutes ne sont jamais rendus dans le ticket.

## BET-362 : état vide des rencontres harmonisé

Une liste vide affiche le même message « Aucun match à afficher pour cette sélection. » et le bouton « Voir les matchs à venir », quels que soient la date et les filtres. Le bouton ouvre les sept prochains jours avec toutes les compétitions et sans filtre Favoris ; le focus revient au sélecteur « À venir ». Aucun lien vers les défis retirés n’est proposé.

Le bloc Suggestions du jour reste masqué lorsque la liste visible ou les suggestions sont vides, y compris avant le premier rendu. Il réapparaît lorsque des rencontres et des suggestions sont disponibles. Chargement et panne de calendrier conservent leurs messages et actions propres.

Recette : `NODE_PATH=/tmp/bet-ui-tools/node_modules node scripts/check-matches-empty.cjs` à 390, 768 et 1440 px en clair/sombre : dates vides aujourd’hui/hier, filtre Favoris vide, retour aux matchs à venir, disparition puis retour des suggestions. Les réponses de données sont simulées, sans téléphone physique.

## BET-363 : artefact Pages temporairement invisible

Incident du run 44446153059 : le téléversement de `github-pages` (ID 14493745554) a réussi à 02:42:13.951 UTC le 19 novembre 2026. L’action de déploiement a vu une liste vide à 02:42:14.307 UTC. L’artefact existe dans ce run : la collecte n’est pas en cause et le warning `punycode` n’est pas l’erreur bloquante.

Les publications site, calendrier et scores utilisent maintenant l’action locale `publish-pages`. Après l’envoi, `wait-pages-artifact` interroge le même service avec le même client officiel que `deploy-pages@v4`, et exige deux lectures consécutives du bon identifiant avec une taille non nulle. L’attente compte six lectures au maximum, avec délais progressifs (60 secondes d’attente cumulée au plus). Un ID différent, un doublon, un artefact vide ou un refus de l’API arrête explicitement la publication ; aucune relance de collecte ni d’envoi n’est déclenchée.

Le client npm est verrouillé dans l’action GitHub, installé sans scripts et exclu des fichiers publics. Une sonde CI téléverse un petit artefact puis exécute le garde réel, sans déploiement ni données de production. Les tests Node simulent visibilité retardée, intermittence, absence persistante et métadonnées incohérentes.

Pour reprendre uniquement une publication échouée, lancer `pages.yml` sur le dernier `main`. Ne pas rejouer un ancien job complet Actualiser les matchs : cela pourrait refaire des appels fournisseur, des synchronisations métier et des notifications. L’ancien run peut rester rouge dans l’historique alors qu’une publication récente est réussie.
