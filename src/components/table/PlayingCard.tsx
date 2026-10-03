import { Card } from "../../engine/types";
import { SUIT_NAMES, SUIT_SYMBOLS, isRedSuit } from "../../engine/Card";

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  highlighted?: boolean;
  size?: "sm" | "md" | "lg";
}

export function PlayingCard({
  card,
  hidden = false,
  highlighted = false,
  size = "md",
}: PlayingCardProps) {
  if (hidden)
    return (
      <div
        className={`playing-card card-back card-${size}`}
        aria-label="對手暗牌"
      >
        <span aria-hidden="true">♠</span>
      </div>
    );
  if (!card)
    return (
      <div
        className={`playing-card card-placeholder card-${size}`}
        aria-label="尚未發出的公牌"
      >
        <span aria-hidden="true">·</span>
      </div>
    );
  return (
    <div
      className={`playing-card card-${size} ${isRedSuit(card.suit) ? "card-red" : "card-black"} ${highlighted ? "card-highlighted" : ""}`}
      aria-label={`${card.rank} ${SUIT_NAMES[card.suit]}`}
    >
      <span className="card-corner">
        <b>{card.rank}</b>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </span>
      <span className="card-suit" aria-hidden="true">
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className="card-corner card-corner-bottom" aria-hidden="true">
        <b>{card.rank}</b>
        <span>{SUIT_SYMBOLS[card.suit]}</span>
      </span>
    </div>
  );
}
