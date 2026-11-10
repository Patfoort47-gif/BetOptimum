# Reprise des migrations dans la CLI (BET-313)

Validation du 10 novembre 2026 avec la CLI Supabase 2.58.5 et PostgreSQL 17.6 local, production PostgreSQL 17.11.

- 63 migrations historiques actives, de V1 à V65 (V2 n’existe pas et V44 est abandonnée), copiées sans modifier leurs octets. Le manifeste conserve les noms historiques et les empreintes SHA-256.
- V44, l’ancien regroupement d’activation et la recette V5 sont archivés hors du dossier exécuté par la CLI.
- Initialisation d’une base vide par `supabase db start`, puis `supabase db reset --local --no-seed` et `supabase migration list --local` réussis.
- Comparaison avec la production : 121 définitions de fonctions applicatives identiques après normalisation des espaces, 562 colonnes identiques, 45 politiques RLS identiques, 54 tables avec les mêmes indicateurs RLS. Les deux fonctions d’installation de cron, qui dépendent de la configuration d’exploitation/Vault, restent hors de la reconstruction applicative.
- Douze recettes SQL isolées réussies : capital, pseudos, ligues privées, classements, cotes, marchés/H1, tableau personnel, pagination, défi quotidien et notifications. Les tests Node et les empreintes passent.

Après ces vérifications, la reprise a enregistré les 63 versions dans `supabase_migrations.schema_migrations` et leurs empreintes dans `supabase_migrations.betoptimum_checksums`. Seules ces métadonnées ont été écrites en production : aucune migration ancienne n’a été rejouée et aucune donnée applicative n’a été modifiée.

Les horodatages des fichiers indiquent l’ordre de reprise dans la CLI, pas les dates originales d’exécution manuelle. Il s’agit d’une réconciliation du schéma existant, et non d’une affirmation sur l’horaire de chaque déploiement historique.

Le SQL de reprise se prépare avec `node scripts/prepare-migration-baseline.mjs fichier.sql`. Ce script ne se connecte pas à une base. Ne pas l’utiliser sur une autre base avant comparaison complète du schéma.

Les migrations suivantes s’ajoutent avec `supabase migration new`, puis se vérifient avec `db push --dry-run` avant application. Ne pas modifier les 63 fichiers repris et ne jamais utiliser `db reset --linked` en production.
