// Probabilités cohérentes issues d'une même grille de scores. Les variantes restent expérimentales.
export const OUTCOMES=['home','draw','away'];
const validGoals=n=>Number.isFinite(n)&&n>0&&n<=10;
export function marketReference(match){if(!OUTCOMES.every(k=>match.realOddsMarkets?.includes(k)&&Number.isFinite(match.odds?.[k])&&match.odds[k]>1))return null;const inverse=OUTCOMES.map(k=>1/match.odds[k]),margin=inverse.reduce((s,p)=>s+p,0);if(margin<.9||margin>1.3)return null;return Object.fromEntries(OUTCOMES.map((k,i)=>[k,inverse[i]/margin]))}
export function forecastMatch(match,{shrink=0,rho=0,marketWeight=0}={}){
  if(![shrink,marketWeight].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!Number.isFinite(rho)||Math.abs(rho)>.2)throw new Error('Paramètres de modèle invalides');
  if(!validGoals(match.homeGoals)||!validGoals(match.awayGoals))throw new Error('Moyennes de buts invalides');
  const home=(1-shrink)*match.homeGoals+shrink*1.45,away=(1-shrink)*match.awayGoals+shrink*1.15;
  const poisson=lambda=>{const p=[Math.exp(-lambda)];for(let k=1;k<=40;k++)p.push(p[k-1]*lambda/k);return p},h=poisson(home),a=poisson(away),cells=[],base={home:0,draw:0,away:0};let total=0;
  for(let i=0;i<h.length;i++)for(let j=0;j<a.length;j++){const correction=i===0&&j===0?1-home*away*rho:i===0&&j===1?1+home*rho:i===1&&j===0?1+away*rho:i===1&&j===1?1-rho:1;if(correction<0)throw new Error('Correction Dixon-Coles négative');const p=h[i]*a[j]*correction,key=i>j?'home':i<j?'away':'draw';cells.push({i,j,p,key});base[key]+=p;total+=p}
  for(const k of OUTCOMES)base[k]/=total;
  const reference=marketReference(match),weight=reference?marketWeight:0,probs={home:0,draw:0,away:0,over:0,btts:0};
  for(const {i,j,p,key} of cells){const mass=p/total*(weight?(1-weight)+weight*reference[key]/base[key]:1);probs[key]+=mass;if(i+j>2)probs.over+=mass;if(i>0&&j>0)probs.btts+=mass}
  return {probs,reference,parameters:{home,away,rho,marketWeight:weight,shrink}};
}
// L'avance mesure l'écart face à l'alternative la plus probable du même marché.
export function analysisFamilies(markets){const issue=markets.filter(m=>OUTCOMES.includes(m.key)).sort((a,b)=>b.probability-a.probability),family=(key,items)=>{const ranked=items.slice().sort((a,b)=>b.probability-a.probability);return {key,pick:ranked[0],margin:ranked.length>1?ranked[0].probability-ranked[1].probability:0}};return [family('result',issue),...['over','btts'].map(key=>{const yes=markets.find(m=>m.key===key);return family(key,[yes,{key:key==='over'?'under':'bttsNo',label:key==='over'?'Moins de 2,5 buts':'Au moins une équipe ne marque pas',probability:1-yes.probability,odd:null,value:null,analysisOnly:true}])})]}
