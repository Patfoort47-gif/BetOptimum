import test from 'node:test';
import assert from 'node:assert/strict';
import { leagueAccessError, createLeagueJoiner } from './league-access.js';
test('BET-92 : distingue limite ancienne, mise en service, refus métier et session expirée', () => {
  assert.equal(leagueAccessError({ message: 'LIGUES_MAX' }).code, 'LIGUES_MAX');
  assert.match(leagueAccessError({ message: 'LIGUES_MAX' }).message, /ancienne limite/);
  for (const code of ['PGRST202', 'PGRST205', '42P01', '42883', '42501']) assert.equal(leagueAccessError({ code }).code, 'LEAGUE_SETUP_REQUIRED');
  assert.equal(leagueAccessError({ message: 'SOLDE_INSUFFISANT' }).code, 'SOLDE_INSUFFISANT');
  assert.equal(leagueAccessError({ code: 'PGRST301' }).code, 'AUTH_REQUIRED');
});
const membership = (data, error = null) => ({ select() { return this; }, eq(name, value) { (this.filters ??= {})[name] = value; return this; }, async maybeSingle() { return { data, error }; } });
test('BET-92 : double clic, une seule requête ; un nouvel essai reste possible après la réponse', async () => {
  let count = 0, resolve;
  const join = createLeagueJoiner({ rpc: () => { count++; return new Promise(done => resolve = done); } }, () => 'user-a');
  const first = join('l1'), second = join('l1');
  assert.equal(first, second); assert.equal(count, 1);
  resolve({ data: { joined: true } }); await first;
  const third = join('l1'); assert.equal(count, 2); resolve({ data: { joined: true } }); await third;
});
test('BET-92 : réponse réseau perdue ou conflit, vérifier sa propre adhésion avant de signaler un échec', async () => {
  const query = membership({ league_id: 'l1' });
  const join = createLeagueJoiner({ rpc: async () => ({ error: { code: '23505' } }), from: name => { assert.equal(name, 'league_members'); return query; } }, () => 'user-a');
  assert.deepEqual(await join('l1'), { joined: true });
  assert.deepEqual(query.filters, { user_id: 'user-a', league_id: 'l1' });
});
test('BET-92 : refus ou indisponibilité ne simule pas une inscription réussie', async () => {
  const join = createLeagueJoiner({ rpc: async () => ({ error: { message: 'LIGUE_FERMEE' } }), from: () => membership(null) }, () => 'user-a');
  await assert.rejects(() => join('l1'), { code: 'LIGUE_FERMEE' });
  const offline = createLeagueJoiner({ rpc: async () => { throw new Error('Failed to fetch'); }, from: () => { throw new Error('offline'); } }, () => 'user-a');
  await assert.rejects(() => offline('l1'), { code: 'LEAGUE_UNAVAILABLE' });
  await assert.rejects(() => createLeagueJoiner({}, () => null)('l1'), { code: 'AUTH_REQUIRED' });
});

test('BET-92 : un refus SQL structuré ne doit pas être présenté comme une coupure réseau',()=>{
  const error=leagueAccessError({code:'42702',message:'column reference is ambiguous',status:400});
  assert.equal(error.code,'LEAGUE_SERVER_ERROR');assert.match(error.message,/Référence : 42702/);assert.doesNotMatch(error.message,/connexion/);
  assert.equal(leagueAccessError({message:'Failed to fetch'}).code,'LEAGUE_UNAVAILABLE');
});
