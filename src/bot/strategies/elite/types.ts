import { Card } from '../../../engine/types';
import { ActionDistribution } from '../BotStrategy';

export type ReasonCode =
  | 'RANGE_ADVANTAGE'
  | 'NUT_ADVANTAGE'
  | 'GOOD_BLUFF_BLOCKER'
  | 'POOR_BLUFF_BLOCKER'
  | 'LOW_SPR'
  | 'HIGH_SPR'
  | 'POSITION_ADVANTAGE'
  | 'MULTIWAY_TIGHTENING'
  | 'EXPLOIT_OVERFOLD'
  | 'EXPLOIT_UNDERFOLD'
  | 'EXPLOIT_OVERCALL'
  | 'MDF_DEFENSE'
  | 'POLARIZED_BET'
  | 'CONDENSED_RANGE'
  | 'THIN_VALUE'
  | 'STRONG_VALUE'
  | 'CHECK_BACK_MEDIUM_SHOWDOWN'
  | 'PREFLOP_MIXED_ACTION'
  | 'BOARD_RUNOUT_SCARE_CARD'
  | 'BOARD_RUNOUT_BLANK';

export interface EliteDecisionTrace {
  position: string;
  ownHand: string;
  board: string;
  pot: number;
  spr: number;
  potOdds: number;
  estimatedHeroRange: string;
  ownRangePosition: string;
  absoluteEquity: number;
  rangeEquity: number;
  rangeAdvantage: 'HIGH' | 'SLIGHT_HIGH' | 'NEUTRAL' | 'SLIGHT_LOW' | 'LOW';
  nutAdvantage: 'HIGH' | 'MEDIUM' | 'LOW';
  boardTexture: string;
  blockerScore: number;
  bluffCandidateScore: number;
  availableActions: string[];
  baseDistribution: ActionDistribution;
  exploitAdjustmentText: string;
  finalStrategy: ActionDistribution;
  randomRoll: number;
  selectedAction: string;
  reasonCodes: ReasonCode[];
}
