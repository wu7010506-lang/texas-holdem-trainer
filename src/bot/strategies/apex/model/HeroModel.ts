export interface BayesianMetric {
  opportunities: number;
  count: number;
  priorAlpha: number;
  priorBeta: number;
}

export function createMetric(priorRate = 0.5, priorWeight = 6): BayesianMetric {
  const alpha = priorRate * priorWeight;
  const beta = (1 - priorRate) * priorWeight;
  return { opportunities: 0, count: 0, priorAlpha: alpha, priorBeta: beta };
}

export function getPosteriorRate(metric: BayesianMetric): number {
  return (metric.count + metric.priorAlpha) / (metric.opportunities + metric.priorAlpha + metric.priorBeta);
}

export function recordEvent(metric: BayesianMetric, occurred: boolean, weight = 1.0): void {
  metric.opportunities += weight;
  if (occurred) metric.count += weight;
}

export interface PositionPreflopStats {
  rfi: BayesianMetric;
  facingOpenCall: BayesianMetric;
  facingOpenThreeBet: BayesianMetric;
  facingOpenFold: BayesianMetric;
  facingThreeBetFold: BayesianMetric;
  facingThreeBetCall: BayesianMetric;
  facingThreeBetFourBet: BayesianMetric;
}

export interface FlopTextureStats {
  cbet: BayesianMetric;
  foldVsCbet: BayesianMetric;
  callVsCbet: BayesianMetric;
  raiseVsCbet: BayesianMetric;
  checkRaise: BayesianMetric;
}

export interface RiverSizingStats {
  betSmall: BayesianMetric;     // 25-40%
  betMedium: BayesianMetric;    // 50-80%
  betLarge: BayesianMetric;     // 100%+
  betOverbet: BayesianMetric;   // 125%+
  foldVsSmall: BayesianMetric;
  foldVsMedium: BayesianMetric;
  foldVsLarge: BayesianMetric;
  foldVsOverbet: BayesianMetric;
  bluffEstimate: BayesianMetric;
}

export class HeroModel {
  public handsTracked = 0;
  public preflopByPosition: Record<string, PositionPreflopStats> = {};
  public flopStatsByTexture: Record<string, FlopTextureStats> = {};
  public turnDoubleBarrel: BayesianMetric = createMetric(0.50, 10);
  public turnFoldVsBet: BayesianMetric = createMetric(0.45, 10);
  public preflopAllInShove: BayesianMetric = createMetric(0.02, 6);
  public riverStats: RiverSizingStats;

  constructor() {
    const positions = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    for (const pos of positions) {
      this.preflopByPosition[pos] = {
        rfi: createMetric(pos === 'BTN' ? 0.45 : pos === 'UTG' ? 0.16 : 0.25, 12),
        facingOpenCall: createMetric(0.20, 8),
        facingOpenThreeBet: createMetric(0.08, 8),
        facingOpenFold: createMetric(pos === 'BB' ? 0.50 : 0.65, 8),
        facingThreeBetFold: createMetric(0.55, 8),
        facingThreeBetCall: createMetric(0.35, 8),
        facingThreeBetFourBet: createMetric(0.10, 8),
      };
    }

    const textures = ['DRY', 'WET', 'PAIRED', 'HIGH_CARD', 'LOW_CARD'];
    for (const tex of textures) {
      this.flopStatsByTexture[tex] = {
        cbet: createMetric(tex === 'DRY' ? 0.70 : 0.45, 10),
        foldVsCbet: createMetric(tex === 'DRY' ? 0.48 : 0.38, 10),
        callVsCbet: createMetric(0.40, 10),
        raiseVsCbet: createMetric(0.12, 10),
        checkRaise: createMetric(0.08, 10),
      };
    }

    this.riverStats = {
      betSmall: createMetric(0.25, 8),
      betMedium: createMetric(0.45, 8),
      betLarge: createMetric(0.20, 8),
      betOverbet: createMetric(0.10, 8),
      foldVsSmall: createMetric(0.30, 8),
      foldVsMedium: createMetric(0.45, 8),
      foldVsLarge: createMetric(0.55, 8),
      foldVsOverbet: createMetric(0.68, 8), // GTO ~ 64% against 125% overbet
      bluffEstimate: createMetric(0.20, 8),
    };
  }

  public recordHand(): void {
    this.handsTracked++;
  }

  public getPreflopStats(position: string): PositionPreflopStats {
    const pos = position.toUpperCase();
    return this.preflopByPosition[pos] || this.preflopByPosition['BTN'];
  }

  public getFlopStats(textureKey: string): FlopTextureStats {
    return this.flopStatsByTexture[textureKey] || this.flopStatsByTexture['DRY'];
  }

  public reset(): void {
    this.handsTracked = 0;
    const positions = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    for (const pos of positions) {
      const p = this.preflopByPosition[pos];
      p.rfi.opportunities = 0; p.rfi.count = 0;
      p.facingOpenCall.opportunities = 0; p.facingOpenCall.count = 0;
      p.facingOpenThreeBet.opportunities = 0; p.facingOpenThreeBet.count = 0;
      p.facingOpenFold.opportunities = 0; p.facingOpenFold.count = 0;
      p.facingThreeBetFold.opportunities = 0; p.facingThreeBetFold.count = 0;
    }
    for (const tex of Object.keys(this.flopStatsByTexture)) {
      const f = this.flopStatsByTexture[tex];
      f.cbet.opportunities = 0; f.cbet.count = 0;
      f.foldVsCbet.opportunities = 0; f.foldVsCbet.count = 0;
    }
    this.riverStats.foldVsOverbet.opportunities = 0;
    this.riverStats.foldVsOverbet.count = 0;
    this.riverStats.foldVsLarge.opportunities = 0;
    this.riverStats.foldVsLarge.count = 0;
    this.preflopAllInShove.opportunities = 0;
    this.preflopAllInShove.count = 0;
  }
}
