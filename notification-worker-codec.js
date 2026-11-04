// BET-69 : noms de colonnes transmis une seule fois par match, sans perte de prix.
export function encodeWorkerMatch(match,sharedFields=null) {
 const fields=sharedFields??[...new Set((match.bookmakerOffers??[]).flatMap(offer=>Object.keys(offer)))];
 const indexes=new Map(fields.map((key,i)=>[key,i]));
 return {...match,...(sharedFields?{}:{offerFields:fields}),bookmakerOffers:(match.bookmakerOffers??[]).map(offer=>Object.entries(offer).flatMap(([key,value])=>[indexes.get(key),value]))};
}
export function decodeWorkerMatches(body) {
 if(!Array.isArray(body.matches))return [];
 if(body.format!==2)return body.matches;
 return body.matches.map(match=>{
  const {offerFields:localFields,...row}=match,offerFields=body.offerFields??localFields;
  if(!Array.isArray(offerFields)||offerFields.length>2000||!offerFields.every(k=>typeof k==='string'&&k.length<120)||!Array.isArray(row.bookmakerOffers))throw new Error('WORKER_FORMAT');
  return {...row,bookmakerOffers:row.bookmakerOffers.map(values=>{
   if(!Array.isArray(values)||values.length%2||values.length>offerFields.length*2)throw new Error('WORKER_FORMAT');
   const entries=[],seen=new Set();
   for(let i=0;i<values.length;i+=2){const index=values[i];if(!Number.isInteger(index)||index<0||index>=offerFields.length||seen.has(index))throw new Error('WORKER_FORMAT');seen.add(index);entries.push([offerFields[index],values[i+1]]);}
   return Object.fromEntries(entries);
  })};
 });
}
