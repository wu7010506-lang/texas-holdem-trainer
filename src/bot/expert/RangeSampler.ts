import { Card } from "../../engine/types";
import { OpponentRange } from "../OpponentRangeModel";

export function makeRangeSampler(range: OpponentRange) {
  const cumulative: number[] = [];
  let total = 0;
  for (const c of range.combos) {
    total += c.weight;
    cumulative.push(total);
  }
  if (total <= 0) throw new Error("Empty opponent range");
  return (rng: () => number): [Card, Card] => {
    const value = rng() * total;
    let low = 0,
      high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (cumulative[mid] < value) low = mid + 1;
      else high = mid;
    }
    return range.combos[low].cards;
  };
}

/** Independent weighted proposals + whole-tuple rejection preserve the joint range distribution.
 * Sequentially conditioning only later seats would bias results according to seat order. */
export function sampleJointHands(
  samplers: ReturnType<typeof makeRangeSampler>[],
  known: Set<string>,
  rng: () => number,
): [Card, Card][] {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const hands = samplers.map((sample) => sample(rng));
    const used = new Set(known);
    let valid = true;
    for (const hand of hands)
      for (const c of hand) {
        if (used.has(c.id)) {
          valid = false;
          break;
        }
        used.add(c.id);
      }
    if (valid) return hands;
  }
  throw new Error("Unable to sample compatible joint ranges");
}
