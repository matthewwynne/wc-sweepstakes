# Reset that keeps the roster + confirmations — design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Problem

The banker sometimes needs to re-run the draw — wrong seed, a late roster change,
a test run — without starting the whole sweepstake over. Today the only reset
(`resetGame`, behind the "Start a new game" button) clears every player's
`confirmed` and `paid` flags, forcing everyone to re-confirm (and falsely marking
already-paid players as unpaid). The player *names* are already preserved, but the
confirmation/payment state is not.

The banker wants a reset that wipes the draw and results but leaves the roster
**fully intact** — names, confirmations, and payments — so a re-draw doesn't undo
real-world facts (people opted in; people paid R250).

## Decision (confirmed with user)

- Reset keeps the roster fully: names, positions, `confirmed`, and `paid`.
- It still clears the draw (`seed`, `locked`, `assignments`) and all results
  (`pool_results`, `ko_results`).
- A single reset behaviour — no separate "wipe everything" option. The per-player
  confirm/unconfirm toggle already covers "someone dropped out".
- Button relabelled to **"Reset draw & results"**; confirm copy updated to say the
  roster is kept.

## Scope of change

### 1. `lib/db.js` — `resetGame()`

Current:

```js
export async function resetGame(){
  await sql.transaction([
    sql`DELETE FROM pool_results`,
    sql`DELETE FROM ko_results`,
    sql`UPDATE players SET confirmed=false, paid=false`,
    sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`
  ]);
}
```

Remove the `UPDATE players ...` statement so the batch becomes three statements
that never touch `players`:

```js
export async function resetGame(){
  // Clears the draw + all results but KEEPS the roster intact — names,
  // confirmations and payments — so a re-draw never makes players re-confirm
  // or undoes a recorded payment. Use the per-player toggle to drop someone.
  await sql.transaction([
    sql`DELETE FROM pool_results`,
    sql`DELETE FROM ko_results`,
    sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`
  ]);
}
```

`locked` returns to false, so the onboarding view + roster editor reappear and the
roster (with its confirmations) flows into the next draw. Editing still works via
the existing `setRoster` path, which preserves each kept player's flags.

### 2. `app.js` — reset handler copy

The `newGameBtn` click handler currently confirms with *"Start a new game? This
clears the draw and all results."* Update the message to:

> "Reset the draw and all results? Your players and their confirmations are kept —
> you can edit the roster before the next draw."

Everything else in the handler is unchanged: POST `/api/admin/reset`, remove the
stored seed from `localStorage`, refresh. (The endpoint and `getState` need no
change.)

### 3. `index.html` — button label

Change the button text from "Start a new game" to **"Reset draw & results"**. Keep
the element id `newGameBtn` (the handler and styling key off it) — only the visible
text changes.

## Out of scope / unaffected

- No API or schema change. `api/admin/reset.js`, `getState`, `setRoster`, the roster
  editor, and locked-state gating all stay as-is.
- No second "wipe everything / clear the player list" reset.
- The roster editor's existing lock behaviour (read-only while `locked`) is unchanged
  — after a reset `locked` is false, so it's editable as before.

## Testing

- **Guard test (primary):** assert `resetGame` no longer clears player state. Because
  `resetGame` runs against Neon, do the lightest thing that genuinely verifies the
  intent: extract the statement list into a small pure helper that takes the `sql`
  tag and returns the query array (e.g. `resetStatements(sql)`), then unit-test that
  the returned batch contains the two `DELETE`s and the `game` update but **no**
  statement referencing `players`. If that extraction adds more indirection than it's
  worth, fall back to a code-review assertion and a manual check — decide in the plan,
  favouring the testable extraction since "reset must not touch players" is exactly
  the regression worth pinning.
- **Manual end-to-end:** confirm a few players, run the draw, enter some results,
  click "Reset draw & results" → confirm: draw gone, results gone, game unlocked,
  and every player still shows their prior confirmed/paid state; the roster editor is
  editable and a re-draw works without re-confirming.
- **Regression:** existing `npm test` suite still passes (it doesn't touch `db.js`).
