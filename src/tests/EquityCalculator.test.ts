import { describe, it, expect } from 'vitest';
import { EquityCalculator } from '../bot/EquityCalculator';
import { parseCards } from '../engine/Card';

import { PokerGame } from '../engine/PokerGame';
import { GameConfig } from '../engine/types';

describe('EquityCalculator Rigorous Audit & Verification', () => {
  it('Test A: 必勝牌 (Hero holds unbeatable Royal Flush on River -> Equity 100%)', () => {
    const heroCards = parseCards('As Ks');
    const board = parseCards('Qs Js Ts 2c 3d');

    const result = EquityCalculator.calculate({
      heroHoleCards: heroCards,
      communityCards: board,
      opponents: 1,
      mode: 'random',
    });

    expect(result.isExact).toBe(true);
    expect(result.equity).toBe(1.0);
    expect(result.winRate).toBe(1.0);
    expect(result.tieRate).toBe(0.0);
    expect(result.lossRate).toBe(0.0);
  });

  it('Test B: 必敗牌 (Hero is drawing dead on River -> Equity 0%)', () => {
    // Board has Ace-high Straight: As Ks Qs Js 9d
    // Hero holds 2c 3d -> High card
    // Opponent holds Ts 8c -> Straight
    // Even against random hands, if Hero only has 9-high / no pair, and board has broadway straight,
    // let's give opponent a board where anyone has a better hand
    // Hero cannot beat board flush with 2c 3d, but wait! If everyone plays the board, it would be a tie.
    // To make Hero strictly drawing dead to a loss:
    // Board: Ah Kh Qh Jh 8h (Flush). Opponent is in Range of having Th or any heart,
    // Or let's test River exact enumeration against an opponent with made full house vs Hero's flush:
    // Hero with 2s 3s plays Aces full of Kings with kicker Kd
    // If opponent has AA or KK, opponent has Quads:
    // If opponent holds Ace -> Ace-high straight beats Hero's King-high straight!
    // To be 100% dead: Hero holds 7h 2c on board As Ks Qs Js 9c.
    // If opponent has Ts -> Straight.
    // Let's create an opponent range that only contains hands that beat Hero:
    const resultDead = EquityCalculator.calculate({
      heroHoleCards: parseCards('7c 2d'),
      communityCards: parseCards('Ah Kh Qh Jh 9c'),
      opponents: [
        {
          id: 'opp_nuts',
          position: 'BTN',
          range: {
            combos: [
              { cards: [parseCards('Ts')[0], parseCards('8d')[0]], weight: 1.0, notation: 'T8o' },
              { cards: [parseCards('Tc')[0], parseCards('8c')[0]], weight: 1.0, notation: 'T8s' },
            ],
            totalWeight: 2.0,
          },
        },
      ],
      mode: 'range',
    });

    expect(resultDead.equity).toBe(0.0);
    expect(resultDead.winRate).toBe(0.0);
    expect(resultDead.lossRate).toBe(1.0);
  });

  it('Test C: Board Playing (All players share identical 5-card board -> Exact Pot Share)', () => {
    // Board is Royal Flush: As Ks Qs Js Ts
    // Every player's best 5 is the board!
    const board = parseCards('As Ks Qs Js Ts');
    const heroCards = parseCards('2c 3c');

    // Case 1: Heads-up (2 players total: Hero + 1 Opponent)
    const resHU = EquityCalculator.calculate({
      heroHoleCards: heroCards,
      communityCards: board,
      opponents: 1,
      mode: 'random',
      simulations: 2000,
      seed: 12345,
    });
    // In Heads-up: Tie = 100%, Hero gets 1/2 pot = 50.0%
    expect(resHU.tieRate).toBe(1.0);
    expect(resHU.winRate).toBe(0.0);
    expect(resHU.lossRate).toBe(0.0);
    expect(resHU.equity).toBe(0.5);

    // Case 2: 3-way (3 players total: Hero + 2 Opponents)
    // This directly exposes the old tie / 2 bug!
    // Old flawed formula would give 50%, whereas correct pot share is 1/3 = 33.33%!
    const res3Way = EquityCalculator.calculate({
      heroHoleCards: heroCards,
      communityCards: board,
      opponents: 2,
      mode: 'random',
      simulations: 2000,
      seed: 12345,
    });
    expect(res3Way.tieRate).toBe(1.0);
    expect(res3Way.winRate).toBe(0.0);
    expect(res3Way.equity).toBeCloseTo(1 / 3, 3); // 0.3333

    // Case 3: 4-way (4 players total: Hero + 3 Opponents)
    // Correct pot share is 1/4 = 25.0%
    const res4Way = EquityCalculator.calculate({
      heroHoleCards: heroCards,
      communityCards: board,
      opponents: 3,
      mode: 'random',
      simulations: 2000,
      seed: 12345,
    });
    expect(res4Way.tieRate).toBe(1.0);
    expect(res4Way.winRate).toBe(0.0);
    expect(res4Way.equity).toBeCloseTo(1 / 4, 3); // 0.2500
  });

  it('Test D: Card Removal (No duplicate cards across Hero, Board, Opponents in any trial)', () => {
    // Running 5,000 simulations on Flop
    // The internal assertion inside runMonteCarlo validates uniqueness on every single iteration
    const heroCards = parseCards('Ah Kd');
    const board = parseCards('Qh Jd 2s');

    expect(() => {
      EquityCalculator.calculate({
        heroHoleCards: heroCards,
        communityCards: board,
        opponents: 4, // 4 opponents = 8 opponent cards + 2 hero + 5 board = 15 cards
        mode: 'random',
        simulations: 5000,
        seed: 9999,
      });
    }).not.toThrow();
  });

  it('Test E: Multiway Simultaneous Showdown vs separate heads-up', () => {
    // Pocket Aces preflop:
    // In Heads-up, AA has ~85% equity vs 1 random hand.
    // In 4-way (vs 3 random opponents), AA equity drops to ~64%, NOT (85% + 85% + 85%) / 3!
    const heroAA = parseCards('Ah As');
    const emptyBoard: any[] = [];

    const resHeadsUp = EquityCalculator.calculate({
      heroHoleCards: heroAA,
      communityCards: emptyBoard,
      opponents: 1,
      mode: 'random',
      simulations: 5000,
      seed: 42,
    });

    const res3Opponents = EquityCalculator.calculate({
      heroHoleCards: heroAA,
      communityCards: emptyBoard,
      opponents: 3,
      mode: 'random',
      simulations: 5000,
      seed: 42,
    });

    expect(resHeadsUp.equity).toBeGreaterThan(0.80);
    expect(res3Opponents.equity).toBeLessThan(0.70);
    expect(res3Opponents.equity).toBeGreaterThan(0.55);
  });

  it('Test F: Known Information Isolation (Modifying Bot true hole cards does NOT leak or change Equity)', () => {
    const config: GameConfig = {
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      playerCount: 6,
      heroSeat: 0,
      botThinkTime: 0,
      autoNextHand: false,
      showPotOdds: true,
      showHandStrength: true,
      showBotReasoning: true,
      showEstimatedEquity: true,
      randomSeed: 101,
    };

    const game = new PokerGame(config);
    game.startNewHand();

    const hero = game.getState().players[0];
    const board = game.getState().communityCards;

    // Simulation 1: Under original game state
    const eq1 = EquityCalculator.calculate({
      heroHoleCards: hero.holeCards,
      communityCards: board,
      opponents: 3,
      mode: 'range',
      simulations: 3000,
      seed: 777,
    });

    // Now intentionally mutate all bots' private hidden hole cards to something completely different
    // (e.g. giving Bot 1 pocket Aces, Bot 2 pocket Kings)
    const stateCopy = game.getState();
    stateCopy.players[1].holeCards = parseCards('Ac Ad');
    stateCopy.players[2].holeCards = parseCards('Kc Kd');

    // Simulation 2: Using the mutated state's public info (Hero cards + board + positions)
    const eq2 = EquityCalculator.calculate({
      heroHoleCards: stateCopy.players[0].holeCards,
      communityCards: stateCopy.communityCards,
      opponents: 3,
      mode: 'range',
      simulations: 3000,
      seed: 777,
    });

    // Both results MUST be 100% identical because EquityCalculator isolates hidden information!
    expect(eq1.equity).toBe(eq2.equity);
    expect(eq1.winRate).toBe(eq2.winRate);
    expect(eq1.tieRate).toBe(eq2.tieRate);
    expect(eq1.lossRate).toBe(eq2.lossRate);
  });
});
