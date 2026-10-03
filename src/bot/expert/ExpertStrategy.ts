import { ActionRecord } from "../../engine/types";
import { BotDecision, BotDecisionContext } from "../types";
import { BotStrategy } from "../strategies/BotStrategy";
import { clampBotDecision } from "../clampBotDecision";
import { OpponentMemory } from "./OpponentMemory";
import { inferRange } from "./RangeInference";
import { readPublicHistory } from "./PublicHistory";
import { preflopFrequencies } from "./PreflopPolicy";
import { searchDecisions } from "./DecisionSearch";
import { SeededRng } from "../strategies/elite/random/SeededRng";

export const EXPERT_STYLES = [
  { id: "expert-balanced", sizing: 0.65, aggression: 1 },
  { id: "expert-pressure", sizing: 0.85, aggression: 1.06 },
  { id: "expert-positional", sizing: 0.55, aggression: 0.98 },
  { id: "expert-polarized", sizing: 1.1, aggression: 1.02 },
  { id: "expert-adaptive", sizing: 0.75, aggression: 1 },
] as const;

export class ExpertStrategy implements BotStrategy {
  name = "Expert";
  version = "1.0";
  private memory = new OpponentMemory();
  private rng: () => number;
  private simulations: number;
  private style: (typeof EXPERT_STYLES)[number];

  constructor(
    options: { styleIndex?: number; seed?: number; simulations?: number } = {},
  ) {
    this.rng = SeededRng.create(options.seed);
    this.simulations = options.simulations ?? 900;
    this.style =
      EXPERT_STYLES[(options.styleIndex ?? 0) % EXPERT_STYLES.length];
  }
  observe(history: ActionRecord[]): void {
    this.memory.observe(history);
  }

  decideAction(context: BotDecisionContext): BotDecision {
    this.observe(context.previousActions);
    return clampBotDecision(this.decide(context), context.legalActions);
  }

  private decide(c: BotDecisionContext): BotDecision {
    if (!c.opponents?.length)
      throw new Error("Expert strategy requires public opponent metadata");
    const legal = c.legalActions;
    const base = (): BotDecision => ({
      action: legal.canCheck ? "CHECK" : "FOLD",
      reasoning: "Expert baseline",
    });
    const observations = readPublicHistory(c.previousActions).filter(
      (a) => a.record.street === "PREFLOP",
    );
    const raises = observations.filter((a) => a.aggressive);
    const lastRaise = raises.at(-1);
    const callers = observations.filter(
      (a) =>
        !a.blind &&
        !a.aggressive &&
        a.record.action === "CALL" &&
        (!lastRaise ||
          observations.indexOf(a) > observations.indexOf(lastRaise)),
    ).length;
    const ownTotal = (c.ownCurrentBet ?? 0) + c.playerStack;
    const effectiveBB =
      Math.min(
        ownTotal,
        Math.max(...c.opponents.map((o) => o.stack + o.currentBet)),
      ) / c.bigBlind;
    const node = {
      position: c.position,
      raiserPosition: lastRaise?.record.position ?? "UTG",
      raises: raises.length,
      callers,
      toCallBB: legal.callAmount / c.bigBlind,
      effectiveBB,
    };
    const frequencies = preflopFrequencies(c.holeCards, node);
    const outOfPosition = c.position === "SB" || c.position === "BB";
    let raiseSize: number;
    if (!raises.length)
      raiseSize = c.bigBlind * ((outOfPosition ? 3 : 2.5) + callers);
    else if (raises.length === 1)
      raiseSize = c.currentBet * ((outOfPosition ? 4 : 3) + callers);
    else raiseSize = c.currentBet * (outOfPosition ? 2.5 : 2.2);
    const normalPreflop =
      c.street === "PREFLOP" &&
      legal.callAmount <= 6 * c.bigBlind &&
      raises.length <= 1 &&
      effectiveBB > 25 &&
      c.currentBet <= 8 * c.bigBlind;
    if (normalPreflop) {
      let raiseProbability = frequencies.raise * this.style.aggression;
      if (c.position === "BTN" || c.position === "CO") {
        const overfold =
          c.opponents.reduce(
            (sum, o) => sum + this.memory.read(o.seat).preflopFoldAdjustment,
            0,
          ) / c.opponents.length;
        if (c.holeCards.some((card) => card.value === 14))
          raiseProbability += Math.max(0, overfold) * 0.3;
      }
      const roll = this.rng();
      if (roll < raiseProbability && (legal.canRaise || legal.canBet))
        return {
          action: legal.canRaise ? "RAISE" : "BET",
          amount: raiseSize,
          reasoning: "Position-aware mixed preflop range",
          reasonCodes: ["EXPERT_PREFLOP"],
        };
      if (
        roll < Math.min(1, raiseProbability + frequencies.call) &&
        legal.canCall
      )
        return {
          action: "CALL",
          reasoning: "Preflop range defense",
          reasonCodes: ["EXPERT_PREFLOP"],
        };
      return base();
    }
    const actions: Pick<BotDecision, "action" | "amount">[] = [
      { action: legal.canCheck ? "CHECK" : "FOLD" },
    ];
    if (legal.canCall)
      actions.push({ action: "CALL", amount: legal.callAmount });
    const addRaise = (amount: number) => {
      if (!legal.canRaise && !legal.canBet) return;
      const min = legal.canBet ? legal.minBet : legal.minRaise;
      const max = legal.canBet ? legal.maxBet : legal.maxRaise;
      const size = Math.round(Math.max(min, Math.min(max, amount)));
      if (!actions.some((a) => a.amount === size && a.action !== "CALL"))
        actions.push({
          action:
            size === legal.allInAmount
              ? "ALL_IN"
              : legal.canBet
                ? "BET"
                : "RAISE",
          amount: size,
        });
    };
    if (c.street === "PREFLOP") {
      if (frequencies.raise > 0.1) {
        addRaise(raiseSize);
        if (
          effectiveBB <= 30 ||
          raises.length >= 3 ||
          raiseSize > ownTotal * 0.4
        )
          addRaise(legal.allInAmount);
      }
    } else {
      const potAfterCall = c.potSize + legal.callAmount;
      for (const fraction of [0.33, this.style.sizing, 1.1])
        addRaise(c.currentBet + Math.max(c.bigBlind, potAfterCall * fraction));
      if (c.spr <= 3) addRaise(legal.allInAmount);
    }
    const ranges = c.opponents.map((o) => inferRange(c, o, this.memory));
    const result = searchDecisions(
      c,
      c.opponents,
      ranges,
      this.memory,
      actions,
      this.rng,
      this.simulations,
    );
    const sorted = [...result.candidates].sort((a, b) => b.ev - a.ev);
    const best = sorted[0];
    // Mix only among near-best positive choices, avoiding a fixed sizing tell.
    const tolerance = Math.max(c.bigBlind * 0.15, c.potSize * 0.012);
    const nearby = sorted.filter(
      (a) => a.ev >= best.ev - tolerance && (a.ev >= 0 || a.action === "FOLD"),
    );
    const selected =
      nearby[
        Math.min(nearby.length - 1, Math.floor(this.rng() * nearby.length))
      ] ?? best;
    return {
      action: selected.action,
      amount: selected.amount,
      reasoning: "Joint-range response search",
      reasonCodes: ["EXPERT_RANGE_SEARCH"],
      debugTrace: {
        strategy: this.name,
        style: this.style.id,
        equity: result.equity,
        trials: result.trials,
        candidates: result.candidates,
        rangeSizes: ranges.map((r) => r.combos.length),
        opponentReads: c.opponents.map((o) => ({
          seat: o.seat,
          ...this.memory.read(o.seat),
        })),
      },
    };
  }
}
