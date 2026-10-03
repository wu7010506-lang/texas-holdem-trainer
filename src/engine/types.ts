export type Suit = 's' | 'h' | 'd' | 'c'; // spades, hearts, diamonds, clubs
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  value: number; // 2 to 14 (2=2, ..., T=10, J=11, Q=12, K=13, A=14)
  id: string;    // e.g. "Ah", "Kd", "2c"
}

export enum HandRank {
  HIGH_CARD = 0,
  ONE_PAIR = 1,
  TWO_PAIR = 2,
  THREE_OF_A_KIND = 3,
  STRAIGHT = 4,
  FLUSH = 5,
  FULL_HOUSE = 6,
  FOUR_OF_A_KIND = 7,
  STRAIGHT_FLUSH = 8,
}

export interface HandEvaluation {
  handRank: HandRank;
  rankName: string;      // e.g., "Full House", "Flush", "High Card"
  score: number[];       // Lexicographical score vector [handRank, tiebreaker1, tiebreaker2, ...]
  best5: Card[];
  description: string;   // e.g. "Full House, Kings full of Aces"
}

export type Street = 'PREFLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN';

export type PlayerActionType = 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canBet: boolean;
  minBet: number;
  maxBet: number;
  canRaise: boolean;
  minRaise: number;
  maxRaise: number;
  canAllIn: boolean;
  allInAmount: number;
}

export interface PlayerAction {
  type: PlayerActionType;
  amount?: number;
  reasoning?: string;
}

export interface PlayerState {
  id: string;
  name: string;
  seat: number;
  isHuman: boolean;
  stack: number;
  holeCards: Card[];
  currentBet: number;
  totalBetThisHand: number;
  folded: boolean;
  allIn: boolean;
  acted: boolean;
  raiseReopenAt?: number; // Minimum current wager that reopens this player's raise rights.
  position: string; // "BTN", "SB", "BB", "UTG", "HJ", "CO", etc.
  botProfileId?: string;
  lastAction?: PlayerAction;
}

export interface Pot {
  id: number;
  amount: number;
  eligiblePlayerIds: string[];
}

export interface HandWinner {
  playerId: string;
  potIndex: number;
  amount: number;
  handEvaluation?: HandEvaluation;
}

export interface ActionRecord {
  handId: number;
  street: Street;
  seat: number;
  playerId: string;
  playerName: string;
  action: PlayerActionType;
  amount: number;
  position?: string;
  potBefore: number;

  potAfter: number;
  stackBefore: number;
  stackAfter: number;
  reasoning?: string;
  timestamp: number;
}

export interface GameConfig {
  startingStack: number;
  smallBlind: number;
  bigBlind: number;
  playerCount: number;
  heroSeat: number;
  botThinkTime: number; // ms
  autoNextHand: boolean;
  showPotOdds: boolean;
  showHandStrength: boolean;
  showBotReasoning: boolean;
  showEstimatedEquity: boolean;
  botType?: 'RULE_BASED' | 'ELITE' | 'APEX' | 'EXPERT';
  eliteMode?: 'BALANCED' | 'ADAPTIVE';
  apexMode?: 'BASELINE' | 'APEX_EXPLOIT';
  randomSeed?: number;
}


export interface GameState {
  bigBlind?: number;
  handId: number;
  street: Street;
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  currentPlayerSeat: number;
  communityCards: Card[];
  pot: number;
  sidePots: Pot[];
  currentBet: number;
  minimumRaise: number;
  lastRaiseAmount: number;
  players: PlayerState[];
  actionHistory: ActionRecord[];
  handComplete: boolean;
  winners?: HandWinner[];
  isHeadsUp: boolean;
  legalActions?: LegalActions;
}
