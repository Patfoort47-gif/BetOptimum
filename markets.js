// Identifiants stables : les cinq marchés historiques gardent leur sens.
export const LEGACY_MARKETS=['home','draw','away','over','btts'];
export const STAGE_ONE=['under','bttsNo','over15','under15','over35','under35'];
export const STAGE_TWO=['homeDraw','drawAway','homeAway','homeDnb','awayDnb'];
export function halfTimeMarketSpec(key,match={}){const m=/^h1(Home|Draw|Away|Over05|Under05|Over15|Under15|Over25|Under25)$/.exec(key);if(!m)return null;const baseKey=({Home:'home',Draw:'draw',Away:'away',Over25:'over',Under25:'under'})[m[1]]??m[1][0].toLowerCase()+m[1].slice(1),base=marketSpec(baseKey,match);return{key,label:`1re mi-temps : ${base.label}`,family:'1re mi-temps',kind:'period',period:'h1',baseKey,manual:true};}
// Lot 2 : un choix fournisseur indivisible, jamais un produit de cotes corrélées.
export function compositeMarketSpec(key,match={}){
 const issueNames={Home:'home',Draw:'draw',Away:'away',HomeDraw:'homeDraw',DrawAway:'drawAway',HomeAway:'homeAway'};
 let m=/^combo(HomeDraw|DrawAway|HomeAway|Home|Draw|Away)(BttsYes|BttsNo)$/.exec(key),parts;
 if(m)parts=[issueNames[m[1]],m[2]==='BttsYes'?'btts':'bttsNo'];
 if(!parts){m=/^combo(HomeDraw|DrawAway|HomeAway|Home|Draw|Away|BttsYes|BttsNo)(Over|Under)(05|15|25|35|45|55|65|75|85|95)$/.exec(key);if(m){const direction=m[2].toLowerCase();parts=[issueNames[m[1]]??(m[1]==='BttsYes'?'btts':'bttsNo'),m[3]==='25'?direction:direction+m[3]];}}
 if(!parts)return null;
 const labels=parts.map(part=>marketSpec(part,match)?.label);if(labels.some(label=>!label))return null;
 return{key,label:labels.join(' + '),family:'Marchés combinés',kind:'composite',parts,manual:true};
}
export function marketSpec(key,match={}){
 const fixed={home:[match.home??'Domicile','Résultat'],draw:['Match nul','Résultat'],away:[match.away??'Extérieur','Résultat'],over:['Plus de 2,5 buts','Buts',2.5,'over'],under:['Moins de 2,5 buts','Buts',2.5,'under'],btts:['Les deux marquent','Équipes'],bttsNo:['Les deux ne marquent pas','Équipes'],homeDraw:['Double chance 1N','Résultat'],drawAway:['Double chance N2','Résultat'],homeAway:['Double chance 12','Résultat'],homeDnb:[`${match.home??'Domicile'} remboursé si nul`,'Résultat'],awayDnb:[`${match.away??'Extérieur'} remboursé si nul`,'Résultat']};
 let v=fixed[key];const total=/^(over|under)(15|35)$/.exec(key),team=/^(home|away)(Over|Under)(05|15|25|35|45|55)$/.exec(key);
 if(total)v=[`${total[1]==='over'?'Plus':'Moins'} de ${Number(total[2])/10} buts`.replace('.',','),'Buts',Number(total[2])/10,total[1]];
 if(team)v=[`${match[team[1]]??(team[1]==='home'?'Domicile':'Extérieur')} : ${team[2]==='Over'?'plus':'moins'} de ${Number(team[3])/10} buts`.replace('.',','),'Équipes',Number(team[3])/10,team[2].toLowerCase(),team[1]];
 const extended=extendedMarketSpec(key,match);if(extended)return extended;
 if(!v)return null;return{key,label:v[0],family:v[1],line:v[2]??null,direction:v[3]??null,team:v[4]??null,dnb:key==='homeDnb'||key==='awayDnb'};
}
export function marketKeys(odds={}){return [...LEGACY_MARKETS,...Object.keys(odds).filter(key=>!LEGACY_MARKETS.includes(key)&&marketSpec(key))]}
export function scoreOutcome(key,home,away){const spec=marketSpec(key);if(!spec)return null;if(spec.kind==='period')return scoreOutcome(spec.baseKey,home,away);if(spec.kind==='composite')return spec.parts.every(part=>scoreOutcome(part,home,away)==='won')?'won':'lost';if(spec.kind==='score')return home===spec.homeScore&&away===spec.awayScore?'won':'lost';if(spec.kind==='handicap'){const delta=home+spec.handicap-away;return (spec.issue==='home'?delta>0:spec.issue==='away'?delta<0:delta===0)?'won':'lost'}if(spec.kind==='margin'){const delta=spec.team==='away'?away-home:home-away;return (spec.draw==='zero'?home===0&&away===0:spec.draw==='goals'?home===away&&home>0:spec.atLeast?delta>=spec.margin:delta===spec.margin)?'won':'lost'}if(spec.dnb&&home===away)return'void';let won;if(spec.line!=null){const goals=spec.team==='home'?home:spec.team==='away'?away:home+away;won=spec.direction==='over'?goals>spec.line:goals<spec.line}else won=key==='home'||key==='homeDnb'?home>away:key==='away'||key==='awayDnb'?away>home:key==='draw'?home===away:key==='homeDraw'?home>=away:key==='drawAway'?away>=home:key==='homeAway'?home!==away:key==='btts'?home>0&&away>0:home===0||away===0;return won?'won':'lost'}
export function selectionCondition(key){const spec=marketSpec(key);if(spec?.period==='h1')return '1re mi-temps uniquement, arrêts de jeu de cette période inclus. 2e mi-temps, prolongation et tirs au but exclus. Règlement après la fin du match ; sans score vérifié de mi-temps, attente de vérification.';return spec?.dnb?'Temps réglementaire : victoire de l’équipe choisie gagnante, nul remboursé (cote 1 dans un combiné), défaite perdante.':spec?.line!=null?`Temps réglementaire : ${spec.team?'buts de l’équipe choisie':'total du match'}, strictement ${spec.direction==='over'?'plus':'moins'} de ${String(spec.line).replace('.',',')}.`:'Temps réglementaire, arrêts de jeu inclus. Prolongation et tirs au but exclus.'}

// BET-170 : choix manuels, identités canoniques. Aucun modèle/value sur ces familles.
export function extendedMarketSpec(key,match={}){
 const half=halfTimeMarketSpec(key,match);if(half)return half;
 const composite=compositeMarketSpec(key,match);if(composite)return composite;
 let m=/^score([0-9]|1[0-5])_([0-9]|1[0-5])$/.exec(key);
 if(m)return{key,label:`Score exact ${m[1]} - ${m[2]}`,family:'Score exact',kind:'score',homeScore:Number(m[1]),awayScore:Number(m[2]),manual:true};
 m=/^eh(Home|Draw|Away)(P[0-9]|M[1-9])$/.exec(key);
 if(m){const handicap=Number(m[2].slice(1))*(m[2][0]==='M'?-1:1),issue=m[1].toLowerCase(),team=issue==='home'?(match.home??'Domicile'):issue==='away'?(match.away??'Extérieur'):'Match nul';return{key,label:`Handicap européen ${handicap>=0?'+':''}${handicap} à domicile : ${team}`,family:'Handicap européen',kind:'handicap',handicap,issue,manual:true}}
 m=/^(home|away)Margin([1-9])(Plus)?$/.exec(key);
 if(m)return{key,label:`${match[m[1]]??(m[1]==='home'?'Domicile':'Extérieur')} gagne de ${m[2]} but${m[2]==='1'?'':'s'}${m[3]?' ou plus':''}`,family:'Marge de victoire',kind:'margin',team:m[1],margin:Number(m[2]),atLeast:Boolean(m[3]),manual:true};
 if(['marginDraw0','marginDrawGoals'].includes(key))return{key,label:key==='marginDraw0'?'Match nul 0 - 0':'Match nul avec des buts',family:'Marge de victoire',kind:'margin',draw:key==='marginDraw0'?'zero':'goals',manual:true};
 m=/^(over|under)(05|45|55|65|75|85|95)$/.exec(key);
 if(m)return{key,label:`${m[1]==='over'?'Plus':'Moins'} de ${String(Number(m[2])/10).replace('.',',')} buts`,family:'Buts',line:Number(m[2])/10,direction:m[1],manual:true};
 return null;
}
export const isExtendedMarket=key=>extendedMarketSpec(key)!==null;
export function marketEnabled(key,stage=0,h1Enabled=false){if(halfTimeMarketSpec(key))return h1Enabled===true;if(compositeMarketSpec(key))return stage>=4;return LEGACY_MARKETS.includes(key)||stage>=1&&STAGE_ONE.includes(key)||stage>=2&&!isExtendedMarket(key)&&marketSpec(key)!==null||stage>=3&&isExtendedMarket(key)}
// Le prix doit être récent à la collecte ; expiration dure après 20 h (nuit entre 14 h et 6 h).
export const EXTENDED_ODDS_MAX_AGE=20*3600000;
export function extendedPriceAvailable(match,key,now=Date.now()){
 if(!isExtendedMarket(key))return true;
 const until=Date.parse(match.marketValidUntil?.[key]);return match.realOddsMarkets?.includes(key)===true&&Number.isFinite(until)&&until>now;
}
