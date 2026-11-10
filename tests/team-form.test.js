import test from 'node:test';
import assert from 'node:assert/strict';
import { teamForm, teamFormMarkup } from '../src/matches/team-form.js';
test('la forme garde adversaires, scores et ordre des cinq derniers matchs sans inventer de résultat', () => {
  const history = Array.from({ length: 7 }, (_, i) => ({
    utcDate: `2026-11-0${i + 1}T12:00:00Z`,
    homeTeam: { name: 'Paris SG' },
    awayTeam: { name: 'Lyon' },
    score: { fullTime: { home: i % 2, away: 0 } }
  }));
  const s = teamForm('Paris SG', history);
  assert.equal(s.sample, 6);
  assert.equal(s.recent.length, 5);
  assert.equal(s.recent[0].opponent, 'Lyon');
  assert.equal(s.recent[0].result, 'N');
  assert.match(teamFormMarkup(s, 'Paris SG'), /Lyon/);
  assert.equal((teamFormMarkup(s, 'Paris SG').match(/data-form-info=/g) || []).length, 5);
  assert.equal(
    teamForm('Paris SG', [{ ...history[0], score: { fullTime: { home: null, away: null } } }])
      .sample,
    0
  );
});
