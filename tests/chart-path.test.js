import test from 'node:test';
import assert from 'node:assert/strict';
import { smoothChartPath } from '../src/core/chart-path.js';

test('le lissage conserve les mesures et borne chaque segment, y compris les valeurs plates', () => {
  assert.equal(smoothChartPath([]), '');
  assert.equal(smoothChartPath([[0, 2]]), 'M0,2');
  assert.equal(
    smoothChartPath([
      [0, 20],
      [10, 0],
      [20, 0],
      [30, 15]
    ]),
    'M0,20 C4,20 6,0 10,0 C14,0 16,0 20,0 C24,0 26,15 30,15'
  );
});
