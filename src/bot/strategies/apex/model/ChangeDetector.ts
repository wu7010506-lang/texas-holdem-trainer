export interface StrategyShiftReport {
  shiftDetected: boolean;
  metricName: string;
  historicalRate: number;
  recentRate: number;
  decayFactor: number; // e.g. 0.50 if shifted, 1.0 if stable
  message: string;
}

export class ChangeDetector {
  /**
   * Detects if Hero has recently changed strategy compared to long-term history.
   */
  public static detectShift(
    historicalOpportunities: number,
    historicalRate: number,
    recentOpportunities: number,
    recentRate: number,
    metricName: string
  ): StrategyShiftReport {
    // Only detect shift if we have sufficient historical baseline and recent observations
    if (historicalOpportunities < 30 || recentOpportunities < 10) {
      return {
        shiftDetected: false,
        metricName,
        historicalRate,
        recentRate,
        decayFactor: 1.0,
        message: '樣本數尚不足以判定策略轉移',
      };
    }

    const diff = Math.abs(historicalRate - recentRate);
    if (diff >= 0.22) {
      // Significant shift detected!
      const decayFactor = Math.max(0.35, 1.0 - diff * 1.5);
      return {
        shiftDetected: true,
        metricName,
        historicalRate,
        recentRate,
        decayFactor,
        message: `偵測到 Hero 在 ${metricName} 之打法轉變 (歷史 ${(historicalRate * 100).toFixed(0)}% -> 近期 ${(recentRate * 100).toFixed(0)}%)，衰減剝削信心`,
      };
    }

    return {
      shiftDetected: false,
      metricName,
      historicalRate,
      recentRate,
      decayFactor: 1.0,
      message: 'Hero 策略維持穩定',
    };
  }
}
