import test from 'node:test';
import assert from 'node:assert/strict';
import { sparkline } from '../src/core/sparkline.js';
test('sparkline : vide, un point, courbe plate et directions accessibles', () => {
  for (const values of [[], [12], [NaN]]) {
    const output = sparkline(values);
    assert.match(output, /données insuffisantes/);
    assert.match(output, /var\(--muted\)/);
    assert.doesNotMatch(output, /NaN|Infinity/);
  }
  assert.match(sparkline([10, 5]), /en baisse/);
  assert.match(sparkline([10, 5]), /var\(--danger\)/);
  assert.match(sparkline([5, 10]), /en hausse/);
  assert.match(sparkline([5, 5]), /stable/);
  assert.match(sparkline([5, 5]), /2,20 118,20/);
});
