import { GameState, PlayerAction } from '../engine/types';
import { BotDecision, BotDecisionContext, BotProfile, IBotStrategy } from './types';
import { BoardAnalyzer } from './BoardAnalyzer';
import { HandStrength } from './HandStrength';
import { PotOddsCalculator } from './PotOddsCalculator';
import { DEFAULT_PROFILES } from './defaultProfiles';
import { ProfileDrivenStrategy } from './ProfileDrivenStrategy';

export class BotController {
  private strategy: IBotStrategy;
  private customProfiles: Map<string, BotProfile> = new Map();

  constructor(strategy?: IBotStrategy) {
    this.strategy = strategy || new ProfileDrivenStrategy();
  }

  public setStrategy(strategy: IBotStrategy): void {
    this.strategy = strategy;
  }

  public registerProfile(profile: BotProfile): void {
    this.customProfiles.set(profile.id, profile);
  }

  public getProfile(profileId?: string): BotProfile {
    if (profileId && this.customProfiles.has(profileId)) {
      return this.customProfiles.get(profileId)!;
    }
    if (profileId && DEFAULT_PROFILES[profileId]) {
      return DEFAULT_PROFILES[profileId];
    }
    return DEFAULT_PROFILES['tag']; // Default fallback
  }

  public buildContext(gameState: GameState, seat: number): BotDecisionContext {
    const player = gameState.players[seat];
    if (!player) {
      throw new Error(`Invalid seat ${seat} in buildContext`);
    }

    const amountToCall = Math.max(0, gameState.currentBet - player.currentBet);
    const { potOdds } = PotOddsCalculator.calculate(amountToCall, gameState.pot);

    // Calculate effective stack: minimum of this player's stack and highest opponent stack
    const opponentStacks = gameState.players
      .filter((p) => p.seat !== seat && !p.folded)
      .map((p) => p.stack);
    const maxOpponentStack = opponentStacks.length > 0 ? Math.max(...opponentStacks) : player.stack;
    const effectiveStack = Math.min(player.stack, maxOpponentStack);
    const spr = PotOddsCalculator.calculateSPR(effectiveStack, gameState.pot);

    const boardTexture = BoardAnalyzer.analyze(gameState.communityCards);
    const handStrength = HandStrength.evaluate(player.holeCards, gameState.communityCards);

    const activePlayers = gameState.players.filter((p) => !p.folded).length;

    // Legal actions are provided by game state or re-derived
    const legalActions = gameState.legalActions || {
      canFold: true,
      canCheck: amountToCall === 0,
      canCall: amountToCall > 0,
      callAmount: Math.min(player.stack, amountToCall),
      canBet: gameState.currentBet === 0 && player.stack > 0,
      minBet: Math.min(player.stack, 10),
      maxBet: player.stack,
      canRaise: player.stack > amountToCall,
      minRaise: gameState.minimumRaise,
      maxRaise: player.currentBet + player.stack,
      canAllIn: player.stack > 0,
      allInAmount: player.currentBet + player.stack,
    };

    return {
      holeCards: player.holeCards,
      communityCards: gameState.communityCards,
      position: player.position,
      street: gameState.street,
      potSize: gameState.pot,
      playerStack: player.stack,
      effectiveStack,
      amountToCall,
      minimumRaise: gameState.minimumRaise,
      currentBet: gameState.currentBet,
      bigBlind: 10,
      numberOfPlayers: gameState.players.length,
      activePlayers,
      previousActions: gameState.actionHistory,
      positionRelativeToButton: (player.seat - gameState.dealerSeat + gameState.players.length) % gameState.players.length,
      spr,
      potOdds,
      boardTexture,
      handStrength,
      legalActions,
    };
  }

  public getBotAction(gameState: GameState, seat: number, rng?: () => number): BotDecision {
    const context = this.buildContext(gameState, seat);
    const player = gameState.players[seat];
    const profile = this.getProfile(player.botProfileId);
    return this.strategy.decideAction(context, profile, rng);
  }
}
