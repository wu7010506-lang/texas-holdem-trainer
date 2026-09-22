import { PlayerState, Street } from './types';

export class TurnManager {
  /**
   * Assigns position strings ('BTN', 'SB', 'BB', 'UTG', etc.) to active players
   * based on the dealer button seat and number of players.
   */
  public static assignPositions(players: PlayerState[], buttonSeat: number): void {
    const n = players.length;
    if (n === 0) return;

    if (n === 2) {
      // Heads-Up rule: Button is Small Blind, the other is Big Blind
      players.forEach((p) => {
        if (p.seat === buttonSeat) {
          p.position = 'BTN/SB';
        } else {
          p.position = 'BB';
        }
      });
      return;
    }

    // Multi-way (3+ players)
    // Order seats starting from button (0), SB (1), BB (2), etc.
    const sorted = [...players].sort((a, b) => a.seat - b.seat);
    const btnIdx = sorted.findIndex((p) => p.seat === buttonSeat);

    for (let i = 0; i < n; i++) {
      const offset = (i - btnIdx + n) % n;
      const player = sorted[i];

      if (offset === 0) {
        player.position = 'BTN';
      } else if (offset === 1) {
        player.position = 'SB';
      } else if (offset === 2) {
        player.position = 'BB';
      } else if (n === 6) {
        if (offset === 3) player.position = 'UTG';
        else if (offset === 4) player.position = 'HJ';
        else if (offset === 5) player.position = 'CO';
      } else {
        if (offset === n - 1) {
          player.position = 'CO';
        } else if (offset === 3) {
          player.position = 'UTG';
        } else {
          player.position = `EP${offset - 2}`;
        }
      }
    }
  }

  /**
   * Finds the first player to act in a given street.
   */
  public static getFirstToAct(
    players: PlayerState[],
    street: Street,
    buttonSeat: number,
    isHeadsUp: boolean
  ): number {
    const active = players.filter((p) => !p.folded && !p.allIn);
    if (active.length === 0) return -1;

    if (isHeadsUp) {
      // Heads up: Preflop BTN/SB acts first. Postflop BB acts first.
      if (street === 'PREFLOP') {
        const btnPlayer = players.find((p) => p.seat === buttonSeat && !p.folded && !p.allIn);
        if (btnPlayer) return btnPlayer.seat;
      } else {
        const bbPlayer = players.find((p) => p.seat !== buttonSeat && !p.folded && !p.allIn);
        if (bbPlayer) return bbPlayer.seat;
      }
    } else {
      // Multi-way:
      // Preflop: First player after BB (offset 3 from Button)
      // Postflop: First active player starting from SB (offset 1 from Button)
      const targetOffset = street === 'PREFLOP' ? 3 : 1;
      const nextSeat = this.findNextActiveSeatFromOffset(players, buttonSeat, targetOffset);
      if (nextSeat !== -1) return nextSeat;
    }

    // Fallback: any active player
    return active[0].seat;
  }

  /**
   * Finds the next player to act in clockwise order after `currentSeat`.
   */
  public static getNextToAct(players: PlayerState[], currentSeat: number): number {
    const n = players.length;
    for (let step = 1; step < n; step++) {
      const nextSeat = (currentSeat + step) % n;
      const player = players.find((p) => p.seat === nextSeat);
      if (player && !player.folded && !player.allIn) {
        return player.seat;
      }
    }
    return -1; // No more players can act
  }

  /**
   * Determines whether the current betting round is settled.
   * A round is settled if:
   * 1. Only one player remains (everyone else folded).
   * 2. All remaining players are all-in (or at most one player has chips left and all others are all-in).
   * 3. Every active (non-all-in, non-folded) player has acted AND has matched the currentBet.
   */
  public static isRoundComplete(players: PlayerState[], currentBet: number): boolean {
    const remaining = players.filter((p) => !p.folded);
    if (remaining.length <= 1) return true;

    const canAct = remaining.filter((p) => !p.allIn);
    if (canAct.length === 0) return true; // Everyone left is all-in

    // If only one player can act, and they have matched the highest bet (or higher)
    if (canAct.length === 1) {
      const soleActer = canAct[0];
      return soleActer.acted && soleActer.currentBet >= currentBet;
    }

    // For all players who can still act: they must have acted AND their currentBet must equal currentBet
    return canAct.every((p) => p.acted && p.currentBet === currentBet);
  }

  private static findNextActiveSeatFromOffset(
    players: PlayerState[],
    buttonSeat: number,
    startOffset: number
  ): number {
    const n = players.length;
    for (let i = 0; i < n; i++) {
      const seat = (buttonSeat + startOffset + i) % n;
      const p = players.find((player) => player.seat === seat);
      if (p && !p.folded && !p.allIn) {
        return p.seat;
      }
    }
    return -1;
  }
}
