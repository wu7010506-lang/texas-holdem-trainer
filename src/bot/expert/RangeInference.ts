import { Card } from "../../engine/types";
import { BotDecisionContext, PublicOpponent } from "../types";
import { OpponentRange, OpponentRangeModel } from "../OpponentRangeModel";
import { OpponentMemory } from "./OpponentMemory";
import { readPublicHistory } from "./PublicHistory";
import { preflopFrequencies } from "./PreflopPolicy";
import { continueProbability, handFeatures } from "./HandFeatures";

/** Reconditions every opponent separately, using the board available at each recorded action. */
export function inferRange(
  context: BotDecisionContext,
  opponent: PublicOpponent,
  memory: OpponentMemory,
): OpponentRange {
  const dead = new Set(
    [...context.holeCards, ...context.communityCards].map((c) => c.id),
  );
  const actions = readPublicHistory(context.previousActions).filter(
    (a) => a.record.seat === opponent.seat && !a.blind,
  );
  const read = memory.read(opponent.seat);
  const combos = OpponentRangeModel.getAllCombos()
    .filter((c) => !c.cards.some((card) => dead.has(card.id)))
    .map((combo) => {
      let weight = 1;
      for (const a of actions) {
        const r = a.record;
        if (r.action === "FOLD") continue;
        let likelihood: number;
        if (r.street === "PREFLOP") {
          const frequencies = preflopFrequencies(combo.cards, {
            position: r.position ?? opponent.position,
            raiserPosition: a.lastRaiserPosition,
            raises: a.raisesBefore,
            callers: a.callersBefore,
            toCallBB: a.toCall / context.bigBlind,
            effectiveBB: (r.stackBefore + a.ownBetBefore) / context.bigBlind,
          });
          likelihood = a.aggressive
            ? frequencies.raise
            : a.toCall > 0
              ? frequencies.call
              : 1 - frequencies.raise;
          // A persistent shover is allowed to have weak hands, after enough public evidence.
          if (
            a.aggressive &&
            r.action === "ALL_IN" &&
            read.handSamples >= 12 &&
            read.shoveRate > 0.15
          )
            likelihood = likelihood * (1 - read.shoveRate) + read.shoveRate;
          likelihood =
            likelihood * (1 - Math.max(0, read.looseness)) +
            Math.max(0, read.looseness) * 0.35;
        } else {
          const board: Card[] = context.communityCards.slice(
            0,
            r.street === "FLOP" ? 3 : r.street === "TURN" ? 4 : 5,
          );
          const f = handFeatures(combo.cards, board);
          const cost = a.aggressive
            ? Math.max(0, a.target - a.ownBetBefore)
            : Math.min(a.toCall, r.stackBefore);
          const price = cost / Math.max(1, r.potBefore + cost);
          const continuing = continueProbability(f, price, read.foldAdjustment);
          if (a.aggressive) {
            const value = Math.max(0, f.strength - 0.48) * 1.8;
            const bluff =
              (f.draw > 0 ? 0.12 + f.draw : 0.06 + f.blocker * 0.09) *
              (1 - f.strength);
            likelihood = Math.min(0.99, value + bluff);
            if (a.raisesBefore > 0) likelihood *= 0.25 + f.strength * 0.8;
            if (price > 0.4) likelihood *= 0.25 + f.strength;
          } else if (r.action === "CHECK") {
            likelihood = 0.92 - Math.max(0, f.strength - 0.6) * 0.65; // Retain traps.
          } else
            likelihood = continuing * (0.98 - Math.max(0, f.strength - 0.8));
        }
        weight *= Math.max(0.015, likelihood); // Never assert a human has a zero-probability hand.
      }
      return { ...combo, weight };
    });
  const max = Math.max(...combos.map((c) => c.weight), 1e-30);
  for (const c of combos) c.weight /= max;
  return { combos, totalWeight: combos.reduce((sum, c) => sum + c.weight, 0) };
}
