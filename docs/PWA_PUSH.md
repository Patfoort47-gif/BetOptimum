# Application installable et notifications smartphone

Le service worker offre le shell hors ligne, les notifications natives et l’ouverture du bon écran. Aucune donnée de compte, destination privée ni calendrier n’est ajoutée au cache hors ligne. Une page hors ligne indique l’indisponibilité des données ; aucun pari n’est validé sans serveur.

## Consentement et configuration

Le canal navigateur est indépendant du briefing email. Il exige un accord dans Mes alertes, la permission système, une association chiffrée et les clés VAPID complètes. Sur iOS/iPadOS 16.4 ou ultérieur, installer d’abord l’application sur l’écran d’accueil. Sans configuration complète, le canal reste indisponible.

La fonction Edge utilise `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NOTIFICATION_ENCRYPTION_KEY` ; voir `NOTIFICATIONS_SETUP.md`. Les subscriptions sont privées, chiffrées et contrôlées par le serveur. Une nouvelle association exige un nouvel accord. Un désabonnement arrête les envois et annule les livraisons en attente.

Depuis V58 (BET-255), aucun plafond quotidien de push. La déduplication, les heures silencieuses (22 h à 8 h par défaut), la relecture du consentement et l’expiration restent actifs. Le mode Essentiel (V56) n’affiche que les résultats des paris certifiés, sans montant, et suspend opportunités, rappels et résumés.

## Équipes favorites

Seules les équipes favorites du compte déclenchent les rappels et opportunités. Un championnat favori seul ne déclenche plus de notification. Un match correspondant aux deux n’est traité qu’une fois.

Les rappels sont dus environ deux heures avant le match, pendant une fenêtre de 15 minutes. Ils indiquent match, sélection recommandée, cote et confiance quand un conseil valide est disponible, sinon son absence. Le toucher ouvre le match ; aucun pari n’est placé automatiquement. Le minuteur lit `fixtures.notification_pick`, alimenté par `scripts/sync-supabase.mjs` avec le modèle commun. Au moins dix bookmakers par sélection, prix et calendrier actuels, conseil relu avant livraison.

Les opportunités utilisent `notification-opportunity.js` : équipes favorites, EV >= 10 %, confiance >= 65 %, dix bookmakers distincts et offres datées de moins de 20 h. Une opportunité par match et jour ; aucun rejeu après tentative incertaine.

## Résumé quotidien de 9 h

V59 (BET-257) ajoute `daily_summary`, désactivé par défaut. Le résumé est indépendant des favoris. À 9 h dans le fuseau du compte, Europe/Paris par défaut, le minuteur réserve un seul résumé compte/date avec les trois conseils du jour disponibles. S’il n’y en a qu’un ou deux, envoie ce nombre ; aucun envoi sans conseil. Fenêtre 9 h à 9 h 15, sans rattrapage après ; changements d’heure respectés.

`daily-picks.js` est partagé avec la vue `#conseils-du-jour`. Le lien conserve le fuseau ; la vue montre les conseils et cotes actuels. Préférences, expiration et conseils sont relus avant envoi. Le mode Essentiel suspend ce résumé.

## Minuteur Supabase

Appliquer V55 puis les migrations suivantes jusqu’à V60. Installer `supabase/notification-scheduler.sql` (extensions `pg_cron` et `pg_net`). Le secret dédié est dans Vault (`betoptimum_notification_scheduler`) et l’environnement Edge (`NOTIFICATION_SCHEDULER_SECRET`), jamais dans `cron.job`.

Le job `betoptimum-favorite-reminders` tourne chaque minute ; il appelle `scheduled-reminders` et traite maintenant rappels et résumés. Il ne détecte pas d’opportunités et ne traite pas l’email. Initialement tester `dry_run=true`, sans envoi. Activer ensuite le minuteur uniquement pour les utilisateurs consentants. `notification_scheduler` garde bail, dernier succès et résultat du traitement, sans destination privée.

Au déploiement : migration SQL, fonction Edge avec `--no-verify-jwt`, calendrier synchronisé, puis front. Vérifier le worker avec `check-notification-production.yml`, sans envoi. Un résultat `last_ok=true` du minuteur atteste un passage réussi ; il ne prouve pas la réception sur le téléphone.

## Recette

Tester une équipe favorite, un championnat seul et un match correspondant aux deux ; vérifier conseil, cote, confiance, absence de doublon et ouverture. Pour le résumé, tester fuseaux et changements d’heure, 0/1/2/3 conseils, relance, retrait d’accord, mode Essentiel et expiration. `scripts/check-notification-sql.mjs` couvre les réservations et droits sans envoi ; les tests Node simulent le transport.

TTL de transport et expiration côté service worker : 120 secondes. Les résultats certifiés utilisent une notification regroupée, sans montant. Les messages expirés sont ignorés. Aucun délai de réception ne peut être garanti par iOS, Android ou le navigateur.

## Rappel du défi du jour (BET-310)

V65 après V64 ajoute `daily_challenge_reminder` et son consentement horodaté, désactivés pour tous les comptes existants. Dans Mon profil > Mes alertes, installer le site puis activer le canal push et cocher l’accord spécifique. iOS/iPadOS 16.4+ exige une ouverture depuis l’écran d’accueil ; Android Chrome propose l’installation. Le profil permet d’arrêter ce seul rappel. Désactiver le canal, le déconnecter ou se désabonner de tout efface également cet accord. Le mode Essentiel le suspend.

Le minuteur existant vérifie à 10 h dans le fuseau du compte, pendant quinze minutes. Le jour du défi reste celui de Paris. Aucun rappel si le défi est absent, tous les choix remplis, les matchs fermés/annulés ou sans marché admissible. Les heures silencieuses s’appliquent ; aucun rattrapage au-delà de la fenêtre. Une seule réservation par compte et jour du défi, même après changement de fuseau ou nouvelle association. Le consentement, la participation et le calendrier sont relus au retrait de la file puis juste avant le transport.

Message générique « Ton défi du jour t’attend », sans cote, choix ni montant. Le lien `#defi-du-jour` ouvre les matchs et fait défiler jusqu’au défi après chargement ; aucune validation automatique. Expiration transport à 120 secondes.

Déployer V65, puis la fonction Edge notifications (révision BET-310, vérification JWT de passerelle désactivée, identités toujours contrôlées dans chaque route), puis le front. Ne pas envoyer de notification de test à un utilisateur sans son accord ; les recettes automatisées utilisent un transport fictif. La vérification de production `health` ne livre rien.

Recettes : `npm test`, `PGLITE_MODULE=… node scripts/check-notification-sql.mjs`, navigateur mobile avec Android et iOS installés simulés. Vérifier séparément la réception sur un véritable Android Chrome et un iPhone/iPad installé : les simulations ne prouvent ni l’installation native ni la livraison APNs/FCM réelle.
