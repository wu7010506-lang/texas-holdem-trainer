import { describe, expect, it } from "vitest";
import { parseCards } from "../engine/Card";
import { Deck } from "../engine/Deck";
import { HandEvaluator } from "../engine/HandEvaluator";
import { PokerGame } from "../engine/PokerGame";
import { ActionRecord } from "../engine/types";
import { ActionValidator } from "../engine/ActionValidator";
import { DEFAULT_CONFIG } from "../store/usePokerStore";
import { buildBotContext } from "../bot/buildBotContext";
import { ExpertStrategy } from "../bot/expert/ExpertStrategy";
import { fastHandScore } from "../bot/expert/FastHandEvaluator";
import { OpponentMemory } from "../bot/expert/OpponentMemory";
import { inferRange } from "../bot/expert/RangeInference";
import { preflopFrequencies } from "../bot/expert/PreflopPolicy";
import { readPublicHistory } from "../bot/expert/PublicHistory";
import { makeRangeSampler, sampleJointHands } from "../bot/expert/RangeSampler";
import { searchDecisions, showdownPayout } from "../bot/expert/DecisionSearch";
import { SeededRng } from "../bot/strategies/elite/random/SeededRng";

function context(cards = "As Ks", board = "Qs Js Ts 2c 3d", bet = 0) {
  const game = new PokerGame({
    ...DEFAULT_CONFIG,
    playerCount: 2,
    randomSeed: 18,
  });
  const state = game.startNewHand();
  state.street = board.split(" ").length === 5 ? "RIVER" : "FLOP";
  state.players[0].holeCards = parseCards(cards);
  state.players[0].currentBet = 0;
  state.players[0].totalBetThisHand = 100;
  state.players[0].stack = 900;
  state.players[1].currentBet = bet;
  state.players[1].totalBetThisHand = 100 + bet;
  state.players[1].stack = 900 - bet;
  state.communityCards = parseCards(board);
  state.currentBet = bet;
  state.lastRaiseAmount = Math.max(10, bet);
  state.pot = 200 + bet;
  state.actionHistory = [];
  state.currentPlayerSeat = 0;
  return { c: buildBotContext(state, 0), state };
}
function action(overrides: Partial<ActionRecord> = {}): ActionRecord {
  return {
    handId: 1,
    street: "PREFLOP",
    seat: 1,
    playerId: "p1",
    playerName: "Opponent",
    action: "RAISE",
    amount: 25,
    potBefore: 15,
    potAfter: 40,
    stackBefore: 1000,
    stackAfter: 975,
    position: "BTN",
    timestamp: 0,
    ...overrides,
  };
}

describe("Fast rollout evaluator agrees with canonical evaluator", () => {
  it("matches 3,000 seeded seven-card hands and difficult edge cases", () => {
    const encode = (score: number[]) =>
      Array.from({ length: 6 }, (_, i) => score[i] ?? 0).reduce(
        (s, n) => s * 15 + n,
        0,
      );
    const deck = new Deck(1979);
    for (let i = 0; i < 3000; i++) {
      deck.reset();
      deck.shuffle();
      const cards = deck.drawMany(7);
      expect(fastHandScore(cards)).toBe(
        encode(HandEvaluator.evaluate(cards).score),
      );
    }
    for (const hand of [
      "As 2s 3s 4s 5s Kh Kd",
      "Ah Ad Ac Kh Kd Kc 2s",
      "Ah Ad Ac As Kh Kd 2s",
      "As Js 9s 8s 6s 4s 2s",
    ])
      expect(fastHandScore(parseCards(hand))).toBe(
        encode(HandEvaluator.evaluate(parseCards(hand)).score),
      );
  });
});

describe("Expert public information and preflop policy", () => {
  it("uses an explicit allowlist and strips private reasoning and arbitrary card fields", () => {
    const game = new PokerGame({ ...DEFAULT_CONFIG, randomSeed: 197 });
    const state = game.startNewHand();
    state.actionHistory.push({
      ...action(),
      reasoning: "my cards are As Ah",
      secretCards: parseCards("As Ah"),
    } as ActionRecord);
    const original = buildBotContext(state, 3);
    state.players[0].holeCards = parseCards("2c 7d");
    state.players[1].holeCards = parseCards("3c 8d");
    expect(buildBotContext(state, 3)).toEqual(original);
    expect(original.previousActions.at(-1)).not.toHaveProperty("secretCards");
    expect(original.previousActions.at(-1)?.reasoning).toBeUndefined();
    expect(
      original.opponents?.every((o) => !Object.hasOwn(o, "holeCards")),
    ).toBe(true);
    const before = new ExpertStrategy({ seed: 1 }).decideAction(original);
    const after = new ExpertStrategy({ seed: 1 }).decideAction(
      buildBotContext(state, 3),
    );
    expect(before).toEqual(after);
  });
  it("distinguishes blind posts, all-in calls, and actual reraises without chip constants", () => {
    const history = [
      action({ action: "BET", amount: 5, reasoning: "Small Blind" }),
      action({ seat: 2, action: "BET", amount: 10, reasoning: "Big Blind" }),
      action({ seat: 3, amount: 25 }),
      action({ seat: 4, action: "ALL_IN", amount: 20 }),
      action({ seat: 5, action: "ALL_IN", amount: 200 }),
    ];
    const observed = readPublicHistory(history);
    expect(observed.map((a) => a.aggressive)).toEqual([
      false,
      false,
      true,
      false,
      true,
    ]);
    expect(observed.at(-1)?.raisesBefore).toBe(1);
  });
  it("opens wider on the button, and supports early-position defense and deep 4-bets", () => {
    const node = {
      position: "UTG",
      raiserPosition: "UTG",
      raises: 0,
      callers: 0,
      toCallBB: 1,
      effectiveBB: 100,
    };
    expect(preflopFrequencies(parseCards("7h 2c"), node).fold).toBe(1);
    expect(
      preflopFrequencies(parseCards("Ah 5d"), { ...node, position: "BTN" })
        .raise,
    ).toBeGreaterThan(0.5);
    expect(
      preflopFrequencies(parseCards("Kh Qh"), {
        ...node,
        position: "HJ",
        raises: 1,
      }).call,
    ).toBeGreaterThan(0.5);
    expect(
      preflopFrequencies(parseCards("Ah Ad"), { ...node, raises: 2 }).raise,
    ).toBe(1);
  });
  it("updates ranges from actions on the board of that street and removes all known cards", () => {
    const { c } = context("Ah Kh", "Qs 9s 7h 2d 3d");
    const memory = new OpponentMemory();
    const opponent = c.opponents![0];
    const before = inferRange(c, opponent, memory);
    c.previousActions = [
      action({ action: "RAISE", amount: 25 }),
      action({ street: "FLOP", action: "BET", amount: 100, potBefore: 200 }),
    ];
    const after = inferRange(c, opponent, memory);
    const weight = (range: typeof after, notation: string) =>
      range.combos
        .filter((x) => x.notation === notation)
        .reduce((s, x) => s + x.weight, 0);
    expect(weight(after, "QQ") / weight(after, "72o")).toBeGreaterThan(
      weight(before, "QQ") / weight(before, "72o"),
    );
    const dead = new Set(
      [...c.holeCards, ...c.communityCards].map((card) => card.id),
    );
    expect(
      after.combos.every((combo) =>
        combo.cards.every((card) => !dead.has(card.id)),
      ),
    ).toBe(true);
  });
});

describe("Independent opponent adaptation", () => {
  it("ignores a tiny sample, deduplicates observations, and learns persistent overfolds", () => {
    const memory = new OpponentMemory();
    const hand = (handId: number) => [
      action({ handId, seat: 2, street: "FLOP" }),
      action({ handId, action: "FOLD", amount: 0, street: "FLOP" }),
    ];
    for (let i = 1; i <= 5; i++) {
      memory.observe(hand(i));
      memory.observe(hand(i));
    }
    expect(memory.read(1).responseSamples).toBe(5);
    expect(memory.read(1).foldAdjustment).toBe(0);
    for (let i = 6; i <= 70; i++) memory.observe(hand(i));
    expect(memory.read(1).responseSamples).toBe(70);
    expect(memory.read(1).foldAdjustment).toBeGreaterThan(0.1);
    expect(new OpponentMemory().read(1).responseSamples).toBe(0);
  });
  it("does not confuse normal preflop folds with a postflop leak", () => {
    const memory = new OpponentMemory();
    for (let handId = 1; handId <= 80; handId++)
      memory.observe([
        action({ handId, seat: 2, position: "UTG" }),
        action({
          handId,
          position: "HJ",
          action: handId % 5 ? "FOLD" : "CALL",
          amount: handId % 5 ? 0 : 25,
        }),
      ]);
    expect(memory.read(1).responseSamples).toBe(0);
    expect(memory.read(1).foldAdjustment).toBe(0);
    expect(memory.read(1).preflopResponseSamples).toBe(80);
    expect(memory.read(1).preflopFoldAdjustment).toBeCloseTo(0, 5);
  });
});

describe("Joint sampling, real pot share, and legal decisions", () => {
  it("samples compatible independent ranges without bias toward the first seat", () => {
    const makeRange = (first: string, second: string) => ({
      totalWeight: 2,
      combos: [first, second].map((s) => ({
        cards: parseCards(s) as [
          ReturnType<typeof parseCards>[number],
          ReturnType<typeof parseCards>[number],
        ],
        notation: "x",
        weight: 1,
      })),
    });
    const ranges = [makeRange("As Ah", "Ks Kh"), makeRange("As Ad", "Qs Qh")];
    const rng = SeededRng.create(701);
    const samples = ranges.map(makeRangeSampler);
    let firstAce = 0;
    for (let i = 0; i < 6000; i++) {
      const hands = sampleJointHands(samples, new Set(), rng);
      if (hands[0][0].value === 14) firstAce++;
      expect(new Set(hands.flat().map((c) => c.id)).size).toBe(4);
    }
    expect(firstAce / 6000).toBeCloseTo(1 / 3, 1);
  });
  it("settles main pots, side pots and uncalled refunds, and splits ties by actual winner count", () => {
    expect(
      showdownPayout(
        [100, 300, 300, 50],
        [true, true, true, false],
        [10, 9, 8, 0],
      ),
    ).toBe(350);
    expect(showdownPayout([300, 100], [true, true], [8, 10])).toBe(200);
    expect(
      showdownPayout(
        [100, 100, 100, 100],
        [true, true, true, true],
        [10, 10, 10, 10],
      ),
    ).toBe(100);
  });
  it("counts a four-way board tie as 1/4 and ignores private cards in range search", () => {
    const { c } = context("2h 3h", "As Ks Qs Js Ts");
    c.opponents = [1, 2, 3].map((seat) => ({
      id: `p${seat}`,
      seat,
      position: "BB",
      currentBet: 0,
      totalBetThisHand: 100,
      stack: 900,
      allIn: false,
    }));
    c.activePlayers = 4;
    c.potSize = 400;
    const memory = new OpponentMemory();
    const result = searchDecisions(
      c,
      c.opponents,
      c.opponents.map((o) => inferRange(c, o, memory)),
      memory,
      [{ action: "CHECK" }],
      SeededRng.create(101),
      120,
    );
    expect(result.equity).toBe(0.25);
    expect(result.candidates[0].ev).toBe(100);
  });
  it("value bets the unbeatable river nuts and folds air to a large value-heavy bet", () => {
    const nuts = context();
    const value = new ExpertStrategy({
      seed: 74,
      simulations: 1000,
    }).decideAction(nuts.c);
    expect(["BET", "RAISE", "ALL_IN"]).toContain(value.action);
    const air = context("7c 2d", "Ah Kh Qh Jh 9c", 400);
    air.c.previousActions = [
      action({ street: "RIVER", action: "BET", amount: 400, potBefore: 200 }),
    ];
    expect(
      new ExpertStrategy({ seed: 71, simulations: 1000 }).decideAction(air.c)
        .action,
    ).toBe("FOLD");
  });
  it.each([1, 2, 3, 4, 5])(
    "style %s emits legal amounts against extreme sizes and short stacks",
    (styleIndex) => {
      const { c, state } = context("Ah Ad", "Kh 9d 7h 4c 2s", 400);
      state.players[0].stack = 23;
      const short = buildBotContext(state, 0);
      const decision = new ExpertStrategy({
        styleIndex,
        seed: 43,
        simulations: 150,
      }).decideAction(short);
      expect(
        ActionValidator.validate(
          state.players[0],
          { type: decision.action, amount: decision.amount },
          state.currentBet,
          state.lastRaiseAmount,
          10,
        ).valid,
      ).toBe(true);
      expect(c.opponents).toHaveLength(1);
    },
  );
});
