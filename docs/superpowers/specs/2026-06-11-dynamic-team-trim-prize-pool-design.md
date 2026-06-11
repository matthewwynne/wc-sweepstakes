# Dynamic team-trimming & scaled prize pool — design

**Date:** 2026-06-11
**Status:** Approved (pending spec review)

## Problem

The sweepstake is built for exactly 24 players / 48 teams (24 strong + 24
wildcard), giving each player 1 strong + 1 wildcard team. When fewer than 24
players join, two things are wrong:

1. **The draw trims the wrong teams.** `computeAssignments` shuffles all 24
   strong and all 24 weak teams and hands the first `n` of each to the `n`
   players — so it drops a *random* `24-n` teams from each tier, not the
   weakest. The intent is: remove the **lowest-ranked** teams until the count
   is divisible so every player gets 2 teams (1 strong + 1 wildcard).
2. **The prize pool is hardcoded** at R6 000 (24 × R250) with a fixed
   R3 000 / R1 500 / R900 / R600 split. With fewer players the pot and prizes
   should shrink to match.

## Decisions (confirmed with user)

- **Trim method:** balanced by tier. Keep the top-`n` ranked strong teams and
  the top-`n` ranked wildcard teams; drop the lowest-ranked of *each* tier.
  Every player still gets 1 strong + 1 wildcard.
- **Prize split:** scale proportionally. Keep the percentages
  (1st 50% / 2nd 25% / 3rd 15% / wildcard 10%) and apply them to
  `pot = players × R250`.
- **Rounding:** round each prize to the nearest whole rand; the banker keeps
  the small rounding remainder (≤ a rand or two).
- **Over 24 players:** block the draw with a clear error — there aren't enough
  teams. Admin must trim the roster first.
- **Header / prize-split card:** make the currently-static numbers in
  `index.html` dynamic so the whole page reflects the real player count.

## Scope of change

### 1. `lib/draw.js` — `computeAssignments(seed, playerNames)`

`STRONG` and `WEAK` in `lib/teams.js` are already ordered by rank (index 0 =
best). So "remove the lowest-ranked until divisible" is a top-`n` slice.

```js
export function computeAssignments(seed, playerNames){
  const rng = mulberry32(hashSeed(seed));
  const n = Math.min(playerNames.length, 24);
  // Keep the top-n ranked teams in each tier; drop the lowest-ranked rest.
  const s = shuffle(STRONG.slice(0, n), rng);
  const w = shuffle(WEAK.slice(0, n), rng);   // strong shuffled before weak — verification contract
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ player: playerNames[i], strong: s[i], weak: w[i] });
  }
  return out;
}
```

- Determinism and client-side verifiability are preserved: output is a pure
  function of `seed` + `n` + the fixed rank order.
- Strong-before-weak RNG consumption order is unchanged.
- **Behavioural note:** with `n = 24` the output is identical to today's
  (slice is a no-op). For `n < 24` a re-run of an existing seed produces a
  different assignment than the old algorithm would have — acceptable because
  the draw is only ever computed once and then locked.

### 2. `lib/db.js` — `runDraw(seed, force)`

Replace the strict 24-player gate:

```js
const n = names.length;
if (n > 24) return { error: 'tooManyPlayers', count: n };
if (!force && n < 2)  return { error: 'tooFewPlayers', count: n };
```

- Removes `need24`. Any `2 ≤ n ≤ 24` may draw without `force`.
- `force` continues to bypass the low-count guard (kept for admin testing) but
  **never** bypasses the `n > 24` block — there genuinely aren't enough teams.
- Keep the existing atomic compare-and-set lock logic untouched.

### 3. `api/admin/draw.js`

Map the new error codes to admin-facing messages:
- `tooManyPlayers` → "Too many players (N). Max 48 teams = 24 players — trim the roster."
- `tooFewPlayers` → "Need at least 2 players to draw."
- existing `locked` message unchanged.

### 4. `lib/prizes.js` — new shared helper

Single source of truth for the money, used by both the draw display and the
header.

```js
export const ENTRY = 250;
export const SPLIT = { first: 0.50, second: 0.25, third: 0.15, wildcard: 0.10 };

// Returns whole-rand prize figures for a given player count.
export function prizes(playerCount){
  const n = Math.max(0, playerCount | 0);
  const pot = n * ENTRY;
  const r = pct => Math.round(pot * pct);
  return { players: n, pot, first: r(SPLIT.first), second: r(SPLIT.second),
           third: r(SPLIT.third), wildcard: r(SPLIT.wildcard) };
}
```

### 5. `app.js` — render dynamic money

- Determine the effective player count: `STATE.assignments?.length` when the
  draw is locked, else `STATE.players.length`.
- Call `prizes(count)` and use the result to:
  - replace the hardcoded `R3 000 / R1 500 / R900` leaderboard prize labels
    (`renderBoard`, ~lines 310–313) and the `R600` wildcard label (line 313);
  - rewrite the header pot row (`Players`, `Total pot`, `Teams` = `2 × n`) and
    the "Prize split — R… pot" card amounts in `index.html`.
- Add a small formatter for South African rand spacing (e.g. `R5 750`),
  matching the existing `R6 000` style.

### 6. `index.html`

- Give the header pot-row values and the prize-split card amounts stable `id`s
  (or a shared class) so `app.js` can target them. No layout change.
- The static text in the copy (e.g. "24 players. 48 teams.") that is purely
  marketing can stay, or be wired up — minor; resolve during implementation.

## Out of scope / unaffected

- `lib/scoring.js`, `GROUPS`, `ALL_TEAMS`, `PAIRS`, `MATCH_DATES`: unchanged.
  Trimmed teams are simply never owned by a player, so they never enter the
  leaderboard. The "best wildcard" prize already scans only owned weak teams.
- Database schema: unchanged. `n` is derived from existing data
  (`assignments` length / `players` count); nothing new is persisted.
- Player roster management and payments: unchanged.

## Testing

- **`computeAssignments` (unit):**
  - `n = 24` → output identical to the previous algorithm (all 48 teams used,
    one strong + one weak each).
  - `n = 20` → only strong ranks 1–20 and weak ranks 25–44 appear; ranks
    21–24 and 45–48 are absent; each player has exactly 2 teams.
  - Determinism: same `(seed, n)` → identical output across runs.
- **`prizes` (unit):** `prizes(24)` → `{pot:6000, first:3000, second:1500,
  third:900, wildcard:600}`; `prizes(20)` → `{5000, 2500, 1250, 750, 500}`;
  `prizes(23)` → rounded `{5750, 2875, 1438, 863, 575}`.
- **`runDraw` guards:** `n = 25` → `tooManyPlayers`; `n = 20` → succeeds;
  `n = 1` without force → `tooFewPlayers`.
- **Manual:** set roster to 20, run draw, confirm header shows 20 players /
  R5 000 / 40 teams, leaderboard prizes show 2 500 / 1 250 / 750 / 500, and no
  rank-45–48 team appears.
```
