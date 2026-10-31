// Contrôles en lecture seule avant de lancer la synchronisation existante du Club.
import { pathToFileURL } from 'node:url';
import { createAdmin } from './supabase-admin.mjs';
import { seasonKey } from '../league.js';
import { defaultAvatar, applyItem } from '../avatar-config.js';
class ClubActivationError extends Error {}
export async function checkClubActivation(admin,now=new Date()) {
 if(!admin)throw new ClubActivationError('Ajoutez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans les paramètres GitHub Actions. La clé de la fonction Edge n’est pas transmise automatiquement à GitHub.');
 let season;try{season=await admin.rpc('football_season',{p_date:now.toISOString()});}catch(error){if(/HTTP (401|403)/.test(String(error?.message??'')))throw new ClubActivationError('La clé serveur GitHub est refusée par Supabase. Vérifiez SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');if(/PGRST202|42883/.test(String(error?.message??'')))throw new ClubActivationError('La saison de football n’est pas accessible : appliquez supabase/migrations/supabase-activation-club.sql dans le projet utilisé par GitHub.');throw new ClubActivationError('Impossible de vérifier la saison de football : contrôlez l’accès serveur et réessayez.');}
 if(season!==seasonKey(now))throw new ClubActivationError('Le calendrier de saison serveur ne correspond pas au calendrier football attendu.');
 const club=await admin.select('special_leagues','kind=eq.club&open=eq.true&select=id&limit=1');
 if(club.length)throw new ClubActivationError('Des ligues de clubs sont encore ouvertes : appliquez supabase/migrations/supabase-activation-club.sql.');
 for(const id of ['kit-mosaic','trophy-crystal','bg-aurora-in','celeb-heart']) {
  let valid=false;try{valid=await admin.rpc('avatar_config_valid',{cfg:applyItem(defaultAvatar(),id)});}catch{}
  if(valid!==true)throw new ClubActivationError('Les nouveaux objets d’avatar ne sont pas acceptés par la base : appliquez supabase/migrations/supabase-activation-club.sql.');
 }
 console.log(`Accès serveur et saison ${season} vérifiés, ligues de clubs fermées, nouveautés acceptées. Aucun secret affiché.`);
 return season;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{await checkClubActivation(createAdmin());}catch(error){console.error(error instanceof ClubActivationError?error.message:'Le contrôle du Club a échoué. Vérifiez les accès serveur et les migrations, puis réessayez.');process.exitCode=1;}}
