import { describe, it, expect } from 'vitest';
import { ActionValidator } from '../engine/ActionValidator';
import { PlayerState } from '../engine/types';

describe('ActionValidator', () => {
  const basePlayer: PlayerState = {
    id: 'hero',
    name: 'Hero',
    seat: 0,
    isHuman: true,
    stack: 1000,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    allIn: false,
    acted: false,
    position: 'BTN',
  };

  it('allows Check when currentBet is 0, but disallows Bet > stack', () => {
    const legal = ActionValidator.getLegalActions(basePlayer, 0, 10, 10);
    expect(legal.canCheck).toBe(true);
    expect(legal.canBet).toBe(true);
    expect(legal.canCall).toBe(false);
    expect(legal.minBet).toBe(10);
    expect(legal.maxBet).toBe(1000);

    const valCheck = ActionValidator.validate(basePlayer, { type: 'CHECK' }, 0, 10, 10);
    expect(valCheck.valid).toBe(true);

    const valBadBet = ActionValidator.validate(basePlayer, { type: 'BET', amount: 5 }, 0, 10, 10);
    expect(valBadBet.valid).toBe(false);
  });

  it('disallows Check when facing a bet, allows Call and Raise', () => {
    // Current bet is 30, hero has put in 0
    const legal = ActionValidator.getLegalActions(basePlayer, 30, 20, 10);
    expect(legal.canCheck).toBe(false);
    expect(legal.canCall).toBe(true);
    expect(legal.callAmount).toBe(30);
    expect(legal.canRaise).toBe(true);
    // Min raise = currentBet (30) + max(BB 10, lastRaise 20) = 50
    expect(legal.minRaise).toBe(50);
    expect(legal.maxRaise).toBe(1000);

    const valCheck = ActionValidator.validate(basePlayer, { type: 'CHECK' }, 30, 20, 10);
    expect(valCheck.valid).toBe(false);

    const valCall = ActionValidator.validate(basePlayer, { type: 'CALL' }, 30, 20, 10);
    expect(valCall.valid).toBe(true);

    const valRaise = ActionValidator.validate(basePlayer, { type: 'RAISE', amount: 60 }, 30, 20, 10);
    expect(valRaise.valid).toBe(true);

    const valSubMinRaise = ActionValidator.validate(basePlayer, { type: 'RAISE', amount: 40 }, 30, 20, 10);
    expect(valSubMinRaise.valid).toBe(false);
  });

  it('treats short stack call as All-In', () => {
    const shortPlayer: PlayerState = { ...basePlayer, stack: 20 };
    // Current bet is 50
    const legal = ActionValidator.getLegalActions(shortPlayer, 50, 40, 10);
    expect(legal.callAmount).toBe(20);
    expect(legal.canRaise).toBe(false);

    const valCall = ActionValidator.validate(shortPlayer, { type: 'CALL' }, 50, 40, 10);
    expect(valCall.valid).toBe(true);
    expect(valCall.normalizedAction?.type).toBe('ALL_IN');
  });
});
