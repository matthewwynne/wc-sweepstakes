# Reset Keeps Roster + Confirmations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game reset clear the draw and all results while keeping the player roster fully intact — names, confirmations, and payments — and relabel the button to match.

**Architecture:** One behavioural change in `lib/db.js` (`resetGame` drops the statement that wipes player flags), guarded by a small unit test enabled via a pure `resetStatements(sql)` helper. Plus UI copy/label updates in `app.js` and `index.html`. No API or schema change.

**Tech Stack:** Node 24 ESM, `node --test` (tests in `test/`), Neon serverless Postgres (`@neondatabase/serverless`), vanilla browser JS.

**Spec:** `docs/superpowers/specs/2026-06-12-reset-keep-roster-design.md`

## Context

`resetGame()` in `lib/db.js` currently runs four statements in one transaction, one of which is `UPDATE players SET confirmed=false, paid=false`. That forces everyone to re-confirm after a re-draw and falsely marks paid players unpaid. The banker wants a reset that keeps the roster's confirm/paid state. The fix is to drop that one statement; the player *names* were already preserved. We also guard against the regression silently returning, and fix the now-misleading button label/copy.

Note: `lib/db.js` creates its Neon client at module load (`const sql = neon(resolveDbUrl())`), which is why no existing test imports it. The guard test works around this by setting a dummy `DATABASE_URL` before a dynamic import and by testing a pure helper that takes the `sql` tag as a parameter (so it never connects).

## File Structure

- **Modify** `lib/db.js` — extract `resetStatements(sql)` (pure: returns the query array), make `resetGame` call it, drop the `players` update.
- **Create** `test/reset.test.js` — assert the reset batch clears draw + results and never references `players`.
- **Modify** `app.js` — reset handler confirm-dialog copy.
- **Modify** `index.html` — button label text (id unchanged).

---

### Task 1: `resetGame` keeps the roster (with guard test)

**Files:**
- Modify: `lib/db.js` (the `resetGame` function, currently lines 127-135)
- Test: `test/reset.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `test/reset.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

// lib/db.js builds its Neon client at import time from DATABASE_URL, so give it a
// dummy URL (no connection is made until a query runs) and import dynamically.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://u:p@localhost:5432/db';
const { resetStatements } = await import('../lib/db.js');

// A fake `sql` tag that just returns the literal SQL text so we can inspect the batch.
const fakeSql = (strings) => strings.join('');

test('reset clears the draw and all results', () => {
  const joined = resetStatements(fakeSql).join(' | ').toLowerCase();
  assert.ok(joined.includes('delete from pool_results'), 'should clear pool results');
  assert.ok(joined.includes('delete from ko_results'), 'should clear knockout results');
  assert.ok(joined.includes('update game'), 'should clear the game draw/lock');
  assert.ok(joined.includes('locked=false'), 'should unlock the game');
});

test('reset never touches the players table', () => {
  const stmts = resetStatements(fakeSql);
  assert.equal(stmts.length, 3, 'reset should be exactly three statements');
  const joined = stmts.join(' | ').toLowerCase();
  assert.ok(!joined.includes('players'),
    'reset must not modify the players table — names, confirmations and payments are kept');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/reset.test.js`
Expected: FAIL — `resetStatements` is not exported yet (import gives `undefined`, so calling it throws `TypeError: resetStatements is not a function`).

- [ ] **Step 3: Implement**

In `lib/db.js`, replace the current `resetGame`:

```js
export async function resetGame(){
  // Single atomic batch: one round-trip, all-or-nothing.
  await sql.transaction([
    sql`DELETE FROM pool_results`,
    sql`DELETE FROM ko_results`,
    sql`UPDATE players SET confirmed=false, paid=false`,
    sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`
  ]);
}
```

with an extracted, testable statement list and the `players` update removed:

```js
// The reset batch, as a pure function of the `sql` tag so it can be unit-tested
// without a live database. Clears the draw + all results but KEEPS the roster
// intact — names, confirmations and payments — so a re-draw never makes players
// re-confirm or undoes a recorded payment. Use the per-player toggle to drop someone.
export function resetStatements(sql){
  return [
    sql`DELETE FROM pool_results`,
    sql`DELETE FROM ko_results`,
    sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`
  ];
}

export async function resetGame(){
  // Single atomic batch: one round-trip, all-or-nothing.
  await sql.transaction(resetStatements(sql));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/reset.test.js`
Expected: PASS (2 tests). If the import throws a Neon connection-string error, confirm the dummy `DATABASE_URL` line ran before the dynamic import; adjust the dummy URL to a parseable Postgres URL if needed (e.g. `postgres://user:pass@db.example.com/main`).

- [ ] **Step 5: Run the full suite (no regressions)**

Run: `npm test`
Expected: all suites pass (prizes, draw, scoring, reset).

- [ ] **Step 6: Commit**

```bash
git add lib/db.js test/reset.test.js
git commit -m "feat: reset keeps roster confirmations + payments"
```

---

### Task 2: Update button label + confirm copy

**Files:**
- Modify: `index.html` (the `newGameBtn` button, around line 194-206)
- Modify: `app.js` (the `newGameBtn` click handler, around lines 479-484)

No automated test (UI copy). Verify with `node --check app.js` and a read-back.

- [ ] **Step 1: Relabel the button in `index.html`**

Find the button (the visible text is currently "Start a new game"):

```html
<button class="act ghost" id="newGameBtn">Start a new game</button>
```

Change only the text (keep the id and classes):

```html
<button class="act ghost" id="newGameBtn">Reset draw &amp; results</button>
```

(Use `&amp;` for the ampersand in HTML.)

- [ ] **Step 2: Update the confirm copy in `app.js`**

The current handler:

```js
// Admin: start a new game (guarded)
on('newGameBtn', 'click', async () => {
  if (!confirm('Start a new game? This clears the draw and all results.')) return;
  await post('/api/admin/reset', {}, true);
  localStorage.removeItem('sweep:seed');
  await refresh();
});
```

Replace the comment and the confirm message (leave the POST / localStorage / refresh lines unchanged):

```js
// Admin: reset the draw + results, keeping the roster (guarded)
on('newGameBtn', 'click', async () => {
  if (!confirm('Reset the draw and all results? Your players and their confirmations are kept — you can edit the roster before the next draw.')) return;
  await post('/api/admin/reset', {}, true);
  localStorage.removeItem('sweep:seed');
  await refresh();
});
```

- [ ] **Step 3: Syntax-check and read back**

Run: `node --check app.js`
Expected: exit 0, no output.
Then read both edited regions to confirm only the text/comment/confirm-string changed and nothing adjacent was disturbed.

- [ ] **Step 4: Run the full suite (sanity)**

Run: `npm test`
Expected: all pass (unchanged by UI edits).

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "feat: relabel reset button and clarify it keeps the roster"
```

---

## Verification

1. `npm test` — all suites pass, including the new `test/reset.test.js` (the "never touches the players table" guard).
2. Manual end-to-end (local, needs the app + DB): confirm a few players, run the draw, enter a couple of results, click **"Reset draw & results"** → the confirm copy mentions players are kept → after confirming: draw cleared, results cleared, game unlocked (onboarding view returns), and every player still shows their prior **confirmed/paid** state. Editing the roster and running a fresh draw works without re-confirming anyone.
3. Confirm no remaining UI text implies the roster is wiped on reset.

## Notes / Out of Scope

- No change to `api/admin/reset.js`, `getState`, `setRoster`, or the roster editor's locked-state gating.
- No second "wipe everything / clear the player list" reset — per-player unconfirm already covers dropping an individual.
