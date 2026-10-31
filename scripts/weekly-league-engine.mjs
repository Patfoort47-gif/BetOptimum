// BET-133 : les périodes clôturées sont persistées atomiquement côté serveur.
import {roundEnd} from '../league-round.js';
import {weekKey} from '../model.js';
import {seasonKey} from '../league.js';
import {planClosure} from './league-engine.mjs';
export async function closeWeeklyRounds(admin,now=new Date()) {
 const current=weekKey(now),rounds=await admin.select('league_rounds',`closed_at=is.null&week_start=lt.${current}&order=week_start.asc`);
 let closed=0;
 for(const round of rounds){
  const [players,standings,groups,members]=await Promise.all([
   admin.selectAll('player_league','select=user_id,echelon,joined_at,protected,inactive'),
   admin.rpc('league_round_standings',{p_week:round.week_start}),
   admin.selectAll('league_groups',`season=eq.${seasonKey(now)}&select=id,label`),
   admin.selectAll('group_members',`season=eq.${seasonKey(now)}&select=user_id,group_id`)
  ]);
  // Une absence prolongée ne doit pas coûter un échelon chaque semaine.
  const active=new Set(standings.filter(row=>Number(row.picks)>0).map(row=>row.user_id));
  const eligible=players.filter(p=>new Date(p.joined_at).getTime()<roundEnd(round.week_start+'T12:00:00Z')&&(!p.inactive||active.has(p.user_id)));
  // Une journée sans aucun résultat ne fait évoluer personne.
  const plan=active.size?planClosure({season:round.season,players:eligible,standings,groups,groupMembers:members,weekendPoints:Object.fromEntries(standings.map(row=>[row.user_id,Number(row.weekend_points??0)]))}):{results:[],groups:[]};
  if(await admin.rpc('apply_league_round',{p_week:round.week_start,p_results:plan.results,p_groups:plan.groups}))closed++;
 }
 // Pas de rattrapage rétroactif des semaines antérieures à l'activation.
 await admin.insertIgnore('league_rounds',[{week_start:current,season:seasonKey(now)}],'week_start');
 return closed;
}
