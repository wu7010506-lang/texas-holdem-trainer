import { Card, Rank, Suit } from '../../../../engine/types';

export interface DetailedBoardTexture {
  isRainbow: boolean;
  isTwoTone: boolean;
  isMonotone: boolean;
  isPaired: boolean;
  isDoublePaired: boolean;
  isConnected: boolean;
  isHighlyConnected: boolean;
  isHighCardBoard: boolean;
  isLowCardBoard: boolean;
  isStraightHeavy: boolean;
  isFlushHeavy: boolean;
  isDynamic: boolean;
  isStatic: boolean;
  wetnessScore: number; // 0.0 (bone dry) to 1.0 (ultra wet)
  description: string;
}

export interface BoardRunoutInfo {
  completesFlush: boolean;
  completesStraight: boolean;
  pairsBoard: boolean;
  isOvercard: boolean;
  isBlank: boolean;
  changesNutAdvantage: boolean;
  changesRangeAdvantage: boolean;
  description: string;
}

export class BoardTextureAnalyzer {
  private static rankValues: Record<Rank, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10,
    'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };

  public static analyze(cards: Card[]): DetailedBoardTexture {
    if (cards.length < 3) {
      return {
        isRainbow: false, isTwoTone: false, isMonotone: false,
        isPaired: false, isDoublePaired: false, isConnected: false, isHighlyConnected: false,
        isHighCardBoard: false, isLowCardBoard: false, isStraightHeavy: false, isFlushHeavy: false,
        isDynamic: false, isStatic: true, wetnessScore: 0, description: '翻前無公牌',
      };
    }

    const suits = cards.map((c) => c.suit);
    const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };
    suits.forEach((s) => suitCounts[s]++);

    const maxSuitCount = Math.max(...Object.values(suitCounts));

    const isMonotone = maxSuitCount >= 3;
    const isTwoTone = maxSuitCount === 2 && suits.length === 3;
    const isRainbow = maxSuitCount === 1 || (suits.length >= 3 && Object.values(suitCounts).filter((c) => c > 0).length >= 3 && maxSuitCount <= 1);
    const isFlushHeavy = maxSuitCount >= 3;

    // Rank analysis
    const ranks = cards.map((c) => this.rankValues[c.rank]).sort((a, b) => b - a);
    const rankCounts: Record<number, number> = {};
    ranks.forEach((r) => (rankCounts[r] = (rankCounts[r] || 0) + 1));
    const counts = Object.values(rankCounts).sort((a, b) => b - a);

    const isPaired = counts[0] === 2;
    const isDoublePaired = (counts[0] === 2 && counts[1] === 2) || counts[0] >= 3;

    // High / Low cards
    const highCards = ranks.filter((r) => r >= 10).length;
    const isHighCardBoard = highCards >= 2;
    const isLowCardBoard = ranks.every((r) => r <= 9);

    // Connectivity
    let gaps = 0;
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => a - b);
    let maxConnectedRun = 1;
    let currentRun = 1;
    for (let i = 1; i < uniqueRanks.length; i++) {
      const diff = uniqueRanks[i] - uniqueRanks[i - 1];
      if (diff === 1) {
        currentRun++;
        maxConnectedRun = Math.max(maxConnectedRun, currentRun);
      } else {
        currentRun = 1;
      }
      if (diff <= 2) {
        gaps++;
      }
    }

    const isConnected = maxConnectedRun >= 2 || gaps >= 2;
    const isHighlyConnected = maxConnectedRun >= 3 || (uniqueRanks.length >= 3 && uniqueRanks[uniqueRanks.length - 1] - uniqueRanks[0] <= 4);
    const isStraightHeavy = isHighlyConnected;

    // Wetness score calculation (0.0 to 1.0)
    let wetness = 0.15;
    if (isMonotone) wetness += 0.35;
    else if (isTwoTone) wetness += 0.15;

    if (isHighlyConnected) wetness += 0.35;
    else if (isConnected) wetness += 0.15;

    if (isPaired) wetness -= 0.10;
    if (isLowCardBoard) wetness += 0.05;

    wetness = Math.max(0.05, Math.min(0.95, wetness));

    const isDynamic = wetness >= 0.55 && !isPaired;
    const isStatic = !isDynamic;

    const descParts: string[] = [];
    if (isMonotone) descParts.push('單色牌面');
    else if (isTwoTone) descParts.push('雙色牌面');
    else if (isRainbow) descParts.push('彩虹牌面');

    if (isDoublePaired) descParts.push('雙對面');
    else if (isPaired) descParts.push('公對面');

    if (isHighlyConnected) descParts.push('強連張順子面');
    else if (isConnected) descParts.push('微連張');
    else descParts.push('乾燥不連貫');

    if (isHighCardBoard) descParts.push('大牌面');
    if (isLowCardBoard) descParts.push('小牌面');

    return {
      isRainbow,
      isTwoTone,
      isMonotone,
      isPaired,
      isDoublePaired,
      isConnected,
      isHighlyConnected,
      isHighCardBoard,
      isLowCardBoard,
      isStraightHeavy,
      isFlushHeavy,
      isDynamic,
      isStatic,
      wetnessScore: wetness,
      description: descParts.join(' / '),
    };
  }

  /**
   * Analyzes turn/river card runout relative to previous board.
   */
  public static analyzeRunout(previousCards: Card[], newCard: Card): BoardRunoutInfo {
    const fullBoard = [...previousCards, newCard];
    const prevTexture = this.analyze(previousCards);
    const newTexture = this.analyze(fullBoard);

    const prevSuits = previousCards.map((c) => c.suit);
    const completesFlush = !prevTexture.isMonotone && newTexture.isMonotone && prevSuits.filter((s) => s === newCard.suit).length >= 2;

    const prevRankValues = previousCards.map((c) => this.rankValues[c.rank]);
    const newRankValue = this.rankValues[newCard.rank];
    const isOvercard = newRankValue > Math.max(...prevRankValues);
    const pairsBoard = prevRankValues.includes(newRankValue);

    const completesStraight = !prevTexture.isStraightHeavy && newTexture.isStraightHeavy;
    const isBlank = !completesFlush && !completesStraight && !pairsBoard && !isOvercard && newRankValue <= 8;

    const changesNutAdvantage = completesFlush || completesStraight || pairsBoard;
    const changesRangeAdvantage = isOvercard || completesFlush;

    const descList: string[] = [];
    if (completesFlush) descList.push('同花成牌面');
    if (completesStraight) descList.push('順子成牌面');
    if (pairsBoard) descList.push('公牌成對');
    if (isOvercard) descList.push('出現超牌');
    if (isBlank) descList.push('安全白牌 (Blank)');

    return {
      completesFlush,
      completesStraight,
      pairsBoard,
      isOvercard,
      isBlank,
      changesNutAdvantage,
      changesRangeAdvantage,
      description: descList.length > 0 ? descList.join(', ') : '普通轉折牌',
    };
  }
}
