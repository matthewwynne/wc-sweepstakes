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

// Knockout round date ranges (inclusive), in tournament order. Source: FIFA /
// Wikipedia 2026 FIFA World Cup. Includes the third-place play-off for the
// schedule display (it isn't a scored round in this sweepstake).
export const KO_DATES = [
  { label: "Round of 32",          from: "2026-06-28", to: "2026-07-03" },
  { label: "Round of 16",          from: "2026-07-04", to: "2026-07-07" },
  { label: "Quarter-finals",       from: "2026-07-09", to: "2026-07-11" },
  { label: "Semi-finals",          from: "2026-07-14", to: "2026-07-15" },
  { label: "Third place play-off", from: "2026-07-18", to: "2026-07-18" },
  { label: "Final",                from: "2026-07-19", to: "2026-07-19" }
];

// How each team ranks across systems, for the Rankings comparison card:
//   bookies = ordinal 1–48 by title odds (price = decimal odds to win)
//   fifa    = FIFA Men's World Ranking position (1 Apr 2026 release)
//   elo     = World Football Elo position (eloratings.net, Jun 2026)
// Our own seeding is TEAM[name].rank (1–48), itself based on title odds.
export const RANKINGS = {
  "France":{bookies:2,price:6,fifa:1,elo:3}, "Spain":{bookies:1,price:5.5,fifa:2,elo:1},
  "England":{bookies:3,price:8,fifa:4,elo:4}, "Brazil":{bookies:6,price:10,fifa:6,elo:5},
  "Argentina":{bookies:5,price:10,fifa:3,elo:2}, "Portugal":{bookies:4,price:9,fifa:5,elo:6},
  "Germany":{bookies:7,price:15,fifa:10,elo:10}, "Netherlands":{bookies:8,price:21,fifa:7,elo:8},
  "Norway":{bookies:10,price:34,fifa:31,elo:11}, "Belgium":{bookies:9,price:34,fifa:9,elo:15},
  "Colombia":{bookies:11,price:41,fifa:13,elo:7}, "United States":{bookies:14,price:51,fifa:16,elo:38},
  "Morocco":{bookies:12,price:41,fifa:8,elo:24}, "Uruguay":{bookies:19,price:67,fifa:17,elo:16},
  "Japan":{bookies:13,price:51,fifa:18,elo:14}, "Croatia":{bookies:20,price:81,fifa:11,elo:12},
  "Mexico":{bookies:15,price:67,fifa:15,elo:18}, "Switzerland":{bookies:17,price:67,fifa:19,elo:17},
  "Türkiye":{bookies:18,price:67,fifa:22,elo:13}, "Ecuador":{bookies:21,price:81,fifa:23,elo:9},
  "Senegal":{bookies:16,price:67,fifa:14,elo:21}, "Sweden":{bookies:22,price:101,fifa:38,elo:43},
  "Austria":{bookies:23,price:151,fifa:24,elo:23}, "Canada":{bookies:24,price:151,fifa:30,elo:25},
  "Paraguay":{bookies:31,price:251,fifa:40,elo:22}, "Czechia":{bookies:28,price:251,fifa:41,elo:35},
  "Ivory Coast":{bookies:25,price:201,fifa:34,elo:49}, "Scotland":{bookies:32,price:251,fifa:43,elo:26},
  "Bosnia & Herz.":{bookies:27,price:251,fifa:65,elo:65}, "South Korea":{bookies:30,price:251,fifa:25,elo:33},
  "Ghana":{bookies:34,price:501,fifa:74,elo:81}, "Algeria":{bookies:26,price:251,fifa:28,elo:32},
  "Egypt":{bookies:29,price:251,fifa:29,elo:48}, "Australia":{bookies:33,price:501,fifa:27,elo:28},
  "Tunisia":{bookies:36,price:501,fifa:44,elo:59}, "Iran":{bookies:35,price:501,fifa:21,elo:29},
  "DR Congo":{bookies:37,price:751,fifa:46,elo:55}, "Panama":{bookies:42,price:1001,fifa:33,elo:37},
  "South Africa":{bookies:45,price:1001,fifa:60,elo:80}, "Uzbekistan":{bookies:46,price:1001,fifa:50,elo:42},
  "Saudi Arabia":{bookies:44,price:1001,fifa:61,elo:70}, "Qatar":{bookies:43,price:1001,fifa:55,elo:97},
  "New Zealand":{bookies:41,price:1001,fifa:85,elo:72}, "Jordan":{bookies:40,price:1001,fifa:63,elo:52},
  "Cape Verde":{bookies:38,price:1001,fifa:69,elo:68}, "Iraq":{bookies:39,price:1001,fifa:57,elo:60},
  "Haiti":{bookies:48,price:2501,fifa:84,elo:73}, "Curaçao":{bookies:47,price:2501,fifa:83,elo:91}
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
