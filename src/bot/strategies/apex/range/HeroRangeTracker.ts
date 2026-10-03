import { Card } from '../../../../engine/types';
import { HandRange, WeightedCombo } from '../../elite/range/WeightedCombo';
import { RangeEstimator } from '../../elite/range/RangeEstimator';
import { ActionLikelihoodModel } from './ActionLikelihoodModel';
import { HeroModel } from '../model/HeroModel';
import { RangeEquityEvaluator } from '../../elite/equity/RangeEquityEvaluator';

export class HeroRangeTracker {
  private range: HandRange;
  private heroModel?: HeroModel;

  constructor(heroPosition: string, preflopActions: any[], deadCards: Card[] = [], heroModel?: HeroModel) {
    this.heroModel = heroModel;
    this.range = RangeEstimator.buildInitialRange(heroPosition, preflopActions, deadCards);
  }

  public updateOnAction(
    action: 'CHECK' | 'CALL' | 'BET' | 'RAISE',
    betFractionOfPot: number,
    board: Card[]
  ): void {
    this.range = this.range.adjustWeight((combo: WeightedCombo) => {
      const category = ActionLikelihoodModel.classifyCombo(combo.cards, board);
      const likelihood = ActionLikelihoodModel.getLikelihood(
        category,
        action,
        betFractionOfPot,
        this.heroModel
      );
      return likelihood;
    });
    this.range.normalize();
  }

  public removeBlockers(deadCards: Card[]): void {
    this.range = this.range.removeCards(deadCards);
  }

  public getRange(): HandRange {
    return this.range;
  }

  /**
   * Computes Hero's sub-range that would CALL a proposed bet of given fraction.
   */
  public getCallingSubrange(board: Card[], betFractionOfPot: number): HandRange {
    return this.range.adjustWeight((combo: WeightedCombo) => {
      const category = ActionLikelihoodModel.classifyCombo(combo.cards, board);
      // Hero folds weak air and missed draws more often vs larger sizing
      if (category === 'NUTS_OR_MONSTER') return 1.0;
      if (category === 'STRONG_VALUE') return 0.95;
      if (category === 'MEDIUM_VALUE') {
        if (betFractionOfPot >= 1.10) return 0.25; // Overbet folds many medium pairs
        if (betFractionOfPot >= 0.70) return 0.60;
        return 0.90;
      }
      if (category === 'DRAW') {
        return betFractionOfPot >= 0.75 ? 0.30 : 0.70;
      }
      // WEAK_AIR
      return betFractionOfPot >= 0.70 ? 0.05 : 0.15;
    });
  }

  /**
   * Evaluates Bot's equity against this range on the current board.
   */
  public evaluateEquityVsRange(botHoleCards: [Card, Card], board: Card[], opponents = 1): number {
    return RangeEquityEvaluator.calculate(botHoleCards, this.range, board, 250, opponents).equity;
  }
}
