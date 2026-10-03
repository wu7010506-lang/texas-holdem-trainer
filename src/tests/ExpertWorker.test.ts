import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpertTable } from "../bot/expert/ExpertTable";
import { DEFAULT_CONFIG, createPokerStore } from "../store/usePokerStore";
import { PokerGame } from "../engine/PokerGame";
import { buildBotContext } from "../bot/buildBotContext";

class FakeWorker {
  static instances: FakeWorker[] = [];
  messages: any[] = [];
  onmessage?: (event: any) => void;
  onerror?: () => void;
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(message: unknown) {
    this.messages.push(structuredClone(message));
  }
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  FakeWorker.instances = [];
});

describe("Expert Worker lifecycle at the session interface", () => {
  it("sends each seat only its own cards, rejects stale IDs, and shuts down every worker", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const table = new ExpertTable();
    const state = new PokerGame({
      ...DEFAULT_CONFIG,
      randomSeed: 42,
    }).startNewHand();
    const a = buildBotContext(state, 3),
      b = buildBotContext(state, 4);
    const first = table.decide(a, 0),
      second = table.decide(b, 1);
    const [wa, wb] = FakeWorker.instances;
    expect(wa.messages[1].context.holeCards).toEqual(a.holeCards);
    expect(wb.messages[1].context.holeCards).toEqual(b.holeCards);
    expect(
      wa.messages[1].context.opponents.every(
        (o: object) => !Object.hasOwn(o, "holeCards"),
      ),
    ).toBe(true);
    wa.onmessage?.({ data: { id: -1, decision: { action: "FOLD" } } });
    wa.onmessage?.({
      data: {
        id: wa.messages[1].id,
        decision: { action: "CALL", reasoning: "" },
      },
    });
    wb.onmessage?.({
      data: {
        id: wb.messages[1].id,
        decision: { action: "FOLD", reasoning: "" },
      },
    });
    expect((await first).action).toBe("CALL");
    expect((await second).action).toBe("FOLD");
    table.dispose();
    expect(FakeWorker.instances.every((w) => w.terminated)).toBe(true);
  });
  it("cancels a hung worker and rejects its pending decision", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
    const table = new ExpertTable();
    const state = new PokerGame(DEFAULT_CONFIG).startNewHand();
    const pending = table.decide(buildBotContext(state, 3), 0);
    const assertion = expect(pending).rejects.toThrow("逾時");
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
    expect(FakeWorker.instances[0].terminated).toBe(true);
    table.dispose();
  });
  it("does not apply a pending decision after session disposal", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const store = createPokerStore({ randomSeed: 42, botThinkTime: 0 });
    store.getState().init();
    const before = store.getState().gameState.actionHistory.length;
    store.getState().dispose();
    await vi.waitFor(() => expect(store.getState().isBotThinking).toBe(false));
    expect(store.getState().gameState.actionHistory).toHaveLength(before);
    expect(store.getState().error).toBeNull();
  });
});
