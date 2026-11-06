import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function reserveSync(attempts,now=Date.now()){
 if(!Array.isArray(attempts)||attempts.some(at=>!Number.isFinite(Date.parse(at))))throw new Error('Journal de quota invalide');
 const recent=attempts.filter(at=>Date.parse(at)>now-86400000);
 if(recent.length>=2||recent.some(at=>now-Date.parse(at)<12*3600000))return null;
 return [...recent,new Date(now).toISOString()];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let attempts=[];try{attempts=JSON.parse(await readFile('data/odds-sync-attempts.json','utf8'))}catch(error){if(error.code!=='ENOENT')throw error;const fixtures=JSON.parse(await readFile('data/fixtures.json','utf8'));if(fixtures.oddsRefreshedAt){if(!Number.isFinite(Date.parse(fixtures.oddsRefreshedAt)))throw new Error('Dernière collecte invalide');attempts=[fixtures.oddsRefreshedAt]}}
 const reserved=reserveSync(attempts);
 if(!reserved){console.info('Cotes : quota protégé, utilisation du cache.');process.exit(0)}
 await writeFile('data/odds-sync-attempts.json',JSON.stringify(reserved,null,2)+'\n');
 console.info('Cotes : réservation avant tout appel fournisseur.');
}
