import { GameState } from '../engine/types';
import { BotDecision, BotDecisionContext, BotProfile, IBotStrategy } from './types';
import { buildBotContext } from './buildBotContext';


import { DEFAULT_PROFILES } from './defaultProfiles';
import { ProfileDrivenStrategy } from './ProfileDrivenStrategy';
import { EliteStrategyV1, EliteBotMode } from './strategies/elite/EliteStrategyV1';
import { RuleBasedStrategy } from './strategies/ruleBased/RuleBasedStrategy';
import { ApexStrategy, ApexBotMode } from './strategies/apex/ApexStrategy';
import { ActionValidator } from '../engine/ActionValidator';
import { clampBotDecision } from './clampBotDecision';

export class BotController {
  private strategy: IBotStrategy;
  private customProfiles: Map<string, BotProfile> = new Map();
  private eliteStrategy: EliteStrategyV1;
  private apexStrategy: ApexStrategy;
  private ruleBasedStrategy: RuleBasedStrategy;
  private botEngineType: 'RULE_BASED' | 'ELITE' | 'APEX' = 'APEX';

  constructor(strategy?: IBotStrategy) {
    this.strategy = strategy || new ProfileDrivenStrategy();
    this.eliteStrategy = new EliteStrategyV1('BALANCED');
    this.apexStrategy = new ApexStrategy();
    this.ruleBasedStrategy = new RuleBasedStrategy();
  }

  public setBotEngineType(type: 'RULE_BASED' | 'ELITE' | 'APEX'): void {
    this.botEngineType = type;
  }

  public setStrategy(strategy: IBotStrategy): void {
    this.strategy = strategy;
  }

  public getEliteStrategy(): EliteStrategyV1 {
    return this.eliteStrategy;
  }

  public setEliteMode(mode: EliteBotMode): void {
    this.eliteStrategy.setMode(mode);
  }

  public getApexStrategy(): ApexStrategy {
    return this.apexStrategy;
  }

  public setApexMode(mode: ApexBotMode): void {
    this.apexStrategy.setMode(mode);
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
    return buildBotContext(gameState, seat);
  }

  public getBotAction(gameState: GameState, seat: number, rng?: () => number): BotDecision {
    const decision = this.decideRawAction(gameState, seat, rng);
    const player = gameState.players[seat];
    const legal = ActionValidator.getLegalActions(player, gameState.currentBet, gameState.lastRaiseAmount, gameState.bigBlind ?? 10);
    return clampBotDecision(decision, legal);
  }

  private decideRawAction(gameState: GameState, seat: number, rng?: () => number): BotDecision {
    const context = this.buildContext(gameState, seat);
    const player = gameState.players[seat];

    if (this.botEngineType === 'APEX' || player.botProfileId === 'apex') {
      if (rng) this.apexStrategy.setRng(rng);
      return this.apexStrategy.decideAction(context);
    }

    if (this.botEngineType === 'ELITE' || player.botProfileId === 'elite') {
      if (rng) this.eliteStrategy.setRng(rng);
      return this.eliteStrategy.decideAction(context);
    }

    const profile = this.getProfile(player.botProfileId);
    return this.strategy.decideAction(context, profile, rng);
  }

}
