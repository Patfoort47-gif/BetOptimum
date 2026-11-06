# BET-200 : installation et notifications push

La publication Pages doit passer par `prepare-pages.mjs` : le manifeste hors ligne et les icônes y sont préparés. Le service worker conserve uniquement les ressources publiques du site. Les réponses Supabase et les données privées ne sont jamais mises en cache par le service worker.

Appliquer V50 après V48, puis redéployer la fonction `notifications` avec `--no-verify-jwt` (contrôles d'identité explicites déjà présents). Configurer `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` et la clé de chiffrement existante. Le canal reste indisponible tant que sa configuration est incomplète. Aucun abonnement automatique ; la permission est demandée uniquement au clic sur le commutateur. Le désabonnement global retire aussi le canal navigateur.

Les opportunités fortes suivent les critères Telegram existants (favoris du compte, EV >= 10 %, confiance >= 65 %, dix bookmakers distincts, fraîcheur, deux signaux par jour au maximum, silence nocturne). La file est consommée par le worker d'alertes existant. Le serveur relit l'accord et l'opportunité avant livraison. La destination est chiffrée ; une réassociation exige un nouvel accord.

Sur iOS 16.4 ou ultérieur, installer depuis Safari avant d'activer les notifications. Après deux visites, une proposition apparaît dans le flux de la page : guide visuel sur iPhone/iPad, bouton natif quand il est disponible sur Android/Chrome. Le menu compte et le pied de page gardent un accès manuel dès la première visite. La fermeture de la proposition est mémorisée pour la session. En mode standalone et après appinstalled, les accès à l’installation sont masqués. Aucun prompt natif sans clic et aucun abonnement aux notifications. Le guide clavier/tactile indique Partager → Sur l’écran d’accueil → Ajouter sur iOS ; un refus Android laisse le site utilisable. Le clic sur une notification ouvre la fiche du match.

À vérifier en production après configuration : installation sur deux appareils volontaires, réception écran verrouillé et application fermée, ouverture du bon match, révocation de permission et désabonnement. Aucun envoi réel de test sans volontaire.
