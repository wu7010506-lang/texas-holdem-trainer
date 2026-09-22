import React, { useState } from 'react';
import { HandHistoryFormatter, HandHistoryRecord } from '../../history/HandHistory';
import { Check, Clipboard, Play, X, FileText, Code } from 'lucide-react';

interface HandHistoryModalProps {
  hands: HandHistoryRecord[];
  onClose: () => void;
  onSelectReplay: (hand: HandHistoryRecord) => void;
}

export const HandHistoryModal: React.FC<HandHistoryModalProps> = ({
  hands,
  onClose,
  onSelectReplay,
}) => {
  const [selectedHand, setSelectedHand] = useState<HandHistoryRecord | null>(
    hands.length > 0 ? hands[0] : null
  );
  const [viewMode, setViewMode] = useState<'text' | 'json'>('text');
  const [copied, setCopied] = useState(false);

  const formattedText = selectedHand ? HandHistoryFormatter.toText(selectedHand) : '';
  const formattedJson = selectedHand ? JSON.stringify(selectedHand, null, 2) : '';

  const handleCopy = () => {
    const content = viewMode === 'text' ? formattedText : formattedJson;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">歷史手牌牌譜庫</h2>
            <span className="text-xs text-slate-400">(已保存 {hands.length} 手牌)</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Hands list */}
          <div className="w-1/3 border-r border-slate-800 overflow-y-auto p-2 flex flex-col gap-1.5">
            {hands.length === 0 ? (
              <div className="text-slate-500 p-4 text-center text-xs italic">
                尚無歷史紀錄。進行幾手牌後將自動列於此處。
              </div>
            ) : (
              hands.map((h) => {
                const isSelected = selectedHand?.handId === h.handId;
                const winnerNames = h.winners.map((w) => {
                  const p = h.players.find((pl) => pl.id === w.playerId);
                  return p?.isHuman ? '玩家 (Hero)' : (p?.name || w.playerId);
                }).join(', ');

                return (
                  <button
                    key={h.handId}
                    onClick={() => setSelectedHand(h)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-emerald-500/80 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold mb-1">
                      <span className="text-emerald-400">第 #{h.handId} 手</span>
                      <span className="text-amber-400 font-extrabold">{h.totalPot} 籌碼</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      獲勝者: {winnerNames}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(h.timestamp).toLocaleTimeString()}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: Selected hand details */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden bg-slate-950/40">
            {selectedHand ? (
              <>
                {/* Action bar for selected hand */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewMode('text')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                        viewMode === 'text'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      文字牌譜
                    </button>
                    <button
                      onClick={() => setViewMode('json')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                        viewMode === 'json'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Code className="w-3.5 h-3.5" />
                      JSON 資料
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                      {copied ? '已複製！' : '複製內容'}
                    </button>

                    <button
                      onClick={() => onSelectReplay(selectedHand)}
                      className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      重播此局 (Replay)
                    </button>
                  </div>
                </div>

                {/* Content preview */}
                <pre className="flex-1 overflow-auto bg-slate-950 p-4 rounded-xl text-xs font-mono text-slate-300 border border-slate-800 leading-relaxed whitespace-pre-wrap select-text">
                  {viewMode === 'text' ? formattedText : formattedJson}
                </pre>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
                從左側列表中點選任一手牌即可查看完整牌譜。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
