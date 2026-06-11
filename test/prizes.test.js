import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prizes, ENTRY, SPLIT } from '../lib/prizes.js';

test('entry fee is R250', () => {
  assert.equal(ENTRY, 250);
});

test('24 players reproduces the original split', () => {
  assert.deepEqual(prizes(24),
    { players: 24, pot: 6000, first: 3000, second: 1500, third: 900, wildcard: 600 });
});

test('20 players scales cleanly', () => {
  assert.deepEqual(prizes(20),
    { players: 20, pot: 5000, first: 2500, second: 1250, third: 750, wildcard: 500 });
});

test('odd counts round each prize to the nearest rand', () => {
  // pot 5750 -> 2875 / 1437.5->1438 / 862.5->863 / 575
  assert.deepEqual(prizes(23),
    { players: 23, pot: 5750, first: 2875, second: 1438, third: 863, wildcard: 575 });
});

test('zero players yields a zero pot, no NaN', () => {
  assert.deepEqual(prizes(0),
    { players: 0, pot: 0, first: 0, second: 0, third: 0, wildcard: 0 });
});

test('SPLIT keeps the original percentages and sums to 100%', () => {
  assert.deepEqual(SPLIT, { first: 0.50, second: 0.25, third: 0.15, wildcard: 0.10 });
  assert.equal(SPLIT.first + SPLIT.second + SPLIT.third + SPLIT.wildcard, 1);
});

test('negative or garbage input is floored to zero', () => {
  assert.deepEqual(prizes(-5), prizes(0));
});
