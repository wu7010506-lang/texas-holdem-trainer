import { Card } from '../../../../engine/types';
import { HandNotation } from './HandNotation';
import { HandRange, WeightedCombo } from './WeightedCombo';
import { PreflopStrategyTable } from '../preflop/PreflopStrategyTable';


export class RangeEstimator {
  /**
   * Builds the estimated preflop range for an opponent based on position, actions, and dead cards.
   */
  public static buildInitialRange(
    position: string,
    actionHistory: { action: string; amount?: number; street?: string }[],
    deadCards: Card[] = []
  ): HandRange {
    const pos = position.toUpperCase();
    const allCombos: WeightedCombo[] = [];

    // Filter preflop actions by this player or overall
    const preflopActions = actionHistory.filter((a) => !a.street || a.street === 'PREFLOP');
    const has3Bet = preflopActions.some((a) => a.action === 'RAISE' && (a.amount ?? 0) >= 25);
    const hasOpenRaised = preflopActions.some((a) => a.action === 'RAISE' || a.action === 'BET');
    const hasCalled = preflopActions.some((a) => a.action === 'CALL');

    const notations = HandNotation.getAll169Hands();

    for (const notation of notations) {
      let weight = 0;
      if (has3Bet) {
        // Facing / Making 3-bet
        const mixed = PreflopStrategyTable.getAction('FACING_OPEN', pos, notation);
        weight = mixed.raise;
      } else if (hasOpenRaised) {
        // Opened
        const mixed = PreflopStrategyTable.getAction('RFI', pos, notation);
        weight = mixed.raise;
      } else if (hasCalled) {
        // Flat called
        const mixed = pos === 'BB'
          ? PreflopStrategyTable.getAction('BB_DEFENSE', 'BB', notation, 'BTN')
          : PreflopStrategyTable.getAction('FACING_OPEN', pos, notation);
        weight = mixed.call;

      } else {
        // Limp or blind check
        weight = 0.40;
      }

      if (weight > 0.01) {
        const combos = HandNotation.expandNotation(notation, weight);
        allCombos.push(...combos);
      }
    }

    const range = new HandRange(allCombos);
    return range.removeCards(deadCards);
  }
}
