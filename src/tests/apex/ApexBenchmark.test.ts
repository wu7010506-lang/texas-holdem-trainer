import { describe, it, expect } from 'vitest';
import { ApexBenchmarkRunner } from '../../bot/strategies/apex/benchmark/ApexBenchmarkRunner';

describe('Apex Bot Benchmark Suite', () => {
  it('Benchmarks against RiverOverfolderBot: detects leak and achieves positive exploit EV gain', () => {
    const result = ApexBenchmarkRunner.benchmarkRiverOverfolder();

    expect(result.opponentName).toBe('RiverOverfolderBot');
    expect(result.exploitDetected).toBe(true);
    expect(result.netExploitGain).toBeGreaterThan(0);
    expect(result.apexEV).toBeGreaterThan(result.baselineEV);
  });

  it('Benchmarks against CallingStationBot: detects leak and adjusts strategy', () => {
    const result = ApexBenchmarkRunner.benchmarkCallingStation();

    expect(result.opponentName).toBe('CallingStationBot');
    expect(result.exploitDetected).toBe(true);
  });
});
