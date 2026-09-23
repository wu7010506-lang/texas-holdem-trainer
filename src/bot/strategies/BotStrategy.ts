import { BotDecision, BotDecisionContext } from '../types';

/**
 * Unified strategy interface.
 * Poker Engine does NOT know the internal implementation of BotStrategy.
 */
export interface BotStrategy {
  name: string;
  version: string;
  decideAction(context: BotDecisionContext): BotDecision;
}

export interface ActionProbability {
  action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';
  amount?: number;
  probability: number; // 0.0 to 1.0
}

export interface ActionDistribution {
  actions: ActionProbability[];
}

/**
 * StrategyProvider interface for future V2 (CFR / Solver Database / Local Resolvers)
 */
export interface StrategyProvider {
  getStrategy(state: unknown): ActionDistribution;
}
