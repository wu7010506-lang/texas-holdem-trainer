import { describe, expect, it } from "vitest";
import { PokerGame } from "../engine/PokerGame";
import { ActionValidator } from "../engine/ActionValidator";
import { DEFAULT_CONFIG } from "../store/usePokerStore";

describe("Short all-in raise rights", () => {
  it("records raise totals separately from the actual chips added to the pot", () => {
    const game = new PokerGame({ ...DEFAULT_CONFIG, randomSeed: 53 });
    game.startNewHand();
    game.applyAction({ type: "RAISE", amount: 30 });
    game.applyAction({ type: "FOLD" });
    game.applyAction({ type: "FOLD" });
    game.applyAction({ type: "CALL" });
    const before = game.getState(); // SB previously contributed five.
    const state = game.applyAction({ type: "RAISE", amount: 120 });
    const record = state.actionHistory.at(-1)!;
    expect(record.amount).toBe(120);
    expect(record.potBefore).toBe(before.pot);
    expect(record.stackBefore).toBe(before.players[1].stack);
    expect(record.potAfter - record.potBefore).toBe(115);
    const next = game.getState(); // BB already contributed ten.
    const pushed = game.applyAction({ type: "ALL_IN" });
    const shove = pushed.actionHistory.at(-1)!;
    expect(shove.potBefore).toBe(next.pot);
    expect(shove.stackBefore).toBe(next.players[2].stack);
    expect(shove.potAfter - shove.potBefore).toBe(next.players[2].stack);
  });
  it("does not reopen an already-acted player after a single incomplete raise", () => {
    const config = { ...DEFAULT_CONFIG, playerCount: 3, randomSeed: 53 };
    const initial = new PokerGame(config).getState().players;
    initial[2].stack = 35;
    const game = new PokerGame(config, initial);
    game.startNewHand();
    game.applyAction({ type: "RAISE", amount: 30 }); // Full raise increment 20.
    game.applyAction({ type: "CALL" });
    const state = game.applyAction({ type: "ALL_IN" }); // BB only adds five.
    expect(state.currentPlayerSeat).toBe(0);
    expect(state.legalActions?.canCall).toBe(true);
    expect(state.legalActions?.callAmount).toBe(5);
    expect(state.legalActions?.canRaise).toBe(false);
    expect(state.legalActions?.canAllIn).toBe(false);
    expect(() => game.applyAction({ type: "RAISE", amount: 55 })).toThrow(
      "Cannot raise",
    );
    expect(() => game.applyAction({ type: "ALL_IN" })).toThrow();
    game.applyAction({ type: "CALL" });
    const flop = game.applyAction({ type: "CALL" });
    expect(flop.street).toBe("FLOP");
    expect(flop.legalActions?.canBet).toBe(true);
  });
  it("reopens after cumulative short raises equal a full raise for this player", () => {
    const config = { ...DEFAULT_CONFIG, playerCount: 4, randomSeed: 65 };
    const initial = new PokerGame(config).getState().players;
    initial[0].stack = 40;
    initial[1].stack = 50;
    const game = new PokerGame(config, initial);
    game.startNewHand(); // UTG seat 3.
    game.applyAction({ type: "RAISE", amount: 30 });
    game.applyAction({ type: "ALL_IN" }); // +10 incomplete.
    const short = game.applyAction({ type: "ALL_IN" }); // +10 incomplete, cumulative +20.
    expect(short.lastRaiseAmount).toBe(20);
    game.applyAction({ type: "CALL" });
    const state = game.getState();
    expect(state.currentPlayerSeat).toBe(3);
    expect(state.legalActions?.canRaise).toBe(true);
    expect(state.legalActions?.minRaise).toBe(70);
  });
  it("preserves short-stack all-in calls even when raising is closed", () => {
    const player = new PokerGame(DEFAULT_CONFIG).getState().players[0];
    Object.assign(player, {
      stack: 3,
      currentBet: 30,
      acted: true,
      raiseReopenAt: 50,
    });
    const legal = ActionValidator.getLegalActions(player, 35, 20, 10);
    expect(legal.canRaise).toBe(false);
    expect(legal.canAllIn).toBe(true);
    expect(
      ActionValidator.validate(player, { type: "CALL" }, 35, 20, 10)
        .normalizedAction?.type,
    ).toBe("ALL_IN");
  });
});
