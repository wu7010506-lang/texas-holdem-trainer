import { ApexCandidateEV } from '../types';
import { Street } from '../../../../engine/types';

export interface EVContext {
  pot: number;
  toCall: number;
  playerStack: number;
  street: Street;
  equityVsGeneralRange: number;
  equityWhenCalled: number;
  predictedFoldRate: number;
  predictedCallRate: number;
  predictedRaiseRate: number;
  activeOpponents?: number;
}

export class ActionEVEstimator {
  /**
   * Computes EV for checking (when toCall == 0)
   */
  public static computeCheckEV(ctx: EVContext): ApexCandidateEV {
    const isRiver = ctx.street === 'RIVER';
    const realization = isRiver ? 1.0 : 0.95;
    const ev = ctx.equityVsGeneralRange * ctx.pot * realization;

    return {
      actionLabel: 'Check',
      action: 'CHECK',
      amount: 0,
      ev,
      predictedHeroFoldRate: 0,
      predictedHeroCallRate: 1.0,
      predictedHeroRaiseRate: 0,
      equityWhenCalled: ctx.equityVsGeneralRange,
    };
  }

  /**
   * Computes EV for folding
   */
  public static computeFoldEV(): ApexCandidateEV {
    return {
      actionLabel: 'Fold',
      action: 'FOLD',
      amount: 0,
      ev: 0,
      predictedHeroFoldRate: 0,
      predictedHeroCallRate: 0,
      predictedHeroRaiseRate: 0,
      equityWhenCalled: 0,
    };
  }

  /**
   * Computes EV for calling (when toCall > 0)
   */
  public static computeCallEV(ctx: EVContext): ApexCandidateEV {
    const totalPotAfterCall = ctx.pot + ctx.toCall;
    const ev = ctx.equityVsGeneralRange * totalPotAfterCall - ctx.toCall;

    return {
      actionLabel: `Call $${ctx.toCall}`,
      action: 'CALL',
      amount: ctx.toCall,
      ev,
      predictedHeroFoldRate: 0,
      predictedHeroCallRate: 1.0,
      predictedHeroRaiseRate: 0,
      equityWhenCalled: ctx.equityVsGeneralRange,
    };
  }

  /**
   * Computes EV for a proposed bet or raise sizing with multiway awareness
   */
  public static computeBetEV(
    ctx: EVContext,
    betAmount: number,
    label: string,
    isAllIn = false
  ): ApexCandidateEV {
    const b = Math.min(betAmount, ctx.playerStack);
    const oppCount = Math.max(1, ctx.activeOpponents || 1);

    // In multiway pots, all opponents must fold for a bluff to win uncontested
    const effectiveFoldRate = oppCount > 1 ? Math.pow(ctx.predictedFoldRate, oppCount) : ctx.predictedFoldRate;
    const effectiveRaiseRate = 1.0 - Math.pow(1.0 - ctx.predictedRaiseRate, oppCount);
    const effectiveCallRate = Math.max(0, 1.0 - effectiveFoldRate - effectiveRaiseRate);

    // EV if opponents fold: Bot immediately collects the current pot
    const evFold = effectiveFoldRate * ctx.pot;

    // EV if an opponent calls:
    const potWhenCalled = ctx.pot + b * (1 + (oppCount > 1 ? 1.3 : 1.0));
    const netReturnWhenCalled = ctx.equityWhenCalled * potWhenCalled - b;
    const evCall = effectiveCallRate * netReturnWhenCalled;

    // EV if an opponent raises:
    const raiseLoss = b * (1.0 - ctx.equityVsGeneralRange * 0.5);
    const evRaise = -effectiveRaiseRate * raiseLoss;

    const totalEV = evFold + evCall + evRaise;

    return {
      actionLabel: label,
      action: isAllIn ? 'ALL_IN' : (ctx.toCall > 0 ? 'RAISE' : 'BET'),
      amount: b,
      ev: totalEV,
      predictedHeroFoldRate: effectiveFoldRate,
      predictedHeroCallRate: effectiveCallRate,
      predictedHeroRaiseRate: effectiveRaiseRate,
      equityWhenCalled: ctx.equityWhenCalled,
    };
  }
}
