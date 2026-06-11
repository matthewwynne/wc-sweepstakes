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

test('20 players keeps only the top-20 of each tier', () => {
  const asg = computeAssignments('seed-1', NAMES.slice(0, 20));
  assert.equal(asg.length, 20);
  // strong ranks 1..20 only; weak ranks 25..44 only.
  assert.ok(asg.every(a => a.strong[2] >= 1 && a.strong[2] <= 20));
  assert.ok(asg.every(a => a.weak[2] >= 25 && a.weak[2] <= 44));
  // every player still gets exactly one strong + one weak, all distinct.
  assert.equal(new Set(asg.map(a => a.strong[0])).size, 20);
  assert.equal(new Set(asg.map(a => a.weak[0])).size, 20);
});

test('trimmed draw stays reproducible for a seed', () => {
  const a = computeAssignments('seed-7', NAMES.slice(0, 18));
  const b = computeAssignments('seed-7', NAMES.slice(0, 18));
  assert.deepEqual(a, b);
});

test('24 players still uses all 48 teams', () => {
  const asg = computeAssignments('seed-1', NAMES);
  assert.equal(new Set(asg.map(a => a.strong[2])).size, 24); // ranks 1..24
  assert.equal(new Set(asg.map(a => a.weak[2])).size, 24);   // ranks 25..48
});
