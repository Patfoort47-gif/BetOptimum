# BET-200 : installation et notifications push

La publication Pages doit passer par `prepare-pages.mjs` : le manifeste hors ligne et les icônes y sont préparés. Le service worker conserve uniquement les ressources publiques du site. Les réponses Supabase et les données privées ne sont jamais mises en cache par le service worker.

Appliquer V50 après V48, puis redéployer la fonction `notifications` avec `--no-verify-jwt` (contrôles d'identité explicites déjà présents). Configurer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et la clé de chiffrement existante. Le canal reste indisponible tant que sa configuration est incomplète. Aucun abonnement automatique ; la permission est demandée uniquement au clic sur le commutateur. Le désabonnement global retire aussi le canal navigateur.

Les opportunités fortes suivent les critères Telegram existants (favoris du compte, EV >= 10 %, confiance >= 65 %, dix bookmakers distincts, fraîcheur, deux signaux par jour au maximum, silence nocturne). La file est consommée par le worker d'alertes existant. Le serveur relit l'accord et l'opportunité avant livraison. La destination est chiffrée ; une réassociation exige un nouvel accord.

Sur iOS 16.4 ou ultérieur, installer depuis Safari avant d'activer les notifications. Après deux visites, une proposition apparaît dans le flux de la page : guide visuel sur iPhone/iPad, bouton natif quand il est disponible sur Android/Chrome. Le menu compte et le pied de page gardent un accès manuel dès la première visite. La fermeture de la proposition est mémorisée pour la session. En mode standalone et après appinstalled, les accès à l’installation sont masqués. Aucun prompt natif sans clic et aucun abonnement aux notifications. Le guide clavier/tactile indique Partager → Sur l’écran d’accueil → Ajouter sur iOS ; un refus Android laisse le site utilisable. Le clic sur une notification ouvre la fiche du match.

À vérifier en production après configuration : installation sur deux appareils volontaires, réception écran verrouillé et application fermée, ouverture du bon match, révocation de permission et désabonnement. Aucun envoi réel de test sans volontaire.

## BET-242 : rappels des équipes favorites

Appliquer `supabase/migrations/supabase-v54-schema.sql` après V50, puis redéployer la fonction `notifications` avant le front. Le canal nécessite toujours les clés VAPID et le chiffrement. Le workflow `notifications.yml` existant vérifie toutes les cinq minutes : GitHub Actions et les fournisseurs push peuvent ajouter du retard, ce n’est pas une alarme exacte.

Dans Profil > Mes alertes, activer les notifications push puis « Me rappeler les matchs de mes équipes favorites 2 h avant ». Ce choix est inactif par défaut, y compris pour les abonnés existants. Les équipes viennent des favoris synchronisés du compte ; les seules compétitions favorites ne déclenchent pas ce rappel. Le rappel n’exige ni cote ni signal de value et ouvre la fiche du match pour un prono virtuel.

Un rappel au plus par match et compte, indépendant du plafond de deux opportunités par jour. Détection de H-2 jusqu’à H-1 h 45, puis abandon et TTL limité au temps restant : aucun rattrapage tardif. Les heures silencieuses sont respectées (22 h à 8 h Paris par défaut). Avant livraison, relire l’accord, les favoris, l’annulation et l’horaire exact du dernier calendrier. Un report annule un ancien rappel ; une tentative déjà effectuée n’est pas répétée. Les événements et leur déduplication sont conservés 30 jours. Le système dépend de la fraîcheur du calendrier publié.

Vérifications : `node --test tests/notification-reminder.test.js`, `npm test`, et `PGLITE_MODULE=<chemin>/@electric-sql/pglite/dist/index.js node scripts/check-notification-sql.mjs`. Recette téléphone à faire avec un volontaire : installation iOS 16.4+ depuis Safari ou Android, activation des deux choix, réception appli fermée, ouverture du match, désactivation. Aucun envoi réel de recette automatique.
