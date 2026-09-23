import { BotStrategy } from '../BotStrategy';
import { BotDecision, BotDecisionContext } from '../../types';
import { Card, Street, ActionRecord } from '../../../engine/types';
import { ApexCandidateEV, ApexDecisionTrace, ApexReasonCode } from './types';
import { BaselineStrategyProvider } from './baseline/BaselineStrategyProvider';
import { HeroModel, recordEvent } from './model/HeroModel';
import { HeroModelStore } from './model/HeroModelStore';
import { RecencyModel } from './model/RecencyModel';
import { ChangeDetector } from './model/ChangeDetector';
import { HeroRangeTracker } from './range/HeroRangeTracker';
import { DynamicSizingSearch } from './ev/DynamicSizingSearch';
import { ActionEVEstimator } from './ev/ActionEVEstimator';
import { ConfidenceEstimator } from './exploit/ConfidenceEstimator';
import { ExploitSearchEngine } from './exploit/ExploitSearchEngine';
import { ApexTelemetryService } from './telemetry/ApexDecisionTrace';

export type ApexBotMode = 'BASELINE' | 'APEX_EXPLOIT';

export class ApexStrategy implements BotStrategy {
  public name = 'ApexStrategy';
  public version = '2.0.0';

  private baselineProvider: BaselineStrategyProvider;
  private heroModel: HeroModel;
  private recencyModel: RecencyModel;
  private forcedMode?: ApexBotMode;
  private customRng?: () => number;

  constructor(heroModel?: HeroModel) {
    this.baselineProvider = new BaselineStrategyProvider();
    this.heroModel = heroModel || HeroModelStore.load();
    this.recencyModel = new RecencyModel(25);
  }

  public setMode(mode: ApexBotMode): void {
    this.forcedMode = mode;
  }

  public getModel(): HeroModel {
    return this.heroModel;
  }

  public setRng(rng: () => number): void {
    this.customRng = rng;
  }

  /**
   * Observe Hero's actions in previous actions and update the HeroModel
   */
  public observeActions(previousActions: ActionRecord[]): void {
    // Process actions by non-bot player (Hero)
    for (const a of previousActions) {
      const isHero = a.playerName === 'Hero' || a.playerId === 'hero' || a.seat === 0;
      if (isHero && a.reasoning !== 'Small Blind' && a.reasoning !== 'Big Blind') {
        // Record voluntary action
        if (a.street === 'PREFLOP') {
          const posStats = this.heroModel.getPreflopStats(a.position || 'BTN');
          if (a.action === 'BET' || a.action === 'RAISE') {
            recordEvent(posStats.rfi, true);
          } else if (a.action === 'CALL') {
            recordEvent(posStats.facingOpenCall, true);
          } else if (a.action === 'FOLD') {
            recordEvent(posStats.facingThreeBetFold, true);
          }
        } else if (a.street === 'FLOP') {
          const flopStats = this.heroModel.getFlopStats('DRY');
          if (a.action === 'BET') recordEvent(flopStats.cbet, true);
          if (a.action === 'FOLD') {
            recordEvent(flopStats.foldVsCbet, true);
            this.recencyModel.record('FLOP', 'FLOP_CBET_FOLD', true);
          }
        } else if (a.street === 'RIVER') {
          if (a.action === 'FOLD') {
            recordEvent(this.heroModel.riverStats.foldVsLarge, true);
            recordEvent(this.heroModel.riverStats.foldVsOverbet, true);
            this.recencyModel.record('RIVER', 'RIVER_OVERFOLD', true);
          } else if (a.action === 'CALL') {
            recordEvent(this.heroModel.riverStats.foldVsLarge, false);
            recordEvent(this.heroModel.riverStats.foldVsOverbet, false);
            this.recencyModel.record('RIVER', 'RIVER_OVERFOLD', false);
          }
        }
      }
    }
    HeroModelStore.save(this.heroModel);
  }

  public decideAction(context: BotDecisionContext): BotDecision {
    // 1. Observe and update Hero model from recent actions
    if (context.previousActions && context.previousActions.length > 0) {
      this.observeActions(context.previousActions);
    }

    // 2. Query Baseline Strategy (Elite V1 Balanced)
    const baselineDecision = this.baselineProvider.decideAction(context);

    // If forced to baseline mode, return baseline directly
    if (this.forcedMode === 'BASELINE') {
      return baselineDecision;
    }

    // 3. Board texture & Hero position
    const board = context.communityCards;
    const botHoleCards: [Card, Card] = [context.holeCards[0], context.holeCards[1]];
    const deadCards = [...context.holeCards, ...board];
    const heroPosition = 'BTN'; // Default to BTN / Heads-up position

    // 4. Hero Range Tracking (Bayesian)
    const heroTracker = new HeroRangeTracker(
      heroPosition,
      context.previousActions || [],
      deadCards,
      this.heroModel
    );

    // 5. Evaluate Candidate EVs
    const candidateEVs: ApexCandidateEV[] = [];
    const equityVsGeneral = heroTracker.evaluateEquityVsRange(botHoleCards, board);

    if (context.amountToCall === 0) {
      // Free action: Can Check or Bet
      const checkEV = ActionEVEstimator.computeCheckEV({
        pot: context.potSize,
        toCall: 0,
        playerStack: context.playerStack,
        street: context.street,
        equityVsGeneralRange: equityVsGeneral,
        equityWhenCalled: equityVsGeneral,
        predictedFoldRate: 0,
        predictedCallRate: 1.0,
        predictedRaiseRate: 0,
      });
      candidateEVs.push(checkEV);

      // Search discrete bet sizings: 33%, 75%, 125%, All-in
      const sizingSearch = DynamicSizingSearch.search(
        context.potSize,
        0,
        context.playerStack,
        context.street,
        botHoleCards,
        board,
        heroTracker,
        this.heroModel
      );
      candidateEVs.push(...sizingSearch.candidates);
    } else {
      // Facing bet: Hero has bet/raised, Bayesian-condition Hero's range
      const betFraction = context.potSize > 0 ? context.amountToCall / context.potSize : 0.5;
      heroTracker.updateOnAction('BET', betFraction, board);
      const equityVsBet = heroTracker.evaluateEquityVsRange(botHoleCards, board);

      // Facing bet: Can Fold, Call, or Raise
      const foldEV = ActionEVEstimator.computeFoldEV();
      candidateEVs.push(foldEV);

      const callEV = ActionEVEstimator.computeCallEV({
        pot: context.potSize,
        toCall: context.amountToCall,
        playerStack: context.playerStack,
        street: context.street,
        equityVsGeneralRange: equityVsBet,
        equityWhenCalled: equityVsBet,
        predictedFoldRate: 0,
        predictedCallRate: 1.0,
        predictedRaiseRate: 0,
      });
      candidateEVs.push(callEV);

      // Evaluate Raise candidate
      if (context.playerStack > context.amountToCall) {
        const raiseSizingSearch = DynamicSizingSearch.search(
          context.potSize + context.amountToCall,
          context.amountToCall,
          context.playerStack - context.amountToCall,
          context.street,
          botHoleCards,
          board,
          heroTracker,
          this.heroModel
        );
        candidateEVs.push(...raiseSizingSearch.candidates);
      }
    }

    // 6. Strategy shift detection & Confidence estimation
    let decayFactor = 1.0;
    if (context.street === 'RIVER') {
      const recentRiver = this.recencyModel.getRecentStats('RIVER_OVERFOLD');
      const histFold = this.heroModel.riverStats.foldVsLarge.count / Math.max(1, this.heroModel.riverStats.foldVsLarge.opportunities);
      const shift = ChangeDetector.detectShift(
        this.heroModel.riverStats.foldVsLarge.opportunities,
        histFold,
        recentRiver.opportunities,
        recentRiver.rate,
        'River 棄牌率'
      );
      decayFactor = shift.decayFactor;
    }

    const riverOpportunities = context.amountToCall > 0
      ? Math.max(this.heroModel.riverStats.bluffEstimate.opportunities, this.heroModel.riverStats.foldVsLarge.opportunities)
      : Math.max(this.heroModel.riverStats.foldVsLarge.opportunities, this.heroModel.riverStats.foldVsOverbet.opportunities);

    const spotSampleSize = context.street === 'RIVER'
      ? riverOpportunities
      : context.street === 'FLOP'
      ? this.heroModel.getFlopStats('DRY').foldVsCbet.opportunities
      : 15;

    const confidence = ConfidenceEstimator.computeConfidence(spotSampleSize, 10, decayFactor);

    // 7. Exploit Search Engine
    const exploitResult = ExploitSearchEngine.selectAction(
      { action: baselineDecision.action, amount: baselineDecision.amount },
      candidateEVs,
      this.heroModel,
      botHoleCards,
      board,
      context.street,
      context.amountToCall,
      confidence.score
    );

    // 8. Generate Telemetry Trace
    const ownCardsStr = context.holeCards.map(c => `${c.rank}${c.suit}`).join(' ');
    const boardCardsStr = board.length > 0 ? board.map(c => `${c.rank}${c.suit}`).join(' ') : '—';
    const trace: ApexDecisionTrace = {
      position: context.position,
      ownHand: ownCardsStr,
      board: boardCardsStr,
      pot: context.potSize,
      spr: context.spr,
      heroModelSummary: `記錄對局: ${this.heroModel.handsTracked} 手 | 信心度: ${(confidence.score * 100).toFixed(0)}%`,
      modelConfidence: confidence.level,
      confidenceScore: confidence.score,
      candidateEVs,
      baselinePreferredAction: exploitResult.baselinePreferredAction,
      baselinePreferredEV: exploitResult.baselinePreferredEV,
      exploitPreferredAction: exploitResult.exploitPreferredAction,
      exploitPreferredEV: exploitResult.exploitPreferredEV,
      expectedExploitGain: exploitResult.expectedExploitGain,
      finalAction: exploitResult.finalAction,
      finalAmount: exploitResult.finalAmount,
      reasonCodes: exploitResult.reasonCodes,
      mode: exploitResult.mode,
    };
    ApexTelemetryService.setLatestTrace(trace);

    // 9. Format Reason Text in Traditional Chinese
    let reasoning = `【Apex 自適應決策】`;
    if (exploitResult.mode === 'APEX_EXPLOIT') {
      const topReason = exploitResult.reasonCodes[0] || 'EV_MAXIMIZATION';
      reasoning += ` 執行剝削：${topReason}。候選動作 [${exploitResult.exploitPreferredAction}] 預期 EV ${exploitResult.exploitPreferredEV.toFixed(1)} BB (高於基準 +${exploitResult.expectedExploitGain.toFixed(1)} BB，信心度 ${(confidence.score * 100).toFixed(0)}%)。`;
    } else {
      reasoning += ` 回退基準 (Baseline Fallback)：樣本信心度 ${(confidence.score * 100).toFixed(0)}% 尚不足或剝削收益極小，執行 GTO-Inspired 平衡動作 [${baselineDecision.action}]。`;
    }

    return {
      action: exploitResult.finalAction as any,
      amount: exploitResult.finalAmount,
      reasoning,
      reasonCodes: exploitResult.reasonCodes,
      debugTrace: trace,
    };
  }
}
