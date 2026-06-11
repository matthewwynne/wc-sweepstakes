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
  const n = Math.min(playerNames.length, 24);
  // STRONG and WEAK are already ordered best-first, so slicing the top-n is
  // "remove the lowest-ranked teams until each player gets exactly 2".
  // shuffle(STRONG slice) is consumed before shuffle(WEAK slice) — do not
  // reorder; it affects the deterministic output that verification relies on.
  const s = shuffle(STRONG.slice(0, n), rng);
  const w = shuffle(WEAK.slice(0, n), rng);
  const out = [];
  for (let i = 0; i < n; i++){
    out.push({ player: playerNames[i], strong: s[i], weak: w[i] });
  }
  return out;
}
