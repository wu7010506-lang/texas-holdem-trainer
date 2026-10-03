import { LegalActions } from "../engine/types";
import { BotDecision } from "./types";

/** All strategies pass through this boundary, including preflop and baseline early returns. */
export function clampBotDecision(
  decision: BotDecision,
  legal: LegalActions,
): BotDecision {
  const safe = (): BotDecision => {
    if (legal.canCheck)
      return { ...decision, action: "CHECK", amount: undefined };
    if (legal.canFold)
      return { ...decision, action: "FOLD", amount: undefined };
    if (legal.canCall)
      return { ...decision, action: "CALL", amount: legal.callAmount };
    throw new Error("No legal action is available for this player.");
  };
  let result: BotDecision;
  const finite =
    decision.amount !== undefined && Number.isFinite(decision.amount);
  switch (decision.action) {
    case "CHECK":
      result = legal.canCheck ? { ...decision, amount: undefined } : safe();
      break;
    case "FOLD":
      result = legal.canFold ? { ...decision, amount: undefined } : safe();
      break;
    case "CALL":
      result = legal.canCall
        ? { ...decision, amount: legal.callAmount }
        : safe();
      break;
    case "ALL_IN":
      result = legal.canAllIn
        ? { ...decision, amount: legal.allInAmount }
        : safe();
      break;
    case "BET":
    case "RAISE": {
      const bet = decision.action === "BET";
      if (!(bet ? legal.canBet : legal.canRaise)) {
        result = safe();
        break;
      }
      const min = bet ? legal.minBet : legal.minRaise;
      const max = bet ? legal.maxBet : legal.maxRaise;
      result = {
        ...decision,
        amount: Math.max(
          min,
          Math.min(max, finite ? Math.round(decision.amount!) : min),
        ),
      };
      break;
    }
    default:
      result = safe();
  }
  if (result.debugTrace) {
    result.debugTrace = { ...result.debugTrace };
    if ("finalAction" in result.debugTrace)
      result.debugTrace.finalAction = result.action;
    if ("finalAmount" in result.debugTrace)
      result.debugTrace.finalAmount = result.amount;
    if ("selectedAction" in result.debugTrace)
      result.debugTrace.selectedAction = `${result.action}${result.amount === undefined ? "" : ` (${result.amount})`}`;
  }
  return result;
}
