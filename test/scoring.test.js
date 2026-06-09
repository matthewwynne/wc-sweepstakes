import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAll, teamPts } from '../lib/scoring.js';

// France (index 0) & Iraq (index 2) are both in Group I per teams.js GROUPS;
// PAIRS[2]=[0,2] → match id "I-0-2".
test('pool win/draw points derive from scorelines', () => {
  const d = deriveAll({ pool: { 'I-0-2': [2,0] }, ko: [] });
  assert.equal(d['France'].w, 1);
  assert.equal(d['Iraq'].l, 1);
  assert.equal(teamPts(d['France']), 3); // one win
  assert.equal(teamPts(d['Iraq']), 0);
});

test('knockout bonuses are cumulative and winner advances', () => {
  // France beats Iraq in the R32 -> France reached r16 (advanced), Iraq reached r32.
  const d = deriveAll({ pool: {}, ko: [{ round:'r32', a:'France', b:'Iraq', as:1, bs:0, pen:null }] });
  assert.equal(d['Iraq'].reach, 1);   // r32
  assert.equal(d['France'].reach, 2); // advanced to r16
  assert.equal(teamPts(d['Iraq']), 3);          // r32 bonus
  assert.equal(teamPts(d['France']), 3 + 5);    // r32 + r16
});

test('champion banks 115 in knockout bonuses', () => {
  const d = deriveAll({ pool:{}, ko:[{ round:'final', a:'France', b:'Spain', as:2, bs:1, pen:null }] });
  assert.equal(teamPts(d['France']), 3+5+12+20+30+45); // 115
  assert.equal(teamPts(d['Spain']), 3+5+12+20+30);     // reached final, not champ
});

test('penalty winner advances when drawn', () => {
  const d = deriveAll({ pool:{}, ko:[{ round:'r32', a:'France', b:'Iraq', as:1, bs:1, pen:'Iraq' }] });
  assert.equal(d['Iraq'].reach, 2);
  assert.equal(d['France'].reach, 1);
});
