# Sweepstake Shared Backend + Onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single-file `localStorage` sweepstake into a shared family app on Vercel + Neon, with an onboarding/confirmation flow, seed-gated verification, and passphrase-gated admin writes.

**Architecture:** Static `index.html` + `app.js` in the browser; all DB access through Vercel serverless functions (`/api/**`) talking to Neon via `@neondatabase/serverless`. Pure logic (team data, RNG, scoring) lives in `lib/*.js` ES modules imported by both browser and functions. Browser reads via `GET /api/state` and polls every 7s; writes go through functions, admin ones gated by a passphrase header.

**Tech Stack:** Vanilla JS ES modules, Vercel serverless functions (Node), Neon Postgres, `@neondatabase/serverless`, `node --test` for pure-logic unit tests.

**Source of truth:** the design spec at `docs/superpowers/specs/2026-06-09-sweepstake-backend-design.md`. §5 (API contract) and §6 (DOM-id contract) are frozen — do not change them while implementing; if a change seems necessary, stop and raise it.

---

## File Structure

```
package.json            deps (@neondatabase/serverless) + "type":"module" + test script
vercel.json             function runtime config
schema.sql              Neon tables + seed data
lib/teams.js            STRONG, WEAK, GROUPS, PAIRS, TEAM, ALL_TEAMS, scoring consts   [shared]
lib/draw.js             hashSeed, mulberry32, shuffle, computeAssignments              [shared]
lib/scoring.js          deriveAll, teamPts, standingsFor, leaderboardRows              [shared, client-used]
lib/db.js               Neon sql client + getState() composer + write helpers          [server only]
api/state.js            GET  /api/state
api/confirm.js          POST /api/confirm
api/admin/draw.js       POST /api/admin/draw
api/admin/pool.js       POST /api/admin/pool
api/admin/ko.js         POST + DELETE /api/admin/ko
api/admin/paid.js       POST /api/admin/paid
api/admin/roster.js     POST /api/admin/roster
api/admin/reset.js      POST /api/admin/reset
api/_auth.js            shared admin-passphrase + JSON-body + method helpers           [server only]
test/draw.test.js       unit tests for lib/draw.js
test/scoring.test.js    unit tests for lib/scoring.js
app.js                  client logic: fetch/poll, phase routing, verify, renders, writes
index.html              markup + styles + onboarding/seed-gate/admin views (loads app.js)
```

## Execution stages (concurrency)

- **Stage 0 — Foundation (Tasks 1–6):** one agent, sequential. Builds shared libs + schema + config + tests. **Blocks everything.**
- **Stage 1 — Fan-out (Tasks 7, 8, 9):** three agents in parallel, each in its own git worktree off this branch. Disjoint files, coordinate only via spec §5/§6.
  - Task 7 → Agent A — `api/**` + `lib/db.js`
  - Task 8 → Agent B — `app.js`
  - Task 9 → Agent C — `index.html`
- **Stage 2 — Integration (Task 10):** main session. Merge, provision Neon, set env vars, smoke test, deploy preview.

---

## Task 1: Project config (package.json, vercel.json)

**Files:**
- Create: `package.json`
- Create: `vercel.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "wc-sweepstakes",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.10.4"
  }
}
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "functions": {
    "api/**/*.js": { "runtime": "nodejs20.x" }
  }
}
```

- [ ] **Step 3: Install deps and verify**

Run: `npm install`
Expected: `node_modules/@neondatabase/serverless` exists, no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json vercel.json package-lock.json
git commit -m "chore: project config for Vercel functions + Neon"
```

---

## Task 2: Shared team data (`lib/teams.js`)

**Files:**
- Create: `lib/teams.js`

Port the constants **verbatim** from the current `index.html` (the `<script>` DATA + SCORING MODEL sections). Export them as ES module bindings.

- [ ] **Step 1: Create `lib/teams.js`**

```js
// Static reference data for the sweepstake. Shared by the browser and the
// serverless functions. Ported verbatim from the original index.html.

// Tiered by bookmaker WINNER ODDS (decimal, as of 11 Jun 2026): rank 1 = shortest.
export const STRONG = [
  ["France","\u{1F1EB}\u{1F1F7}",1],["Spain","\u{1F1EA}\u{1F1F8}",2],["England","\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",3],["Brazil","\u{1F1E7}\u{1F1F7}",4],
  ["Argentina","\u{1F1E6}\u{1F1F7}",5],["Portugal","\u{1F1F5}\u{1F1F9}",6],["Germany","\u{1F1E9}\u{1F1EA}",7],["Netherlands","\u{1F1F3}\u{1F1F1}",8],
  ["Norway","\u{1F1F3}\u{1F1F4}",9],["Belgium","\u{1F1E7}\u{1F1EA}",10],["Colombia","\u{1F1E8}\u{1F1F4}",11],["United States","\u{1F1FA}\u{1F1F8}",12],
  ["Morocco","\u{1F1F2}\u{1F1E6}",13],["Uruguay","\u{1F1FA}\u{1F1FE}",14],["Japan","\u{1F1EF}\u{1F1F5}",15],["Croatia","\u{1F1ED}\u{1F1F7}",16],
  ["Mexico","\u{1F1F2}\u{1F1FD}",17],["Switzerland","\u{1F1E8}\u{1F1ED}",18],["Türkiye","\u{1F1F9}\u{1F1F7}",19],["Ecuador","\u{1F1EA}\u{1F1E8}",20],
  ["Senegal","\u{1F1F8}\u{1F1F3}",21],["Sweden","\u{1F1F8}\u{1F1EA}",22],["Austria","\u{1F1E6}\u{1F1F9}",23],["Canada","\u{1F1E8}\u{1F1E6}",24]
];
export const WEAK = [
  ["Paraguay","\u{1F1F5}\u{1F1FE}",25],["Czechia","\u{1F1E8}\u{1F1FF}",26],["Ivory Coast","\u{1F1E8}\u{1F1EE}",27],["Scotland","\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",28],
  ["Bosnia & Herz.","\u{1F1E7}\u{1F1E6}",29],["South Korea","\u{1F1F0}\u{1F1F7}",30],["Ghana","\u{1F1EC}\u{1F1ED}",31],["Algeria","\u{1F1E9}\u{1F1FF}",32],
  ["Egypt","\u{1F1EA}\u{1F1EC}",33],["Australia","\u{1F1E6}\u{1F1FA}",34],["Tunisia","\u{1F1F9}\u{1F1F3}",35],["Iran","\u{1F1EE}\u{1F1F7}",36],
  ["DR Congo","\u{1F1E8}\u{1F1E9}",37],["Panama","\u{1F1F5}\u{1F1E6}",38],["South Africa","\u{1F1FF}\u{1F1E6}",39],["Uzbekistan","\u{1F1FA}\u{1F1FF}",40],
  ["Saudi Arabia","\u{1F1F8}\u{1F1E6}",41],["Qatar","\u{1F1F6}\u{1F1E6}",42],["New Zealand","\u{1F1F3}\u{1F1FF}",43],["Jordan","\u{1F1EF}\u{1F1F4}",44],
  ["Cape Verde","\u{1F1E8}\u{1F1FB}",45],["Iraq","\u{1F1EE}\u{1F1F6}",46],["Haiti","\u{1F1ED}\u{1F1F9}",47],["Curaçao","\u{1F1E8}\u{1F1FC}",48]
];

export const GROUPS = {
  A:["Mexico","South Korea","Czechia","South Africa"],
  B:["Switzerland","Canada","Qatar","Bosnia & Herz."],
  C:["Brazil","Morocco","Scotland","Haiti"],
  D:["United States","Australia","Türkiye","Paraguay"],
  E:["Germany","Ecuador","Ivory Coast","Curaçao"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Iran","Egypt","New Zealand"],
  H:["Spain","Uruguay","Saudi Arabia","Cape Verde"],
  I:["France","Senegal","Norway","Iraq"],
  J:["Argentina","Austria","Algeria","Jordan"],
  K:["Portugal","Colombia","DR Congo","Uzbekistan"],
  L:["England","Croatia","Panama","Ghana"]
};

// Round-robin pairings within a group of 4 (index pairs).
export const PAIRS = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];

// name -> {flag, rank, tier}
export const TEAM = {};
STRONG.forEach(t => TEAM[t[0]] = { flag:t[1], rank:t[2], tier:'s' });
WEAK.forEach(t => TEAM[t[0]] = { flag:t[1], rank:t[2], tier:'w' });

export const ALL_TEAMS = STRONG.concat(WEAK).map(t => t[0]).sort((a,b) => a.localeCompare(b));

export const DEFAULT_PLAYERS = ["Carern","Maurice","Claire","Adam","Nick","Jamie","Gavin","Peter","Merle","Kim","Dane","Lynne","Brandon","Mare","Ben","Melissa","Matt","Chris","Meegan","Ethan","Meggie","Kyle","Pat","Pieter"];

// Scoring
export const POOL_WIN = 3, POOL_DRAW = 1;
export const ROUND_BONUS = { r32:3, r16:5, qf:12, sf:20, final:30, champ:45 };
export const STAGE_ORDER = ["group","r32","r16","qf","sf","final","champ"];
export const STAGE_LABEL = { group:"Pool", r32:"R32", r16:"R16", qf:"Quarters", sf:"Semis", final:"Final", champ:"\u{1F3C6} Champions" };
export const KO_LABEL = { r32:"R32", r16:"R16", qf:"QF", sf:"SF", final:"Final" };
```

- [ ] **Step 2: Sanity-check it imports**

Run: `node -e "import('./lib/teams.js').then(m=>console.log(m.ALL_TEAMS.length, m.STRONG.length, m.WEAK.length))"`
Expected: `48 24 24`

- [ ] **Step 3: Commit**

```bash
git add lib/teams.js
git commit -m "feat: shared team data module"
```

---

## Task 3: Shared draw logic (`lib/draw.js`) — TDD

**Files:**
- Create: `lib/draw.js`
- Test: `test/draw.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/draw.test.js
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
  // strong ranks 1-24, weak ranks 25-48
  assert.ok(asg.every(a => a.strong[2] >= 1 && a.strong[2] <= 24));
  assert.ok(asg.every(a => a.weak[2] >= 25 && a.weak[2] <= 48));
  assert.equal(asg[0].player, 'P1');
});

test('fewer than 24 players assigns only that many', () => {
  const asg = computeAssignments('seed-1', NAMES.slice(0,10));
  assert.equal(asg.length, 10);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/draw.test.js`
Expected: FAIL (cannot import from `../lib/draw.js` / not defined).

- [ ] **Step 3: Write `lib/draw.js`**

```js
// Seeded draw. Pure + deterministic so the server can compute the official
// assignments and any browser can re-derive them from the seed to verify.
import { STRONG, WEAK } from './teams.js';

export function hashSeed(str){
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return (h ^ h >>> 16) >>> 0;
}

export function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rng){
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Returns [{ player, strong:[name,flag,rank], weak:[name,flag,rank] }]
export function computeAssignments(seed, playerNames){
  const rng = mulberry32(hashSeed(seed));
  const s = shuffle(STRONG, rng);
  const w = shuffle(WEAK, rng);
  const n = Math.min(playerNames.length, 24);
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ player: playerNames[i], strong: s[i], weak: w[i] });
  }
  return out;
}
```

> NOTE: shuffle order matters for reproducibility — `shuffle(STRONG)` is called before `shuffle(WEAK)`, exactly as the original did. Do not reorder.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/draw.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/draw.js test/draw.test.js
git commit -m "feat: shared seeded-draw logic with tests"
```

---

## Task 4: Shared scoring logic (`lib/scoring.js`) — TDD

Extract the proven `deriveAll` / `teamPts` logic into a pure module so it is unit-testable and importable by `app.js`. It takes plain data (no DOM, no globals).

**Files:**
- Create: `lib/scoring.js`
- Test: `test/scoring.test.js`

- [ ] **Step 1: Write the failing test**

```js
// test/scoring.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveAll, teamPts } from '../lib/scoring.js';

// France & Iraq are both in Group I (index 0 and 3) per teams.js GROUPS.
test('pool win/draw points derive from scorelines', () => {
  const d = deriveAll({ pool: { 'I-0-3': [2,0] }, ko: [] });
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/scoring.test.js`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `lib/scoring.js`**

```js
// Pure scoring derivation. No DOM, no globals. Ported from index.html.
import { GROUPS, PAIRS, ALL_TEAMS, POOL_WIN, POOL_DRAW, ROUND_BONUS, STAGE_ORDER } from './teams.js';

function blank(){ return { w:0, d:0, l:0, gf:0, ga:0, pld:0, reach:0 }; }

// state = { pool: { "A-0-1":[h,a] }, ko: [ {round,a,b,as,bs,pen} ] }
export function deriveAll(state){
  const pool = state.pool || {}, ko = state.ko || [];
  const d = {}; ALL_TEAMS.forEach(n => d[n] = blank());

  for (const g in GROUPS){
    const teams = GROUPS[g];
    PAIRS.forEach(([i,j]) => {
      const sc = pool[g + '-' + i + '-' + j];
      if (!sc || sc[0] === null || sc[1] === null || sc[0] === '' || sc[1] === '') return;
      const a = teams[i], b = teams[j], as = +sc[0], bs = +sc[1];
      d[a].pld++; d[b].pld++; d[a].gf += as; d[a].ga += bs; d[b].gf += bs; d[b].ga += as;
      if (as > bs){ d[a].w++; d[b].l++; }
      else if (bs > as){ d[b].w++; d[a].l++; }
      else { d[a].d++; d[b].d++; }
    });
  }

  ko.forEach(m => {
    const ri = STAGE_ORDER.indexOf(m.round); if (ri < 1) return;
    if (d[m.a]) d[m.a].reach = Math.max(d[m.a].reach, ri);
    if (d[m.b]) d[m.b].reach = Math.max(d[m.b].reach, ri);
    let winner = null;
    if (+m.as > +m.bs) winner = m.a;
    else if (+m.bs > +m.as) winner = m.b;
    else if (m.pen) winner = m.pen;
    if (winner && d[winner]) d[winner].reach = Math.max(d[winner].reach, ri + 1);
  });
  return d;
}

export function teamPts(row){
  if (!row) return 0;
  let pts = row.w * POOL_WIN + row.d * POOL_DRAW;
  for (let i = 1; i <= row.reach; i++) pts += ROUND_BONUS[STAGE_ORDER[i]] || 0;
  return pts;
}

// Sorted standings for one group: [{n, pld,w,d,l,gf,ga, gd, pts}]
export function standingsFor(g, derived){
  const rows = GROUPS[g].map(n => ({ n, ...derived[n], gd: derived[n].gf - derived[n].ga, pts: derived[n].w * POOL_WIN + derived[n].d * POOL_DRAW }));
  rows.sort((x,y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.n.localeCompare(y.n));
  return rows;
}

// Leaderboard rows from assignments + derived. assignments = [{player,strong,weak}]
export function leaderboardRows(assignments, derived){
  const rows = assignments.map(a => {
    const sp = teamPts(derived[a.strong[0]]), wp = teamPts(derived[a.weak[0]]);
    const gf = (derived[a.strong[0]].gf || 0) + (derived[a.weak[0]].gf || 0);
    return { player: a.player, strong: a.strong[0], weak: a.weak[0], sp, wp, total: sp + wp, gf };
  });
  rows.sort((x,y) => y.total - x.total || y.gf - x.gf || y.sp - x.sp);
  return rows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/scoring.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/scoring.js test/scoring.test.js
git commit -m "feat: shared pure scoring module with tests"
```

---

## Task 5: Database schema (`schema.sql`)

**Files:**
- Create: `schema.sql`

- [ ] **Step 1: Create `schema.sql`**

```sql
-- Run once against the Neon database.
CREATE TABLE IF NOT EXISTS game (
  id          text PRIMARY KEY,
  seed        text,
  locked      boolean NOT NULL DEFAULT false,
  assignments jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id        serial PRIMARY KEY,
  name      text UNIQUE NOT NULL,
  position  int NOT NULL DEFAULT 0,
  confirmed boolean NOT NULL DEFAULT false,
  paid      boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS pool_results (
  match_id   text PRIMARY KEY,
  home_score int,
  away_score int
);

CREATE TABLE IF NOT EXISTS ko_results (
  id         serial PRIMARY KEY,
  round      text NOT NULL,
  team_a     text NOT NULL,
  team_b     text NOT NULL,
  score_a    int NOT NULL,
  score_b    int NOT NULL,
  pen_winner text
);

-- Seed the single game row.
INSERT INTO game (id, locked) VALUES ('current', false)
  ON CONFLICT (id) DO NOTHING;

-- Seed the 24 default players (idempotent).
INSERT INTO players (name, position) VALUES
  ('Carern',0),('Maurice',1),('Claire',2),('Adam',3),('Nick',4),('Jamie',5),
  ('Gavin',6),('Peter',7),('Merle',8),('Kim',9),('Dane',10),('Lynne',11),
  ('Brandon',12),('Mare',13),('Ben',14),('Melissa',15),('Matt',16),('Chris',17),
  ('Meegan',18),('Ethan',19),('Meggie',20),('Kyle',21),('Pat',22),('Pieter',23)
  ON CONFLICT (name) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add schema.sql
git commit -m "feat: Neon schema + seed data"
```

---

## Task 6: Stage 0 gate — full test run

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: all tests in `test/` PASS (9 total).

- [ ] **Step 2: Confirm shared modules import cleanly under Node**

Run: `node -e "Promise.all([import('./lib/teams.js'),import('./lib/draw.js'),import('./lib/scoring.js')]).then(()=>console.log('ok'))"`
Expected: `ok`

**Stage 0 is complete. Tasks 7, 8, 9 may now run in parallel.**

---

## Task 7 (Agent A): Serverless API (`api/**` + `lib/db.js`)

**Files:**
- Create: `lib/db.js`, `api/_auth.js`, `api/state.js`, `api/confirm.js`,
  `api/admin/draw.js`, `api/admin/pool.js`, `api/admin/ko.js`,
  `api/admin/paid.js`, `api/admin/roster.js`, `api/admin/reset.js`

Implement spec §5 exactly. Functions use the Vercel Node signature `export default async function handler(req, res)`. Env vars: `DATABASE_URL`, `ADMIN_PASSPHRASE`.

- [ ] **Step 1: `lib/db.js` — Neon client + state composer + write helpers**

```js
import { neon } from '@neondatabase/serverless';
import { computeAssignments } from './draw.js';

const sql = neon(process.env.DATABASE_URL);
export { sql };

// Compose the GET /api/state payload (spec §5).
export async function getState(){
  const [game] = await sql`SELECT seed, locked, assignments FROM game WHERE id='current'`;
  const players = await sql`SELECT name, position, confirmed, paid FROM players ORDER BY position, name`;
  const poolRows = await sql`SELECT match_id, home_score, away_score FROM pool_results`;
  const koRows = await sql`SELECT id, round, team_a, team_b, score_a, score_b, pen_winner FROM ko_results ORDER BY id`;

  const pool = {};
  for (const r of poolRows) pool[r.match_id] = [r.home_score, r.away_score];

  const ko = koRows.map(r => ({
    id: r.id, round: r.round, a: r.team_a, b: r.team_b,
    as: r.score_a, bs: r.score_b, pen: r.pen_winner
  }));

  return {
    locked: !!(game && game.locked),
    seed: game ? game.seed : null,
    players: players.map(p => ({ name: p.name, position: p.position, confirmed: p.confirmed, paid: p.paid })),
    assignments: game ? game.assignments : null,
    pool, ko
  };
}

export async function confirmPlayer(name){
  const rows = await sql`UPDATE players SET confirmed=true WHERE name=${name} RETURNING id`;
  return rows.length > 0;
}

export async function setPaid(name, paid){
  await sql`UPDATE players SET paid=${!!paid} WHERE name=${name}`;
}

export async function setRoster(names){
  // Upsert by name (preserves confirmed/paid), set positions, remove absent.
  for (let i = 0; i < names.length; i++){
    await sql`INSERT INTO players (name, position) VALUES (${names[i]}, ${i})
              ON CONFLICT (name) DO UPDATE SET position=${i}`;
  }
  await sql`DELETE FROM players WHERE name <> ALL(${names})`;
}

export async function runDraw(seed, force){
  const [game] = await sql`SELECT locked FROM game WHERE id='current'`;
  if (game && game.locked) return { error: 'locked' };
  const players = await sql`SELECT name FROM players ORDER BY position, name`;
  const names = players.map(p => p.name);
  if (!force && names.length !== 24) return { error: 'need24', count: names.length };
  const assignments = computeAssignments(seed, names);
  await sql`UPDATE game SET seed=${seed}, locked=true, assignments=${JSON.stringify(assignments)} WHERE id='current'`;
  return { ok: true };
}

export async function upsertPool(matchId, home, away){
  if (home === null || away === null || home === '' || away === ''){
    await sql`DELETE FROM pool_results WHERE match_id=${matchId}`;
    return;
  }
  await sql`INSERT INTO pool_results (match_id, home_score, away_score)
            VALUES (${matchId}, ${home}, ${away})
            ON CONFLICT (match_id) DO UPDATE SET home_score=${home}, away_score=${away}`;
}

export async function addKo(m){
  const rows = await sql`INSERT INTO ko_results (round, team_a, team_b, score_a, score_b, pen_winner)
            VALUES (${m.round}, ${m.a}, ${m.b}, ${m.as}, ${m.bs}, ${m.pen || null}) RETURNING id`;
  return rows[0].id;
}

export async function deleteKo(id){
  await sql`DELETE FROM ko_results WHERE id=${id}`;
}

export async function resetGame(){
  await sql`DELETE FROM pool_results`;
  await sql`DELETE FROM ko_results`;
  await sql`UPDATE players SET confirmed=false, paid=false`;
  await sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`;
}
```

- [ ] **Step 2: `api/_auth.js` — shared helpers**

```js
export function requireAdmin(req, res){
  const key = req.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_PASSPHRASE){
    res.status(401).json({ error: 'unauthorized' });
    return false;
  }
  return true;
}

export function readBody(req){
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export function methodGuard(req, res, allowed){
  if (!allowed.includes(req.method)){
    res.status(405).json({ error: 'method_not_allowed' });
    return false;
  }
  return true;
}
```

- [ ] **Step 3: `api/state.js`**

```js
import { getState } from '../lib/db.js';
import { methodGuard } from './_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    res.status(200).json(await getState());
  } catch (e){
    res.status(500).json({ error: 'state_failed', detail: String(e) });
  }
}
```

- [ ] **Step 4: `api/confirm.js`**

```js
import { confirmPlayer } from '../lib/db.js';
import { methodGuard, readBody } from './_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  const { name } = readBody(req);
  if (!name) return res.status(400).json({ error: 'name_required' });
  const ok = await confirmPlayer(name);
  if (!ok) return res.status(400).json({ error: 'not_on_roster' });
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 5: `api/admin/draw.js`**

```js
import { runDraw, getState } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { seed, force } = readBody(req);
  if (!seed) return res.status(400).json({ error: 'seed_required' });
  const r = await runDraw(seed, !!force);
  if (r.error === 'locked') return res.status(409).json({ error: 'already_locked' });
  if (r.error === 'need24') return res.status(400).json({ error: 'need_24_players', count: r.count });
  res.status(200).json(await getState());
}
```

- [ ] **Step 6: `api/admin/pool.js`**

```js
import { upsertPool } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { match_id, home, away } = readBody(req);
  if (!match_id) return res.status(400).json({ error: 'match_id_required' });
  await upsertPool(match_id, home ?? null, away ?? null);
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 7: `api/admin/ko.js` (POST + DELETE)**

```js
import { addKo, deleteKo } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST','DELETE'])) return;
  if (!requireAdmin(req, res)) return;
  const body = readBody(req);
  if (req.method === 'DELETE'){
    if (body.id == null) return res.status(400).json({ error: 'id_required' });
    await deleteKo(body.id);
    return res.status(200).json({ ok: true });
  }
  const { round, a, b } = body;
  if (!round || !a || !b) return res.status(400).json({ error: 'round_teams_required' });
  if (a === b) return res.status(400).json({ error: 'same_team' });
  const id = await addKo({ round, a, b, as: body.as, bs: body.bs, pen: body.pen });
  res.status(200).json({ id });
}
```

- [ ] **Step 8: `api/admin/paid.js`**

```js
import { setPaid } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { name, paid } = readBody(req);
  if (!name) return res.status(400).json({ error: 'name_required' });
  await setPaid(name, paid);
  res.status(200).json({ ok: true });
}
```

- [ ] **Step 9: `api/admin/roster.js`**

```js
import { setRoster, getState } from '../../lib/db.js';
import { methodGuard, readBody, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  const { names } = readBody(req);
  if (!Array.isArray(names) || names.length === 0) return res.status(400).json({ error: 'names_required' });
  const clean = names.map(s => String(s).trim()).filter(Boolean);
  await setRoster(clean);
  res.status(200).json(await getState());
}
```

- [ ] **Step 10: `api/admin/reset.js`**

```js
import { resetGame, getState } from '../../lib/db.js';
import { methodGuard, requireAdmin } from '../_auth.js';

export default async function handler(req, res){
  if (!methodGuard(req, res, ['POST'])) return;
  if (!requireAdmin(req, res)) return;
  await resetGame();
  res.status(200).json(await getState());
}
```

- [ ] **Step 11: Verify all functions parse**

Run: `node --check api/state.js && node --check api/confirm.js && node --check api/admin/draw.js && node --check api/admin/pool.js && node --check api/admin/ko.js && node --check api/admin/paid.js && node --check api/admin/roster.js && node --check api/admin/reset.js && node --check lib/db.js && node --check api/_auth.js`
Expected: no output (all parse).

> Live DB testing happens in Task 10 (needs a provisioned Neon URL). Do not block here.

- [ ] **Step 12: Commit**

```bash
git add lib/db.js api/
git commit -m "feat: serverless API + Neon data layer"
```

---

## Task 8 (Agent B): Client logic (`app.js`)

**Files:**
- Create: `app.js`

Port the rendering logic from the original `index.html` `<script>`, but: (a) source data from `GET /api/state` instead of `localStorage`; (b) import constants from `lib/teams.js` and scoring from `lib/scoring.js` / draw from `lib/draw.js`; (c) add phase routing, the seed gate + verification, admin mode, and 7s polling; (d) writes go through `/api`. Bind only to the **frozen DOM ids in spec §6**. Apply the §10 bug fixes.

`app.js` is loaded as `<script type="module" src="/app.js">` (Task 9 adds the tag).

- [ ] **Step 1: Module imports + state + helpers**

```js
import { TEAM, GROUPS, PAIRS, ALL_TEAMS, STAGE_ORDER, KO_LABEL, POOL_WIN } from '/lib/teams.js';
import { deriveAll, teamPts, standingsFor, leaderboardRows } from '/lib/scoring.js';
import { computeAssignments } from '/lib/draw.js';

let STATE = { locked:false, seed:null, players:[], assignments:null, pool:{}, ko:[] };
let POLL = null;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); // §10 fix
function adminKey(){ return sessionStorage.getItem('sweep:admin') || ''; }
function isAdmin(){ return !!adminKey(); }
```

- [ ] **Step 2: API helpers**

```js
async function getState(){ const r = await fetch('/api/state'); return r.json(); }

async function post(path, body, admin=false){
  const headers = { 'Content-Type':'application/json' };
  if (admin) headers['x-admin-key'] = adminKey();
  const r = await fetch(path, { method: body && body.__method === 'DELETE' ? 'DELETE' : 'POST', headers, body: JSON.stringify(body || {}) });
  if (r.status === 401){ alert('Admin passphrase rejected.'); sessionStorage.removeItem('sweep:admin'); throw new Error('unauthorized'); }
  return r.json();
}

async function refresh(){ STATE = await getState(); renderAll(); }
```

- [ ] **Step 3: Phase routing + render dispatcher**

```js
function renderAll(){
  document.body.classList.toggle('admin', isAdmin());
  if (!STATE.locked){
    show('onboarding');
    renderOnboarding();
  } else if (!gateUnlocked() && !isAdmin()){
    show('seedgate');
  } else {
    show('dashboard');
    renderDraw(); renderFixtures(); renderBoard();
  }
}

function show(phase){
  $('onboardingView').style.display = phase === 'onboarding' ? 'block' : 'none';
  $('seedGate').style.display       = phase === 'seedgate'   ? 'block' : 'none';
  $('dashboard').style.display      = phase === 'dashboard'  ? 'block' : 'none';
}

function gateUnlocked(){ return localStorage.getItem('sweep:seed') === STATE.seed && STATE.seed; }
```

- [ ] **Step 4: Onboarding render + confirm**

```js
function renderOnboarding(){
  const confirmed = STATE.players.filter(p => p.confirmed).length;
  $('confirmCount').textContent = confirmed + ' / ' + STATE.players.length + ' confirmed';
  $('rosterList').innerHTML = STATE.players.map(p =>
    '<div class="rrow"><span>' + esc(p.name) + '</span>'
    + '<span class="rstatus">' + (p.confirmed ? '✓ in' : '—')
    + (p.paid ? ' · 💰 paid' : '') + '</span></div>').join('');
  $('nameSelect').innerHTML = '<option value="">— pick your name —</option>'
    + STATE.players.filter(p => !p.confirmed).map(p => '<option>' + esc(p.name) + '</option>').join('');
  // admin: roster editor
  if ($('rosterEditBox')) $('rosterEditBox').value = STATE.players.map(p => p.name).join('\n');
}

$('confirmBtn').addEventListener('click', async () => {
  const name = $('nameSelect').value;
  if (!name) return;
  await post('/api/confirm', { name });
  await refresh();
});
```

- [ ] **Step 5: Seed gate + verification (uses lib/draw.js)**

```js
$('gateEnterBtn').addEventListener('click', () => {
  const typed = $('gateSeedInput').value.trim();
  if (typed === STATE.seed){
    localStorage.setItem('sweep:seed', typed);
    renderAll();
  } else {
    $('gateMsg').textContent = "That's not the seed for this game.";
  }
});

function verifyBadge(){
  if (!STATE.seed || !STATE.assignments) return '';
  const recomputed = computeAssignments(STATE.seed, STATE.players.map(p => p.name));
  const ok = JSON.stringify(recomputed) === JSON.stringify(STATE.assignments);
  return ok ? '<span class="prize">✓ verified — matches the seed</span>'
            : '<span class="prize wild">⚠ does not match seed</span>';
}
```

- [ ] **Step 6: Draw / fixtures / board renders**

Port `teamChip`, `renderDraw`, `renderFixtures`, `renderKoList`, `refreshDerived`, `renderBoard` from the original `index.html` (lines ~457–563), changing:
- read from `STATE` (already API-shaped: `STATE.assignments`, `STATE.pool`, `STATE.ko`);
- use imported `deriveAll`/`teamPts`/`standingsFor`/`leaderboardRows` instead of inline copies;
- `renderDraw` shows `verifyBadge()` in `#verifyBadge`;
- escape player names with `esc()` (§10 fix);
- wrap all input/edit affordances so they are disabled/hidden unless `isAdmin()` (pool `<input>` gets `disabled` when not admin; KO recorder hidden via `body.admin` CSS handled in index.html, but also guard the JS handlers).

```js
function teamChip(name, tier){
  const t = TEAM[name] || { flag:'', rank:'' };
  return '<span class="team"><span class="flag">' + t.flag + '</span>' + esc(name)
    + ' <span class="rk ' + (tier === 's' ? 'tier-s' : 'tier-w') + '">#' + t.rank + '</span></span>';
}
// renderDraw/renderFixtures/renderKoList/refreshDerived/renderBoard: see original index.html;
// substitute STATE.* for the old local STATE and imported scoring fns. KO list × button uses data-koid (the DB id), not array index.
```

- [ ] **Step 7: Write handlers (admin), §10 bug fixes**

```js
// pool score entry (admin only)
$('poolWrap').addEventListener('input', async e => {
  const inp = e.target.closest('.sc'); if (!inp || !isAdmin()) return;
  const mid = inp.dataset.mid, side = +inp.dataset.side;
  const cur = STATE.pool[mid] || ['',''];
  cur[side] = inp.value === '' ? null : Math.max(0, parseInt(inp.value,10) || 0);
  STATE.pool[mid] = cur;
  await post('/api/admin/pool', { match_id: mid, home: cur[0], away: cur[1] }, true);
  refreshDerived(); // local re-render; poll will reconcile
});

// KO add — §10: only the two selected teams in the pen dropdown; Cancel aborts
$('koAdd').addEventListener('click', async () => {
  const round = $('koRound').value, a = $('koA').value, b = $('koB').value;
  const as = $('koAS').value, bs = $('koBS').value, pen = $('koPen').value;
  if (!a || !b) return alert('Pick both teams.');
  if (a === b) return alert('A team can’t play itself.');
  if (as === '' || bs === '') return alert('Enter both scores.');
  if (+as === +bs && !pen){ if (!confirm('Knockouts can’t end level. Add anyway with no winner advancing?')) return; } // §10 fix
  await post('/api/admin/ko', { round, a, b, as:+as, bs:+bs, pen: (+as===+bs ? pen : '') }, true);
  $('koAS').value=''; $('koBS').value=''; $('koPen').value='';
  await refresh();
});

// keep pen dropdown to the two chosen teams — §10 fix
function syncKoPen(){
  const a = $('koA').value, b = $('koB').value;
  const opts = ['<option value="">If drawn, won on pens by…</option>']
    .concat([a,b].filter(Boolean).map(n => '<option value="'+esc(n)+'">'+esc(n)+'</option>'));
  $('koPen').innerHTML = opts.join('');
}
$('koA').addEventListener('change', syncKoPen);
$('koB').addEventListener('change', syncKoPen);

// KO delete (by DB id)
$('koList').addEventListener('click', async e => {
  const btn = e.target.closest('.del'); if (!btn || !isAdmin()) return;
  await post('/api/admin/ko', { __method:'DELETE', id: +btn.dataset.koid }, true);
  await refresh();
});
```

- [ ] **Step 8: Admin unlock + admin actions (draw, roster, new game)**

```js
$('adminUnlockBtn').addEventListener('click', () => {
  const pass = $('adminPassInput').value.trim();
  if (pass){ sessionStorage.setItem('sweep:admin', pass); renderAll(); }
});

$('runDrawBtn')?.addEventListener('click', async () => {
  const seed = $('seedInput').value.trim();
  if (!seed) return alert('Enter a seed first.');
  const r = await post('/api/admin/draw', { seed }, true);
  if (r.error === 'need_24_players'){ if (!confirm('You have ' + r.count + ' players (24 needed). Draw anyway?')) return;
    await post('/api/admin/draw', { seed, force:true }, true); }
  await refresh();
});

$('rosterSaveBtn')?.addEventListener('click', async () => {
  const names = $('rosterEditBox').value.split('\n').map(s=>s.trim()).filter(Boolean);
  await post('/api/admin/roster', { names }, true);
  await refresh();
});

$('newGameBtn')?.addEventListener('click', async () => {
  if (!confirm('Start a new game? This clears the draw and all results.')) return;
  await post('/api/admin/reset', {}, true);
  localStorage.removeItem('sweep:seed');
  await refresh();
});
```

- [ ] **Step 9: Tabs + polling + init**

```js
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active'); document.getElementById(t.dataset.view).classList.add('active');
}));

function startPolling(){
  if (POLL) return;
  POLL = setInterval(async () => {
    // don't clobber an input the user is editing
    if (document.activeElement && document.activeElement.matches('input, textarea, select')) return;
    STATE = await getState(); renderAll();
  }, 7000);
}

(async function(){ await refresh(); startPolling(); })();
```

- [ ] **Step 10: Smoke-parse**

Run: `node --check app.js`
Expected: no output. (Browser-only globals are fine; `--check` is syntax-only.)

- [ ] **Step 11: Commit**

```bash
git add app.js
git commit -m "feat: client app talking to /api with onboarding, seed gate, admin mode, polling"
```

---

## Task 9 (Agent C): Markup & styles (`index.html`)

**Files:**
- Modify: `index.html`

Rework the existing `index.html`: keep the `<style>` block (extend it), **remove the inline `<script>`** (logic now lives in `app.js`), and restructure the body into the three phase containers exposing **exactly the spec §6 ids**. Load `app.js` as a module.

- [ ] **Step 1: Add the three phase containers**

Wrap content in `#onboardingView`, `#seedGate`, `#dashboard`. The existing tabbed views (draw/fixtures/board/rules) move *inside* `#dashboard`. The header stays above all three.

```html
<!-- ONBOARDING (locked=false) -->
<div id="onboardingView" style="display:none">
  <div class="card">
    <h2>Are you in?</h2>
    <p class="lead">Pick your name and confirm you’re playing. <span id="confirmCount" class="savetag"></span></p>
    <div class="btnrow">
      <select id="nameSelect" class="seed" style="max-width:280px"></select>
      <button class="act go" id="confirmBtn">I’m in</button>
    </div>
    <div id="rosterList" class="ko-list" style="margin-top:16px"></div>
  </div>
  <!-- admin-only: roster editor + run draw -->
  <div class="card" id="adminBar" style="display:none">
    <h2>Banker controls</h2>
    <label class="fld">Roster (one name per line)</label>
    <textarea id="rosterEditBox" rows="8"></textarea>
    <div class="btnrow"><button class="act ghost" id="rosterSaveBtn">Save roster</button></div>
    <label class="fld" style="margin-top:14px">Draw seed</label>
    <input class="seed" id="seedInput" placeholder="agree it in the chat first">
    <div class="btnrow"><button class="act go" id="runDrawBtn">⚽ Run the draw</button></div>
  </div>
</div>

<!-- SEED GATE (locked=true, family not yet verified) -->
<div id="seedGate" style="display:none">
  <div class="card">
    <h2>Enter the draw seed</h2>
    <p class="lead">The draw is done. Type the agreed seed to open the sweepstake and verify it wasn’t rigged.</p>
    <input class="seed" id="gateSeedInput" placeholder="the seed agreed in the chat">
    <div class="btnrow"><button class="act go" id="gateEnterBtn">Open</button></div>
    <p class="hint" id="gateMsg"></p>
  </div>
</div>

<!-- DASHBOARD (verified or admin) -->
<div id="dashboard" style="display:none">
  <!-- existing nav.tabs + the four section.view blocks go here -->
</div>
```

- [ ] **Step 2: Preserve the four tabbed views inside `#dashboard`**

Keep the existing `nav.tabs` and `section.view#draw / #fixtures / #board / #rules` markup. In `#draw`, add `<span id="verifyBadge"></span>` near the result lead, and keep `#drawTable`, `#resultLead`. Remove the old seed input / "Run the draw" card from `#draw` (that moved to the admin bar). Keep `#poolWrap`, the KO recorder (`#koRound`,`#koA`,`#koB`,`#koAS`,`#koBS`,`#koPen`,`#koAdd`,`#koList`), and `#lbTable` exactly as named.

- [ ] **Step 3: Add the admin lock + unlock UI**

Add near the header:

```html
<div style="text-align:right;margin-top:8px">
  <button class="del" id="adminLock" title="Banker login">🔒</button>
  <span id="adminLoginRow" style="display:none">
    <input class="sc" id="adminPassInput" type="password" style="width:140px" placeholder="passphrase">
    <button class="act ghost" id="adminUnlockBtn">Unlock</button>
  </span>
</div>
```

Add a tiny inline toggle so the password row appears when the lock is clicked:

```html
<script>document.getElementById('adminLock').addEventListener('click',()=>{var r=document.getElementById('adminLoginRow');r.style.display=r.style.display==='none'?'inline':'none';});</script>
```

- [ ] **Step 4: CSS for admin visibility + onboarding rows**

Add to `<style>`:

```css
#adminBar{display:none}
body.admin #adminBar{display:block}
body:not(.admin) #poolWrap .sc{opacity:.7}
.rrow{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(42,51,66,.4);font-size:14px}
.rstatus{font-family:'Space Mono',monospace;font-size:12px;color:var(--muted)}
```

The KO recorder card and pool inputs are interactive for everyone in markup, but `app.js` ignores writes unless `isAdmin()`; additionally hide the KO recorder form for non-admins by wrapping it in an element with class `admin-only` and adding `body:not(.admin) .admin-only{display:none}`.

- [ ] **Step 5: Load the app module (replace inline script)**

At the end of `<body>`, after deleting the original inline `<script>…</script>` app code:

```html
<script type="module" src="/app.js"></script>
```

- [ ] **Step 6: Verify structure**

Run: `node -e "const h=require('fs').readFileSync('index.html','utf8'); ['onboardingView','seedGate','dashboard','rosterList','confirmCount','nameSelect','confirmBtn','gateSeedInput','gateEnterBtn','gateMsg','verifyBadge','poolWrap','koAdd','koList','lbTable','adminLock','adminPassInput','adminUnlockBtn','runDrawBtn','seedInput','newGameBtn','rosterEditBox','rosterSaveBtn'].forEach(id=>{if(!h.includes('id=\"'+id+'\"')&&!h.includes(\"id='\"+id+\"'\")) throw new Error('missing #'+id); }); console.log('all §6 ids present');"`
Expected: `all §6 ids present`

> Note: `#newGameBtn` must also exist — add a **Start a new game** button inside `#adminBar` (or a small admin-only block in `#dashboard`): `<button class="act ghost admin-only" id="newGameBtn">Start a new game</button>`.

- [ ] **Step 7: Commit**

```bash
git add index.html
git commit -m "feat: phase-based markup (onboarding, seed gate, admin) + load app.js"
```

---

## Task 10 (Stage 2): Integration, provisioning & verification

**Files:** none new (config + manual verification). Done in the main session after Tasks 7–9 merge.

- [ ] **Step 1: Merge the three worktree branches into `feature/sweepstake-backend`** (or confirm all three committed onto it).

- [ ] **Step 2: Provision Neon + apply schema.** Create a Neon project/database, copy the pooled connection string. Apply schema:

Run: `psql "$DATABASE_URL" -f schema.sql`  (or paste `schema.sql` into the Neon SQL editor)
Expected: tables created; `SELECT count(*) FROM players;` → 24.

- [ ] **Step 3: Set Vercel env vars** (Project → Settings → Environment Variables):
  - `DATABASE_URL` = Neon pooled connection string
  - `ADMIN_PASSPHRASE` = a secret only Matt knows

- [ ] **Step 4: Local end-to-end with `vercel dev`.**

Run: `npx vercel dev` (with `.env` containing `DATABASE_URL` and `ADMIN_PASSPHRASE`)
Then:
  - `curl localhost:3000/api/state` → JSON with 24 players, `locked:false`.
  - `curl -XPOST localhost:3000/api/confirm -d '{"name":"Matt"}' -H 'content-type: application/json'` → `{"ok":true}`; re-fetch shows Matt `confirmed:true`.
  - `curl -XPOST localhost:3000/api/admin/draw -d '{"seed":"test","force":true}' -H 'content-type: application/json' -H 'x-admin-key: <pass>'` → state with `locked:true`, 24 assignments.
  - Wrong key → `401`.

- [ ] **Step 5: Browser smoke test** (two browser profiles):
  - Reset (`curl -XPOST .../api/admin/reset -H 'x-admin-key:<pass>'`) → onboarding shows.
  - Profile 1: confirm a name → counter increments; Profile 2 sees it within ~7s (poll).
  - Unlock admin → run draw → both profiles flip to seed gate.
  - Enter correct seed → dashboard + ✓ verified badge; wrong seed → rejection message.
  - As admin, enter a pool score and add a KO result → Profile 2's scoreboard updates within ~7s.

- [ ] **Step 6: Run unit tests once more.** `npm test` → all pass.

- [ ] **Step 7: Request code review** via superpowers:requesting-code-review before merging to `main`.

- [ ] **Step 8: Deploy.** Push branch; open Vercel preview; confirm the deployed preview works end-to-end; then merge to `main`.

---

## Notes for executors

- **Frozen interfaces:** spec §5 (API) and §6 (DOM ids). If reality forces a change, update the spec and notify the other agents — do not silently diverge.
- **Static module serving:** `index.html` loads `/app.js` which imports `/lib/*.js`. Vercel serves these static files as-is; ensure `lib/` is not ignored by any `.vercelignore`.
- **No secrets in client.** `DATABASE_URL` and `ADMIN_PASSPHRASE` are server-only env vars. The browser only ever holds the admin passphrase the banker types (in `sessionStorage`), sent per-request.
- **§10 bug fixes** (empty-confirm abort, pen dropdown scoping, name escaping) are folded into Task 8.
