import { describe, it, expect } from 'vitest';
import { PokerGame } from '../engine/PokerGame';
import { GameConfig } from '../engine/types';

describe('GameFlow', () => {
  const config6Max: GameConfig = {
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
    randomSeed: 999,
  };

  it('completes hand immediately when all other players fold', () => {
    const game = new PokerGame(config6Max);
    game.startNewHand();

    // 6 players: Dealer=0, SB=1, BB=2. Preflop first to act is UTG (seat 3)
    let state = game.getState();
    expect(state.currentPlayerSeat).toBe(3);

    // UTG raises to 30
    game.applyAction({ type: 'RAISE', amount: 30 });

    // Seats 4, 5, 0, 1, 2 fold
    for (let i = 0; i < 5; i++) {
      game.applyAction({ type: 'FOLD' });
    }

    state = game.getState();
    expect(state.handComplete).toBe(true);
    expect(state.winners?.length).toBe(1);
    expect(state.winners?.[0].playerId).toBe('p3'); // UTG won
    expect(state.winners?.[0].amount).toBeGreaterThan(0);
  });

  it('rotates button on consecutive hands', () => {
    const game = new PokerGame(config6Max);
    const hand1 = game.startNewHand();
    expect(hand1.dealerSeat).toBe(0);

    // End hand 1 quickly by folds
    game.applyAction({ type: 'RAISE', amount: 30 });
    for (let i = 0; i < 5; i++) game.applyAction({ type: 'FOLD' });

    const hand2 = game.startNewHand();
    expect(hand2.dealerSeat).toBe(1);
    expect(hand2.smallBlindSeat).toBe(2);
    expect(hand2.bigBlindSeat).toBe(3);
  });
});
