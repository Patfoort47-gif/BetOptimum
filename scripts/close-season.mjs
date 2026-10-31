// Clôture des saisons de la ligue générale terminées (BET-55). Lancé chaque jour par close-season.yml ; idempotent et relançable.
import {closeWeeklyRounds} from './weekly-league-engine.mjs';
import { closeFinishedSeasons, leagueSeasonFor } from './league-engine.mjs';
import { awardSpecialTitles } from './special-engine.mjs';
import { payGeneralSeasons, paySpecialLeagues } from './token-engine.mjs';
import { createAdmin } from './supabase-admin.mjs';

const admin = createAdmin();
if (!admin) { console.log('Supabase (service_role) non configuré : clôture des saisons ignorée.'); process.exit(0); }
const season = await leagueSeasonFor(admin), annual = season.length === 9;
if (!annual) console.log('Migration V20 en attente : clôture de la ligue générale différée.');
const weekly = annual ? await closeWeeklyRounds(admin) : 0;
console.log(`${weekly} journée(s) hebdomadaire(s) clôturée(s).`);
const closed = annual ? await closeFinishedSeasons(admin) : 0, titles = await awardSpecialTitles(admin), general = annual ? await payGeneralSeasons(admin) : 0, special = await paySpecialLeagues(admin);
console.log(`${closed} saison(s) clôturée(s), ${titles} titre(s) de ligue spéciale attribué(s), ${general + special} gain(s) de jetons versé(s).`);
