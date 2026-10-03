import { PokerGame } from '../../engine/PokerGame';
import { GameConfig, PlayerAction, PlayerState } from '../../engine/types';
import { BotController } from '../BotController';
import { ApexStrategy } from '../strategies/apex/ApexStrategy';
import { HeroModel } from '../strategies/apex/model/HeroModel';
import { ProfileDrivenStrategy } from '../ProfileDrivenStrategy';
import { DEFAULT_PROFILES } from '../defaultProfiles';
import { ActionValidator } from '../../engine/ActionValidator';

export interface SelfPlayReport {
  totalHands: number;
  apexNetChips: number;
  apexBBWon: number;
  apexBBPer100: number;
  apexVPIP: number;
  apexPFR: number;
  exploitTriggersCount: number;
  illegalActionsCount: number;
  crashesCount: number;
  detailsByOpponent: Record<string, { handsPlayed: number; netBB: number; exploitCount: number }>;
  summary: string;
}

export class ApexSelfPlayBenchmark {
  /**
   * Run a comprehensive multi-table self-play simulation:
   * Seat 0: Apex Bot
   * Seats 1-5: Varied Opponents (TAG, LAG, Calling Station, Nit, Maniac)
   */
  public static runSimulation(hands = 100, randomSeed = 99999): SelfPlayReport {
    const heroModel = new HeroModel();
    const apexStrategy = new ApexStrategy(heroModel);
    const profileStrategy = new ProfileDrivenStrategy();
    const botController = new BotController();

    const config: GameConfig = {
      playerCount: 6,
      smallBlind: 5,
      bigBlind: 10,
      startingStack: 1000,
      heroSeat: 1, // Treat Seat 1 as 'Hero' for HeroModel tracking
      botThinkTime: 0,
      autoNextHand: true,
      showPotOdds: true,
      showHandStrength: true,
      showBotReasoning: true,
      showEstimatedEquity: true,
      randomSeed,
    };

    const opponentProfiles = ['tag', 'calling_station', 'maniac', 'nit', 'lag'];
    const initialPlayers: PlayerState[] = [
      {
        id: 'p0',
        name: 'Apex AI',
        seat: 0,
        isHuman: false,
        stack: 1000,
        holeCards: [],
        currentBet: 0,
        totalBetThisHand: 0,
        folded: false,
        allIn: false,
        acted: false,
        position: '',
      },
      ...opponentProfiles.map((profKey, idx) => ({
        id: `p${idx + 1}`,
        name: idx === 0 ? 'Hero' : `Bot ${profKey}`,
        seat: idx + 1,
        isHuman: false,
        stack: 1000,
        holeCards: [],
        currentBet: 0,
        totalBetThisHand: 0,
        folded: false,
        allIn: false,
        acted: false,
        position: '',
        botProfileId: profKey,
      })),
    ];

    const game = new PokerGame(config, initialPlayers);

    let apexNetChips = 0;
    let apexVpipCount = 0;
    let apexPfrCount = 0;
    let exploitTriggersCount = 0;
    let illegalActionsCount = 0;
    let crashesCount = 0;

    const detailsByOpponent: Record<string, { handsPlayed: number; netBB: number; exploitCount: number }> = {};
    opponentProfiles.forEach((k) => {
      detailsByOpponent[k] = { handsPlayed: 0, netBB: 0, exploitCount: 0 };
    });

    for (let h = 0; h < hands; h++) {
      try {
        game.startNewHand();
        let state = game.getState();
        const startApexStack = state.players[0].stack;
        let apexVpipThisHand = false;
        let apexPfrThisHand = false;

        let safetyCounter = 0;
        while (!state.handComplete && safetyCounter < 150) {
          safetyCounter++;
          const currentSeat = state.currentPlayerSeat;
          const currentPlayer = state.players[currentSeat];
          const context = botController.buildContext(state, currentSeat);

          let decision;
          if (currentSeat === 0) {
            // Apex Bot
            decision = apexStrategy.decideAction(context);
            if (decision.debugTrace?.mode === 'APEX_EXPLOIT' || (decision.reasonCodes && decision.reasonCodes.some(r => r.startsWith('EXPLOIT')))) {
              exploitTriggersCount++;
            }
            if (state.street === 'PREFLOP') {
              if (decision.action === 'CALL' || decision.action === 'BET' || decision.action === 'RAISE' || decision.action === 'ALL_IN') {
                apexVpipThisHand = true;
              }
              if (decision.action === 'RAISE' || decision.action === 'BET' || decision.action === 'ALL_IN') {
                apexPfrThisHand = true;
              }
            }
          } else {
            // Opponent
            const prof = DEFAULT_PROFILES[currentPlayer.botProfileId || 'tag'];
            decision = profileStrategy.decideAction(context, prof);
          }

          const playerAction: PlayerAction = {
            type: decision.action,
            amount: decision.amount,
            reasoning: decision.reasoning,
          };

          const validation = ActionValidator.validate(
            currentPlayer,
            playerAction,
            state.currentBet,
            state.lastRaiseAmount,
            config.bigBlind
          );

          if (!validation.valid) {
            illegalActionsCount++;
            if (state.legalActions?.canCheck) {
              game.applyAction({ type: 'CHECK' });
            } else {
              game.applyAction({ type: 'FOLD' });
            }
          } else {
            game.applyAction(playerAction);
          }

          state = game.getState();
        }

        const endApexStack = state.players[0].stack;
        const handDelta = endApexStack - startApexStack;
        apexNetChips += handDelta;

        if (apexVpipThisHand) apexVpipCount++;
        if (apexPfrThisHand) apexPfrCount++;

        // Reset depleted stacks
        state.players.forEach((p) => {
          if (p.stack < 200) p.stack = 1000;
        });
      } catch (err) {
        crashesCount++;
        console.error('Simulation crash:', err);
      }
    }

    const apexBBWon = apexNetChips / 10;
    const apexBBPer100 = (apexBBWon / (hands / 100));
    const apexVPIP = apexVpipCount / hands;
    const apexPFR = apexPfrCount / hands;

    const summary = `[Apex 自測試玩報告] 總手數: ${hands} | 淨收益: ${apexBBWon.toFixed(1)} BB (${apexBBPer100.toFixed(2)} BB/100) | VPIP: ${(apexVPIP * 100).toFixed(1)}% | PFR: ${(apexPFR * 100).toFixed(1)}% | 啟動剝削次數: ${exploitTriggersCount} | 非法動作: ${illegalActionsCount} | 崩潰數: ${crashesCount}`;

    return {
      totalHands: hands,
      apexNetChips,
      apexBBWon,
      apexBBPer100,
      apexVPIP,
      apexPFR,
      exploitTriggersCount,
      illegalActionsCount,
      crashesCount,
      detailsByOpponent,
      summary,
    };
  }
}
