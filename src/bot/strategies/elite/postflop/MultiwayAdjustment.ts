export interface MultiwayAdjustmentParams {
  bluffMultiplier: number;
  cbetMultiplier: number;
  requiredStrengthShift: number;
  thinValueAllowed: boolean;
  overbetAllowed: boolean;
  description: string;
}

export class MultiwayAdjustment {
  /**
   * Computes multiway tactical adjustments based on the number of active opponents.
   */
  public static calculate(activeOpponents: number): MultiwayAdjustmentParams {
    if (activeOpponents <= 1) {
      // Heads-up: Standard Solver / Range baseline
      return {
        bluffMultiplier: 1.0,
        cbetMultiplier: 1.0,
        requiredStrengthShift: 0.0,
        thinValueAllowed: true,
        overbetAllowed: true,
        description: '單挑底池 (Heads-up Baseline)',
      };
    }

    if (activeOpponents === 2) {
      // 3-way pot
      return {
        bluffMultiplier: 0.40,
        cbetMultiplier: 0.65,
        requiredStrengthShift: 0.12,
        thinValueAllowed: false,
        overbetAllowed: false,
        description: '三人底池：大幅降低詐唬與 C-Bet 頻率，提升成牌強度門檻',
      };
    }

    // 4-way or more
    return {
      bluffMultiplier: 0.15,
      cbetMultiplier: 0.35,
      requiredStrengthShift: 0.25,
      thinValueAllowed: false,
      overbetAllowed: false,
      description: '多方底池 (4人+)：僅做強價值下注，近乎完全放棄純詐唬',
    };
  }
}
