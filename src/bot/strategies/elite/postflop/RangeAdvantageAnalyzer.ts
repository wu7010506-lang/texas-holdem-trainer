import { Card } from '../../../../engine/types';
import { HandRange } from '../range/WeightedCombo';
import { HandEvaluator } from '../../../../engine/HandEvaluator';

export interface RangeAdvantageResult {
  ownRangeEquity: number;
  oppRangeEquity: number;
  advantage: 'HIGH' | 'SLIGHT_HIGH' | 'NEUTRAL' | 'SLIGHT_LOW' | 'LOW';
  score: number; // Positive = own advantage, Negative = opponent advantage
  description: string;
}

export class RangeAdvantageAnalyzer {
  /**
   * Compares the equity distribution of own range vs opponent range on the given board.
   */
  public static analyze(
    ownRange: HandRange,
    oppRange: HandRange,
    board: Card[]
  ): RangeAdvantageResult {
    if (board.length < 3 || ownRange.combos.length === 0 || oppRange.combos.length === 0) {
      return {
        ownRangeEquity: 0.50,
        oppRangeEquity: 0.50,
        advantage: 'NEUTRAL',
        score: 0.0,
        description: '無明顯範圍優勢',
      };
    }

    // Sample representative combos from each range
    const ownScores: number[][] = [];
    const oppScores: number[][] = [];


    const deadCardIds = new Set(board.map((c) => c.id));
    const validOwn = ownRange.combos
      .filter((c) => !deadCardIds.has(c.cards[0].id) && !deadCardIds.has(c.cards[1].id) && c.weight > 0.05)
      .sort((a, b) => b.weight - a.weight);
    const validOpp = oppRange.combos
      .filter((c) => !deadCardIds.has(c.cards[0].id) && !deadCardIds.has(c.cards[1].id) && c.weight > 0.05)
      .sort((a, b) => b.weight - a.weight);

    const sampleSize = 60;
    const ownCount = Math.min(sampleSize, validOwn.length);
    const oppCount = Math.min(sampleSize, validOpp.length);

    for (let i = 0; i < ownCount; i++) {
      const idx = Math.floor((i / ownCount) * validOwn.length);
      const c = validOwn[idx];
      const ev = HandEvaluator.evaluate([...c.cards, ...board]);
      ownScores.push(ev.score);
    }

    for (let i = 0; i < oppCount; i++) {
      const idx = Math.floor((i / oppCount) * validOpp.length);
      const c = validOpp[idx];
      const ev = HandEvaluator.evaluate([...c.cards, ...board]);
      oppScores.push(ev.score);
    }



    let ownWins = 0;
    let totalComparisons = 0;

    for (const o of ownScores) {
      for (const op of oppScores) {
        totalComparisons++;
        const cmp = HandEvaluator.compareScores(o, op);
        if (cmp > 0) ownWins += 1.0;
        else if (cmp === 0) ownWins += 0.5;
      }
    }

    const ownRangeEquity = totalComparisons > 0 ? ownWins / totalComparisons : 0.50;
    const oppRangeEquity = 1.0 - ownRangeEquity;
    const score = ownRangeEquity - 0.50;

    let advantage: 'HIGH' | 'SLIGHT_HIGH' | 'NEUTRAL' | 'SLIGHT_LOW' | 'LOW' = 'NEUTRAL';
    let description = '雙方範圍均勢';

    if (score >= 0.05) {
      advantage = 'HIGH';
      description = '顯著範圍優勢 (Range Advantage)';
    } else if (score >= 0.02) {
      advantage = 'SLIGHT_HIGH';
      description = '微弱範圍優勢';
    } else if (score <= -0.05) {
      advantage = 'LOW';
      description = '處於顯著範圍劣勢';
    } else if (score <= -0.02) {
      advantage = 'SLIGHT_LOW';
      description = '微弱範圍劣勢';
    }

    return {
      ownRangeEquity,
      oppRangeEquity,
      advantage,
      score,
      description,
    };
  }
}
