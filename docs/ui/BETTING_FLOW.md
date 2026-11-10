# BET-102 · Parcours cible

1. Liste filtrée → fiche du match (facultative). La fiche est une fenêtre : les filtres et la liste restent en place ; retour navigateur et fermeture retrouvent le contexte.
2. Sélection d’un marché → ticket, avec état aria-pressed et focus préservé.
3. Contrôle des sélections, mode et mise fictive → confirmation volontaire.
4. Connexion si nécessaire → ticket conservé, aucun pari automatique. Vérification de la disponibilité des matchs au nouveau clic puis contrôles autoritaires du serveur.
5. Confirmation serveur → historique. Résultat incertain → lecture des références et reprise idempotente, jamais présentation d’un succès avant réponse.

Les étapes utiles de confirmation sont conservées. Aucun détour obligatoire par une introduction ou une fiche : de la liste au ticket puis confirmation, deux actions hors connexion. Tests navigateur avec serveur de recette simulé : connexion, double clic, marché fermé, cote changée, reprise après incident. Ces tests vérifient le contrat UI ; ils ne constituent pas une migration ou une recette des RPC de production.
