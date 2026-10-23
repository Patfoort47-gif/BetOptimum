# Alertes facultatives (BET-69)

L’interface est dans Mon profil > Mes alertes. Aucun canal n’est actif par défaut. Sans le serveur ci-dessous, elle indique que le service est indisponible. La publication de fichiers sur GitHub Pages ne déploie pas la fonction Supabase.

## Installation administrateur

1. Appliquer `supabase-v23-schema.sql` après V17. Les autres migrations de ligues restent indépendantes.
2. Déployer `supabase/functions/notifications` avec le CLI Supabase : `supabase functions deploy notifications --no-verify-jwt`. Le fichier importe les modules purs à la racine ; déployer depuis la racine du dépôt. La fonction vérifie elle-même le JWT utilisateur, le secret du worker ou celui du webhook Telegram pour chaque route.
3. Configurer dans les secrets Edge : `SITE_URL` (URL HTTPS complète du site, avec son sous-répertoire et son `/` final), `NOTIFICATION_ENCRYPTION_KEY` (32 octets aléatoires encodés en base64), `NOTIFICATION_WORKER_SECRET` (au moins 32 octets aléatoires). `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase à la fonction. Aucune de ces valeurs ne doit être copiée dans le front ni dans Git.
4. Ajouter `NOTIFICATION_WORKER_SECRET` aux secrets GitHub Actions et vérifier `SUPABASE_URL`. Le workflow `notifications.yml` traite la file toutes les cinq minutes et après la collecte des matchs. Sans secret, il ne fait aucun envoi. Il ne contacte pas le fournisseur de cotes : les données de `fixtures.json` de moins de 24 h alimentent la détection. Une file déjà constituée continue à être traitée sans nouvelle détection.

Le rythme des cotes reste 7 h, 14 h et 19 h à Paris, pour les deux formules. La priorité premium ordonne la file ; elle ne promet pas des cotes collectées plus vite. Une planification GitHub Actions peut être retardée et ne constitue pas une garantie de temps réel.

## Canaux

- Web Push : générer une paire VAPID avec un outil compatible `web-push`, renseigner `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` et `VAPID_SUBJECT` (`mailto:` de contact). L’adaptateur serveur utilise `web-push@3.6.7`. Le navigateur associe son abonnement après autorisation explicite. HTTPS et navigateur compatible requis ; sur iOS, l’installation sur l’écran d’accueil peut être nécessaire. Un abonnement par compte : une nouvelle association remplace l’appareil précédent.
- Telegram : créer le bot avec BotFather, renseigner `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_NAME` (sans @) et `TELEGRAM_WEBHOOK_SECRET`. Déclarer son webhook via l’API officielle `setWebhook` vers `https://<projet>.supabase.co/functions/v1/notifications?action=telegram-webhook`, avec `secret_token=TELEGRAM_WEBHOOK_SECRET` et `allowed_updates=["message"]`. Ne jamais placer le jeton dans un journal ou un fichier versionné. L’utilisateur ouvre un lien `/start` aléatoire, à usage unique et valable dix minutes. Seules les conversations privées sont associées. Après association, il actualise puis coche et enregistre le canal.
- Discord : l’utilisateur fournit un webhook du salon qu’il administre. Seul le domaine officiel et le format strict des webhooks sont acceptés. La destination est chiffrée avant stockage. Aucun lien arbitraire n’est interrogé. Les mentions Discord sont désactivées dans les messages.
- Email : vérifier le domaine d’envoi dans Resend, renseigner `RESEND_API_KEY` et `EMAIL_FROM`. L’adresse destinataire est celle du compte Supabase, confirmée, et ne peut pas être remplacée par une adresse fournie au serveur. Le message renvoie au profil pour se désabonner immédiatement après connexion.

La route `config` indique seulement les canaux configurés et la clé VAPID publique. Elle ne révèle aucun secret. Les tests passent par la file, respectent le consentement, les heures silencieuses et les plafonds ; un test par canal et par heure au maximum.

## Formules et confidentialité

Les valeurs de `notification_plans` sont administrables côté serveur. Valeurs initiales : gratuit, cinq favoris et un canal externe en plus du navigateur, trois alertes/heure/canal ; premium, jusqu’à 10 000 favoris, les trois canaux externes, vingt alertes/heure/canal et pas de cote de 5 % au lieu de 10 %. Les filtres ne sont pas restreints dans l’interface. `notification_entitlements` est réservé au service : le navigateur ne peut pas se déclarer premium. Un utilisateur peut imposer un plafond inférieur.

Les tables privées n’ont aucun droit direct pour les rôles du navigateur. Les RPC propriétaire utilisent `auth.uid()` ; les destinations ne sont jamais retournées. AES-GCM protège les destinations avec un nonce aléatoire. Les événements et livraisons expirent au bout de trente jours lors du passage du worker. Le désabonnement annule la file et supprime les destinations et les associations en cours. La suppression du compte efface toutes les lignes par cascade. L’export inclut préférences et historique, sans secrets de destination.

## Livraisons, quotas et rotation

Le détecteur exige un favori, une cote de bookmaker, les seuils et un coup d’envoi futur. Les cotes en cache sans date fiable sont exclues. Chaque événement possède une clé unique compte/match/marché/palier. Une même cote ne produit pas de nouvel envoi aux passages suivants. La file est réservée sous verrou, recontrôle le consentement et les heures silencieuses et plafonne les livraisons par canal. Les plages traversant minuit et les changements d’heure sont testés.

Un HTTP 429 diffère la livraison, avec quatre tentatives au maximum. Les erreurs d’un canal n’arrêtent pas les autres. Les destinations expirées sont retirées. Un résultat ambigu (coupure réseau, 5xx, worker arrêté après réservation) devient « Résultat inconnu » et ne se rejoue pas automatiquement : Telegram et Discord ne garantissent pas d’idempotence. L’email utilise également une clé d’idempotence Resend. Aucun fournisseur ne permet de promettre une livraison exactement une fois dans toutes les pannes.

Avant activation, vérifier les quotas actuels de chaque fournisseur dans son tableau de bord ; aucun volume gratuit n’est garanti par le code. Ajuster les plafonds, la fréquence et la rétention si nécessaire. Faire les tests avec des comptes et salons dédiés, jamais en activant les notifications d’un utilisateur sans son consentement.

Pour faire tourner un jeton fournisseur, suspendre le workflow, remplacer le secret Edge, tester avec un compte volontaire, puis relancer. Pour la clé de chiffrement, désactiver et supprimer les destinations existantes avant de remplacer la clé, puis demander leur réassociation ; changer la clé seule rendrait les anciennes destinations illisibles. Révoquer l’ancien jeton auprès du fournisseur. Ne pas journaliser les URL de webhook, abonnements Push, adresses email ou corps d’erreurs fournisseur.

## Validation effectuée et limites

Tests Node : détection, seuils, favoris, paliers, heures silencieuses et changement d’heure, validation des destinations, chiffrement authentifié, erreurs fournisseur et idempotence email. Recette PostgreSQL locale : migrations réexécutables, isolation des comptes, droits des destinations, limites serveur, dédoublonnage, réservation, fréquence, export, désabonnement et cascades. Les envois réels et le déploiement Edge nécessitent les accès administrateur et les services ci-dessus ; ils ne sont pas validés par les tests avec adaptateurs simulés.
