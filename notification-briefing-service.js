// BET-98 : données privées lues uniquement côté serveur, juste avant livraison.
import { buildBriefing, localDate } from './notification-briefing.js';
export async function prepareBriefing(db,userId,event,prefs,matches,generatedAt,now=Date.now()) {
  if(!event.briefing||!prefs?.enabled||!prefs.channels?.includes('email')||event.date!==localDate(now,prefs.timezone)||Date.parse(event.kickoff)<=now)return null;
  const kinds=event.kinds.filter(k=>k==='daily'?prefs.daily_briefing:k==='favorites'&&prefs.favorite_briefing);
  if(!kinds.length)return null;
  const snapshot=await db('rpc/notification_briefing_snapshot','POST',{p_user:userId});
  return buildBriefing(matches,prefs,{...event,kinds},snapshot.account,snapshot.bets,now,generatedAt);
}
