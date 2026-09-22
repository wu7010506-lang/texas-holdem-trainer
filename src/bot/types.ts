import { ActionRecord, Card, LegalActions, PlayerActionType, Street } from '../engine/types';

export interface BoardTextureInfo {
  isMonotone: boolean;
  isTwoTone: boolean;
  isRainbow: boolean;
  isPaired: boolean;
  isConnected: boolean;
  isHighCardHeavy: boolean;
  wetnessScore: number; // 0.0 (very dry) to 1.0 (very wet)
  description: string;
}

export type MadeHandCategory =
  | 'AIR'
  | 'WEAK_PAIR'
  | 'MIDDLE_PAIR'
  | 'TOP_PAIR_WEAK_KICKER'
  | 'TOP_PAIR_GOOD_KICKER'
  | 'OVERPAIR'
  | 'TWO_PAIR'
  | 'TRIPS_OR_SET'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'QUADS_OR_BETTER';

export interface HandStrengthInfo {
  category: MadeHandCategory;
  categoryName: string;
  hasFlushDraw: boolean;
  hasOESD: boolean;
  hasGutshot: boolean;
  hasOvercards: boolean;
  estimatedEquity: number; // 0.0 to 1.0
  description: string;
}

export interface BotDecisionContext {
  holeCards: Card[];
  communityCards: Card[];
  position: string;
  street: Street;
  potSize: number;
  playerStack: number;
  effectiveStack: number;
  amountToCall: number;
  minimumRaise: number;
  currentBet: number;
  bigBlind: number;
  numberOfPlayers: number;
  activePlayers: number;
  previousActions: ActionRecord[];
  positionRelativeToButton: number;
  spr: number;
  potOdds: number;
  boardTexture: BoardTextureInfo;
  handStrength: HandStrengthInfo;
  legalActions: LegalActions;
}

export interface BotDecision {
  action: PlayerActionType;
  amount?: number;
  reasoning: string;
  debugScores?: {
    foldScore: number;
    callScore: number;
    raiseScore: number;
    randomRoll: number;
  };
}

export interface BotProfile {
  id: string;
  name: string;
  description: string;
  vpip: number;             // Target Voluntarily Put Money in Pot (e.g. 0.22)
  pfr: number;              // Target Pre-Flop Raise (e.g. 0.18)
  threeBetFrequency: number;// e.g. 0.08
  aggression: number;       // 0.0 to 1.0 postflop aggression factor
  bluffFrequency: number;   // 0.0 to 1.0 postflop bluff frequency
  foldToThreeBet: number;   // 0.0 to 1.0
  continuationBet: number;  // 0.0 to 1.0 c-bet frequency
  foldToCBet: number;       // 0.0 to 1.0
  checkRaiseFrequency: number; // 0.0 to 1.0
  riverBluffFrequency: number; // 0.0 to 1.0
  betSizing: {
    small: number;          // e.g. 0.33
    medium: number;         // e.g. 0.66
    large: number;          // e.g. 0.75
    overbet: number;        // e.g. 1.25
  };
}

export interface IBotStrategy {
  name: string;
  decideAction(context: BotDecisionContext, profile: BotProfile, rng?: () => number): BotDecision;
}
