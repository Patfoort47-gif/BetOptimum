# Alertes facultatives (BET-69)

L’interface est dans Mon profil > Mes alertes. Aucun canal n’est actif par défaut. Sans le serveur ci-dessous, elle indique que le service est indisponible. La publication de fichiers sur GitHub Pages ne déploie pas la fonction Supabase.

## Installation administrateur

1. Appliquer `supabase/migrations/supabase-v23-schema.sql` après V17. Les autres migrations de ligues restent indépendantes.
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

## Diagnostic d’un HTTP 503

La fonction journalise désormais un événement `notification_error` de niveau Error avec une référence, une étape et un code contrôlé. Les messages bruts, les destinations et les secrets ne sont pas journalisés. GitHub affiche le code et la même référence après le statut HTTP. Après mise à jour de ces fichiers, redéployer la fonction Edge ; un push sur main ne remplace pas son déploiement Supabase.

- `CONFIG_SITE_URL` : vérifier `SITE_URL`, qui doit être une URL HTTPS complète.
- `CONFIG_SUPABASE` : vérifier la présence de l’URL Supabase et de la clé service_role dans l’environnement Edge, sans les copier dans les logs.
- `PGRST205`, `42P01` : vérifier l’application de V23 dans ce même projet et le rechargement du schéma PostgREST.
- `PGRST202`, `42883` : vérifier la présence des RPC de V23.
- `42501` : vérifier les droits du rôle serveur ; les données de notifications ne doivent pas être rendues publiques pour contourner cette erreur.
- `WEB_PUSH_SETUP` : vérifier les clés VAPID et le sujet (`mailto:` de contact). L’erreur est isolée à la livraison web ; une file vide et les autres canaux continuent à fonctionner.
- `NETWORK`, `INVALID_RESPONSE`, `UNEXPECTED` : utiliser l’étape et la référence pour localiser l’échec dans les logs Supabase.

Un événement système `Shutdown` avec `EarlyDrop` ne suffit pas à identifier la cause d’une réponse 503. Vérifier l’invocation et le diagnostic applicatif correspondant.

### Workflow réussi mais page Mes alertes indisponible

Le workflow appelle le service depuis GitHub ; le navigateur effectue en plus une requête CORS préalable, avec les en-têtes `authorization`, `apikey`, `content-type` et `x-client-info` du client Supabase. Ils doivent tous figurer dans `Access-Control-Allow-Headers`. Une réussite du worker ne prouve donc pas que le navigateur peut charger la configuration.

La page distingue maintenant un échec des préférences SQL d’un échec de connexion à la fonction, affiche les erreurs traduites et propose Réessayer. Un HTTP 403 sur la fonction signale notamment que l’origine du site doit être vérifiée : `SITE_URL` doit correspondre à l’adresse effectivement ouverte, domaine personnalisé inclus. La valeur ne doit pas être élargie à toutes les origines pour contourner ce contrôle. Après une correction CORS, redéployer `notifications`, puis recharger le site pour prendre en compte le client actualisé.

## Recette email prioritaire (BET-69)

1. Sans domaine : créer un compte Resend avec la même adresse email confirmée que le compte BetOptimum et utiliser `EMAIL_FROM=BetOptimum <onboarding@resend.dev>`. Ce mode ne permet de joindre que l’adresse du compte Resend. Pour les autres utilisateurs, ajouter un domaine possédé, vérifier ses DNS dans Resend et choisir un expéditeur sur ce domaine. Référence : https://resend.com/docs/knowledge-base/403-error-resend-dev-domain .
2. Dans les secrets de la fonction Supabase `notifications`, vérifier `RESEND_API_KEY`, `EMAIL_FROM` et `NOTIFICATION_ENCRYPTION_KEY` (base64 de 32 octets), ainsi que la configuration générale décrite plus haut. Ne jamais copier leurs valeurs dans GitHub, YouTrack ou le chat. Conserver la clé de chiffrement existante : son remplacement rend les destinations déjà associées illisibles.
3. Redéployer `notifications` depuis la racine du dépôt. Cette mise à jour importe aussi `notification-config.js`. Aucune migration SQL supplémentaire n’est nécessaire.
4. Depuis un compte dont l’email est confirmé : Profil > Mes alertes > Email > Associer. Cocher Email et le consentement, puis enregistrer. Pour un essai immédiat, choisir volontairement deux heures silencieuses identiques et enregistrer.
5. Cliquer sur Tester une fois. Ce test ne dépend pas du quota de cotes ni des favoris. Un second clic dans la même heure doit signaler la demande déjà effectuée, sans annoncer un nouvel envoi.
6. Attendre le prochain passage du worker (environ cinq minutes, retards possibles), puis actualiser l’historique. Vérifier le message « BetOptimum : test de vos alertes email » dans la boîte de réception et les indésirables. Le lien renvoie au profil.
7. « Envoyée » signifie que le fournisseur a accepté la demande ; vérifier aussi la réception et les événements de livraison dans Resend. En cas de 401/403, vérifier la clé, les droits d’envoi et le domaine de l’expéditeur ; 429 indique un quota. Un résultat inconnu ne doit pas être rejoué aveuglément.
8. Après validation du test, choisir les favoris et seuils puis rétablir les heures silencieuses voulues. La validation d’une alerte automatique réelle reste dépendante des cotes disponibles.

## Test email annulé après enregistrement des préférences (V24)

Appliquer `supabase/migrations/supabase-v24-schema.sql` dans Supabase > SQL Editor, après V23. Le fichier est réexécutable, ne modifie aucun secret, ne réactive aucun consentement et ne déclenche aucun envoi.

Avant V24, chaque enregistrement des préférences annulait tous les envois en attente, y compris les tests. Après V24, un test reste en attente si son canal reste activé, consenti et associé ; le worker continue de respecter les heures silencieuses et les plafonds. Les alertes ordinaires en attente restent invalidées lors d’une modification des préférences.

Après application, cliquer explicitement sur Tester pour redemander un test annulé sans tentative d’envoi, même dans la même heure. Aucune reprise automatique. Les demandes déjà en attente, tentées, envoyées ou au résultat incertain ne sont pas rejouées. Actualiser relit seulement l’historique.

Validation locale PostgreSQL 16 : V24 appliquée deux fois ; conservation du test après sauvegarde, refus du doublon en attente, reprise sur clic d’un test annulé sans tentative, refus de reprise après tentative et annulation lors du retrait du consentement.

## Briefings email « Le vestiaire du jour » (BET-98, V26)

Ces emails sont indépendants de la newsletter de V25 et des alertes de value. Aucun utilisateur existant n’est abonné automatiquement. V26 n’active ni canal ni consentement.

1. Appliquer `supabase/migrations/supabase-v26-schema.sql` **après V24** (V25 peut être appliquée indépendamment). Ne pas réappliquer V24 après V26 : V26 enveloppe sa fonction de sauvegarde et préserve ses règles de test. Le script V26 est réexécutable.
2. Redéployer la fonction `notifications` depuis la racine. Aucun nouveau fournisseur ni secret : les mêmes configuration Resend, clé de chiffrement et worker sont utilisés. Publier le front après la migration ; sur une ancienne base, les nouveaux contrôles restent masqués.
3. Depuis Mon profil > Mes alertes, associer Email, cocher ce canal et le consentement, puis sélectionner explicitement « Mon briefing quotidien » et/ou « Les jours de match de mes favoris ». Enregistrer. Le consentement newsletter ne vaut pas consentement aux briefings.
4. Quotidien : 15:00 par défaut, modifiable dans le fuseau choisi. Favoris : 120 minutes avant le premier match du jour par défaut (15 à 720). Les équipes et compétitions sont celles des préférences d’alertes ; utiliser « Reprendre mes favoris du site » si nécessaire.
5. Le worker existant passe environ toutes les cinq minutes, sans garantie d’heure exacte. Il fusionne les deux types s’ils sont dus au même passage. Une réservation transactionnelle par propriétaire/date locale/type empêche un deuxième envoi, même après modification des préférences. Un briefing annulé n’est pas rejoué le même jour. Ce comportement V26/V27 est remplacé par la replanification explicite après application de V28 et redéploiement de la fonction (voir ci-dessous).
6. Les plages silencieuses et le plafond par heure/canal restent appliqués par la même file SQL. Un briefing favoris expire au premier coup d’envoi ; un quotidien expire au changement de date locale. Une heure quotidienne absente au printemps est reportée au premier instant suivant ; une heure répétée utilise sa première occurrence. Les matchs commencés sont retirés lors de la composition, les matchs annulés ou terminés exclus.

### Contenu et calculs

Le HTML à tableaux et CSS intégré et sa version texte sont construits par `notification-email.js`. Les informations essentielles n’utilisent ni image, ni police externe, ni JavaScript. Affiche vedette, deux pistes au maximum selon les seuils personnels et trois rencontres au maximum dans le programme. Un seul bouton principal renvoie vers le site. Les alertes et messages de test email utilisent la même présentation. Les conseils exigent un horodatage bookmaker vérifiable de moins de 24 h (cache compris) et un flux de matchs frais : des cotes sans date ne produisent pas de conseil. Le programme peut rester visible sans conseil.

Juste avant l’envoi, le worker lit un snapshot privé et cohérent de `player_accounts` et des paris `pending` via un RPC réservé au service. Aucun solde ni sélection privée n’est stocké dans le payload de la file ni dans les logs. Il vérifie aussi que la destination associée correspond encore à l’email confirmé actuel du compte. Après un changement d’adresse, réassocier le canal ; l’ancienne destination est refusée pour les briefings.

L’email affiche seulement la bankroll disponible et renvoie vers le profil pour les paris et leurs scénarios. Les projections détaillées restent calculées dans le snapshot métier mais ne sont plus affichées dans les emails. Bankroll indisponible et bankroll nulle sont distinguées. Aucun placement automatique.

Après fusion de BET-119, redéployer la fonction `notifications` depuis la racine du dépôt pour appliquer les nouveaux modèles aux envois réels.

### Aperçus et recette avant production

`node scripts/preview-notification-emails.mjs` génère deux maquettes HTML et texte **fictives** dans `work/email-previews`. Les exemples versionnés se trouvent dans `examples/notification-emails/`. Le script ne contacte aucun service et n’envoie aucun email.

Validation locale : tests métier Node, migration réexécutable et droits SQL sur PostgreSQL embarqué, compilation TypeScript Edge, rendu Chromium aux largeurs 320/390/1440. Cette recette ne remplace pas les moteurs de rendu des fournisseurs : avant activation de production, envoyer depuis un compte de test consentant vers Gmail, Outlook et Apple Mail, vérifier aussi leurs modes sombre et images bloquées, les liens de fiche/profil, le désabonnement et le statut Resend. Les bords arrondis peuvent varier selon Outlook ; toute l’information reste en tableaux et texte.

### Horaire quotidien à 15 h (V27)

Appliquer `supabase/migrations/supabase-v27-schema.sql` après V26 pour le nouveau défaut à 15 h. Les horaires déjà enregistrés sont conservés : pour un compte existant, régler « Heure du briefing quotidien » à `15:00` dans Mon profil > Mes alertes et enregistrer. Une sauvegarde sans horaire conserve désormais la valeur du compte. Le repli serveur est aussi à 15 h ; redéployer `notifications` depuis main pour mettre ce repli à jour. Les briefings favoris gardent leur délai avant match.

### Replanification explicite du quotidien (BET-125, V28)

Appliquer `supabase/migrations/supabase-v28-schema.sql` après V27, puis redéployer la fonction `notifications` depuis cette version. Ne pas annoncer la replanification disponible avant ces deux étapes. Le worker ancien ne connaît pas la révision : après un changement d’horaire il ne réserve plus de quotidien, jusqu’au redéploiement. Les canaux et consentements sont conservés.

Un changement enregistré de l’heure ou du fuseau augmente `daily_revision` sous le même verrou que la réservation. Une heure future permet une nouvelle réservation aujourd’hui ; une heure passée ou identique à la minute actuelle commence demain. Une sauvegarde sans changement conserve la révision. Les réservations gardent leur historique et sont uniques par compte/date/type/révision (favoris : révision 0). Les files en attente sont annulées par la sauvegarde V24 ; une révision périmée est aussi refusée avant composition. Un envoi déjà remis au fournisseur ne peut pas être rappelé. Aucun rejeu automatique des résultats incertains. Les consentements, plafonds et plages silencieuses existants restent applicables.
