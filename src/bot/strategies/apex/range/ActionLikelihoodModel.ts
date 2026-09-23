import { Card, Street } from '../../../../engine/types';
import { HandEvaluator } from '../../../../engine/HandEvaluator';
import { HeroModel, getPosteriorRate } from '../model/HeroModel';

export type HandCategory = 'NUTS_OR_MONSTER' | 'STRONG_VALUE' | 'MEDIUM_VALUE' | 'DRAW' | 'WEAK_AIR';

export class ActionLikelihoodModel {
  /**
   * Classify a hole combo relative to the board
   */
  public static classifyCombo(comboCards: [Card, Card], board: Card[]): HandCategory {
    if (board.length === 0) {
      // Preflop
      const [c1, c2] = comboCards;
      const isPair = c1.rank === c2.rank;
      const maxValue = Math.max(c1.value, c2.value);
      const minValue = Math.min(c1.value, c2.value);
      if (isPair && maxValue >= 12) return 'NUTS_OR_MONSTER'; // AA, KK, QQ
      if (isPair && maxValue >= 10) return 'STRONG_VALUE';    // JJ, TT
      if (maxValue === 14 && minValue >= 12) return 'STRONG_VALUE'; // AK, AQ
      if (isPair || (maxValue >= 11 && minValue >= 10)) return 'MEDIUM_VALUE';
      if (c1.suit === c2.suit && maxValue >= 9) return 'DRAW';
      return 'WEAK_AIR';
    }

    const allCards = [...comboCards, ...board];
    const evalResult = HandEvaluator.evaluate(allCards);
    const scoreCategory = evalResult.rankName; // e.g. 'Straight', 'Flush', etc.

    if (
      scoreCategory === 'Royal Flush' ||
      scoreCategory === 'Straight Flush' ||
      scoreCategory === 'Four of a Kind' ||
      scoreCategory === 'Full House' ||
      scoreCategory === 'Flush' ||
      scoreCategory === 'Straight'
    ) {
      return 'NUTS_OR_MONSTER';
    }

    if (scoreCategory === 'Three of a Kind' || scoreCategory === 'Two Pair') {
      return 'STRONG_VALUE';
    }

    if (scoreCategory === 'One Pair') {
      // Check if top pair or better
      const boardValues = board.map(c => c.value).sort((a, b) => b - a);
      const maxBoardValue = boardValues[0] ?? 0;
      const hasTopPair = comboCards.some(c => c.value === maxBoardValue);
      return hasTopPair ? 'STRONG_VALUE' : 'MEDIUM_VALUE';
    }

    // Check for draws (flush draw: 4 cards of same suit)
    if (board.length < 5) {
      const suits: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
      allCards.forEach(c => suits[c.suit]++);
      if (Object.values(suits).some(count => count === 4)) {
        return 'DRAW';
      }
    }

    return 'WEAK_AIR';
  }

  /**
   * Returns P(Action | HandCategory) conditioned on Hero's observed tendencies in HeroModel.
   */
  public static getLikelihood(
    category: HandCategory,
    action: 'CHECK' | 'CALL' | 'BET' | 'RAISE',
    betFractionOfPot: number,
    heroModel?: HeroModel
  ): number {
    const heroBluffRate = heroModel ? getPosteriorRate(heroModel.riverStats.bluffEstimate) : 0.20;

    switch (action) {
      case 'CHECK':
        if (category === 'NUTS_OR_MONSTER') return 0.15; // Slowplays occasionally
        if (category === 'STRONG_VALUE') return 0.25;
        if (category === 'MEDIUM_VALUE') return 0.75;    // Showdown value / pot control
        if (category === 'DRAW') return 0.55;
        if (category === 'WEAK_AIR') return 0.85;        // Give up
        return 0.5;

      case 'CALL':
        if (category === 'NUTS_OR_MONSTER') return 0.35; // Trap
        if (category === 'STRONG_VALUE') return 0.75;
        if (category === 'MEDIUM_VALUE') return 0.80;    // Standard call
        if (category === 'DRAW') return 0.65;            // Chase draw
        if (category === 'WEAK_AIR') return 0.08;        // Rare float
        return 0.5;

      case 'BET':
      case 'RAISE':
        if (betFractionOfPot >= 1.10) {
          // Overbet 125%+: polarized
          if (category === 'NUTS_OR_MONSTER') return 0.85;
          if (category === 'STRONG_VALUE') return 0.50;
          if (category === 'MEDIUM_VALUE') return 0.05;  // Rarely overbets medium hands
          if (category === 'DRAW') return 0.40;          // High equity semi-bluff
          // Pure air overbet frequency depends directly on hero's bluff tendency
          if (category === 'WEAK_AIR') return Math.max(0.02, heroBluffRate * 1.5);
        } else if (betFractionOfPot >= 0.65) {
          // Standard bet (65-80%)
          if (category === 'NUTS_OR_MONSTER') return 0.80;
          if (category === 'STRONG_VALUE') return 0.70;
          if (category === 'MEDIUM_VALUE') return 0.35;
          if (category === 'DRAW') return 0.45;
          if (category === 'WEAK_AIR') return Math.max(0.05, heroBluffRate);
        } else {
          // Small bet (25-40%)
          if (category === 'NUTS_OR_MONSTER') return 0.45;
          if (category === 'STRONG_VALUE') return 0.60;
          if (category === 'MEDIUM_VALUE') return 0.65;
          if (category === 'DRAW') return 0.35;
          if (category === 'WEAK_AIR') return 0.20;
        }
        return 0.5;

      default:
        return 0.5;
    }
  }
}
