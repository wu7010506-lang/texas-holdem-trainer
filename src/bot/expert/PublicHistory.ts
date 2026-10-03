import { ActionRecord, Street } from "../../engine/types";

export interface ObservedAction {
  record: ActionRecord;
  blind: boolean;
  aggressive: boolean;
  toCall: number;
  raisesBefore: number;
  callersBefore: number;
  lastRaiserPosition: string;
  currentBetBefore: number;
  ownBetBefore: number;
  target: number;
}

/** Replays chip commitments. CALL amounts are increments; RAISE/ALL_IN are totals. */
export function readPublicHistory(history: ActionRecord[]): ObservedAction[] {
  let street: Street | undefined;
  let currentBet = 0;
  let raises = 0;
  let callers = 0;
  let lastRaiserPosition = "UTG";
  const bets = new Map<number, number>();
  return history.map((record) => {
    if (street !== record.street) {
      street = record.street;
      currentBet = 0;
      raises = 0;
      callers = 0;
      bets.clear();
    }
    const own = bets.get(record.seat) ?? 0;
    const blind =
      record.reasoning === "Small Blind" || record.reasoning === "Big Blind";
    const target =
      record.action === "CALL"
        ? own + record.amount
        : ["BET", "RAISE", "ALL_IN"].includes(record.action)
          ? record.amount
          : own;
    const aggressive = !blind && target > currentBet;
    const result = {
      record,
      blind,
      aggressive,
      toCall: Math.max(0, currentBet - own),
      raisesBefore: raises,
      callersBefore: callers,
      lastRaiserPosition,
      currentBetBefore: currentBet,
      ownBetBefore: own,
      target,
    };
    if (aggressive) {
      raises++;
      callers = 0;
      lastRaiserPosition = record.position ?? "UTG";
    } else if (
      !blind &&
      (record.action === "CALL" || record.action === "ALL_IN")
    )
      callers++;
    bets.set(record.seat, target);
    currentBet = Math.max(currentBet, target);
    return result;
  });
}
