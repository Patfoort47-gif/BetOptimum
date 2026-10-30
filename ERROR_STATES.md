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
