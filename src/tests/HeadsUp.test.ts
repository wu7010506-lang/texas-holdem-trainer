import { describe, it, expect } from 'vitest';
import { PokerGame } from '../engine/PokerGame';
import { GameConfig } from '../engine/types';

describe('Heads-Up rules', () => {
  const headsUpConfig: GameConfig = {
    startingStack: 1000,
    smallBlind: 5,
    bigBlind: 10,
    playerCount: 2,
    heroSeat: 0,
    botThinkTime: 0,
    autoNextHand: false,
    showPotOdds: true,
    showHandStrength: true,
    showBotReasoning: true,
    showEstimatedEquity: true,
    randomSeed: 42,
  };

  it('correctly posts blinds and assigns first-to-act in Heads-Up', () => {
    const game = new PokerGame(headsUpConfig);
    const state = game.startNewHand();

    expect(state.isHeadsUp).toBe(true);
    // Button is dealerSeat = 0
    expect(state.dealerSeat).toBe(0);
    expect(state.smallBlindSeat).toBe(0); // Button is SB
    expect(state.bigBlindSeat).toBe(1);   // Other player is BB

    // Preflop: Button/SB acts first
    expect(state.currentPlayerSeat).toBe(0);

    // Call SB to match BB
    game.applyAction({ type: 'CALL' });
    const afterCall = game.getState();
    // BB acts second
    expect(afterCall.currentPlayerSeat).toBe(1);

    // BB checks -> round completes -> Flop dealt
    game.applyAction({ type: 'CHECK' });
    const flopState = game.getState();

    expect(flopState.street).toBe('FLOP');
    expect(flopState.communityCards.length).toBe(3);

    // Postflop: BB (seat 1) acts FIRST in heads-up!
    expect(flopState.currentPlayerSeat).toBe(1);
  });
});
