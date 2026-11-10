# Supabase : installation et migrations

Le site statique utilise le projet Supabase BetMaster pour les comptes, les paris certifiés et les notifications. Les clés de service restent dans les secrets des workflows et des fonctions Edge, jamais dans le navigateur.

## Base locale ou vierge

Installer la [CLI Supabase](https://supabase.com/docs/guides/cli/getting-started) et Docker. La recette de référence utilise la CLI 2.58.5 et PostgreSQL 17, même version majeure que la production.

```sh
supabase db start
supabase db reset --local --no-seed
supabase migration list --local
node scripts/check-migrations.mjs
```

`supabase/config.toml` configure l’environnement local. `supabase/migrations/` contient uniquement les migrations actives, horodatées et exécutées dans l’ordre. `supabase/migrations.json` conserve les correspondances historiques et les empreintes SHA-256. Les migrations déjà publiées sont immuables : toute correction se fait par une nouvelle migration (`supabase migration new description`).

V44 (composites abandonnés), le regroupement d’activation et la recette V5 restent dans `supabase/legacy/` comme archives ; ils ne sont jamais exécutés par un reset ou un push. Ne pas activer de marché abandonné en reconstruisant la base.

## Projet existant et déploiement

La reprise initiale BET-313 enregistre les versions déjà présentes, sans rejouer leur SQL et sans modifier les comptes ni les résultats. Ne jamais faire `db reset --linked` sur la production. Le manifeste et les vérifications de schéma servent de preuve de cette reprise ; ne pas marquer une version comme appliquée si son effet n’a pas été vérifié.

Pour les évolutions suivantes, lier le projet voulu et vérifier l’écart avant application :

```sh
supabase link --project-ref <reference-du-projet>
supabase migration list --linked
supabase db push --dry-run
supabase db push
```

Le mot de passe de base et le jeton CLI s’injectent par les mécanismes de secrets, jamais dans Git ni dans les commandes copiées dans une issue. Vérifier les sauvegardes et lire la nouvelle migration avant tout push. Aucun déploiement du site ne lance automatiquement ces commandes.

## Services à configurer

- Auth : URL du site et redirections sur `https://patfoort47-gif.github.io/BetOptimum/`, confirmation email active. [Connexion Google](docs/GOOGLE_SIGN_IN.md).
- GitHub Actions : `SUPABASE_URL` et clé publique `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY` ; clé `SUPABASE_SERVICE_ROLE_KEY` uniquement en secret serveur.
- Notifications : [configuration](docs/operations/NOTIFICATIONS_SETUP.md), [PWA et consentements](docs/PWA_PUSH.md). Les secrets Edge/Vault et le cron ne font pas partie de la reconstruction des données applicatives.
- Apparence : avatar, cadre et badges uniquement ; [retrait de l’économie](docs/PROFILE_CLEANUP.md).
- [Décision produit](docs/PRODUCT_FOCUS.md) : aucune recharge libre ni réactivation des jetons.

## Recettes isolées

`npm test`, `node scripts/check-migrations.mjs`, puis les scripts `scripts/check-*-sql.*` selon la fonction modifiée. Les recettes PGlite demandent `PGLITE_MODULE` ou `NODE_PATH` vers l’outil de test ; elles n’accèdent pas à la production. Le reset CLI est la preuve complémentaire de reconstruction sur PostgreSQL réel.

L’historique détaillé des opérations manuelles est conservé dans [le guide archivé](docs/archive/SUPABASE_SETUP_LEGACY.md). Il explique les anciennes versions, mais ne remplace plus la CLI.
