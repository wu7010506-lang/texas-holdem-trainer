import { LegalActions, PlayerAction, PlayerState } from './types';

export class ActionValidator {
  /**
   * Calculates legal actions for a given player in the current betting state.
   */
  public static getLegalActions(
    player: PlayerState,
    currentBet: number,
    lastRaiseAmount: number,
    bigBlind: number
  ): LegalActions {
    if (player.folded || player.allIn || player.stack <= 0) {
      return {
        canFold: false,
        canCheck: false,
        canCall: false,
        callAmount: 0,
        canBet: false,
        minBet: 0,
        maxBet: 0,
        canRaise: false,
        minRaise: 0,
        maxRaise: 0,
        canAllIn: false,
        allInAmount: 0,
      };
    }

    const amountToCall = currentBet - player.currentBet;
    const raiseRights = !player.acted || player.raiseReopenAt === undefined || currentBet >= player.raiseReopenAt;
    const canCheck = amountToCall === 0;
    const canFold = true; // Can always fold if facing a bet; even if can check, folding is technically allowed

    // Calling: if facing a bet greater than current contribution
    const canCall = amountToCall > 0;
    const callAmount = Math.min(player.stack, Math.max(0, amountToCall));

    // Betting (when currentBet is 0)
    let canBet = false;
    let minBet = 0;
    let maxBet = 0;

    if (currentBet === 0) {
      canBet = player.stack > 0;
      minBet = Math.min(player.stack, bigBlind);
      maxBet = player.stack;
    }

    // Raising (when currentBet > 0)
    let canRaise = false;
    let minRaise = 0;
    let maxRaise = 0;

    if (currentBet > 0) {
      // Player needs more stack than just calling to raise
      const maxTotal = player.currentBet + player.stack;
      if (maxTotal > currentBet && raiseRights) {
        canRaise = true;
        // Standard rule: Min raise is currentBet + max(bigBlind, lastRaiseAmount)
        const raiseIncrement = Math.max(bigBlind, lastRaiseAmount);
        const targetMin = currentBet + raiseIncrement;

        if (maxTotal < targetMin) {
          // If the player doesn't have enough to make a full minimum raise, they can still go all-in
          minRaise = maxTotal;
        } else {
          minRaise = targetMin;
        }
        maxRaise = maxTotal;
      }
    }

    const canAllIn = player.stack > 0 && (raiseRights || player.currentBet + player.stack <= currentBet);
    const allInAmount = player.currentBet + player.stack;

    return {
      canFold,
      canCheck,
      canCall,
      callAmount,
      canBet,
      minBet,
      maxBet,
      canRaise,
      minRaise,
      maxRaise,
      canAllIn,
      allInAmount,
    };
  }

  /**
   * Validates if a proposed action is strictly legal.
   */
  public static validate(
    player: PlayerState,
    action: PlayerAction,
    currentBet: number,
    lastRaiseAmount: number,
    bigBlind: number
  ): { valid: boolean; normalizedAction?: PlayerAction; reason?: string } {
    const legal = this.getLegalActions(player, currentBet, lastRaiseAmount, bigBlind);

    if (action.amount !== undefined && (!Number.isFinite(action.amount) || action.amount < 0)) {
      return { valid: false, reason: 'Chip amount must be a finite non-negative number.' };
    }

    switch (action.type) {
      case 'FOLD':
        if (!legal.canFold) {
          return { valid: false, reason: 'Player cannot fold right now.' };
        }
        return { valid: true, normalizedAction: { type: 'FOLD' } };

      case 'CHECK':
        if (!legal.canCheck) {
          return { valid: false, reason: 'Cannot check; there is an outstanding bet to call.' };
        }
        return { valid: true, normalizedAction: { type: 'CHECK' } };

      case 'CALL': {
        if (!legal.canCall) {
          return { valid: false, reason: 'No bet to call; player should check.' };
        }
        const amount = legal.callAmount;
        if (amount >= player.stack) {
          return { valid: true, normalizedAction: { type: 'ALL_IN', amount: player.currentBet + player.stack } };
        }
        return { valid: true, normalizedAction: { type: 'CALL', amount } };
      }

      case 'BET': {
        if (!legal.canBet) {
          return { valid: false, reason: 'Cannot bet when there is already a bet in place (must raise).' };
        }
        const amt = action.amount ?? legal.minBet;
        if (amt < legal.minBet && amt < legal.maxBet) {
          return { valid: false, reason: `Bet amount ${amt} is below minimum bet ${legal.minBet}.` };
        }
        if (amt >= legal.maxBet) {
          return { valid: true, normalizedAction: { type: 'ALL_IN', amount: player.currentBet + player.stack } };
        }
        return { valid: true, normalizedAction: { type: 'BET', amount: amt } };
      }

      case 'RAISE': {
        if (!legal.canRaise) {
          return { valid: false, reason: 'Cannot raise right now.' };
        }
        const targetTotal = action.amount ?? legal.minRaise;
        if (targetTotal < legal.minRaise && targetTotal < legal.maxRaise) {
          return { valid: false, reason: `Raise to ${targetTotal} is below min raise ${legal.minRaise}.` };
        }
        if (targetTotal >= legal.maxRaise) {
          return { valid: true, normalizedAction: { type: 'ALL_IN', amount: legal.maxRaise } };
        }
        return { valid: true, normalizedAction: { type: 'RAISE', amount: targetTotal } };
      }

      case 'ALL_IN': {
        if (!legal.canAllIn) {
          return { valid: false, reason: 'Player has no chips to go all-in.' };
        }
        return { valid: true, normalizedAction: { type: 'ALL_IN', amount: legal.allInAmount } };
      }

      default:
        return { valid: false, reason: `Unknown action type: ${(action as any).type}` };
    }
  }
}
