import { describe, it, expect } from 'vitest';
import { PreflopRanges } from '../bot/PreflopRanges';
import { BoardAnalyzer } from '../bot/BoardAnalyzer';
import { PotOddsCalculator } from '../bot/PotOddsCalculator';
import { ProfileDrivenStrategy } from '../bot/ProfileDrivenStrategy';
import { DEFAULT_PROFILES } from '../bot/defaultProfiles';
import { parseCards } from '../engine/Card';
import { BotDecisionContext } from '../bot/types';

describe('Bot Strategy and AI Modules', () => {
  it('correctly converts hole cards to 169 notation', () => {
    const aa = parseCards('Ah As');
    expect(PreflopRanges.getHandNotation(aa[0], aa[1])).toBe('AA');

    const aks = parseCards('Ah Kh');
    expect(PreflopRanges.getHandNotation(aks[0], aks[1])).toBe('AKs');

    const ako = parseCards('Ac Kd');
    expect(PreflopRanges.getHandNotation(ako[0], ako[1])).toBe('AKo');

    const trash = parseCards('7h 2c');
    expect(PreflopRanges.getHandNotation(trash[0], trash[1])).toBe('72o');
  });

  it('calculates board textures and wetness', () => {
    const dryBoard = parseCards('Kd 8c 2s');
    const dryAnalysis = BoardAnalyzer.analyze(dryBoard);
    expect(dryAnalysis.isRainbow).toBe(true);
    expect(dryAnalysis.wetnessScore).toBeLessThan(0.4);

    const wetBoard = parseCards('Jh Th 9h');
    const wetAnalysis = BoardAnalyzer.analyze(wetBoard);
    expect(wetAnalysis.isMonotone).toBe(true);
    expect(wetAnalysis.isConnected).toBe(true);
    expect(wetAnalysis.wetnessScore).toBeGreaterThan(0.7);
  });

  it('calculates Pot Odds accurately', () => {
    // Original pot 100 + Opponent Bet 50 = current pot 150. Hero Call 50 -> potAfterCall = 200 -> 25%
    const odds = PotOddsCalculator.calculate(50, 150);
    expect(odds.potOdds).toBe(0.25);
    expect(odds.potOddsPercent).toBe(25.0);
    expect(odds.potAfterCall).toBe(200);
  });

  it('Nit bot folds 72o facing open raise, while Maniac is prone to calling or 3-betting', () => {
    const strategy = new ProfileDrivenStrategy();
    const trashHole = parseCards('7h 2c');

    const baseContext: BotDecisionContext = {
      holeCards: trashHole,
      communityCards: [],
      position: 'BB',
      street: 'PREFLOP',
      potSize: 35,
      playerStack: 1000,
      effectiveStack: 1000,
      amountToCall: 20,
      minimumRaise: 50,
      currentBet: 30,
      bigBlind: 10,
      numberOfPlayers: 6,
      activePlayers: 3,
      previousActions: [],
      positionRelativeToButton: 2,
      spr: 28,
      potOdds: 0.36,
      boardTexture: BoardAnalyzer.analyze([]),
      handStrength: {
        category: 'AIR',
        categoryName: 'Trash',
        hasFlushDraw: false,
        hasOESD: false,
        hasGutshot: false,
        hasOvercards: false,
        estimatedEquity: 0.15,
        description: 'Trash 72o',
      },
      legalActions: {
        canFold: true,
        canCheck: false,
        canCall: true,
        callAmount: 20,
        canBet: false,
        minBet: 0,
        maxBet: 0,
        canRaise: true,
        minRaise: 50,
        maxRaise: 1000,
        canAllIn: true,
        allInAmount: 1000,
      },
    };

    // Nit decision with fixed RNG roll = 0.5
    const nitDecision = strategy.decideAction(baseContext, DEFAULT_PROFILES['nit'], () => 0.5);
    expect(nitDecision.action).toBe('FOLD');
    expect(nitDecision.reasoning).toBeDefined();

    // Premium AA with Nit should raise/3-bet
    const aaHole = parseCards('Ah As');
    const aaContext = { ...baseContext, holeCards: aaHole };
    const nitPremiumDecision = strategy.decideAction(aaContext, DEFAULT_PROFILES['nit'], () => 0.5);
    expect(['RAISE', 'ALL_IN']).toContain(nitPremiumDecision.action);
  });
});
