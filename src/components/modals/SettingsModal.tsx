import React, { useState } from 'react';
import { GameConfig } from '../../engine/types';
import { RotateCcw, Save, Settings, X } from 'lucide-react';

interface SettingsModalProps {
  config: GameConfig;
  onSave: (config: Partial<GameConfig>) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ config, onSave, onClose }) => {
  const [playerCount, setPlayerCount] = useState(config.playerCount);
  const [startingStack, setStartingStack] = useState(config.startingStack);
  const [smallBlind, setSmallBlind] = useState(config.smallBlind);
  const [bigBlind, setBigBlind] = useState(config.bigBlind);
  const [botThinkTime, setBotThinkTime] = useState(config.botThinkTime);
  const [autoNextHand, setAutoNextHand] = useState(config.autoNextHand);
  const [randomSeed, setRandomSeed] = useState<number | undefined>(config.randomSeed);

  const handleSave = () => {
    onSave({
      playerCount,
      startingStack,
      smallBlind,
      bigBlind,
      botThinkTime,
      autoNextHand,
      randomSeed: randomSeed ? Number(randomSeed) : undefined,
    });
    onClose();
  };

  const handleResetDefaults = () => {
    setPlayerCount(6);
    setStartingStack(1000);
    setSmallBlind(5);
    setBigBlind(10);
    setBotThinkTime(600);
    setAutoNextHand(false);
    setRandomSeed(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">遊戲與牌桌規則設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Table Size */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">
              牌桌人數配置 (Player Count)
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: '單挑 (HU 2人)', count: 2 },
                { label: '3人桌', count: 3 },
                { label: '4人桌', count: 4 },
                { label: '6-Max (預設)', count: 6 },
                { label: '8人桌', count: 8 },
                { label: '9人滿桌', count: 9 },
              ].map((opt) => (
                <button
                  key={opt.count}
                  type="button"
                  onClick={() => setPlayerCount(opt.count)}
                  className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                    playerCount === opt.count
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stacks & Blinds */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">起始籌碼 (Chips)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={startingStack}
                onChange={(e) => setStartingStack(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-bold text-amber-400"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">小盲 (Small Blind)</label>
              <input
                type="number"
                min="1"
                value={smallBlind}
                onChange={(e) => setSmallBlind(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-bold text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">大盲 (Big Blind)</label>
              <input
                type="number"
                min="2"
                value={bigBlind}
                onChange={(e) => setBigBlind(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-bold text-slate-200"
              />
            </div>
          </div>

          {/* Bot Think Speed */}
          <div>
            <label className="text-slate-300 font-semibold block mb-1">電腦 Bot 思考延遲速度</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '極速 (0ms)', time: 0 },
                { label: '快速 (300ms)', time: 300 },
                { label: '標準 (600ms)', time: 600 },
                { label: '擬真 (1200ms)', time: 1200 },
              ].map((spd) => (
                <button
                  key={spd.time}
                  type="button"
                  onClick={() => setBotThinkTime(spd.time)}
                  className={`p-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                    botThinkTime === spd.time
                      ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {spd.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auto Next Hand & Random Seed */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-300 font-medium">結算後自動進入下一手牌</span>
              <button
                type="button"
                onClick={() => setAutoNextHand(!autoNextHand)}
                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                  autoNextHand ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    autoNextHand ? 'left-6.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium">隨機種子 (PRNG Seed，除錯重現用)</label>
              <input
                type="number"
                placeholder="留空即為一般隨機洗牌"
                value={randomSeed ?? ''}
                onChange={(e) => setRandomSeed(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-between items-center">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            恢復預設值
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Save className="w-4 h-4" />
              套用設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
