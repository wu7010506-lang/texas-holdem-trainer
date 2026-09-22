import { HandHistoryRecord } from '../history/HandHistory';
import { PlayerStats } from './types';

export class StatsTracker {
  public static createInitialStats(id: string, name: string, isHuman: boolean): PlayerStats {
    return {
      playerId: id,
      playerName: name,
      isHuman,
      handsPlayed: 0,
      vpipCount: 0,
      pfrCount: 0,
      threeBetOpportunities: 0,
      threeBetCount: 0,
      facingThreeBetCount: 0,
      foldToThreeBetCount: 0,
      cBetOpportunities: 0,
      cBetCount: 0,
      facingCBetCount: 0,
      foldToCBetCount: 0,
      showdownsReached: 0,
      showdownsWon: 0,
      totalProfit: 0,
      biggestPotWon: 0,
      biggestPotLost: 0,
      vpip: 0,
      pfr: 0,
      threeBetPercent: 0,
      foldToThreeBet: 0,
      cBetPercent: 0,
      foldToCBet: 0,
      wtsd: 0,
      wsd: 0,
      bbPer100: 0,
    };
  }

  public static updateStats(
    existingStats: Record<string, PlayerStats>,
    hand: HandHistoryRecord
  ): Record<string, PlayerStats> {
    const updated = { ...existingStats };
    const preflopActions = hand.actions.filter((a) => a.street === 'PREFLOP');
    const flopActions = hand.actions.filter((a) => a.street === 'FLOP');

    // Identify preflop aggressor (last raiser preflop)
    let preflopRaiserId: string | null = null;
    let raiseCount = 0;
    for (const a of preflopActions) {
      if (a.action === 'RAISE' || (a.action === 'ALL_IN' && a.amount > hand.bigBlind)) {
        preflopRaiserId = a.playerId;
        raiseCount++;
      }
    }

    for (const p of hand.players) {
      let stats = updated[p.id];
      if (!stats) {
        stats = this.createInitialStats(p.id, p.name, p.isHuman);
      } else {
        stats = { ...stats };
      }

      stats.handsPlayed += 1;

      // Profit/Loss in this hand
      const initStack = hand.initialStacks[p.id] ?? 0;
      const finalStack = hand.finalStacks[p.id] ?? 0;
      const profit = finalStack - initStack;
      stats.totalProfit += profit;

      if (profit > 0 && profit > stats.biggestPotWon) {
        stats.biggestPotWon = profit;
      } else if (profit < 0 && Math.abs(profit) > stats.biggestPotLost) {
        stats.biggestPotLost = Math.abs(profit);
      }

      // Check VPIP & PFR
      // Voluntary preflop actions exclude mandatory blind posts
      const playerPreflop = preflopActions.filter(
        (a) => a.playerId === p.id && a.reasoning !== 'Small Blind' && a.reasoning !== 'Big Blind'
      );

      const hadVpip = playerPreflop.some((a) => a.action === 'CALL' || a.action === 'RAISE' || a.action === 'BET' || a.action === 'ALL_IN');
      const hadPfr = playerPreflop.some((a) => a.action === 'RAISE' || (a.action === 'ALL_IN' && a.amount > hand.bigBlind));

      if (hadVpip) stats.vpipCount++;
      if (hadPfr) stats.pfrCount++;

      // Check 3-Bet
      if (raiseCount >= 1) {
        stats.threeBetOpportunities++;
        if (raiseCount >= 2 && preflopRaiserId === p.id) {
          stats.threeBetCount++;
        }
      }

      // Check C-Bet
      if (preflopRaiserId === p.id && flopActions.length > 0) {
        stats.cBetOpportunities++;
        const cbetAction = flopActions.find((a) => a.playerId === p.id && (a.action === 'BET' || a.action === 'RAISE'));
        if (cbetAction) stats.cBetCount++;
      }

      // Check Showdown
      const reachedShowdown = hand.communityCards.length === 5 && !hand.actions.some((a) => a.playerId === p.id && a.action === 'FOLD');
      if (reachedShowdown) {
        stats.showdownsReached++;
        const wonPot = hand.winners.some((w) => w.playerId === p.id && w.amount > 0);
        if (wonPot) {
          stats.showdownsWon++;
        }
      }

      // Calculate percentages
      stats.vpip = Number(((stats.vpipCount / stats.handsPlayed) * 100).toFixed(1));
      stats.pfr = Number(((stats.pfrCount / stats.handsPlayed) * 100).toFixed(1));
      stats.threeBetPercent = stats.threeBetOpportunities > 0
        ? Number(((stats.threeBetCount / stats.threeBetOpportunities) * 100).toFixed(1))
        : 0;
      stats.cBetPercent = stats.cBetOpportunities > 0
        ? Number(((stats.cBetCount / stats.cBetOpportunities) * 100).toFixed(1))
        : 0;
      stats.wtsd = Number(((stats.showdownsReached / stats.handsPlayed) * 100).toFixed(1));
      stats.wsd = stats.showdownsReached > 0
        ? Number(((stats.showdownsWon / stats.showdownsReached) * 100).toFixed(1))
        : 0;

      // BB/100
      const bbWon = stats.totalProfit / hand.bigBlind;
      stats.bbPer100 = Number(((bbWon / (stats.handsPlayed / 100))).toFixed(1));

      updated[p.id] = stats;
    }

    return updated;
  }
}
