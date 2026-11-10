import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decimal } from '../number-format.js';
test('format français des cotes, points, pourcentages et ROI', () => {
  assert.equal(decimal(2.01), '2,01');
  assert.equal(decimal(59.4, 1), '59,4');
  assert.equal(decimal(5.2, 1), '5,2');
  assert.equal(decimal(-12.34, 1), '-12,3');
  assert.equal(decimal(2), '2,00');
  assert.equal(decimal(1234.5, 1), '1234,5');
  assert.equal(decimal('1.75'), '1,75');
  for (const value of [null, undefined, NaN, Infinity, '']) assert.equal(decimal(value), '-');
});
