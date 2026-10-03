import { Card } from "../../engine/types";
import { PreflopRanges } from "../PreflopRanges";

export interface PreflopNode {
  position: string;
  raiserPosition: string;
  raises: number;
  callers: number;
  toCallBB: number;
  effectiveBB: number;
}
export interface Frequencies {
  raise: number;
  call: number;
  fold: number;
}
const list = (s: string) => new Set(s.split(" "));
const early = list(
  "AA KK QQ JJ TT 99 88 77 66 55 AKo AQo AJo KQo AKs AQs AJs ATs A9s A8s A5s A4s KQs KJs KTs QJs QTs JTs T9s 98s",
);
const middle = list("44 33 22 ATo KJo QJo A7s A6s A3s A2s K9s Q9s J9s 87s 76s");
const cutoff = list("KTo QTo JTo A9o K8s K7s Q8s J8s T8s 97s 86s 65s 54s");
const button = list(
  "A8o A7o A6o A5o A4o A3o A2o K9o Q9o J9o T9o K6s K5s K4s K3s K2s Q7s Q6s J7s T7s 96s 85s 75s 64s 53s",
);

export function openFrequency(notation: string, position: string): number {
  if (position === "BTN/SB") position = "SB";
  if (early.has(notation)) return 1;
  if (
    ["HJ", "CO", "BTN", "SB", "BB"].includes(position) &&
    middle.has(notation)
  )
    return 1;
  if (["CO", "BTN", "SB", "BB"].includes(position) && cutoff.has(notation))
    return 0.9;
  if (["BTN", "SB", "BB"].includes(position) && button.has(notation))
    return position === "SB" ? 0.6 : 0.85;
  return 0;
}

/** Handcrafted blueprint, NOT a solved equilibrium. Frequencies also seed action likelihoods. */
export function preflopFrequencies(
  cards: Card[],
  node: PreflopNode,
): Frequencies {
  if (node.position === "BTN/SB") node = { ...node, position: "SB" };
  const notation = PreflopRanges.getHandNotation(cards[0], cards[1]);
  const high = Math.max(cards[0].value, cards[1].value);
  const low = Math.min(cards[0].value, cards[1].value);
  const pair = high === low;
  const suited = cards[0].suit === cards[1].suit;
  const lateRaiser = ["CO", "BTN", "SB", "BB"].includes(node.raiserPosition);
  const inPosition = ["BTN", "CO"].includes(node.position);
  const premium = ["AA", "KK", "QQ", "AKs"].includes(notation);
  const wheel = suited && high === 14 && low >= 2 && low <= 5;
  let raise = 0,
    call = 0;
  if (!node.raises) {
    raise = openFrequency(notation, node.position);
    if (node.callers && !premium) raise *= 0.8;
    if (
      node.callers &&
      suited &&
      high - low <= 2 &&
      low >= 5 &&
      node.effectiveBB >= 35
    )
      call = (1 - raise) * 0.45;
  } else if (node.raises === 1) {
    if (premium) raise = 1;
    else if (["JJ", "AKo", "AQs"].includes(notation)) {
      raise = lateRaiser ? 0.85 : 0.55;
      call = 1 - raise;
    } else if (wheel) {
      raise = lateRaiser ? 0.45 : 0.2;
      call = inPosition || node.position === "BB" ? 0.3 : 0.1;
    } else if (
      (pair && high >= (lateRaiser ? 8 : 9)) ||
      (suited && high >= 12 && low >= 10)
    ) {
      raise = lateRaiser ? 0.3 : 0.1;
      call = 0.85 - raise;
    } else if (
      (pair && node.effectiveBB >= 40 && node.toCallBB <= 4) ||
      (suited && high - low <= 2 && low >= 6) ||
      (suited && high === 14) ||
      ["AQo", "AJs", "ATs", "KQo"].includes(notation)
    ) {
      call =
        inPosition || node.position === "BB" ? (lateRaiser ? 0.85 : 0.6) : 0.25;
    } else if (node.position === "BB" && lateRaiser && node.toCallBB <= 2.5)
      call = openFrequency(notation, "BTN") * 0.7;
    // Cold callers tighten value range and discourage marginal flats.
    if (node.callers && !premium) {
      call *= 0.75;
      if (!wheel) raise *= 0.85;
    }
    if (node.position === "SB" && !premium) {
      raise += call * 0.45;
      call *= 0.15;
    }
  } else if (node.raises === 2) {
    if (["AA", "KK"].includes(notation)) raise = 1;
    else if (["QQ", "AKs", "AKo"].includes(notation)) {
      raise = 0.55;
      call = 0.45;
    } else if (["JJ", "TT", "AQs", "KQs"].includes(notation))
      call = inPosition ? 0.85 : 0.65;
    else if (wheel && node.toCallBB < 15 && node.effectiveBB > 60) {
      raise = 0.18;
      call = inPosition ? 0.2 : 0;
    } else if (
      suited &&
      high >= 11 &&
      low >= 9 &&
      inPosition &&
      node.toCallBB <= 8
    )
      call = 0.35;
  } else {
    if (["AA", "KK"].includes(notation)) raise = 1;
    else if (["QQ", "AKs"].includes(notation)) {
      raise = 0.4;
      call = 0.5;
    } else if (["JJ", "AKo"].includes(notation)) call = lateRaiser ? 0.45 : 0.2;
  }
  // Expensive/deep calls must pass equity search rather than blindly following a chart.
  if (node.toCallBB > 5 && !premium) {
    const price = Math.min(1, 5 / node.toCallBB);
    if (node.raises === 1) {
      call *= price;
      if (!pair && high < 14) raise *= price;
    }
  }
  if (node.effectiveBB < 25 && pair && high >= 7 && node.raises <= 1)
    raise = Math.max(raise, 0.65);
  call = Math.min(call, 1 - raise);
  return { raise, call, fold: Math.max(0, 1 - raise - call) };
}
