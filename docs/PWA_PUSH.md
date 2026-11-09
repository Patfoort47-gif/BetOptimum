# Actualisation BET-246

V56 remplace l’exemption des rappels : tous les push (opportunités, rappels, résultats, tests) consomment le même plafond de 1 ou 2 par jour dans le fuseau du compte. Les tentatives incertaines consomment aussi leur place. Email et Telegram conservent leurs consentements et limites propres.

Le mode Éco / Essentiel ne reçoit que les nouveaux règlements certifiés de Mes paris. Le serveur vérifie de nouveau le consentement, le mode et le résultat avant livraison. Le message affiché sur l’écran verrouillé ne contient ni mise, ni gain, ni choix. Les notifications de résultats partagent un tag pour se remplacer. Un règlement passé n’est jamais rejoué.

Déploiement : appliquer `supabase/migrations/supabase-v56-schema.sql` après V55, déployer `supabase/functions/notifications/index.ts` avec les modules partagés (dont `notification-result.js`), puis publier le front. Le minuteur V55 traite aussi les nouveaux résultats ; il doit être actif. TTL push 120 s et contrôle d’expiration dans le service worker, sans nouveau polling navigateur. Aucun envoi réel de recette sans destinataire volontaire.

Les indications historiques ci-dessous sur l’exemption des rappels sont remplacées par V56.

# BET-200 : installation et notifications push

La publication Pages doit passer par `prepare-pages.mjs` : le manifeste hors ligne et les icônes y sont préparés. Le service worker conserve uniquement les ressources publiques du site. Les réponses Supabase et les données privées ne sont jamais mises en cache par le service worker.

Appliquer V50 après V48, puis redéployer la fonction `notifications` avec `--no-verify-jwt` (contrôles d'identité explicites déjà présents). Configurer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et la clé de chiffrement existante. Le canal reste indisponible tant que sa configuration est incomplète. Aucun abonnement automatique ; la permission est demandée uniquement au clic sur le commutateur. Le désabonnement global retire aussi le canal navigateur.

Les opportunités fortes suivent les critères Telegram existants (favoris du compte, EV >= 10 %, confiance >= 65 %, dix bookmakers distincts, fraîcheur, deux signaux par jour au maximum, silence nocturne). La file est consommée par le worker d'alertes existant. Le serveur relit l'accord et l'opportunité avant livraison. La destination est chiffrée ; une réassociation exige un nouvel accord.

Sur iOS 16.4 ou ultérieur, installer depuis Safari avant d'activer les notifications. Après deux visites, une proposition apparaît dans le flux de la page : guide visuel sur iPhone/iPad, bouton natif quand il est disponible sur Android/Chrome. Le menu compte et le pied de page gardent un accès manuel dès la première visite. La fermeture de la proposition est mémorisée pour la session. En mode standalone et après appinstalled, les accès à l’installation sont masqués. Aucun prompt natif sans clic et aucun abonnement aux notifications. Le guide clavier/tactile indique Partager → Sur l’écran d’accueil → Ajouter sur iOS ; un refus Android laisse le site utilisable. Le clic sur une notification ouvre la fiche du match.

À vérifier en production après configuration : installation sur deux appareils volontaires, réception écran verrouillé et application fermée, ouverture du bon match, révocation de permission et désabonnement. Aucun envoi réel de test sans volontaire.

## BET-242 : rappels des équipes favorites

Appliquer `supabase/migrations/supabase-v54-schema.sql` après V50, puis redéployer la fonction `notifications` avant le front. Le canal nécessite toujours les clés VAPID et le chiffrement. Depuis BET-243, les rappels sont vérifiés chaque minute par Supabase Cron. GitHub Actions conserve les autres alertes ; sa programmation seule ne garantit pas une fréquence de cinq minutes.

Dans Profil > Mes alertes, activer les notifications push puis « Me rappeler les matchs de mes équipes et championnats favoris 2 h avant ». Ce choix est inactif par défaut, y compris pour les abonnés existants. Les équipes et compétitions viennent des favoris synchronisés du compte. Tous les matchs des compétitions favorites sont inclus. Une équipe et une compétition suivies ne créent pas deux rappels du même match. Le rappel n’exige ni cote ni signal de value et ouvre la fiche du match pour un prono virtuel.

Un rappel au plus par match et compte, indépendant du plafond de deux opportunités par jour. Détection de H-2 jusqu’à H-1 h 45, puis abandon et TTL limité au temps restant : aucun rattrapage tardif. Les heures silencieuses sont respectées (22 h à 8 h Paris par défaut). Avant livraison, relire l’accord, les favoris, l’annulation et l’horaire exact du dernier calendrier. Un report annule un ancien rappel ; une tentative déjà effectuée n’est pas répétée. Les événements et leur déduplication sont conservés 30 jours. Le système dépend de la fraîcheur du calendrier publié.

Vérifications : `node --test tests/notification-reminder.test.js`, `npm test`, et `PGLITE_MODULE=<chemin>/@electric-sql/pglite/dist/index.js node scripts/check-notification-sql.mjs`. Recette téléphone à faire avec un volontaire : installation iOS 16.4+ depuis Safari ou Android, activation des deux choix, réception appli fermée, ouverture du match, désactivation. Aucun envoi réel de recette automatique.

## BET-243 : ordonnanceur Supabase

1. Appliquer V55 après V54. La nouvelle table `notification_scheduler` est privée (RLS, aucun droit navigateur) et désactivée au départ.
2. Générer un secret aléatoire dédié (32 octets au moins) et le placer dans les secrets de la fonction Edge sous `NOTIFICATION_SCHEDULER_SECRET` et dans Vault sous le nom `betoptimum_notification_scheduler`. Ne pas modifier le secret du worker GitHub, les clés VAPID ni les abonnements existants. Ne jamais inclure la valeur dans un fichier versionné ou le texte d’une tâche cron.
3. Redéployer `notifications` avec la vérification JWT de passerelle désactivée : chaque route vérifie explicitement son identité. `scheduled-reminders` exige `x-scheduler-secret` et ne traite ni email, ni Telegram, ni détection d’opportunités.
4. Installer `supabase/notification-scheduler.sql` (extensions pg_cron et pg_net). Renseigner dans `notification_scheduler` l’endpoint HTTPS exact du projet et `enabled=true`, en gardant `dry_run=true`. Attendre un déclenchement cron et vérifier une réponse HTTP 200 avec la révision BET-243. Ce mode n’envoie rien.
5. Passer `dry_run=false`. Vérifier plusieurs exécutions cron et `last_success_at` récent. Un bail de deux minutes empêche les traitements qui se chevauchent ; il expire après un arrêt inattendu. Une erreur normale libère le bail et marque l’échec. Le traitement reprend à la minute suivante, dans la limite de la fenêtre du rappel.

Le minuteur lit seulement les matchs à venir dans les deux heures, non terminés/non annulés et synchronisés depuis moins de 24 h. Il ne contacte aucun fournisseur de cotes. Les lots de rappels et les lots d’opportunités sont réservés séparément : un worker GitHub avec un ancien calendrier ne peut pas annuler les rappels du minuteur. L’événement reste unique par compte/match. Aucune activation automatique du consentement.

Surveillance : `cron.job` doit contenir une seule tâche active `betoptimum-favorite-reminders` à `* * * * *`. Consulter les états de `cron.job_run_details`, les codes HTTP dans `net._http_response` et `notification_scheduler.last_success_at`. Ne pas lire ni publier les en-têtes des requêtes pg_net ou les secrets Vault. Le succès cron seul signifie que la requête HTTP a été placée en file ; vérifier aussi sa réponse et le dernier succès du worker. Une réponse envoyée au fournisseur push ne prouve pas son affichage physique sur le téléphone.

Arrêt réversible : mettre `notification_scheduler.enabled=false`, puis désactiver la tâche cron si nécessaire. Cela ne change pas les préférences des utilisateurs. Recette : tests `notification-reminder`/`notification-scheduler`, SQL PGlite (bail, lots distincts, permissions et minuteur sans réseau), suite complète et contrôle production sans envoi. Tester ensuite la réception physique avec un volontaire.
