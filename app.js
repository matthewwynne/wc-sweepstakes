// Client logic for the shared sweepstake. Loaded as <script type="module" src="/app.js">.
// Sources all data from GET /api/state; writes go through /api; admin writes carry
// the x-admin-key header. Pure logic (teams, scoring, draw) is imported from /lib.
import { TEAM, GROUPS, PAIRS, ALL_TEAMS, STAGE_ORDER, KO_LABEL, POOL_WIN, MATCH_DATES, KO_DATES, RANKINGS } from '/lib/teams.js';
import { deriveAll, teamPts, standingsFor, leaderboardRows } from '/lib/scoring.js';
import { computeAssignments } from '/lib/draw.js';
import { prizes } from '/lib/prizes.js';

let STATE = { locked: false, seed: null, paymentsEnabled: false, players: [], assignments: null, pool: {}, ko: [] };
let POLL = null;

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); // §10 fix
function adminKey() { return sessionStorage.getItem('sweep:admin') || ''; }
function isAdmin() { return !!adminKey(); }

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

// Format an ISO date (YYYY-MM-DD) as e.g. "Thu 11 Jun" — parsed at noon UTC so the
// calendar day never shifts with the viewer's timezone.
function fmtMatchDate(iso) {
  const d = new Date(iso + 'T12:00:00Z');
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
  return wd + ' ' + d.getUTCDate() + ' ' + mo;
}

// Wikipedia-style round date range, e.g. "28 June – 3 July 2026" / "19 July 2026".
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function fmtKoRange(from, to) {
  const f = new Date(from + 'T12:00:00Z'), t = new Date(to + 'T12:00:00Z');
  const yr = t.getUTCFullYear();
  if (from === to) return f.getUTCDate() + ' ' + MONTHS_FULL[f.getUTCMonth()] + ' ' + yr;
  // Same month → "4–7 July 2026"; spanning months → "28 June – 3 July 2026".
  if (f.getUTCMonth() === t.getUTCMonth()) return f.getUTCDate() + '–' + t.getUTCDate() + ' ' + MONTHS_FULL[t.getUTCMonth()] + ' ' + yr;
  return f.getUTCDate() + ' ' + MONTHS_FULL[f.getUTCMonth()] + ' – ' + t.getUTCDate() + ' ' + MONTHS_FULL[t.getUTCMonth()] + ' ' + yr;
}

/* ===================================================================== */
/*  API HELPERS                                                          */
/* ===================================================================== */
async function getStateText() { const r = await fetch('/api/state'); return r.text(); }
async function getState() { return JSON.parse(await getStateText()); }

// Cache the raw text of the last state we rendered so the poll can skip a full
// re-render when nothing changed. force=true always renders (used by refresh()).
let lastStateText = null;
async function syncState(force) {
  const txt = await getStateText();
  if (!force && txt === lastStateText) return false; // byte-identical → skip render
  lastStateText = txt;
  STATE = JSON.parse(txt);
  renderAll();
  return true;
}

async function post(path, body, admin = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (admin) headers['x-admin-key'] = adminKey();
  const r = await fetch(path, {
    method: body && body.__method === 'DELETE' ? 'DELETE' : 'POST',
    headers,
    body: JSON.stringify(body || {})
  });
  if (r.status === 401) {
    alert('Admin passphrase rejected.');
    sessionStorage.removeItem('sweep:admin');
    throw new Error('unauthorized');
  }
  return r.json();
}

async function refresh() { await syncState(true); }

/* ===================================================================== */
/*  PHASE ROUTING                                                        */
/* ===================================================================== */
function renderAll() {
  renderMoney();
  document.body.classList.toggle('admin', isAdmin());
  if (!STATE.locked) {
    show('onboarding');
    renderOnboarding();
  } else if (!gateUnlocked() && !isAdmin()) {
    show('seedgate');
  } else {
    show('dashboard');
    renderDraw();
    renderFixtures(); // also renders the board via refreshDerived()
  }
}

function show(phase) {
  if ($('onboardingView')) $('onboardingView').style.display = phase === 'onboarding' ? 'block' : 'none';
  if ($('seedGate')) $('seedGate').style.display = phase === 'seedgate' ? 'block' : 'none';
  if ($('dashboard')) $('dashboard').style.display = phase === 'dashboard' ? 'block' : 'none';
}

function gateUnlocked() { return localStorage.getItem('sweep:seed') === STATE.seed && !!STATE.seed; }

/* ===================================================================== */
/*  ONBOARDING                                                           */
/* ===================================================================== */
function renderOnboarding() {
  const confirmed = STATE.players.filter(p => p.confirmed).length;
  $('confirmCount').textContent = confirmed + ' / ' + STATE.players.length + ' confirmed';
  const admin = isAdmin();
  $('rosterList').innerHTML = STATE.players.map(p => {
    const pay = (STATE.paymentsEnabled && p.confirmed && !p.paid)
      ? '<button class="act go pay-btn" data-pay="' + esc(p.name) + '" style="padding:6px 12px;font-size:11px">Pay R250</button>'
      : '';
    // Admin: toggle a player's confirmation (clear a mistaken "I'm in", or mark someone in).
    const toggle = admin
      ? (p.confirmed
          ? '<button class="del confirm-toggle" data-name="' + esc(p.name) + '" data-confirmed="false" title="Clear this confirmation">✕</button>'
          : '<button class="act ghost confirm-toggle" data-name="' + esc(p.name) + '" data-confirmed="true" style="padding:4px 10px;font-size:11px">Mark in</button>')
      : '';
    return '<div class="rrow"><span>' + esc(p.name) + '</span>'
      + '<span class="rstatus">' + (p.confirmed ? '✓ in' : '—')
      + (p.paid ? ' · \u{1F4B0} paid' : '') + '</span>'
      + pay + toggle
      + '</div>';
  }).join('');
  $('nameSelect').innerHTML = '<option value="">— pick your name —</option>'
    + STATE.players.filter(p => !p.confirmed).map(p => '<option>' + esc(p.name) + '</option>').join('');
  // admin: roster editor (only repopulate when not focused so edits aren't clobbered)
  if ($('rosterEditBox') && document.activeElement !== $('rosterEditBox')) {
    $('rosterEditBox').value = STATE.players.map(p => p.name).join('\n');
  }
  // Once the draw is locked the roster must not be editable (server guards this too).
  if ($('rosterEditBox')) $('rosterEditBox').readOnly = !!STATE.locked;
  if ($('rosterSaveBtn')) $('rosterSaveBtn').disabled = !!STATE.locked;
  // Payments on/off toggle state
  if ($('paymentsState')) $('paymentsState').textContent = STATE.paymentsEnabled ? 'ON' : 'off';
  if ($('paymentsToggle')) $('paymentsToggle').textContent = STATE.paymentsEnabled ? 'Disable payments' : 'Enable payments';
}

/* ===================================================================== */
/*  SEED GATE + VERIFICATION                                             */
/* ===================================================================== */
function verifyBadge() {
  if (!STATE.seed || !STATE.assignments) return '';
  // Verify against the player list captured IN the assignments themselves, not the
  // current roster — this is immune to later roster edits and proves the stored
  // strong/weak teams match what seed+those-players produce.
  const recomputed = computeAssignments(STATE.seed, STATE.assignments.map(a => a.player));
  // Compare canonically: jsonb reorders object keys on storage, so a raw
  // JSON.stringify would mismatch identical draws. Compare player→teams tuples.
  const norm = a => a.map(x => x.player + '|' + x.strong[0] + '|' + x.weak[0]).join(';');
  const ok = norm(recomputed) === norm(STATE.assignments);
  return ok ? '<span class="prize">✓ verified — matches the seed</span>'
            : '<span class="prize wild">⚠ does not match seed</span>';
}

/* ===================================================================== */
/*  RENDER: DRAW                                                         */
/* ===================================================================== */
function teamChip(name, tier) {
  const t = TEAM[name] || { flag: '', rank: '' };
  return '<span class="team"><span class="flag">' + t.flag + '</span>' + esc(name)
    + ' <span class="rk ' + (tier === 's' ? 'tier-s' : 'tier-w') + '">#' + t.rank + '</span></span>';
}

function renderDraw() {
  const assignments = STATE.assignments || [];
  if ($('verifyBadge')) $('verifyBadge').innerHTML = verifyBadge();
  if ($('resultLead')) {
    $('resultLead').innerHTML = STATE.seed
      ? 'Drawn with seed <b style="color:var(--green);font-family:\'Space Mono\',monospace">"' + esc(STATE.seed) + '"</b>.'
      : '';
  }
  if (!assignments.length) {
    if ($('drawTable')) $('drawTable').innerHTML = '';
    return;
  }
  let h = '<thead><tr><th>Player</th><th>Strong team (1–24)</th><th>Wildcard (25–48)</th></tr></thead><tbody>';
  assignments.forEach(a => {
    h += '<tr><td class="pl-name">' + esc(a.player) + '</td><td>' + teamChip(a.strong[0], 's') + '</td><td>' + teamChip(a.weak[0], 'w') + '</td></tr>';
  });
  if ($('drawTable')) $('drawTable').innerHTML = h + '</tbody>';
}

/* ===================================================================== */
/*  RENDER: FIXTURES (pool inputs built once) + KO recorder              */
/* ===================================================================== */
// The pool accordions + KO <select> option lists depend only on static
// GROUPS/PAIRS/ALL_TEAMS, so build them ONCE. The 7s poll then only updates
// score-input values and the derived standings/leaderboard, preserving
// <details> open/closed state and any in-progress KO selections.
let fixturesBuilt = false;

function buildFixturesScaffold() {
  const disabled = isAdmin() ? '' : ' disabled';
  // pool fixtures
  let h = '';
  for (const g in GROUPS) {
    const teams = GROUPS[g];
    let body = '';
    PAIRS.forEach(([i, j], k) => {
      const mid = g + '-' + i + '-' + j;
      const sc = STATE.pool[mid] || ['', ''];
      const a = teams[i], b = teams[j];
      const dt = (MATCH_DATES[g] || [])[k];
      if (dt) body += '<div style="text-align:center;font-family:\'Space Mono\',monospace;font-size:10px;letter-spacing:1px;color:var(--muted);margin-top:8px">' + fmtMatchDate(dt) + '</div>';
      body += '<div class="fix">'
        + '<div class="ta"><span class="nm2">' + esc(a) + '</span><span class="flag">' + TEAM[a].flag + '</span></div>'
        + '<div class="scbox"><input class="sc" type="number" min="0" data-mid="' + mid + '" data-side="0" value="' + (sc[0] ?? '') + '"' + disabled + '>'
        + '<span class="vs">v</span>'
        + '<input class="sc" type="number" min="0" data-mid="' + mid + '" data-side="1" value="' + (sc[1] ?? '') + '"' + disabled + '></div>'
        + '<div class="tb"><span class="flag">' + TEAM[b].flag + '</span><span class="nm2">' + esc(b) + '</span></div>'
        + '</div>';
    });
    h += '<details class="grp"><summary>Group ' + g + ' <span class="caret">tap</span></summary>'
      + '<div class="body">' + body + '<div class="stand-wrap" data-grp="' + g + '"></div></div></details>';
  }
  if ($('poolWrap')) $('poolWrap').innerHTML = h;

  // knockout team selectors (option lists are static)
  if ($('koA') && $('koB')) {
    const opts = '<option value="">— team —</option>' + ALL_TEAMS.map(n => '<option value="' + esc(n) + '">' + TEAM[n].flag + '  ' + esc(n) + '</option>').join('');
    $('koA').innerHTML = opts;
    $('koB').innerHTML = opts;
  }
  syncKoPen();

  // Knockout round schedule (static reference, Wikipedia-style round → dates).
  if ($('koDates')) {
    $('koDates').innerHTML = '<table class="stand"><thead><tr><th>Round</th><th style="text-align:right">Dates</th></tr></thead><tbody>'
      + KO_DATES.map(r =>
          '<tr><td>' + r.label + '</td>'
          + '<td class="num" style="text-align:right;font-family:\'Space Mono\',monospace;color:var(--gold)">' + fmtKoRange(r.from, r.to) + '</td></tr>'
        ).join('')
      + '</tbody></table>';
  }
  fixturesBuilt = true;
}

function renderFixtures() {
  if (!fixturesBuilt) buildFixturesScaffold();
  else {
    // Subsequent calls: only update score-input values from STATE.pool, never
    // re-innerHTML the wrap/selects (preserves <details> state + KO selections).
    // Skip the focused input so we don't clobber what the admin is typing.
    document.querySelectorAll('#poolWrap .sc').forEach(inp => {
      if (document.activeElement === inp) return;
      const sc = STATE.pool[inp.dataset.mid] || ['', ''];
      const v = sc[+inp.dataset.side];
      inp.value = (v ?? '') === '' ? '' : v;
    });
  }
  renderKoList();
  refreshDerived();
}

function renderKoList() {
  const el = $('koList');
  if (!el) return;
  if (!STATE.ko.length) {
    el.innerHTML = '<p class="ko-emptynote">No knockout results yet. They start with the Round of 32 on 28 June.</p>';
    return;
  }
  // group by round in tournament order; delete button carries the DB row id (§ data-koid)
  let h = '';
  STAGE_ORDER.slice(1).forEach(rd => {
    STATE.ko.filter(m => m.round === rd).forEach(m => {
      const aWon = (+m.as > +m.bs) || (m.as === m.bs && m.pen === m.a);
      const bWon = (+m.bs > +m.as) || (m.as === m.bs && m.pen === m.b);
      const pens = (m.as === m.bs && m.pen) ? ' <span class="rk">(pens ' + esc(m.pen) + ')</span>' : '';
      h += '<div class="kom"><span class="round-tag">' + KO_LABEL[rd] + '</span>'
        + '<span class="res"><span class="' + (aWon ? 'won' : '') + '">' + TEAM[m.a].flag + ' ' + esc(m.a) + '</span> '
        + '<span class="sc-txt">' + m.as + '–' + m.bs + '</span> '
        + '<span class="' + (bWon ? 'won' : '') + '">' + esc(m.b) + ' ' + TEAM[m.b].flag + '</span>' + pens + '</span>'
        + '<button class="del" data-koid="' + m.id + '" title="Delete">×</button></div>';
    });
  });
  el.innerHTML = h;
}

// Recompute standings tables + leaderboard WITHOUT touching the score inputs (keeps focus).
function refreshDerived() {
  const d = deriveAll(STATE);
  document.querySelectorAll('.stand-wrap').forEach(wrap => {
    const g = wrap.dataset.grp;
    const rows = standingsFor(g, d);
    let t = '<table class="stand"><thead><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">D</th><th class="num">L</th><th class="num">GF</th><th class="num">GA</th><th class="num">GD</th><th class="num">Pts</th></tr></thead><tbody>';
    rows.forEach((r, i) => {
      const cls = i < 2 ? 'pos' + (i + 1) : (i === 2 ? 'pos3' : '');
      t += '<tr class="' + cls + '"><td class="num">' + (i + 1) + '</td><td><span class="tn"><span class="flag">' + TEAM[r.n].flag + '</span>' + esc(r.n) + '</span></td>'
        + '<td class="num">' + r.pld + '</td><td class="num">' + r.w + '</td><td class="num">' + r.d + '</td><td class="num">' + r.l + '</td>'
        + '<td class="num">' + r.gf + '</td><td class="num">' + r.ga + '</td><td class="num">' + (r.gd > 0 ? '+' : '') + r.gd + '</td><td class="num" style="color:var(--green);font-weight:700">' + r.pts + '</td></tr>';
    });
    wrap.innerHTML = t + '</tbody></table>';
  });
  renderBoard(d);
}

/* ===================================================================== */
/*  RENDER: SCOREBOARD                                                   */
/* ===================================================================== */
function renderBoard(d) {
  d = d || deriveAll(STATE);
  const lb = $('lbTable');
  if (!lb) return;
  const assignments = STATE.assignments || [];
  if (!assignments.length) {
    lb.innerHTML = '<tbody><tr><td><div class="empty">The draw hasn’t happened yet.</div></td></tr></tbody>';
    return;
  }
  const rows = leaderboardRows(assignments, d);
  const pz = prizes(rows.length);
  let bestWild = -1; rows.forEach(r => { if (r.wp > bestWild) bestWild = r.wp; });
  let h = '<thead><tr><th>#</th><th>Player</th><th>Strong</th><th>Wildcard</th><th style="text-align:right">Str</th><th style="text-align:right">Wild</th><th style="text-align:right">Total</th><th style="text-align:right">GF</th></tr></thead><tbody>';
  rows.forEach((r, i) => {
    const pos = i + 1; let prize = '';
    if (pos === 1) prize = '<span class="prize">' + rand(pz.first) + '</span>';
    else if (pos === 2) prize = '<span class="prize">' + rand(pz.second) + '</span>';
    else if (pos === 3) prize = '<span class="prize">' + rand(pz.third) + '</span>';
    const wild = (r.wp === bestWild && bestWild > 0) ? '<span class="prize wild">' + rand(pz.wildcard) + '</span>' : '';
    h += '<tr><td class="lb-rank ' + (pos <= 3 ? 'p' + pos : '') + '">' + pos + '</td>'
      + '<td class="pl-name">' + esc(r.player) + prize + wild + '</td>'
      + '<td>' + teamChip(r.strong, 's') + '</td><td>' + teamChip(r.weak, 'w') + '</td>'
      + '<td class="pts">' + r.sp + '</td><td class="pts">' + r.wp + '</td><td class="pts tot">' + r.total + '</td><td class="gf">' + r.gf + '</td></tr>';
  });
  lb.innerHTML = h + '</tbody>';
}

// keep pen dropdown to the two chosen teams — §10 fix
function syncKoPen() {
  if (!$('koPen')) return;
  const a = $('koA') ? $('koA').value : '';
  const b = $('koB') ? $('koB').value : '';
  const opts = ['<option value="">If drawn, won on pens by…</option>']
    .concat([a, b].filter(Boolean).map(n => '<option value="' + esc(n) + '">' + esc(n) + '</option>'));
  $('koPen').innerHTML = opts.join('');
}

/* ===================================================================== */
/*  EVENT HANDLERS                                                       */
/* ===================================================================== */
function on(id, evt, fn) { const el = $(id); if (el) el.addEventListener(evt, fn); }

// Onboarding: confirm a player (public)
on('confirmBtn', 'click', async () => {
  const name = $('nameSelect').value;
  if (!name) return;
  await post('/api/confirm', { name });
  await refresh();
});

// Onboarding: player self-pay (public) — redirects to Stitch hosted checkout
$('rosterList').addEventListener('click', async e => {
  // Admin: toggle a player's confirmed flag
  const tog = e.target.closest('.confirm-toggle');
  if (tog) {
    if (!isAdmin()) return;
    tog.disabled = true;
    const r = await post('/api/admin/confirm', { name: tog.dataset.name, confirmed: tog.dataset.confirmed === 'true' }, true);
    if (r && r.error) alert('Could not update: ' + r.error);
    await refresh();
    return;
  }
  const btn = e.target.closest('.pay-btn'); if (!btn) return;
  btn.disabled = true; btn.textContent = 'Redirecting…';
  try {
    const r = await post('/api/pay', { name: btn.dataset.pay });
    if (r && r.url) { window.location.href = r.url; }
    else { alert('Could not start payment: ' + ((r && r.error) || 'unknown')); btn.disabled=false; btn.textContent='Pay R250'; }
  } catch (err) { alert('Payment error.'); btn.disabled=false; btn.textContent='Pay R250'; }
});

// Seed gate: enter the agreed seed to verify + unlock
on('gateEnterBtn', 'click', () => {
  const typed = $('gateSeedInput').value.trim();
  if (typed === STATE.seed && STATE.seed) {
    localStorage.setItem('sweep:seed', typed);
    renderAll();
  } else if ($('gateMsg')) {
    $('gateMsg').textContent = "That's not the seed for this game.";
  }
});

// Pool score entry (admin only)
on('poolWrap', 'input', async e => {
  const inp = e.target.closest('.sc');
  if (!inp || !isAdmin()) return;
  const mid = inp.dataset.mid, side = +inp.dataset.side;
  const cur = STATE.pool[mid] || ['', ''];
  cur[side] = inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0);
  STATE.pool[mid] = cur;
  await post('/api/admin/pool', { match_id: mid, home: cur[0], away: cur[1] }, true);
  refreshDerived(); // local re-render; poll will reconcile
});

// KO add — §10 fixes: Cancel aborts a level KO; pen dropdown limited to two teams
on('koAdd', 'click', async () => {
  if (!isAdmin()) return;
  const round = $('koRound').value, a = $('koA').value, b = $('koB').value;
  const as = $('koAS').value, bs = $('koBS').value, pen = $('koPen').value;
  if (!a || !b) return alert('Pick both teams.');
  if (a === b) return alert('A team can’t play itself.');
  if (as === '' || bs === '') return alert('Enter both scores.');
  if (+as === +bs && !pen) {
    if (!confirm('Knockouts can’t end level. Add anyway with no winner advancing?')) return; // §10 fix: Cancel aborts
  }
  await post('/api/admin/ko', { round, a, b, as: +as, bs: +bs, pen: (+as === +bs ? pen : '') }, true);
  $('koAS').value = ''; $('koBS').value = ''; $('koPen').value = '';
  await refresh();
});

on('koA', 'change', syncKoPen);
on('koB', 'change', syncKoPen);

// KO delete (by DB id)
on('koList', 'click', async e => {
  const btn = e.target.closest('.del');
  if (!btn || !isAdmin()) return;
  await post('/api/admin/ko', { __method: 'DELETE', id: +btn.dataset.koid }, true);
  await refresh();
});

// Admin unlock
on('adminUnlockBtn', 'click', () => {
  const pass = $('adminPassInput').value.trim();
  if (pass) { sessionStorage.setItem('sweep:admin', pass); renderAll(); }
});

// Admin: run the draw
on('runDrawBtn', 'click', async () => {
  const seed = $('seedInput').value.trim();
  if (!seed) return alert('Enter a seed first.');
  const r = await post('/api/admin/draw', { seed }, true);
  if (r && r.error === 'too_many_players') {
    return alert('Too many players (' + r.count + '). Maximum is 24.');
  }
  if (r && r.error === 'too_few_players') {
    if (!confirm('You have ' + r.count + ' players (minimum 2 needed). Draw anyway?')) return;
    await post('/api/admin/draw', { seed, force: true }, true);
  }
  await refresh();
});

// Admin: save roster
on('rosterSaveBtn', 'click', async () => {
  const names = $('rosterEditBox').value.split('\n').map(s => s.trim()).filter(Boolean);
  const r = await post('/api/admin/roster', { names }, true);
  if (r && r.error === 'locked') {
    alert('Roster is locked — the draw has been run.');
    await refresh();
    return;
  }
  await refresh();
});

// Admin: toggle in-app payments on/off
on('paymentsToggle', 'click', async () => {
  await post('/api/admin/payments', { enabled: !STATE.paymentsEnabled }, true);
  await refresh();
});

// Admin: start a new game (guarded)
on('newGameBtn', 'click', async () => {
  if (!confirm('Start a new game? This clears the draw and all results.')) return;
  await post('/api/admin/reset', {}, true);
  localStorage.removeItem('sweep:seed');
  await refresh();
});

// Tabs
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const v = document.getElementById(t.dataset.view);
  if (v) v.classList.add('active');
}));

/* ===================================================================== */
/*  POLLING + INIT                                                       */
/* ===================================================================== */
function startPolling() {
  if (POLL) return;
  POLL = setInterval(async () => {
    // don't clobber an input the user is editing
    if (document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select')) return;
    // syncState skips the full re-render when the payload is byte-identical
    await syncState(false);
  }, 7000);
}

// If we just came back from Stitch, show a transient note (webhook is authoritative;
// the 7s poll will flip the ✓ to paid). Clean the URL so it doesn't re-trigger.
function handlePayReturn() {
  // Stitch Express appends ?reference=...&payment_id=... to the registered redirect URL.
  const q = new URLSearchParams(location.search);
  if (!q.get('payment_id') && !q.get('reference')) return;
  if ($('confirmCount')) $('confirmCount').textContent = '✓ Thanks — confirming your payment, it’ll show as paid shortly.';
  else alert('✓ Thanks — confirming your payment, it’ll show as paid shortly.');
  history.replaceState({}, '', location.pathname);
}

// Static three-way ranking comparison (our seeding vs bookies vs FIFA vs Elo),
// ordered by our seed rank. Built once — the data never changes during the run.
function renderRankings() {
  const el = $('rankTable'); if (!el) return;
  const rows = ALL_TEAMS
    .map(n => ({ n, tier: TEAM[n].tier, our: TEAM[n].rank, ...(RANKINGS[n] || {}) }))
    .sort((a, b) => a.our - b.our);
  let h = '<thead><tr><th>#</th><th>Team</th><th class="num" style="text-align:right">Bookies</th>'
    + '<th class="num" style="text-align:right">FIFA</th><th class="num" style="text-align:right">Elo</th></tr></thead><tbody>';
  rows.forEach(r => {
    h += '<tr><td class="rk">' + r.our + '</td>'
      + '<td><span class="team"><span class="flag">' + TEAM[r.n].flag + '</span>' + esc(r.n)
      + ' <span class="rk ' + (r.tier === 's' ? 'tier-s' : 'tier-w') + '">' + (r.tier === 's' ? 'S' : 'W') + '</span></span></td>'
      + '<td class="num" style="text-align:right" title="' + (r.price != null ? r.price + ' to win' : '') + '">' + (r.bookies ?? '–') + '</td>'
      + '<td class="num" style="text-align:right">' + (r.fifa ?? '–') + '</td>'
      + '<td class="num" style="text-align:right">' + (r.elo ?? '–') + '</td></tr>';
  });
  el.innerHTML = h + '</tbody>';
}

(async function () { renderRankings(); await refresh(); handlePayReturn(); startPolling(); })();
