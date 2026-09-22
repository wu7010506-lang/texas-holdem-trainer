import React from 'react';
import { GameState } from '../../engine/types';
import { PlayerSeat } from './PlayerSeat';
import { CommunityCards } from './CommunityCards';
import { BotProfile } from '../../bot/types';
import { Coins } from 'lucide-react';

interface PokerTableProps {
  gameState: GameState;
  heroSeat: number;
  bigBlind: number;
  profiles: Record<string, BotProfile>;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  gameState,
  heroSeat,
  bigBlind,
  profiles,
}) => {
  const { players, communityCards, pot, sidePots, street, winners, dealerSeat, currentPlayerSeat } = gameState;
  const isShowdown = street === 'SHOWDOWN' || gameState.handComplete;

  const streetMap: Record<string, string> = {
    PREFLOP: '翻牌前 (Preflop)',
    FLOP: '翻牌圈 (Flop)',
    TURN: '轉牌圈 (Turn)',
    RIVER: '河牌圈 (River)',
    SHOWDOWN: '攤牌結算 (Showdown)',
  };

  // Identify winning cards for highlight
  const winningCardIds = new Set<string>();
  if (winners && winners.length > 0) {
    winners.forEach((w) => {
      if (w.handEvaluation?.best5) {
        w.handEvaluation.best5.forEach((c) => winningCardIds.add(c.id));
      }
    });
  }

  // Pre-calculated normalized seat coordinates around oval table (0 to 100 percentage)
  const getSeatStyle = (seat: number, total: number) => {
    const relativeOffset = (seat - heroSeat + total) % total;

    if (total === 6) {
      const positions6Max = [
        { left: '50%', top: '88%', transform: 'translate(-50%, -50%)' }, // Hero (Bottom Center)
        { left: '16%', top: '75%', transform: 'translate(-50%, -50%)' }, // Bottom Left
        { left: '16%', top: '25%', transform: 'translate(-50%, -50%)' }, // Top Left
        { left: '50%', top: '12%', transform: 'translate(-50%, -50%)' }, // Top Center
        { left: '84%', top: '25%', transform: 'translate(-50%, -50%)' }, // Top Right
        { left: '84%', top: '75%', transform: 'translate(-50%, -50%)' }, // Bottom Right
      ];
      return positions6Max[relativeOffset];
    }

    if (total === 2) {
      const positionsHU = [
        { left: '50%', top: '86%', transform: 'translate(-50%, -50%)' }, // Hero (Bottom)
        { left: '50%', top: '14%', transform: 'translate(-50%, -50%)' }, // Opponent (Top)
      ];
      return positionsHU[relativeOffset];
    }

    const angle = (2 * Math.PI * relativeOffset) / total + Math.PI / 2;
    const rx = 38;
    const ry = 36;
    const left = 50 - rx * Math.sin(angle);
    const top = 50 + ry * Math.cos(angle);
    return {
      left: `${left}%`,
      top: `${top}%`,
      transform: 'translate(-50%, -50%)',
    };
  };

  return (
    <div className="relative w-full h-[520px] sm:h-[620px] max-w-5xl mx-auto flex items-center justify-center p-1 sm:p-4">
      {/* Outer Wooden Table Rail with Leather Edge */}
      <div className="relative w-full h-full rounded-[60px] sm:rounded-[140px] p-2 sm:p-6 bg-gradient-to-b from-stone-800 via-amber-950/60 to-stone-900 border-4 sm:border-8 border-stone-800 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* Inner Green Casino Felt Table */}
        <div className="relative w-full h-full rounded-[50px] sm:rounded-[110px] bg-radial from-emerald-800 via-emerald-900 to-emerald-950 border-2 sm:border-4 border-emerald-700/40 shadow-inner flex flex-col items-center justify-center overflow-hidden">
          {/* Subtle Casino Felt Watermark Ring */}
          <div className="absolute inset-4 sm:inset-8 rounded-[40px] sm:rounded-[80px] border border-emerald-500/15 pointer-events-none" />

          {/* Table Center: Community Cards, Pot & Street */}
          <div className="z-10 flex flex-col items-center justify-center gap-3">
            {/* Street Indicator & Pot Badge */}
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-slate-950/70 border border-emerald-400/30 text-emerald-400 text-xs font-bold tracking-wider backdrop-blur-sm shadow-md">
                {streetMap[street] || street}
              </span>

              <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-950/80 border border-amber-400/40 text-amber-400 text-sm font-extrabold shadow-lg backdrop-blur-sm">
                <Coins className="w-4 h-4 text-amber-400" />
                <span>總底池: {pot}</span>
                <span className="text-xs text-amber-300/80 font-medium">
                  ({(pot / (bigBlind || 1)).toFixed(1)} BB)
                </span>
              </div>
            </div>

            {/* Side Pots display if multiple pots exist */}
            {sidePots.length > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                {sidePots.map((p, idx) => (
                  <span
                    key={p.id}
                    className="px-2.5 py-0.5 rounded bg-slate-900/90 border border-amber-500/30 text-amber-300 text-[11px]"
                  >
                    {idx === 0 ? '主池 (Main Pot)' : `邊池 ${idx} (Side Pot)`}: {p.amount}
                  </span>
                ))}
              </div>
            )}

            {/* 5 Community Cards */}
            <CommunityCards
              cards={communityCards}
              highlightCardIds={winningCardIds}
            />

            {/* Showdown Winner Announcement Banner */}
            {isShowdown && winners && winners.length > 0 && (
              <div className="bg-amber-400 text-slate-950 px-4 py-1.5 rounded-full font-black text-xs shadow-xl animate-bounce flex items-center gap-1.5">
                <span>🏆 本局獲勝者：</span>
                <span>
                  {winners.map((w) => {
                    const p = players.find((pl) => pl.id === w.playerId);
                    const name = p?.isHuman ? '玩家 (Hero)' : (p?.name || w.playerId);
                    return `${name} (+${w.amount} 籌碼)`;
                  }).join('、')}
                </span>
              </div>
            )}
          </div>

          {/* Player Seats positioned accurately around the table */}
          {players.map((p) => {
            const isWinner = winners?.find((w) => w.playerId === p.id);
            const profile = p.botProfileId ? profiles[p.botProfileId] : undefined;
            const style = getSeatStyle(p.seat, players.length);

            return (
              <div
                key={p.id}
                className="absolute z-20"
                style={style}
              >
                <PlayerSeat
                  player={p}
                  isCurrentPlayer={p.seat === currentPlayerSeat && !gameState.handComplete}
                  isDealer={p.seat === dealerSeat}
                  bigBlind={bigBlind}
                  winnerInfo={isWinner}
                  botProfile={profile}
                  showdown={isShowdown}
                  highlightCardIds={winningCardIds}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
