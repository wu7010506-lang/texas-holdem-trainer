import { PreflopGameNodeType, PreflopMixedAction } from './PreflopGameNode';

/**
 * 6-Max 100BB GTO-Inspired Preflop Strategy Matrix with Mixed Frequencies.
 */
export class PreflopStrategyTable {
  /**
   * Returns mixed action for (node, position, handNotation).
   */
  public static getAction(
    node: PreflopGameNodeType,
    position: string,
    notation: string,
    vsPosition?: string
  ): PreflopMixedAction {
    const pos = position.toUpperCase();
    const vsPos = (vsPosition || 'UTG').toUpperCase();

    // 1. RFI (Raise First In)
    if (node === 'RFI') {
      return this.getRfiAction(pos, notation);
    }

    // 2. Facing Open (3-Bet / Flat / Fold)
    if (node === 'FACING_OPEN' || node === 'COLD_CALL') {
      return this.getFacingOpenAction(pos, vsPos, notation);
    }

    // 3. BB Defense
    if (node === 'BB_DEFENSE') {
      return this.getBbDefenseAction(vsPos, notation);
    }

    // 4. Facing 3-Bet (4-Bet / Call / Fold)
    if (node === 'FACING_THREE_BET') {
      return this.getFacingThreeBetAction(pos, vsPos, notation);
    }

    // 5. Facing 4-Bet (5-Bet All-in / Call / Fold)
    if (node === 'FACING_FOUR_BET') {
      return this.getFacingFourBetAction(notation);
    }

    // 6. Facing Limp
    if (node === 'FACING_LIMP') {
      // Isolate raise or check/overlimp
      const rfi = this.getRfiAction(pos, notation);
      if (rfi.raise > 0.5) {
        return { raise: 0.85, call: 0.15, fold: 0.0 };
      } else if (rfi.raise > 0.2) {
        return { raise: 0.50, call: 0.40, fold: 0.10 };
      } else {
        return { raise: 0.0, call: 0.30, fold: 0.70 };
      }
    }

    // 7. Facing All-in Preflop
    if (node === 'FACING_ALL_IN') {
      if (['AA', 'KK'].includes(notation)) return { raise: 1.0, call: 1.0, fold: 0.0 };
      if (['QQ', 'AKs'].includes(notation)) return { raise: 0.0, call: 0.90, fold: 0.10 };
      if (['JJ', 'AKo'].includes(notation)) return { raise: 0.0, call: 0.60, fold: 0.40 };
      if (['TT', 'AQs'].includes(notation)) return { raise: 0.0, call: 0.35, fold: 0.65 };
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // Default fallback: RFI
    return this.getRfiAction(pos, notation);
  }

  private static getRfiAction(pos: string, hand: string): PreflopMixedAction {
    // Pure Premiums: Raise 100% from any position
    if (['AA', 'KK', 'QQ', 'JJ', 'AKs', 'AKo'].includes(hand)) {
      return { raise: 1.0, call: 0.0, fold: 0.0 };
    }

    // UTG ~ 15% range
    if (pos === 'UTG') {
      if (['TT', '99', '88', '77', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs', 'AQo'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      if (['66', 'KTs', 'QTs', 'T9s', '98s', 'A5s', 'AJo'].includes(hand)) {
        return { raise: 0.50, call: 0.0, fold: 0.50 };
      }
      if (['KQo', '87s', 'A4s'].includes(hand)) {
        return { raise: 0.25, call: 0.0, fold: 0.75 };
      }
      if (hand === 'KJo') {
        return { raise: 0.05, call: 0.0, fold: 0.95 }; // KJo UTG is almost always fold
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // HJ ~ 19% range
    if (pos === 'HJ' || pos === 'MP') {
      if (['TT', '99', '88', '77', '66', 'AQs', 'AJs', 'ATs', 'A5s', 'A4s', 'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', 'AQo', 'AJo', 'KQo'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      if (['55', 'A9s', 'A3s', 'K9s', 'Q9s', 'J9s', '98s', '87s', 'ATo', 'KJo'].includes(hand)) {
        return { raise: 0.60, call: 0.0, fold: 0.40 };
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // CO ~ 27% range
    if (pos === 'CO') {
      if (['TT', '99', '88', '77', '66', '55', '44', '33', '22',
           'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
           'KQs', 'KJs', 'KTs', 'K9s', 'QJs', 'QTs', 'Q9s', 'JTs', 'J9s', 'T9s', '98s', '87s', '76s',
           'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'QJo'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      if (['K8s', 'Q8s', 'J8s', 'T8s', '65s', '54s', 'A9o', 'KTo', 'QTo', 'JTo'].includes(hand)) {
        return { raise: 0.50, call: 0.0, fold: 0.50 };
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // BTN ~ 43% range (Very wide)
    if (pos === 'BTN' || pos === 'BU') {
      // Pocket pairs 22-TT are 100% open
      if (['TT', '99', '88', '77', '66', '55', '44', '33', '22'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      // All suited Aces are 100% open
      if (hand.startsWith('A') && hand.endsWith('s')) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      // Suited Broadways & Connectors down to 54s
      if (['KQs', 'KJs', 'KTs', 'K9s', 'K8s', 'K7s', 'K6s', 'K5s',
           'QJs', 'QTs', 'Q9s', 'Q8s', 'Q7s',
           'JTs', 'J9s', 'J8s', 'J7s',
           'T9s', 'T8s', 'T7s', '98s', '97s', '87s', '86s', '76s', '65s', '54s',
           'AQo', 'AJo', 'ATo', 'A9o', 'A8o', 'A7o',
           'KQo', 'KJo', 'KTo', 'K9o',
           'QJo', 'QTo', 'Q9o', 'JTo', 'J9o', 'T9o'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      if (['A6o', 'A5o', 'A4o', 'A3o', 'A2o', 'K8o', 'Q8o', '96s', '85s', '75s', '64s', '53s'].includes(hand)) {
        return { raise: 0.50, call: 0.0, fold: 0.50 };
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // SB ~ 42% vs BB
    if (pos === 'SB') {
      if (['TT', '99', '88', '77', '66', '55', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A5s', 'A4s',
           'KQs', 'KJs', 'KTs', 'QJs', 'QTs', 'JTs', 'T9s', '98s', 'AQo', 'AJo', 'ATo', 'KQo', 'KJo'].includes(hand)) {
        return { raise: 1.0, call: 0.0, fold: 0.0 };
      }
      if (['44', '33', '22', 'A7s', 'A6s', 'A3s', 'A2s', 'K9s', 'Q9s', 'J9s', '87s', '76s', '65s', 'QJo', 'JTo'].includes(hand)) {
        return { raise: 0.65, call: 0.35, fold: 0.0 };
      }
      if (['K8s', 'K7s', 'Q8s', 'J8s', 'T8s', 'A9o', 'A8o', 'KTo', 'QTo'].includes(hand)) {
        return { raise: 0.30, call: 0.40, fold: 0.30 };
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // BB cannot RFI (everyone folded -> hand doesn't happen)
    return { raise: 0.0, call: 0.0, fold: 1.0 };
  }

  private static getFacingOpenAction(pos: string, vsPos: string, hand: string): PreflopMixedAction {
    // 3-Bet Pure Value
    if (['AA', 'KK', 'QQ', 'AKs'].includes(hand)) {
      return { raise: 1.0, call: 0.0, fold: 0.0 };
    }

    // BTN vs UTG open: tighter 3-bet, flat strong hands
    if (pos === 'BTN' && vsPos === 'UTG') {
      if (['JJ', 'AKo'].includes(hand)) return { raise: 0.70, call: 0.30, fold: 0.0 };
      if (['A5s', 'A4s'].includes(hand)) return { raise: 0.65, call: 0.10, fold: 0.25 }; // 3-bet bluff
      if (['TT', '99', '88', 'AQs', 'AJs', 'KQs', 'QJs', 'JTs'].includes(hand)) return { raise: 0.15, call: 0.85, fold: 0.0 };
      if (['77', '66', 'ATs', 'KTs', 'QTs', 'T9s', '98s', 'AQo'].includes(hand)) return { raise: 0.05, call: 0.70, fold: 0.25 };
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // BTN vs CO open: wider 3-bet
    if (pos === 'BTN') {
      if (['JJ', 'TT', 'AKo', 'AQs'].includes(hand)) return { raise: 0.85, call: 0.15, fold: 0.0 };
      if (['99', '88', '77', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs'].includes(hand)) return { raise: 0.30, call: 0.70, fold: 0.0 };
      if (['A5s', 'A4s', 'A3s', 'K9s', 'Q9s', 'T9s', '87s'].includes(hand)) return { raise: 0.50, call: 0.20, fold: 0.30 };
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // SB vs Open: 3-Bet or Fold strategy mostly (no flatting rakes)
    if (pos === 'SB') {
      if (['JJ', 'TT', 'AKo', 'AQs'].includes(hand)) return { raise: 0.90, call: 0.0, fold: 0.10 };
      if (['99', '88', 'AJs', 'ATs', 'A5s', 'A4s', 'KQs', 'KJs'].includes(hand)) return { raise: 0.60, call: 0.0, fold: 0.40 };
      if (['77', '66', 'QJs', 'JTs', 'T9s'].includes(hand)) return { raise: 0.30, call: 0.0, fold: 0.70 };
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    return { raise: 0.0, call: 0.0, fold: 1.0 };
  }

  private static getBbDefenseAction(vsPos: string, hand: string): PreflopMixedAction {
    // Premiums: 3-Bet value
    if (['AA', 'KK', 'QQ', 'AKs'].includes(hand)) {
      return { raise: 1.0, call: 0.0, fold: 0.0 };
    }
    if (['JJ', 'AKo'].includes(hand)) {
      return vsPos === 'BTN' || vsPos === 'SB'
        ? { raise: 0.85, call: 0.15, fold: 0.0 }
        : { raise: 0.55, call: 0.45, fold: 0.0 };
    }

    // BB vs BTN Open: Wide defense
    if (vsPos === 'BTN' || vsPos === 'CO') {
      // 3-Bet Bluffs with Blockers
      if (['A5s', 'A4s', 'A3s', 'A2s', 'K9s', 'Q9s', 'J8s', 'T7s', '75s'].includes(hand)) {
        return { raise: 0.50, call: 0.35, fold: 0.15 };
      }
      // Flat call middle value
      if (['TT', '99', '88', '77', '66', '55', '44', '33', '22',
           'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s',
           'KQs', 'KJs', 'KTs', 'K8s', 'K7s', 'K6s',
           'QJs', 'QTs', 'Q8s', 'JTs', 'J9s', 'T9s', '98s', '87s', '76s', '65s', '54s',
           'AQo', 'AJo', 'ATo', 'KQo', 'KJo', 'KTo', 'QJo', 'QTo', 'JTo'].includes(hand)) {
        return { raise: 0.10, call: 0.90, fold: 0.0 };
      }
      if (['A5o', 'A4o', 'K9o', 'Q9o', 'J9o', 'T8o', '97s', '86s'].includes(hand)) {
        return { raise: 0.0, call: 0.60, fold: 0.40 };
      }
      return { raise: 0.0, call: 0.0, fold: 1.0 };
    }

    // BB vs UTG Open: Tight defense
    if (['TT', '99', '88', '77', 'AQs', 'AJs', 'ATs', 'KQs', 'KJs', 'QJs', 'JTs'].includes(hand)) {
      return { raise: 0.10, call: 0.90, fold: 0.0 };
    }
    if (['66', '55', '44', 'A5s', 'KTs', 'QTs', 'T9s', '98s', 'AQo', 'AJo'].includes(hand)) {
      return { raise: 0.05, call: 0.70, fold: 0.25 };
    }
    return { raise: 0.0, call: 0.0, fold: 1.0 };
  }

  private static getFacingThreeBetAction(pos: string, vsPos: string, hand: string): PreflopMixedAction {
    if (['AA', 'KK'].includes(hand)) {
      return { raise: 1.0, call: 0.0, fold: 0.0 }; // 4-Bet 100%
    }
    if (hand === 'AKs') {
      return { raise: 0.85, call: 0.15, fold: 0.0 };
    }
    if (['QQ', 'AKo'].includes(hand)) {
      return { raise: 0.50, call: 0.50, fold: 0.0 };
    }
    if (['JJ', 'TT', 'AQs', 'AJs', 'KQs'].includes(hand)) {
      return { raise: 0.10, call: 0.80, fold: 0.10 };
    }
    // 4-Bet Bluff Blocker (A5s / A4s)
    if (['A5s', 'A4s'].includes(hand)) {
      return pos === 'BTN' ? { raise: 0.40, call: 0.20, fold: 0.40 } : { raise: 0.25, call: 0.15, fold: 0.60 };
    }
    if (['99', '88', 'ATs', 'KJs', 'QJs', 'JTs', 'T9s'].includes(hand)) {
      return pos === 'BTN' ? { raise: 0.0, call: 0.55, fold: 0.45 } : { raise: 0.0, call: 0.25, fold: 0.75 };
    }
    return { raise: 0.0, call: 0.0, fold: 1.0 };
  }

  private static getFacingFourBetAction(hand: string): PreflopMixedAction {
    if (['AA', 'KK'].includes(hand)) return { raise: 1.0, call: 0.0, fold: 0.0 }; // 5-Bet Jam
    if (hand === 'AKs') return { raise: 0.70, call: 0.30, fold: 0.0 };
    if (hand === 'QQ') return { raise: 0.40, call: 0.40, fold: 0.20 };
    if (['JJ', 'AKo'].includes(hand)) return { raise: 0.20, call: 0.20, fold: 0.60 };
    return { raise: 0.0, call: 0.0, fold: 1.0 };
  }
}
