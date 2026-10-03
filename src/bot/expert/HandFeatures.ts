import { Card } from "../../engine/types";
import { fastHandScore } from "./FastHandEvaluator";

export interface HandFeatures {
  strength: number;
  draw: number;
  blocker: number;
}

/** Response likelihood features, not equity. Equity always comes from simultaneous showdown. */
export function handFeatures(
  hole: readonly Card[],
  board: readonly Card[],
): HandFeatures {
  const high = Math.max(hole[0].value, hole[1].value),
    low = Math.min(hole[0].value, hole[1].value);
  if (!board.length) {
    const pair = high === low;
    const strength = pair
      ? 0.48 + high * 0.035
      : 0.17 +
        (high + low) * 0.016 +
        (hole[0].suit === hole[1].suit ? 0.07 : 0) +
        (high - low <= 2 ? 0.03 : 0);
    return {
      strength: Math.min(0.98, strength),
      draw: 0,
      blocker: high === 14 ? 0.5 : 0,
    };
  }
  const cards = [...hole, ...board];
  const score = fastHandScore(cards),
    category = Math.floor(score / 15 ** 5);
  const primary = Math.floor(score / 15 ** 4) % 15;
  const boardHigh = Math.max(...board.map((c) => c.value));
  let strength = [0.12, 0.4, 0.76, 0.9, 0.94, 0.96, 0.985, 0.998, 1][category];
  if (category === 1) {
    const ownsPair = hole.some((c) => c.value === primary);
    strength = !ownsPair
      ? 0.2 + high / 100
      : primary >= boardHigh
        ? 0.62 + low / 100
        : 0.32 + primary / 100;
  }
  if (category === 2 && board.filter((c) => c.value === primary).length >= 2)
    strength = 0.56;
  if (board.length === 5 && score === fastHandScore(board))
    strength = category === 8 ? 1 : category >= 6 ? 0.8 : 0.28;
  let draw = 0,
    blocker = 0;
  for (const suit of ["s", "h", "d", "c"]) {
    const onBoard = board.filter((c) => c.suit === suit).length;
    const own = hole.filter((c) => c.suit === suit);
    if (own.some((c) => c.value === 14) && onBoard >= 2) blocker = 1;
    if (board.length < 5 && onBoard + own.length === 4 && own.length)
      draw = Math.max(draw, own.some((c) => c.value === 14) ? 0.28 : 0.22);
  }
  if (board.length < 5) {
    const ranks = new Set(cards.map((c) => c.value));
    if (ranks.has(14)) ranks.add(1);
    for (let start = 1; start <= 10; start++) {
      const inside = Array.from({ length: 5 }, (_, i) => start + i);
      if (
        inside.filter((v) => ranks.has(v)).length === 4 &&
        hole.some((c) => inside.includes(c.value))
      )
        draw = Math.max(draw, 0.16);
    }
  }
  return { strength, draw, blocker };
}

export function continueProbability(
  features: HandFeatures,
  price: number,
  foldAdjustment = 0,
): number {
  if (features.strength === 1) return 1;
  const merit = Math.min(1, features.strength + features.draw);
  const threshold = 0.28 + Math.min(0.55, price) * 0.95;
  return Math.max(
    0.015,
    Math.min(
      0.995,
      1 / (1 + Math.exp(-(merit - threshold) * 11)) - foldAdjustment,
    ),
  );
}
