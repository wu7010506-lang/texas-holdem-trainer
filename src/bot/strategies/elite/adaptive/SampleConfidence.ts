export interface ConfidenceAssessment {
  sampleCount: number;
  confidence: number; // 0.0 to 1.0
  tier: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

export class SampleConfidence {
  /**
   * Evaluates sample confidence using a Bayesian-inspired sample size thresholding curve.
   * < 100 hands: confidence ~ 0 (no exploit allowed)
   * 100-500 hands: small adjustments (0.05 to 0.20)
   * 500-2000 hands: moderate adjustments (0.20 to 0.70)
   * 2000+ hands: full allowed V1 exploit (up to 1.0 confidence)
   */
  public static assess(sampleCount: number): ConfidenceAssessment {
    if (sampleCount < 100) {
      return {
        sampleCount,
        confidence: 0.0,
        tier: 'VERY_LOW',
        description: '樣本不足 (< 100 手)：完全採用 GTO-Inspired 基準策略',
      };
    }

    if (sampleCount < 500) {
      const confidence = 0.05 + 0.15 * ((sampleCount - 100) / 400);
      return {
        sampleCount,
        confidence,
        tier: 'LOW',
        description: '小樣本 (100–500 手)：極微幅探索性調整',
      };
    }

    if (sampleCount < 2000) {
      const confidence = 0.20 + 0.50 * ((sampleCount - 500) / 1500);
      return {
        sampleCount,
        confidence,
        tier: 'MEDIUM',
        description: '中等樣本 (500–2,000 手)：允許中等幅度自適應剝削',
      };
    }

    // 2000+ hands
    const confidence = Math.min(1.0, 0.70 + 0.30 * ((sampleCount - 2000) / 1000));
    return {
      sampleCount,
      confidence,
      tier: 'HIGH',
      description: '大樣本 (2,000+ 手)：允許達 Elite V1 最大上限 15% 自適應調整',
    };
  }
}
