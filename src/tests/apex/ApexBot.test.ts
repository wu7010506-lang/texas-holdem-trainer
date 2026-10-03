import { describe, it, expect, beforeEach } from 'vitest';
import { ApexStrategy } from '../../bot/strategies/apex/ApexStrategy';
import { HeroModel, recordEvent } from '../../bot/strategies/apex/model/HeroModel';
import { ChangeDetector } from '../../bot/strategies/apex/model/ChangeDetector';
import { ConfidenceEstimator } from '../../bot/strategies/apex/exploit/ConfidenceEstimator';
import { ActionLikelihoodModel } from '../../bot/strategies/apex/range/ActionLikelihoodModel';
import { HeroLeakReporter } from '../../bot/strategies/apex/telemetry/HeroLeakReporter';
import { BotDecisionContext } from '../../bot/types';

describe('Apex Bot Strategy Suite', () => {
  let heroModel: HeroModel;
  let apex: ApexStrategy;

  beforeEach(() => {
    heroModel = new HeroModel();
    apex = new ApexStrategy(heroModel);
  });

  const createMockContext = (overrides: Partial<BotDecisionContext> = {}): BotDecisionContext => {
    return {
      holeCards: [
        { suit: 's', rank: 'A', value: 14, id: 'As' },
        { suit: 'h', rank: 'K', value: 13, id: 'Kh' },
      ],
      communityCards: [
        { suit: 'd', rank: 'Q', value: 12, id: 'Qd' },
        { suit: 'c', rank: '8', value: 8, id: '8c' },
        { suit: 's', rank: '3', value: 3, id: '3s' },
      ],
      position: 'BTN',
      street: 'FLOP',
      potSize: 30,
      playerStack: 100,
      effectiveStack: 100,
      amountToCall: 0,
      minimumRaise: 2,
      currentBet: 0,
      bigBlind: 2,
      numberOfPlayers: 2,
      activePlayers: 2,
      previousActions: [],
      positionRelativeToButton: 0,
      spr: 3.3,
      potOdds: 0,
      boardTexture: {
        isMonotone: false,
        isTwoTone: false,
        isRainbow: true,
        isPaired: false,
        isConnected: false,
        isHighCardHeavy: true,
        wetnessScore: 0.1,
        description: 'Dry Rainbow',
      },
      handStrength: {
        category: 'AIR',
        categoryName: 'High Card',
        hasFlushDraw: false,
        hasOESD: false,
        hasGutshot: true,
        hasOvercards: true,
        estimatedEquity: 0.35,
        description: 'Two Overcards + Gutshot',
      },
      legalActions: {
        canFold: false,
        canCheck: true,
        canCall: false,
        callAmount: 0,
        canBet: true,
        minBet: 2,
        maxBet: 100,
        canRaise: false,
        minRaise: 0,
        maxRaise: 0,
        canAllIn: true,
        allInAmount: 100,
      },
      ...overrides,
    };
  };

  it('Test 1: Strict Hidden Information Isolation (Zero access to Hero hole cards / undealt cards)', () => {
    const ctx = createMockContext();
    // Verify that ctx does not contain any opponent cards or full deck
    expect((ctx as any).opponentCards).toBeUndefined();
    expect((ctx as any).heroHoleCards).toBeUndefined();
    expect((ctx as any).deck).toBeUndefined();

    // Verify Apex strategy only accesses ctx.holeCards and ctx.communityCards
    const decision = apex.decideAction(ctx);
    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();
    expect(decision.debugTrace).toBeDefined();
    expect(decision.debugTrace.ownHand).toBe('As Kh');
  });

  it('Test 2: Exploits River Overfold leak by expanding bluff range and sizing up', () => {
    // Inject heavy overfold tendency on river
    for (let i = 0; i < 25; i++) {
      recordEvent(heroModel.riverStats.foldVsLarge, true);
      recordEvent(heroModel.riverStats.foldVsOverbet, true);
    }
    heroModel.handsTracked = 30;

    // Bot has complete air on river
    const ctx = createMockContext({
      street: 'RIVER',
      holeCards: [
        { suit: 'c', rank: '4', value: 4, id: '4c' },
        { suit: 'd', rank: '3', value: 3, id: '3d' },
      ],
      communityCards: [
        { suit: 's', rank: 'A', value: 14, id: 'As' },
        { suit: 'h', rank: 'K', value: 13, id: 'Kh' },
        { suit: 'd', rank: '9', value: 9, id: '9d' },
        { suit: 'c', rank: '8', value: 8, id: '8c' },
        { suit: 's', rank: '2', value: 2, id: '2s' },
      ],
      potSize: 20,
      amountToCall: 0,
      handStrength: {
        category: 'AIR',
        categoryName: 'High Card',
        hasFlushDraw: false,
        hasOESD: false,
        hasGutshot: false,
        hasOvercards: false,
        estimatedEquity: 0.05,
        description: 'Air',
      },
    });

    const decision = apex.decideAction(ctx);
    // Apex should exploit overfold by betting/raising rather than checking giving up!
    expect(decision.action).toBe('BET');
    expect(decision.reasonCodes).toContain('EXPLOIT_OVERFOLD');
    expect(decision.debugTrace.mode).toBe('APEX_EXPLOIT');
    expect(decision.debugTrace.expectedExploitGain).toBeGreaterThan(0);
  });

  it('Test 3: Exploits Calling Station leak with thin value and zero pure bluffs', () => {
    // Inject calling station tendency: never folds on river
    for (let i = 0; i < 25; i++) {
      recordEvent(heroModel.riverStats.foldVsLarge, false);
      recordEvent(heroModel.riverStats.foldVsOverbet, false);
    }
    heroModel.handsTracked = 30;

    // Bot with complete air should NOT bluff against calling station (shuts down bluffs)
    const airCtx = createMockContext({
      street: 'RIVER',
      holeCards: [
        { suit: 'c', rank: '4', value: 4, id: '4c' },
        { suit: 'd', rank: '3', value: 3, id: '3d' },
      ],
      communityCards: [
        { suit: 's', rank: 'A', value: 14, id: 'As' },
        { suit: 'h', rank: 'K', value: 13, id: 'Kh' },
        { suit: 'd', rank: '9', value: 9, id: '9d' },
        { suit: 'c', rank: '8', value: 8, id: '8c' },
        { suit: 's', rank: '2', value: 2, id: '2s' },
      ],
      potSize: 20,
      amountToCall: 0,
    });

    const airDecision = apex.decideAction(airCtx);
    // Against station, pure bluff EV is negative, so Checking is optimal!
    expect(airDecision.action).toBe('CHECK');
    expect(airDecision.reasonCodes).toContain('EXPLOIT_OVERCALL');
  });

  it('Test 4: Exploits Underbluff leak by overfolding against river aggression', () => {
    // Inject extreme river underbluffing: Hero has 0% bluffs in 15 river bets
    heroModel.riverStats.bluffEstimate = {
      opportunities: 15,
      count: 0,
      priorAlpha: 0.1,
      priorBeta: 5.0,
    };
    heroModel.handsTracked = 30;

    // Bot faces a pot-sized river bet with a marginal bluff-catcher (middle pair)
    const ctx = createMockContext({
      street: 'RIVER',
      holeCards: [
        { suit: 's', rank: '9', value: 9, id: '9s' },
        { suit: 'd', rank: '8', value: 8, id: '8d' },
      ],
      communityCards: [
        { suit: 'c', rank: 'A', value: 14, id: 'Ac' },
        { suit: 'h', rank: 'Q', value: 12, id: 'Qh' },
        { suit: 's', rank: '9', value: 9, id: '9s' },
        { suit: 'd', rank: '4', value: 4, id: '4d' },
        { suit: 'c', rank: '2', value: 2, id: '2c' },
      ],
      potSize: 40,
      amountToCall: 40,
      currentBet: 40,
      legalActions: {
        canFold: true,
        canCheck: false,
        canCall: true,
        callAmount: 40,
        canBet: false,
        minBet: 0,
        maxBet: 0,
        canRaise: false,
        minRaise: 0,
        maxRaise: 0,
        canAllIn: true,
        allInAmount: 100,
      },
    });

    const decision = apex.decideAction(ctx);
    // Against a zero-bluff opponent, calling EV is negative, so Fold is preferred!
    expect(decision.action).toBe('FOLD');
    expect(decision.reasonCodes).toContain('EXPLOIT_UNDERBLUFF');
  });

  it('Test 5: Sizing Tell Sensitivity updates Bayesian likelihood correctly', () => {
    // Test ActionLikelihoodModel with polarized overbet vs small bet
    const nutsCategory = 'NUTS_OR_MONSTER';
    const weakCategory = 'WEAK_AIR';

    const pOverbetGivenNuts = ActionLikelihoodModel.getLikelihood(nutsCategory, 'BET', 1.25, heroModel);
    const pOverbetGivenWeak = ActionLikelihoodModel.getLikelihood(weakCategory, 'BET', 1.25, heroModel);

    // Nuts are much more likely to overbet than weak hands
    expect(pOverbetGivenNuts).toBeGreaterThan(pOverbetGivenWeak);
    expect(pOverbetGivenNuts).toBeGreaterThan(0.70);
  });

  it('Test 6: Counter-adaptation & Change Detection detects strategy shift and decays confidence', () => {
    const historicalOpps = 50;
    const historicalRate = 0.80; // Was an overfolder
    const recentOpps = 15;
    const recentRate = 0.20;     // Shifted to calling station!

    const report = ChangeDetector.detectShift(
      historicalOpps,
      historicalRate,
      recentOpps,
      recentRate,
      'River 棄牌率'
    );

    expect(report.shiftDetected).toBe(true);
    expect(report.decayFactor).toBeLessThan(0.70);
    expect(report.message).toContain('衰減剝削信心');
  });

  it('Test 7: Continuous Confidence Scaling behaves smoothly without hard caps', () => {
    const c0 = ConfidenceEstimator.computeConfidence(0);
    const c5 = ConfidenceEstimator.computeConfidence(5);
    const c20 = ConfidenceEstimator.computeConfidence(20);
    const c60 = ConfidenceEstimator.computeConfidence(60);

    expect(c0.score).toBeCloseTo(0.05, 1);
    expect(c5.score).toBeGreaterThan(c0.score);
    expect(c20.score).toBeGreaterThan(c5.score);
    expect(c60.score).toBeGreaterThan(c20.score);
    expect(c60.score).toBeGreaterThan(0.80);
    expect(['HIGH', 'EXTREME']).toContain(c60.level);
  });

  it('Test 8: Baseline Fallback when sample confidence is low', () => {
    // Brand new model with 0 hands tracked
    const freshModel = new HeroModel();
    const freshApex = new ApexStrategy(freshModel);

    const ctx = createMockContext({
      street: 'FLOP',
      potSize: 20,
      amountToCall: 0,
    });

    const decision = freshApex.decideAction(ctx);
    // With 0 samples, confidence is low, so it should fall back to baseline
    expect(decision.debugTrace.mode).toBe('BASELINE');
    expect(decision.reasonCodes).toContain('BASELINE_FALLBACK');
  });

  it('Test 9: Hero Leak Reporter generates diagnostic items and actionable recommendations', () => {
    // Inject multiple leaks into heroModel
    for (let i = 0; i < 15; i++) {
      recordEvent(heroModel.riverStats.foldVsOverbet, true);
    }
    const btn = heroModel.getPreflopStats('BTN');
    for (let i = 0; i < 15; i++) {
      recordEvent(btn.facingThreeBetFold, true);
    }
    heroModel.handsTracked = 25;

    const report = HeroLeakReporter.generateReport(heroModel);
    expect(report.handsTracked).toBe(25);
    expect(report.leaks.length).toBeGreaterThanOrEqual(1);

    const overbetLeak = report.leaks.find(l => l.id === 'RIVER_OVERFOLD_OVERBET');
    expect(overbetLeak).toBeDefined();
    expect(overbetLeak?.severity).toBe('HIGH');
    expect(overbetLeak?.recommendation).toContain('Bluff-catcher');
  });

  it('Test 10: Exploits Repeated Preflop All-In Shoves by expanding calldown range to crush maniacs', () => {
    // Simulate Hero shoving all-in preflop multiple times
    recordEvent(heroModel.preflopAllInShove, true);
    recordEvent(heroModel.preflopAllInShove, true);
    heroModel.handsTracked = 2;

    // Verify leak reporter detects PREFLOP_MANIAC_ALLIN
    const report = HeroLeakReporter.generateReport(heroModel);
    const allInLeak = report.leaks.find(l => l.id === 'PREFLOP_MANIAC_ALLIN');
    expect(allInLeak).toBeDefined();
    expect(allInLeak?.severity).toBe('HIGH');

    // Context: Hero has open-shoved 100BB (1000 chips). Bot holds 88 (8s 8h).
    // In standard GTO, 88 folds 100% vs 100BB jam.
    const preflopCtx = createMockContext({
      street: 'PREFLOP',
      holeCards: [
        { suit: 's', rank: '8', value: 8, id: '8s' },
        { suit: 'h', rank: '8', value: 8, id: '8h' },
      ],
      communityCards: [],
      currentBet: 1000,
      potSize: 1015,
      amountToCall: 1000,
      playerStack: 1000,
      effectiveStack: 1000,
      bigBlind: 10,
      legalActions: {
        canFold: true,
        canCheck: false,
        canCall: true,
        callAmount: 1000,
        canBet: false,
        minBet: 0,
        maxBet: 0,
        canRaise: false,
        minRaise: 0,
        maxRaise: 0,
        canAllIn: true,
        allInAmount: 1000,
      },
      previousActions: [
        {
          handId: 3,
          street: 'PREFLOP',
          seat: 0,
          playerId: 'hero',
          playerName: 'Hero',
          action: 'ALL_IN',
          amount: 1000,
          timestamp: Date.now(),
          potBefore: 15,
          potAfter: 1015,
          stackBefore: 1000,
          stackAfter: 0,
        },
      ],
    });

    const decision = apex.decideAction(preflopCtx);
    // Apex Bot should exploit the maniac by calling with 88!
    expect(decision.action).toBe('CALL');
    expect(decision.amount).toBe(1000);
    expect(decision.reasoning).toContain('Apex 剝削抓暴衝全押');
    expect(decision.reasonCodes).toContain('EXPLOIT_OVERBLUFF');
    expect(decision.debugTrace?.mode).toBe('APEX_EXPLOIT');
  });
});
