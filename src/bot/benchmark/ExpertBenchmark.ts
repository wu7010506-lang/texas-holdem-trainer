import { PokerGame } from "../../engine/PokerGame";
import { ActionValidator } from "../../engine/ActionValidator";
import { GameConfig, PlayerState } from "../../engine/types";
import { buildBotContext, publicActionHistory } from "../buildBotContext";
import { ExpertStrategy } from "../expert/ExpertStrategy";
import { ProfileDrivenStrategy } from "../ProfileDrivenStrategy";
import { DEFAULT_PROFILES } from "../defaultProfiles";
import { SeededRng } from "../strategies/elite/random/SeededRng";

export interface ExpertBenchmarkReport {
  handsPerStrategy: number;
  seeds: number[];
  expertBBPer100: number;
  baselineBBPer100: number;
  improvementBBPer100: number;
  pairedMargin95: number;
  illegalActions: number;
  bySeat: { seat: number; expertBBPer100: number; baselineBBPer100: number }[];
  limitation: string;
}

/** Duplicate deals, independent policy RNG, all six subject seats, fixed 100BB buy-ins.
 * This measures a regression against the former bots, not professional-human strength. */
export function runExpertBenchmark(
  options: {
    handsPerSeat?: number;
    seeds?: number[];
    simulations?: number;
  } = {},
): ExpertBenchmarkReport {
  const handsPerSeat = options.handsPerSeat ?? 10;
  const seeds = options.seeds ?? [104729, 130363, 155921, 196613];
  const config: GameConfig = {
    startingStack: 1000,
    smallBlind: 5,
    bigBlind: 10,
    playerCount: 6,
    heroSeat: 0,
    botThinkTime: 0,
    autoNextHand: false,
    showPotOdds: false,
    showHandStrength: false,
    showBotReasoning: false,
    showEstimatedEquity: false,
  };
  const profiles = ["tag", "lag", "calling_station", "nit", "maniac"];
  const old = new ProfileDrivenStrategy();
  const bySeat: ExpertBenchmarkReport["bySeat"] = [];
  const pairedDifferences: number[] = [];
  let expertNet = 0,
    baselineNet = 0,
    illegalActions = 0;
  for (let seat = 0; seat < 6; seat++) {
    let expertSeatNet = 0,
      baselineSeatNet = 0;
    for (const seed of seeds) {
      // Kept separate from the real deck seed and stable across benchmark versions.
      const expert = new ExpertStrategy({
        styleIndex: seat % 5,
        seed: 0x574f524b + seat,
        simulations: options.simulations ?? 600,
      });
      for (let hand = 0; hand < handsPerSeat; hand++) {
        const gains: number[] = [];
        for (const mode of ["expert", "baseline"] as const) {
          const rng = SeededRng.create(0x524e4700 + hand * 101 + seat * 311);
          const players: PlayerState[] = Array.from(
            { length: 6 },
            (_, playerSeat) => ({
              id: `p${playerSeat}`,
              name: `Seat ${playerSeat}`,
              seat: playerSeat,
              isHuman: false,
              stack: 1000,
              holeCards: [],
              currentBet: 0,
              totalBetThisHand: 0,
              folded: false,
              allIn: false,
              acted: false,
              position: "",
              botProfileId:
                playerSeat === seat
                  ? "tag"
                  : profiles[((playerSeat - seat + 5) % 6) % 5],
            }),
          );
          const game = new PokerGame(
            { ...config, randomSeed: seed + hand * 7919 },
            players,
          );
          let state = game.startNewHand(),
            turns = 0;
          while (!state.handComplete) {
            if (++turns > 160) throw new Error("Expert benchmark stalled");
            const player = state.players[state.currentPlayerSeat];
            const context = buildBotContext(state, player.seat);
            context.handId = hand + 1;
            context.previousActions = context.previousActions.map((a) => ({
              ...a,
              handId: hand + 1,
            }));
            const decision =
              mode === "expert" && player.seat === seat
                ? expert.decideAction(context)
                : old.decideAction(
                    context,
                    DEFAULT_PROFILES[player.botProfileId!],
                    rng,
                  );
            const action = { type: decision.action, amount: decision.amount };
            if (
              !ActionValidator.validate(
                player,
                action,
                state.currentBet,
                state.lastRaiseAmount,
                config.bigBlind,
              ).valid
            )
              illegalActions++;
            state = game.applyAction(action);
          }
          if (state.players.reduce((sum, p) => sum + p.stack, 0) !== 6000)
            throw new Error("Benchmark chip conservation failed");
          gains.push((state.players[seat].stack - 1000) / config.bigBlind);
          if (mode === "expert")
            expert.observe(
              publicActionHistory(state.actionHistory).map((a) => ({
                ...a,
                handId: hand + 1,
              })),
            );
        }
        expertSeatNet += gains[0];
        baselineSeatNet += gains[1];
        pairedDifferences.push(gains[0] - gains[1]);
      }
    }
    const hands = seeds.length * handsPerSeat;
    bySeat.push({
      seat,
      expertBBPer100: (expertSeatNet / hands) * 100,
      baselineBBPer100: (baselineSeatNet / hands) * 100,
    });
    expertNet += expertSeatNet;
    baselineNet += baselineSeatNet;
  }
  const n = pairedDifferences.length,
    mean = pairedDifferences.reduce((sum, v) => sum + v, 0) / n;
  const variance =
    pairedDifferences.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
    Math.max(1, n - 1);
  return {
    handsPerStrategy: n,
    seeds,
    expertBBPer100: (expertNet / n) * 100,
    baselineBBPer100: (baselineNet / n) * 100,
    improvementBBPer100: mean * 100,
    pairedMargin95: 1.96 * Math.sqrt(variance / n) * 100,
    illegalActions,
    bySeat,
    limitation:
      "Paired normal-approximation interval, not cluster-adjusted; artificial fixed-stack opponents, no human/GTO strength claim.",
  };
}
