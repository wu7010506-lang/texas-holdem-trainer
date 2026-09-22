import React from 'react';
import { PlayerStats } from '../../stats/types';
import { BarChart3, X, Award, RotateCcw } from 'lucide-react';

interface StatsModalProps {
  stats: Record<string, PlayerStats>;
  onClose: () => void;
  onReset: () => void;
}

export const StatsModal: React.FC<StatsModalProps> = ({ stats, onClose, onReset }) => {
  const statsList = Object.values(stats);
  const heroStats = statsList.find((s) => s.isHuman);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">撲克生涯數據統計與玩家追蹤</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {/* Hero Highlight Cards */}
          {heroStats ? (
            <div className="flex flex-col gap-3">
              <span className="text-slate-300 font-bold text-sm flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-400" />
                英雄戰績概覽 (累計進行 {heroStats.handsPlayed} 手牌)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">總淨盈虧 (Chips)</span>
                  <span
                    className={`text-base font-black ${
                      heroStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {heroStats.totalProfit >= 0 ? `+${heroStats.totalProfit}` : heroStats.totalProfit}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">百手勝率 (BB/100)</span>
                  <span
                    className={`text-base font-black ${
                      heroStats.bbPer100 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {heroStats.bbPer100 >= 0 ? `+${heroStats.bbPer100}` : heroStats.bbPer100}
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">VPIP / PFR (入池 / 加注)</span>
                  <span className="text-base font-black text-indigo-400">
                    {heroStats.vpip}% / {heroStats.pfr}%
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-400 block text-[11px]">WTSD / W$SD (攤牌 / 勝率)</span>
                  <span className="text-base font-black text-purple-400">
                    {heroStats.wtsd}% / {heroStats.wsd}%
                  </span>
                </div>
              </div>

              {/* Advanced metrics row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-500 block">3-Bet 頻率</span>
                  <strong className="text-slate-200">{heroStats.threeBetPercent}%</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">持續下注率 (C-Bet)</span>
                  <strong className="text-slate-200">{heroStats.cBetPercent}%</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">單局最大贏得底池</span>
                  <strong className="text-emerald-400">+{heroStats.biggestPotWon}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">單局最大損失底池</span>
                  <strong className="text-rose-400">-{heroStats.biggestPotLost}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 p-4 text-center italic">
              進行至少一手牌即可生成統計數據。
            </div>
          )}

          {/* Table of all players (Hero + Bots) */}
          <div className="flex flex-col gap-2">
            <span className="text-slate-300 font-bold text-sm">牌桌全員數據一覽 (Hero 與各 Bot)</span>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px]">
                    <th className="p-2.5">玩家</th>
                    <th className="p-2.5">手數</th>
                    <th className="p-2.5">總盈虧</th>
                    <th className="p-2.5">BB/100</th>
                    <th className="p-2.5">VPIP</th>
                    <th className="p-2.5">PFR</th>
                    <th className="p-2.5">3-Bet</th>
                    <th className="p-2.5">C-Bet</th>
                    <th className="p-2.5">攤牌率(WTSD)</th>
                    <th className="p-2.5">攤牌勝率(W$SD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 text-[11px]">
                  {statsList.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-4 text-center text-slate-500 italic">
                        尚無統計數據。
                      </td>
                    </tr>
                  ) : (
                    statsList.map((s) => (
                      <tr
                        key={s.playerId}
                        className={s.isHuman ? 'bg-emerald-950/20 font-semibold' : 'hover:bg-slate-800/40'}
                      >
                        <td className="p-2.5 text-slate-200">
                          {s.isHuman ? '玩家 (Hero)' : s.playerName}
                        </td>
                        <td className="p-2.5 text-slate-300">{s.handsPlayed}</td>
                        <td
                          className={`p-2.5 font-bold ${
                            s.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {s.totalProfit >= 0 ? `+${s.totalProfit}` : s.totalProfit}
                        </td>
                        <td
                          className={`p-2.5 ${
                            s.bbPer100 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {s.bbPer100 >= 0 ? `+${s.bbPer100}` : s.bbPer100}
                        </td>
                        <td className="p-2.5 text-indigo-300">{s.vpip}%</td>
                        <td className="p-2.5 text-indigo-300">{s.pfr}%</td>
                        <td className="p-2.5 text-slate-300">{s.threeBetPercent}%</td>
                        <td className="p-2.5 text-slate-300">{s.cBetPercent}%</td>
                        <td className="p-2.5 text-purple-300">{s.wtsd}%</td>
                        <td className="p-2.5 text-purple-300">{s.wsd}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={onReset}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置統計數據
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
