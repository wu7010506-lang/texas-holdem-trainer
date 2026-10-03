import { ApexCandidateEV } from '../types';
import { HeroModel } from '../model/HeroModel';
import { HeroResponsePredictor } from '../model/HeroResponsePredictor';
import { HeroRangeTracker } from '../range/HeroRangeTracker';
import { ActionEVEstimator } from './ActionEVEstimator';
import { Card, Street } from '../../../../engine/types';

export interface SizingSearchResult {
  candidates: ApexCandidateEV[];
  bestBetCandidate: ApexCandidateEV;
}

export class DynamicSizingSearch {
  /**
   * Evaluates discrete bet sizings and returns candidate EVs
   */
  public static search(
    pot: number,
    toCall: number,
    playerStack: number,
    street: Street,
    botHoleCards: [Card, Card],
    board: Card[],
    heroRangeTracker: HeroRangeTracker,
    heroModel: HeroModel,
    boardTextureKey = 'DRY',
    activeOpponents = 1,
    minBet = 10,
    spr = 5.0
  ): SizingSearchResult {
    const candidates: ApexCandidateEV[] = [];

    // Define candidate fractions based on texture and SPR:
    // Standard: 33%, 75%, 125%
    // If SPR <= 2.2, add 50% commitment sizing
    const sizingConfigs = [
      { fraction: 0.33, label: 'Bet 33%' },
      { fraction: 0.75, label: 'Bet 75%' },
      { fraction: 1.25, label: 'Bet 125%' },
    ];

    if (spr <= 2.2 && spr > 0.8) {
      sizingConfigs.push({ fraction: 0.50, label: 'Commit 50%' });
    }

    const equityVsGeneral = heroRangeTracker.evaluateEquityVsRange(botHoleCards, board);

    for (const config of sizingConfigs) {
      const betAmount = Math.max(minBet, Math.round(pot * config.fraction));
      if (betAmount >= playerStack) continue; // Will be covered by All-In

      const response = HeroResponsePredictor.predictResponse(
        heroModel,
        street,
        config.fraction,
        boardTextureKey
      );

      // Evaluate equity when called specifically against Hero's calling subrange
      const callingSubrange = heroRangeTracker.getCallingSubrange(board, config.fraction);
      const trackerForCalling = new HeroRangeTracker('BTN', [], [], heroModel);
      (trackerForCalling as any).range = callingSubrange;
      const equityWhenCalled = trackerForCalling.evaluateEquityVsRange(botHoleCards, board);

      const candidate = ActionEVEstimator.computeBetEV(
        {
          pot,
          toCall,
          playerStack,
          street,
          equityVsGeneralRange: equityVsGeneral,
          equityWhenCalled,
          predictedFoldRate: response.foldRate,
          predictedCallRate: response.callRate,
          predictedRaiseRate: response.raiseRate,
          activeOpponents,
        },
        betAmount,
        config.label
      );

      candidates.push(candidate);
    }

    // Always evaluate All-In candidate
    if (playerStack > 0) {
      const allInFraction = pot > 0 ? playerStack / pot : 1.5;
      const allInResponse = HeroResponsePredictor.predictResponse(
        heroModel,
        street,
        allInFraction,
        boardTextureKey
      );
      const callingSubrange = heroRangeTracker.getCallingSubrange(board, allInFraction);
      const trackerForCalling = new HeroRangeTracker('BTN', [], [], heroModel);
      (trackerForCalling as any).range = callingSubrange;
      const equityWhenCalled = trackerForCalling.evaluateEquityVsRange(botHoleCards, board);

      const allInCandidate = ActionEVEstimator.computeBetEV(
        {
          pot,
          toCall,
          playerStack,
          street,
          equityVsGeneralRange: equityVsGeneral,
          equityWhenCalled,
          predictedFoldRate: allInResponse.foldRate,
          predictedCallRate: allInResponse.callRate,
          predictedRaiseRate: 0, // Cannot be raised if all-in
          activeOpponents,
        },
        playerStack,
        'All-in',
        true
      );
      candidates.push(allInCandidate);
    }

    // Sort to find the best bet candidate by EV
    const sorted = [...candidates].sort((a, b) => b.ev - a.ev);
    const bestBetCandidate = sorted[0] || candidates[0];

    return { candidates, bestBetCandidate };
  }
}
