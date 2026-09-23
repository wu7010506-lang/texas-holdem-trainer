import { Street } from '../../../../engine/types';
import { DetailedBoardTexture } from './BoardTextureAnalyzer';

export interface SizingOption {
  type: 'CHECK' | 'BET_33' | 'BET_75' | 'BET_125' | 'ALL_IN';
  potFraction: number; // e.g. 0.33, 0.75, 1.25, or stack ratio
  amount: number;
}

export class SizingStrategy {
  /**
   * Generates available sizing candidates based on street, board texture, pot size, player stack, and spr.
   */
  public static getCandidateSizes(
    street: Street,
    potSize: number,
    playerStack: number,
    spr: number,
    boardTexture: DetailedBoardTexture,
    hasNutAdvantage: boolean
  ): SizingOption[] {
    const options: SizingOption[] = [];

    // All-in amount
    const allInAmount = playerStack;

    // If SPR is very low, simplify to Shove or Check
    if (spr <= 1.2) {
      options.push({ type: 'ALL_IN', potFraction: playerStack / potSize, amount: allInAmount });
      return options;
    }

    // 1. 33% Pot (Small bet - dry boards, high range advantage, c-bets)
    const amount33 = Math.max(10, Math.round(potSize * 0.33));
    if (amount33 < playerStack) {
      options.push({ type: 'BET_33', potFraction: 0.33, amount: amount33 });
    }

    // 2. 75% Pot (Standard / Geometrical sizing - wet boards, turns, rivers)
    const amount75 = Math.max(10, Math.round(potSize * 0.75));
    if (amount75 < playerStack) {
      options.push({ type: 'BET_75', potFraction: 0.75, amount: amount75 });
    }

    // 3. 125% Overbet (Polarized river, strong nut advantage, turn barreling)
    if (street === 'RIVER' && hasNutAdvantage) {
      const amount125 = Math.max(10, Math.round(potSize * 1.25));
      if (amount125 < playerStack) {
        options.push({ type: 'BET_125', potFraction: 1.25, amount: amount125 });
      }
    }

    // 4. All-in
    if (spr <= 2.5 || (street === 'RIVER' && spr <= 3.5)) {
      options.push({ type: 'ALL_IN', potFraction: playerStack / potSize, amount: allInAmount });
    }

    return options;
  }
}
