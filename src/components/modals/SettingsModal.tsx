import React, { useState } from 'react';
import { GameConfig } from '../../engine/types';
import { RotateCcw, Save, Settings, X, Zap, ShieldAlert, Cpu } from 'lucide-react';
import { OpponentModel } from '../../bot/strategies/elite/adaptive/OpponentModel';

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
  const [botType, setBotType] = useState<'RULE_BASED' | 'ELITE'>(config.botType || 'ELITE');
  const [eliteMode, setEliteMode] = useState<'BALANCED' | 'ADAPTIVE'>(config.eliteMode || 'BALANCED');

  const oppModel = OpponentModel.getInstance();
  const heroHands = oppModel.getStats().handsPlayed;
  const confidence = oppModel.getConfidence();

  const handleSave = () => {
    onSave({
      playerCount,
      startingStack,
      smallBlind,
      bigBlind,
      botThinkTime,
      autoNextHand,
      botType,
      eliteMode,
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
    setBotType('ELITE');
    setEliteMode('BALANCED');
    setRandomSeed(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-slate-100">遊戲與 AI 規則設定</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
          {/* AI Strategy Engine Selection */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-2.5">
            <label className="text-slate-200 font-bold flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>電腦對手 AI 策略引擎</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBotType('RULE_BASED')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 cursor-pointer transition-all ${
                  botType === 'RULE_BASED'
                    ? 'bg-slate-800 border-indigo-500 text-slate-100'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="font-bold">一般 AI (Rule-Based)</span>
                <span className="text-[10px] text-slate-400">傳統風格模型 (Nit, TAG, LAG, Calling Station)</span>
              </button>

              <button
                type="button"
                onClick={() => setBotType('ELITE')}
                className={`p-2.5 rounded-xl border text-left flex flex-col gap-0.5 cursor-pointer transition-all ${
                  botType === 'ELITE'
                    ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1 font-bold text-indigo-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>菁英 AI (Elite V1)</span>
                </div>
                <span className="text-[10px] text-slate-400">GTO-Inspired 範圍對範圍、阻擋牌分析與混合策略</span>
              </button>
            </div>

            {/* Elite Bot Sub-Settings */}
            {botType === 'ELITE' && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">菁英策略模式：</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="eliteMode"
                        value="BALANCED"
                        checked={eliteMode === 'BALANCED'}
                        onChange={() => setEliteMode('BALANCED')}
                        className="accent-indigo-500"
                      />
                      <span>平衡模式 (純 GTO-Baseline)</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="radio"
                        name="eliteMode"
                        value="ADAPTIVE"
                        checked={eliteMode === 'ADAPTIVE'}
                        onChange={() => setEliteMode('ADAPTIVE')}
                        className="accent-indigo-500"
                      />
                      <span>自適應模式 (Hero 數據剝削)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-2.5 border border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div>
                    <span className="text-slate-400 block">目前 Hero 樣本</span>
                    <strong className="text-slate-200 text-xs">{heroHands} 手</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">模型信心水準</span>
                    <strong className={confidence.tier === 'HIGH' ? 'text-emerald-400' : 'text-amber-400'}>
                      {confidence.tier === 'VERY_LOW' ? '不足 (<100手)' : confidence.tier === 'LOW' ? '低' : confidence.tier === 'MEDIUM' ? '中等' : '高'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">最大策略調整</span>
                    <strong className="text-indigo-300 text-xs">15% (嚴格鎖定)</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

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
