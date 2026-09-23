export interface ActionObservation {
  timestamp: number;
  street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER';
  category: string; // e.g. 'RIVER_OVERFOLD', 'FLOP_CBET_FOLD', 'TURN_BARREL'
  occurred: boolean;
}

export class RecencyModel {
  private windowSize: number;
  private observations: ActionObservation[] = [];

  constructor(windowSize = 30) {
    this.windowSize = windowSize;
  }

  public record(street: 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER', category: string, occurred: boolean): void {
    this.observations.push({
      timestamp: Date.now(),
      street,
      category,
      occurred,
    });

    if (this.observations.length > this.windowSize * 5) {
      this.observations.splice(0, this.observations.length - this.windowSize * 5);
    }
  }

  public getRecentStats(category: string): { opportunities: number; count: number; rate: number } {
    const matching = this.observations.filter(o => o.category === category);
    // Take the last `windowSize` matching items
    const recent = matching.slice(-this.windowSize);
    const opportunities = recent.length;
    const count = recent.filter(o => o.occurred).length;
    const rate = opportunities > 0 ? count / opportunities : 0.5;

    return { opportunities, count, rate };
  }

  public clear(): void {
    this.observations = [];
  }
}
