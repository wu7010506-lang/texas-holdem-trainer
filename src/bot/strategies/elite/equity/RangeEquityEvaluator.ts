import { Card } from "../../../../engine/types";
import { EquityCalculator } from "../../../EquityCalculator";
import { HandRange } from "../range/WeightedCombo";

export interface RangeEquityResult {
  equity: number;
  winRate: number;
  tieRate: number;
  loseRate: number;
}

export class RangeEquityEvaluator {
  private static cache = new Map<string, RangeEquityResult>();

  /** Sample all opponents in the same showdown, using weighted ranges and actual pot shares. */
  public static calculate(
    holeCards: Card[],
    range: HandRange,
    board: Card[],
    trials = 350,
    opponents = 1,
  ): RangeEquityResult {
    if (holeCards.length < 2)
      return { equity: 0, winRate: 0, tieRate: 0, loseRate: 1 };
    const signature = JSON.stringify([
      holeCards.map((c) => c.id).sort(),
      board.map((c) => c.id).sort(),
      opponents,
      trials,
      range.combos.map((c) => [
        c.cards.map((card) => card.id).sort(),
        c.weight,
      ]),
    ]);
    const cached = this.cache.get(signature);
    if (cached) return cached;
    const combos = range.combos
      .filter((combo) => combo.weight > 0)
      .map((combo) => ({ ...combo, notation: combo.notation ?? "" }));
    const opponentRange = {
      combos,
      totalWeight: combos.reduce((sum, combo) => sum + combo.weight, 0),
    };
    const result = EquityCalculator.calculate({
      heroHoleCards: holeCards,
      communityCards: board,
      opponents: Array.from({ length: Math.max(1, opponents) }, (_, i) => ({
        id: `range-${i}`,
        position: "BB",
        range: combos.length ? opponentRange : undefined,
      })),
      mode: combos.length ? "range" : "random",
      simulations: trials,
      seed: 8941,
    });
    const value = {
      equity: result.equity,
      winRate: result.winRate,
      tieRate: result.tieRate,
      loseRate: result.lossRate,
    };
    if (this.cache.size >= 100) this.cache.clear();
    this.cache.set(signature, value);
    return value;
  }
}
