# Family World Cup Sweepstake — Shared Backend & Onboarding

**Date:** 2026-06-09
**Status:** Approved design, ready for implementation plan

## 1. Goal

Turn the current single-file, `localStorage`-only sweepstake tracker into a shared
family app where:

- Everyone sees the **same live leaderboard** (no more screenshots).
- New visitors go through an **onboarding flow** so we know who is competing
  (roster confirmation + paid status).
- Once the draw is run, the page **prompts for the agreed seed** to enter/verify
  the game, instead of offering a "create a new draw" form.
- **Only the banker (Matt)** can run the draw, record results, mark people paid,
  or start a new game — gated by a passphrase.

The whole site is family-only and low-stakes; security is "honest ceremony,"
not a vault.

## 2. Architecture

**Stack:** static site on **Vercel** + **Neon** Postgres + **Vercel serverless
functions** (`/api/...`) as the only thing that touches the database.

- Neon has no public client key, no browser-side RLS, and no realtime push, so
  **the browser never talks to Neon directly.** One clean trust boundary at the API.
- **Reads:** browser calls `GET /api/state`, which queries Neon and returns the
  whole game as JSON. No DB credentials in the browser.
- **Writes:** browser → Vercel function → Neon.
- **Live updates:** the page **polls** `GET /api/state` every ~7s while open, and
  re-fetches immediately after any action. Polling re-renders everything *except*
  an input the user is currently editing, so admin score entry isn't disturbed.
- Secrets (`DATABASE_URL`, `ADMIN_PASSPHRASE`) live only in Vercel env vars.
- DB access uses the `@neondatabase/serverless` HTTP driver (works in Vercel's
  serverless runtime).

**The draw stays verifiable:** when the banker runs the draw, the *server* computes
the assignments from the seed (same mulberry32 algorithm) and locks them. When a
family member lands and types the agreed seed, their browser re-runs the shuffle
and checks it matches the stored draw → green "✓ verified" badge. The seed is the
entry/verification gate, not a "new draw" form. Only the admin can mint a new seed.

## 3. Repository structure

```
index.html              markup + styles + onboarding/seed-gate/admin views
app.js                  client logic (was inline <script>), now talks to /api
lib/teams.js            SHARED: STRONG, WEAK, GROUPS, PAIRS, TEAM, scoring consts
lib/draw.js             SHARED: hashSeed, mulberry32, shuffle, computeAssignments
lib/db.js               server-only: Neon connection + query helpers + getState()
api/state.js            GET  /api/state
api/confirm.js          POST /api/confirm
api/admin/draw.js       POST /api/admin/draw
api/admin/pool.js       POST /api/admin/pool
api/admin/ko.js         POST + DELETE /api/admin/ko
api/admin/paid.js       POST /api/admin/paid
api/admin/roster.js     POST /api/admin/roster
api/admin/reset.js      POST /api/admin/reset
schema.sql              Neon tables + seed data (game row + 24 default names)
package.json            adds @neondatabase/serverless
vercel.json             (if needed) routing/headers
```

`lib/teams.js` and `lib/draw.js` are **pure ES modules importable by both the
browser (`app.js`) and the serverless functions** — no duplication of the team
data or the RNG. This is what makes the draw computed server-side and verified
client-side use byte-identical logic.

## 4. Data model (Neon / Postgres)

The team list, group fixtures, scoring weights and the RNG are **static constants
in `lib/teams.js` / `lib/draw.js`**, not in the DB. The DB only holds what changes
during the sweepstake.

### `game` — single row (`id = 'current'`)
| column | type | notes |
|---|---|---|
| `id` | text PK | always `'current'` |
| `seed` | text | null until the draw is run |
| `locked` | boolean | false → onboarding; true → game is live |
| `assignments` | jsonb | `[{player, strong:[name,flag,rank], weak:[…]}]`, written by server on draw |
| `created_at` | timestamptz | |

### `players` — roster + onboarding state (separate table so family confirmations never clobber score edits)
| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text unique | |
| `position` | int | roster order |
| `confirmed` | boolean default false | family sets via `/api/confirm` |
| `paid` | boolean default false | banker sets |

### `pool_results` — group-stage scorelines
| column | type | notes |
|---|---|---|
| `match_id` | text PK | e.g. `"A-0-1"` (group + PAIRS indices — same key the app already uses) |
| `home_score` | int | |
| `away_score` | int | |

### `ko_results` — knockout matches
| column | type | notes |
|---|---|---|
| `id` | serial PK | |
| `round` | text | `r32 / r16 / qf / sf / final` |
| `team_a`, `team_b` | text | |
| `score_a`, `score_b` | int | |
| `pen_winner` | text | null unless drawn |

**Standings + leaderboard are derived client-side** by the existing `deriveAll` /
`teamPts` logic (ported to `app.js`, importing constants from `lib/teams.js`).
We keep the proven scoring code, just feed it from the API instead of `localStorage`.

`schema.sql` seeds the `game` row (`locked=false`) and the 24 default names so the
banker starts with the roster pre-filled.

## 5. API contract (FROZEN — the coordination interface)

All responses are JSON. Admin endpoints require header `x-admin-key: <passphrase>`;
wrong/missing → `401`.

### `GET /api/state` → 200
```json
{
  "locked": false,
  "seed": null,
  "players": [
    {"name": "Matt", "position": 0, "confirmed": true, "paid": true}
  ],
  "assignments": null,
  "pool": { "A-0-1": [2, 1] },
  "ko": [
    {"id": 1, "round": "r32", "a": "France", "b": "Iraq", "as": 3, "bs": 0, "pen": null}
  ]
}
```
`assignments` is `null` until the draw is locked, then the stored array. `pool`
values are `[home, away]` int pairs. `ko[].pen` is the penalty-winner team name or null.

### `POST /api/confirm` (public) — body `{ "name": "Claire" }`
Sets `confirmed = true` for that rostered name. Idempotent. → `200 {"ok": true}`.
`400` if the name isn't on the roster.

### `POST /api/admin/roster` — body `{ "names": ["Matt", "Claire", …] }`
Allowed only when `locked = false`. Upserts the roster by name, preserving
`confirmed`/`paid` for surviving names, removing absent ones, resetting positions.
→ `200` (returns full state).

### `POST /api/admin/draw` — body `{ "seed": "opening-day-2026", "force": false }`
Requires `locked = false`. Unless `force`, requires exactly 24 roster players.
Server computes assignments deterministically via `lib/draw.js`, sets `game.seed`,
`locked = true`, `assignments`. → `200` (full state). `409` if already locked.

### `POST /api/admin/pool` — body `{ "match_id": "A-0-1", "home": 2, "away": 1 }`
Upserts the scoreline. `home`/`away` may be `null` to clear (deletes the row).
→ `200 {"ok": true}`.

### `POST /api/admin/ko` — body `{ "round": "r32", "a": "France", "b": "Iraq", "as": 3, "bs": 0, "pen": null }`
Inserts a knockout result. → `200 {"id": <new id>}`.
### `DELETE /api/admin/ko` — body `{ "id": 1 }` → `200 {"ok": true}`.

### `POST /api/admin/paid` — body `{ "name": "Claire", "paid": true }` → `200 {"ok": true}`.

### `POST /api/admin/reset` — no body. Clears `seed`, sets `locked=false`,
`assignments=null`, deletes all `pool_results` + `ko_results`, resets every
player's `confirmed`/`paid` to false. **Keeps the roster names.** → `200` (full state).
Client guards this behind a confirm dialog.

## 6. DOM-id contract (FROZEN — enables splitting front-end work)

`index.html` provides these element ids; `app.js` binds to exactly these. Freezing
this list lets markup and client-logic be built by separate agents in parallel.

- **Phases / containers:** `#onboardingView`, `#seedGate`, `#dashboard`
- **Onboarding:** `#rosterList` (confirm rows), `#confirmCount` (`X / 24`),
  `#nameSelect`, `#confirmBtn`
- **Seed gate:** `#gateSeedInput`, `#gateEnterBtn`, `#gateMsg`
- **Draw tab (locked):** `#drawTable`, `#verifyBadge`, `#resultLead`
- **Fixtures:** `#poolWrap`, `#koRound`, `#koA`, `#koB`, `#koAS`, `#koBS`,
  `#koPen`, `#koAdd`, `#koList`
- **Scoreboard:** `#lbTable`
- **Tabs:** `nav.tabs .tab[data-view]`, `section.view[id]` (draw/fixtures/board/rules)
- **Admin:** `#adminLock` (icon), `#adminPassInput`, `#adminUnlockBtn`,
  `#adminBar` (shown when unlocked), `#runDrawBtn`, `#seedInput`, `#newGameBtn`,
  `#rosterEditBox`, `#rosterSaveBtn`

Admin-only controls are hidden by a `body.admin` class toggled on unlock; family
view is the default. The passphrase is held in `sessionStorage` and sent as the
`x-admin-key` header on every admin write.

## 7. Screen-by-screen flow

On load, fetch `/api/state` and branch:

**Phase 1 — Onboarding (`locked = false`).** Family see **"Are you in?"**: pick
your name → tap **I'm in** (`POST /api/confirm`). A live **"X / 24 confirmed"**
counter and roster list show who's confirmed and paid. No draw visible yet.

**Phase 2 — Live (`locked = true`).** Family hit the **seed gate**: enter the agreed
seed → browser recomputes the draw from the seed + roster and compares to the stored
`assignments`. Match → dashboard unlocks (Draw / Fixtures / Scoreboard / Rules,
read-only) with the ✓ verified badge; entry remembered in `localStorage`. Scoreboard
polls every ~7s.

**Admin mode (any phase).** `#adminLock` → passphrase → `body.admin` on:
- *Onboarding:* edit roster, mark paid, watch confirmations, **Run the draw**
  (the only place a seed is created).
- *Live:* score inputs + KO recorder become editable, mark paid, guarded
  **Start a new game**.

## 8. Parallelization plan (concurrent-agent delivery)

Work is decomposed so independent agents build against frozen interfaces. Run each
parallel agent in its own **git worktree**, then integrate.

### Stage 0 — Foundation (blocks everything; small, do first)
**One agent.** Produces the shared contracts everyone else consumes:
- `package.json`, `vercel.json`
- `lib/teams.js` — port `STRONG`, `WEAK`, `GROUPS`, `PAIRS`, `TEAM`, scoring consts
  from the current `index.html` (verbatim values).
- `lib/draw.js` — port `hashSeed`, `mulberry32`, `shuffle`; add
  `computeAssignments(seed, playerNames)` returning the assignments array.
- `lib/db.js` — Neon connection helper + typed query helpers + `getState()` composer
  returning the `GET /api/state` shape.
- `schema.sql` — tables from §4 + seed data.

Sections §5 (API contract) and §6 (DOM-id contract) are also frozen here.

### Stage 1 — Fan-out (parallel, after Stage 0)
- **Agent A — Backend (`api/` dir).** Implements every endpoint in §5 against
  `lib/db.js` + `lib/draw.js` + `lib/teams.js`. Owns `api/**` exclusively.
- **Agent B — Client logic (`app.js`).** Fetch + 7s poll, phase routing, `/api`
  write calls, seed verification (via `lib/draw.js`), port `deriveAll`/`teamPts`
  (importing `lib/teams.js`), render functions bound to §6 ids. Owns `app.js`
  exclusively.
- **Agent C — Markup & styles (`index.html`).** Onboarding view, seed gate,
  admin bar/lock, read-only vs `body.admin` states, exposing exactly the §6 ids
  and loading `app.js`. Owns `index.html` exclusively.

A, B, C touch disjoint files and share only §5/§6 → no merge conflicts.

### Stage 2 — Integration & verification (single agent / main session)
- Merge worktrees, create Neon DB + run `schema.sql`, set Vercel env vars.
- End-to-end smoke test: onboarding → confirm → run draw → seed gate verify →
  record pool + KO scores → leaderboard updates via poll on a second client.
- Deploy preview on Vercel; final review.

**Dependency graph:** `Stage 0  →  {A ∥ B ∥ C}  →  Stage 2`.

## 9. Non-goals (YAGNI)

- No per-user accounts/login beyond the single admin passphrase.
- No multiple concurrent games / history — one `game` row, `reset` starts fresh.
- No realtime websockets — polling is sufficient for family scale.
- No server-side standings/leaderboard computation — stays client-side.
- No changes to the scoring rules, prize split, or team dataset values
  (a separate data-accuracy check against the real 2026 draw is recommended but
  out of scope here).

## 10. Carry-over bug fixes (fold in during the port)

From the earlier review of `index.html`, fix while porting:
- The "knockout ended level" confirm with an empty `if` body — make Cancel abort.
- `koPen` dropdown should list only the two selected teams, not all 48.
- Escape player names on render (avoid HTML injection from roster input).

## 11. Addendum — Stitch **Express** payments (self-pay, auto-confirm)

Players pay their R250 entry in-app via **Stitch Express**; a Svix-verified webhook
flips `players.paid` automatically. The banker can still override `paid` via
`/api/admin/paid`.

> **Important:** this targets the **Stitch Express REST API** at
> `https://express.stitch.money/api/v1` — a *separate product* from the Stitch
> Enterprise/Connect GraphQL API at `api.stitch.money`. Express is built around
> **payment links**, amounts are in **ZAR cents**, tokens last **15 min**, and
> webhooks are delivered via **Svix**. The hosted checkout chooses payment methods
> (no card/Apple-Pay flags in the request).

**Flow:** onboarding "Pay R250" → `POST /api/pay {name}` (server mints a 15-min
token, creates a payment link, stores the link id, returns the checkout URL with our
registered `redirect_url` appended) → browser redirects to the Stitch checkout →
payer pays → Stitch posts to `POST /api/stitch/webhook` → **Svix signature
verified** → on `payment.paid` (type `LINK`) `paid=true` for the player whose stored
link id matches `linkId`. The return redirect is informational; the **webhook is
authoritative**. The 7s poll surfaces the ✓ to everyone.

**Stitch Express contract (`/api/v1`):**
- Auth: `POST /token`, JSON `{ clientId, clientSecret, scope? }`
  → `{ success, data:{ accessToken } }` (JWT, 15-min, `Authorization: Bearer`).
- Create: `POST /payment-links`, Bearer, JSON `{ amount:25000 (cents), payerName (3–40),
  merchantReference }` → `{ data:{ payment:{ id, link, status, ... } } }`. The checkout
  URL is `data.payment.link`; append `?redirect_url=<encoded, pre-registered origin>`.
- Webhook (Svix): payload `{ amount, id, status:"PAID", type:"LINK", linkId, ... }`;
  verify headers `svix-id`/`svix-timestamp`/`svix-signature` against the RAW body using
  the `svix` library + the signing secret; respond 2XX. Map `linkId` → stored
  `players.payment_id`. Handler is idempotent.
- Fallback if webhooks unavailable: poll `GET /payment/{id}` (status `PAID`/`SETTLED`).

**Env vars (Vercel, server-only):** `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET`,
`STITCH_WEBHOOK_SECRET` (the `whsec_…` returned when registering the webhook),
`SITE_URL` (the registered redirect origin, e.g. the production URL). No beneficiary
bank details needed.

**Schema:** `players.payment_ref` (our `merchantReference`) + `players.payment_id`
(the Stitch payment-link id) — already applied to Neon and in `schema.sql`.

**One-time Stitch setup (Bearer token required, via dashboard or API):**
- `POST /api/v1/redirect-urls { redirectUrl }` — register the site origin **without a
  trailing slash / query** (`https://<site>`); max 5, byte-exact match.
- `POST /api/v1/webhook { url }` → `https://<site>/api/stitch/webhook`; store the
  returned `secret` as `STITCH_WEBHOOK_SECRET`.

**Caveat:** live payment leg untestable until client credentials (test- prefixed)
are provided.
