import { Card } from "../../engine/types";
import { Deck } from "../../engine/Deck";
import { BotDecision, BotDecisionContext, PublicOpponent } from "../types";
import { OpponentRange } from "../OpponentRangeModel";
import { OpponentMemory } from "./OpponentMemory";
import { continueProbability, handFeatures } from "./HandFeatures";
import { fastHandScore } from "./FastHandEvaluator";
import { makeRangeSampler, sampleJointHands } from "./RangeSampler";

interface Trial {
  scores: number[];
  hands: [Card, Card][];
  responses: number[];
  reraises: number[];
  heroShare: number;
}
export interface CandidateScore {
  action: BotDecision["action"];
  amount?: number;
  ev: number;
  standardError: number;
}
export interface SearchResult {
  candidates: CandidateScore[];
  equity: number;
  trials: number;
}

/** Real main/side-pot payout. Folded money participates in pots but cannot win. */
export function showdownPayout(
  contributions: number[],
  eligible: boolean[],
  scores: number[],
  heroIndex = 0,
): number {
  const levels = [...new Set(contributions.filter((v) => v > 0))].sort(
    (a, b) => a - b,
  );
  let previous = 0,
    payout = 0;
  for (const level of levels) {
    const contributors = contributions
      .map((v, i) => (v >= level ? i : -1))
      .filter((i) => i >= 0);
    const contenders = contributors.filter((i) => eligible[i]);
    const amount = (level - previous) * contributors.length;
    if (contenders.includes(heroIndex)) {
      const best = Math.max(...contenders.map((i) => scores[i]));
      const winners = contenders.filter((i) => scores[i] === best);
      if (winners.includes(heroIndex)) payout += amount / winners.length;
    }
    previous = level;
  }
  return payout;
}

/** One betting response + simultaneous runout, with a conservative future-street realization model.
 * This is a finite search against estimated response policies, NOT a full game-tree solver. */
export function searchDecisions(
  context: BotDecisionContext,
  opponents: PublicOpponent[],
  ranges: OpponentRange[],
  memory: OpponentMemory,
  actions: Pick<BotDecision, "action" | "amount">[],
  rng: () => number,
  simulations: number,
): SearchResult {
  const known = new Set(
    [...context.holeCards, ...context.communityCards].map((c) => c.id),
  );
  const available = new Deck().getCards().filter((c) => !known.has(c.id));
  const samplers = ranges.map(makeRangeSampler);
  const foldAdjustments = opponents.map((o) => {
    const read = memory.read(o.seat);
    return context.street === "PREFLOP"
      ? read.preflopFoldAdjustment
      : read.foldAdjustment;
  });
  const own = handFeatures(context.holeCards, context.communityCards);
  const trials: Trial[] = [];
  for (let i = 0; i < simulations; i++) {
    const hands = sampleJointHands(samplers, known, rng);
    const unavailable = new Set(hands.flat().map((c) => c.id));
    const pool = available.filter((c) => !unavailable.has(c.id));
    const board = [...context.communityCards];
    while (board.length < 5) {
      const index = Math.floor(rng() * pool.length);
      board.push(pool[index]);
      pool[index] = pool[pool.length - 1];
      pool.pop();
    }
    const scores = [
      fastHandScore([...context.holeCards, ...board]),
      ...hands.map((h) => fastHandScore([...h, ...board])),
    ];
    const best = Math.max(...scores),
      ties = scores.filter((s) => s === best).length;
    trials.push({
      hands,
      scores,
      responses: opponents.map(() => rng()),
      reraises: opponents.map(() => rng()),
      heroShare: scores[0] === best ? 1 / ties : 0,
    });
  }
  const features = trials.map((t) =>
    t.hands.map((h) => handFeatures(h, context.communityCards)),
  );
  const ownBet = context.ownCurrentBet ?? 0,
    ownTotal = context.ownTotalBet ?? ownBet;
  const dead = context.foldedContributions ?? [];
  const inPosition = opponents.every((o) => {
    const rank = (pos: string) =>
      ["SB", "BB", "UTG", "HJ", "CO", "BTN"].indexOf(pos);
    return rank(context.position) > rank(o.position);
  });
  const candidates = actions.map((action): CandidateScore => {
    if (action.action === "FOLD") return { ...action, ev: 0, standardError: 0 };
    const aggressive =
      ["BET", "RAISE", "ALL_IN"].includes(action.action) &&
      (action.amount ?? 0) > context.currentBet;
    const target =
      action.action === "CHECK"
        ? ownBet
        : action.action === "CALL"
          ? ownBet + context.legalActions.callAmount
          : (action.amount ?? ownBet);
    const investment = Math.min(
      context.playerStack,
      Math.max(0, target - ownBet),
    );
    let sum = 0,
      squared = 0;
    for (let trialIndex = 0; trialIndex < trials.length; trialIndex++) {
      const t = trials[trialIndex];
      const contributions = [
        ownTotal + investment,
        ...opponents.map((o) => o.totalBetThisHand),
        ...dead,
      ];
      const eligible = [
        true,
        ...opponents.map(() => true),
        ...dead.map(() => false),
      ];
      let extraInvestment = investment;
      let raiseTarget = target;
      for (let o = 0; o < opponents.length; o++) {
        const opponent = opponents[o];
        if (opponent.allIn) continue;
        // A bettor does not fold to our call, nor does checking make any opponent fold.
        if (target <= opponent.currentBet) continue;
        const extra = Math.min(opponent.stack, target - opponent.currentBet);
        const price = extra / Math.max(1, context.potSize + investment + extra);
        const feature = features[trialIndex][o];
        const p = continueProbability(feature, price, foldAdjustments[o]);
        if (t.responses[o] > p) {
          eligible[o + 1] = false;
          continue;
        }
        contributions[o + 1] += extra;
        if (aggressive && opponents.length === 1 && opponent.stack > extra) {
          const reraise =
            feature.strength > 0.85
              ? 0.24
              : feature.draw > 0.2
                ? 0.07
                : 0.015 * feature.blocker;
          if (t.reraises[o] < reraise) {
            raiseTarget = Math.min(
              opponent.currentBet + opponent.stack,
              Math.max(context.minimumRaise, target * 2.6),
            );
            const heroExtra = Math.min(
              context.playerStack - investment,
              Math.max(0, raiseTarget - target),
            );
            const callPrice =
              heroExtra /
              Math.max(1, context.potSize + investment + extra + heroExtra * 2);
            // This response uses only our current cards/board, never sampled opponent cards or future board.
            if (own.strength + own.draw * 0.6 < 0.74 + callPrice * 0.35)
              eligible[0] = false;
            else {
              extraInvestment += heroExtra;
              contributions[0] += heroExtra;
            }
            contributions[o + 1] += Math.max(0, raiseTarget - target);
          }
        }
      }
      // Before the river, checking/calling equity may not all be realized; draws and position improve realization.
      const continuing = eligible
        .slice(1, opponents.length + 1)
        .filter(Boolean).length;
      const allCommitted =
        extraInvestment >= context.playerStack ||
        opponents.every(
          (o, i) =>
            !eligible[i + 1] ||
            o.allIn ||
            contributions[i + 1] >= o.totalBetThisHand + o.stack,
        );
      const realization =
        context.street === "RIVER" || allCommitted || continuing === 0
          ? 1
          : Math.min(1, (inPosition ? 0.98 : 0.9) + own.draw * 0.15) *
            (continuing > 1 ? 0.95 ** (continuing - 1) : 1);
      const payout = eligible[0]
        ? showdownPayout(contributions, eligible, [
            ...t.scores,
            ...dead.map(() => 0),
          ])
        : 0;
      const ev = payout * realization - extraInvestment;
      sum += ev;
      squared += ev * ev;
    }
    const ev = sum / simulations;
    const variance = Math.max(
      0,
      (squared - (sum * sum) / simulations) / Math.max(1, simulations - 1),
    );
    return { ...action, ev, standardError: Math.sqrt(variance / simulations) };
  });
  return {
    candidates,
    equity: trials.reduce((sum, t) => sum + t.heroShare, 0) / simulations,
    trials: simulations,
  };
}
