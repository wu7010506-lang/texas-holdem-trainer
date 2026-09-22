import { Card } from '../engine/types';
import { BotProfile } from './types';
import { PreflopRanges } from './PreflopRanges';
import { createCard, RANKS, SUITS } from '../engine/Card';
import { HandEvaluator } from '../engine/HandEvaluator';

export interface WeightedCombo {
  cards: [Card, Card];
  weight: number; // 0.0 to 1.0
  notation: string; // e.g. "AKs", "TT", "87o"
}

export interface OpponentRange {
  combos: WeightedCombo[];
  totalWeight: number;
}

export class OpponentRangeModel {
  private static allCombosCache: { cards: [Card, Card]; notation: string }[] | null = null;

  /**
   * Generates all 1,326 possible 2-card starting combos from a standard 52-card deck.
   */
  public static getAllCombos(): { cards: [Card, Card]; notation: string }[] {
    if (this.allCombosCache) {
      return this.allCombosCache;
    }

    const deck: Card[] = [];
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push(createCard(r, s));
      }
    }

    const combos: { cards: [Card, Card]; notation: string }[] = [];
    for (let i = 0; i < deck.length; i++) {
      for (let j = i + 1; j < deck.length; j++) {
        const c1 = deck[i];
        const c2 = deck[j];
        const notation = PreflopRanges.getHandNotation(c1, c2);
        combos.push({ cards: [c1, c2], notation });
      }
    }

    this.allCombosCache = combos;
    return combos;
  }

  /**
   * Builds an opponent's estimated range based on position, profile, public actions, and dead cards.
   */
  public static buildRange(
    position: string,
    profile?: BotProfile,
    actionHistory: { action: string; amount?: number; reasoning?: string }[] = [],
    communityCards: Card[] = [],
    deadCards: Card[] = []
  ): OpponentRange {
    const deadCardIds = new Set(deadCards.map((c) => c.id));
    const allCombos = this.getAllCombos();

    // Default parameters if profile not provided
    const vpip = profile?.vpip ?? 0.25;
    const pfr = profile?.pfr ?? 0.18;
    const threeBetFreq = profile?.threeBetFrequency ?? 0.08;

    const baseThreshold = PreflopRanges.getPositionOpenThreshold(position);
    // Adjusted open cutoff based on VPIP/PFR
    const openCutoff = Math.max(0.10, baseThreshold - (pfr - 0.18) * 0.4);
    const callCutoff = Math.max(0.05, openCutoff - (vpip - pfr) * 0.5);

    // Check actions for this player
    const has3Bet = actionHistory.some((a) => a.action === 'RAISE' && (a.amount ?? 0) >= 30);
    const hasRaised = actionHistory.some((a) => a.action === 'RAISE' || a.action === 'BET');
    const hasCalled = actionHistory.some((a) => a.action === 'CALL');

    const weightedCombos: WeightedCombo[] = [];
    let totalWeight = 0;

    for (const item of allCombos) {
      const [c1, c2] = item.cards;
      // Exclude combos with known/dead cards
      if (deadCardIds.has(c1.id) || deadCardIds.has(c2.id)) {
        continue;
      }

      const power = PreflopRanges.getHandPower(item.notation);
      let weight = 0;

      if (has3Bet) {
        // 3-Bet range: Premiums + some bluff combos
        if (power >= 0.88) {
          weight = 1.0;
        } else if (power >= 0.75) {
          weight = threeBetFreq * 2.0;
        } else if (item.notation.endsWith('s') && power >= 0.50) {
          // Suited wheel aces / connectors as 3-bet bluff candidates
          weight = (profile?.bluffFrequency ?? 0.1) * 0.5;
        }
      } else if (hasRaised) {
        // Open-raise range
        if (power >= openCutoff) {
          weight = 1.0;
        } else if (power >= openCutoff - 0.10) {
          weight = 0.5;
        }
      } else if (hasCalled) {
        // Call range: medium strength / speculative hands (capped, premiums would usually 3-bet)
        if (power >= 0.92) {
          weight = 0.15; // Slow-played monsters
        } else if (power >= callCutoff) {
          weight = 0.85;
        } else if (item.notation.endsWith('s')) {
          weight = 0.4;
        }
      } else {
        // General active range based on VPIP
        if (power >= openCutoff) {
          weight = 1.0;
        } else if (power >= callCutoff) {
          weight = 0.7;
        } else if (vpip > 0.35 && item.notation.endsWith('s')) {
          weight = 0.4;
        }
      }

      // Postflop texture adjustment if board is dealt
      if (communityCards.length >= 3 && weight > 0) {
        const eval5 = HandEvaluator.evaluate([...item.cards, ...communityCards]);
        // Hands that made top pair, two pair, sets, or flushes retain 100% weight
        if (eval5.score[0] >= 2) {
          weight = Math.min(1.0, weight * 1.2);
        } else if (eval5.score[0] === 1) {
          // Pair
          weight = weight * 0.9;
        } else {
          // High card / air: reduced unless board allows draws
          weight = weight * 0.35;
        }
      }

      if (weight > 0.001) {
        weightedCombos.push({
          cards: item.cards,
          weight,
          notation: item.notation,
        });
        totalWeight += weight;
      }
    }

    return {
      combos: weightedCombos,
      totalWeight,
    };
  }

  /**
   * Samples one valid 2-card combo from an OpponentRange proportional to its weights,
   * strictly excluding any unavailable cards.
   */
  public static sampleCombo(
    range: OpponentRange,
    unavailableCardIds: Set<string>,
    rng: () => number = Math.random
  ): [Card, Card] | null {
    // Filter combos that do not conflict with unavailable cards
    let availableTotalWeight = 0;
    const candidates: WeightedCombo[] = [];

    for (const c of range.combos) {
      if (!unavailableCardIds.has(c.cards[0].id) && !unavailableCardIds.has(c.cards[1].id)) {
        candidates.push(c);
        availableTotalWeight += c.weight;
      }
    }

    if (candidates.length === 0 || availableTotalWeight <= 0) {
      return null;
    }

    let roll = rng() * availableTotalWeight;
    for (const c of candidates) {
      if (roll <= c.weight) {
        return c.cards;
      }
      roll -= c.weight;
    }

    return candidates[candidates.length - 1].cards;
  }
}
