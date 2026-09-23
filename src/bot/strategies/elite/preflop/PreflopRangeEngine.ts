import { BotDecision, BotDecisionContext } from '../../../types';
import { HandNotation } from '../range/HandNotation';
import { PreflopGameNodeType, PreflopMixedAction } from './PreflopGameNode';
import { PreflopStrategyTable } from './PreflopStrategyTable';
import { ActionDistribution, ActionProbability } from '../../BotStrategy';
import { ReasonCode } from '../types';

export class PreflopRangeEngine {
  /**
   * Evaluates the preflop decision node from context.
   */
  public static detectGameNode(context: BotDecisionContext): {
    node: PreflopGameNodeType;
    vsPosition?: string;
    limperCount: number;
    raiserCount: number;
  } {
    const { currentBet, bigBlind, previousActions, position } = context;

    // Filter preflop actions (ignoring automatic blind posts)
    const preflopActions = previousActions.filter(
      (a) => a.street === 'PREFLOP' && a.reasoning !== 'Small Blind' && a.reasoning !== 'Big Blind'
    );
    const raises = preflopActions.filter((a) => a.action === 'RAISE' || (a.action === 'BET' && (a.amount ?? 0) > bigBlind));
    const limpers = preflopActions.filter((a) => a.action === 'CALL' && (a.amount ?? 0) <= bigBlind);


    const isFacingAllIn = currentBet >= context.effectiveStack * 0.7;
    if (isFacingAllIn && raises.length > 0) {
      return { node: 'FACING_ALL_IN', limperCount: 0, raiserCount: raises.length };
    }

    if (raises.length === 0) {
      if (limpers.length > 0) {
        return { node: 'FACING_LIMP', limperCount: limpers.length, raiserCount: 0 };
      }
      if (position.toUpperCase() === 'SB') {
        return { node: 'SB_VS_BB', limperCount: 0, raiserCount: 0 };
      }
      return { node: 'RFI', limperCount: 0, raiserCount: 0 };
    }

    if (raises.length === 1) {
      const raiser = raises[0];
      const vsPos = raiser.position || 'UTG';
      if (position.toUpperCase() === 'BB') {
        return { node: 'BB_DEFENSE', vsPosition: vsPos, limperCount: limpers.length, raiserCount: 1 };
      }
      if (limpers.length > 0) {
        return { node: 'SQUEEZE', vsPosition: vsPos, limperCount: limpers.length, raiserCount: 1 };
      }
      return { node: 'FACING_OPEN', vsPosition: vsPos, limperCount: 0, raiserCount: 1 };
    }

    if (raises.length === 2) {
      return { node: 'FACING_THREE_BET', vsPosition: raises[1].position || 'BTN', limperCount: 0, raiserCount: 2 };
    }

    return { node: 'FACING_FOUR_BET', vsPosition: raises[raises.length - 1].position || 'CO', limperCount: 0, raiserCount: raises.length };
  }

  /**
   * Calculates dynamic preflop sizing based on position, game node, callers, and effective stack.
   */
  public static calculatePreflopSizing(
    context: BotDecisionContext,
    node: PreflopGameNodeType,
    limperCount: number
  ): number {
    const { bigBlind, currentBet, legalActions, position, effectiveStack } = context;
    const pos = position.toUpperCase();
    const isOop = pos === 'SB' || pos === 'BB';

    let targetSize = legalActions.minRaise;

    if (node === 'RFI' || node === 'SB_VS_BB') {
      // Standard open: 2.5 BB IP, 3.0 BB SB
      const baseBB = isOop ? 3.0 : 2.5;
      targetSize = Math.round(bigBlind * baseBB);
    } else if (node === 'FACING_LIMP') {
      // Iso-raise: 3.5 BB + 1 BB per additional limper, +1 BB if OOP
      const baseBB = 3.5 + Math.max(0, limperCount - 1) + (isOop ? 1.0 : 0);
      targetSize = Math.round(bigBlind * baseBB);
    } else if (node === 'FACING_OPEN' || node === 'BB_DEFENSE' || node === 'SQUEEZE') {
      // 3-Bet sizing: 3x open IP, 4x open OOP + 1x per caller
      const mult = isOop ? 4.0 : 3.0;
      targetSize = Math.round(currentBet * mult + limperCount * currentBet);
    } else if (node === 'FACING_THREE_BET') {
      // 4-Bet sizing: 2.2x ~ 2.4x of 3-bet
      targetSize = Math.round(currentBet * 2.3);
    } else if (node === 'FACING_FOUR_BET' || node === 'FACING_ALL_IN') {
      targetSize = legalActions.allInAmount;
    }

    // If targetSize is more than 35% of effective stack, committing threshold recommends All-in
    if (targetSize >= effectiveStack * 0.35 && legalActions.canAllIn) {
      targetSize = legalActions.allInAmount;
    }

    // Bound to legal min and max raise
    targetSize = Math.max(legalActions.minRaise, Math.min(legalActions.maxRaise, targetSize));
    return targetSize;
  }

  /**
   * Resolves preflop action with mixed strategy and seeded RNG.
   */
  public static decidePreflop(
    context: BotDecisionContext,
    rng: () => number = Math.random
  ): {
    decision: BotDecision;
    distribution: ActionDistribution;
    reasonCodes: ReasonCode[];
    randomRoll: number;
    node: PreflopGameNodeType;
    notation: string;
  } {
    const { holeCards, legalActions } = context;
    const notation = holeCards.length === 2 ? HandNotation.getHandNotation(holeCards[0], holeCards[1]) : '72o';
    const { node, vsPosition, limperCount } = this.detectGameNode(context);

    const mixed: PreflopMixedAction = PreflopStrategyTable.getAction(
      node,
      context.position,
      notation,
      vsPosition
    );

    const targetRaiseSize = this.calculatePreflopSizing(context, node, limperCount);

    // Build Action Distribution
    const actions: ActionProbability[] = [];

    // Raise / Bet probability
    if (legalActions.canRaise || legalActions.canBet) {
      if (mixed.raise > 0.001) {
        actions.push({
          action: legalActions.canRaise ? 'RAISE' : 'BET',
          amount: targetRaiseSize,
          probability: mixed.raise,
        });
      }
    }

    // Call / Check probability
    if (mixed.call > 0.001) {
      if (legalActions.canCheck) {
        actions.push({ action: 'CHECK', probability: mixed.call });
      } else if (legalActions.canCall) {
        actions.push({ action: 'CALL', amount: legalActions.callAmount, probability: mixed.call });
      }
    }

    // Fold probability
    if (mixed.fold > 0.001 && legalActions.canFold) {
      // If free to check, never fold! Shift fold to check
      if (legalActions.canCheck) {
        const checkAction = actions.find((a) => a.action === 'CHECK');
        if (checkAction) {
          checkAction.probability += mixed.fold;
        } else {
          actions.push({ action: 'CHECK', probability: mixed.fold });
        }
      } else {
        actions.push({ action: 'FOLD', probability: mixed.fold });
      }
    }

    // Normalize probabilities if any
    const totalProb = actions.reduce((s, a) => s + a.probability, 0);
    if (totalProb > 0) {
      actions.forEach((a) => (a.probability /= totalProb));
    } else {
      // Fallback
      if (legalActions.canCheck) actions.push({ action: 'CHECK', probability: 1.0 });
      else if (legalActions.canFold) actions.push({ action: 'FOLD', probability: 1.0 });
    }

    const roll = rng();
    let accum = 0;
    let chosen = actions[actions.length - 1];

    for (const a of actions) {
      accum += a.probability;
      if (roll <= accum) {
        chosen = a;
        break;
      }
    }

    const reasonCodes: ReasonCode[] = ['PREFLOP_MIXED_ACTION'];
    if (context.position.toUpperCase() === 'BTN' || context.position.toUpperCase() === 'CO') {
      reasonCodes.push('POSITION_ADVANTAGE');
    }

    const decision: BotDecision = {
      action: chosen.action,
      amount: chosen.amount,
      reasoning: `[Elite V1 翻前] 節點: ${node}, 手牌: ${notation}, 位置: ${context.position} (開局/防守混合策略)`,
      debugScores: {
        foldScore: mixed.fold,
        callScore: mixed.call,
        raiseScore: mixed.raise,
        randomRoll: roll,
      },
    };

    return {
      decision,
      distribution: { actions },
      reasonCodes,
      randomRoll: roll,
      node,
      notation,
    };
  }
}
