# Newsletter BetOptimum (BET-69)

## Installation

Appliquer `supabase/migrations/supabase-v25-schema.sql` dans Supabase > SQL Editor après V23, avant de publier l’interface d’inscription. Le fichier est réexécutable. V24 peut être appliquée indépendamment. Aucun secret à changer ni fonction Edge à redéployer pour enregistrer les inscriptions.

## Comportement

- La case facultative est décochée à l’étape Préférences de la création du compte par email.
- Le choix explicite est transmis à Supabase Auth via `newsletter_opt_in`. Le déclencheur enregistre uniquement les nouveaux comptes ayant choisi la newsletter, sans reprise des comptes existants.
- L’inscription reste `pending` jusqu’à la confirmation de l’email, puis devient `subscribed`. Si l’adresse est déjà confirmée à la création, elle est immédiatement `subscribed`.
- Les personnes inscrites via Google ou les comptes existants peuvent choisir la newsletter depuis Profil > Compte et confidentialité.
- Le profil permet de s’inscrire ou se désabonner. Un désabonnement n’est pas annulé par une nouvelle confirmation d’email.
- La table privée `newsletter_subscriptions` contient le statut, les dates et la provenance du consentement. L’adresse reste dans Auth ; aucune liste d’emails n’est exposée au navigateur. Les RPC ne renvoient que le choix du compte connecté.
- L’export inclut le choix newsletter ; la suppression du compte efface l’inscription par cascade.

## Envois à définir

Cette version collecte les inscriptions ; elle ne déclenche aucune campagne ni alerte sur favoris. Le contenu, les déclencheurs et la fréquence seront définis séparément. Tout futur envoi devra relire le statut `subscribed`, respecter les désabonnements et inclure un lien de désabonnement adapté aux campagnes.

L’expéditeur de test Resend `onboarding@resend.dev` ne peut envoyer qu’à l’adresse du compte Resend. L’envoi à tous les abonnés nécessite un domaine possédé et vérifié dans Resend, puis un `EMAIL_FROM` utilisant ce domaine. Vérifier les DNS demandés par Resend et la réception (y compris les indésirables) avant lancement. Référence : https://resend.com/docs/knowledge-base/403-error-resend-dev-domain .

## Validation

PostgreSQL 16 local : migration exécutée deux fois, absence d’inscription sans case cochée, confirmation différée, désabonnement préservé, contrôle d’accès entre comptes, absence d’accès direct à la table, suppression en cascade et absence de faux consentement sur un compte désabonné.

Chromium à 1440 et 390 px avec Auth et RPC simulés : case décochée, transmission du choix explicite, désabonnement. Tests Node : API privée, booléen explicite et erreurs sans données internes. La migration de production et une inscription réelle ne sont pas validées par ces simulations.
