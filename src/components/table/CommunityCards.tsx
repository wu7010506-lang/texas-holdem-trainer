import { Card } from "../../engine/types";
import { PlayingCard } from "./PlayingCard";

export function CommunityCards({
  cards,
  highlightCardIds = new Set<string>(),
}: {
  cards: Card[];
  highlightCardIds?: Set<string>;
}) {
  return (
    <div className="community-cards" aria-label="公共牌">
      {Array.from({ length: 5 }, (_, i) => (
        <PlayingCard
          key={cards[i]?.id ?? `empty-${i}`}
          card={cards[i]}
          highlighted={cards[i] ? highlightCardIds.has(cards[i].id) : false}
        />
      ))}
    </div>
  );
}
