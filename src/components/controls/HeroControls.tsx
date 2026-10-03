import { useState } from "react";
import { GameState, PlayerAction } from "../../engine/types";

interface HeroControlsProps {
  gameState: GameState;
  heroSeat: number;
  onAction: (action: PlayerAction) => void;
  onNextHand: () => void;
  onRebuy: () => void;
  isBotThinking: boolean;
}

export function HeroControls({
  gameState: state,
  heroSeat,
  onAction,
  onNextHand,
  onRebuy,
  isBotThinking,
}: HeroControlsProps) {
  const hero = state.players[heroSeat];
  const key = `${state.handId}:${state.street}:${state.currentBet}:${hero?.currentBet}:${state.currentPlayerSeat}`;
  if (state.handComplete)
    return (
      <div className="action-panel hand-finished">
        <div>
          <span className="dock-eyebrow">下一手，重新出發</span>
          <h2>
            {hero.stack <= 0 ? "籌碼用完了，補充後再練習。" : "這一手已結束。"}
          </h2>
        </div>
        <button
          className="button button-primary next-hand"
          onClick={hero.stack <= 0 ? onRebuy : onNextHand}
        >
          {hero.stack <= 0 ? "補充籌碼並發牌" : "發下一手"}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
    );
  if (state.currentPlayerSeat !== heroSeat || isBotThinking)
    return (
      <div className="action-panel waiting-panel">
        <span className="thinking-indicator">
          <i />
          <i />
          <i />
        </span>
        <div>
          <span className="dock-eyebrow">
            {hero.folded ? "你已棄牌" : hero.allIn ? "你已全押" : "牌局進行中"}
          </span>
          <h2>等待對手行動</h2>
          <p>下一個決定，交給你。</p>
        </div>
      </div>
    );
  return <ActionChoices key={key} state={state} onAction={onAction} />;
}

function ActionChoices({
  state,
  onAction,
}: {
  state: GameState;
  onAction: (action: PlayerAction) => void;
}) {
  const legal = state.legalActions!;
  const min = legal.canBet ? legal.minBet : legal.minRaise;
  const max = legal.canBet ? legal.maxBet : legal.maxRaise;
  const [draft, setDraft] = useState(String(min));
  const number = Number(draft);
  const amount = Math.max(
    min,
    Math.min(max, Number.isFinite(number) ? Math.round(number) : min),
  );
  const canSize = legal.canBet || legal.canRaise;
  const applyFraction = (fraction: number) => {
    const target = legal.canBet
      ? state.pot * fraction
      : state.currentBet + (state.pot + legal.callAmount) * fraction;
    setDraft(String(Math.max(min, Math.min(max, Math.round(target)))));
  };
  return (
    <div className="action-panel">
      <div className="action-heading">
        <span className="dock-eyebrow">你的回合</span>
        <span>
          {legal.canCheck
            ? state.street === "RIVER" ? "可以過牌攤牌" : "可以免費看下一張牌"
            : `跟注需 ${legal.callAmount.toLocaleString()} 籌碼`}
        </span>
      </div>
      {canSize && (
        <div className="sizing-controls">
          <div className="sizing-presets">
            {[0.5, 0.75, 1].map((fraction, i) => (
              <button key={fraction} onClick={() => applyFraction(fraction)}>
                {["½ 底池", "¾ 底池", "滿池"][i]}
              </button>
            ))}
          </div>
          <input
            aria-label={legal.canBet ? "下注籌碼" : "加注至籌碼"}
            type="number"
            min={min}
            max={max}
            step="1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => setDraft(String(amount))}
          />
          <input
            aria-label="調整下注金額"
            type="range"
            min={min}
            max={max}
            step="1"
            value={amount}
            onChange={(e) => setDraft(e.target.value)}
          />
        </div>
      )}
      <div className="action-buttons">
        <button
          className="button button-fold"
          disabled={!legal.canFold}
          onClick={() => onAction({ type: "FOLD" })}
        >
          棄牌<small>FOLD</small>
        </button>
        <button
          className="button button-call"
          disabled={!legal.canCheck && !legal.canCall}
          onClick={() =>
            onAction(
              legal.canCheck
                ? { type: "CHECK" }
                : { type: "CALL", amount: legal.callAmount },
            )
          }
        >
          {legal.canCheck ? "過牌" : "跟注"}
          <small>
            {legal.canCheck ? "CHECK" : legal.callAmount.toLocaleString()}
          </small>
        </button>
        {canSize && (
          <button
            className="button button-primary"
            onClick={() =>
              onAction({ type: legal.canBet ? "BET" : "RAISE", amount })
            }
          >
            {legal.canBet ? "下注" : "加注至"}
            <small>{amount.toLocaleString()}</small>
          </button>
        )}
        <button
          className="button button-allin"
          disabled={!legal.canAllIn}
          onClick={() =>
            onAction({ type: "ALL_IN", amount: legal.allInAmount })
          }
        >
          全押<small>ALL IN</small>
        </button>
      </div>
    </div>
  );
}
