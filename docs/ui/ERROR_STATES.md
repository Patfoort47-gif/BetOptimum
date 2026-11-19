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
