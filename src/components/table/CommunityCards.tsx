import React from 'react';
import { Card } from '../../engine/types';
import { PlayingCard } from './PlayingCard';

interface CommunityCardsProps {
  cards: Card[];
  highlightCardIds?: Set<string>;
}

export const CommunityCards: React.FC<CommunityCardsProps> = ({
  cards,
  highlightCardIds = new Set(),
}) => {
  const totalSlots = 5;
  const slots = Array.from({ length: totalSlots });

  return (
    <div className="flex items-center justify-center gap-2 p-3 bg-slate-900/60 backdrop-blur-md rounded-2xl border border-emerald-500/20 shadow-2xl">
      {slots.map((_, index) => {
        const card = cards[index];
        const isHighlighted = card ? highlightCardIds.has(card.id) : false;

        if (card) {
          return (
            <PlayingCard
              key={card.id}
              card={card}
              highlighted={isHighlighted}
              size="md"
            />
          );
        }

        // Empty placeholder slot
        return (
          <div
            key={`empty-slot-${index}`}
            className="w-14 h-20 rounded-lg border-2 border-dashed border-emerald-600/30 bg-emerald-950/20 flex flex-col items-center justify-center text-emerald-500/40 text-xs font-medium"
          >
            <span>{index < 3 ? 'FLOP' : index === 3 ? 'TURN' : 'RIVER'}</span>
          </div>
        );
      })}
    </div>
  );
};
