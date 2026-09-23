import { describe, it, expect } from 'vitest';
import { BotBenchmark } from '../../bot/benchmark/BotBenchmark';

describe('BotBenchmark Automated Simulation Test', () => {
  it('runs headless simulation: 0 crashes, 0 illegal actions, stable strategy execution', () => {
    const result = BotBenchmark.run(50, 42);

    expect(result.totalHands).toBe(50);
    expect(result.crashesCount).toBe(0);
    expect(result.illegalActionsCount).toBe(0);
    expect(result.eliteVPIP).toBeGreaterThan(0.10);
    expect(result.eliteVPIP).toBeLessThan(0.60);
    expect(result.summary).toContain('[BotBenchmark 結果]');
  });
});
