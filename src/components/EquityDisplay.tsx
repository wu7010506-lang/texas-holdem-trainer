import { useEffect, useState } from "react";
import { GameState } from "../engine/types";
import { EquityCalculationResult } from "../bot/EquityCalculator";
import { createEquityRequest } from "../equity/createEquityRequest";

interface Calculation {
  id: string;
  result?: EquityCalculationResult;
  error?: boolean;
}

export function EquityDisplay({
  gameState,
  heroSeat,
}: {
  gameState: GameState;
  heroSeat: number;
}) {
  const request = createEquityRequest(gameState, heroSeat);
  const id = request ? JSON.stringify(request) : "";
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  useEffect(() => {
    if (!id) return;
    // Termination cancels superseded calculations; outdated results cannot replace a new hand.
    const worker = new Worker(
      new URL("../equity/equity.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.onmessage = (event: MessageEvent<Calculation>) =>
      setCalculation(event.data);
    worker.onerror = () => setCalculation({ id, error: true });
    worker.postMessage({ id, request: JSON.parse(id) });
    return () => worker.terminate();
  }, [id]);
  const result = calculation?.id === id ? calculation.result : undefined;
  const failed = calculation?.id === id && calculation.error;
  const value = result ? result.equity * 100 : undefined;
  const hero = gameState.players[heroSeat];
  const label = hero?.folded
    ? "已棄牌"
    : gameState.handComplete
      ? "本手結束"
      : failed
        ? "暫時無法計算"
        : "計算中";
  return (
    <div className="equity-panel" aria-label="即時勝率估計">
      <div className="equity-ring">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="ring-track" cx="50" cy="50" r="43" />
          <circle
            className="ring-value"
            cx="50"
            cy="50"
            r="43"
            strokeDasharray={`${(value ?? 0) * 2.702} 270.2`}
          />
        </svg>
        <span>
          {value !== undefined ? (
            <>
              <strong>{value.toFixed(0)}</strong>
              <small>%</small>
            </>
          ) : (
            <span className="equity-empty">—</span>
          )}
        </span>
      </div>
      <div className="equity-copy">
        <span className="dock-eyebrow">勝率估計</span>
        <strong>{value !== undefined ? `${value.toFixed(1)}%` : label}</strong>
        <p>對未知手牌 · 含平手分池</p>
        <span className="equity-note">
          預期底池份額
          {result ? ` · ±${(result.marginOfError * 100).toFixed(1)}%` : ""}
        </span>
      </div>
    </div>
  );
}
