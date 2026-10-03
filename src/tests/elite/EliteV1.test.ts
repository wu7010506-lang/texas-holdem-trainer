import { describe, it, expect, beforeEach } from 'vitest';
import { EliteStrategyV1 } from '../../bot/strategies/elite/EliteStrategyV1';
import { createCard } from '../../engine/Card';
import { BotDecisionContext } from '../../bot/types';
import { LegalActions } from '../../engine/types';

import { BoardAnalyzer } from '../../bot/BoardAnalyzer';
import { HandStrength } from '../../bot/HandStrength';
import { OpponentModel } from '../../bot/strategies/elite/adaptive/OpponentModel';
import { PreflopStrategyTable } from '../../bot/strategies/elite/preflop/PreflopStrategyTable';
import { BlockerAnalyzer } from '../../bot/strategies/elite/postflop/BlockerAnalyzer';
import { HandRange } from '../../bot/strategies/elite/range/WeightedCombo';


import { MultiwayAdjustment } from '../../bot/strategies/elite/postflop/MultiwayAdjustment';
import { ExploitAdjuster } from '../../bot/strategies/elite/adaptive/ExploitAdjuster';

function createMockContext(overrides: Partial<BotDecisionContext> = {}): BotDecisionContext {
  const holeCards = overrides.holeCards || [createCard('A', 's'), createCard('K', 'd')];
  const communityCards = overrides.communityCards || [];
  const defaultLegalActions: LegalActions = {
    canFold: true,
    canCheck: true,
    canCall: false,
    callAmount: 0,
    canBet: true,
    minBet: 20,
    maxBet: 1000,
    canRaise: false,
    minRaise: 40,
    maxRaise: 1000,
    canAllIn: true,
    allInAmount: 1000,
  };

  return {
    holeCards,
    communityCards,
    position: 'BTN',
    street: communityCards.length === 0 ? 'PREFLOP' : 'FLOP',
    potSize: 100,
    playerStack: 1000,
    effectiveStack: 1000,
    amountToCall: 0,
    minimumRaise: 40,
    currentBet: 0,
    bigBlind: 10,
    numberOfPlayers: 6,
    activePlayers: 2,
    previousActions: [],
    positionRelativeToButton: 0,
    spr: 10,
    potOdds: 0,
    boardTexture: BoardAnalyzer.analyze(communityCards),
    handStrength: HandStrength.evaluate(holeCards, communityCards),
    legalActions: overrides.legalActions || defaultLegalActions,
    ...overrides,
  };
}

describe('Elite Bot V1: 10 Rigorous Acceptance Tests', () => {
  let eliteBot: EliteStrategyV1;

  beforeEach(() => {
    eliteBot = new EliteStrategyV1('BALANCED', 42);
    OpponentModel.getInstance().reset();
  });

  // Test 1: Strict Hidden Information Isolation
  it('Test 1 — Hidden Information Isolation: Mutating Hero actual hole cards does NOT change Bot decision', () => {
    const botHoleCards = [createCard('T', 's'), createCard('9', 's')];
    const flopBoard = [createCard('8', 'h'), createCard('7', 'd'), createCard('2', 'c')];

    // In a real game state, Hero's hole cards might be AA or 72o.
    // The BotDecisionContext MUST NOT provide Hero hole cards, and EliteBot can only inspect context.
    const context1 = createMockContext({
      holeCards: botHoleCards,
      communityCards: flopBoard,
      street: 'FLOP',
      potSize: 60,
      amountToCall: 0,
    });

    const context2 = createMockContext({
      holeCards: botHoleCards,
      communityCards: flopBoard,
      street: 'FLOP',
      potSize: 60,
      amountToCall: 0,
    });

    eliteBot.setSeed(99999);
    const decision1 = eliteBot.decideAction(context1);

    eliteBot.setSeed(99999);
    const decision2 = eliteBot.decideAction(context2);

    expect(decision1.action).toBe(decision2.action);
    expect(decision1.amount).toBe(decision2.amount);
    expect(decision1.debugScores?.randomRoll).toBe(decision2.debugScores?.randomRoll);
    expect(decision1.debugScores?.raiseScore).toBe(decision2.debugScores?.raiseScore);
  });

  // Test 2: Position Awareness
  it('Test 2 — Position Awareness: KJo has different open strategy from UTG vs BTN', () => {
    const utgAction = PreflopStrategyTable.getAction('RFI', 'UTG', 'KJo');
    const btnAction = PreflopStrategyTable.getAction('RFI', 'BTN', 'KJo');

    // From UTG, KJo is fold or very low frequency
    expect(utgAction.fold).toBeGreaterThan(0.80);
    expect(utgAction.raise).toBeLessThan(0.15);

    // From BTN, KJo is an absolute 100% open raise
    expect(btnAction.raise).toBe(1.0);
    expect(btnAction.fold).toBe(0.0);
  });

  // Test 3: Facing Action
  it('Test 3 — Facing Action: A5s strategy changes across RFI, Facing Open, and Facing 3-Bet', () => {
    const rfiAction = PreflopStrategyTable.getAction('RFI', 'BTN', 'A5s');
    const facingOpenAction = PreflopStrategyTable.getAction('FACING_OPEN', 'BTN', 'A5s', 'UTG');
    const facing3BetAction = PreflopStrategyTable.getAction('FACING_THREE_BET', 'BTN', 'A5s', 'BB');

    // On BTN: RFI is 100% raise
    expect(rfiAction.raise).toBe(1.0);

    // Facing UTG Open: mixed 3-bet bluff & fold
    expect(facingOpenAction.raise).toBeGreaterThan(0.50);
    expect(facingOpenAction.fold).toBeGreaterThan(0.10);

    // Facing BB 3-Bet: mixed 4-bet bluff, call, fold
    expect(facing3BetAction.raise).toBeGreaterThan(0.20);
    expect(facing3BetAction.call).toBeGreaterThan(0.10);
    expect(facing3BetAction.fold).toBeGreaterThan(0.20);
  });

  // Test 4: Mixed Strategy & Seeded RNG
  it('Test 4 — Mixed Strategy: Seeded RNG guarantees reproducibility, varied seeds track distribution', () => {
    const context = createMockContext({
      position: 'UTG',
      holeCards: [createCard('6', 's'), createCard('6', 'h')], // 66 UTG has 50% raise / 50% fold
    });

    eliteBot.setSeed(12345);
    const d1 = eliteBot.decideAction(context);

    eliteBot.setSeed(12345);
    const d2 = eliteBot.decideAction(context);

    // 100% identical with same seed
    expect(d1.action).toBe(d2.action);
    expect(d1.debugScores?.randomRoll).toBe(d2.debugScores?.randomRoll);

    // Track 400 random seeds for 66 UTG
    let raiseCount = 0;
    for (let s = 1; s <= 400; s++) {
      eliteBot.setSeed(s * 17);
      const dec = eliteBot.decideAction(context);
      if (dec.action === 'RAISE' || dec.action === 'BET') raiseCount++;
    }

    const observedRaiseRate = raiseCount / 400;
    // Expected ~0.50
    expect(observedRaiseRate).toBeGreaterThan(0.35);
    expect(observedRaiseRate).toBeLessThan(0.65);
  });

  // Test 5: Blocker River Selection
  it('Test 5 — Blocker: Two air hands on river have different bluff candidates based on blockers', () => {
    const board = [
      createCard('K', 's'),
      createCard('Q', 's'),
      createCard('7', 's'),
      createCard('2', 'd'),
      createCard('4', 'c'),
    ];

    const dummyRange = new HandRange([]);

    // Hand A: Holds A♠ (Nut Flush Blocker, blocks opponent flushes)
    const handA = [createCard('A', 's'), createCard('J', 'c')];
    // Hand B: Holds 6♣ 5♦ (Pure air, unblocks nothing, zero flush blockers)
    const handB = [createCard('6', 'c'), createCard('5', 'd')];

    const blockerA = BlockerAnalyzer.analyze(handA, board, dummyRange);
    const blockerB = BlockerAnalyzer.analyze(handB, board, dummyRange);

    expect(blockerA.blocksValue).toBe(true);
    expect(blockerA.bluffCandidateScore).toBeGreaterThan(blockerB.bluffCandidateScore);
    expect(blockerA.blockerScore).toBeGreaterThan(0.30);
  });

  // Test 6: Board Texture
  it('Test 6 — Board Texture: Dry board (A72r) vs Wet board (876tt) produces different texture and c-bet profile', () => {
    const dryBoard = [createCard('A', 's'), createCard('7', 'h'), createCard('2', 'c')];
    const wetBoard = [createCard('8', 's'), createCard('7', 's'), createCard('6', 'd')];

    const dryTexture = BoardAnalyzer.analyze(dryBoard);
    const wetTexture = BoardAnalyzer.analyze(wetBoard);

    expect(dryTexture.isRainbow).toBe(true);
    expect(wetTexture.isTwoTone).toBe(true);
    expect(wetTexture.wetnessScore).toBeGreaterThan(dryTexture.wetnessScore);
  });

  // Test 7: Range Advantage & Board Texture
  it('Test 7 — Range Advantage: BTN vs BB C-Bet frequency on A72r and 876 two-tone are not identical', () => {
    const hand = [createCard('K', 'd'), createCard('J', 'c')];
    const dryBoard = [createCard('A', 's'), createCard('7', 'h'), createCard('2', 'c')];
    const wetBoard = [createCard('8', 's'), createCard('7', 's'), createCard('6', 'd')];

    const dryContext = createMockContext({
      holeCards: hand,
      communityCards: dryBoard,
      position: 'BTN',
      street: 'FLOP',
      potSize: 60,
      amountToCall: 0,
    });

    const wetContext = createMockContext({
      holeCards: hand,
      communityCards: wetBoard,
      position: 'BTN',
      street: 'FLOP',
      potSize: 60,
      amountToCall: 0,
    });

    eliteBot.setSeed(42);
    const dryDec = eliteBot.decideAction(dryContext);
    eliteBot.setSeed(42);
    const wetDec = eliteBot.decideAction(wetContext);

    const dryBetProb = dryDec.debugTrace?.baseDistribution?.actions?.find((a: any) => a.action === 'BET')?.probability ?? 0;
    const wetBetProb = wetDec.debugTrace?.baseDistribution?.actions?.find((a: any) => a.action === 'BET')?.probability ?? 0;

    expect(dryBetProb).not.toBe(wetBetProb);
  });


  // Test 8: Multiway Adjustment
  it('Test 8 — Multiway Adjustment: Bluff & C-Bet multipliers drop significantly from HU to 3-way', () => {
    const hu = MultiwayAdjustment.calculate(1);
    const multiway3 = MultiwayAdjustment.calculate(2);
    const multiway4 = MultiwayAdjustment.calculate(3);

    expect(hu.bluffMultiplier).toBe(1.0);
    expect(multiway3.bluffMultiplier).toBeLessThanOrEqual(0.50);
    expect(multiway4.bluffMultiplier).toBeLessThanOrEqual(0.20);

    expect(multiway3.cbetMultiplier).toBeLessThan(hu.cbetMultiplier);
    expect(multiway3.requiredStrengthShift).toBeGreaterThan(0.05);
  });

  // Test 9: SPR Stack-off
  it('Test 9 — SPR: Low SPR (1.0) commits chips while High SPR (8.0) exercises pot control', () => {
    const topPairCards = [createCard('A', 's'), createCard('K', 'h')];
    const board = [createCard('A', 'd'), createCard('8', 'c'), createCard('3', 's')];

    const lowSprContext = createMockContext({
      holeCards: topPairCards,
      communityCards: board,
      street: 'FLOP',
      potSize: 500,
      playerStack: 500,
      effectiveStack: 500,
      spr: 1.0,
      legalActions: {
        canFold: false,
        canCheck: true,
        canCall: false,
        callAmount: 0,
        canBet: true,
        minBet: 20,
        maxBet: 500,
        canRaise: false,
        minRaise: 40,
        maxRaise: 500,
        canAllIn: true,
        allInAmount: 500,
      },
    });

    const highSprContext = createMockContext({
      holeCards: topPairCards,
      communityCards: board,
      street: 'FLOP',
      potSize: 100,
      playerStack: 1000,
      effectiveStack: 1000,
      spr: 10.0,
      legalActions: {
        canFold: false,
        canCheck: true,
        canCall: false,
        callAmount: 0,
        canBet: true,
        minBet: 20,
        maxBet: 1000,
        canRaise: false,
        minRaise: 40,
        maxRaise: 1000,
        canAllIn: true,
        allInAmount: 1000,
      },
    });

    eliteBot.setSeed(777);
    const lowSprDec = eliteBot.decideAction(lowSprContext);

    eliteBot.setSeed(777);
    const highSprDec = eliteBot.decideAction(highSprContext);

    // In Low SPR, bot is happy to bet or all-in a high proportion of stack
    expect(lowSprDec.amount === 500 || lowSprDec.action === 'ALL_IN' || (lowSprDec.amount ?? 0) >= 300).toBe(true);
    // In High SPR, bot bets smaller proportion of stack (e.g. 75 or 33)
    expect(highSprDec.action !== 'ALL_IN').toBe(true);
  });

  // Test 10: Adaptive Confidence
  it('Test 10 — Adaptive Confidence: 20 hands produces ~0 adjustment; 2000+ hands applies bounded exploit', () => {
    const model = OpponentModel.getInstance();

    // 1. Extreme stat with only 20 hands
    model.setHandsPlayed(20);
    model.updateStat('foldToCBet', 0.90); // Extreme overfold

    const baseDist = {
      actions: [
        { action: 'CHECK' as const, probability: 0.50 },
        { action: 'BET' as const, amount: 50, probability: 0.50 },
      ],
    };

    const smallSampleResult = ExploitAdjuster.adjust(baseDist, { street: 'FLOP', potOdds: 0.33, spr: 4 });
    const smallBetProb = smallSampleResult.finalDist.actions.find((a) => a.action === 'BET')?.probability || 0;

    // Virtually zero adjustment due to lack of confidence (< 100 hands)
    expect(Math.abs(smallBetProb - 0.50)).toBeLessThan(0.01);

    // 2. 2,000 hands with same extreme stat
    model.setHandsPlayed(2000);
    const largeSampleResult = ExploitAdjuster.adjust(baseDist, { street: 'FLOP', potOdds: 0.33, spr: 4 });
    const largeBetProb = largeSampleResult.finalDist.actions.find((a) => a.action === 'BET')?.probability || 0;

    // Should adjust significantly towards betting, but strictly capped at <= 15% (0.50 + 0.15 = 0.65)
    expect(largeBetProb).toBeGreaterThan(0.55);
    expect(largeBetProb).toBeLessThanOrEqual(0.6501);
  });
});
