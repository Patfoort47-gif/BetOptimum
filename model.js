// Calculs purs partagés par le site (app.js) et le pipeline de données (scripts/update-fixtures.mjs).
export function poisson(k,lambda){let f=1;for(let i=2;i<=k;i++)f*=i;return Math.exp(-lambda)*lambda**k/f}
export function analyseMatch(match){let home=0,draw=0,away=0,under=0,bttsNo=0;for(let i=0;i<=8;i++)for(let j=0;j<=8;j++){const p=poisson(i,match.homeGoals)*poisson(j,match.awayGoals);if(i>j)home+=p;else if(i===j)draw+=p;else away+=p;if(i+j<=2)under+=p;if(i===0||j===0)bttsNo+=p}const probs={home,draw,away,over:1-under,btts:1-bttsNo};const markets=[['home',match.home],['draw','Match nul'],['away',match.away],['over','Plus de 2,5 buts'],['btts','Les deux marquent']].map(([key,label])=>({key,label,odd:match.odds[key],probability:probs[key],value:probs[key]*match.odds[key]-1}));return{probs,markets,confidence:Math.round(Math.max(...markets.map(m=>m.probability))*100)} }
export function recommendedMarket(match){const markets=analyseMatch(match).markets.filter(m=>m.odd>=1.08&&m.odd<=5&&m.value>=-.18);return markets.sort((a,b)=>(b.probability+Math.min(.15,b.value)*.18)-(a.probability+Math.min(.15,a.value)*.18))[0]??analyseMatch(match).markets.sort((a,b)=>b.probability-a.probability)[0]}
export function confidenceKpi(predictions,matches,today){const start=new Date(`${today}T12:00:00Z`);start.setUTCDate(start.getUTCDate()-10);const startDate=start.toISOString().slice(0,10),recent=(predictions??[]).filter(item=>item.date>=startDate&&item.date<today&&['won','lost'].includes(item.status)),wins=recent.filter(item=>item.status==='won').length,form=recent.length?wins/recent.length:null,todayProbabilities=(matches??[]).filter(match=>match.date===today).map(match=>Number((match.suggestedPick??recommendedMarket(match))?.probability)).filter(Number.isFinite),todayConfidence=todayProbabilities.length?todayProbabilities.reduce((sum,value)=>sum+value,0)/todayProbabilities.length:null,score=form==null||todayConfidence==null?null:form*.75+todayConfidence*.25;return{score,form,todayConfidence,wins,recentCount:recent.length,todayCount:todayProbabilities.length,startDate,today}}
export function selectSpotlight(matches,now=Date.now(),liveIds=new Set()){const upcoming=(matches??[]).filter(match=>!match.completed&&!match.voided&&!liveIds.has(match.id)&&new Date(match.kickoff??`${match.date}T${match.time||'12:00'}:00`).getTime()>now);if(!upcoming.length)return null;const firstDate=[...upcoming].sort((a,b)=>String(a.date).localeCompare(String(b.date)))[0].date,sameDay=upcoming.filter(match=>match.date===firstDate),majors=sameDay.filter(match=>match.featured||Number(match.priority)>=75),pool=majors.length?majors:sameDay;return[...pool].sort((a,b)=>Number((b.bookmakerOffers?.length??0)>0)-Number((a.bookmakerOffers?.length??0)>0)||(b.priority??0)-(a.priority??0)||new Date(a.kickoff??`${a.date}T${a.time}`).getTime()-new Date(b.kickoff??`${b.date}T${b.time}`).getTime())[0]??null}
export function optimizeCombo(matches,target=3,maxCount=3,risk='balanced'){const profiles={safe:{minProbability:.5,maxOdd:2.5,valueWeight:.05,riskWeight:1.15},balanced:{minProbability:.42,maxOdd:5,valueWeight:.15,riskWeight:.75},bold:{minProbability:.28,maxOdd:8,valueWeight:.65,riskWeight:.35}},profile=profiles[risk]??profiles.balanced;const candidates=matches.map(match=>({...recommendedMarket(match),matchId:match.id,match:`${match.home} – ${match.away}`,home:match.home,away:match.away,league:match.league,date:match.date,time:match.time})).filter(x=>x.probability>=profile.minProbability&&x.odd<=profile.maxOdd).sort((a,b)=>(b.probability+Math.max(0,b.value)*profile.valueWeight)-(a.probability+Math.max(0,a.value)*profile.valueWeight)).slice(0,18);let best=[],bestScore=Infinity;const evaluate=selection=>{const odds=selection.reduce((p,x)=>p*x.odd,1),confidence=selection.reduce((p,x)=>p*x.probability,1)**(1/selection.length),value=selection.reduce((sum,x)=>sum+Math.max(0,x.value),0)/selection.length,distance=Math.abs(Math.log(odds/target)),under=odds<target?.08:0,score=distance*3+under+(1-confidence)*profile.riskWeight-value*profile.valueWeight;if(score<bestScore){bestScore=score;best=[...selection]}};const search=(index,selection)=>{if(selection.length>=2)evaluate(selection);if(selection.length===maxCount)return;for(let i=index;i<candidates.length;i++)search(i+1,[...selection,candidates[i]])};search(0,[]);return best}
export function selectionResult(item,results){const teams=(item.match??'').split(/\s+[–-]\s+/),homeTeam=item.home??teams[0],awayTeam=item.away??teams[1];const result=results.find(match=>match.id===item.matchId||(homeTeam&&awayTeam&&match.home===homeTeam&&match.away===awayTeam));if(result?.voided)return{status:'void',result};if(!result?.completed)return{status:'pending',result:null};const home=result.homeScore,away=result.awayScore,won=item.key==='home'?home>away:item.key==='draw'?home===away:item.key==='away'?away>home:item.key==='over'?home+away>2.5:item.key==='btts'?home>0&&away>0:false;return{status:won?'won':'lost',result}}
export function settleBet(bet,results){let waiting=false,played=0;for(const item of bet.items){const selection=selectionResult(item,results);if(selection.status==='lost')return'lost';if(selection.status==='pending')waiting=true;else if(selection.status==='won')played++}return waiting?'pending':played?'won':'void'}
export function combinations(size,pick){const result=[];const walk=(start,current)=>{if(current.length===pick){result.push([...current]);return}for(let i=start;i<size;i++)walk(i+1,[...current,i])};walk(0,[]);return result}
export function systemLines(items,formula='auto'){
  const n=items.length,required={trixie:3,yankee:4,'2of3':3,'2of4':4,'3of4':4}[formula];
  if(required&&n!==required)return[];
  const patterns=formula==='trixie'?[[2],[3]]:formula==='yankee'?[[2],[3],[4]]:formula==='2of3'?[[2]]:formula==='2of4'?[[2]]:formula==='3of4'?[[3]]:[[Math.max(2,n-1)]];
  return patterns.flatMap(([pick])=>pick<=n?combinations(n,pick).map(indexes=>({indexes,odds:indexes.reduce((product,index)=>product*items[index].odd,1)})):[])
}
export function settleSystemBet(bet,results){
  const selections=bet.items.map(item=>selectionResult(item,results).status);if(selections.includes('pending'))return{status:'pending',returnAmount:0,wonLines:0};
  let returnAmount=0,wonLines=0;for(const line of bet.systemLines??[]){if(line.indexes.every(index=>selections[index]==='won')){returnAmount+=line.stake*line.odds;wonLines++}}
  return{status:wonLines?'won':'lost',returnAmount,wonLines};
}
// Règlement officiel d'un ticket certifié (serveur) : une sélection annulée est retirée du calcul (cote 1), un ticket entièrement annulé est remboursé.
// bet : {betType, stake, items:[{matchId,key,odd}], systemLines:[{indexes,odds,stake}]}. Renvoie {status:'pending'|'won'|'lost'|'void', payout}.
const cents=value=>Math.round(value*100)/100;
export function settleTicket(bet,results){
  const stake=Number(bet.stake)||0,legs=bet.items.map(item=>({odd:Number(item.odd),status:selectionResult(item,results).status}));
  if(bet.betType==='multiple'){
    let payout=0,waiting=false,wonLines=0;
    for(const line of bet.systemLines??[]){const own=line.indexes.map(index=>legs[index]);if(own.some(leg=>leg.status==='lost'))continue;if(own.some(leg=>leg.status==='pending')){waiting=true;continue}const played=own.filter(leg=>leg.status==='won');payout+=Number(line.stake)*played.reduce((product,leg)=>product*leg.odd,1);if(played.length)wonLines++}
    if(waiting)return{status:'pending',payout:0};
    return{status:wonLines?'won':payout>0?'void':'lost',payout:cents(payout)};
  }
  if(legs.some(leg=>leg.status==='lost'))return{status:'lost',payout:0};
  if(legs.some(leg=>leg.status==='pending'))return{status:'pending',payout:0};
  const played=legs.filter(leg=>leg.status==='won');
  return played.length?{status:'won',payout:cents(stake*played.reduce((product,leg)=>product*leg.odd,1))}:{status:'void',payout:cents(stake)};
}
// Ligue générale (BET-53) : chaque prono compte comme une mise fixe de 10, cote plafonnée à 10,00. Gagné (cote - 1) × 10, perdu -10, annulé 0.
export const WEEKLY_QUOTA=10,LEAGUE_ODDS_CAP=10;
export function leaguePoints({status,odds}){return status==='won'?Math.round((Math.min(Number(odds)||1,LEAGUE_ODDS_CAP)-1)*1000)/100:status==='lost'?-10:0}
const parisDay=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'});
// Lundi (heure de Paris) de la semaine d'un instant, au format AAAA-MM-JJ : la semaine va du lundi 00:00 au dimanche 23:59.
export function weekKey(date){const [y,m,d]=parisDay.format(new Date(date)).split('-').map(Number),day=new Date(Date.UTC(y,m-1,d));day.setUTCDate(day.getUTCDate()-(day.getUTCDay()+6)%7);return day.toISOString().slice(0,10)}
// Paris certifiés (forme du site : date, countsGeneral, items) comptés dans la semaine de `now` et places restantes.
export function quotaUsed(bets,now=Date.now()){const week=weekKey(now);return bets.filter(bet=>bet.countsGeneral&&weekKey(bet.date)===week).length}
export function quotaRemaining(bets,now=Date.now(),limit=WEEKLY_QUOTA){return Math.max(0,limit-quotaUsed(bets,now))}
// Un ticket compte en ligue s'il reste du quota et si aucun de ses matchs n'a déjà servi à un ticket compté (mêmes règles que le serveur).
export function leagueEligibility(matchIds,bets,now=Date.now()){const remaining=quotaRemaining(bets,now);if(!remaining)return{counts:false,reason:'QUOTA',remaining};const used=new Set(bets.filter(bet=>bet.countsGeneral).flatMap(bet=>bet.items.map(item=>item.matchId)));return matchIds.some(id=>used.has(id))?{counts:false,reason:'MATCH_DEJA_COMPTE',remaining}:{counts:true,reason:null,remaining}}
// Départage : points, puis ROI, puis bons pronos au défi du jour, puis ancienneté (le plus ancien d'abord).
export function tieBreak(a,b){return b.points-a.points||b.roi-a.roi||(b.dailyGood??0)-(a.dailyGood??0)||new Date(a.joinedAt)-new Date(b.joinedAt)}
// Défi du jour (BET-54) : 4 matchs du jour (heure de Paris) avec cotes 1N2 réelles, classés par importance de la compétition puis cotes les plus serrées.
// `previous` est le défi déjà publié : ses matchs et ses cotes restent figés, seules les places libres sont complétées avec des matchs pas encore commencés.
export const parisDate=date=>parisDay.format(new Date(date));
export function pickDailyChallenge(matches,day,weights={},previous=null,now=Date.now(),size=4){
  const real=match=>['home','draw','away'].every(key=>match.realOddsMarkets?.includes(key)&&Number(match.odds?.[key])>1),spread=match=>Math.max(match.odds.home,match.odds.draw,match.odds.away)-Math.min(match.odds.home,match.odds.draw,match.odds.away);
  const kept=previous?.date===day?previous.picks:[],taken=new Set(kept.map(pick=>pick.matchId));
  const added=matches.filter(match=>parisDate(match.kickoff)===day&&!match.completed&&!match.voided&&real(match)&&!taken.has(match.id)&&new Date(match.kickoff)>now).sort((a,b)=>(weights[b.league]??0)-(weights[a.league]??0)||spread(a)-spread(b)||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(0,size-kept.length)).map(match=>({matchId:match.id,league:match.league,home:match.home,away:match.away,kickoff:match.kickoff,odds:{home:match.odds.home,draw:match.odds.draw,away:match.odds.away},bookmakers:match.oddsBookmakerCounts?.home??match.bookmakerCount??null}));
  return{date:day,picks:[...kept,...added]};
}
// Niveaux 1 à 1000 (BET-57) : XP pour passer du niveau n au niveau n+1 = 80 + 4 × n^0,75, arrondi à 5. Le niveau ne débloque rien.
export const MAX_LEVEL=1000;
export const xpForLevel=n=>Math.round((80+4*Math.pow(n,.75))/5)*5;
const levelStarts=(()=>{const starts=[0,0];for(let n=1;n<MAX_LEVEL;n++)starts.push(starts[n]+xpForLevel(n));return starts})();
export const totalXpForLevel=level=>levelStarts[Math.min(MAX_LEVEL,Math.max(1,level))];
export function levelFromXp(xp){const total=Math.max(0,Number(xp)||0);let low=1,high=MAX_LEVEL;while(low<high){const mid=Math.ceil((low+high)/2);if(levelStarts[mid]<=total)low=mid;else high=mid-1}const next=low<MAX_LEVEL?xpForLevel(low):0,into=total-levelStarts[low];return{level:low,into,next,progress:next?into/next:1,total}}
export const TITLES=[[1,'Rookie'],[25,'Titulaire'],[100,'Confirmé'],[250,'Expert'],[500,'Vétéran'],[750,'Légende'],[1000,'Immortel']];
export const titleForLevel=level=>TITLES.filter(([from])=>level>=from).at(-1)[1];
// Série de pronos comptés (BET-58 s'appuie dessus) : entries triées du plus ancien au plus récent [{id, points, odds}]. Seuls les pronos gagnés à 1,50 ou plus
// font avancer la série, une défaite la remet à zéro, un prono annulé ou gagné sous 1,50 ne la change pas. Multiplicateurs : 3 → ×1,2 ; 5 → ×1,5 ; 8 → ×2 ; 12 → ×3.
export const STREAK_STEPS=[[12,3],[8,2],[5,1.5],[3,1.2]];
export const streakMultiplier=count=>(STREAK_STEPS.find(([from])=>count>=from)??[0,1])[1];
// shield : {from} (date ISO d'achat du bouclier) ; la première défaite réglée à partir de cette date ne remet pas la série à zéro (usage unique).
export function streakState(entries,shield=null){let current=0,best=0,shielded=false;const milestones=[];for(const entry of entries){const points=Number(entry.points);if(points<0){if(shield&&!shielded&&String(entry.settled_at??'')>=String(shield.from)){shielded=true}else current=0}else if(points>0&&Number(entry.odds)>=1.5){current++;best=Math.max(best,current);if([3,5,8,12].includes(current))milestones.push({at:current,id:entry.id})}}return{current,best,multiplier:streakMultiplier(current),milestones,shieldUsed:shielded}}
// Carte joueur (BET-50) : 6 attributs sur 99 calculés à partir de chiffres bruts publics (vue public_player_card), note générale pondérée.
// raw : {settled, wins, staked, returned, avgOdds, tickets30, activeDays30, avgStakeRatio}. Provisoire tant que moins de 10 paris sont réglés.
export const CARD_ATTRIBUTES=['PRÉ','VAL','RÉG','AUD','VOL','DIS'];
export const CARD_PROVISIONAL_BELOW=10;
const scale99=(value,low,high)=>Math.round(20+79*Math.min(1,Math.max(0,(value-low)/(high-low))));
export function cardAttributes(raw={}){
  const settled=Number(raw.settled)||0,rate=settled?Number(raw.wins||0)/settled:0,staked=Number(raw.staked)||0,roi=staked>0?(Number(raw.returned||0)-staked)/staked*100:0;
  return{
    PRÉ:settled?scale99(rate,.2,.7):20, // précision : part de paris gagnés
    VAL:settled?scale99(roi,-30,40):20, // value : rendement des mises
    RÉG:scale99(Number(raw.activeDays30)||0,0,20), // régularité : jours actifs sur 30
    AUD:Number(raw.avgOdds)>0?scale99(Number(raw.avgOdds),1.3,4):20, // audace : cote moyenne
    VOL:scale99(Math.log10(1+(Number(raw.tickets30)||0)),0,Math.log10(101)), // volume : tickets sur 30 jours
    DIS:raw.avgStakeRatio==null?50:scale99(.2-Number(raw.avgStakeRatio),0,.18) // discipline : mise moyenne rapportée au capital initial
  };
}
export const cardOverall=attributes=>Math.min(99,Math.max(1,Math.round(.2*attributes.PRÉ+.2*attributes.VAL+.2*attributes.RÉG+.1*attributes.AUD+.1*attributes.VOL+.2*attributes.DIS)));
export const cardProvisional=raw=>(Number(raw?.settled)||0)<CARD_PROVISIONAL_BELOW;
// Moyenne des attributs d'un groupe de joueurs, pour le radar comparé.
export function averageAttributes(list){const out={};for(const key of CARD_ATTRIBUTES)out[key]=list.length?Math.round(list.reduce((sum,item)=>sum+item[key],0)/list.length):0;return out}
