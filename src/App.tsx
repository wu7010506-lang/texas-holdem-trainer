import { useEffect } from "react";
import { usePokerStore } from "./store/usePokerStore";
import { PokerTable } from "./components/table/PokerTable";
import { HeroControls } from "./components/controls/HeroControls";
import { EquityDisplay } from "./components/EquityDisplay";

export default function App() {
  const {
    init,
    gameState,
    config,
    isBotThinking,
    error,
    startNewHand,
    executePlayerAction,
    rebuyHero,
  } = usePokerStore();
  useEffect(() => {
    init();
  }, [init]);
  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="./" aria-label="River 德州撲克首頁">
          <span className="brand-mark" aria-hidden="true">
            ♠
          </span>
          <span>
            <strong>
              RIVER<span className="brand-dot">.</span>
            </strong>
            <small>德州撲克</small>
          </span>
        </a>
        <div className="table-meta">
          <span className="live-dot" />
          六人桌
          <span className="meta-divider" />
          盲注 {config.smallBlind} / {config.bigBlind}
        </div>
        <span className="hand-number">
          第 <strong>{String(gameState.handId).padStart(2, "0")}</strong> 手
        </span>
      </header>
      <main className="game-layout">
        <div className="table-heading">
          <span>NO-LIMIT HOLD’EM</span>
          <span>專注這一手。</span>
        </div>
        <PokerTable gameState={gameState} heroSeat={config.heroSeat} />
        <section className="play-dock" aria-label="勝率與遊戲操作">
          <EquityDisplay gameState={gameState} heroSeat={config.heroSeat} />
          <HeroControls
            gameState={gameState}
            heroSeat={config.heroSeat}
            onAction={executePlayerAction}
            onNextHand={startNewHand}
            onRebuy={rebuyHero}
            isBotThinking={isBotThinking}
          />
        </section>
        {error && (
          <p className="game-error" role="alert">
            {error}
          </p>
        )}
      </main>
      <footer className="site-footer">
        <span>一張牌桌，一點進步。</span>
        <span>僅供練習 · 籌碼不具現金價值</span>
      </footer>
    </div>
  );
}
