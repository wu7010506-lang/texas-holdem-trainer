import { BotStrategy } from '../BotStrategy';
import { BotDecision, BotDecisionContext } from '../../types';
import { Card, ActionRecord } from '../../../engine/types';
import { ApexCandidateEV, ApexDecisionTrace } from './types';
import { BaselineStrategyProvider } from './baseline/BaselineStrategyProvider';
import { HeroModel, recordEvent, getPosteriorRate } from './model/HeroModel';
import { HeroModelStore } from './model/HeroModelStore';
import { RecencyModel } from './model/RecencyModel';
import { ChangeDetector } from './model/ChangeDetector';
import { HeroRangeTracker } from './range/HeroRangeTracker';
import { DynamicSizingSearch } from './ev/DynamicSizingSearch';
import { ActionEVEstimator } from './ev/ActionEVEstimator';
import { ConfidenceEstimator } from './exploit/ConfidenceEstimator';
import { ExploitSearchEngine } from './exploit/ExploitSearchEngine';
import { ApexTelemetryService } from './telemetry/ApexDecisionTrace';
import { HandNotation } from '../elite/range/HandNotation';
import { clampBotDecision } from '../../clampBotDecision';

export type ApexBotMode = 'BASELINE' | 'APEX_EXPLOIT';

export class ApexStrategy implements BotStrategy {
  public name = 'ApexStrategy';
  public version = '2.0.0';

  private baselineProvider: BaselineStrategyProvider;
  private heroModel: HeroModel;
  private recencyModel: RecencyModel;
  private forcedMode?: ApexBotMode;
  private customRng?: () => number;
  private processedActionKeys: Set<string> = new Set();

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
        const key = `${a.handId}_${a.street}_${a.seat}_${a.action}_${a.timestamp || 0}_${a.amount || 0}`;
        if (this.processedActionKeys.has(key)) continue;
        this.processedActionKeys.add(key);

        // Record voluntary action
        if (a.street === 'PREFLOP') {
          const preflopRaisesBefore = previousActions.filter(
            prev => prev.handId === a.handId &&
                    prev.street === 'PREFLOP' &&
                    prev.seat !== a.seat &&
                    prev.timestamp <= a.timestamp &&
                    (prev.action === 'RAISE' || (prev.action === 'BET' && (prev.amount ?? 0) > 10) || prev.action === 'ALL_IN')
          ).length;

          const posStats = this.heroModel.getPreflopStats(a.position || 'BTN');
          if (a.action === 'ALL_IN') {
            recordEvent(this.heroModel.preflopAllInShove, true);
            recordEvent(posStats.rfi, true);
          } else if (a.action === 'BET' || a.action === 'RAISE') {
            recordEvent(this.heroModel.preflopAllInShove, false);
            if (preflopRaisesBefore === 0) {
              recordEvent(posStats.rfi, true);
            } else if (preflopRaisesBefore === 1) {
              recordEvent(posStats.facingOpenThreeBet, true);
            } else if (preflopRaisesBefore >= 2) {
              recordEvent(posStats.facingThreeBetFourBet, true);
            }
          } else if (a.action === 'CALL') {
            recordEvent(this.heroModel.preflopAllInShove, false);
            if (preflopRaisesBefore <= 1) {
              recordEvent(posStats.facingOpenCall, true);
            } else {
              recordEvent(posStats.facingThreeBetCall, true);
            }
          } else if (a.action === 'FOLD') {
            if (preflopRaisesBefore <= 1) {
              recordEvent(posStats.facingOpenFold, true);
            } else {
              recordEvent(posStats.facingThreeBetFold, true);
            }
          }
        } else if (a.street === 'FLOP') {
          const flopStats = this.heroModel.getFlopStats('DRY');
          if (a.action === 'BET' || a.action === 'RAISE' || a.action === 'ALL_IN') recordEvent(flopStats.cbet, true);
          if (a.action === 'FOLD') {
            recordEvent(flopStats.foldVsCbet, true);
            this.recencyModel.record('FLOP', 'FLOP_CBET_FOLD', true);
          }
        } else if (a.street === 'RIVER') {
          if (a.action === 'ALL_IN') {
            recordEvent(this.heroModel.riverStats.betOverbet, true);
            recordEvent(this.heroModel.riverStats.bluffEstimate, true, 0.5);
          } else if (a.action === 'FOLD') {
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
    return clampBotDecision(this.decideRawAction(context), context.legalActions);
  }

  private decideRawAction(context: BotDecisionContext): BotDecision {
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

    // Preflop: Use baseline GTO preflop table with fast execution + Exploit adjustments
    if (context.street === 'PREFLOP') {
      const posStats = this.heroModel.getPreflopStats('BTN');
      const threeBetFoldRate = getPosteriorRate(posStats.facingThreeBetFold);

      // Preflop Exploit A: Facing Maniac All-in Shove (Widen calldown range for positive EV)
      const isFacingShove = (
        context.amountToCall >= context.effectiveStack * 0.6 ||
        (context.currentBet >= context.bigBlind * 20 && context.amountToCall > 0)
      ) && context.legalActions.canCall;

      if (isFacingShove) {
        const heroShoved = (context.previousActions || []).some(
          (a) => (a.playerName === 'Hero' || a.playerId === 'hero' || a.seat === 0) &&
                 a.street === 'PREFLOP' &&
                 (a.action === 'ALL_IN' || ((a.action === 'RAISE' || a.action === 'BET') && (a.amount ?? 0) >= context.bigBlind * 20))
        );

        const shoveCount = this.heroModel.preflopAllInShove.count;
        const shoveOpps = this.heroModel.preflopAllInShove.opportunities;
        const shoveRate = getPosteriorRate(this.heroModel.preflopAllInShove);
        const isManiacShove = heroShoved && (shoveCount >= 2 || (shoveOpps >= 2 && shoveRate >= 0.18));

        if (isManiacShove) {
          const notation = context.holeCards.length === 2 ? HandNotation.getHandNotation(context.holeCards[0], context.holeCards[1]) : '72o';
          // Tier 1: Strong pocket pairs & premium broadways (~65-85% equity vs random cards)
          const tier1 = ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', 'AKs', 'AKo', 'AQs', 'AQo', 'AJs', 'AJo', 'ATs', 'ATo'];
          // Tier 2: Speculative pairs, suited Aces, high broadways (~56-62% equity vs random cards)
          const tier2 = ['55', '44', '33', '22', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s', 'A9o', 'A8o', 'KQs', 'KQo', 'KJs', 'KJo', 'KTs', 'QJs'];

          const roll = this.customRng ? this.customRng() : Math.random();
          const shouldCall = tier1.includes(notation) || (tier2.includes(notation) && roll < 0.85);

          if (shouldCall) {
            const potAfterCall = context.potSize + context.amountToCall;
            const estimatedEquity = tier1.includes(notation) ? 0.72 : 0.60;
            const estimatedEV = (estimatedEquity * potAfterCall - context.amountToCall) / context.bigBlind;

            const ownCardsStr = context.holeCards.map(c => `${c.rank}${c.suit}`).join(' ');
            const trace: ApexDecisionTrace = {
              position: context.position,
              ownHand: ownCardsStr,
              board: '—',
              pot: context.potSize,
              spr: context.spr,
              heroModelSummary: `記錄對局: ${this.heroModel.handsTracked} 手 | Hero 全押次數: ${shoveCount} (全押率: ${(shoveRate * 100).toFixed(0)}%)`,
              modelConfidence: 'HIGH',
              confidenceScore: 0.85,
              candidateEVs: [
                {
                  actionLabel: 'Call All-in',
                  action: 'CALL',
                  amount: context.amountToCall,
                  ev: estimatedEV,
                  predictedHeroFoldRate: 0,
                  predictedHeroCallRate: 1,
                  predictedHeroRaiseRate: 0,
                  equityWhenCalled: estimatedEquity,
                },
                {
                  actionLabel: 'Fold',
                  action: 'FOLD',
                  amount: 0,
                  ev: 0,
                  predictedHeroFoldRate: 0,
                  predictedHeroCallRate: 0,
                  predictedHeroRaiseRate: 0,
                  equityWhenCalled: 0,
                },
              ],
              baselinePreferredAction: baselineDecision.action,
              baselinePreferredEV: 0,
              exploitPreferredAction: 'CALL',
              exploitPreferredEV: estimatedEV,
              expectedExploitGain: estimatedEV,
              finalAction: 'CALL',
              finalAmount: context.amountToCall,
              reasonCodes: ['EXPLOIT_OVERBLUFF'],
              mode: 'APEX_EXPLOIT',
            };
            ApexTelemetryService.setLatestTrace(trace);

            return {
              action: 'CALL',
              amount: context.amountToCall,
              reasoning: `【Apex 剝削抓暴衝全押】偵測到 Hero 翻前連續/超高頻全押 (次數: ${shoveCount} 次，全押率 ${(shoveRate * 100).toFixed(0)}%)，範圍已大幅擴張至隨機空氣牌。手牌 [${notation}] 預估勝率 ${(estimatedEquity * 100).toFixed(0)}%，預期獲利 +${estimatedEV.toFixed(1)} BB，執行寬範圍抓詐跟注！`,
              reasonCodes: ['EXPLOIT_OVERBLUFF'],
              debugTrace: trace,
            };
          }
        }
      }

      // Preflop Exploit B: Hero overfolds to 3-bets (> 65% with sufficient sample)
      if (
        posStats.facingThreeBetFold.opportunities >= 4 &&
        threeBetFoldRate > 0.65 &&
        context.amountToCall > 0 &&
        context.playerStack > context.amountToCall * 3
      ) {
        const threeBetAmount = Math.min(context.playerStack, context.amountToCall * 3.2);
        return {
          action: 'RAISE',
          amount: Math.round(threeBetAmount),
          reasoning: `【Apex 翻前剝削】偵測到 Hero 面對 3-Bet 過度棄牌率 ${(threeBetFoldRate * 100).toFixed(0)}%，執行剝削性 3-Bet 加注。`,
          reasonCodes: ['EXPLOIT_PRE_FLOP_OVERFOLD'],
          debugTrace: {
            position: context.position,
            ownHand: context.holeCards.map(c => `${c.rank}${c.suit}`).join(' '),
            board: '—',
            pot: context.potSize,
            spr: context.spr,
            heroModelSummary: `記錄對局: ${this.heroModel.handsTracked} 手`,
            modelConfidence: 'MEDIUM',
            confidenceScore: 0.6,
            candidateEVs: [],
            baselinePreferredAction: baselineDecision.action,
            baselinePreferredEV: 0,
            exploitPreferredAction: 'RAISE',
            exploitPreferredEV: 1.5,
            expectedExploitGain: 1.5,
            finalAction: 'RAISE',
            finalAmount: Math.round(threeBetAmount),
            reasonCodes: ['EXPLOIT_PRE_FLOP_OVERFOLD'],
            mode: 'APEX_EXPLOIT',
          },
        };
      }

      // Preflop Exploit C: Blind Steal against Overfolding Blinds
      const isLatePosition = context.position === 'BTN' || context.position === 'CO' || context.position === 'SB';
      const isUnopened = context.amountToCall <= context.bigBlind && context.currentBet <= context.bigBlind;
      const bbStats = this.heroModel.getPreflopStats('BB');
      const bbFoldToSteal = getPosteriorRate(bbStats.facingOpenFold);

      if (
        isLatePosition &&
        isUnopened &&
        bbStats.facingOpenFold.opportunities >= 3 &&
        bbFoldToSteal > 0.62 &&
        baselineDecision.action === 'FOLD' &&
        (context.legalActions.canRaise || context.legalActions.canBet)
      ) {
        const notation = context.holeCards.length === 2 ? HandNotation.getHandNotation(context.holeCards[0], context.holeCards[1]) : '72o';
        const isSemiPlayable = notation.endsWith('s') || ['A', 'K', 'Q', 'J'].some(r => notation.includes(r)) || ['98o', '87o', '76o'].includes(notation);
        if (isSemiPlayable) {
          const stealAmount = Math.max(context.legalActions.minRaise, Math.round(context.bigBlind * 2.2));
          return {
            action: context.legalActions.canRaise ? 'RAISE' : 'BET',
            amount: stealAmount,
            reasoning: `【Apex 翻前偷盲剝削】偵測到大盲 (BB) 面對開局過度棄牌率 ${(bbFoldToSteal * 100).toFixed(0)}%，在位置優勢持 [${notation}] 執行剝削性偷盲加注。`,
            reasonCodes: ['EXPLOIT_BLIND_STEAL'],
            debugTrace: {
              position: context.position,
              ownHand: context.holeCards.map(c => `${c.rank}${c.suit}`).join(' '),
              board: '—',
              pot: context.potSize,
              spr: context.spr,
              heroModelSummary: `記錄對局: ${this.heroModel.handsTracked} 手 | BB 棄牌率: ${(bbFoldToSteal * 100).toFixed(0)}%`,
              modelConfidence: 'MEDIUM',
              confidenceScore: 0.65,
              candidateEVs: [],
              baselinePreferredAction: baselineDecision.action,
              baselinePreferredEV: 0,
              exploitPreferredAction: 'RAISE',
              exploitPreferredEV: 1.2,
              expectedExploitGain: 1.2,
              finalAction: context.legalActions.canRaise ? 'RAISE' : 'BET',
              finalAmount: stealAmount,
              reasonCodes: ['EXPLOIT_BLIND_STEAL'],
              mode: 'APEX_EXPLOIT',
            },
          };
        }
      }

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

    const activeOpponents = Math.max(1, context.activePlayers - 1);
    const boardTextureKey = context.boardTexture?.isPaired
      ? 'PAIRED'
      : (context.boardTexture?.wetnessScore ?? 0) > 0.5
      ? 'WET'
      : 'DRY';

    // 5. Evaluate Candidate EVs
    const candidateEVs: ApexCandidateEV[] = [];
    const equityVsGeneral = heroTracker.evaluateEquityVsRange(botHoleCards, board, Math.max(1, context.activePlayers - 1));

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
        activeOpponents,
      });
      candidateEVs.push(checkEV);

      // Search discrete bet sizings: 33%, 75%, 125%, SPR-commitment, All-in
      const sizingSearch = DynamicSizingSearch.search(
        context.potSize,
        0,
        context.playerStack,
        context.street,
        botHoleCards,
        board,
        heroTracker,
        this.heroModel,
        boardTextureKey,
        activeOpponents,
        context.legalActions.minBet || 10,
        context.spr
      );
      candidateEVs.push(...sizingSearch.candidates);
    } else {
      // Facing bet: Hero has bet/raised, Bayesian-condition Hero's range
      const betFraction = context.potSize > 0 ? context.amountToCall / context.potSize : 0.5;
      heroTracker.updateOnAction('BET', betFraction, board);
      const equityVsBet = heroTracker.evaluateEquityVsRange(botHoleCards, board, Math.max(1, context.activePlayers - 1));

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
        activeOpponents,
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
          this.heroModel,
          boardTextureKey,
          activeOpponents,
          context.legalActions.minRaise || 20,
          context.spr
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

    // 8. Legal action clamping and safety verification
    let finalAction = exploitResult.finalAction as any;
    let finalAmount = exploitResult.finalAmount;

    if (finalAction === 'CHECK' && !context.legalActions.canCheck) {
      finalAction = context.legalActions.canCall ? 'CALL' : 'FOLD';
      finalAmount = context.legalActions.callAmount;
    } else if (finalAction === 'CALL') {
      if (!context.legalActions.canCall && context.legalActions.canCheck) {
        finalAction = 'CHECK';
        finalAmount = 0;
      } else {
        finalAmount = context.legalActions.callAmount;
      }
    } else if (finalAction === 'BET') {
      if (!context.legalActions.canBet) {
        if (context.legalActions.canRaise) {
          finalAction = 'RAISE';
          finalAmount = Math.max(context.legalActions.minRaise, Math.min(context.legalActions.maxRaise, finalAmount ?? context.legalActions.minRaise));
        } else if (context.legalActions.canCheck) {
          finalAction = 'CHECK';
          finalAmount = 0;
        } else {
          finalAction = 'CALL';
          finalAmount = context.legalActions.callAmount;
        }
      } else {
        finalAmount = Math.max(context.legalActions.minBet, Math.min(context.legalActions.maxBet, finalAmount ?? context.legalActions.minBet));
      }
    } else if (finalAction === 'RAISE') {
      if (!context.legalActions.canRaise) {
        if (context.legalActions.canCall) {
          finalAction = 'CALL';
          finalAmount = context.legalActions.callAmount;
        } else {
          finalAction = 'FOLD';
          finalAmount = 0;
        }
      } else {
        finalAmount = Math.max(context.legalActions.minRaise, Math.min(context.legalActions.maxRaise, finalAmount ?? context.legalActions.minRaise));
      }
    } else if (finalAction === 'ALL_IN') {
      finalAmount = context.legalActions.allInAmount;
    }

    trace.finalAction = finalAction;
    trace.finalAmount = finalAmount;

    return {
      action: finalAction,
      amount: finalAmount,
      reasoning,
      reasonCodes: exploitResult.reasonCodes,
      debugTrace: trace,
    };
  }
}
