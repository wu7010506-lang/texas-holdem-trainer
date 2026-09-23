import { Card, HandRank } from '../../../../engine/types';
import { HandRange } from '../range/WeightedCombo';
import { HandEvaluator } from '../../../../engine/HandEvaluator';

export interface NutAdvantageResult {
  ownNutDensity: number;
  oppNutDensity: number;
  nutAdvantage: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number; // positive = own nut advantage
  description: string;
}

export class NutAdvantageAnalyzer {
  /**
   * Analyzes the combo density of nuts, near-nuts, and very strong hands (Sets, Straights, Flushes, Full Houses).
   */
  public static analyze(
    ownRange: HandRange,
    oppRange: HandRange,
    board: Card[]
  ): NutAdvantageResult {
    if (board.length < 3 || ownRange.combos.length === 0 || oppRange.combos.length === 0) {
      return {
        ownNutDensity: 0,
        oppNutDensity: 0,
        nutAdvantage: 'MEDIUM',
        score: 0,
        description: '堅果優勢持平',
      };
    }

    const countNuts = (range: HandRange) => {
      let nutWeight = 0;
      let totalWeight = 0;
      for (const c of range.combos) {
        totalWeight += c.weight;
        const ev = HandEvaluator.evaluate([...c.cards, ...board]);
        if (ev.handRank >= HandRank.THREE_OF_A_KIND || (ev.handRank === HandRank.TWO_PAIR && (ev.score[1] ?? 0) >= 11)) {
          nutWeight += c.weight;
        }
      }
      return totalWeight > 0 ? nutWeight / totalWeight : 0;
    };

    const ownNutDensity = countNuts(ownRange);
    const oppNutDensity = countNuts(oppRange);
    const diff = ownNutDensity - oppNutDensity;

    let nutAdvantage: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    let description = '堅果優勢相近';

    if (diff >= 0.05) {
      nutAdvantage = 'HIGH';
      description = '擁有顯著堅果優勢 (Nut Advantage) -> 適合大注/超池/過牌加注';
    } else if (diff <= -0.05) {
      nutAdvantage = 'LOW';
      description = '對手擁有堅果優勢 -> 應避免被極化/控池';
    }

    return {
      ownNutDensity,
      oppNutDensity,
      nutAdvantage,
      score: diff,
      description,
    };
  }
}
