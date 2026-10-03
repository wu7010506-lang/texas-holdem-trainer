import { GameState } from "../../engine/types";

export interface Settlement {
  won: number;
  returned: number;
}

/** An unmatched all-in is a refund, not a won pot. The engine's payout includes both. */
export function getSettlements(state: GameState): Map<string, Settlement> {
  const payouts = new Map<string, number>();
  state.winners?.forEach((winner) =>
    payouts.set(
      winner.playerId,
      (payouts.get(winner.playerId) ?? 0) + winner.amount,
    ),
  );
  const result = new Map<string, Settlement>();
  for (const player of state.players) {
    const payout = payouts.get(player.id) ?? 0;
    if (!payout) continue;
    const matched = Math.max(
      0,
      ...state.players
        .filter((other) => other.id !== player.id)
        .map((other) => other.totalBetThisHand),
    );
    const returned = Math.min(
      payout,
      Math.max(0, player.totalBetThisHand - matched),
    );
    result.set(player.id, { won: payout - returned, returned });
  }
  return result;
}
