import { describe, expect, it } from "vitest";
import process from "node:process";
import { PokerGame } from "../engine/PokerGame";
import { DEFAULT_CONFIG } from "../store/usePokerStore";
import { ExpertStrategy } from "../bot/expert/ExpertStrategy";
import { buildBotContext, publicActionHistory } from "../bot/buildBotContext";
import { ActionValidator } from "../engine/ActionValidator";
import { PlayerAction } from "../engine/types";

describe("Full expert table adversarial sessions", () => {
  it("withstands always-shove, small-raise spam, and never-fold attackers", () => {
    const hands = Number(process.env.POKER_STRESS_HANDS ?? 4);
    const reports: {
      attack: string;
      hands: number;
      heroBBPer100: number;
      earlyBBPer100: number;
      lateBBPer100: number;
    }[] = [];
    for (const attack of ["always-shove", "small-raise", "never-fold"]) {
      let total = 0,
        early = 0,
        late = 0;
      const bots = Array.from(
        { length: 6 },
        (_, styleIndex) =>
          new ExpertStrategy({
            styleIndex,
            seed: 0x600123 + styleIndex,
            simulations: process.env.POKER_STRESS_HANDS ? 900 : 150,
          }),
      );
      for (let hand = 0; hand < hands; hand++) {
        const game = new PokerGame({
          ...DEFAULT_CONFIG,
          randomSeed: 98717 + hand * 7829,
        });
        let state = game.startNewHand(),
          turns = 0;
        while (!state.handComplete) {
          expect(++turns).toBeLessThan(160);
          const seat = state.currentPlayerSeat;
          const context = buildBotContext(state, seat);
          context.handId = hand + 1;
          context.previousActions = context.previousActions.map((a) => ({
            ...a,
            handId: hand + 1,
          }));
          let action: PlayerAction;
          if (seat === 0) {
            const legal = context.legalActions;
            action =
              attack === "always-shove" && legal.canAllIn
                ? { type: "ALL_IN", amount: legal.allInAmount }
                : attack === "small-raise" && (legal.canRaise || legal.canBet)
                  ? {
                      type: legal.canRaise ? "RAISE" : "BET",
                      amount: legal.canRaise ? legal.minRaise : legal.minBet,
                    }
                  : legal.canCheck
                    ? { type: "CHECK" }
                    : { type: "CALL", amount: legal.callAmount };
          } else {
            const d = bots[seat].decideAction(context);
            action = { type: d.action, amount: d.amount };
          }
          expect(
            ActionValidator.validate(
              state.players[seat],
              action,
              state.currentBet,
              state.lastRaiseAmount,
              10,
            ).valid,
          ).toBe(true);
          state = game.applyAction(action);
        }
        expect(state.players.reduce((sum, p) => sum + p.stack, 0)).toBe(6000);
        const publicHistory = publicActionHistory(state.actionHistory).map(
          (a) => ({ ...a, handId: hand + 1 }),
        );
        bots.forEach((bot) => bot.observe(publicHistory));
        const net = (state.players[0].stack - 1000) / 10;
        total += net;
        if (hand < Math.floor(hands / 2)) early += net;
        else late += net;
      }
      reports.push({
        attack,
        hands,
        heroBBPer100: (total / hands) * 100,
        earlyBBPer100: (early / Math.max(1, Math.floor(hands / 2))) * 100,
        lateBBPer100: (late / Math.max(1, hands - Math.floor(hands / 2))) * 100,
      });
    }
    if (process.env.POKER_STRESS_HANDS)
      console.log("EXPERT_STRESS " + JSON.stringify(reports));
  }, 300000);
});
