// BET-310 : rappel du défi, sans cote ni donnée privée dans le message.
import {dayInZone} from './daily-picks.js';
import {localMinute,quietAt} from './notification-model.js';
export function planChallengeReminder(snapshot,prefs,now=Date.now()){
 if(!prefs?.enabled||!prefs.daily_challenge_reminder||!prefs.daily_challenge_consent_at||!Number.isFinite(Date.parse(prefs.daily_challenge_consent_at))||Date.parse(prefs.daily_challenge_consent_at)>now||prefs.essential||quietAt(now,prefs))return null;
 const minute=localMinute(now,prefs.timezone);if(minute<600||minute>=615)return null;
 const challenge=snapshot?.challenge,day=dayInZone(now,'Europe/Paris');if(challenge?.day!==day||!Array.isArray(challenge.picks))return null;
 const played=new Set(snapshot.played??[]),remaining=challenge.picks.filter(p=>p.matchId&&!played.has(p.matchId)&&Number.isFinite(Date.parse(p.kickoff))&&Date.parse(p.kickoff)>now);if(!remaining.length)return null;
 const windowEnd=now+(615-minute)*60000-new Date(now).getUTCSeconds()*1000-new Date(now).getUTCMilliseconds(),expires=Math.min(windowEnd,Math.max(...remaining.map(p=>Date.parse(p.kickoff))));
 return {web:true,daily_challenge_reminder:true,challenge_day:day,date:dayInZone(now,prefs.timezone),timezone:prefs.timezone,kickoff:new Date(expires).toISOString(),expires_at:new Date(expires).toISOString()};
}
export function challengeReminderCurrent(event,snapshot,prefs,now=Date.now()){
 if(event?.daily_challenge_reminder!==true||!Number.isFinite(Date.parse(event.expires_at))||Date.parse(event.expires_at)<=now)return null;
 const current=planChallengeReminder(snapshot,prefs,now);return current&&event.challenge_day===current.challenge_day&&event.date===current.date&&event.timezone===current.timezone?current:null;
}
