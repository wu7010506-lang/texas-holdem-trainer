export class PotOddsCalculator {
  /**
   * Calculates pot odds for a given call amount and current total pot.
   * potOdds = amountToCall / (currentPot + amountToCall)
   */
  public static calculate(
    amountToCall: number,
    currentPot: number
  ): {
    potOdds: number;
    potOddsPercent: number;
    potAfterCall: number;
  } {
    if (amountToCall <= 0) {
      return { potOdds: 0, potOddsPercent: 0, potAfterCall: currentPot };
    }

    const potAfterCall = currentPot + amountToCall;
    const potOdds = amountToCall / potAfterCall;

    return {
      potOdds: Number(potOdds.toFixed(4)),
      potOddsPercent: Number((potOdds * 100).toFixed(1)),
      potAfterCall,
    };
  }

  /**
   * Calculates Stack-to-Pot Ratio (SPR)
   */
  public static calculateSPR(effectiveStack: number, potSize: number): number {
    if (potSize <= 0) return 999;
    return Number((effectiveStack / potSize).toFixed(2));
  }
}
