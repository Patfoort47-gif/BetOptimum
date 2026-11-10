import {isExtendedMarket,marketKeys,scoreOutcome,marketSpec} from './markets.js';
// Probabilités cohérentes issues d'une même grille de scores. Les variantes restent expérimentales.
export const OUTCOMES=['home','draw','away'];
const forecastCache=new Map();
const copyForecast=result=>({...result,probs:{...result.probs},reference:result.reference?{...result.reference}:null,parameters:{...result.parameters}});
const validGoals=n=>Number.isFinite(n)&&n>0&&n<=10;
export function marketReference(match){if(!OUTCOMES.every(k=>match.realOddsMarkets?.includes(k)&&Number.isFinite(match.odds?.[k])&&match.odds[k]>1))return null;const inverse=OUTCOMES.map(k=>1/match.odds[k]),margin=inverse.reduce((s,p)=>s+p,0);if(margin<.9||margin>1.3)return null;return Object.fromEntries(OUTCOMES.map((k,i)=>[k,inverse[i]/margin]))}
export function forecastMatch(match,{shrink=0,rho=0,marketWeight=0,includeExtended=false}={}){
  if(![shrink,marketWeight].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!Number.isFinite(rho)||Math.abs(rho)>.2)throw new Error('Paramètres de modèle invalides');
  if(!validGoals(match.homeGoals)||!validGoals(match.awayGoals))throw new Error('Moyennes de buts invalides');
  const cacheKey=JSON.stringify([match.homeGoals,match.awayGoals,match.odds,match.realOddsMarkets,shrink,rho,marketWeight,includeExtended]);
  if(forecastCache.has(cacheKey))return copyForecast(forecastCache.get(cacheKey));
  const home=(1-shrink)*match.homeGoals+shrink*1.45,away=(1-shrink)*match.awayGoals+shrink*1.15;
  const poisson=lambda=>{const p=[Math.exp(-lambda)];for(let k=1;k<=40;k++){p.push(p[k-1]*lambda/k);if(k>lambda&&p[k]<1e-15)break;}return p},h=poisson(home),a=poisson(away),cells=[],base={home:0,draw:0,away:0};let total=0;
  for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++){const correction=i===0&&j===0?1-home*away*rho:i===0&&j===1?1+home*rho:i===1&&j===0?1+away*rho:i===1&&j===1?1-rho:1;if(correction<0)throw new Error('Correction Dixon-Coles négative');const p=h[i]*a[j]*correction,key=i>j?'home':i<j?'away':'draw';cells.push({i,j,p,key});base[key]+=p;total+=p}
  for(const k of OUTCOMES)base[k]/=total;
  const reference=marketReference(match),weight=reference?marketWeight:0,probs=Object.fromEntries(marketKeys(match.odds).filter(key=>!marketSpec(key)?.period&&(includeExtended||!isExtendedMarket(key))).map(key=>[key,0]));
  const compile=key=>{const spec=marketSpec(key);if(spec.kind==='composite'){const parts=spec.parts.map(compile);return(i,j)=>parts.every(test=>test(i,j));}return(i,j)=>scoreOutcome(key,i,j,spec)==='won'},evaluatedMarkets=Object.keys(probs).map(key=>({key,test:compile(key)}));
  for(const {i,j,p,key} of cells){const mass=p/total*(weight?(1-weight)+weight*reference[key]/base[key]:1);for(const market of evaluatedMarkets)if(market.test(i,j))probs[market.key]+=mass}
  const result={probs,reference,parameters:{home,away,rho,marketWeight:weight,shrink}};
  if(forecastCache.size>=512)forecastCache.delete(forecastCache.keys().next().value);
  forecastCache.set(cacheKey,copyForecast(result));
  return result;
}
// L'avance mesure l'écart face à l'alternative la plus probable du même marché.
export function analysisFamilies(markets){const issue=markets.filter(m=>OUTCOMES.includes(m.key)).sort((a,b)=>b.probability-a.probability),family=(key,items)=>{const ranked=items.slice().sort((a,b)=>b.probability-a.probability);return {key,pick:ranked[0],margin:ranked.length>1?ranked[0].probability-ranked[1].probability:0}};return [family('result',issue),...['over','btts'].map(key=>{const yes=markets.find(m=>m.key===key);return family(key,[yes,{key:key==='over'?'under':'bttsNo',label:key==='over'?'Moins de 2,5 buts':'Au moins une équipe ne marque pas',probability:1-yes.probability,odd:null,value:null,analysisOnly:true}])})]}
