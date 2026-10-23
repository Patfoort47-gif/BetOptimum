import test from 'node:test';
import assert from 'node:assert/strict';
import { detectAlerts, quietAt, nextAllowed } from './notification-model.js';
const now = Date.parse('2026-10-23T12:00:00Z');
const prefs = { enabled: true, channels: ['web'], teams: ['Rennes'], leagues: [], min_value: .01, min_confidence: .1, quiet_start: 1320, quiet_end: 480, timezone: 'Europe/Paris' };
const plan = { max_favorites: 5, odds_step: .1 };
const match = { id: 'm', home: 'Rennes', away: 'Paris', league: 'Ligue 1', kickoff: '2026-10-24T18:00:00Z', homeGoals: 1.5, awayGoals: 1, odds: { home: 5, draw: 5, away: 5, over: 5, btts: 5 }, bookmakerOffers: [{ name: 'Réel', home: 5 }] };
test('la détection exige consentement, favori, cote fournisseur et seuils', () => {
  const events = detectAlerts([match], prefs, plan, now); assert.equal(events.length, 1); assert.equal(events[0].bookmaker, 'Réel');
  for (const change of [{enabled:false},{teams:[]},{min_confidence:1},{min_value:100}]) assert.deepEqual(detectAlerts([match], {...prefs,...change}, plan, now), []);
  for (const change of [{bookmakerOffers:[]},{completed:true},{kickoff:'2026-10-22T10:00:00Z'},{bookmakerOffers:[{home:5,homeCached:true}]}]) assert.deepEqual(detectAlerts([{...match,...change}],prefs,plan,now), []);
  assert.deepEqual(detectAlerts([match],prefs,{...plan,max_favorites:0},now), []);
});
test('dédoublonnage stable par palier, puis nouveau palier de cote', () => {
  const a=detectAlerts([match],prefs,plan,now)[0]; assert.equal(a.key,detectAlerts([match],prefs,plan,now+1000)[0].key);
  assert.notEqual(a.key,detectAlerts([{...match,bookmakerOffers:[{home:7}]}],prefs,plan,now)[0].key);
});
test('heures silencieuses traversant minuit, changement d’heure et coup d’envoi', () => {
  const late=Date.parse('2026-10-24T22:00:00Z'); assert.ok(quietAt(late,prefs));
  const due=nextAllowed(late,prefs); assert.equal(new Date(due).toISOString(),'2026-10-25T07:00:00.000Z');
  assert.ok(!quietAt(due,prefs)); assert.equal(nextAllowed(now,prefs),now);
  const day={...prefs,quiet_start:600,quiet_end:900};assert.ok(quietAt(now,day));
  assert.deepEqual(detectAlerts([{...match,kickoff:'2026-10-25T06:00:00Z'}],prefs,plan,late),[]);
});
