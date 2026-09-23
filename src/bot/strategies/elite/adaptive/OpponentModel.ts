import { SampleConfidence, ConfidenceAssessment } from './SampleConfidence';

export interface OpponentStats {
  handsPlayed: number;
  vpip: number;
  pfr: number;
  threeBet: number;
  foldToThreeBet: number;
  cbet: number;
  foldToCBet: number;
  turnBarrel: number;
  riverBet: number;
  riverFold: number;
  checkRaise: number;
  wtsd: number;
  wsd: number;
}

export class OpponentModel {
  private static instance: OpponentModel;
  private stats: OpponentStats = {
    handsPlayed: 0,
    vpip: 0.25,
    pfr: 0.19,
    threeBet: 0.08,
    foldToThreeBet: 0.55,
    cbet: 0.60,
    foldToCBet: 0.45,
    turnBarrel: 0.50,
    riverBet: 0.40,
    riverFold: 0.50,
    checkRaise: 0.08,
    wtsd: 0.28,
    wsd: 0.52,
  };

  public static getInstance(): OpponentModel {
    if (!OpponentModel.instance) {
      OpponentModel.instance = new OpponentModel();
    }
    return OpponentModel.instance;
  }

  public getStats(): OpponentStats {
    return { ...this.stats };
  }

  public setHandsPlayed(count: number): void {
    this.stats.handsPlayed = count;
  }

  public updateStat(key: keyof OpponentStats, value: number): void {
    this.stats[key] = value;
  }

  public getConfidence(): ConfidenceAssessment {
    return SampleConfidence.assess(this.stats.handsPlayed);
  }

  public reset(): void {
    this.stats.handsPlayed = 0;
  }
}
