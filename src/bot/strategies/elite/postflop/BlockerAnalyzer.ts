import { Card, Rank, Suit } from '../../../../engine/types';
import { HandRange } from '../range/WeightedCombo';

export interface BlockerAnalysisResult {
  blockerScore: number;         // -1.0 (bad blocker) to +1.0 (excellent blocker)
  bluffCandidateScore: number;  // 0.0 to 1.0
  blocksValue: boolean;
  blocksCallingRange: boolean;
  unblocksFoldingRange: boolean;
  description: string;
}

export class BlockerAnalyzer {
  private static rankValues: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };

  /**
   * Analyzes blocker and unblocker properties of own hole cards on board against opponent's range.
   */
  public static analyze(
    holeCards: Card[],
    board: Card[],
    oppRange: HandRange
  ): BlockerAnalysisResult {
    if (holeCards.length < 2) {
      return {
        blockerScore: 0,
        bluffCandidateScore: 0,
        blocksValue: false,
        blocksCallingRange: false,
        unblocksFoldingRange: false,
        description: '無阻擋資訊',
      };
    }

    const c1 = holeCards[0];
    const c2 = holeCards[1];
    const v1 = this.rankValues[c1.rank];
    const v2 = this.rankValues[c2.rank];
    const maxHoleRank = Math.max(v1, v2);

    const boardRanks = board.map((c) => this.rankValues[c.rank]);
    const maxBoardRank = Math.max(...boardRanks, 0);

    // Suit counts on board
    const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
    board.forEach((c) => suitCounts[c.suit]++);

    let flushSuit: Suit | null = null;
    for (const s of ['s', 'h', 'd', 'c'] as Suit[]) {
      if (suitCounts[s] >= 3) flushSuit = s;
    }


    // 1. Nut Flush Blocker check
    const hasNutFlushBlocker = flushSuit !== null && (
      (c1.suit === flushSuit && c1.rank === 'A') ||
      (c2.suit === flushSuit && c2.rank === 'A')
    );

    const hasSecondFlushBlocker = flushSuit !== null && (
      (c1.suit === flushSuit && c1.rank === 'K') ||
      (c2.suit === flushSuit && c2.rank === 'K')
    );

    // 2. High Card Top-Pair Blocker (Ace / King)
    const blocksTopPair = (c1.rank === 'A' || c2.rank === 'A' || (maxBoardRank < 14 && (c1.rank === 'K' || c2.rank === 'K')));

    // 3. Unblocks Folding Range (Holding low cards that don't block busted straight draws)
    const unblocksFoldingRange = Math.min(v1, v2) <= 6;

    // 4. Score synthesis
    let score = 0.0;
    if (hasNutFlushBlocker) score += 0.50;
    else if (hasSecondFlushBlocker) score += 0.30;

    if (blocksTopPair && !boardRanks.includes(14)) score += 0.35;
    if (unblocksFoldingRange) score += 0.15;

    // If card blocks bottom pairs / missed draws, penalize bluff score
    const blocksMissedDraws = (v1 === 8 || v1 === 9) && (v2 === 7 || v2 === 6);
    if (blocksMissedDraws) score -= 0.25;

    score = Math.max(-1.0, Math.min(1.0, score));
    const bluffCandidateScore = Math.max(0.0, Math.min(1.0, 0.40 + score * 0.5));

    let desc = '普通阻擋效應';
    if (hasNutFlushBlocker) desc = '持有堅果同花阻擋牌 (Nut Flush Blocker)';
    else if (score >= 0.40) desc = '良好詐唬候選牌 (阻擋對手強價值，不阻擋棄牌)';
    else if (score <= -0.20) desc = '劣質詐唬候選牌 (阻擋對手棄牌範圍)';

    return {
      blockerScore: score,
      bluffCandidateScore,
      blocksValue: hasNutFlushBlocker || blocksTopPair,
      blocksCallingRange: blocksTopPair,
      unblocksFoldingRange,
      description: desc,
    };
  }
}
