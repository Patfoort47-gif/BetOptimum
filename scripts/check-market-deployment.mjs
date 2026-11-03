// BET-170 : vérification en lecture seule avant toute collecte/écriture de l'étape 3.
import {pathToFileURL} from 'node:url';
import {createAdmin} from './supabase-admin.mjs';
export async function checkMarketDeployment(stage,admin){
 if(![0,1,2,3].includes(stage))throw new Error('Étape de marchés invalide');
 if(stage<3)return;
 if(!admin)throw new Error('Étape 3 : Supabase serveur requis ; appliquer V40 avant activation');
 await admin.select('fixtures','select=market_valid_until&limit=1');
 const label=await admin.rpc('market_label',{k:'score1_0',home_team:'Alpha',away_team:'Beta'});
 if(label!=='Score exact 1 - 0')throw new Error('Étape 3 : migration V40 requise');
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){
 await checkMarketDeployment(Number(process.env.PROPLINE_MARKET_STAGE??0),createAdmin());
 console.log('Compatibilité des marchés vérifiée.');
}
