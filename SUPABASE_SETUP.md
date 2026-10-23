# Activer les comptes BetMaster

La synchronisation utilise l'offre gratuite de Supabase. Les données de chaque compte sont isolées par les règles RLS de la base.

1. Créez un projet sur [supabase.com](https://supabase.com/), puis ouvrez **SQL Editor** et exécutez le contenu de `supabase-schema.sql`.
   Pour activer les profils, avatars et classements de la V3, exécutez ensuite `supabase-v3-schema.sql` dans le même éditeur. Le script est réexécutable : relancez-le après une mise à jour de ces fonctions.
   Exécutez enfin `supabase-v4-schema.sql` (annuaire des joueurs) : il crée un profil public pour chaque compte, à l'inscription et pour les comptes existants, et rend le pseudo unique sans tenir compte de la casse. Ensuite `supabase-v5-schema.sql` (tickets certifiés) : paris, bankroll et statistiques passent côté serveur. Ordre à respecter : `supabase-schema.sql` (v1), `supabase-v3-schema.sql`, `supabase-v4-schema.sql`, `supabase-v5-schema.sql`, `supabase-v6-schema.sql` (points de ligue et quota hebdomadaire), `supabase-v7-schema.sql` (défi du jour), `supabase-v8-schema.sql` (ligue générale : saisons, groupes, classements), `supabase-v9-schema.sql` (ligues spéciales : compétitions et clubs), `supabase-v10-schema.sql` (XP, niveaux, trophées, défis hebdomadaires), `supabase-v11-schema.sql` (jetons et récompenses de saison), `supabase-v12-schema.sql` (club de cœur sur le profil), `supabase-v13-schema.sql` (page profil : confidentialité, pseudo mensuel, export et suppression du compte), `supabase-v14-schema.sql` (ligues privées entre amis), `supabase-v15-schema.sql` (hub communauté : suivis, fil d'activité, classements généraux, hall of fame), `supabase-v16-schema.sql` (boutique, bouclier de série, recharge de bankroll, duels, ligues premium payées en jetons). Les jetons n'ont aucune valeur : ils ne s'achètent pas, ne s'échangent pas et ne se convertissent pas. Les identifiants ESPN des 12 clubs de lancement sont dans ce script : à vérifier sur la première journée jouée. Jouez ensuite la recette de sécurité `supabase-v5-recette.sql`.
   Contrôle après exécution (doit renvoyer 0) : `select count(*) from auth.users u left join public.profiles p on p.user_id = u.id where p.user_id is null;`
2. Dans **Authentication > URL Configuration**, renseignez (la page « Rejoindre le club » renvoie ici après la confirmation d'email, la connexion Google et la réinitialisation du mot de passe) :
   - Site URL : `https://patfoort47-gif.github.io/prono_patfoort/`
   - Redirect URL : `https://patfoort47-gif.github.io/prono_patfoort/`
3. Dans le dépôt GitHub, ouvrez **Settings > Secrets and variables > Actions > Variables**, puis ajoutez :
   - `SUPABASE_URL` : l'URL du projet Supabase ;
   - `SUPABASE_ANON_KEY` : la clé publique `anon` / `publishable` du projet.
   Le déploiement accepte également ces valeurs dans **Secrets**. Si Supabase affiche une clé au nouveau format, vous pouvez la nommer `SUPABASE_PUBLISHABLE_KEY`.
4. Relancez le workflow **Deploy GitHub Pages** ou poussez un commit sur `main`.

Avatar 3D (BET-49) : exécutez `supabase-v17-schema.sql` après `supabase-v16-schema.sql`. Il valide la configuration de l'avatar, vérifie que chaque objet porté est possédé, offre aux anciens joueurs les lunettes et la casquette qu'ils portaient, et crée le seau public **avatars** dans Storage (Storage > Buckets doit le lister : public, 1,5 Mo au plus, WebP, JPEG ou PNG). Aucune clé supplémentaire : le navigateur envoie les images avec la session du joueur, chacun n'écrit que dans son dossier (`{user_id}/bust` et `{user_id}/full`). Contrôle : `select id, public from storage.buckets where id = 'avatars';` doit renvoyer une ligne.

La clé `service_role` n'est jamais utilisée par le site ni écrite dans le dépôt. Elle sert uniquement aux workflows : ajoutez-la comme **Secret** GitHub Actions nommé `SUPABASE_SERVICE_ROLE_KEY` (Settings > Secrets and variables > Actions > Secrets) pour que `scripts/sync-supabase.mjs` envoie les matchs et règle les paris certifiés. Sans ce secret, les paris restent en attente. La clé `anon` est publique ; la confidentialité repose sur les politiques RLS et les fonctions des scripts SQL.

Le workflow `close-season.yml` clôture chaque mois la saison de la ligue générale (montées, descentes, nouveaux groupes) avec le même secret `SUPABASE_SERVICE_ROLE_KEY`. Il tourne chaque jour à 00 h 30 (Paris) et ne fait rien tant qu'aucune saison n'est terminée ; il est relançable à la main (Actions > Clôturer la saison de ligue).

## Connexion Google

La page « Rejoindre le club » propose « Continuer avec Google ». Pour l'activer :

1. Dans la [console Google Cloud](https://console.cloud.google.com/), créez un projet puis un **ID client OAuth** de type « Application Web ». Ajoutez comme URI de redirection autorisée l'adresse de callback affichée par Supabase dans **Authentication > Providers > Google** (de la forme `https://<projet>.supabase.co/auth/v1/callback`).
2. Dans Supabase, ouvrez **Authentication > Providers > Google**, activez le fournisseur et collez l'ID client et le secret client.
3. Dans **Authentication > URL Configuration**, vérifiez que l'adresse GitHub Pages du site figure dans les URL de redirection autorisées (étape 2 ci-dessus).

Le secret client Google reste dans Supabase : il n'est jamais écrit dans le dépôt. Sans cette configuration, le bouton Google affiche une erreur et la connexion par email reste disponible. Dans **Authentication > Sign In / Providers**, vérifiez aussi que la confirmation d'email est activée.

### BET-79 · Ligues sans limite
Après V17, exécuter `supabase-v18-schema.sql`. Les ligues de clubs sont fermées et masquées, leurs résultats et adhésions sont conservés pour archive. Les ligues de compétitions et privées n’ont plus de limite par joueur ; les ligues privées gardent leur capacité de 50 membres. Les prix premium et les protections de solde restent en vigueur.
### BET-77 · Rattrapage de l’historique de ligue
Après V18, exécuter `supabase-v19-schema.sql`. Le pipeline appelle `repair_league_history` après le règlement et avant les classements. Pour une réparation immédiate : `select public.repair_league_history();`, puis relancer la synchronisation habituelle pour recalculer les classements.
La ligue générale récupère uniquement les paris certifiés marqués `counts_general`, hors systèmes et hors saisons closes. Les ligues de compétitions récupèrent les paris certifiés placés pendant leur saison, même avant l’adhésion, dans l’ordre chronologique et selon les quotas/unicité habituels. Les anciens paris locaux ne sont pas importés comme résultats certifiés. Aucun solde ni gain n’est modifié. Les journées absentes du serveur doivent être synchronisées avant le rattrapage.
### BET-78 · Saisons de football
Après V19, exécuter `supabase-v20-schema.sql`, puis lancer la synchronisation habituelle. La ligue générale utilise la clé `AAAA-AAAA` (1er juillet au 30 juin, Paris). Les points de l’année sportive courante sont rattachés à cette clé sans duplication, le dernier groupe est repris ; les classements et résultats mensuels passés restent consultables. Les anciennes saisons mensuelles ouvertes sont archivées sans nouvelle montée/descente. Les clôtures suivantes ont lieu après le 30 juin. Les mois des primes de compétitions et les quotas hebdomadaires restent distincts des saisons. Les dates propres aux compétitions restent dans `special_leagues.season_start/season_end` et doivent être mises à jour pour chaque édition.

Le code peut être publié avant V20 : les workflows vérifient la présence de `football_season`, maintiennent les classements mensuels si elle manque et diffèrent la clôture de la ligue générale. Le rattrapage et les saisons annuelles sont activés après V18, V19 puis V20 et la synchronisation suivante. Les erreurs d’accès ou de serveur ne sont pas masquées.

### BET-92 · Échec à l’adhésion d’une ligue de championnat

Exécuter `supabase-v21-schema.sql` dans le SQL Editor du projet Supabase du site (V16 au minimum doit déjà être présente). Le script est autonome par rapport aux migrations V18 à V20, qui restent nécessaires pour leurs autres fonctionnalités. Il remplace la RPC d’adhésion : suppression de l’ancienne limite de trois ligues, droits explicites, protection des doubles inscriptions et des doubles débits premium, et indépendance de la création du compte de bankroll. Les inscriptions et les soldes existants sont conservés. La notification finale recharge le cache des fonctions de l’API.

Pour identifier la cause d’un refus avant la correction, relever le code de la réponse `join_special_league` dans l’onglet Réseau du navigateur : `LIGUES_MAX` indique l’ancienne limite, `PGRST202`/`42883` une fonction absente, `42501` des droits manquants. Un manque de jetons ou une ligue fermée reste un refus normal. Le site distingue ces situations d’une coupure réseau et vérifie si l’adhésion a été enregistrée avant de signaler un échec.

Vérification après application : rejoindre une quatrième ligue ouverte puis recharger le site ; elle doit figurer dans Mes ligues. Réessayer sur une ligue déjà rejointe ne doit créer ni doublon ni nouveau débit. Sans accès SQL administrateur, publier le code ne suffit pas à remplacer la fonction de la base.

Diagnostic confirmé pour BET-92 : la réponse reçue est `{"code":"P0001","details":null,"hint":null,"message":"LIGUES_MAX"}`. Le serveur exécute donc encore la fonction avec sa limite historique. Son comptage inclut toutes les lignes de `league_members`, y compris les anciennes ligues de clubs que l’interface masque. La recette PostgreSQL reproduit un refus avec une seule ligue de championnat visible et deux adhésions de clubs masquées ; V21 supprime le refus sans supprimer ces archives. Le HTTP 400 est un refus de cette règle métier, pas une indisponibilité réseau.

## Nouveaux objets de personnalisation (BET-82 à BET-85)

Exécuter `supabase-v22-schema.sql` après V17. Cette migration étend la validation stricte sans modifier les inventaires, les soldes ou les avatars existants, et ajoute les nouveaux objets au catalogue serveur. Trois maillots à motifs, deux trophées génériques, deux ambiances et deux stades (intérieur et extérieur), ainsi que trois célébrations sont disponibles. Les aperçus et le rendu équipé partagent les mêmes textures et identifiants. Les règles d’achat et de possession continuent à être vérifiées par les RPC du Club. Le pipeline conserve la synchronisation du catalogue et des prix.

## Alertes multicanales (BET-69)

La migration `supabase-v23-schema.sql` et la fonction Edge ne sont pas déployées par GitHub Pages. Suivre [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md) pour la configuration, les canaux, le consentement, les quotas et la rotation des secrets. Sans cette configuration, le site affiche une indisponibilité explicite et aucun envoi ne se produit.
