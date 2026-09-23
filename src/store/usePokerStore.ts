import { create } from 'zustand';
import { GameConfig, GameState, PlayerAction, PlayerState } from '../engine/types';
import { PokerGame } from '../engine/PokerGame';
import { BotController } from '../bot/BotController';
import { BotDecision, BotProfile } from '../bot/types';
import { DEFAULT_PROFILES } from '../bot/defaultProfiles';
import { HandHistoryFormatter, HandHistoryRecord } from '../history/HandHistory';
import { LocalStorageRepository } from '../history/StorageRepository';
import { PlayerStats } from '../stats/types';
import { StatsTracker } from '../stats/StatsTracker';

export interface BotDebugLog {
  id: string;
  handId: number;
  seat: number;
  playerName: string;
  street: string;
  decision: BotDecision;
  timestamp: number;
}

interface PokerStore {
  game: PokerGame;
  botController: BotController;
  repository: LocalStorageRepository;

  gameState: GameState;
  config: GameConfig;
  profiles: Record<string, BotProfile>;
  stats: Record<string, PlayerStats>;
  handHistories: HandHistoryRecord[];
  selectedHandForReplay: HandHistoryRecord | null;

  isBotThinking: boolean;
  trainingMode: boolean;
  botDebugLogs: BotDebugLog[];
  activeModal: 'NONE' | 'SETTINGS' | 'BOT_EDITOR' | 'HAND_HISTORY' | 'REPLAY' | 'STATS' | 'LEAK_REPORT';

  // Actions
  init: () => Promise<void>;
  startNewHand: () => void;
  executePlayerAction: (action: PlayerAction) => Promise<void>;
  processBotTurns: () => Promise<void>;
  processHandCompletion: (finalState: GameState) => Promise<void>;
  updateConfig: (newConfig: Partial<GameConfig>) => void;
  saveProfile: (profile: BotProfile) => void;
  setPlayerBotProfile: (seat: number, profileId: string) => void;
  rebuyHero: () => void;
  openModal: (modal: PokerStore['activeModal']) => void;
  closeModal: () => void;
  selectHandForReplay: (hand: HandHistoryRecord) => void;
  clearHistory: () => Promise<void>;
}

const DEFAULT_CONFIG: GameConfig = {
  startingStack: 1000,
  smallBlind: 5,
  bigBlind: 10,
  playerCount: 6,
  heroSeat: 0,
  botThinkTime: 600, // 600ms default
  autoNextHand: false,
  showPotOdds: true,
  showHandStrength: true,
  showBotReasoning: true,
  showEstimatedEquity: true,
};

export const usePokerStore = create<PokerStore>((set, get) => {
  const repo = new LocalStorageRepository();
  const botController = new BotController();

  // Create initial 6 players with varied default profiles
  const profileKeys = ['tag', 'lag', 'calling_station', 'nit', 'maniac'];
  const initialPlayers: PlayerState[] = Array.from({ length: DEFAULT_CONFIG.playerCount }, (_, i) => ({
    id: `p${i}`,
    name: i === DEFAULT_CONFIG.heroSeat ? 'Hero' : `Bot ${i} (${DEFAULT_PROFILES[profileKeys[(i - 1) % profileKeys.length]].name.split(' ')[0]})`,
    seat: i,
    isHuman: i === DEFAULT_CONFIG.heroSeat,
    stack: DEFAULT_CONFIG.startingStack,
    holeCards: [],
    currentBet: 0,
    totalBetThisHand: 0,
    folded: false,
    allIn: false,
    acted: false,
    position: '',
    botProfileId: i === DEFAULT_CONFIG.heroSeat ? undefined : profileKeys[(i - 1) % profileKeys.length],
  }));

  const game = new PokerGame(DEFAULT_CONFIG, initialPlayers);

  return {
    game,
    botController,
    repository: repo,
    gameState: game.getState(),
    config: DEFAULT_CONFIG,
    profiles: { ...DEFAULT_PROFILES },
    stats: {},
    handHistories: [],
    selectedHandForReplay: null,
    isBotThinking: false,
    trainingMode: true,
    botDebugLogs: [],
    activeModal: 'NONE',

    init: async () => {
      const savedConfig = await repo.getConfig();
      const savedProfiles = await repo.getProfiles();
      const savedHands = await repo.getHands();
      const savedStats = await repo.getStats();

      const mergedConfig = savedConfig ? { ...DEFAULT_CONFIG, ...savedConfig } : DEFAULT_CONFIG;
      game.setConfig(mergedConfig);

      // Register all profiles to bot controller
      Object.values(savedProfiles).forEach((p) => botController.registerProfile(p));

      set({
        config: mergedConfig,
        profiles: savedProfiles,
        handHistories: savedHands,
        stats: savedStats,
      });

      // Start first hand
      get().startNewHand();
    },

    startNewHand: () => {
      const { game, botController } = get();
      try {
        const newState = game.startNewHand();
        set({ gameState: newState, isBotThinking: false });

        // If first player to act is a bot, start processing turns
        const current = newState.players[newState.currentPlayerSeat];
        if (current && !current.isHuman && !newState.handComplete) {
          get().processBotTurns();
        }
      } catch (e) {
        console.error('Error starting new hand:', e);
      }
    },

    executePlayerAction: async (action: PlayerAction) => {
      const { game } = get();
      try {
        const newState = game.applyAction(action);
        set({ gameState: newState });

        if (newState.handComplete) {
          await get().processHandCompletion(newState);
        } else {
          const current = newState.players[newState.currentPlayerSeat];
          if (current && !current.isHuman) {
            get().processBotTurns();
          }
        }
      } catch (err: any) {
        console.error('Action error:', err.message);
      }
    },

    processBotTurns: async () => {
      const { game, botController, config } = get();
      let state = game.getState();

      while (!state.handComplete) {
        const current = state.players[state.currentPlayerSeat];
        if (!current || current.isHuman || current.folded || current.allIn) {
          break;
        }

        set({ isBotThinking: true });

        // Think delay
        if (config.botThinkTime > 0) {
          await new Promise((res) => setTimeout(res, config.botThinkTime));
        }

        // Check if state changed during wait
        if (get().gameState.handComplete) break;

        try {
          const decision = botController.getBotAction(state, current.seat);

          // Record debug log
          const logEntry: BotDebugLog = {
            id: `${Date.now()}-${Math.random()}`,
            handId: state.handId,
            seat: current.seat,
            playerName: current.name,
            street: state.street,
            decision,
            timestamp: Date.now(),
          };

          set((s) => ({
            botDebugLogs: [logEntry, ...s.botDebugLogs.slice(0, 49)], // Keep 50 recent logs
          }));

          // Apply bot action
          state = game.applyAction({
            type: decision.action,
            amount: decision.amount,
            reasoning: decision.reasoning,
          });

          set({ gameState: state, isBotThinking: false });

          if (state.handComplete) {
            await get().processHandCompletion(state);
            break;
          }
        } catch (botErr) {
          console.error(`Error processing bot action for seat ${current.seat}:`, botErr);
          const fallbackAction = current.currentBet >= state.currentBet ? 'CHECK' : 'FOLD';
          state = game.applyAction({ type: fallbackAction, reasoning: '安全備用動作' });
          set({ gameState: state, isBotThinking: false });
        }
      }

      set({ isBotThinking: false });
    },

    processHandCompletion: async (finalState: GameState) => {
      const { repository, config, stats } = get();
      const initialStacks: Record<string, number> = {};
      finalState.players.forEach((p) => {
        initialStacks[p.id] = p.stack + p.totalBetThisHand;
      });

      const record = HandHistoryFormatter.createRecord(
        finalState,
        initialStacks,
        config.smallBlind,
        config.bigBlind
      );

      await repository.saveHand(record);
      const updatedStats = StatsTracker.updateStats(stats, record);
      await repository.saveStats(updatedStats);

      const recentHands = await repository.getHands();
      set({ handHistories: recentHands, stats: updatedStats });

      if (config.autoNextHand) {
        setTimeout(() => {
          get().startNewHand();
        }, 2200);
      }
    },

    updateConfig: (newConfig: Partial<GameConfig>) => {
      const { game, repository, config, botController } = get();
      const updated = { ...config, ...newConfig };
      if (newConfig.botType) {
        botController.setBotEngineType(newConfig.botType);
      }
      if (newConfig.eliteMode) {
        botController.setEliteMode(newConfig.eliteMode);
      }
      if (newConfig.apexMode) {
        botController.setApexMode(newConfig.apexMode);
      }
      game.setConfig(updated);
      repository.saveConfig(updated);
      set({ config: updated });
    },


    saveProfile: (profile: BotProfile) => {
      const { profiles, botController, repository } = get();
      const updated = { ...profiles, [profile.id]: profile };
      botController.registerProfile(profile);
      repository.saveProfiles(updated);
      set({ profiles: updated });
    },

    setPlayerBotProfile: (seat: number, profileId: string) => {
      const { gameState } = get();
      const p = gameState.players[seat];
      if (p && !p.isHuman) {
        p.botProfileId = profileId;
        set({ gameState: { ...gameState } });
      }
    },

    rebuyHero: () => {
      const { gameState, config } = get();
      const hero = gameState.players[config.heroSeat];
      if (hero) {
        hero.stack = config.startingStack;
        set({ gameState: { ...gameState } });
      }
    },

    openModal: (modal) => set({ activeModal: modal }),
    closeModal: () => set({ activeModal: 'NONE' }),
    selectHandForReplay: (hand) => set({ selectedHandForReplay: hand, activeModal: 'REPLAY' }),
    clearHistory: async () => {
      const { repository } = get();
      await repository.clear();
      set({ handHistories: [], botDebugLogs: [] });
    },
  };
});
