import { BotStrategy } from '../../BotStrategy';
import { BotDecision, BotDecisionContext } from '../../../types';

/**
 * 1. RiverOverfolderBot: Folds to any river bet > 85% of the time unless holding nuts.
 */
export class RiverOverfolderBot implements BotStrategy {
  public name = 'RiverOverfolderBot';
  public version = '1.0.0';

  public decideAction(ctx: BotDecisionContext): BotDecision {
    if (ctx.street === 'RIVER' && ctx.amountToCall > 0) {
      // Overfolds on river: only calls if hand category is STRAIGHT or better
      const isNut = ['STRAIGHT', 'FLUSH', 'FULL_HOUSE', 'QUADS_OR_BETTER'].includes(ctx.handStrength.category);
      if (!isNut) {
        return {
          action: 'FOLD',
          reasoning: 'RiverOverfolderBot: Overfolding river bet',
        };
      }
      return {
        action: 'CALL',
        amount: ctx.amountToCall,
        reasoning: 'RiverOverfolderBot: Calling with monster',
      };
    }

    if (ctx.amountToCall === 0) {
      return { action: 'CHECK', reasoning: 'Check' };
    }
    return { action: 'CALL', amount: ctx.amountToCall, reasoning: 'Standard call' };
  }
}

/**
 * 2. CallingStationBot: Never folds pair or draw on flop/turn/river (fold rate < 10%).
 */
export class CallingStationBot implements BotStrategy {
  public name = 'CallingStationBot';
  public version = '1.0.0';

  public decideAction(ctx: BotDecisionContext): BotDecision {
    if (ctx.amountToCall > 0) {
      // Calls if has any pair, draw, or high card
      return {
        action: 'CALL',
        amount: ctx.amountToCall,
        reasoning: 'CallingStationBot: Never folds to bets',
      };
    }
    return { action: 'CHECK', reasoning: 'Check' };
  }
}

/**
 * 3. UnderblufferBot: Bets or raises river strictly with nuts/strong value, 0% bluffs.
 */
export class UnderblufferBot implements BotStrategy {
  public name = 'UnderblufferBot';
  public version = '1.0.0';

  public decideAction(ctx: BotDecisionContext): BotDecision {
    if (ctx.street === 'RIVER') {
      const isValue = ['TRIPS_OR_SET', 'STRAIGHT', 'FLUSH', 'FULL_HOUSE', 'QUADS_OR_BETTER'].includes(ctx.handStrength.category);
      if (isValue) {
        return {
          action: 'BET',
          amount: Math.round(ctx.potSize * 0.75),
          reasoning: 'UnderblufferBot: 100% value bet',
        };
      }
      return { action: ctx.amountToCall > 0 ? 'FOLD' : 'CHECK', reasoning: 'UnderblufferBot: Zero bluffs' };
    }

    if (ctx.amountToCall === 0) return { action: 'CHECK', reasoning: 'Check' };
    return { action: 'CALL', amount: ctx.amountToCall, reasoning: 'Call' };
  }
}

/**
 * 4. AdaptiveOpponentBot: Starts overfolding river, then after threshold hands shifts to calling station.
 */
export class AdaptiveOpponentBot implements BotStrategy {
  public name = 'AdaptiveOpponentBot';
  public version = '1.0.0';
  public handsPlayed = 0;
  public shiftThreshold = 40;

  public decideAction(ctx: BotDecisionContext): BotDecision {
    const isStationPhase = this.handsPlayed >= this.shiftThreshold;

    if (ctx.street === 'RIVER' && ctx.amountToCall > 0) {
      if (isStationPhase) {
        return { action: 'CALL', amount: ctx.amountToCall, reasoning: 'AdaptiveOpponentBot: Shifted to station' };
      } else {
        const isNut = ['FULL_HOUSE', 'QUADS_OR_BETTER'].includes(ctx.handStrength.category);
        if (!isNut) {
          return { action: 'FOLD', reasoning: 'AdaptiveOpponentBot: Initial overfold phase' };
        }
        return { action: 'CALL', amount: ctx.amountToCall, reasoning: 'Call nuts' };
      }
    }

    if (ctx.amountToCall === 0) return { action: 'CHECK', reasoning: 'Check' };
    return { action: 'CALL', amount: ctx.amountToCall, reasoning: 'Call' };
  }
}
