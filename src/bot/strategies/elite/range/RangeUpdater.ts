import { Card, HandRank } from '../../../../engine/types';
import { HandRange, WeightedCombo } from './WeightedCombo';
import { HandEvaluator } from '../../../../engine/HandEvaluator';

export class RangeUpdater {
  /**
   * Updates opponent range weights according to street, board, and postflop action.
   */
  public static updateRangeForAction(
    currentRange: HandRange,
    board: Card[],
    action: string,
    betFractionOfPot: number,
    deadCards: Card[] = []
  ): HandRange {
    // 1. Remove new dead cards
    const cleaned = currentRange.removeCards(deadCards);

    if (board.length < 3) return cleaned;

    // 2. Adjust weights by hand strength on the current board
    return cleaned.adjustWeight((combo: WeightedCombo) => {
      const evalResult = HandEvaluator.evaluate([...combo.cards, ...board]);
      const rank = evalResult.handRank; // HandRank enum 0 to 8

      if (action === 'BET' || action === 'RAISE') {
        if (betFractionOfPot >= 0.70) {
          // Polarized large bet: nuts/strong value + bluff draws
          if (rank >= HandRank.TWO_PAIR) return 1.0;
          if (rank === HandRank.ONE_PAIR) return 0.60;
          return 0.20; // Air / missed draw bluffs
        } else {
          // Small bet: merged range
          if (rank >= HandRank.ONE_PAIR) return 0.90;
          return 0.35;
        }
      } else if (action === 'CHECK') {
        // Checking: condensed range (pairs, showdown value, marginal hands)
        if (rank >= HandRank.STRAIGHT) return 0.20; // Traps/monsters check occasionally
        if (rank === HandRank.ONE_PAIR || rank === HandRank.TWO_PAIR) return 0.90;
        return 0.60;
      } else if (action === 'CALL') {
        // Calling: catchers & draws
        if (rank >= HandRank.STRAIGHT) return 0.35;
        if (rank === HandRank.ONE_PAIR || rank === HandRank.TWO_PAIR) return 0.95;
        return 0.25;
      }
      return 1.0;
    });
  }
}
