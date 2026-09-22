import { Card } from '../engine/types';
import { EquityCalculationResult, EquityCalculator } from './EquityCalculator';

export type EquityResult = EquityCalculationResult;

export class MonteCarloEquity {
  /**
   * Backward-compatible facade delegating directly to the new EquityCalculator
   */
  public static simulate(
    heroHoleCards: Card[],
    communityCards: Card[],
    opponentCount: number = 1,
    iterations: number = 10000,
    seed?: number
  ): EquityResult {
    return EquityCalculator.calculate({
      heroHoleCards,
      communityCards,
      opponents: opponentCount,
      mode: 'range',
      simulations: iterations,
      seed,
    });
  }
}
