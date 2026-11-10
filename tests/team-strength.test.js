import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTeamStrength, TEAM_STRENGTH_ACTIVE } from '../src/model/team-strength.js';
test('Elo isolé : identité ESPN, victoire augmente la force et conservation du total des buts', () => {
  const model = createTeamStrength(),
    m = { homeId: '1', awayId: '2' };
  const before = model.predict(m);
  assert.equal(TEAM_STRENGTH_ACTIVE, false);
  assert.equal(model.observe(m, 2, 0), true);
  const after = model.predict(m);
  assert(after.homeGoals > before.homeGoals);
  assert(Math.abs(after.homeGoals + after.awayGoals - 2.6) < 1e-10);
  assert.equal(model.predict({}), null);
  assert.equal(model.observe(m, NaN, 0), false);
  assert.deepEqual(createTeamStrength().predict(m), before);
});
