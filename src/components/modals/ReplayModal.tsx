import React, { useState, useMemo } from 'react';
import { HandHistoryRecord } from '../../history/HandHistory';
import { HandReplayer, ReplayFrame } from '../../history/HandReplayer';
import { CommunityCards } from '../table/CommunityCards';
import { PlayingCard } from '../table/PlayingCard';
import { X, ChevronLeft, ChevronRight, RotateCcw, Play } from 'lucide-react';

interface ReplayModalProps {
  hand: HandHistoryRecord;
  onClose: () => void;
}

export const ReplayModal: React.FC<ReplayModalProps> = ({ hand, onClose }) => {
  const replayer = useMemo(() => new HandReplayer(hand), [hand]);
  const [step, setStep] = useState(0);

  const frame: ReplayFrame = replayer.getFrame(step);
  const totalSteps = replayer.getTotalSteps();

  const handleNext = () => {
    if (step < totalSteps) setStep((s) => s + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleReset = () => {
    setStep(0);
  };

  const jumpToStreet = (targetStreet: string) => {
    for (let i = 0; i <= totalSteps; i++) {
      const f = replayer.getFrame(i);
      if (f.street === targetStreet) {
        setStep(i);
        return;
      }
    }
  };

  const streetMap: Record<string, string> = {
    PREFLOP: '翻牌前',
    FLOP: '翻牌圈',
    TURN: '轉牌圈',
    RIVER: '河牌圈',
    SHOWDOWN: '攤牌結算',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-indigo-400 fill-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">牌局步進重播器</h2>
            <span className="text-xs text-slate-400">
              (第 #{hand.handId} 手 • 步驟 {step} / {totalSteps})
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Board & Pot View */}
        <div className="p-6 flex flex-col items-center justify-center gap-4 bg-emerald-950/30 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-slate-900 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              {streetMap[frame.street] || frame.street}
            </span>
            <span className="px-4 py-1 rounded-full bg-slate-900 border border-amber-400/40 text-amber-400 text-sm font-extrabold">
              底池: {frame.currentPot}
            </span>
          </div>

          <CommunityCards cards={frame.communityCards} />

          {/* Current Step Action Banner */}
          <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 text-sm font-semibold max-w-md text-center">
            {frame.lastActionDescription === 'Cards dealt' ? '發牌完畢，翻前開始' : frame.lastActionDescription}
          </div>
        </div>

        {/* Players in hand */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 bg-slate-950/40">
          {hand.players.map((p) => {
            const isFolded = frame.playerFolded[p.id];
            const currentBet = frame.playerBets[p.id] || 0;
            const currentStack = frame.playerStacks[p.id] ?? 0;
            const isActive = frame.activeSeat === p.seat;

            return (
              <div
                key={p.id}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                  isActive
                    ? 'bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/40'
                    : isFolded
                    ? 'bg-slate-950/40 border-slate-800 opacity-40'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[10px]">
                  <span className="text-slate-400 font-bold">{p.position}</span>
                  <span className="text-slate-200 font-semibold truncate max-w-[65px]">{p.isHuman ? '玩家 (Hero)' : p.name}</span>
                </div>

                {/* Cards */}
                <div className="flex gap-1 my-0.5">
                  {p.holeCards.length === 2 ? (
                    <>
                      <PlayingCard card={p.holeCards[0]} size="sm" />
                      <PlayingCard card={p.holeCards[1]} size="sm" />
                    </>
                  ) : (
                    <div className="h-10 text-[10px] text-slate-500 flex items-center">無手牌</div>
                  )}
                </div>

                <div className="text-[10px] w-full flex justify-between text-slate-400">
                  <span>籌碼: <strong className="text-amber-400">{currentStack}</strong></span>
                  {currentBet > 0 && (
                    <span className="text-amber-300 font-bold">注: {currentBet}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Controls Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
          {/* Street quick jumps */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => jumpToStreet('PREFLOP')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              翻牌前
            </button>
            <button
              onClick={() => jumpToStreet('FLOP')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              翻牌圈
            </button>
            <button
              onClick={() => jumpToStreet('TURN')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              轉牌圈
            </button>
            <button
              onClick={() => jumpToStreet('RIVER')}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
            >
              河牌圈
            </button>
          </div>

          {/* Stepping controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              title="重設回到發牌最初"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrev}
              disabled={step === 0}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer ${
                step === 0
                  ? 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              上一步
            </button>
            <button
              onClick={handleNext}
              disabled={step === totalSteps}
              className={`px-4 py-1.5 rounded-lg flex items-center gap-1 text-xs font-bold cursor-pointer ${
                step === totalSteps
                  ? 'bg-indigo-900/40 text-indigo-400/40 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow'
              }`}
            >
              下一步
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
