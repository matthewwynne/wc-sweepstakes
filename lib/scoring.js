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
