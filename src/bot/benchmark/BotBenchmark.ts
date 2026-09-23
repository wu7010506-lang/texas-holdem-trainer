import { PokerGame } from '../../engine/PokerGame';
import { GameConfig, PlayerAction } from '../../engine/types';
import { BotController } from '../BotController';
import { EliteStrategyV1 } from '../strategies/elite/EliteStrategyV1';
import { RuleBasedStrategy } from '../strategies/ruleBased/RuleBasedStrategy';
import { DEFAULT_PROFILES } from '../defaultProfiles';
import { ActionValidator } from '../../engine/ActionValidator';

export interface BenchmarkResult {
  totalHands: number;
  eliteChipsProfit: number;
  eliteBBWon: number;
  eliteBBPer100: number;
  eliteVPIP: number;
  elitePFR: number;
  illegalActionsCount: number;
  crashesCount: number;
  summary: string;
}

export class BotBenchmark {
  /**
   * Runs an automated headless simulation tournament between Elite V1 and Rule-Based bots.
   */
  public static run(hands: number = 200, randomSeed: number = 12345): BenchmarkResult {
    const config: GameConfig = {
      playerCount: 6,
      smallBlind: 5,
      bigBlind: 10,
      startingStack: 1000, // 100 BB
      heroSeat: -1, // all bots
      botThinkTime: 0,
      autoNextHand: true,
      showPotOdds: true,
      showHandStrength: true,
      showBotReasoning: true,
      showEstimatedEquity: true,
      randomSeed,
    };


    const game = new PokerGame(config);
    const eliteStrategy = new EliteStrategyV1('BALANCED', randomSeed);
    const ruleBasedStrategy = new RuleBasedStrategy(DEFAULT_PROFILES['tag']);
    const botController = new BotController();

    let eliteChipsProfit = 0;
    let eliteVpipCount = 0;
    let elitePfrCount = 0;
    let illegalActionsCount = 0;
    let crashesCount = 0;

    for (let h = 0; h < hands; h++) {
      try {
        game.startNewHand();
        let state = game.getState();
        const startEliteStack = state.players[0].stack;
        let eliteVpipThisHand = false;
        let elitePfrThisHand = false;

        let safetyCounter = 0;
        while (!state.handComplete && safetyCounter < 150) {
          safetyCounter++;
          const currentSeat = state.currentPlayerSeat;
          const currentPlayer = state.players[currentSeat];

          const context = botController.buildContext(state, currentSeat);
          let decision;

          if (currentSeat === 0) {
            // Elite Bot V1
            decision = eliteStrategy.decideAction(context);
            if (state.street === 'PREFLOP') {
              if (decision.action === 'CALL' || decision.action === 'BET' || decision.action === 'RAISE') {
                eliteVpipThisHand = true;
              }
              if (decision.action === 'RAISE' || decision.action === 'BET') {
                elitePfrThisHand = true;
              }
            }
          } else {
            // Rule-based bots
            decision = ruleBasedStrategy.decideAction(context);
          }

          // Validate legality
          const playerAction: PlayerAction = {
            type: decision.action,
            amount: decision.amount,
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
            // Fallback to legal fold/check
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

        const endEliteStack = state.players[0].stack;
        eliteChipsProfit += endEliteStack - startEliteStack;
        if (eliteVpipThisHand) eliteVpipCount++;
        if (elitePfrThisHand) elitePfrCount++;

        // Reset stacks if any player gets short so effective stack stays near 100BB
        state.players.forEach((p) => {
          if (p.stack < 200) p.stack = 1000;
        });
      } catch (err) {
        console.error('BotBenchmark error:', err);
        crashesCount++;
      }
    }


    const eliteBBWon = eliteChipsProfit / 10;
    const eliteBBPer100 = (eliteBBWon / (hands / 100));
    const eliteVPIP = eliteVpipCount / hands;
    const elitePFR = elitePfrCount / hands;

    const summary = `[BotBenchmark 結果] 總手數: ${hands} | Elite V1 盈虧: ${eliteBBWon.toFixed(1)} BB (${eliteBBPer100.toFixed(2)} BB/100) | VPIP: ${(eliteVPIP * 100).toFixed(1)}% | PFR: ${(elitePFR * 100).toFixed(1)}% | 非法動作: ${illegalActionsCount} | 崩潰數: ${crashesCount}`;

    return {
      totalHands: hands,
      eliteChipsProfit,
      eliteBBWon,
      eliteBBPer100,
      eliteVPIP,
      elitePFR,
      illegalActionsCount,
      crashesCount,
      summary,
    };
  }
}
