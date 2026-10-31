// BET-98 : aperçus locaux uniquement, aucun envoi ni donnée personnelle.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildBriefing } from '../notification-briefing.js';
import { briefingEmail } from '../notification-email.js';
const output=resolve(process.argv[2]??'work/email-previews');await mkdir(output,{recursive:true});
const now=Date.parse('2027-04-10T06:00:00Z');
const prefs={teams:['Lille','Lens'],leagues:[],timezone:'Europe/Paris',min_value:.01,min_confidence:.4};
const fixtures=[['lille-paris','Lille','Paris','Ligue 1','19:00'],['lens-rennes','Lens','Rennes','Ligue 1','17:00'],['madrid-barcelona','Madrid','Barcelone','Liga','20:00']].map(([id,home,away,league,time],i)=>({id,home,away,league,kickoff:`2027-04-10T${time}:00Z`,homeGoals:2+i*.1,awayGoals:1.1,odds:{home:2.4,draw:3.4,away:3.2,over:2,btts:1.9},bookmakerOffers:[{name:'Bookmaker fictif',home:2.4,draw:3.4,away:3.2,over:2,btts:1.9,updatedAt:'2027-04-10T05:55:00Z'}]}));
const bets=[{id:'demo-simple',status:'pending',bet_type:'single',stake:10,odds:2.4,selections:[{matchId:'lille-paris',key:'home',label:'Lille gagne'}]},{id:'demo-combine',status:'pending',bet_type:'combined',stake:15,odds:4.8,selections:[{matchId:'lens-rennes',key:'home',label:'Lens gagne'},{matchId:'lille-paris',key:'over',label:'Plus de 2,5 buts'}]}];
for(const [name,kinds] of [['quotidien',['daily']],['favoris',['favorites']]]){
 const data=buildBriefing(fixtures,prefs,{date:'2027-04-10',kinds},{bankroll:1245.50},bets,now,'2027-04-10T05:55:00Z');
 const email=briefingEmail({...data,demo:true},'https://patfoort47-gif.github.io/BetOptimum/');
 await writeFile(resolve(output,`${name}.html`),email.html);await writeFile(resolve(output,`${name}.txt`),email.text);
}
console.log(`Deux maquettes fictives HTML et texte : ${output}`);
