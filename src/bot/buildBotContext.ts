import { GameState } from "../engine/types";
import { ActionValidator } from "../engine/ActionValidator";
import { BotDecisionContext } from "./types";
import { BoardAnalyzer } from "./BoardAnalyzer";
import { HandStrength } from "./HandStrength";
import { PotOddsCalculator } from "./PotOddsCalculator";

/** Shared public-information boundary, independent of any strategy implementation. */
export function buildBotContext(
  state: GameState,
  seat: number,
): BotDecisionContext {
  const player = state.players[seat];
  if (!player) throw new Error(`Invalid seat ${seat}`);
  const amountToCall = Math.max(0, state.currentBet - player.currentBet);
  const opponents = state.players.filter((p) => p.seat !== seat && !p.folded);
  const effectiveStack = Math.min(
    player.stack,
    opponents.length
      ? Math.max(...opponents.map((p) => p.stack))
      : player.stack,
  );
  const bigBlind = state.bigBlind ?? 10;
  return {
    handId: state.handId,
    selfSeat: seat,
    ownCurrentBet: player.currentBet,
    ownTotalBet: player.totalBetThisHand,
    foldedContributions: state.players
      .filter((p) => p.folded)
      .map((p) => p.totalBetThisHand),
    opponents: opponents.map((p) => ({
      id: p.id,
      seat: p.seat,
      position: p.position,
      stack: p.stack,
      currentBet: p.currentBet,
      totalBetThisHand: p.totalBetThisHand,
      allIn: p.allIn,
    })),
    holeCards: player.holeCards.map((card) => ({ ...card })),
    communityCards: state.communityCards.map((card) => ({ ...card })),
    position: player.position,
    street: state.street,
    potSize: state.pot,
    playerStack: player.stack,
    effectiveStack,
    amountToCall,
    minimumRaise: state.minimumRaise,
    currentBet: state.currentBet,
    bigBlind,
    numberOfPlayers: state.players.length,
    activePlayers: state.players.filter((p) => !p.folded).length,
    previousActions: publicActionHistory(state.actionHistory),
    positionRelativeToButton:
      (player.seat - state.dealerSeat + state.players.length) %
      state.players.length,
    spr: PotOddsCalculator.calculateSPR(effectiveStack, state.pot),
    potOdds: PotOddsCalculator.calculate(amountToCall, state.pot).potOdds,
    boardTexture: BoardAnalyzer.analyze(state.communityCards),
    handStrength: HandStrength.evaluate(player.holeCards, state.communityCards),
    legalActions: ActionValidator.getLegalActions(
      player,
      state.currentBet,
      state.lastRaiseAmount,
      bigBlind,
    ),
  };
}

/** Strategy explanations can contain private cards. Only blind markers are public. */
export function publicActionHistory(history: GameState["actionHistory"]) {
  return history.map((a) => ({
    handId: a.handId,
    street: a.street,
    seat: a.seat,
    playerId: a.playerId,
    playerName: a.playerName,
    action: a.action,
    amount: a.amount,
    position: a.position,
    potBefore: a.potBefore,
    potAfter: a.potAfter,
    stackBefore: a.stackBefore,
    stackAfter: a.stackAfter,
    timestamp: a.timestamp,
    reasoning:
      a.reasoning === "Small Blind" || a.reasoning === "Big Blind"
        ? a.reasoning
        : undefined,
  }));
}
