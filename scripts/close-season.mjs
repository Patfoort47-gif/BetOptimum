// Clôture des saisons de la ligue générale terminées (BET-55). Lancé chaque jour par close-season.yml ; idempotent et relançable.
import { closeFinishedSeasons } from './league-engine.mjs';
import { awardSpecialTitles } from './special-engine.mjs';
import { payGeneralSeasons, paySpecialLeagues } from './token-engine.mjs';
import { createAdmin } from './supabase-admin.mjs';

const admin = createAdmin();
if (!admin) { console.log('Supabase (service_role) non configuré : clôture des saisons ignorée.'); process.exit(0); }
const closed = await closeFinishedSeasons(admin), titles = await awardSpecialTitles(admin), general = await payGeneralSeasons(admin), special = await paySpecialLeagues(admin);
console.log(`${closed} saison(s) clôturée(s), ${titles} titre(s) de ligue spéciale attribué(s), ${general + special} gain(s) de jetons versé(s).`);
