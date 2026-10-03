import { PlayerState } from "../../engine/types";
import { PlayingCard } from "./PlayingCard";

const ACTION_NAMES: Record<string, string> = {
  FOLD: "棄牌",
  CHECK: "過牌",
  CALL: "跟注",
  BET: "下注",
  RAISE: "加注",
  ALL_IN: "全押",
};
interface PlayerSeatProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  isDealer: boolean;
  winnings: number;
  returned: number;
  showdown: boolean;
  highlightCardIds: Set<string>;
}

export function PlayerSeat({
  player,
  isCurrentPlayer,
  isDealer,
  winnings,
  returned,
  showdown,
  highlightCardIds,
}: PlayerSeatProps) {
  const reveal = player.isHuman || (showdown && !player.folded);
  const status =
    winnings > 0
      ? `贏得 ${winnings.toLocaleString()}`
      : returned > 0
        ? `退回 ${returned.toLocaleString()}`
        : player.folded
          ? "已棄牌"
          : player.allIn
            ? "全押"
            : isCurrentPlayer
              ? player.isHuman
                ? "輪到你了"
                : "思考中"
              : (ACTION_NAMES[player.lastAction?.type ?? ""] ??
                player.position);
  return (
    <div
      className={`player-seat ${player.isHuman ? "hero-seat" : ""} ${isCurrentPlayer ? "seat-active" : ""} ${player.folded ? "seat-folded" : ""} ${winnings > 0 ? "seat-winner" : ""}`}
    >
      {!player.isHuman && (
        <div className={`seat-avatar avatar-${player.seat}`} aria-hidden="true">
          {player.name[0]}
          {isDealer && <span className="dealer-button">D</span>}
        </div>
      )}
      <div
        className="hole-cards"
        aria-label={player.isHuman ? "你的手牌" : `${player.name} 的手牌`}
      >
        {player.holeCards.map((card) => (
          <PlayingCard
            key={card.id}
            card={reveal ? card : undefined}
            hidden={!reveal}
            size={player.isHuman ? "lg" : "sm"}
            highlighted={reveal && highlightCardIds.has(card.id)}
          />
        ))}
      </div>
      <div className="seat-info">
        <div className="seat-name">
          <span>{player.isHuman ? "你" : player.name}</span>
          <span className="seat-position">
            {player.position}
            {player.isHuman && isDealer && (
              <span className="dealer-button">D</span>
            )}
          </span>
        </div>
        <strong className="seat-stack">
          {player.stack.toLocaleString()}
          <small>籌碼</small>
        </strong>
      </div>
      <span className="seat-status">{status || "\u00a0"}</span>
      {player.currentBet > 0 && (
        <span className="seat-bet">
          <i aria-hidden="true" />
          {player.currentBet.toLocaleString()}
        </span>
      )}
    </div>
  );
}
