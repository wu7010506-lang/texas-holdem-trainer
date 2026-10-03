import { BotDecision, BotDecisionContext } from '../../../types';
import { ActionDistribution, ActionProbability } from '../../BotStrategy';
import { BoardTextureAnalyzer } from './BoardTextureAnalyzer';
import { RangeAdvantageAnalyzer } from './RangeAdvantageAnalyzer';
import { NutAdvantageAnalyzer } from './NutAdvantageAnalyzer';
import { BlockerAnalyzer } from './BlockerAnalyzer';
import { SizingStrategy } from './SizingStrategy';
import { MultiwayAdjustment } from './MultiwayAdjustment';
import { RangeEquityEvaluator } from '../equity/RangeEquityEvaluator';
import { HandRange } from '../range/WeightedCombo';
import { ReasonCode, EliteDecisionTrace } from '../types';

export class PostflopStrategyEngine {
  /**
   * Resolves postflop mixed strategy by synthesizing Range vs Range equity,
   * Board Texture, Range Advantage, Nut Advantage, Blockers, MDF, and Multiway rules.
   */
  public static decide(
    context: BotDecisionContext,
    ownRange: HandRange,
    oppRange: HandRange,
    adaptiveMode: boolean,
    rng: () => number = Math.random
  ): {
    decision: BotDecision;
    trace: EliteDecisionTrace;
  } {
    const {
      holeCards,
      communityCards,
      legalActions,
      potSize,
      playerStack,
      amountToCall,
      spr,
      potOdds,
      activePlayers,
      position,
      street,
    } = context;

    // 1. Board Texture Analysis
    const texture = BoardTextureAnalyzer.analyze(communityCards);

    // 2. Range vs Range & Nut Advantage
    const rangeAdv = RangeAdvantageAnalyzer.analyze(ownRange, oppRange, communityCards);
    const nutAdv = NutAdvantageAnalyzer.analyze(ownRange, oppRange, communityCards);

    // 3. Blocker & Unblocker Analysis
    const blockerInfo = BlockerAnalyzer.analyze(holeCards, communityCards, oppRange);

    // 4. Equity Calculation (Hand vs Opponent Range)
    const eqResult = RangeEquityEvaluator.calculate(holeCards, oppRange, communityCards, 250, Math.max(1, activePlayers - 1));
    const equity = eqResult.equity;

    // 5. Multiway Adjustment
    const multiway = MultiwayAdjustment.calculate(activePlayers - 1);

    // 6. Minimum Defense Frequency (MDF) if facing bet
    const mdf = amountToCall > 0 ? potSize / (potSize + amountToCall) : 1.0;

    const reasonCodes: ReasonCode[] = [];
    if (rangeAdv.advantage === 'HIGH' || rangeAdv.advantage === 'SLIGHT_HIGH') {
      reasonCodes.push('RANGE_ADVANTAGE');
    }
    if (nutAdv.nutAdvantage === 'HIGH') {
      reasonCodes.push('NUT_ADVANTAGE');
    }
    if (blockerInfo.bluffCandidateScore >= 0.65) {
      reasonCodes.push('GOOD_BLUFF_BLOCKER');
    } else if (blockerInfo.blockerScore <= -0.20) {
      reasonCodes.push('POOR_BLUFF_BLOCKER');
    }
    if (spr <= 1.5) {
      reasonCodes.push('LOW_SPR');
    }
    if (activePlayers > 2) {
      reasonCodes.push('MULTIWAY_TIGHTENING');
    }

    // 7. Determine Actions & Probabilities
    const actions: ActionProbability[] = [];

    // Facing Bet (Call / Fold / Raise)
    if (amountToCall > 0) {
      // Required equity to call
      const requiredEquity = potOdds + multiway.requiredStrengthShift;

      let callProb = 0;
      let foldProb = 0;
      let raiseProb = 0;

      if (equity >= requiredEquity + 0.15) {
        // Strong equity -> Call high, Raise sometimes (value)
        if (equity > 0.75) {
          callProb = 0.60;
          raiseProb = 0.40;
          reasonCodes.push('STRONG_VALUE');
        } else {
          callProb = 0.85;
          raiseProb = 0.15;
          reasonCodes.push('THIN_VALUE');
        }
      } else if (equity >= requiredEquity) {
        // Direct pot odds met -> Call high
        callProb = 0.80 * mdf;
        foldProb = 1.0 - callProb;
        reasonCodes.push('MDF_DEFENSE');
      } else {
        // Negative EV on direct equity -> Check for Blocker Bluff Raise or Fold
        if (blockerInfo.bluffCandidateScore >= 0.70 && multiway.bluffMultiplier > 0.5 && legalActions.canRaise) {
          raiseProb = 0.20 * multiway.bluffMultiplier;
          foldProb = 1.0 - raiseProb;
          reasonCodes.push('GOOD_BLUFF_BLOCKER');
        } else {
          foldProb = 1.0;
        }
      }

      if (legalActions.canCall && callProb > 0.001) {
        actions.push({ action: 'CALL', amount: legalActions.callAmount, probability: callProb });
      }
      if (legalActions.canRaise && raiseProb > 0.001) {
        const raiseAmt = Math.min(legalActions.maxRaise, Math.max(legalActions.minRaise, Math.round(amountToCall * 3)));
        actions.push({ action: 'RAISE', amount: raiseAmt, probability: raiseProb });
      }
      if (legalActions.canFold && foldProb > 0.001) {
        actions.push({ action: 'FOLD', probability: foldProb });
      }
    } else {
      // Unopened / Check-around spot (Check or Bet)
      const hasNutAdv = nutAdv.nutAdvantage === 'HIGH';
      const sizingOptions = SizingStrategy.getCandidateSizes(
        street,
        potSize,
        playerStack,
        spr,
        texture,
        hasNutAdv && multiway.overbetAllowed
      );

      // C-bet / Bet frequency based on range advantage, hand equity, and blockers
      let betFrequency = 0.35; // baseline

      if (rangeAdv.advantage === 'HIGH') betFrequency += 0.25;
      else if (rangeAdv.advantage === 'SLIGHT_HIGH') betFrequency += 0.10;
      else if (rangeAdv.advantage === 'LOW') betFrequency -= 0.15;

      if (texture.wetnessScore < 0.30) betFrequency += 0.10; // Dry board c-bet frequency is higher

      // Multiway reduction
      betFrequency *= multiway.cbetMultiplier;

      // Classify own hand: Value vs Medium Showdown vs Air
      if (equity >= 0.70) {
        // Value hand: Bet high frequency
        const betProb = Math.min(0.90, betFrequency + 0.30);
        const checkProb = 1.0 - betProb;

        if (legalActions.canCheck) actions.push({ action: 'CHECK', probability: checkProb });
        if (legalActions.canBet && sizingOptions.length > 0) {
          // Choose sizing: 75% or 125% or All-in
          const primarySize = hasNutAdv && sizingOptions.find((s) => s.type === 'BET_125')
            ? sizingOptions.find((s) => s.type === 'BET_125')!
            : sizingOptions.find((s) => s.type === 'BET_75') || sizingOptions[0];
          actions.push({
            action: primarySize.type === 'ALL_IN' ? 'ALL_IN' : 'BET',
            amount: Math.min(legalActions.maxBet, Math.max(legalActions.minBet, primarySize.amount)),
            probability: betProb,
          });
        }
        reasonCodes.push('STRONG_VALUE');
      } else if (equity >= 0.45 && equity < 0.70) {
        // Medium showdown value -> Check back often
        const betProb = Math.min(0.30, betFrequency * 0.4);
        const checkProb = 1.0 - betProb;

        if (legalActions.canCheck) actions.push({ action: 'CHECK', probability: checkProb });
        if (legalActions.canBet && sizingOptions.length > 0) {
          const smallSize = sizingOptions.find((s) => s.type === 'BET_33') || sizingOptions[0];
          actions.push({
            action: 'BET',
            amount: Math.min(legalActions.maxBet, Math.max(legalActions.minBet, smallSize.amount)),
            probability: betProb,
          });
        }
        reasonCodes.push('CHECK_BACK_MEDIUM_SHOWDOWN');
      } else {
        // Air / weak draw -> Blocker-based Bluff Selection scaled by Range Advantage & Board Texture
        const baseBluff = blockerInfo.bluffCandidateScore >= 0.65 ? 0.28 : 0.10;
        const frequencyScale = Math.max(0.4, betFrequency / 0.35);
        let bluffProb = Math.max(0.02, Math.min(0.45, baseBluff * frequencyScale * multiway.bluffMultiplier));

        if (blockerInfo.bluffCandidateScore >= 0.65) {
          reasonCodes.push('GOOD_BLUFF_BLOCKER');
        } else {
          reasonCodes.push('POOR_BLUFF_BLOCKER');
        }

        const checkProb = 1.0 - bluffProb;
        if (legalActions.canCheck) actions.push({ action: 'CHECK', probability: checkProb });
        if (legalActions.canBet && bluffProb > 0.001 && sizingOptions.length > 0) {
          const bluffSize = sizingOptions.find((s) => s.type === 'BET_75') || sizingOptions[0];
          actions.push({
            action: 'BET',
            amount: Math.min(legalActions.maxBet, Math.max(legalActions.minBet, bluffSize.amount)),
            probability: bluffProb,
          });
          reasonCodes.push('POLARIZED_BET');
        }
      }
    }

    // Fallback if empty
    if (actions.length === 0) {
      if (legalActions.canCheck) actions.push({ action: 'CHECK', probability: 1.0 });
      else if (legalActions.canFold) actions.push({ action: 'FOLD', probability: 1.0 });
    }

    // Normalize base distribution
    const totalProb = actions.reduce((s, a) => s + a.probability, 0);
    if (totalProb > 0) {
      actions.forEach((a) => (a.probability /= totalProb));
    }

    const baseDistribution: ActionDistribution = { actions };

    // 8. Adaptive Exploit Adjustment (if enabled)
    let finalDist = baseDistribution;
    let exploitText = '平衡模式：未啟用自適應剝削';
    if (adaptiveMode) {
      const { ExploitAdjuster } = awaitImportExploitAdjuster();
      const exploitResult = ExploitAdjuster.adjust(baseDistribution, { street, potOdds, spr });
      finalDist = exploitResult.finalDist;
      exploitText = exploitResult.adjustmentText;
      reasonCodes.push(...exploitResult.exploitReasonCodes);
    }

    // 9. Roll with Seeded RNG
    const roll = rng();
    let accum = 0;
    let chosen = finalDist.actions[finalDist.actions.length - 1];

    for (const a of finalDist.actions) {
      accum += a.probability;
      if (roll <= accum) {
        chosen = a;
        break;
      }
    }

    const ownCardsStr = holeCards.map((c) => `${c.rank}${c.suit}`).join(' ');
    const boardStr = communityCards.map((c) => `${c.rank}${c.suit}`).join(' ');

    const trace: EliteDecisionTrace = {
      position,
      ownHand: ownCardsStr,
      board: boardStr,
      pot: potSize,
      spr,
      potOdds,
      estimatedHeroRange: '動態對手估計範圍 (' + oppRange.combos.length + ' 組合)',
      ownRangePosition: `勝率 ${(equity * 100).toFixed(1)}%`,
      absoluteEquity: equity,
      rangeEquity: rangeAdv.ownRangeEquity,
      rangeAdvantage: rangeAdv.advantage,
      nutAdvantage: nutAdv.nutAdvantage,
      boardTexture: texture.description,
      blockerScore: blockerInfo.blockerScore,
      bluffCandidateScore: blockerInfo.bluffCandidateScore,
      availableActions: finalDist.actions.map((a) => `${a.action}${(a.probability * 100).toFixed(0)}%`),
      baseDistribution,
      exploitAdjustmentText: exploitText,
      finalStrategy: finalDist,
      randomRoll: roll,
      selectedAction: chosen.action + (chosen.amount ? ` (${chosen.amount})` : ''),
      reasonCodes,
    };

    const decision: BotDecision = {
      action: chosen.action,
      amount: chosen.amount,
      reasoning: `[Elite V1 翻後] ${chosen.action} | 勝率 ${(equity * 100).toFixed(1)}% | 範圍優勢: ${rangeAdv.advantage} | 阻擋評分: ${blockerInfo.blockerScore.toFixed(2)}`,
      debugScores: {
        foldScore: finalDist.actions.find((a) => a.action === 'FOLD')?.probability ?? 0,
        callScore: finalDist.actions.find((a) => a.action === 'CALL' || a.action === 'CHECK')?.probability ?? 0,
        raiseScore: finalDist.actions.find((a) => a.action === 'BET' || a.action === 'RAISE')?.probability ?? 0,
        randomRoll: roll,
      },
    };

    return { decision, trace };
  }
}

// Synchronous helper
import { ExploitAdjuster } from '../adaptive/ExploitAdjuster';
function awaitImportExploitAdjuster() {
  return { ExploitAdjuster };
}
