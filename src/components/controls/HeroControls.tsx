import React, { useState, useEffect } from 'react';
import { GameState, LegalActions, PlayerAction } from '../../engine/types';
import { Coins, Play, RefreshCw } from 'lucide-react';

interface HeroControlsProps {
  gameState: GameState;
  heroSeat: number;
  onAction: (action: PlayerAction) => void;
  onNextHand: () => void;
  onRebuy: () => void;
  isBotThinking: boolean;
}

export const HeroControls: React.FC<HeroControlsProps> = ({
  gameState,
  heroSeat,
  onAction,
  onNextHand,
  onRebuy,
  isBotThinking,
}) => {
  const hero = gameState.players[heroSeat];
  const isHeroTurn = gameState.currentPlayerSeat === heroSeat && !gameState.handComplete;
  const legal: LegalActions = gameState.legalActions || {
    canFold: false,
    canCheck: false,
    canCall: false,
    callAmount: 0,
    canBet: false,
    minBet: 0,
    maxBet: 0,
    canRaise: false,
    minRaise: 0,
    maxRaise: 0,
    canAllIn: false,
    allInAmount: 0,
  };

  const isBettor = legal.canBet;
  const isRaiser = legal.canRaise;
  const minAmount = isBettor ? legal.minBet : legal.minRaise;
  const maxAmount = isBettor ? legal.maxBet : legal.maxRaise;

  const [betAmount, setBetAmount] = useState<number>(minAmount);

  // Sync bet amount when turn or street changes
  useEffect(() => {
    if (minAmount > 0) {
      setBetAmount(minAmount);
    }
  }, [minAmount, gameState.street, gameState.currentBet]);

  // Handle quick pot percentage clicks
  const applyPotFraction = (fraction: number) => {
    const pot = gameState.pot;
    const computed = isBettor
      ? Math.round(pot * fraction)
      : Math.round(gameState.currentBet + pot * fraction);
    const clamped = Math.max(minAmount, Math.min(maxAmount, computed));
    setBetAmount(clamped);
  };

  if (!hero) return null;

  // Hand completed view
  if (gameState.handComplete) {
    const isHeroBroke = hero.stack <= 0;
    return (
      <div className="w-full max-w-4xl mx-auto p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl shadow-2xl flex items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-300">
            第 {gameState.handId} 手結束。
          </span>
          {isHeroBroke && (
            <span className="text-rose-400 text-sm font-bold animate-pulse">
              您的籌碼已歸零！
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isHeroBroke && (
            <button
              onClick={onRebuy}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              補充 100 BB 籌碼
            </button>
          )}

          <button
            onClick={onNextHand}
            className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            發下一手牌 (Next Hand)
          </button>
        </div>
      </div>
    );
  }

  const disabled = !isHeroTurn || isBotThinking;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl flex flex-col gap-3 backdrop-blur-md">
      {/* Sizing presets and slider if betting or raising is legal */}
      {(isBettor || isRaiser) && (
        <div className={`flex flex-col gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            {/* Quick Sizing Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => applyPotFraction(0.33)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                1/3 底池
              </button>
              <button
                type="button"
                onClick={() => applyPotFraction(0.5)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                1/2 底池
              </button>
              <button
                type="button"
                onClick={() => applyPotFraction(0.66)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                2/3 底池
              </button>
              <button
                type="button"
                onClick={() => applyPotFraction(0.75)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                3/4 底池
              </button>
              <button
                type="button"
                onClick={() => applyPotFraction(1.0)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                滿池 (Pot)
              </button>
              <button
                type="button"
                onClick={() => setBetAmount(maxAmount)}
                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs font-bold cursor-pointer"
              >
                全押 (All-in)
              </button>
            </div>

            {/* Direct Number Input */}
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <input
                type="number"
                min={minAmount}
                max={maxAmount}
                value={betAmount}
                onChange={(e) => setBetAmount(Number(e.target.value))}
                className="w-20 bg-transparent text-right font-bold text-sm text-amber-300 focus:outline-none"
              />
            </div>
          </div>

          {/* Sizing Range Slider */}
          <input
            type="range"
            min={minAmount}
            max={maxAmount}
            step={gameState.currentBet > 0 ? 5 : 10}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
        </div>
      )}

      {/* Main Action Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Fold Button */}
        <button
          onClick={() => onAction({ type: 'FOLD' })}
          disabled={disabled || !legal.canFold}
          className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
            disabled || !legal.canFold
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-rose-700 hover:bg-rose-600 text-white shadow-rose-900/20 active:scale-95'
          }`}
        >
          棄牌 (Fold)
        </button>

        {/* Check Button */}
        <button
          onClick={() => onAction({ type: 'CHECK' })}
          disabled={disabled || !legal.canCheck}
          className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
            disabled || !legal.canCheck
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 active:scale-95'
          }`}
        >
          過牌 (Check)
        </button>

        {/* Call Button */}
        <button
          onClick={() => onAction({ type: 'CALL', amount: legal.callAmount })}
          disabled={disabled || !legal.canCall}
          className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
            disabled || !legal.canCall
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20 active:scale-95'
          }`}
        >
          跟注 (Call) {legal.callAmount > 0 ? legal.callAmount : ''}
        </button>

        {/* Bet or Raise Button */}
        {isBettor ? (
          <button
            onClick={() => onAction({ type: 'BET', amount: betAmount })}
            disabled={disabled || !legal.canBet}
            className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
              disabled || !legal.canBet
                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-amber-900/20 active:scale-95'
            }`}
          >
            下注 (Bet) {betAmount}
          </button>
        ) : (
          <button
            onClick={() => onAction({ type: 'RAISE', amount: betAmount })}
            disabled={disabled || !legal.canRaise}
            className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
              disabled || !legal.canRaise
                ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-black shadow-amber-900/20 active:scale-95'
            }`}
          >
            加注 (Raise) {betAmount}
          </button>
        )}

        {/* All-In Button */}
        <button
          onClick={() => onAction({ type: 'ALL_IN', amount: legal.allInAmount })}
          disabled={disabled || !legal.canAllIn}
          className={`py-3 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer col-span-2 sm:col-span-1 ${
            disabled || !legal.canAllIn
              ? 'bg-slate-800/50 text-slate-500 cursor-not-allowed'
              : 'bg-purple-700 hover:bg-purple-600 text-white shadow-purple-900/20 active:scale-95'
          }`}
        >
          全押 All-In ({legal.allInAmount})
        </button>
      </div>
    </div>
  );
};
