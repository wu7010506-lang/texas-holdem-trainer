import React from 'react';
import { HandWinner, PlayerState } from '../../engine/types';
import { PlayingCard } from './PlayingCard';
import { BotProfile } from '../../bot/types';
import { Coins, User, Bot, Crown } from 'lucide-react';

interface PlayerSeatProps {
  player: PlayerState;
  isCurrentPlayer: boolean;
  isDealer: boolean;
  bigBlind: number;
  winnerInfo?: HandWinner;
  botProfile?: BotProfile;
  showdown: boolean;
  highlightCardIds?: Set<string>;
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  player,
  isCurrentPlayer,
  isDealer,
  bigBlind,
  winnerInfo,
  botProfile,
  showdown,
  highlightCardIds = new Set(),
}) => {
  const stackInBB = (player.stack / (bigBlind || 1)).toFixed(1);
  const currentBetInBB = (player.currentBet / (bigBlind || 1)).toFixed(1);

  const showCards = player.isHuman || (showdown && !player.folded && player.holeCards.length === 2);

  const actionMap: Record<string, string> = {
    FOLD: '棄牌',
    CHECK: '過牌',
    CALL: '跟注',
    BET: '下注',
    RAISE: '加注',
    ALL_IN: '全押',
  };

  return (
    <div className="relative flex flex-col items-center">
      {/* Current Bet Chips in front of seat */}
      {player.currentBet > 0 && (
        <div className="absolute -top-7 flex items-center gap-1 bg-amber-500/90 text-slate-950 font-bold px-2.5 py-0.5 rounded-full text-xs shadow-lg border border-amber-300 animate-fade-in z-20">
          <Coins className="w-3.5 h-3.5" />
          <span>{player.currentBet}</span>
          <span className="text-[10px] text-amber-950">({currentBetInBB} BB)</span>
        </div>
      )}

      {/* Main Seat Card / Avatar Container */}
      <div
        className={`relative w-28 sm:w-40 md:w-44 rounded-xl sm:rounded-2xl p-1.5 sm:p-2.5 backdrop-blur-md transition-all duration-300 flex flex-col items-center gap-1 sm:gap-1.5 border shadow-xl ${
          winnerInfo
            ? 'bg-amber-950/80 border-amber-400 ring-2 sm:ring-4 ring-amber-400/50 scale-105'
            : isCurrentPlayer
            ? 'bg-slate-900/90 border-emerald-400 ring-2 sm:ring-4 ring-emerald-400/50 animate-pulse'
            : player.folded
            ? 'bg-slate-950/60 border-slate-800 opacity-50'
            : 'bg-slate-900/80 border-slate-700/80 hover:border-slate-500'
        }`}
      >
        {/* Top Badges: Position & Dealer Button */}
        <div className="w-full flex items-center justify-between text-[11px] font-bold">
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {player.position || `座位 ${player.seat + 1}`}
            </span>
            {botProfile && !player.isHuman && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/80 text-[10px]" title={botProfile.description}>
                {botProfile.name.split(' ')[0]}
              </span>
            )}
          </div>

          {isDealer && (
            <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs shadow border border-amber-200" title="莊家按鈕 (Dealer Button)">
              D
            </div>
          )}
        </div>

        {/* Player Name & Role Icon */}
        <div className="flex items-center gap-1.5">
          {winnerInfo ? (
            <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
          ) : player.isHuman ? (
            <User className="w-4 h-4 text-emerald-400" />
          ) : (
            <Bot className="w-4 h-4 text-indigo-400" />
          )}
          <span className={`text-xs font-semibold truncate max-w-[105px] ${player.isHuman ? 'text-emerald-300' : 'text-slate-200'}`}>
            {player.isHuman ? '玩家 (Hero)' : player.name}
          </span>
        </div>

        {/* Hole Cards Display */}
        <div className="flex items-center justify-center gap-1.5 my-0.5">
          {player.holeCards.length === 2 ? (
            <>
              <PlayingCard
                card={player.holeCards[0]}
                hidden={!showCards}
                highlighted={highlightCardIds.has(player.holeCards[0].id)}
                size="sm"
              />
              <PlayingCard
                card={player.holeCards[1]}
                hidden={!showCards}
                highlighted={highlightCardIds.has(player.holeCards[1].id)}
                size="sm"
              />
            </>
          ) : (
            <div className="h-14 flex items-center justify-center text-slate-600 text-xs italic">
              無手牌
            </div>
          )}
        </div>

        {/* Stack & Chip count */}
        <div className="w-full flex items-center justify-between bg-slate-950/80 rounded-lg px-2 py-1 text-xs">
          <div className="flex items-center gap-1 text-amber-400 font-bold">
            <Coins className="w-3.5 h-3.5" />
            <span>{player.stack}</span>
          </div>
          <span className="text-slate-400 text-[11px] font-medium">{stackInBB} BB</span>
        </div>

        {/* Action / State Banner */}
        {winnerInfo ? (
          <div className="w-full text-center py-0.5 rounded bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30 truncate">
            🏆 獲勝 +{winnerInfo.amount}
          </div>
        ) : player.allIn ? (
          <div className="w-full text-center py-0.5 rounded bg-rose-600/30 text-rose-300 text-[11px] font-bold border border-rose-500/40">
            全押 (ALL-IN)
          </div>
        ) : player.folded ? (
          <div className="w-full text-center py-0.5 rounded bg-slate-800 text-slate-400 text-[11px] font-medium">
            已棄牌 (Folded)
          </div>
        ) : player.lastAction ? (
          <div className="w-full text-center py-0.5 rounded bg-slate-800/80 text-emerald-300 text-[11px] font-medium border border-slate-700 truncate">
            {actionMap[player.lastAction.type] || player.lastAction.type} {player.lastAction.amount ? player.lastAction.amount : ''}
          </div>
        ) : isCurrentPlayer ? (
          <div className="w-full text-center py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[11px] font-bold border border-emerald-500/40 animate-pulse">
            思考中...
          </div>
        ) : null}
      </div>
    </div>
  );
};
