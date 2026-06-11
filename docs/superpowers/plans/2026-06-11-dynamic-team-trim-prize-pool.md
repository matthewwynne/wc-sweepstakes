# Dynamic Team-Trimming & Scaled Prize Pool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the draw runs with fewer than 24 players, trim the lowest-ranked teams per tier so every player still gets 1 strong + 1 wildcard, and scale the prize pool/headline numbers to the real player count.

**Architecture:** Three pure changes plus DOM wiring. `computeAssignments` slices the top-`n` ranked teams from each already-rank-ordered tier before shuffling. A new pure `lib/prizes.js` is the single source of truth for pot/splits. `runDraw` relaxes its 24-only gate and blocks >24. `app.js` feeds the live player count into both the leaderboard prize labels and the (newly id-tagged) header + prize-split card in `index.html`.

**Tech Stack:** Node 24 ESM, `node --test` (built-in runner, tests in `test/`), vanilla browser JS modules, Neon serverless Postgres.

**Spec:** `docs/superpowers/specs/2026-06-11-dynamic-team-trim-prize-pool-design.md`

## Context

The sweepstake is hardcoded for 24 players / 48 teams. With fewer players, the draw drops *random* teams (it shuffles all 48 and takes the first `n` of each tier) instead of the weakest, and the R6 000 pot / R3 000-R1 500-R900-R600 split stay fixed. This change makes both responsive to the actual roster: keep the best `n` of each tier, and scale the money proportionally (rounded to nearest rand, banker keeps the remainder). Decisions are locked in the spec — balanced-by-tier trim, proportional split, block >24 players, dynamic header.

## File Structure

- **Create** `lib/prizes.js` — pure pot/split calculator (`ENTRY`, `SPLIT`, `prizes(n)`).
- **Create** `test/prizes.test.js` — unit tests for `prizes()`.
- **Modify** `lib/draw.js` — `computeAssignments` trims to top-`n` per tier.
- **Modify** `test/draw.test.js` — add trim-by-rank assertions.
- **Modify** `lib/db.js` — `runDraw` guard: allow 2–24, block >24.
- **Modify** `api/admin/draw.js` — map new error codes to messages.
- **Modify** `index.html` — add ids to header pot row + prize-split card amounts.
- **Modify** `app.js` — import `prizes`, render money into leaderboard + header + card.

---

### Task 1: `lib/prizes.js` — pure prize calculator

**Files:**
- Create: `lib/prizes.js`
- Test: `test/prizes.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/prizes.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prizes, ENTRY } from '../lib/prizes.js';

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/prizes.test.js`
Expected: FAIL — `Cannot find module '.../lib/prizes.js'`.

- [ ] **Step 3: Write the implementation**

Create `lib/prizes.js`:

```js
// Single source of truth for the money. Pure + deterministic so the browser
// and any future server code agree. Pot = players * entry; the split keeps the
// original percentages, each prize rounded to the nearest rand (the banker
// holds the small rounding remainder).
export const ENTRY = 250;
export const SPLIT = { first: 0.50, second: 0.25, third: 0.15, wildcard: 0.10 };

export function prizes(playerCount){
  const n = Math.max(0, playerCount | 0);
  const pot = n * ENTRY;
  const r = pct => Math.round(pot * pct);
  return {
    players: n, pot,
    first: r(SPLIT.first), second: r(SPLIT.second),
    third: r(SPLIT.third), wildcard: r(SPLIT.wildcard)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/prizes.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/prizes.js test/prizes.test.js
git commit -m "feat: add pure prize-pool calculator (scales with player count)"
```

---

### Task 2: `computeAssignments` trims lowest-ranked teams per tier

**Files:**
- Modify: `lib/draw.js:35-45`
- Test: `test/draw.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `test/draw.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `node --test test/draw.test.js`
Expected: the "20 players keeps only the top-20" test FAILS — current code shuffles the full tier, so weak ranks 45–48 can appear. (The other two may already pass.)

- [ ] **Step 3: Update the implementation**

In `lib/draw.js`, replace the body of `computeAssignments` (lines 35–45) with:

```js
export function computeAssignments(seed, playerNames){
  const rng = mulberry32(hashSeed(seed));
  const n = Math.min(playerNames.length, 24);
  // STRONG and WEAK are already ordered best-first, so slicing the top-n is
  // "remove the lowest-ranked teams until each player gets exactly 2".
  // shuffle(STRONG slice) is consumed before shuffle(WEAK slice) — do not
  // reorder; it affects the deterministic output that verification relies on.
  const s = shuffle(STRONG.slice(0, n), rng);
  const w = shuffle(WEAK.slice(0, n), rng);
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ player: playerNames[i], strong: s[i], weak: w[i] });
  }
  return out;
}
```

- [ ] **Step 4: Run the full draw suite**

Run: `node --test test/draw.test.js`
Expected: PASS (all 8 tests). Note `n=24` output is unchanged (slice is a no-op), so existing tests still hold.

- [ ] **Step 5: Commit**

```bash
git add lib/draw.js test/draw.test.js
git commit -m "feat: draw trims lowest-ranked teams per tier when players < 24"
```

---

### Task 3: `runDraw` guard — allow 2–24 players, block >24

**Files:**
- Modify: `lib/db.js:81-91`
- Modify: `api/admin/draw.js:11`

No unit test: `runDraw` calls Neon. Verified by code review + the Task 5 manual check.

- [ ] **Step 1: Update the guard in `lib/db.js`**

Replace line 84 (`if (!force && names.length !== 24) return { error: 'need24', count: names.length };`) with:

```js
  const n = names.length;
  // Hard cap: only 48 teams exist, so 24 players is the ceiling regardless of force.
  if (n > 24) return { error: 'tooManyPlayers', count: n };
  // Below 24 is fine; force still lets an admin draw a tiny test roster (< 2).
  if (!force && n < 2) return { error: 'tooFewPlayers', count: n };
```

(The rest of `runDraw` — `computeAssignments`, the atomic compare-and-set lock, the `RETURNING` race check — is unchanged.)

- [ ] **Step 2: Map the new errors in `api/admin/draw.js`**

Replace line 11 (`if (r.error === 'need24') ...`) with:

```js
  if (r.error === 'tooManyPlayers')
    return res.status(400).json({ error: 'too_many_players', count: r.count });
  if (r.error === 'tooFewPlayers')
    return res.status(400).json({ error: 'too_few_players', count: r.count });
```

- [ ] **Step 3: Verify nothing else references the old code**

Run: `grep -rn "need24\|need_24_players" --include=*.js .`
Expected: no matches (the old admin UI message, if any, should be checked in `app.js` — update or remove any user-facing "need 24" text found).

- [ ] **Step 4: Commit**

```bash
git add lib/db.js api/admin/draw.js
git commit -m "feat: allow draws of 2-24 players, block over-24"
```

---

### Task 4: Render scaled money in `app.js` + tag `index.html`

**Files:**
- Modify: `index.html:165-170` (header pot row), `index.html:328-336` (prize-split card)
- Modify: `app.js:4-6` (import), `app.js:296-320` (`renderBoard`), `app.js:75-87` (`renderAll`)

No automated test (DOM rendering). Verified by Task 5 manual check.

- [ ] **Step 1: Add ids to the header pot row in `index.html`**

Replace the `.potrow` block (lines 165–170) with — same markup, ids added, "Teams" value now derives from players so leave it for JS:

```html
    <div class="potrow">
      <div class="stat"><div class="k">Players</div><div class="v" id="potPlayers">24</div></div>
      <div class="stat"><div class="k">Entry</div><div class="v">R250</div></div>
      <div class="stat"><div class="k">Total pot</div><div class="v g" id="potTotal">R6 000</div></div>
      <div class="stat"><div class="k">Teams</div><div class="v y" id="potTeams">48</div></div>
    </div>
```

- [ ] **Step 2: Add ids to the prize-split card in `index.html`**

In the card at lines 328–336, add ids to the heading and the four amounts:

```html
      <h2 id="prizeHeading">Prize split &mdash; R6 000 pot</h2>
```
```html
        <div class="prizebox p1"><div class="pos">1st overall</div><div class="amt" id="prize1">R3 000</div></div>
        <div class="prizebox"><div class="pos">2nd overall</div><div class="amt" id="prize2">R1 500</div></div>
        <div class="prizebox"><div class="pos">3rd overall</div><div class="amt" id="prize3">R900</div></div>
        <div class="prizebox wild"><div class="pos">Best wildcard team</div><div class="amt" id="prizeW">R600</div></div>
```

- [ ] **Step 3: Import `prizes` and add helpers in `app.js`**

Add to the import block (after line 6):

```js
import { prizes } from '/lib/prizes.js';
```

Add near the other top-level helpers (after line 14):

```js
// "R5 750" style — space thousands separator to match the static markup.
const rand = n => 'R' + Math.round(n).toLocaleString('en-US').replace(/,/g, ' ');
// Effective player count: the locked draw size once drawn, else the live roster.
function playerCount() {
  return STATE.locked && STATE.assignments ? STATE.assignments.length : (STATE.players ? STATE.players.length : 0);
}
// Paint the header pot row + prize-split card from the current player count.
function renderMoney() {
  const p = prizes(playerCount());
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set('potPlayers', String(p.players));
  set('potTotal', rand(p.pot));
  set('potTeams', String(p.players * 2));
  set('prizeHeading', 'Prize split — ' + rand(p.pot) + ' pot');
  set('prize1', rand(p.first));
  set('prize2', rand(p.second));
  set('prize3', rand(p.third));
  set('prizeW', rand(p.wildcard));
}
```

- [ ] **Step 4: Call `renderMoney()` from `renderAll`**

In `renderAll` (line 75), add `renderMoney();` as the first line inside the function so the header/card update in every phase:

```js
function renderAll() {
  renderMoney();
  document.body.classList.toggle('admin', isAdmin());
  // ...unchanged...
```

- [ ] **Step 5: Use scaled prizes in the leaderboard (`renderBoard`)**

In `renderBoard` (lines 305–313), compute the split once and use it for the labels. Replace:

```js
  const rows = leaderboardRows(assignments, d);
  let bestWild = -1; rows.forEach(r => { if (r.wp > bestWild) bestWild = r.wp; });
```
with:
```js
  const rows = leaderboardRows(assignments, d);
  const pz = prizes(rows.length);
  let bestWild = -1; rows.forEach(r => { if (r.wp > bestWild) bestWild = r.wp; });
```
and replace the hardcoded prize lines (310–313):
```js
    if (pos === 1) prize = '<span class="prize">R3 000</span>';
    else if (pos === 2) prize = '<span class="prize">R1 500</span>';
    else if (pos === 3) prize = '<span class="prize">R900</span>';
    const wild = (r.wp === bestWild && bestWild > 0) ? '<span class="prize wild">R600</span>' : '';
```
with:
```js
    if (pos === 1) prize = '<span class="prize">' + rand(pz.first) + '</span>';
    else if (pos === 2) prize = '<span class="prize">' + rand(pz.second) + '</span>';
    else if (pos === 3) prize = '<span class="prize">' + rand(pz.third) + '</span>';
    const wild = (r.wp === bestWild && bestWild > 0) ? '<span class="prize wild">' + rand(pz.wildcard) + '</span>' : '';
```

- [ ] **Step 6: Manual smoke check (browser)**

Open the app (see Verification). With the default 24-player roster the page must look identical to before: header `24 / R6 000 / 48`, prize card `R3 000 / R1 500 / R900 / R600`. No console errors.

- [ ] **Step 7: Commit**

```bash
git add app.js index.html
git commit -m "feat: scale pot, header and prize labels to live player count"
```

---

## Verification

1. **Unit tests:** `npm test` (runs `node --test`). Expected: all of `test/prizes.test.js`, `test/draw.test.js`, `test/scoring.test.js` PASS.
2. **Draw trim, end-to-end (local):**
   - Serve the app (e.g. `vercel dev`, or the project's usual local command) and open it.
   - As admin, set the roster to **20** players, run the draw with any seed.
   - Confirm: header shows **20 players / R5 000 / 40 teams**; the prize-split card reads **R5 000 pot** with **R2 500 / R1 250 / R750 / R500**; the leaderboard prize labels match.
   - Confirm no team ranked 21–24 (strong) or 45–48 (weak) appears in any assignment.
3. **Over-cap guard:** with 25 players, attempt the draw → API returns `too_many_players`; draw does not lock.
4. **Regression:** reset, set roster back to 24, draw → page matches the original 24-player figures exactly.
5. **Determinism:** re-running the same seed at the same roster size yields the identical assignment (covered by the unit test, spot-check in UI).

## Notes / Out of Scope

- `lib/scoring.js`, `GROUPS`, `ALL_TEAMS`, `PAIRS` unchanged — trimmed teams are simply never owned, so they never enter the leaderboard; "best wildcard" already scans only owned weak teams.
- No schema change; `n` is derived from existing `assignments`/`players` data.
- Marketing copy ("24 players. 48 teams." in the header `<p class="sub">`, `index.html:164`) is static prose; leave as-is unless the reviewer wants it wired up too.
- After approval, also copy this plan to `docs/superpowers/plans/2026-06-11-dynamic-team-trim-prize-pool.md` per the writing-plans convention.
