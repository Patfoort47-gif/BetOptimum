// BET-133 : journées hebdomadaires, lundi 00 h à lundi 00 h en heure de Paris.
import {weekKey} from './model.js';
export const addDays=(day,count)=>new Date(Date.parse(day+'T12:00:00Z')+count*864e5).toISOString().slice(0,10);
export function parisMidnight(day){const noon=new Date(day+'T12:00:00Z'),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(noon));return Date.parse(day+'T00:00:00Z')-(hour-12)*36e5;}
export const roundEnd=date=>parisMidnight(addDays(weekKey(date),7));
export const roundLabel=date=>{const start=weekKey(date);return `Journée du ${start} au ${addDays(start,6)}`;};
