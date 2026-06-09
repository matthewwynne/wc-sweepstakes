import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, mulberry32, computeAssignments } from '../lib/draw.js';

const NAMES = Array.from({length:24}, (_,i) => 'P'+(i+1));

test('hashSeed is deterministic', () => {
  assert.equal(hashSeed('opening-day'), hashSeed('opening-day'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('computeAssignments is reproducible for a seed', () => {
  const a = computeAssignments('seed-1', NAMES);
  const b = computeAssignments('seed-1', NAMES);
  assert.deepEqual(a, b);
});

test('different seeds give different draws', () => {
  const a = computeAssignments('seed-1', NAMES);
  const b = computeAssignments('seed-2', NAMES);
  assert.notDeepEqual(a, b);
});

test('every player gets one strong + one weak team', () => {
  const asg = computeAssignments('seed-1', NAMES);
  assert.equal(asg.length, 24);
  const strong = new Set(asg.map(a => a.strong[0]));
  const weak = new Set(asg.map(a => a.weak[0]));
  assert.equal(strong.size, 24);
  assert.equal(weak.size, 24);
  assert.ok(asg.every(a => a.strong[2] >= 1 && a.strong[2] <= 24));
  assert.ok(asg.every(a => a.weak[2] >= 25 && a.weak[2] <= 48));
  assert.equal(asg[0].player, 'P1');
});

test('fewer than 24 players assigns only that many', () => {
  const asg = computeAssignments('seed-1', NAMES.slice(0,10));
  assert.equal(asg.length, 10);
});
