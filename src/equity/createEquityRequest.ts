import { GameState } from "../engine/types";
import { EquityCalculationRequest } from "../bot/EquityCalculator";

/** Explicit allowlist: the worker never receives another player's cards or the game/deck. */
export function createEquityRequest(
  state: GameState,
  heroSeat: number,
): EquityCalculationRequest | null {
  const hero = state.players[heroSeat];
  if (!hero || hero.folded || hero.holeCards.length !== 2 || state.handComplete)
    return null;
  return {
    heroHoleCards: hero.holeCards.map((card) => ({ ...card })),
    communityCards: state.communityCards.map((card) => ({ ...card })),
    opponents: state.players
      .filter((player) => player.seat !== heroSeat && !player.folded)
      .map((player) => ({ id: player.id, position: player.position })),
    mode: "random",
    simulations: 2500,
    seed: 741 + state.handId,
  };
}
