import React, { useState, useEffect } from 'react';
import { GameState } from '../../engine/types';
import { BoardAnalyzer } from '../../bot/BoardAnalyzer';
import { HandStrength } from '../../bot/HandStrength';
import { PotOddsCalculator } from '../../bot/PotOddsCalculator';
import { EquityCalculationResult, EquityCalculator, OpponentPublicInfo } from '../../bot/EquityCalculator';
import { Activity, Calculator, Percent, ShieldCheck, Layers, HelpCircle } from 'lucide-react';

interface TrainingPanelProps {
  gameState: GameState;
  heroSeat: number;
  bigBlind: number;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({
  gameState,
  heroSeat,
  bigBlind,
}) => {
  const hero = gameState.players[heroSeat];

  // Configurable visibility toggles
  const [showPotOdds, setShowPotOdds] = useState(true);
  const [showHandStrength, setShowHandStrength] = useState(true);
  const [showEquity, setShowEquity] = useState(true);

  // Equity settings
  const [equityMode, setEquityMode] = useState<'range' | 'random'>('range');
  const [simulationCount, setSimulationCount] = useState<number>(10000);
  const [equityResult, setEquityResult] = useState<EquityCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Compute live contextual metrics
  const amountToCall = hero ? Math.max(0, gameState.currentBet - hero.currentBet) : 0;
  const { potOddsPercent } = PotOddsCalculator.calculate(amountToCall, gameState.pot);

  const opponentStacks = gameState.players
    .filter((p) => p.seat !== heroSeat && !p.folded)
    .map((p) => p.stack);
  const effectiveStack = hero ? Math.min(hero.stack, opponentStacks.length > 0 ? Math.max(...opponentStacks) : hero.stack) : 0;
  const spr = PotOddsCalculator.calculateSPR(effectiveStack, gameState.pot);

  const boardInfo = BoardAnalyzer.analyze(gameState.communityCards);
  const strengthInfo = hero
    ? HandStrength.evaluate(hero.holeCards, gameState.communityCards)
    : null;

  // Active non-folded opponents (strictly public info only)
  const activeOpponents = gameState.players.filter(
    (p) => p.seat !== heroSeat && !p.folded
  );

  // Run Equity calculation whenever cards, opponents, or mode changes
  useEffect(() => {
    if (!showEquity || !hero || hero.holeCards.length < 2 || activeOpponents.length === 0) {
      setEquityResult(null);
      return;
    }

    setIsCalculating(true);
    const timer = setTimeout(() => {
      // Build public opponent metadata (no hidden hole cards!)
      const publicOpponents: OpponentPublicInfo[] = activeOpponents.map((p) => ({
        id: p.id,
        position: p.position,
        actionHistory: gameState.actionHistory.filter((a) => a.playerId === p.id),
      }));

      const res = EquityCalculator.calculate({
        heroHoleCards: hero.holeCards,
        communityCards: gameState.communityCards,
        opponents: publicOpponents,
        mode: equityMode,
        simulations: simulationCount,
      });

      setEquityResult(res);
      setIsCalculating(false);
    }, 40);

    return () => clearTimeout(timer);
  }, [
    showEquity,
    equityMode,
    simulationCount,
    hero?.holeCards,
    gameState.communityCards.length,
    gameState.street,
    gameState.players.map((p) => p.folded).join(','),
  ]);

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-4 text-xs">
      {/* Header with Title and Toggles */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
          <Activity className="w-4 h-4" />
          <span>撲克即時訓練 HUD</span>
        </div>

        {/* Small toggles */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <button
            onClick={() => setShowPotOdds(!showPotOdds)}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${showPotOdds ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}
            title="開關底池賠率顯示"
          >
            底池賠率
          </button>
          <button
            onClick={() => setShowHandStrength(!showHandStrength)}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${showHandStrength ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}
            title="開關手牌強度分類"
          >
            手牌強度
          </button>
          <button
            onClick={() => setShowEquity(!showEquity)}
            className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${showEquity ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-500'}`}
            title="開關權益率模擬"
          >
            權益率
          </button>
        </div>
      </div>

      {/* Hand & Table State Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] block">目前位置</span>
          <span className="font-bold text-slate-200 text-sm">{hero?.position || 'N/A'}</span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] block">英雄籌碼 (BB)</span>
          <span className="font-bold text-amber-400 text-sm">
            {hero ? (hero.stack / bigBlind).toFixed(1) : 0} BB
          </span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] block">底池大小 (BB)</span>
          <span className="font-bold text-amber-400 text-sm">
            {(gameState.pot / bigBlind).toFixed(1)} BB
          </span>
        </div>
        <div className="bg-slate-950/60 p-2 rounded-xl border border-slate-800">
          <span className="text-slate-400 text-[10px] block" title="Stack-to-Pot Ratio 有效籌碼與底池之比">SPR (籌碼池比)</span>
          <span className={`font-bold text-sm ${spr < 3 ? 'text-rose-400' : spr < 8 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {spr}
          </span>
        </div>
      </div>

      {/* Pot Odds Section */}
      {showPotOdds && (
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-300 font-semibold">
            <span className="flex items-center gap-1.5 text-blue-400">
              <Percent className="w-3.5 h-3.5" />
              底池賠率 (Pot Odds) & 跟注代價
            </span>
            <span className="text-amber-300 font-bold">{potOddsPercent}%</span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>需跟注金額: <strong className="text-slate-200">{amountToCall}</strong></span>
            <span>跟注後總底池: <strong className="text-slate-200">{gameState.pot + amountToCall}</strong></span>
          </div>

          {amountToCall > 0 && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              <span>損益平衡所需權益率: </span>
              <strong className="text-blue-300">需至少具備 {potOddsPercent}% 權益率 (Equity) 跟注才具長期期望值</strong>
            </div>
          )}
        </div>
      )}

      {/* Hand Strength & Board Texture */}
      {showHandStrength && strengthInfo && (
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              當前手牌等級
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80 font-bold text-[11px]">
              {strengthInfo.categoryName}
            </span>
          </div>

          <p className="text-slate-300 text-[11px] leading-relaxed">
            {strengthInfo.description}
          </p>

          <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
            公牌材質結構：<span className="text-slate-200 font-medium">{boardInfo.description}</span>
          </div>
        </div>
      )}

      {/* Real-time Rigorous Equity Analysis */}
      {showEquity && (
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-3">
          {/* Header & Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5 text-purple-400 font-bold">
              <Calculator className="w-3.5 h-3.5" />
              即時權益率分析 (Equity Engine)
            </span>

            {/* Mode Switcher */}
            <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[11px]">
              <button
                onClick={() => setEquityMode('range')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                  equityMode === 'range'
                    ? 'bg-purple-900/80 text-purple-200 border border-purple-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="根據各電腦玩家之位置與行動推估範圍"
              >
                對手範圍
              </button>
              <button
                onClick={() => setEquityMode('random')}
                className={`px-2 py-0.5 rounded font-semibold cursor-pointer transition-colors ${
                  equityMode === 'random'
                    ? 'bg-purple-900/80 text-purple-200 border border-purple-600/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="純粹數學參考：對抗完全隨機未知手牌"
              >
                隨機手牌
              </button>
            </div>
          </div>

          {/* Simulation Samples Selector */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
            <span>
              存活對手: <strong className="text-slate-200">{activeOpponents.length} 人</strong>
            </span>

            <div className="flex items-center gap-1">
              <span>模擬次數:</span>
              <select
                value={simulationCount}
                onChange={(e) => setSimulationCount(Number(e.target.value))}
                className="bg-slate-800 border border-slate-700 text-slate-200 px-1.5 py-0.5 rounded text-[11px] font-semibold focus:outline-none cursor-pointer"
              >
                <option value={2000}>快速 (2,000)</option>
                <option value={10000}>標準 (10,000)</option>
                <option value={25000}>精確 (25,000)</option>
              </select>
            </div>
          </div>

          {/* Result Cards */}
          {equityResult ? (
            <div className="flex flex-col gap-2.5">
              {/* Primary Metric: Equity */}
              <div className="flex items-baseline justify-between bg-purple-950/30 p-2.5 rounded-xl border border-purple-800/40">
                <div>
                  <span className="text-slate-300 font-semibold block text-[11px]">
                    {equityMode === 'range'
                      ? '面對存活對手預估權益率 (Equity)'
                      : '對隨機手牌權益率 (Random Equity)'}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {equityResult.isExact
                      ? '全組合精確枚舉 (Exact Enumeration)'
                      : `蒙地卡羅 ${equityResult.simulations.toLocaleString()} 次模擬`}
                  </span>
                </div>

                <div className="text-right">
                  <div className="text-xl font-black text-purple-300">
                    {(equityResult.equity * 100).toFixed(1)}%
                    {!equityResult.isExact && equityResult.marginOfError > 0 && (
                      <span className="text-xs font-normal text-purple-400/80 ml-1">
                        ±{(equityResult.marginOfError * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Bar (Win, Tie, Lose) */}
              <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${equityResult.winRate * 100}%` }}
                  title={`獨贏: ${(equityResult.winRate * 100).toFixed(1)}%`}
                />
                <div
                  className="bg-amber-400 h-full transition-all duration-300"
                  style={{ width: `${equityResult.tieRate * 100}%` }}
                  title={`平手拆池: ${(equityResult.tieRate * 100).toFixed(1)}%`}
                />
                <div
                  className="bg-rose-500/70 h-full transition-all duration-300"
                  style={{ width: `${equityResult.lossRate * 100}%` }}
                  title={`落敗: ${(equityResult.lossRate * 100).toFixed(1)}%`}
                />
              </div>

              {/* Detailed Breakdown: Win, Tie, Lose */}
              <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1">
                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-emerald-400 font-semibold block text-[10px]">獲勝率 (Win)</span>
                  <strong className="text-slate-100 text-xs">{(equityResult.winRate * 100).toFixed(1)}%</strong>
                  <span className="text-[9px] text-slate-500 block">獨佔全池</span>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-amber-400 font-semibold block text-[10px]">平手率 (Tie)</span>
                  <strong className="text-slate-100 text-xs">{(equityResult.tieRate * 100).toFixed(1)}%</strong>
                  <span className="text-[9px] text-slate-500 block">並列平分</span>
                </div>

                <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-rose-400 font-semibold block text-[10px]">落敗率 (Lose)</span>
                  <strong className="text-slate-100 text-xs">{(equityResult.lossRate * 100).toFixed(1)}%</strong>
                  <span className="text-[9px] text-slate-500 block">未得底池</span>
                </div>
              </div>

              {/* Educational Note */}
              <div className="text-[10px] text-slate-500 bg-slate-900/40 p-2 rounded-lg flex items-start gap-1.5 leading-relaxed">
                <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong>權益率 (Equity)</strong> ＝ 獲勝率 ＋ 平手底池均分期望值。在多人局中，平手時由並列玩家依人數均分底池份額。
                </span>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px] italic py-2 text-center">
              {isCalculating ? '正在精確模擬權益率中...' : '等待發牌後即刻計算面對存活對手之權益率...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
