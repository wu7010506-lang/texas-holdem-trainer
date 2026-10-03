import { Card } from "../../engine/types";

// Lexicographic base-15 score, equivalent to the canonical 7-choose-5 evaluator.
// Used only on hypothetical rollouts. No table, deck state, or player references.
export function fastHandScore(cards: readonly Card[]): number {
  const ranks = new Uint8Array(15);
  const suits: number[][] = [[], [], [], []];
  const suitIndex = { s: 0, h: 1, d: 2, c: 3 };
  let mask = 0;
  for (const c of cards) {
    ranks[c.value]++;
    suits[suitIndex[c.suit]].push(c.value);
    mask |= 1 << c.value;
  }
  const straight = (bits: number) => {
    if (bits & (1 << 14)) bits |= 1 << 1;
    for (let high = 14; high >= 5; high--)
      if ((bits & (31 << (high - 4))) === 31 << (high - 4)) return high;
    return 0;
  };
  const encode = (category: number, values: number[]) => {
    let score = category;
    for (let i = 0; i < 5; i++) score = score * 15 + (values[i] ?? 0);
    return score;
  };
  const descending: number[] = [];
  const pairs: number[] = [];
  const trips: number[] = [];
  let quads = 0;
  for (let r = 14; r >= 2; r--) {
    if (ranks[r]) descending.push(r);
    if (ranks[r] >= 2) pairs.push(r);
    if (ranks[r] >= 3) trips.push(r);
    if (ranks[r] === 4) quads = r;
  }
  const flush = suits.find((s) => s.length >= 5)?.sort((a, b) => b - a);
  if (flush) {
    const sf = straight(flush.reduce((bits, r) => bits | (1 << r), 0));
    if (sf) return encode(8, [sf]);
  }
  if (quads) return encode(7, [quads, descending.find((r) => r !== quads)!]);
  if (trips.length && pairs.some((r) => r !== trips[0]))
    return encode(6, [trips[0], pairs.find((r) => r !== trips[0])!]);
  if (flush) return encode(5, flush.slice(0, 5));
  const st = straight(mask);
  if (st) return encode(4, [st]);
  if (trips.length)
    return encode(3, [
      trips[0],
      ...descending.filter((r) => r !== trips[0]).slice(0, 2),
    ]);
  if (pairs.length >= 2)
    return encode(2, [
      ...pairs.slice(0, 2),
      descending.find((r) => !pairs.slice(0, 2).includes(r))!,
    ]);
  if (pairs.length)
    return encode(1, [
      pairs[0],
      ...descending.filter((r) => r !== pairs[0]).slice(0, 3),
    ]);
  return encode(0, descending.slice(0, 5));
}
