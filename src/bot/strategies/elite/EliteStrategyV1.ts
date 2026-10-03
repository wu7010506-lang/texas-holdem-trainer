import { BotStrategy } from '../BotStrategy';
import { BotDecision, BotDecisionContext } from '../../types';
import { PreflopRangeEngine } from './preflop/PreflopRangeEngine';
import { PostflopStrategyEngine } from './postflop/PostflopStrategyEngine';
import { RangeEstimator } from './range/RangeEstimator';
import { RangeUpdater } from './range/RangeUpdater';
import { EliteTraceStore } from './debug/EliteDecisionTrace';
import { EliteDecisionTrace } from './types';
import { SeededRng } from './random/SeededRng';
import { clampBotDecision } from '../../clampBotDecision';

export type EliteBotMode = 'BALANCED' | 'ADAPTIVE';

export class EliteStrategyV1 implements BotStrategy {
  public name = 'EliteStrategyV1';
  public version = '1.0.0';
  private mode: EliteBotMode = 'BALANCED';
  private customRng?: () => number;

  constructor(mode: EliteBotMode = 'BALANCED', seed?: number) {
    this.mode = mode;
    if (seed !== undefined) {
      this.customRng = SeededRng.create(seed);
    }
  }

  public setMode(mode: EliteBotMode): void {
    this.mode = mode;
  }

  public getMode(): EliteBotMode {
    return this.mode;
  }

  public setSeed(seed: number): void {
    this.customRng = SeededRng.create(seed);
  }

  public setRng(rng: () => number): void {
    this.customRng = rng;
  }

  public decideAction(context: BotDecisionContext): BotDecision {
    return clampBotDecision(this.decideRawAction(context), context.legalActions);
  }

  private decideRawAction(context: BotDecisionContext): BotDecision {
    const rng = this.customRng || Math.random;

    if (context.street === 'PREFLOP') {
      const result = PreflopRangeEngine.decidePreflop(context, rng);

      // Create preflop trace
      const ownCardsStr = context.holeCards.map((c) => `${c.rank}${c.suit}`).join(' ');
      const trace: EliteDecisionTrace = {
        position: context.position,
        ownHand: ownCardsStr,
        board: '—',
        pot: context.potSize,
        spr: context.spr,
        potOdds: context.potOdds,
        estimatedHeroRange: '6-Max 100BB 預設翻前範圍',
        ownRangePosition: `節點: ${result.node}`,
        absoluteEquity: 0.5,
        rangeEquity: 0.5,
        rangeAdvantage: 'NEUTRAL',
        nutAdvantage: 'MEDIUM',
        boardTexture: '翻前無公牌',
        blockerScore: 0,
        bluffCandidateScore: 0,
        availableActions: result.distribution.actions.map((a) => `${a.action}${(a.probability * 100).toFixed(0)}%`),
        baseDistribution: result.distribution,
        exploitAdjustmentText: '翻前標準 Mixed Range 查表',
        finalStrategy: result.distribution,
        randomRoll: result.randomRoll,
        selectedAction: result.decision.action + (result.decision.amount ? ` (${result.decision.amount})` : ''),
        reasonCodes: result.reasonCodes,
      };

      EliteTraceStore.setLastTrace(trace);
      return {
        ...result.decision,
        debugTrace: trace,
      };
    }

    // Postflop Decision
    // Build estimated ranges strictly from PUBLIC context (own hole cards + board cards are the only dead cards)
    const deadCards = [...context.holeCards, ...context.communityCards];

    // Find main opponent position from previous actions or default to BTN/BB
    const oppPos = context.position.toUpperCase() === 'BB' ? 'BTN' : 'BB';

    const oppRangeRaw = RangeEstimator.buildInitialRange(oppPos, context.previousActions, deadCards);
    const oppRange = RangeUpdater.updateRangeForAction(
      oppRangeRaw,
      context.communityCards,
      context.amountToCall > 0 ? 'BET' : 'CHECK',
      context.potSize > 0 ? context.amountToCall / context.potSize : 0,
      deadCards
    );

    const ownRangeRaw = RangeEstimator.buildInitialRange(context.position, context.previousActions, deadCards);

    const { decision, trace } = PostflopStrategyEngine.decide(
      context,
      ownRangeRaw,
      oppRange,
      this.mode === 'ADAPTIVE',
      rng
    );

    EliteTraceStore.setLastTrace(trace);
    return {
      ...decision,
      debugTrace: trace,
    };
  }
}
