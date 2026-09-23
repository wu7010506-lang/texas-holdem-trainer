export type ApexReasonCode =
  | 'EXPLOIT_OVERFOLD'
  | 'EXPLOIT_OVERCALL'
  | 'EXPLOIT_UNDERBLUFF'
  | 'EXPLOIT_OVERBLUFF'
  | 'EXPLOIT_SIZE_TELL'
  | 'EXPLOIT_POSITION_LEAK'
  | 'EXPLOIT_BOARD_LEAK'
  | 'EXPLOIT_PRE_FLOP_OVERFOLD'
  | 'THIN_VALUE_EXPANSION'
  | 'BLUFF_RANGE_EXPANSION'
  | 'BLUFF_RANGE_REDUCTION'
  | 'VALUE_SIZE_INCREASE'
  | 'COUNTER_ADAPTATION_RESET'
  | 'BASELINE_FALLBACK';

export interface ApexCandidateEV {
  actionLabel: string;
  action: 'FOLD' | 'CHECK' | 'CALL' | 'BET' | 'RAISE' | 'ALL_IN';
  amount?: number;
  ev: number; // in Big Blinds or chips
  predictedHeroFoldRate: number;
  predictedHeroCallRate: number;
  predictedHeroRaiseRate: number;
  equityWhenCalled: number;
}

export interface ApexDecisionTrace {
  position: string;
  ownHand: string;
  board: string;
  pot: number;
  spr: number;
  heroModelSummary: string;
  modelConfidence: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  confidenceScore: number;
  candidateEVs: ApexCandidateEV[];
  baselinePreferredAction: string;
  baselinePreferredEV: number;
  exploitPreferredAction: string;
  exploitPreferredEV: number;
  expectedExploitGain: number; // in BB
  finalAction: string;
  finalAmount?: number;
  reasonCodes: ApexReasonCode[];
  mode: 'BASELINE' | 'APEX_EXPLOIT';
}
