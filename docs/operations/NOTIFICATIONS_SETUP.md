# Notifications facultatives : email et smartphone

Deux canaux actifs : le briefing email et les notifications push. Leurs consentements sont indépendants, désactivés par défaut. Aucun envoi de recette à un destinataire sans son accord explicite.

## Installation et ordre de publication

1. Appliquer les migrations dans l’ordre du guide `SUPABASE_SETUP.md`, jusqu’à V65 après V64. Les anciennes migrations restent dans l’historique ; V60 retire le canal abandonné, ses RPC, ses préférences, ses associations et ses destinations chiffrées.
2. Configurer la fonction Edge `notifications` avec `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFICATION_WORKER_SECRET`, `NOTIFICATION_SCHEDULER_SECRET`, `NOTIFICATION_ENCRYPTION_KEY` (32 octets encodés en base64), `SITE_URL` (`https://pronosafe.fr/`). Aucun secret dans le dépôt ni dans le navigateur.
3. Email : `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` (adresse de réponse facultative), domaine d’envoi validé dans Resend. Push : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` ou `https:`).
4. Déployer `supabase/functions/notifications/index.ts` avec `--no-verify-jwt`. Chaque route vérifie explicitement son identité : session Auth pour les préférences, secret worker pour les traitements GitHub, secret scheduler pour le minuteur. L’origine du navigateur doit correspondre à `SITE_URL`.
5. Synchroniser le calendrier pour alimenter `fixtures.notification_pick`, puis publier le front GitHub Pages. Les destinations restent chiffrées côté serveur et ne vont jamais dans GitHub Actions ni localStorage.

## Briefing email

L’utilisateur associe l’adresse confirmée de son compte, choisit l’heure dans son fuseau, puis active le briefing dans Mon profil > Mes alertes. Association seule ne vaut pas accord. L’abonnement est indépendant de la newsletter.

BET-349 : l’en-tête indique l’Indice Global du jour /100, calculé par la même fonction que le site (75 % des résultats des dix jours précédents, 25 % de confiance moyenne des pronostics du jour). Sans historique suffisant, l’absence de valeur est explicite. Le corps présente une à trois analyses distinctes : compétition, équipes, heure de Paris, probabilités 1/N/2, sélection et cote réelle. Un badge Value chiffré apparaît uniquement pour une EV strictement positive sur une cote admissible. Les favoris sont signalés sans dupliquer les cartes. L’objet reprend l’affiche principale.

Le bloc Mon suivi réunit la bankroll relue dans le snapshot privé et le bilan des tickets réglés la veille, calculé sur les bornes du jour de Paris (23 h ou 25 h aux changements d’heure). La requête est réservée au destinataire et le résultat n’est pas transmis à GitHub Actions. Le bilan public des matchs de la veille est séparé. Les données comptables manquantes restent explicites ; aucune projection de gain. Le lien de désabonnement ouvre les préférences après connexion et le HTML conserve les styles clairs/sombres pour les clients email.

Les réglages d’horaire utilisent une révision et une date minimale : pas de rattrapage d’un ancien rendez-vous, une seule livraison par compte et par jour. Les favoris et l’adresse confirmée sont relus juste avant livraison. Un changement d’adresse impose une nouvelle association.

Aperçus fictifs : `node scripts/preview-notification-emails.mjs`, fichiers dans `examples/notification-emails/`, dont une capture mobile. Validation Chromium à 320, 390 et 1000 px. Tables de présentation et styles en ligne pour Gmail et Outlook ; une recette dans les clients réels reste distincte de ces captures.

## Smartphone

Voir `docs/PWA_PUSH.md` pour installation, permission, minuteur et recette. Consentement, déduplication, silence nocturne et expiration restent actifs. Les équipes favorites seules déclenchent les rappels à H-2, jamais un championnat suivi seul. Les alertes d’opportunité supplémentaires ne sont plus planifiées.

Le conseil principal de 9 h dispose d’un choix séparé, désactivé par défaut et indépendant des favoris. Fuseau du compte (Europe/Paris par défaut), changements d’heure compris. Un seul conseil, le plus recommandé par l’application, et aucun envoi sans conseil. Fenêtre de livraison 9 h à 9 h 15 ; pas de rattrapage tardif. Le mode Essentiel limite les push aux résultats certifiés et suspend les autres catégories.

## Traitements et déduplication

BET-348 : le briefing quotidien est envoyé uniquement par la dernière étape des workflows d’actualisation des matchs ou des scores, après publication et synchronisation réussies. Le traitement de maintenance toutes les cinq minutes conserve les tests et alertes existants mais diffère les briefings sans consommer de tentative fournisseur. Le script recharge les offres séparées du calendrier compact et conserve leurs dates par marché. Un calendrier non généré à la date de Paris ou des analyses toutes indisponibles bloquent le briefing et produisent une erreur explicite ; aucun faux email de journée vide. La liste des rencontres du jour est indépendante des cotes disponibles. Aucun appel au fournisseur de cotes pendant l’envoi. Le minuteur Supabase à la minute traite rappels et conseil de 9 h depuis le calendrier serveur récent. Bail et heartbeat privés empêchent deux traitements simultanés du minuteur.

La file privée réserve chaque événement avant l’envoi. Une réponse perdue ou un résultat incertain ne provoque aucun rejeu automatique. Les réponses 429 sont temporisées ; destinations expirées retirées, états incertains conservés pour diagnostic. Resend reçoit une clé d’idempotence par livraison. Les journaux et événements sont purgés après 30 jours.

Le test email reste identifié comme démonstration, sans conseil réel et avec lien vers les préférences. Sauvegarder des préférences email ne supprime pas un test encore consenti ; seul un nouveau clic explicite peut reprendre un test annulé avant toute tentative.

## Diagnostic et validation

- `node --test` : détection, modèle, consentement, API, HTML/texte, payload worker et adaptateurs.
- `PGLITE_MODULE=… node scripts/check-notification-sql.mjs` : migrations réexécutables, droits, unicité, silence, absence de plafond push, résumé quotidien et retrait du canal abandonné, sans appel réseau.
- Workflow `check-notification-production.yml` : version du worker et disponibilité push sans détection ni envoi.
- `notificationConfig` exige la configuration complète et le chiffrement. Les clés et destinations ne sont jamais exposées dans les diagnostics.
- HTTP 503 : examiner le code et la référence bornés (`CONFIG_SITE_URL`, `CONFIG_SUPABASE`, code PostgREST). Ne pas afficher le corps brut ni copier des journaux sensibles.
- Un workflow réussi ne prouve pas l’accès du navigateur : vérifier aussi origine, session, migrations et droits RPC dans Mes alertes. Une réponse `queued:false` signifie qu’une demande existe déjà, pas un nouvel envoi.

Le transport dépend du fournisseur, du système du téléphone et du réseau. Aucun résultat ni délai de livraison n’est garanti. Paris virtuels · 18+ · Aucune garantie de gain.

BET-310 : le rappel du défi du jour demande un accord push distinct, inactif par défaut. Appliquer V65 avant la fonction Edge révision BET-310, puis publier le front. Voir `docs/PWA_PUSH.md`. Le minuteur existant traite ce rappel sans nouvel horaire cron ni nouveau fournisseur.

## Expéditeur personnalisé (BET-350)

Le domaine doit appartenir au propriétaire. Dans Resend, ajouter le domaine d’envoi (de préférence un sous-domaine dédié), recopier exactement les enregistrements DNS SPF/DKIM fournis chez son hébergeur, puis attendre leur validation. Ne jamais inventer de valeurs DNS ni publier les clés API. Choisir ensuite une adresse dédiée sur ce domaine et modifier le secret Edge `EMAIL_FROM` (par exemple `PronoSafe <notifications@domaine-verifie>`). Ne pas remplacer une politique SPF existante à l’aveugle ; utiliser le sous-domaine de retour demandé par Resend.

Le workflow de contrôle de production accepte `sender_diagnostics=true` : diagnostic privé, sans livraison, du domaine effectivement configuré et des statuts SPF/DKIM Resend. Il ne retourne ni clé, ni adresse personnelle, ni liste des autres domaines. Un jeton Resend limité aux envois peut refuser la lecture des domaines : dans ce cas, contrôler manuellement l’interface Resend. Le diagnostic ne prouve pas la réception.

La recette finale exige une adresse Gmail désignée par le propriétaire, un unique envoi de test consenti, puis la lecture de « Afficher l’original » : SPF=PASS et DKIM=PASS, expéditeur attendu. Vérifier aussi clair/sombre sur le client réel. Aucun envoi de test ni changement d’abonnement sans destinataire et consentement explicites. La capture Chromium ne remplace pas cette réception Gmail.

## Mesurer la délivrabilité

Le statut interne `sent` signifie que le transport a accepté le message. Pour Auth, relever les résultats SPF, DKIM et DMARC dans les en-têtes d’un message de recette autorisé et vérifier l’expéditeur et les liens de retour. Pour Resend, utiliser le diagnostic BET-350 pour le domaine, puis consulter les états livré, retardé, rebondi ou plainte dans l’interface privée du fournisseur. Après un rebond permanent ou une plainte confirmée, vérifier la suppression chez le fournisseur et désactiver le briefing via une opération administrative autorisée. Un incident 404/410 sur l’API email ne justifie pas à lui seul de supprimer une association. Aucune relance d’un envoi incertain.

Une intégration automatique des événements Resend nécessite une route publique approuvée spécifiquement. Le contrat devra vérifier la signature sur le corps brut, dédupliquer l’identifiant d’événement, traiter les événements hors ordre, corréler un identifiant de message côté serveur et définir la durée de rétention et les droits. N’enregistrer aucune adresse dans les journaux.

## Ponctualité et fréquence

Le worker renvoie des compteurs agrégés par passage et catégorie (réservés, acceptés par le transport, rejetés, incertains, différés ou interrompus avant transport). Le retard maximal est mesuré depuis l’échéance présente dans la file, qui peut avoir été déplacée après une tentative. Le cumul téléphone et email indique les comptes ayant des envois acceptés sur les deux canaux dans le même passage. Ce compteur ne couvre pas les cumuls entre passages ou entre le minuteur et le traitement GitHub. Une absence de données du calendrier reste signalée séparément avant la réservation. Utiliser ces mesures pour détecter une dérive avant de modifier la fréquence.

La requête privée `select public.notification_delivery_metrics();` agrège les statuts actuels des livraisons sur les 24 dernières heures, par catégorie et canal. Elle compte une seule fois les comptes ayant des alertes métier acceptées par email et push, y compris lorsque les deux envois proviennent de traitements distincts. Les emails de test sont exclus de ce cumul. Aucun identifiant ni destination ne figure dans le résultat. Le retard utilise la dernière échéance enregistrée dans la file et le compteur de quota couvre les motifs encore enregistrés. Le compteur des échéances dépassées regroupe les livraisons encore en attente ou annulées dont l’événement a expiré, sans en déduire la cause de l’annulation.
