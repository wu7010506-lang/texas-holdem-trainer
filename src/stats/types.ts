export interface PlayerStats {
  playerId: string;
  playerName: string;
  isHuman: boolean;
  handsPlayed: number;
  vpipCount: number;
  pfrCount: number;
  threeBetOpportunities: number;
  threeBetCount: number;
  facingThreeBetCount: number;
  foldToThreeBetCount: number;
  cBetOpportunities: number;
  cBetCount: number;
  facingCBetCount: number;
  foldToCBetCount: number;
  showdownsReached: number;
  showdownsWon: number;
  totalProfit: number; // in chips
  biggestPotWon: number;
  biggestPotLost: number;

  // Calculated rates
  vpip: number;             // percentage 0 - 100
  pfr: number;              // percentage 0 - 100
  threeBetPercent: number;  // percentage 0 - 100
  foldToThreeBet: number;   // percentage 0 - 100
  cBetPercent: number;      // percentage 0 - 100
  foldToCBet: number;       // percentage 0 - 100
  wtsd: number;             // percentage 0 - 100
  wsd: number;              // percentage 0 - 100
  bbPer100: number;         // BB / 100 hands
}
