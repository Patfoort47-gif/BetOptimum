// Le lien ne transporte que les sélections, leurs cotes de référence et le type de coupon.
const MODES=['single','combined','multiple'],FORMULAS=['auto','2of3','2of4','3of4','trixie','yankee'];
export function ticketToken(items,{mode=items.length>1?'combined':'single',formula='auto'}={}){
 if(!items.length||items.length>30)throw Error('Partagez un coupon de 1 à 30 sélections.');
 const data={v:2,m:MODES.includes(mode)?mode:'combined',f:FORMULAS.includes(formula)?formula:'auto',s:items.map(i=>[i.matchId,i.key,Number.isFinite(Number(i.odd))&&Number(i.odd)>1?Number(i.odd):null])};
 const token='v2.'+btoa(JSON.stringify(data)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');if(readTicket(token).invalid)throw Error('Ces sélections ne peuvent pas être partagées.');return token;
}
export function ticketUrl(base,items,options){const url=new URL(base);url.search='';url.hash='';url.searchParams.set('ticket',ticketToken(items,options));return url.href}
export function readTicket(value){
 if(typeof value!=='string'||value.length>12000)return{items:[],invalid:true};
 if(value.startsWith('v2.')){try{if(!/^[A-Za-z0-9_-]+$/.test(value.slice(3)))throw Error();const data=JSON.parse(atob(value.slice(3).replace(/-/g,'+').replace(/_/g,'/')));if(data.v!==2||!MODES.includes(data.m)||!FORMULAS.includes(data.f)||!Array.isArray(data.s)||!data.s.length||data.s.length>30)throw Error();const items=[],seen=new Set();let invalid=false;for(const row of data.s){if(!Array.isArray(row)||row.length!==3||!/^espn-\d+$/.test(row[0])||!/^[a-zA-Z0-9_]{1,80}$/.test(row[1])||seen.has(row[0])||row[2]!==null&&(!Number.isFinite(row[2])||row[2]<=1||row[2]>100000)){invalid=true;continue}seen.add(row[0]);items.push({matchId:row[0],key:row[1],...(row[2]===null?{}:{sharedOdd:row[2]})});}return{items,invalid,mode:data.m,formula:data.f};}catch{return{items:[],invalid:true};}}
 const parts=value.split(','),items=[],seen=new Set();let invalid=parts.length>30;for(const part of parts.slice(0,30)){const pair=/^(espn-\d+):([a-zA-Z0-9_]{1,80})$/.exec(part);if(!pair||seen.has(pair[1])){invalid=true;continue}seen.add(pair[1]);items.push({matchId:pair[1],key:pair[2]})}return{items,invalid};
}
const DRAFT='betoptimum-ticket-draft';
export function saveTicketDraft(storage,value,now=Date.now()){try{if(value===null)storage?.removeItem(DRAFT);else storage?.setItem(DRAFT,JSON.stringify({value,savedAt:now}));}catch{}}
export function readTicketDraft(storage,now=Date.now()){try{const entry=JSON.parse(storage?.getItem(DRAFT)??'null');if(!entry||!Number.isFinite(entry.savedAt)||entry.savedAt>now||now-entry.savedAt>864e5||readTicket(entry.value).invalid)return null;return entry.value}catch{return null}}
