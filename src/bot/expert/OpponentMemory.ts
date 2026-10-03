import { ActionRecord } from "../../engine/types";
import { readPublicHistory } from "./PublicHistory";

interface Counts {
  responses: number;
  folds: number;
  calls: number;
  raises: number;
  hands: number;
  shoves: number;
  voluntary: number;
  preResponses: number;
  preFolds: number;
  preExpectedFolds: number;
}
export interface OpponentRead {
  foldAdjustment: number;
  preflopFoldAdjustment: number;
  looseness: number;
  shoveRate: number;
  responseSamples: number;
  preflopResponseSamples: number;
  handSamples: number;
}

/** Each seat owns its own memory. Only public betting records are accepted. */
export class OpponentMemory {
  private counts = new Map<number, Counts>();
  private processed = new Map<number, number>();
  private voluntary = new Set<string>();
  private shoves = new Set<string>();
  private seenHands = new Set<string>();

  observe(history: ActionRecord[]): void {
    const observations = readPublicHistory(history);
    for (let i = 0; i < observations.length; i++) {
      const a = observations[i],
        r = a.record;
      if (i < (this.processed.get(r.handId) ?? 0)) continue;
      const key = `${r.handId}:${r.seat}`;
      let stats = this.counts.get(r.seat);
      if (!stats) {
        stats = {
          responses: 0,
          folds: 0,
          calls: 0,
          raises: 0,
          hands: 0,
          shoves: 0,
          voluntary: 0,
          preResponses: 0,
          preFolds: 0,
          preExpectedFolds: 0,
        };
        this.counts.set(r.seat, stats);
      }
      if (!this.seenHands.has(key)) {
        stats.hands++;
        this.seenHands.add(key);
      }
      if (a.blind) continue;
      if (a.toCall > 0 && r.street !== "PREFLOP") {
        stats.responses++;
        if (r.action === "FOLD") stats.folds++;
        else if (a.aggressive) stats.raises++;
        else stats.calls++;
      }
      if (r.street === "PREFLOP") {
        if (a.toCall > 0 && a.raisesBefore > 0) {
          const blind =
            r.position === "SB" ||
            r.position === "BB" ||
            r.position === "BTN/SB";
          const steal = ["CO", "BTN", "SB", "BTN/SB"].includes(
            a.lastRaiserPosition,
          );
          stats.preResponses++;
          if (r.action === "FOLD") stats.preFolds++;
          stats.preExpectedFolds +=
            a.raisesBefore >= 2
              ? 0.6
              : blind && steal
                ? 0.5
                : steal
                  ? 0.72
                  : 0.8;
        }
        if ((a.aggressive || r.action === "CALL") && !this.voluntary.has(key)) {
          stats.voluntary++;
          this.voluntary.add(key);
        }
        if (a.aggressive && r.action === "ALL_IN" && !this.shoves.has(key)) {
          stats.shoves++;
          this.shoves.add(key);
        }
      }
    }
    if (history.length) this.processed.set(history[0].handId, history.length);
    // Session memory remains bounded even during extended training.
    if (this.processed.size > 80) {
      const oldest = this.processed.keys().next().value!;
      this.processed.delete(oldest);
      for (const set of [this.voluntary, this.shoves, this.seenHands])
        for (const key of set)
          if (key.startsWith(`${oldest}:`)) set.delete(key);
    }
  }

  read(seat: number): OpponentRead {
    const s = this.counts.get(seat);
    if (!s)
      return {
        foldAdjustment: 0,
        preflopFoldAdjustment: 0,
        looseness: 0,
        shoveRate: 0.02,
        responseSamples: 0,
        preflopResponseSamples: 0,
        handSamples: 0,
      };
    const fold = (s.folds + 24 * 0.42) / (s.responses + 24);
    const vpip = (s.voluntary + 24 * 0.26) / (s.hands + 24);
    // No exploit after just a few actions; bounded influence even with many samples.
    return {
      preflopFoldAdjustment:
        s.preResponses < 12
          ? 0
          : Math.max(
              -0.18,
              Math.min(
                0.18,
                (((s.preFolds - s.preExpectedFolds) / (s.preResponses + 24)) *
                  s.preResponses) /
                  (s.preResponses + 60),
              ),
            ),
      foldAdjustment:
        s.responses < 12
          ? 0
          : Math.max(
              -0.18,
              Math.min(
                0.18,
                ((fold - 0.42) * s.responses) / (s.responses + 60),
              ),
            ),
      looseness:
        s.hands < 12
          ? 0
          : Math.max(
              -0.3,
              Math.min(0.55, ((vpip - 0.26) * s.hands) / (s.hands + 40)),
            ),
      shoveRate: (s.shoves + 24 * 0.02) / (s.hands + 24),
      responseSamples: s.responses,
      preflopResponseSamples: s.preResponses,
      handSamples: s.hands,
    };
  }
}
