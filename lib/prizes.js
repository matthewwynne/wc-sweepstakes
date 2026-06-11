// Single source of truth for the money. Pure + deterministic so the browser
// and any future server code agree. Pot = players * entry; the split keeps the
// original percentages, each prize rounded to the nearest rand (the banker
// absorbs any rounding difference, at most about a rand per tier).
export const ENTRY = 250;
export const SPLIT = { first: 0.50, second: 0.25, third: 0.15, wildcard: 0.10 };

export function prizes(playerCount) {
  const n = Math.max(0, playerCount | 0);
  const pot = n * ENTRY;
  const r = pct => Math.round(pot * pct);
  return {
    players: n, pot,
    first: r(SPLIT.first), second: r(SPLIT.second),
    third: r(SPLIT.third), wildcard: r(SPLIT.wildcard)
  };
}
