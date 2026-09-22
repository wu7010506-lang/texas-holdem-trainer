import { describe, it, expect } from 'vitest';
import { PotManager } from '../engine/PotManager';
import { HandEvaluation, HandRank, PlayerState } from '../engine/types';

describe('PotManager', () => {
  const createMockPlayer = (
    id: string,
    seat: number,
    totalBet: number,
    allIn: boolean,
    folded: boolean
  ): PlayerState => ({
    id,
    name: id,
    seat,
    isHuman: false,
    stack: 0,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: totalBet,
    folded,
    allIn,
    acted: true,
    position: 'BTN',
  });

  it('correctly calculates Main Pot and multiple Side Pots for 3 all-in players with different stacks', () => {
    // Player A: 100 all-in
    // Player B: 300 all-in
    // Player C: 500 (called 300 + 200 uncalled or all-in 500)
    const pA = createMockPlayer('A', 0, 100, true, false);
    const pB = createMockPlayer('B', 1, 300, true, false);
    const pC = createMockPlayer('C', 2, 500, true, false);

    const pots = PotManager.calculatePots([pA, pB, pC]);

    // Tier 1 (0 to 100): 100 * 3 = 300 (A, B, C eligible)
    // Tier 2 (100 to 300): 200 * 2 = 400 (B, C eligible)
    // Tier 3 (300 to 500): 200 * 1 = 200 (C eligible)
    expect(pots.length).toBe(3);

    expect(pots[0].amount).toBe(300);
    expect(pots[0].eligiblePlayerIds.sort()).toEqual(['A', 'B', 'C'].sort());

    expect(pots[1].amount).toBe(400);
    expect(pots[1].eligiblePlayerIds.sort()).toEqual(['B', 'C'].sort());

    expect(pots[2].amount).toBe(200);
    expect(pots[2].eligiblePlayerIds).toEqual(['C']);
  });

  it('retains folded player chips in pots while excluding them from eligibility', () => {
    // Player A puts in 100 and folds
    // Player B puts in 200
    // Player C puts in 200
    const pA = createMockPlayer('A', 0, 100, false, true);
    const pB = createMockPlayer('B', 1, 200, false, false);
    const pC = createMockPlayer('C', 2, 200, false, false);

    const pots = PotManager.calculatePots([pA, pB, pC]);

    const totalInPots = pots.reduce((sum, p) => sum + p.amount, 0);
    expect(totalInPots).toBe(500);

    // Eligible players should only be B and C
    pots.forEach((p) => {
      expect(p.eligiblePlayerIds).not.toContain('A');
    });
  });

  it('resolves showdown with short stack winning Main Pot and second stack winning Side Pot', () => {
    // Pot 0 (Main): 300 (A, B, C)
    // Pot 1 (Side): 400 (B, C)
    const pots = [
      { id: 0, amount: 300, eligiblePlayerIds: ['A', 'B', 'C'] },
      { id: 1, amount: 400, eligiblePlayerIds: ['B', 'C'] },
    ];

    const pA = createMockPlayer('A', 0, 100, true, false);
    const pB = createMockPlayer('B', 1, 300, true, false);
    const pC = createMockPlayer('C', 2, 300, true, false);

    // Hand strengths: A has Full House, B has Flush, C has One Pair
    const evals = new Map<string, HandEvaluation>([
      ['A', { handRank: HandRank.FULL_HOUSE, rankName: 'Full House', score: [6, 10, 7], best5: [], description: '' }],
      ['B', { handRank: HandRank.FLUSH, rankName: 'Flush', score: [5, 14, 10, 8, 6, 2], best5: [], description: '' }],
      ['C', { handRank: HandRank.ONE_PAIR, rankName: 'One Pair', score: [1, 9, 14, 8, 7], best5: [], description: '' }],
    ]);

    const winners = PotManager.resolveShowdown(pots, [pA, pB, pC], evals, 0);

    // Pot 0: Player A has the best hand (Full House) -> wins 300
    const pot0Win = winners.find((w) => w.potIndex === 0);
    expect(pot0Win?.playerId).toBe('A');
    expect(pot0Win?.amount).toBe(300);

    // Pot 1: Only B and C eligible. B has Flush -> wins 400
    const pot1Win = winners.find((w) => w.potIndex === 1);
    expect(pot1Win?.playerId).toBe('B');
    expect(pot1Win?.amount).toBe(400);
  });

  it('splits pot evenly on tie and awards odd chip to earliest position', () => {
    // Pot: 101 chips, players B (seat 1) and C (seat 2) tie. Button is seat 0.
    // Earliest after button is seat 1 (B), so B gets 51, C gets 50.
    const pots = [{ id: 0, amount: 101, eligiblePlayerIds: ['B', 'C'] }];
    const pB = createMockPlayer('B', 1, 100, false, false);
    const pC = createMockPlayer('C', 2, 100, false, false);

    const tieEval: HandEvaluation = {
      handRank: HandRank.STRAIGHT,
      rankName: 'Straight',
      score: [4, 10],
      best5: [],
      description: '',
    };
    const evals = new Map<string, HandEvaluation>([
      ['B', tieEval],
      ['C', tieEval],
    ]);

    const winners = PotManager.resolveShowdown(pots, [pB, pC], evals, 0);
    expect(winners.length).toBe(2);

    const bWin = winners.find((w) => w.playerId === 'B');
    const cWin = winners.find((w) => w.playerId === 'C');

    expect(bWin?.amount).toBe(51);
    expect(cWin?.amount).toBe(50);
  });
});
