import test from 'node:test';
import assert from 'node:assert/strict';
import { profileFrame, PROFILE_FRAMES } from '../profile-appearance.js';
import { avatarMarkup } from '../avatar-view.js';
test('les cadres sont gratuits, limités aux identifiants connus et ne permettent aucune injection', () => {
  for (const [id] of PROFILE_FRAMES) assert.equal(profileFrame(id), id);
  assert.equal(profileFrame('" onload="alert(1)'), 'none');
  assert.match(avatarMarkup({ profile_frame: 'gold' }), /profile-frame-gold/);
  assert.doesNotMatch(avatarMarkup({ profile_frame: '" onload="alert(1)' }), /onload/);
});
