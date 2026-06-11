import { neon } from '@neondatabase/serverless';
import { computeAssignments } from './draw.js';

// Resolve the Neon connection string. Vercel's Neon integration may add the vars
// with a prefix (e.g. data_DATABASE_URL), so fall back to any env key ending in
// DATABASE_URL (preferring the pooled one), then POSTGRES_URL.
function resolveDbUrl(){
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const keys = Object.keys(process.env);
  return (
    process.env[keys.find(k => /(^|_)DATABASE_URL$/i.test(k) && !/UNPOOLED/i.test(k))] ||
    process.env[keys.find(k => /DATABASE_URL/i.test(k) && !/UNPOOLED/i.test(k))] ||
    process.env[keys.find(k => /(^|_)POSTGRES_URL$/i.test(k))] ||
    undefined
  );
}

const sql = neon(resolveDbUrl());
export { sql };

// Compose the GET /api/state payload (spec §5).
export async function getState(){
  const [gameRows, players, poolRows, koRows] = await Promise.all([
    sql`SELECT seed, locked, assignments, payments_enabled FROM game WHERE id='current'`,
    sql`SELECT name, position, confirmed, paid FROM players ORDER BY position, name`,
    sql`SELECT match_id, home_score, away_score FROM pool_results`,
    sql`SELECT id, round, team_a, team_b, score_a, score_b, pen_winner FROM ko_results ORDER BY id`
  ]);
  const [game] = gameRows;

  const pool = {};
  for (const r of poolRows) pool[r.match_id] = [r.home_score, r.away_score];

  const ko = koRows.map(r => ({
    id: r.id, round: r.round, a: r.team_a, b: r.team_b,
    as: r.score_a, bs: r.score_b, pen: r.pen_winner
  }));

  return {
    locked: !!(game && game.locked),
    seed: game ? game.seed : null,
    paymentsEnabled: !!(game && game.payments_enabled),
    players: players.map(p => ({ name: p.name, position: p.position, confirmed: p.confirmed, paid: p.paid })),
    assignments: game ? game.assignments : null,
    pool, ko
  };
}

// Admin: toggle whether players can pay their entry in-app (off until Stitch is live).
export async function setPaymentsEnabled(enabled){
  await sql`UPDATE game SET payments_enabled=${!!enabled} WHERE id='current'`;
}

export async function confirmPlayer(name){
  const rows = await sql`UPDATE players SET confirmed=true WHERE name=${name} RETURNING id`;
  return rows.length > 0;
}

export async function setPaid(name, paid){
  await sql`UPDATE players SET paid=${!!paid} WHERE name=${name}`;
}

// Admin: set a player's confirmed flag either way (e.g. to clear a mistaken "I'm in").
export async function setConfirmed(name, confirmed){
  await sql`UPDATE players SET confirmed=${!!confirmed} WHERE name=${name}`;
}

export async function setRoster(names){
  // An empty/invalid list is a no-op — never run a DELETE that would wipe the table.
  if (!Array.isArray(names) || names.length === 0) return;
  // Upsert by name (preserves confirmed/paid), set positions, remove absent.
  // Single atomic batch: one round-trip, all-or-nothing.
  const queries = names.map((name, i) =>
    sql`INSERT INTO players (name, position) VALUES (${name}, ${i})
        ON CONFLICT (name) DO UPDATE SET position=${i}`
  );
  queries.push(sql`DELETE FROM players WHERE name <> ALL(${names})`);
  await sql.transaction(queries);
}

export async function runDraw(seed, force){
  const players = await sql`SELECT name FROM players ORDER BY position, name`;
  const names = players.map(p => p.name);
  const n = names.length;
  // Hard cap: STRONG and WEAK each have 24 entries, so computeAssignments runs
  // out of teams to assign beyond 24 players — block it even with force.
  if (n > 24) return { error: 'tooManyPlayers', count: n };
  // Soft minimum: require >= 2 for a real draw; force lets an admin run a
  // 0- or 1-player test draw without the UI warning.
  if (!force && n < 2) return { error: 'tooFewPlayers', count: n };
  const assignments = computeAssignments(seed, names);
  // Atomic compare-and-set: only lock if not already locked. RETURNING tells us
  // whether this call won the race — empty result means it was already locked.
  const rows = await sql`UPDATE game SET seed=${seed}, locked=true, assignments=${JSON.stringify(assignments)} WHERE id='current' AND locked=false RETURNING id`;
  if (rows.length === 0) return { error: 'locked' };
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

export async function playerExists(name){
  const r = await sql`SELECT 1 FROM players WHERE name=${name}`;
  return r.length > 0;
}

export async function setPayment(name, ref, id){
  await sql`UPDATE players SET payment_ref=${ref}, payment_id=${id} WHERE name=${name}`;
}

export async function markPaidByLinkId(linkId){
  const rows = await sql`UPDATE players SET paid=true WHERE payment_id=${linkId} RETURNING name`;
  return rows.length > 0;
}

export async function resetGame(){
  // Single atomic batch: one round-trip, all-or-nothing.
  await sql.transaction([
    sql`DELETE FROM pool_results`,
    sql`DELETE FROM ko_results`,
    sql`UPDATE players SET confirmed=false, paid=false`,
    sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`
  ]);
}
