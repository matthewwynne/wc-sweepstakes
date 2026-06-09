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
  A:["Mexico","South Africa","South Korea","Czechia"],
  B:["Canada","Bosnia & Herz.","Qatar","Switzerland"],
  C:["Brazil","Morocco","Haiti","Scotland"],
  D:["United States","Paraguay","Australia","Türkiye"],
  E:["Germany","Curaçao","Ivory Coast","Ecuador"],
  F:["Netherlands","Japan","Sweden","Tunisia"],
  G:["Belgium","Egypt","Iran","New Zealand"],
  H:["Spain","Cape Verde","Saudi Arabia","Uruguay"],
  I:["France","Senegal","Iraq","Norway"],
  J:["Argentina","Algeria","Austria","Jordan"],
  K:["Portugal","DR Congo","Uzbekistan","Colombia"],
  L:["England","Croatia","Ghana","Panama"]
};

// Round-robin pairings within a group of 4 (index pairs), in matchday order:
// MD1 [0,1],[2,3] · MD2 [0,2],[1,3] · MD3 [0,3],[1,2].
export const PAIRS = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]];

// Official kickoff date (YYYY-MM-DD) for each group's six fixtures, aligned to
// PAIRS index. GROUPS are in official seeded-position order so these line up with
// the real 2026 schedule. Source: FIFA / Wikipedia 2026 FIFA World Cup.
export const MATCH_DATES = {
  A:["2026-06-11","2026-06-11","2026-06-18","2026-06-18","2026-06-24","2026-06-24"],
  B:["2026-06-12","2026-06-13","2026-06-18","2026-06-18","2026-06-24","2026-06-24"],
  C:["2026-06-13","2026-06-13","2026-06-19","2026-06-19","2026-06-24","2026-06-24"],
  D:["2026-06-12","2026-06-13","2026-06-19","2026-06-19","2026-06-25","2026-06-25"],
  E:["2026-06-14","2026-06-14","2026-06-20","2026-06-20","2026-06-25","2026-06-25"],
  F:["2026-06-14","2026-06-14","2026-06-20","2026-06-20","2026-06-25","2026-06-25"],
  G:["2026-06-15","2026-06-15","2026-06-21","2026-06-21","2026-06-26","2026-06-26"],
  H:["2026-06-15","2026-06-15","2026-06-21","2026-06-21","2026-06-26","2026-06-26"],
  I:["2026-06-16","2026-06-16","2026-06-22","2026-06-22","2026-06-26","2026-06-26"],
  J:["2026-06-16","2026-06-16","2026-06-22","2026-06-22","2026-06-27","2026-06-27"],
  K:["2026-06-17","2026-06-17","2026-06-23","2026-06-23","2026-06-27","2026-06-27"],
  L:["2026-06-17","2026-06-17","2026-06-23","2026-06-23","2026-06-27","2026-06-27"]
};

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
