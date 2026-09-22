import React from 'react';
import { Card } from '../../engine/types';
import { SUIT_NAMES, SUIT_SYMBOLS, isRedSuit } from '../../engine/Card';

interface PlayingCardProps {
  card?: Card;
  hidden?: boolean;
  highlighted?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  hidden = false,
  highlighted = false,
  size = 'md',
}) => {
  const sizeClasses = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-14 h-20 text-sm',
    lg: 'w-18 h-26 text-base',
  }[size];

  if (hidden || !card) {
    return (
      <div
        className={`${sizeClasses} rounded-lg bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-900 border-2 border-slate-700/80 shadow-md flex items-center justify-center select-none transform transition-transform duration-200`}
      >
        <div className="w-full h-full m-1 border border-indigo-400/30 rounded flex items-center justify-center bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:6px_6px]">
          <span className="text-indigo-300 font-bold opacity-60 text-xs">♠</span>
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`${sizeClasses} relative rounded-lg bg-slate-50 border-2 select-none shadow-lg flex flex-col justify-between p-1 font-semibold transition-all duration-200 ${
        highlighted
          ? 'border-amber-400 ring-4 ring-amber-400/60 scale-105 z-10'
          : 'border-slate-300 hover:-translate-y-0.5'
      }`}
      title={`${card.rank} of ${SUIT_NAMES[card.suit]}`}
    >
      {/* Top Left Rank & Suit */}
      <div className={`flex flex-col items-center leading-none ${red ? 'text-red-600' : 'text-slate-900'}`}>
        <span className="font-extrabold tracking-tighter">{card.rank}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>

      {/* Center Large Suit Symbol */}
      <div
        className={`absolute inset-0 flex items-center justify-center text-xl pointer-events-none opacity-90 ${
          red ? 'text-red-500' : 'text-slate-800'
        }`}
      >
        <span>{suitSymbol}</span>
      </div>

      {/* Bottom Right Rank & Suit (Upside Down) */}
      <div
        className={`flex flex-col items-center leading-none rotate-180 self-end ${
          red ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        <span className="font-extrabold tracking-tighter">{card.rank}</span>
        <span className="text-xs">{suitSymbol}</span>
      </div>
    </div>
  );
};
