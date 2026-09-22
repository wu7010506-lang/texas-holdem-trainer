import { Card, HandEvaluation, HandRank } from './types';
import { RANK_NAMES, VALUE_TO_RANK } from './Card';

export class HandEvaluator {
  /**
   * Compares two score arrays lexicographically.
   * Returns:
   * > 0 if a > b
   * < 0 if a < b
   * 0 if equal (tie)
   */
  public static compareScores(a: number[], b: number[]): number {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      if (valA !== valB) {
        return valA - valB;
      }
    }
    return 0;
  }

  /**
   * Evaluates exactly 5 cards.
   */
  public static evaluate5Cards(cards: Card[]): HandEvaluation {
    if (cards.length !== 5) {
      throw new Error(`Expected exactly 5 cards, got ${cards.length}`);
    }

    // Sort descending by rank value
    const sorted = [...cards].sort((a, b) => b.value - a.value);
    const values = sorted.map((c) => c.value);
    const suits = sorted.map((c) => c.suit);

    const isFlush = suits.every((s) => s === suits[0]);

    // Check for Straight
    let isStraight = false;
    let straightHigh = 0;

    // Normal straight: 5 consecutive values
    const uniqueValues = Array.from(new Set(values));
    if (uniqueValues.length === 5) {
      if (values[0] - values[4] === 4) {
        isStraight = true;
        straightHigh = values[0];
      } else if (
        values[0] === 14 && // Ace
        values[1] === 5 &&
        values[2] === 4 &&
        values[3] === 3 &&
        values[4] === 2
      ) {
        // Wheel: A-2-3-4-5, Ace acts as 1, highest is 5
        isStraight = true;
        straightHigh = 5;
      }
    }

    // Count value frequencies
    const counts: Record<number, number> = {};
    for (const v of values) {
      counts[v] = (counts[v] || 0) + 1;
    }

    const countEntries = Object.entries(counts).map(([val, cnt]) => ({
      value: Number(val),
      count: cnt,
    }));
    // Sort countEntries primarily by count descending, then by value descending
    countEntries.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });

    // 1. Straight Flush / Royal Flush
    if (isFlush && isStraight) {
      const isRoyal = straightHigh === 14;
      const rankName = isRoyal ? 'Royal Flush' : 'Straight Flush';
      const desc = isRoyal
        ? `Royal Flush`
        : `Straight Flush, ${straightHigh === 5 ? '5-high (Wheel)' : VALUE_TO_RANK[straightHigh] + '-high'}`;
      return {
        handRank: HandRank.STRAIGHT_FLUSH,
        rankName,
        score: [HandRank.STRAIGHT_FLUSH, straightHigh],
        best5: sorted,
        description: desc,
      };
    }

    // 2. Four of a Kind
    if (countEntries[0].count === 4) {
      const quadVal = countEntries[0].value;
      const kickerVal = countEntries[1].value;
      return {
        handRank: HandRank.FOUR_OF_A_KIND,
        rankName: 'Four of a Kind',
        score: [HandRank.FOUR_OF_A_KIND, quadVal, kickerVal],
        best5: sorted,
        description: `Four of a Kind, ${RANK_NAMES[VALUE_TO_RANK[quadVal]]}s with ${RANK_NAMES[VALUE_TO_RANK[kickerVal]]} kicker`,
      };
    }

    // 3. Full House
    if (countEntries[0].count === 3 && countEntries[1].count === 2) {
      const tripVal = countEntries[0].value;
      const pairVal = countEntries[1].value;
      return {
        handRank: HandRank.FULL_HOUSE,
        rankName: 'Full House',
        score: [HandRank.FULL_HOUSE, tripVal, pairVal],
        best5: sorted,
        description: `Full House, ${RANK_NAMES[VALUE_TO_RANK[tripVal]]}s full of ${RANK_NAMES[VALUE_TO_RANK[pairVal]]}s`,
      };
    }

    // 4. Flush
    if (isFlush) {
      return {
        handRank: HandRank.FLUSH,
        rankName: 'Flush',
        score: [HandRank.FLUSH, ...values],
        best5: sorted,
        description: `Flush, ${RANK_NAMES[VALUE_TO_RANK[values[0]]]} high`,
      };
    }

    // 5. Straight
    if (isStraight) {
      return {
        handRank: HandRank.STRAIGHT,
        rankName: 'Straight',
        score: [HandRank.STRAIGHT, straightHigh],
        best5: sorted,
        description: `Straight, ${straightHigh === 5 ? '5-high (Wheel)' : VALUE_TO_RANK[straightHigh] + '-high'}`,
      };
    }

    // 6. Three of a Kind
    if (countEntries[0].count === 3) {
      const tripVal = countEntries[0].value;
      const kicker1 = countEntries[1].value;
      const kicker2 = countEntries[2].value;
      return {
        handRank: HandRank.THREE_OF_A_KIND,
        rankName: 'Three of a Kind',
        score: [HandRank.THREE_OF_A_KIND, tripVal, kicker1, kicker2],
        best5: sorted,
        description: `Three of a Kind, ${RANK_NAMES[VALUE_TO_RANK[tripVal]]}s`,
      };
    }

    // 7. Two Pair
    if (countEntries[0].count === 2 && countEntries[1].count === 2) {
      const highPair = countEntries[0].value;
      const lowPair = countEntries[1].value;
      const kicker = countEntries[2].value;
      return {
        handRank: HandRank.TWO_PAIR,
        rankName: 'Two Pair',
        score: [HandRank.TWO_PAIR, highPair, lowPair, kicker],
        best5: sorted,
        description: `Two Pair, ${RANK_NAMES[VALUE_TO_RANK[highPair]]}s and ${RANK_NAMES[VALUE_TO_RANK[lowPair]]}s`,
      };
    }

    // 8. One Pair
    if (countEntries[0].count === 2) {
      const pairVal = countEntries[0].value;
      const kickers = [countEntries[1].value, countEntries[2].value, countEntries[3].value];
      return {
        handRank: HandRank.ONE_PAIR,
        rankName: 'One Pair',
        score: [HandRank.ONE_PAIR, pairVal, ...kickers],
        best5: sorted,
        description: `One Pair of ${RANK_NAMES[VALUE_TO_RANK[pairVal]]}s`,
      };
    }

    // 9. High Card
    return {
      handRank: HandRank.HIGH_CARD,
      rankName: 'High Card',
      score: [HandRank.HIGH_CARD, ...values],
      best5: sorted,
      description: `High Card, ${RANK_NAMES[VALUE_TO_RANK[values[0]]]}`,
    };
  }

  /**
   * Evaluates the best 5-card hand out of 5, 6, or 7 cards.
   */
  public static evaluate(cards: Card[]): HandEvaluation {
    if (cards.length < 5) {
      throw new Error(`At least 5 cards required for evaluation, got ${cards.length}`);
    }

    if (cards.length === 5) {
      return this.evaluate5Cards(cards);
    }

    // Generate combinations of 5 from N cards
    const combos = this.getCombinations(cards, 5);
    let bestEval: HandEvaluation | null = null;

    for (const combo of combos) {
      const currentEval = this.evaluate5Cards(combo);
      if (!bestEval || this.compareScores(currentEval.score, bestEval.score) > 0) {
        bestEval = currentEval;
      }
    }

    return bestEval!;
  }

  private static getCombinations<T>(array: T[], k: number): T[][] {
    const result: T[][] = [];

    function combine(start: number, combo: T[]) {
      if (combo.length === k) {
        result.push([...combo]);
        return;
      }
      for (let i = start; i < array.length; i++) {
        combo.push(array[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }

    combine(0, []);
    return result;
  }
}
