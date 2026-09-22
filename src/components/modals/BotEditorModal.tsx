import React, { useState } from 'react';
import { BotProfile } from '../../bot/types';
import { DEFAULT_PROFILES } from '../../bot/defaultProfiles';
import { Bot, Copy, Download, RotateCcw, Save, Upload, X } from 'lucide-react';

interface BotEditorModalProps {
  profiles: Record<string, BotProfile>;
  onSave: (profile: BotProfile) => void;
  onClose: () => void;
}

export const BotEditorModal: React.FC<BotEditorModalProps> = ({
  profiles,
  onSave,
  onClose,
}) => {
  const profileKeys = Object.keys(profiles);
  const [selectedKey, setSelectedKey] = useState<string>(profileKeys[0] || 'tag');
  const [currentProfile, setCurrentProfile] = useState<BotProfile>({
    ...profiles[selectedKey],
  });
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSelectKey = (key: string) => {
    setSelectedKey(key);
    setCurrentProfile({ ...profiles[key] });
  };

  const handleChange = (field: keyof BotProfile, value: any) => {
    setCurrentProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleBetSizingChange = (tier: keyof BotProfile['betSizing'], value: number) => {
    setCurrentProfile((prev) => ({
      ...prev,
      betSizing: {
        ...prev.betSizing,
        [tier]: value,
      },
    }));
  };

  const handleSave = () => {
    onSave(currentProfile);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleClone = () => {
    const newId = `custom_${Date.now().toString().slice(-4)}`;
    const cloned: BotProfile = {
      ...currentProfile,
      id: newId,
      name: `${currentProfile.name} (複本)`,
    };
    onSave(cloned);
    setSelectedKey(newId);
    setCurrentProfile(cloned);
  };

  const handleReset = () => {
    if (DEFAULT_PROFILES[currentProfile.id]) {
      const original = { ...DEFAULT_PROFILES[currentProfile.id] };
      setCurrentProfile(original);
      onSave(original);
    }
  };

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentProfile, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${currentProfile.id}_profile.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as BotProfile;
        if (imported.name && imported.vpip !== undefined) {
          onSave(imported);
          setSelectedKey(imported.id);
          setCurrentProfile(imported);
        }
      } catch (err) {
        alert('匯入格式錯誤，請確認為有效的 JSON 設定檔。');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-slate-100">Bot 策略風格與參數編輯器</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Selector Toolbar */}
        <div className="p-3 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-semibold">選擇風格：</span>
            <select
              value={selectedKey}
              onChange={(e) => handleSelectKey(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-lg font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              {Object.values(profiles).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleClone}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 cursor-pointer"
              title="複製此風格為自訂設定檔"
            >
              <Copy className="w-3.5 h-3.5" />
              複製
            </button>
            <button
              onClick={handleReset}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 cursor-pointer"
              title="恢復官方預設值"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              重設預設
            </button>
            <button
              onClick={handleExport}
              className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 cursor-pointer"
              title="匯出為 JSON 檔"
            >
              <Download className="w-3.5 h-3.5" />
              匯出
            </button>
            <label className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              匯入
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Sliders Container */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Name & Description */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">風格名稱</label>
              <input
                type="text"
                value={currentProfile.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">風格特徵描述</label>
              <input
                type="text"
                value={currentProfile.description}
                onChange={(e) => handleChange('description', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200"
              />
            </div>
          </div>

          {/* Core Frequency Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
            {/* VPIP */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">VPIP (自願入池率)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.vpip * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.80"
                step="0.01"
                value={currentProfile.vpip}
                onChange={(e) => handleChange('vpip', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* PFR */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">PFR (翻牌前主動加注率)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.pfr * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.65"
                step="0.01"
                value={currentProfile.pfr}
                onChange={(e) => handleChange('pfr', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* 3-Bet */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">3-Bet 頻率 (再加注率)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.threeBetFrequency * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.40"
                step="0.01"
                value={currentProfile.threeBetFrequency}
                onChange={(e) => handleChange('threeBetFrequency', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Aggression */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">激進指數 (Aggression Factor)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.aggression * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.01"
                value={currentProfile.aggression}
                onChange={(e) => handleChange('aggression', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Bluff Frequency */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">翻後詐唬頻率 (Bluff)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.bluffFrequency * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.50"
                step="0.01"
                value={currentProfile.bluffFrequency}
                onChange={(e) => handleChange('bluffFrequency', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Continuation Bet */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">持續下注率 (C-Bet)</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.continuationBet * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="1.00"
                step="0.01"
                value={currentProfile.continuationBet}
                onChange={(e) => handleChange('continuationBet', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Fold to C-Bet */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">面對 C-Bet 棄牌率</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.foldToCBet * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="0.90"
                step="0.01"
                value={currentProfile.foldToCBet}
                onChange={(e) => handleChange('foldToCBet', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* River Bluff */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-semibold">河牌詐唬開火率</span>
                <span className="text-indigo-400 font-bold">{(currentProfile.riverBluffFrequency * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.01"
                max="0.45"
                step="0.01"
                value={currentProfile.riverBluffFrequency}
                onChange={(e) => handleChange('riverBluffFrequency', parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Bet Sizing Tiers */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-2">
            <span className="text-slate-200 font-bold">下注尺度偏好 (% 底池比例)</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-400 block mb-1">小注 (乾燥面 / C-Bet)</span>
                <span className="text-amber-400 font-bold mb-1 block">{(currentProfile.betSizing.small * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.20"
                  max="0.50"
                  step="0.01"
                  value={currentProfile.betSizing.small}
                  onChange={(e) => handleBetSizingChange('small', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">中注 (標準價值下注)</span>
                <span className="text-amber-400 font-bold mb-1 block">{(currentProfile.betSizing.medium * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.50"
                  max="0.80"
                  step="0.01"
                  value={currentProfile.betSizing.medium}
                  onChange={(e) => handleBetSizingChange('medium', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">大注 (潮濕面 / 強牌價值)</span>
                <span className="text-amber-400 font-bold mb-1 block">{(currentProfile.betSizing.large * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="0.75"
                  max="1.25"
                  step="0.01"
                  value={currentProfile.betSizing.large}
                  onChange={(e) => handleBetSizingChange('large', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">超額下注 (極化施壓)</span>
                <span className="text-amber-400 font-bold mb-1 block">{(currentProfile.betSizing.overbet * 100).toFixed(0)}%</span>
                <input
                  type="range"
                  min="1.25"
                  max="2.50"
                  step="0.05"
                  value={currentProfile.betSizing.overbet}
                  onChange={(e) => handleBetSizingChange('overbet', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between">
          <div className="text-emerald-400 font-semibold">
            {savedNotice && <span>✓ 設定已儲存成功！</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              關閉
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Save className="w-4 h-4" />
              儲存風格設定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
