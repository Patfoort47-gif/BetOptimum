# Notifications facultatives : email et smartphone

Deux canaux actifs : le briefing email et les notifications push. Leurs consentements sont indépendants, désactivés par défaut. Aucun envoi de recette à un destinataire sans son accord explicite.

## Installation et ordre de publication

1. Appliquer les migrations dans l’ordre du guide `SUPABASE_SETUP.md`, jusqu’à V60 après V59. Les anciennes migrations restent dans l’historique ; V60 retire le canal abandonné, ses RPC, ses préférences, ses associations et ses destinations chiffrées.
2. Configurer la fonction Edge `notifications` avec `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTIFICATION_WORKER_SECRET`, `NOTIFICATION_SCHEDULER_SECRET`, `NOTIFICATION_ENCRYPTION_KEY` (32 octets encodés en base64), `SITE_URL` (`https://patfoort47-gif.github.io/BetOptimum/`). Aucun secret dans le dépôt ni dans le navigateur.
3. Email : `RESEND_API_KEY`, `EMAIL_FROM`, domaine d’envoi validé dans Resend. Push : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` ou `https:`).
4. Déployer `supabase/functions/notifications/index.ts` avec `--no-verify-jwt`. Chaque route vérifie explicitement son identité : session Auth pour les préférences, secret worker pour les traitements GitHub, secret scheduler pour le minuteur. L’origine du navigateur doit correspondre à `SITE_URL`.
5. Synchroniser le calendrier pour alimenter `fixtures.notification_pick`, puis publier le front GitHub Pages. Les destinations restent chiffrées côté serveur et ne vont jamais dans GitHub Actions ni localStorage.

## Briefing email

L’utilisateur associe l’adresse confirmée de son compte, choisit l’heure dans son fuseau, puis active le briefing dans Mon profil > Mes alertes. Association seule ne vaut pas accord. L’abonnement est indépendant de la newsletter.

Le contenu se limite aux équipes favorites qui jouent, au match du jour et à trois conseils au plus : match, sélection et cote réelle. Les conseils viennent du modèle commun avec dix bookmakers datés par sélection. Aucun montant de bankroll ni projection financière dans l’email. Si un conseil manque, son absence est signalée sans inventer de cote. Le lien de désabonnement ouvre les préférences après connexion.

Les réglages d’horaire utilisent une révision et une date minimale : pas de rattrapage d’un ancien rendez-vous, une seule livraison par compte et par jour. Les favoris et l’adresse confirmée sont relus juste avant livraison. Un changement d’adresse impose une nouvelle association.

Aperçus fictifs : `node scripts/preview-notification-emails.mjs`, fichiers dans `examples/notification-emails/`, dont une capture mobile. Validation Chromium à 320, 390 et 1000 px. Tables de présentation et styles en ligne pour Gmail et Outlook ; une recette dans les clients réels reste distincte de ces captures.

## Smartphone

Voir `docs/PWA_PUSH.md` pour installation, permission, minuteur et recette. Aucun plafond quotidien depuis BET-255 ; consentement, déduplication, silence nocturne et expiration restent actifs. Les équipes favorites seules déclenchent rappels et opportunités, jamais un championnat suivi seul.

Le résumé éditorial de 9 h dispose d’un choix séparé, désactivé par défaut et indépendant des favoris. Fuseau du compte (Europe/Paris par défaut), changements d’heure compris. Résumé de 1 à 3 conseils disponibles, aucun envoi sans conseil. Fenêtre de livraison 9 h à 9 h 15 ; pas de rattrapage tardif. Le mode Essentiel limite les push aux résultats certifiés et suspend les autres catégories.

## Traitements et déduplication

Le workflow `notifications.yml` traite les emails et opportunités à sa cadence existante, avec le dernier fichier publié, sans consulter le fournisseur de cotes. Le minuteur Supabase à la minute traite rappels et résumés de 9 h depuis le calendrier serveur récent. Bail et heartbeat privés empêchent deux traitements simultanés du minuteur.

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
