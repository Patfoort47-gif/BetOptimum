// Regroupe les migrations déjà publiées en une seule transaction. Aucun accès réseau.
import { readFile, writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url),files=[18,19,20,21,22].map(n=>`supabase-v${n}-schema.sql`);
let sql=`-- BET-77 BET-78 BET-79 BET-82 BET-83 BET-84 BET-85 BET-92\n-- Généré par node scripts/prepare-club-activation.mjs. Réexécutable après V17.\n-- Ne remplace pas V23 et ne touche pas aux préférences ou secrets des alertes.\n-- En cas d’erreur, toute cette transaction est annulée.\nbegin;\ndo $$ begin\n if to_regprocedure('public.avatar_config_valid(jsonb)') is null or to_regclass('public.special_rounds') is null then\n  raise exception 'Installez les migrations du Club jusqu’à V17 avant cette activation.';\n end if;\nend $$;\n`;
for(const file of files){const source=await readFile(new URL(file,root),'utf8');sql+=`\n-- Source : ${file}\n`+source.replace(/^begin;\s*$/m,'').replace(/^commit;\s*$/m,'')+'\n';}
sql+=`\n-- Rattache les paris certifiés éligibles, sans double comptage ni modification des mises.\nselect public.repair_league_history() as rattachements_repares;\nnotify pgrst, 'reload schema';\ncommit;\n`;
await writeFile(new URL('supabase-activation-club.sql',root),sql);
console.log('supabase-activation-club.sql préparé : V18 à V22 et réparation historique.');
