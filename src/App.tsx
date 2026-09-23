import React, { useEffect, useState } from 'react';
import { usePokerStore } from './store/usePokerStore';
import { PokerTable } from './components/table/PokerTable';
import { HeroControls } from './components/controls/HeroControls';
import { TrainingPanel } from './components/panels/TrainingPanel';
import { BotDebugPanel } from './components/panels/BotDebugPanel';
import { HandHistoryModal } from './components/modals/HandHistoryModal';
import { ReplayModal } from './components/modals/ReplayModal';
import { BotEditorModal } from './components/modals/BotEditorModal';
import { StatsModal } from './components/modals/StatsModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { HeroLeakModal } from './components/modals/HeroLeakModal';
import {
  Activity,
  BarChart3,
  Bot,
  Bug,
  FileText,
  Settings,
  ShieldAlert,
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    init,
    gameState,
    config,
    profiles,
    stats,
    handHistories,
    selectedHandForReplay,
    isBotThinking,
    botDebugLogs,
    activeModal,
    startNewHand,
    executePlayerAction,
    updateConfig,
    saveProfile,
    rebuyHero,
    openModal,
    closeModal,
    selectHandForReplay,
    clearHistory,
  } = usePokerStore();

  const [activeSideTab, setActiveSideTab] = useState<'training' | 'debug'>('training');
  const [showSidePanel, setShowSidePanel] = useState<boolean>(true);

  useEffect(() => {
    init();
  }, [init]);

  const hero = gameState.players[config.heroSeat];
  const heroStats = stats[hero?.id || ''];
  const sessionProfit = heroStats ? heroStats.totalProfit : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* Top Navbar */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-4 flex items-center justify-between sticky top-0 z-30">
        {/* Brand Logo & Hand Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-black text-lg text-slate-950 shadow-md">
              ♠
            </div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              德州撲克單人訓練平台
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-800 text-xs">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
              第 #{gameState.handId} 手
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              盲注: {config.smallBlind} / {config.bigBlind}
            </span>
            <span
              className={`px-2 py-0.5 rounded font-bold ${
                sessionProfit >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              本場淨利: {sessionProfit >= 0 ? `+${sessionProfit}` : sessionProfit}
            </span>
          </div>
        </div>

        {/* Action Controls / Modals Navigation */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Side panel toggle */}
          <button
            onClick={() => {
              setActiveSideTab('training');
              setShowSidePanel((prev) => !prev || activeSideTab !== 'training');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showSidePanel && activeSideTab === 'training'
                ? 'bg-emerald-600 text-white shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="開啟/收合 訓練 HUD"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">訓練 HUD</span>
          </button>

          <button
            onClick={() => {
              setActiveSideTab('debug');
              setShowSidePanel((prev) => !prev || activeSideTab !== 'debug');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showSidePanel && activeSideTab === 'debug'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
            title="開啟/收合 Bot 決策分析"
          >
            <Bug className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bot 分析</span>
          </button>

          {/* Hand History Modal trigger */}
          <button
            onClick={() => openModal('HAND_HISTORY')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="歷史手牌牌譜與重播"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">牌譜歷史</span>
          </button>

          {/* Bot Editor Modal trigger */}
          <button
            onClick={() => openModal('BOT_EDITOR')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="調整電腦 Bot 策略與風格"
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Bot 編輯</span>
          </button>

          {/* Statistics Modal trigger */}
          <button
            onClick={() => openModal('STATS')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="查看生涯統計數據"
          >
            <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden md:inline">統計報表</span>
          </button>

          {/* Hero Leak Report trigger */}
          <button
            onClick={() => openModal('LEAK_REPORT')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/70 border border-amber-800/80 text-amber-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="查看 Apex Bot 針對您的弱點診斷報告"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">弱點診斷</span>
          </button>

          {/* Settings Modal trigger */}
          <button
            onClick={() => openModal('SETTINGS')}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="牌桌規則與盲注設定"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden md:inline">設定</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-4 gap-4 max-w-[1700px] w-full mx-auto">
        {/* Left / Center Area: Table & Controls */}
        <section className="flex-1 flex flex-col items-center justify-between gap-4 overflow-y-auto">
          {/* Poker Table Felt View */}
          <div className="w-full flex-1 flex items-center justify-center">
            <PokerTable
              gameState={gameState}
              heroSeat={config.heroSeat}
              bigBlind={config.bigBlind}
              profiles={profiles}
            />
          </div>

          {/* Hero Action Controls Dock */}
          <div className="w-full sticky bottom-0 z-20 pb-2">
            <HeroControls
              gameState={gameState}
              heroSeat={config.heroSeat}
              onAction={executePlayerAction}
              onNextHand={startNewHand}
              onRebuy={rebuyHero}
              isBotThinking={isBotThinking}
            />
          </div>
        </section>

        {/* Right Collapsible Panel: Training HUD / Bot Decision Debug */}
        {showSidePanel && (
          <aside className="w-full lg:w-96 shrink-0 flex flex-col gap-3">
            {/* Tab switch */}
            <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                onClick={() => setActiveSideTab('training')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSideTab === 'training'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                即時訓練 HUD
              </button>
              <button
                onClick={() => setActiveSideTab('debug')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  activeSideTab === 'debug'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                Bot 決策思考 ({botDebugLogs.length})
              </button>
            </div>

            {/* Panel views */}
            {activeSideTab === 'training' ? (
              <TrainingPanel
                gameState={gameState}
                heroSeat={config.heroSeat}
                bigBlind={config.bigBlind}
              />
            ) : (
              <BotDebugPanel
                logs={botDebugLogs}
                onClear={clearHistory}
              />
            )}
          </aside>
        )}
      </main>

      {/* Modals Layer */}
      {activeModal === 'HAND_HISTORY' && (
        <HandHistoryModal
          hands={handHistories}
          onClose={closeModal}
          onSelectReplay={selectHandForReplay}
        />
      )}

      {activeModal === 'REPLAY' && selectedHandForReplay && (
        <ReplayModal
          hand={selectedHandForReplay}
          onClose={closeModal}
        />
      )}

      {activeModal === 'BOT_EDITOR' && (
        <BotEditorModal
          profiles={profiles}
          onSave={saveProfile}
          onClose={closeModal}
        />
      )}

      {activeModal === 'STATS' && (
        <StatsModal
          stats={stats}
          onClose={closeModal}
          onReset={() => {
            usePokerStore.setState({ stats: {} });
          }}
        />
      )}

      {activeModal === 'SETTINGS' && (
        <SettingsModal
          config={config}
          onSave={(newCfg) => {
            updateConfig(newCfg);
            startNewHand();
          }}
          onClose={closeModal}
          onOpenLeakReport={() => openModal('LEAK_REPORT')}
        />
      )}

      {activeModal === 'LEAK_REPORT' && (
        <HeroLeakModal onClose={closeModal} />
      )}
    </div>
  );
};

export default App;
