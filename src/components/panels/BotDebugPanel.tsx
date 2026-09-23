import React from 'react';
import { BotDebugLog } from '../../store/usePokerStore';
import { Bot, Bug, Sparkles, Shield, Target, Zap } from 'lucide-react';
import { EliteDecisionTrace } from '../../bot/strategies/elite/types';

interface BotDebugPanelProps {
  logs: BotDebugLog[];
  onClear: () => void;
}

export const BotDebugPanel: React.FC<BotDebugPanelProps> = ({ logs, onClear }) => {
  const actionMap: Record<string, string> = {
    FOLD: '棄牌 (Fold)',
    CHECK: '過牌 (Check)',
    CALL: '跟注 (Call)',
    BET: '下注 (Bet)',
    RAISE: '加注 (Raise)',
    ALL_IN: '全押 (All-in)',
  };

  const streetMap: Record<string, string> = {
    PREFLOP: '翻牌前',
    FLOP: '翻牌圈',
    TURN: '轉牌圈',
    RIVER: '河牌圈',
    SHOWDOWN: '攤牌',
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-3 text-xs max-h-[600px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
          <Bug className="w-4 h-4" />
          <span>AI 決策除錯與遙測日誌</span>
        </div>
        {logs.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            清空紀錄
          </button>
        )}
      </div>

      {/* Logs List */}
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
        {logs.length === 0 ? (
          <div className="text-slate-500 py-8 text-center italic text-[11px]">
            尚無 Bot 決策紀錄。進行牌局後即可即時檢視電腦玩家（包含一般 AI 與菁英 AI）之思考細節與遙測資料。
          </div>
        ) : (
          logs.map((log) => {
            const trace = log.decision.debugTrace as EliteDecisionTrace | undefined;
            const scores = log.decision.debugScores;

            return (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2 transition-all hover:border-indigo-500/40"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{log.playerName}</span>
                    {trace && (
                      <span className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded text-[10px] font-semibold flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" /> 菁英 AI (Elite V1)
                      </span>
                    )}
                    <span className="text-[10px] text-slate-500 font-normal">
                      第 {log.handId} 手 • {streetMap[log.street] || log.street}
                    </span>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                      log.decision.action === 'FOLD'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : log.decision.action === 'CHECK'
                        ? 'bg-blue-950 text-blue-300 border border-blue-800'
                        : log.decision.action === 'CALL'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {actionMap[log.decision.action] || log.decision.action} {log.decision.amount ? log.decision.amount : ''}
                  </span>
                </div>

                {/* Reasoning text */}
                <div className="text-slate-300 text-[11px] bg-slate-900/60 p-2 rounded-lg border border-slate-800/50 flex items-start gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{log.decision.reasoning}</span>
                </div>

                {/* Elite Bot Detailed Telemetry */}
                {trace ? (
                  <div className="bg-slate-900/80 rounded-lg p-2.5 border border-indigo-950/60 flex flex-col gap-2 text-[11px]">
                    <div className="text-indigo-300 font-bold flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      <span>Elite Bot 決策分析 (GTO-Inspired)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-400">
                      <div>
                        <span>估計對手範圍：</span>
                        <strong className="text-slate-200">{trace.estimatedHeroRange}</strong>
                      </div>
                      <div>
                        <span>目前 Hand vs Range 勝率：</span>
                        <strong className="text-emerald-400">{(trace.absoluteEquity * 100).toFixed(1)}%</strong>
                      </div>
                      <div>
                        <span>範圍優勢 (Range Adv)：</span>
                        <strong className={trace.rangeAdvantage === 'HIGH' || trace.rangeAdvantage === 'SLIGHT_HIGH' ? 'text-emerald-400' : 'text-amber-400'}>
                          {trace.rangeAdvantage === 'HIGH' ? '顯著優勢' : trace.rangeAdvantage === 'SLIGHT_HIGH' ? '微幅優勢' : trace.rangeAdvantage === 'LOW' ? '居於劣勢' : '均勢'}
                        </strong>
                      </div>
                      <div>
                        <span>堅果優勢 (Nut Adv)：</span>
                        <strong className={trace.nutAdvantage === 'HIGH' ? 'text-emerald-400' : 'text-slate-300'}>
                          {trace.nutAdvantage === 'HIGH' ? '高 (適合兩極化大注)' : trace.nutAdvantage === 'LOW' ? '低 (避被超池)' : '中等'}
                        </strong>
                      </div>
                      <div>
                        <span>阻擋牌評分：</span>
                        <strong className={trace.blockerScore > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                          {trace.blockerScore.toFixed(2)} (詐唬候選分 {(trace.bluffCandidateScore * 100).toFixed(0)}%)
                        </strong>
                      </div>
                      <div>
                        <span>隨機骰點 (Seeded Roll)：</span>
                        <strong className="text-indigo-300">{(trace.randomRoll * 100).toFixed(2)}%</strong>
                      </div>
                    </div>

                    {/* Action Distribution Breakdown */}
                    <div className="pt-1.5 border-t border-slate-800 flex flex-col gap-1">
                      <div className="flex justify-between text-slate-400">
                        <span>基準策略分佈：</span>
                        <span className="text-slate-200 font-mono">
                          {trace.baseDistribution.actions.map((a) => `${a.action} ${(a.probability * 100).toFixed(0)}%`).join(' | ')}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Hero 模型調整：</span>
                        <span className="text-amber-300">{trace.exploitAdjustmentText}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-300">
                        <span>最終策略：</span>
                        <span className="text-emerald-400 font-mono">
                          {trace.finalStrategy.actions.map((a) => `${a.action} ${(a.probability * 100).toFixed(0)}%`).join(' | ')}
                        </span>
                      </div>
                    </div>

                    {/* Reason Codes Badges */}
                    {trace.reasonCodes && trace.reasonCodes.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-800">
                        {trace.reasonCodes.map((rc, idx) => (
                          <span
                            key={idx}
                            className="bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-1.5 py-0.5 rounded text-[9px] font-mono"
                          >
                            #{rc}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : scores ? (
                  /* Standard Rule-based Score breakdown */
                  <div className="grid grid-cols-4 gap-1 text-[10px] text-center pt-1 border-t border-slate-800/60 text-slate-400">
                    <div>
                      <span>棄牌評分: </span>
                      <strong className="text-rose-400">{(scores.foldScore * 100).toFixed(0)}%</strong>
                    </div>
                    <div>
                      <span>跟注評分: </span>
                      <strong className="text-blue-400">{(scores.callScore * 100).toFixed(0)}%</strong>
                    </div>
                    <div>
                      <span>加注評分: </span>
                      <strong className="text-amber-400">{(scores.raiseScore * 100).toFixed(0)}%</strong>
                    </div>
                    <div>
                      <span>隨機骰點: </span>
                      <strong className="text-slate-200">{(scores.randomRoll * 100).toFixed(0)}%</strong>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
