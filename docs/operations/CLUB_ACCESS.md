# BET-103 · Accès aux fonctions

| Fonction | Visiteur | Membre | Service indisponible |
| --- | --- | --- | --- |
| Analyses, fiches et bilan | Lecture libre | Lecture libre | Données locales conservées et état signalé |
| Favoris navigateur | Local | Synchronisation si disponible | Local |
| Paris certifiés, ligues, profil personnel | Connexion requise | Validation serveur obligatoire | Action empêchée et motif indiqué |
| Objets, jetons et avatar | Présentation / connexion | Inventaire et droits serveur | Aucune écriture locale de remplacement |
| Profil public | Lecture selon visibilité | Identique | Erreur de lecture explicite |

Aucune modification des RPC, RLS ou conditions de possession. Un service non configuré affiche un dialogue d’information sans formulaire de connexion. Une session expirée demande une reconnexion ; le ticket n’est jamais soumis automatiquement après connexion.

Recette : visite directe #boutique et #profil, analyses/bilan sans compte, connexion puis validation distincte du ticket ; service non configuré et chargement du module comptes en échec. Les tests navigateur isolent le module comptes pour vérifier le contrat UI sans écrire en production.
