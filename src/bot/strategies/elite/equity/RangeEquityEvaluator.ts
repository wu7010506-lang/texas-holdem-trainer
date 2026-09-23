import { Card } from '../../../../engine/types';
import { HandRange } from '../range/WeightedCombo';
import { HandEvaluator } from '../../../../engine/HandEvaluator';
import { Deck } from '../../../../engine/Deck';

export interface RangeEquityResult {
  equity: number;
  winRate: number;
  tieRate: number;
  loseRate: number;
}

export class RangeEquityEvaluator {
  private static cache: Map<string, RangeEquityResult> = new Map();

  /**
   * Calculates equity of a specific hand against an opponent's estimated range on a given board.
   */
  public static calculate(
    holeCards: Card[],
    oppRange: HandRange,
    board: Card[],
    trials = 350
  ): RangeEquityResult {
    if (holeCards.length < 2 || oppRange.combos.length === 0) {
      return { equity: 0.5, winRate: 0.5, tieRate: 0, loseRate: 0.5 };
    }

    // Build cache key
    const cardKey = holeCards.map((c) => c.id).sort().join('-');
    const boardKey = board.map((c) => c.id).sort().join('-');
    const cacheKey = `${cardKey}|${boardKey}|${oppRange.combos.length}|${trials}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const deadCardIds = new Set([...holeCards.map((c) => c.id), ...board.map((c) => c.id)]);
    const validOppCombos = oppRange.combos.filter(
      (c) => !deadCardIds.has(c.cards[0].id) && !deadCardIds.has(c.cards[1].id)
    );

    if (validOppCombos.length === 0) {
      return { equity: 0.5, winRate: 0.5, tieRate: 0, loseRate: 0.5 };
    }

    // Full deck of remaining cards
    const standardDeck = Deck.createStandardDeck().getCards();
    const remainingDeck = standardDeck.filter((c) => !deadCardIds.has(c.id));

    const cardsNeeded = 5 - board.length;
    let wins = 0;
    let ties = 0;
    let totalTrials = 0;

    // Fast Monte Carlo sampling
    const actualTrials = Math.min(trials, Math.max(100, validOppCombos.length * 4));

    for (let t = 0; t < actualTrials; t++) {
      // Pick random opponent combo
      const oppCombo = validOppCombos[Math.floor(Math.random() * validOppCombos.length)];
      const oppDead = new Set([oppCombo.cards[0].id, oppCombo.cards[1].id]);

      // Complete runout
      const runout: Card[] = [];
      if (cardsNeeded > 0) {
        const availableRunout = remainingDeck.filter((c) => !oppDead.has(c.id));
        // Shuffle or pick random cards
        for (let k = 0; k < cardsNeeded; k++) {
          const pickIdx = Math.floor(Math.random() * availableRunout.length);
          runout.push(availableRunout.splice(pickIdx, 1)[0]);
        }
      }

      const finalBoard = [...board, ...runout];
      const heroEval = HandEvaluator.evaluate([...holeCards, ...finalBoard]);
      const oppEval = HandEvaluator.evaluate([...oppCombo.cards, ...finalBoard]);

      const cmp = HandEvaluator.compareScores(heroEval.score, oppEval.score);

      totalTrials++;
      if (cmp > 0) {
        wins++;
      } else if (cmp === 0) {
        ties++;
      }

    }

    const winRate = totalTrials > 0 ? wins / totalTrials : 0.5;
    const tieRate = totalTrials > 0 ? ties / totalTrials : 0;
    const loseRate = 1.0 - winRate - tieRate;
    const equity = winRate + tieRate * 0.5;

    const result: RangeEquityResult = { equity, winRate, tieRate, loseRate };
    if (this.cache.size > 200) {
      this.cache.clear();
    }
    this.cache.set(cacheKey, result);
    return result;
  }
}
