import React from 'react';
import { BotDebugLog } from '../../store/usePokerStore';
import { Bot, Bug, Sparkles } from 'lucide-react';

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
          <span>Bot 決策除錯與思考日誌</span>
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
            尚無 Bot 決策紀錄。進行牌局後即可即時檢視各電腦玩家之 AI 思考細節與決策權重。
          </div>
        ) : (
          logs.map((log) => {
            const scores = log.decision.debugScores;
            return (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col gap-1.5 transition-all hover:border-indigo-500/40"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{log.playerName}</span>
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

                {/* Score breakdown if available */}
                {scores && (
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
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
