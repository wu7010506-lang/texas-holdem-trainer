export type PreflopGameNodeType =
  | 'RFI'
  | 'FACING_LIMP'
  | 'FACING_OPEN'
  | 'COLD_CALL'
  | 'THREE_BET'
  | 'FACING_THREE_BET'
  | 'FOUR_BET'
  | 'FACING_FOUR_BET'
  | 'SQUEEZE'
  | 'FACING_SQUEEZE'
  | 'BB_DEFENSE'
  | 'SB_VS_BB'
  | 'BLIND_VS_BLIND'
  | 'FACING_ALL_IN';

export interface PreflopMixedAction {
  raise: number; // 0.0 to 1.0
  call: number;  // 0.0 to 1.0
  fold: number;  // 0.0 to 1.0
}
