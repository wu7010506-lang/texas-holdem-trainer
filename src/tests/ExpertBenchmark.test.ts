import { describe, expect, it } from "vitest";
import process from "node:process";
import { runExpertBenchmark } from "../bot/benchmark/ExpertBenchmark";
import { PokerGame } from "../engine/PokerGame";
import { buildBotContext } from "../bot/buildBotContext";
import { ExpertStrategy } from "../bot/expert/ExpertStrategy";
import { DEFAULT_CONFIG } from "../store/usePokerStore";

describe("Expert table integration and reproducible benchmark", () => {
  it("finishes real six-expert hands, with conserved chips and bounded legal actions", () => {
    const bots = Array.from(
      { length: 6 },
      (_, styleIndex) =>
        new ExpertStrategy({
          styleIndex,
          seed: 881 + styleIndex,
          simulations: 150,
        }),
    );
    const game = new PokerGame({
      ...DEFAULT_CONFIG,
      randomSeed: 444,
      autoNextHand: true,
    });
    for (let hand = 0; hand < 8; hand++) {
      let state = game.startNewHand(),
        turns = 0;
      const chips = state.players.reduce(
        (s, p) => s + p.stack + p.totalBetThisHand,
        0,
      );
      while (!state.handComplete) {
        expect(++turns).toBeLessThan(160);
        const seat = state.currentPlayerSeat;
        const decision = bots[seat].decideAction(buildBotContext(state, seat));
        state = game.applyAction({
          type: decision.action,
          amount: decision.amount,
        });
      }
      expect(state.players.reduce((s, p) => s + p.stack, 0)).toBe(chips);
      bots.forEach((bot) =>
        bot.observe(buildBotContext(state, 0).previousActions),
      );
    }
  }, 20000);
  it("compares duplicate deals across all seats and reports measured performance", () => {
    const handsPerSeat = Number(process.env.POKER_BENCH_HANDS ?? 2);
    const report = runExpertBenchmark({
      handsPerSeat,
      simulations: process.env.POKER_BENCH_HANDS ? 900 : 150,
    });
    expect(report.illegalActions).toBe(0);
    expect(report.handsPerStrategy).toBe(handsPerSeat * 4 * 6);
    expect(report.bySeat).toHaveLength(6);
    expect(Number.isFinite(report.improvementBBPer100)).toBe(true);
    if (process.env.POKER_BENCH_HANDS)
      console.log("EXPERT_BENCHMARK " + JSON.stringify(report));
  }, 300000);
});
