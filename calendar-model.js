// Ordre de présentation uniquement : ne change ni les pronostics ni les filtres.
export function orderCalendar(matches,{spotlight,favorite,isLive,kickoff}){const group=m=>m.id===spotlight?0:favorite(m)?1:m.completed||m.voided?4:isLive(m)?2:3;return [...matches].sort((a,b)=>group(a)-group(b)||kickoff(a)-kickoff(b));}
