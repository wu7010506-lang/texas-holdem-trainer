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
   * Computes EV for a proposed bet or raise sizing
   */
  public static computeBetEV(
    ctx: EVContext,
    betAmount: number,
    label: string,
    isAllIn = false
  ): ApexCandidateEV {
    const b = Math.min(betAmount, ctx.playerStack);
    const F = ctx.predictedFoldRate;
    const C = ctx.predictedCallRate;
    const R = ctx.predictedRaiseRate;

    // EV if Hero folds: Bot immediately collects the current pot
    const evFold = F * ctx.pot;

    // EV if Hero calls:
    // Pot after Hero calls = pot + 2*b (or pot + b + call)
    const potWhenCalled = ctx.pot + b * 2;
    const netReturnWhenCalled = ctx.equityWhenCalled * potWhenCalled - b;
    const evCall = C * netReturnWhenCalled;

    // EV if Hero raises:
    // If Bot folds to raise, Bot loses b. If Bot has monster equity, loss is mitigated.
    const raiseLoss = b * (1.0 - ctx.equityVsGeneralRange * 0.5);
    const evRaise = -R * raiseLoss;

    const totalEV = evFold + evCall + evRaise;

    return {
      actionLabel: label,
      action: isAllIn ? 'ALL_IN' : (ctx.toCall > 0 ? 'RAISE' : 'BET'),
      amount: b,
      ev: totalEV,
      predictedHeroFoldRate: F,
      predictedHeroCallRate: C,
      predictedHeroRaiseRate: R,
      equityWhenCalled: ctx.equityWhenCalled,
    };
  }
}
