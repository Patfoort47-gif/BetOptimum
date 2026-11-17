# Application installable et notifications smartphone

Le service worker offre le shell hors ligne, les notifications natives et l’ouverture du bon écran. Aucune donnée de compte, destination privée ni calendrier n’est ajoutée au cache hors ligne. Une page hors ligne indique l’indisponibilité des données ; aucun pari n’est validé sans serveur.

## Consentement et configuration

Le canal navigateur est indépendant du briefing email. Il exige un accord dans Mes alertes, la permission système, une association chiffrée et les clés VAPID complètes. Sur iOS/iPadOS 16.4 ou ultérieur, installer d’abord l’application sur l’écran d’accueil. Sans configuration complète, le canal reste indisponible.

La fonction Edge utilise `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NOTIFICATION_ENCRYPTION_KEY` ; voir `NOTIFICATIONS_SETUP.md`. Les subscriptions sont privées, chiffrées et contrôlées par le serveur. Une nouvelle association exige un nouvel accord. Un désabonnement arrête les envois et annule les livraisons en attente.

La déduplication, les heures silencieuses (22 h à 8 h par défaut), la relecture du consentement et l’expiration restent actifs. Le mode Essentiel (V56) n’affiche que les résultats des paris certifiés, sans montant, et suspend rappels et conseil quotidien.

## Équipes favorites

Seules les équipes favorites du compte déclenchent les rappels. Un championnat favori seul ne déclenche plus de notification. Un match correspondant aux deux n’est traité qu’une fois.

Les rappels sont dus environ deux heures avant le match, pendant une fenêtre de 15 minutes. Ils indiquent match, sélection recommandée, cote et confiance quand un conseil valide est disponible, sinon son absence. Le toucher ouvre le match ; aucun pari n’est placé automatiquement. Le minuteur lit `fixtures.notification_pick`, alimenté par `scripts/sync-supabase.mjs` avec le modèle commun. Au moins dix bookmakers par sélection, prix et calendrier actuels, conseil relu avant livraison.

Les alertes d’opportunité supplémentaires ne sont plus réservées ni envoyées. Un pronostic reçoit au plus le conseil principal de 9 h ou son rappel à H-2 selon les préférences actives.

## Résumé quotidien de 9 h

V59 (BET-257) ajoute `daily_summary`, désactivé par défaut. Le conseil est indépendant des favoris. À 9 h dans le fuseau du compte, Europe/Paris par défaut, le minuteur réserve un seul conseil compte/date avec le pronostic le plus recommandé disponible. Aucun envoi sans conseil. Fenêtre 9 h à 9 h 15, sans rattrapage après ; changements d’heure respectés.

`daily-picks.js` est partagé avec la vue `#conseils-du-jour`. Le lien conserve le fuseau ; la vue montre les conseils et cotes actuels. Préférences, expiration et conseils sont relus avant envoi. Le mode Essentiel suspend ce résumé.

## Minuteur Supabase

Appliquer V55 puis les migrations suivantes jusqu’à V60. Installer `supabase/notification-scheduler.sql` (extensions `pg_cron` et `pg_net`). Le secret dédié est dans Vault (`betoptimum_notification_scheduler`) et l’environnement Edge (`NOTIFICATION_SCHEDULER_SECRET`), jamais dans `cron.job`.

Le job `betoptimum-favorite-reminders` tourne chaque minute ; il appelle `scheduled-reminders` et traite maintenant rappels et résumés. Il ne détecte pas d’opportunités et ne traite pas l’email. Initialement tester `dry_run=true`, sans envoi. Activer ensuite le minuteur uniquement pour les utilisateurs consentants. `notification_scheduler` garde bail, dernier succès et résultat du traitement, sans destination privée.

Au déploiement : migration SQL, fonction Edge avec `--no-verify-jwt`, calendrier synchronisé, puis front. Vérifier le worker avec `check-notification-production.yml`, sans envoi. Un résultat `last_ok=true` du minuteur atteste un passage réussi ; il ne prouve pas la réception sur le téléphone.

## Recette

Tester une équipe favorite, un championnat seul et un match correspondant aux deux ; vérifier conseil, cote, confiance, absence de doublon et ouverture. Pour le résumé, tester fuseaux et changements d’heure, 0/1/2/3 conseils, relance, retrait d’accord, mode Essentiel et expiration. `scripts/check-notification-sql.mjs` couvre les réservations et droits sans envoi ; les tests Node simulent le transport.

TTL de transport et expiration côté service worker : 120 secondes. Les résultats certifiés utilisent une notification regroupée, sans montant. Les messages expirés sont ignorés. Aucun délai de réception ne peut être garanti par iOS, Android ou le navigateur.

## Défi du jour retiré (BET-340)

L’option de rappel, la planification et le transport des événements du défi sont retirés. Les anciens rappels en file sont annulés sans envoi. Les pronostics historiques sont conservés. Le conseil du jour reste disponible.

BET-331 présente en premier les résultats et le conseil du jour. Les autres rappels, le mode Essentiel et le briefing email restent accessibles dans des sections dépliables, avec leurs accords inchangés et sans activation automatique.

## Réglage standard à l’activation (BET-339)

Après accord explicite et permission système, une nouvelle activation des notifications sur l’appareil inclut le conseil du jour de 9 h. Le mode Essentiel, les rappels de favoris sont désactivés lors de cette activation standard ; ils restent réglables ensuite. Le conseil peut être coupé séparément. Aucun réglage n’est modifié au chargement de la page ni pour les abonnés actuels.

Le conseil par email est présenté directement dans Mes alertes ; lors d’une activation, le formulaire propose 9 h dans le fuseau du compte. L’adresse doit être associée et l’accord coché puis enregistré. Un abonné actif conserve son horaire. Aucun compte désabonné n’est réinscrit automatiquement.
