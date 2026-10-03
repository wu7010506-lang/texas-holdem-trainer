import { describe, it, expect } from 'vitest';
import { ApexSelfPlayBenchmark } from '../../bot/benchmark/ApexSelfPlayBenchmark';

describe('Apex Bot Self-Play & Simulation Tests', () => {
  it('runs 100 hands of self-play simulation without crashes or illegal moves', () => {
    const report = ApexSelfPlayBenchmark.runSimulation(100, 42);

    console.log(report.summary);

    expect(report.totalHands).toBe(100);
    expect(report.crashesCount).toBe(0);
    expect(report.illegalActionsCount).toBe(0);
    expect(report.apexVPIP).toBeGreaterThan(0.12);
    expect(report.apexVPIP).toBeLessThan(0.45);
    expect(report.apexPFR).toBeGreaterThan(0.08);
  });

  it('runs multi-seed simulation tournaments: 0 crashes and robust performance across varying tables', () => {
    const seeds = [123, 777, 8888];
    let totalHands = 0;
    let totalProfitBB = 0;

    for (const seed of seeds) {
      const rep = ApexSelfPlayBenchmark.runSimulation(50, seed);
      expect(rep.crashesCount).toBe(0);
      expect(rep.illegalActionsCount).toBe(0);
      totalHands += rep.totalHands;
      totalProfitBB += rep.apexBBWon;
    }

    const overallBB100 = totalProfitBB / (totalHands / 100);
    console.log(`[Multi-Seed Tournament 總計] 手數: ${totalHands} | 總獲利: ${totalProfitBB.toFixed(1)} BB (${overallBB100.toFixed(2)} BB/100)`);
    expect(totalHands).toBe(150);
  });
});
