import { create } from "zustand";
import {
  GameConfig,
  GameState,
  PlayerAction,
  PlayerState,
} from "../engine/types";
import { PokerGame } from "../engine/PokerGame";
import { buildBotContext, publicActionHistory } from "../bot/buildBotContext";
import { clampBotDecision } from "../bot/clampBotDecision";
import { ExpertTable } from "../bot/expert/ExpertTable";

interface PokerStore {
  game: PokerGame;
  config: GameConfig;
  gameState: GameState;
  isBotThinking: boolean;
  error: string | null;
  init: () => void;
  startNewHand: () => void;
  executePlayerAction: (action: PlayerAction) => void;
  rebuyHero: () => void;
  processBotTurns: () => Promise<void>;
  dispose: () => void;
}

export const DEFAULT_CONFIG: GameConfig = {
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
  playerCount: 6,
  heroSeat: 0,
  botThinkTime: 450,
  autoNextHand: false,
  showPotOdds: false,
  showHandStrength: false,
  showBotReasoning: false,
  showEstimatedEquity: true,
  botType: "EXPERT",
};

/** One session owns one engine and one turn runner. React never mutates an engine snapshot. */
export function createPokerStore(overrides: Partial<GameConfig> = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const profiles = [
    "expert-balanced",
    "expert-pressure",
    "expert-positional",
    "expert-polarized",
    "expert-adaptive",
  ];
  const names = ["Alex", "Blake", "Charlie", "Drew", "Ellis"];
  const players: PlayerState[] = Array.from(
    { length: config.playerCount },
    (_, seat) => ({
      id: `p${seat}`,
      name:
        seat === config.heroSeat
          ? "Hero"
          : names[(seat + names.length - 1) % names.length],
      seat,
      isHuman: seat === config.heroSeat,
      stack: config.startingStack,
      holeCards: [],
      currentBet: 0,
      totalBetThisHand: 0,
      folded: false,
      allIn: false,
      acted: false,
      position: "",
      botProfileId:
        seat === config.heroSeat
          ? undefined
          : profiles[(seat + profiles.length - 1) % profiles.length],
    }),
  );
  const game = new PokerGame(config, players);
  const table = new ExpertTable();
  let initialized = false;
  let running = false;
  let disposed = false;
  return create<PokerStore>((set, get) => ({
    game,
    config,
    gameState: game.getState(),
    isBotThinking: false,
    error: null,
    init: () => {
      if (initialized || disposed) return;
      initialized = true;
      get().startNewHand();
    },
    startNewHand: () => {
      if (disposed || running || !get().gameState.handComplete) return;
      if (game.getState().players[config.heroSeat].stack <= 0) return;
      try {
        table.observe(publicActionHistory(game.getState().actionHistory));
        set({ gameState: game.startNewHand(), error: null });
        void get().processBotTurns();
      } catch (error) {
        set({
          error:
            error instanceof Error
              ? error.message
              : "發牌失敗，請重新整理後再試。",
        });
      }
    },
    executePlayerAction: (action) => {
      const state = get().gameState;
      if (
        disposed ||
        running ||
        state.handComplete ||
        state.currentPlayerSeat !== config.heroSeat
      )
        return;
      try {
        set({ gameState: game.applyAction(action), error: null });
        void get().processBotTurns();
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : "無法執行此動作。",
        });
      }
    },
    rebuyHero: () => {
      if (disposed || running || !get().gameState.handComplete) return;
      set({ gameState: game.rebuyPlayer(config.heroSeat), error: null });
      get().startNewHand();
    },
    processBotTurns: async () => {
      if (running || disposed) return;
      running = true;
      try {
        while (true) {
          const state = game.getState();
          const player = state.players[state.currentPlayerSeat];
          if (state.handComplete || !player || player.isHuman) break;
          set({ isBotThinking: true });
          if (config.botThinkTime > 0)
            await new Promise((resolve) =>
              setTimeout(resolve, config.botThinkTime),
            );
          const current = game.getState();
          if (
            disposed ||
            current.handId !== state.handId ||
            current.currentPlayerSeat !== player.seat ||
            current.handComplete
          )
            break;
          const context = buildBotContext(current, player.seat);
          const decision = clampBotDecision(
            await table.decide(
              context,
              (player.seat + profiles.length - 1) % profiles.length,
            ),
            context.legalActions,
          );
          if (
            disposed ||
            game.getState().handId !== current.handId ||
            game.getState().currentPlayerSeat !== player.seat
          )
            break;
          const action: PlayerAction = {
            type: decision.action,
            amount: decision.amount,
          };
          set({ gameState: game.applyAction(action) });
        }
      } catch (error) {
        if (disposed) return;
        set({
          gameState: game.getState(),
          error: error instanceof Error ? error.message : "牌局發生錯誤。",
        });
      } finally {
        running = false;
        set({ isBotThinking: false });
      }
    },
    dispose: () => {
      disposed = true;
      table.dispose();
    },
  }));
}
export const usePokerStore = createPokerStore();
if (import.meta.hot)
  import.meta.hot.dispose(() => usePokerStore.getState().dispose());
