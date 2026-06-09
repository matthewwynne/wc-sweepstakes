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

export async function playerExists(name){
  const r = await sql`SELECT 1 FROM players WHERE name=${name}`;
  return r.length > 0;
}

export async function setPayment(name, ref, id){
  await sql`UPDATE players SET payment_ref=${ref}, payment_id=${id} WHERE name=${name}`;
}

export async function markPaidByRef(ref){
  const rows = await sql`UPDATE players SET paid=true WHERE payment_ref=${ref} RETURNING name`;
  return rows.length > 0;
}

export async function resetGame(){
  await sql`DELETE FROM pool_results`;
  await sql`DELETE FROM ko_results`;
  await sql`UPDATE players SET confirmed=false, paid=false`;
  await sql`UPDATE game SET seed=NULL, locked=false, assignments=NULL WHERE id='current'`;
}
