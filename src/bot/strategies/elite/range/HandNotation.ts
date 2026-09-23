import { Card, Rank, Suit } from '../../../../engine/types';
import { createCard, RANKS, SUITS } from '../../../../engine/Card';
import { WeightedCombo } from './WeightedCombo';

export class HandNotation {
  private static rankValues: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };

  public static getHandNotation(c1: Card, c2: Card): string {
    const v1 = this.rankValues[c1.rank];
    const v2 = this.rankValues[c2.rank];

    if (v1 === v2) {
      return `${c1.rank}${c2.rank}`;
    }

    const highRank = v1 > v2 ? c1.rank : c2.rank;
    const lowRank = v1 > v2 ? c2.rank : c1.rank;
    const suited = c1.suit === c2.suit ? 's' : 'o';

    return `${highRank}${lowRank}${suited}`;
  }

  /**
   * Expands a 169 notation (e.g. "AA", "AKs", "72o") into concrete 2-card combos.
   */
  public static expandNotation(notation: string, weight = 1.0): WeightedCombo[] {
    const combos: WeightedCombo[] = [];
    if (notation.length === 2 && notation[0] === notation[1]) {
      // Pair (6 combos)
      const rank = notation[0] as Rank;
      for (let i = 0; i < SUITS.length; i++) {
        for (let j = i + 1; j < SUITS.length; j++) {
          combos.push({
            cards: [createCard(rank, SUITS[i]), createCard(rank, SUITS[j])],
            weight,
            notation,
          });
        }
      }
    } else if (notation.endsWith('s')) {
      // Suited (4 combos)
      const r1 = notation[0] as Rank;
      const r2 = notation[1] as Rank;
      for (const suit of SUITS) {
        combos.push({
          cards: [createCard(r1, suit), createCard(r2, suit)],
          weight,
          notation,
        });
      }
    } else if (notation.endsWith('o')) {
      // Offsuit (12 combos)
      const r1 = notation[0] as Rank;
      const r2 = notation[1] as Rank;
      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          if (s1 !== s2) {
            combos.push({
              cards: [createCard(r1, s1), createCard(r2, s2)],
              weight,
              notation,
            });
          }
        }
      }
    }
    return combos;
  }

  private static all169Cache: string[] | null = null;

  public static getAll169Hands(): string[] {
    if (this.all169Cache) return this.all169Cache;
    const hands: string[] = [];
    const ranks = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;

    // Pairs
    for (const r of ranks) {
      hands.push(`${r}${r}`);
    }

    // Suited and offsuit
    for (let i = 0; i < ranks.length; i++) {
      for (let j = i + 1; j < ranks.length; j++) {
        hands.push(`${ranks[i]}${ranks[j]}s`);
        hands.push(`${ranks[i]}${ranks[j]}o`);
      }
    }

    this.all169Cache = hands;
    return hands;
  }
}

