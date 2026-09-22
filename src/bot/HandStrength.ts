import { Card, HandRank } from '../engine/types';
import { HandEvaluator } from '../engine/HandEvaluator';
import { HandStrengthInfo, MadeHandCategory } from './types';
import { PreflopRanges } from './PreflopRanges';

export class HandStrength {
  public static evaluate(holeCards: Card[], communityCards: Card[]): HandStrengthInfo {
    if (communityCards.length === 0) {
      if (holeCards.length < 2) {
        return {
          category: 'AIR',
          categoryName: '未知',
          hasFlushDraw: false,
          hasOESD: false,
          hasGutshot: false,
          hasOvercards: false,
          estimatedEquity: 0.3,
          description: '等待發牌',
        };
      }
      const notation = PreflopRanges.getHandNotation(holeCards[0], holeCards[1]);
      const power = PreflopRanges.getHandPower(notation);
      return {
        category: power >= 0.85 ? 'OVERPAIR' : power >= 0.6 ? 'MIDDLE_PAIR' : 'AIR',
        categoryName: `翻前 (${notation})`,
        hasFlushDraw: holeCards[0].suit === holeCards[1].suit,
        hasOESD: false,
        hasGutshot: false,
        hasOvercards: holeCards[0].value >= 10 && holeCards[1].value >= 10,
        estimatedEquity: power,
        description: `翻前手牌 ${notation} (強度前段位: 約 ${(power * 100).toFixed(0)}%)`,
      };
    }

    const allCards = [...holeCards, ...communityCards];
    const handEval = HandEvaluator.evaluate(allCards);

    const boardValues = communityCards.map((c) => c.value).sort((a, b) => b - a);
    const maxBoardVal = boardValues[0];
    const holeVals = holeCards.map((c) => c.value).sort((a, b) => b - a);

    // Check draws
    const allSuits = allCards.map((c) => c.suit);
    const suitCounts: Record<string, number> = {};
    for (const s of allSuits) suitCounts[s] = (suitCounts[s] || 0) + 1;
    const hasFlushDraw = Object.values(suitCounts).some((cnt) => cnt === 4);

    // Straight draws
    const uniqueValues = Array.from(new Set(allCards.map((c) => c.value))).sort((a, b) => a - b);
    let hasOESD = false;
    let hasGutshot = false;

    // Check 4-card sequences
    for (let i = 0; i < uniqueValues.length - 3; i++) {
      const span = uniqueValues[i + 3] - uniqueValues[i];
      if (span === 3) {
        const low = uniqueValues[i];
        const high = uniqueValues[i + 3];
        if (low > 2 && high < 14) {
          hasOESD = true;
        } else {
          hasGutshot = true;
        }
      } else if (span === 4) {
        hasGutshot = true;
      }
    }

    const hasOvercards = holeVals[0] > maxBoardVal && holeVals[1] > maxBoardVal;

    let category: MadeHandCategory = 'AIR';
    let categoryName = '高牌 (High Card)';
    let baseEquity = 0.20;

    switch (handEval.handRank) {
      case HandRank.STRAIGHT_FLUSH:
      case HandRank.FOUR_OF_A_KIND:
        category = 'QUADS_OR_BETTER';
        categoryName = handEval.rankName === 'Royal Flush' ? '皇家同花順 (Royal Flush)' : '同花順 / 四條 (Monster)';
        baseEquity = 0.98;
        break;

      case HandRank.FULL_HOUSE:
        category = 'FULL_HOUSE';
        categoryName = '葫蘆 (Full House)';
        baseEquity = 0.94;
        break;

      case HandRank.FLUSH:
        category = 'FLUSH';
        categoryName = '同花 (Flush)';
        baseEquity = 0.88;
        break;

      case HandRank.STRAIGHT:
        category = 'STRAIGHT';
        categoryName = '順子 (Straight)';
        baseEquity = 0.82;
        break;

      case HandRank.THREE_OF_A_KIND:
        category = 'TRIPS_OR_SET';
        categoryName = '三條 (Trips / Set)';
        baseEquity = 0.78;
        break;

      case HandRank.TWO_PAIR:
        category = 'TWO_PAIR';
        categoryName = '兩對 (Two Pair)';
        baseEquity = 0.72;
        break;

      case HandRank.ONE_PAIR: {
        const pairVal = handEval.score[1];
        if (holeCards[0].value === holeCards[1].value && holeCards[0].value > maxBoardVal) {
          category = 'OVERPAIR';
          categoryName = '超對 (Overpair)';
          baseEquity = 0.75;
        } else if (pairVal === maxBoardVal) {
          const kicker = holeVals[0] === pairVal ? holeVals[1] : holeVals[0];
          if (kicker >= 10) {
            category = 'TOP_PAIR_GOOD_KICKER';
            categoryName = '頂對好踢腳 (Top Pair, Good Kicker)';
            baseEquity = 0.65;
          } else {
            category = 'TOP_PAIR_WEAK_KICKER';
            categoryName = '頂對弱踢腳 (Top Pair, Weak Kicker)';
            baseEquity = 0.55;
          }
        } else if (pairVal > boardValues[boardValues.length - 1]) {
          category = 'MIDDLE_PAIR';
          categoryName = '中對 (Middle Pair)';
          baseEquity = 0.45;
        } else {
          category = 'WEAK_PAIR';
          categoryName = '底對 / 弱對 (Weak Pair)';
          baseEquity = 0.32;
        }
        break;
      }

      default:
        category = 'AIR';
        categoryName = '無對子 / 高牌 (High Card)';
        baseEquity = 0.15;
        break;
    }

    // Boost equity with draws if not already a monster hand
    if (handEval.handRank < HandRank.STRAIGHT) {
      if (hasFlushDraw && hasOESD) baseEquity += 0.35; // Monster combo draw
      else if (hasFlushDraw) baseEquity += 0.22;
      else if (hasOESD) baseEquity += 0.18;
      else if (hasGutshot) baseEquity += 0.08;

      if (hasOvercards && baseEquity < 0.5) baseEquity += 0.08;
    }

    baseEquity = Math.min(0.99, Math.max(0.05, baseEquity));

    const drawParts: string[] = [];
    if (hasFlushDraw && hasOESD) drawParts.push('強力雙抽聽牌 (同花+兩頭順)');
    else {
      if (hasFlushDraw) drawParts.push('同花聽牌 (Flush Draw, 9 outs)');
      if (hasOESD) drawParts.push('兩頭順聽牌 (OESD, 8 outs)');
      else if (hasGutshot) drawParts.push('卡順聽牌 (Gutshot, 4 outs)');
    }
    if (hasOvercards) drawParts.push('高牌 (Overcards)');

    const desc = drawParts.length > 0
      ? `${categoryName} ＋ ${drawParts.join('、')}`
      : `${categoryName}`;

    return {
      category,
      categoryName,
      hasFlushDraw,
      hasOESD,
      hasGutshot,
      hasOvercards,
      estimatedEquity: Number(baseEquity.toFixed(2)),
      description: desc,
    };
  }
}
