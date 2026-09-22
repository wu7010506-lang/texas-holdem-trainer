import { HandEvaluation, HandWinner, PlayerState, Pot } from './types';
import { HandEvaluator } from './HandEvaluator';

export class PotManager {
  /**
   * Calculates the main pot and side pots based on all players' total committed chips.
   * Folded players' chips remain in the pot, but they are never eligible to win.
   */
  public static calculatePots(players: PlayerState[]): Pot[] {
    // Only players who contributed > 0 matter
    const contributors = players.filter((p) => p.totalBetThisHand > 0);
    if (contributors.length === 0) {
      return [{ id: 0, amount: 0, eligiblePlayerIds: [] }];
    }

    // Identify distinct all-in or contribution tiers among active players
    const activeContributors = contributors.filter((p) => !p.folded);
    if (activeContributors.length === 0) {
      // Everyone folded except nobody? Total chips in one pot
      const totalAmount = contributors.reduce((sum, p) => sum + p.totalBetThisHand, 0);
      return [{ id: 0, amount: totalAmount, eligiblePlayerIds: [] }];
    }

    // Distinct levels of contribution from active players who are all-in, plus max contribution
    const allInLevels = Array.from(
      new Set(
        contributors
          .filter((p) => p.allIn && !p.folded)
          .map((p) => p.totalBetThisHand)
      )
    ).sort((a, b) => a - b);

    const maxBet = Math.max(...contributors.map((p) => p.totalBetThisHand));
    if (!allInLevels.includes(maxBet)) {
      allInLevels.push(maxBet);
    }
    allInLevels.sort((a, b) => a - b);

    const pots: Pot[] = [];
    let previousLevel = 0;

    for (let i = 0; i < allInLevels.length; i++) {
      const currentLevel = allInLevels[i];
      const tierSize = currentLevel - previousLevel;
      if (tierSize <= 0) continue;

      let potAmount = 0;
      const eligiblePlayers: string[] = [];

      for (const p of contributors) {
        const contributionInTier = Math.min(
          tierSize,
          Math.max(0, p.totalBetThisHand - previousLevel)
        );
        potAmount += contributionInTier;

        // An active player is eligible for this pot if their contribution reached this tier
        if (!p.folded && p.totalBetThisHand >= currentLevel) {
          eligiblePlayers.push(p.id);
        }
      }

      if (potAmount > 0) {
        pots.push({
          id: pots.length,
          amount: potAmount,
          eligiblePlayerIds: eligiblePlayers,
        });
      }

      previousLevel = currentLevel;
    }

    // Merge adjacent pots if they have the exact same eligible players
    const mergedPots: Pot[] = [];
    for (const p of pots) {
      if (mergedPots.length === 0) {
        mergedPots.push({ ...p, id: 0 });
      } else {
        const prev = mergedPots[mergedPots.length - 1];
        const sameEligible =
          prev.eligiblePlayerIds.length === p.eligiblePlayerIds.length &&
          prev.eligiblePlayerIds.every((id) => p.eligiblePlayerIds.includes(id));

        if (sameEligible) {
          prev.amount += p.amount;
        } else {
          mergedPots.push({ ...p, id: mergedPots.length });
        }
      }
    }

    return mergedPots.length > 0
      ? mergedPots
      : [{ id: 0, amount: 0, eligiblePlayerIds: players.map((p) => p.id) }];
  }

  /**
   * Distributes all pots (main and side pots) to the winning players.
   * If only one player has not folded, they win all pots automatically.
   */
  public static resolveShowdown(
    pots: Pot[],
    players: PlayerState[],
    playerEvaluations: Map<string, HandEvaluation>,
    buttonSeat: number
  ): HandWinner[] {
    const winners: HandWinner[] = [];
    const nonFolded = players.filter((p) => !p.folded);

    // Case 1: Only 1 player left (everyone else folded)
    if (nonFolded.length === 1) {
      const soleWinner = nonFolded[0];
      const totalPot = pots.reduce((sum, p) => sum + p.amount, 0);
      return [
        {
          playerId: soleWinner.id,
          potIndex: 0,
          amount: totalPot,
        },
      ];
    }

    // Seat order starting from first active seat after button (for odd chip rule)
    const maxSeat = Math.max(...players.map((p) => p.seat), buttonSeat) + 1;
    const sortedPlayersByPosition = [...players].sort((a, b) => {
      const distA = (a.seat - buttonSeat - 1 + maxSeat) % maxSeat;
      const distB = (b.seat - buttonSeat - 1 + maxSeat) % maxSeat;
      return distA - distB;
    });

    // Resolve each pot independently
    pots.forEach((pot, potIndex) => {
      if (pot.amount <= 0) return;

      const contenders = nonFolded.filter((p) => pot.eligiblePlayerIds.includes(p.id));
      if (contenders.length === 0) return;

      // Find the best hand evaluation among contenders
      let bestScore: number[] | null = null;
      let winningContenders: PlayerState[] = [];

      for (const player of contenders) {
        const evaluation = playerEvaluations.get(player.id);
        if (!evaluation) continue;

        if (!bestScore) {
          bestScore = evaluation.score;
          winningContenders = [player];
        } else {
          const comp = HandEvaluator.compareScores(evaluation.score, bestScore);
          if (comp > 0) {
            bestScore = evaluation.score;
            winningContenders = [player];
          } else if (comp === 0) {
            winningContenders.push(player);
          }
        }
      }

      if (winningContenders.length === 0) return;

      // Split pot evenly
      const share = Math.floor(pot.amount / winningContenders.length);
      let remainder = pot.amount % winningContenders.length;

      // Order winners by position for remainder chips
      winningContenders.sort((a, b) => {
        const orderA = sortedPlayersByPosition.findIndex((p) => p.id === a.id);
        const orderB = sortedPlayersByPosition.findIndex((p) => p.id === b.id);
        return orderA - orderB;
      });

      for (const winner of winningContenders) {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder--;

        const winAmount = share + extra;
        winners.push({
          playerId: winner.id,
          potIndex,
          amount: winAmount,
          handEvaluation: playerEvaluations.get(winner.id),
        });
      }
    });

    return winners;
  }
}
