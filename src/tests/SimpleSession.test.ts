import { afterEach, describe, expect, it, vi } from "vitest";
import { createPokerStore, DEFAULT_CONFIG } from "../store/usePokerStore";
import { PokerGame } from "../engine/PokerGame";
import { BotController } from "../bot/BotController";
import { createEquityRequest } from "../equity/createEquityRequest";
import { createCard } from "../engine/Card";
import { getSettlements } from "../components/table/settlement";

afterEach(() => vi.useRealTimers());

describe("Settlement display", () => {
  it("does not treat an unmatched all-in refund as a win", () => {
    const state = new PokerGame(DEFAULT_CONFIG).getState();
    state.players[0].totalBetThisHand = 1085;
    state.players[1].totalBetThisHand = 995;
    state.winners = [
      { playerId: "p1", potIndex: 0, amount: 2005 },
      { playerId: "p0", potIndex: 1, amount: 90 },
    ];
    expect(getSettlements(state).get("p0")).toEqual({ won: 0, returned: 90 });
    expect(getSettlements(state).get("p1")).toEqual({ won: 2005, returned: 0 });
  });

  it("keeps an uncontested matched pot separate from the uncalled bet", () => {
    const state = new PokerGame(DEFAULT_CONFIG).getState();
    state.players[0].totalBetThisHand = 100;
    state.players[1].totalBetThisHand = 10;
    state.winners = [{ playerId: "p0", potIndex: 0, amount: 110 }];
    expect(getSettlements(state).get("p0")).toEqual({ won: 20, returned: 90 });
  });
});

describe("Simple game session", () => {
  it("initializes only once under React StrictMode and refuses a new hand during play", async () => {
    const store = createPokerStore({ randomSeed: 12, botThinkTime: 0 });
    store.getState().init();
    store.getState().init();
    store.getState().startNewHand();
    await vi.waitFor(() => expect(store.getState().isBotThinking).toBe(false), {
      timeout: 4000,
    });
    expect(store.getState().gameState.handId).toBe(1);
    expect(store.getState().isBotThinking).toBe(false);
    expect(store.getState().error).toBeNull();
    store.getState().dispose();
  });

  it("serializes bot turns and ignores duplicate clicks while the opponents act", async () => {
    const store = createPokerStore({ randomSeed: 42, botThinkTime: 1 });
    store.getState().init();
    await vi.waitFor(() => expect(store.getState().isBotThinking).toBe(false), {
      timeout: 4000,
    });
    expect(store.getState().gameState.currentPlayerSeat).toBe(0);
    store.getState().executePlayerAction({ type: "FOLD" });
    store.getState().executePlayerAction({ type: "ALL_IN" });
    const runner = store.getState().processBotTurns();
    await vi.waitFor(() => expect(store.getState().isBotThinking).toBe(false), {
      timeout: 4000,
    });
    await runner;
    const state = store.getState().gameState;
    const actions = state.actionHistory.filter((action) => action.seat === 0);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("FOLD");
    expect(state.handComplete).toBe(true);
    expect(store.getState().error).toBeNull();
    expect(store.getState().isBotThinking).toBe(false);
    store.getState().startNewHand();
    await vi.waitFor(() => expect(store.getState().isBotThinking).toBe(false), {
      timeout: 4000,
    });
    expect(store.getState().gameState.handId).toBe(2);
    store.getState().dispose();
  });

  it("rebuy updates the engine and cannot overwrite chips during a live hand", () => {
    const game = new PokerGame({ ...DEFAULT_CONFIG, playerCount: 2 });
    const players = game.getState().players;
    players[0].stack = 0;
    const emptyGame = new PokerGame(
      { ...DEFAULT_CONFIG, playerCount: 2 },
      players,
    );
    expect(emptyGame.rebuyPlayer(0).players[0].stack).toBe(1000);
    expect(emptyGame.getState().players[0].stack).toBe(1000);
    const live = emptyGame.startNewHand();
    const before = live.players[0].stack;
    expect(emptyGame.rebuyPlayer(0).players[0].stack).toBe(before);
  });
});

describe("Hidden information at the real game boundary", () => {
  it("equity requests contain only own cards, board, and public opponent metadata", () => {
    const game = new PokerGame({ ...DEFAULT_CONFIG, randomSeed: 74 });
    const state = game.startNewHand();
    const original = createEquityRequest(state, 0);
    state.players[1].holeCards = [createCard("A", "s"), createCard("A", "h")];
    expect(createEquityRequest(state, 0)).toEqual(original);
    expect(original?.opponents).toEqual(
      state.players.slice(1).map((p) => ({ id: p.id, position: p.position })),
    );
    state.players[0].folded = true;
    expect(createEquityRequest(state, 0)).toBeNull();
  });

  it("bot context excludes hero cards and follows configured blinds", () => {
    const game = new PokerGame({
      ...DEFAULT_CONFIG,
      bigBlind: 40,
      smallBlind: 20,
      randomSeed: 90,
    });
    const state = game.startNewHand();
    const controller = new BotController();
    const before = controller.buildContext(state, 3);
    state.players[0].holeCards = [createCard("A", "s"), createCard("A", "h")];
    expect(controller.buildContext(state, 3)).toEqual(before);
    expect(before.bigBlind).toBe(40);
    expect(before).not.toHaveProperty("players");
    expect(before).not.toHaveProperty("deck");
    expect(before).not.toHaveProperty("heroHoleCards");
  });
});
