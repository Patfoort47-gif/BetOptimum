# BET-102 · Parcours cible

1. Liste filtrée → fiche du match (facultative). La fiche est une fenêtre : les filtres et la liste restent en place ; retour navigateur et fermeture retrouvent le contexte.
2. Sélection d’un marché → ticket, avec état aria-pressed et focus préservé.
3. Contrôle des sélections, mode et mise fictive → confirmation volontaire.
4. Connexion si nécessaire → ticket conservé, aucun pari automatique. Vérification de la disponibilité des matchs au nouveau clic puis contrôles autoritaires du serveur.
5. Confirmation serveur → historique. Résultat incertain → lecture des références et reprise idempotente, jamais présentation d’un succès avant réponse.

Les étapes utiles de confirmation sont conservées. Aucun détour obligatoire par une introduction ou une fiche : de la liste au ticket puis confirmation, deux actions hors connexion. Tests navigateur avec serveur de recette simulé : connexion, double clic, marché fermé, cote changée, reprise après incident. Ces tests vérifient le contrat UI ; ils ne constituent pas une migration ou une recette des RPC de production.

BET-347 : sans compte, placement immédiat dans une simulation privée initialisée à 1 000 €. Chaque placement vérifie encore le coup d'envoi, les probabilités, les cotes et les dix bookmakers. La mise est débitée localement ; les résultats officiels règlent une seule fois ces tickets. La sauvegarde utilise une clé dédiée, indépendante des comptes certifiés. Le compte est facultatif pour sauvegarder une copie privée de cette simulation entre appareils ; ce solde ne crédite jamais le compte serveur. Aucun pari invité ni résultat local n'est publié dans les statistiques publiques. Les paris certifiés continuent de passer exclusivement par les RPC existantes.
