import { Card } from '../../../../engine/types';
import { HandRange, WeightedCombo } from '../../elite/range/WeightedCombo';
import { RangeEstimator } from '../../elite/range/RangeEstimator';
import { ActionLikelihoodModel } from './ActionLikelihoodModel';
import { HeroModel } from '../model/HeroModel';
import { HandEvaluator } from '../../../../engine/HandEvaluator';

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
  public evaluateEquityVsRange(botHoleCards: [Card, Card], board: Card[]): number {
    if (this.range.combos.length === 0 || board.length < 3) return 0.50;
    const botEval = HandEvaluator.evaluate([...botHoleCards, ...board]);

    let totalWeight = 0;
    let winWeight = 0;
    let tieWeight = 0;

    for (const combo of this.range.combos) {
      if (combo.weight <= 0.0001) continue;
      const heroEval = HandEvaluator.evaluate([...combo.cards, ...board]);
      const cmp = HandEvaluator.compareScores(botEval.score, heroEval.score);

      totalWeight += combo.weight;
      if (cmp > 0) {
        winWeight += combo.weight;
      } else if (cmp === 0) {
        tieWeight += combo.weight;
      }
    }

    if (totalWeight <= 0) return 0.50;
    return (winWeight + tieWeight * 0.5) / totalWeight;
  }
}
