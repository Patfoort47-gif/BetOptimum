import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLiveSnapshot } from '../live.js';
import { initDetails } from '../details.js';
test('la fiche remplace l’heure par le score issu des statistiques, puis suit le score et la fin du match', async () => {
  const saved = Object.fromEntries(
    ['document', 'history', 'addEventListener', 'fetch', 'setInterval', 'clearInterval'].map(
      (k) => [k, globalThis[k]]
    )
  );
  const nodes = new Map(),
    node = (key) => {
      if (!nodes.has(key))
        nodes.set(key, {
          innerHTML: '',
          dataset: {},
          style: { removeProperty() {} },
          addEventListener() {},
          insertAdjacentHTML(_where, value) {
            this.innerHTML = value + this.innerHTML;
          },
          showModal() {
            this.open = true;
          }
        });
      return nodes.get(key);
    };
  const state = { live: {}, liveErrors: {}, results: [] },
    match = {
      id: 'espn-42',
      home: 'A',
      away: 'B',
      homeId: '1',
      awayId: '2',
      time: '20:00',
      league: 'Ligue 2',
      kickoff: new Date(Date.now() - 3600000).toISOString()
    };
  let timer, api;
  try {
    globalThis.document = {
      querySelector: node,
      documentElement: { classList: { contains: () => false } }
    };
    globalThis.history = { pushState() {} };
    globalThis.addEventListener = () => {};
    globalThis.setInterval = (callback) => {
      timer = callback;
      return 1;
    };
    globalThis.clearInterval = () => {};
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({
        header: {
          id: '42',
          competitions: [
            {
              status: { displayClock: "54'", type: { state: 'in' } },
              competitors: [
                { homeAway: 'home', score: '2' },
                { homeAway: 'away', score: '1' }
              ]
            }
          ]
        },
        boxscore: {
          teams: [
            { team: { id: '1' }, statistics: [{ name: 'possessionPct', value: 60 }] },
            { team: { id: '2' }, statistics: [{ name: 'possessionPct', value: 40 }] }
          ]
        }
      })
    });
    api = initDetails({
      state,
      allMatches: () => [match],
      LEAGUES: { 'Ligue 2': [96, 18, 'league', 1, 'fra.2'] },
      kickoffAt: (m) => new Date(m.kickoff),
      isLive: (m) => !m.completed && state.live[m.id]?.state === 'in',
      logoTag: () => '',
      leagueLogoUrl: () => '',
      toast() {},
      onLiveEntry: (m, entry) => {
        applyLiveSnapshot(state, m, entry);
        api.refreshLive();
      }
    });
    api.openMatch(match);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(node('#detail-head').innerHTML, /2 : 1/);
    assert.match(node('#detail-head').innerHTML, /En direct/);
    assert.doesNotMatch(node('#detail-head').innerHTML, /<strong>20:00<\/strong>/);
    assert.match(node('#detail-body').innerHTML, /Possession/);
    assert.equal(typeof timer, 'function');
    applyLiveSnapshot(state, match, {
      ...state.live[match.id],
      home: 3,
      updatedAt: Date.now() + 1
    });
    api.refreshLive();
    assert.match(node('#detail-head').innerHTML, /3 : 1/);
    applyLiveSnapshot(state, match, {
      ...state.live[match.id],
      completed: true,
      state: 'post',
      updatedAt: Date.now() + 2
    });
    api.refreshLive();
    assert.match(node('#detail-head').innerHTML, /3 : 1/);
    assert.match(node('#detail-head').innerHTML, /Terminé/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  }
});
