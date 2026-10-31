// Ordre de présentation uniquement : ne change ni les pronostics ni les filtres.
export function orderCalendar(matches,{spotlight,favorite,isLive,kickoff}){const group=m=>m.id===spotlight?0:favorite(m)?1:m.completed||m.voided?4:isLive(m)?2:3;return [...matches].sort((a,b)=>group(a)-group(b)||kickoff(a)-kickoff(b));}
export function byConfidence(items,probability=x=>x.probability){return [...items].sort((a,b)=>{const av=probability(a),bv=probability(b);return (Number.isFinite(bv)?bv:-Infinity)-(Number.isFinite(av)?av:-Infinity);});}
