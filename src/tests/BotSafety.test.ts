import { describe, expect, it } from "vitest";
import { clampBotDecision } from "../bot/clampBotDecision";
import { ActionValidator } from "../engine/ActionValidator";
import { DEFAULT_CONFIG } from "../store/usePokerStore";
import { PokerGame } from "../engine/PokerGame";
import { BotController } from "../bot/BotController";
import { ApexStrategy } from "../bot/strategies/apex/ApexStrategy";
import { HeroModel } from "../bot/strategies/apex/model/HeroModel";
import { BotDecision } from "../bot/types";
import { RangeEquityEvaluator } from "../bot/strategies/elite/equity/RangeEquityEvaluator";
import { HandRange } from "../bot/strategies/elite/range/WeightedCombo";
import { createCard } from "../engine/Card";

describe("Bot output safety", () => {
  const player = new PokerGame(DEFAULT_CONFIG).getState().players[0];
  const legal = ActionValidator.getLegalActions(player, 100, 500, 10);
  it.each<BotDecision>([
    { action: "RAISE", amount: 320, reasoning: "" },
    { action: "RAISE", amount: Infinity, reasoning: "" },
    { action: "BET", amount: NaN, reasoning: "" },
    { action: "CALL", amount: 9000, reasoning: "" },
    { action: "CHECK", reasoning: "" },
    { action: "ALL_IN", amount: -1, reasoning: "" },
  ])("returns a legal bounded decision for $action / $amount", (decision) => {
    const output = clampBotDecision(decision, legal);
    expect(
      ActionValidator.validate(
        player,
        { type: output.action, amount: output.amount },
        100,
        500,
        10,
      ).valid,
    ).toBe(true);
    if (output.action === "RAISE")
      expect(output.amount).toBeGreaterThanOrEqual(600);
    if (output.action === "CALL") expect(output.amount).toBe(100);
    if (output.amount !== undefined)
      expect(Number.isFinite(output.amount)).toBe(true);
  });

  it("limits a short-stack call to the available chips", () => {
    const short = { ...player, stack: 20 };
    const limits = ActionValidator.getLegalActions(short, 100, 90, 10);
    expect(
      clampBotDecision({ action: "CALL", amount: 100, reasoning: "" }, limits)
        .amount,
    ).toBe(20);
  });

  it("clamps an Apex preflop exploit before its early return reaches the caller", () => {
    const game = new PokerGame(DEFAULT_CONFIG);
    const state = game.startNewHand();
    const bot = state.players[3];
    bot.stack = 1000;
    bot.currentBet = 0;
    state.currentBet = 100;
    state.lastRaiseAmount = 500;
    state.minimumRaise = 600;
    const context = new BotController().buildContext(state, 3);
    const model = new HeroModel();
    Object.assign(model.getPreflopStats("BTN").facingThreeBetFold, {
      count: 100,
      opportunities: 100,
    });
    const strategy = new ApexStrategy(model);
    strategy.setRng(() => 0.5);
    const decision = strategy.decideAction(context);
    expect(decision.reasonCodes).toContain("EXPLOIT_PRE_FLOP_OVERFOLD");
    expect(decision.action).toBe("RAISE");
    expect(decision.amount).toBe(600);
    expect(
      ActionValidator.validate(
        bot,
        { type: decision.action, amount: decision.amount },
        100,
        500,
        10,
      ).valid,
    ).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity])(
    "rejects non-finite chip amounts (%s) at the engine boundary",
    (amount) => {
      expect(
        ActionValidator.validate(player, { type: "BET", amount }, 0, 10, 10)
          .valid,
      ).toBe(false);
    },
  );
});

describe("Unified range pot share equity", () => {
  const board = [
    createCard("A", "s"),
    createCard("K", "s"),
    createCard("Q", "s"),
    createCard("J", "s"),
    createCard("T", "s"),
  ];
  const cards = [createCard("2", "h"), createCard("3", "h")];
  it("counts a four-player board tie as one quarter, including the Elite path", () => {
    const result = RangeEquityEvaluator.calculate(
      cards,
      new HandRange(),
      board,
      100,
      3,
    );
    expect(result.tieRate).toBe(1);
    expect(result.equity).toBeCloseTo(0.25, 4);
  });

  it("distinguishes ranges with identical combo counts and respects their weights", () => {
    const river = [
      createCard("K", "c"),
      createCard("9", "d"),
      createCard("7", "h"),
      createCard("4", "c"),
      createCard("2", "s"),
    ];
    const hero = [createCard("K", "h"), createCard("Q", "h")];
    const weak: [ReturnType<typeof createCard>, ReturnType<typeof createCard>] =
      [createCard("J", "h"), createCard("T", "h")];
    const strong: typeof weak = [createCard("A", "h"), createCard("A", "d")];
    const weighted = new HandRange([
      { cards: weak, weight: 0.9 },
      { cards: strong, weight: 0.1 },
    ]);
    const reversed = new HandRange([
      { cards: weak, weight: 0.1 },
      { cards: strong, weight: 0.9 },
    ]);
    expect(
      RangeEquityEvaluator.calculate(hero, weighted, river).equity,
    ).toBeCloseTo(0.9, 3);
    expect(
      RangeEquityEvaluator.calculate(hero, reversed, river).equity,
    ).toBeCloseTo(0.1, 3);
  });
});
