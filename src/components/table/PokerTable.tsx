import { GameState } from "../../engine/types";
import { PlayerSeat } from "./PlayerSeat";
import { CommunityCards } from "./CommunityCards";
import { getSettlements } from "./settlement";

const STREETS = {
  PREFLOP: "翻牌前",
  FLOP: "翻牌",
  TURN: "轉牌",
  RIVER: "河牌",
  SHOWDOWN: "攤牌",
};

export function PokerTable({
  gameState: state,
  heroSeat,
}: {
  gameState: GameState;
  heroSeat: number;
}) {
  const settlements = getSettlements(state);
  const winningCards = new Set(
    state.winners
      ?.filter((winner) => (settlements.get(winner.playerId)?.won ?? 0) > 0)
      .flatMap(
        (winner) => winner.handEvaluation?.best5.map((card) => card.id) ?? [],
      ),
  );
  const result = [...settlements.entries()]
    .map(([id, settlement]) => {
      const player = state.players.find((p) => p.id === id);
      const name = player?.isHuman ? "你" : player?.name;
      const won =
        settlement.won > 0
          ? `${name} +${settlement.won.toLocaleString()}`
          : name;
      return settlement.returned > 0
        ? `${won}（退回 ${settlement.returned.toLocaleString()}）`
        : won;
    })
    .join(" · ");
  return (
    <section className="table-stage" aria-label="六人德州撲克牌桌">
      <div className="table-rail">
        <div className="table-felt">
          <div className="felt-line" />
          <span className="felt-watermark" aria-hidden="true">
            RIVER
          </span>
        </div>
      </div>
      <div className="table-center">
        <div
          className="street-progress"
          aria-label={`目前階段：${STREETS[state.street]}`}
        >
          {(["PREFLOP", "FLOP", "TURN", "RIVER"] as const).map((street) => (
            <span
              key={street}
              className={state.street === street ? "street-current" : ""}
            >
              {STREETS[street]}
            </span>
          ))}
        </div>
        <div className="pot-display">
          <span className="chip-stack" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <div>
            <small>總底池</small>
            <strong>{state.pot.toLocaleString()}</strong>
          </div>
        </div>
        <CommunityCards
          cards={state.communityCards}
          highlightCardIds={winningCards}
        />
        <div className="table-message" aria-live="polite">
          {state.handComplete && state.handId > 0 ? (
            <span className="winner-message">{result || "本手結束"}</span>
          ) : (
            <span>
              {state.players[state.currentPlayerSeat]?.isHuman
                ? "輪到你了，做出你的選擇。"
                : `${state.players[state.currentPlayerSeat]?.name ?? "對手"} 正在思考…`}
            </span>
          )}
        </div>
        {state.sidePots.length > 1 && (
          <div className="side-pots">
            {state.sidePots.map((pot, i) => (
              <span key={pot.id}>
                {i === 0 ? "主池" : `邊池 ${i}`} {pot.amount}
              </span>
            ))}
          </div>
        )}
      </div>
      {state.players.map((player) => (
        <div
          key={player.id}
          className={`seat-location seat-location-${(player.seat - heroSeat + state.players.length) % state.players.length}`}
        >
          <PlayerSeat
            player={player}
            isCurrentPlayer={
              !state.handComplete && state.currentPlayerSeat === player.seat
            }
            isDealer={state.dealerSeat === player.seat}
            winnings={settlements.get(player.id)?.won ?? 0}
            returned={settlements.get(player.id)?.returned ?? 0}
            showdown={state.street === "SHOWDOWN"}
            highlightCardIds={winningCards}
          />
        </div>
      ))}
    </section>
  );
}
