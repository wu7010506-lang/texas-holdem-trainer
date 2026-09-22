import { Card } from '../engine/types';
import { BoardTextureInfo } from './types';

export class BoardAnalyzer {
  public static analyze(communityCards: Card[]): BoardTextureInfo {
    if (communityCards.length < 3) {
      return {
        isMonotone: false,
        isTwoTone: false,
        isRainbow: false,
        isPaired: false,
        isConnected: false,
        isHighCardHeavy: false,
        wetnessScore: 0,
        description: '翻牌前 (尚無公共牌)',
      };
    }

    const suits = communityCards.map((c) => c.suit);
    const suitCounts: Record<string, number> = {};
    for (const s of suits) {
      suitCounts[s] = (suitCounts[s] || 0) + 1;
    }
    const maxSuitCount = Math.max(...Object.values(suitCounts));

    const isMonotone = maxSuitCount >= 3;
    const isTwoTone = maxSuitCount === 2 && communityCards.length <= 4;
    const isRainbow = maxSuitCount === 1 && communityCards.length === 3;

    // Check pairing
    const values = communityCards.map((c) => c.value).sort((a, b) => a - b);
    const uniqueVals = new Set(values);
    const isPaired = uniqueVals.size < values.length;

    // Check connectivity (straight potential)
    let connectedPairs = 0;
    for (let i = 0; i < values.length - 1; i++) {
      const diff = values[i + 1] - values[i];
      if (diff === 1 || diff === 2) {
        connectedPairs++;
      }
    }
    const isConnected = connectedPairs >= 2;

    // High card heavy: cards >= 10 (T, J, Q, K, A)
    const highCards = values.filter((v) => v >= 10).length;
    const isHighCardHeavy = highCards >= 2;

    // Compute wetness score (0.0 to 1.0)
    let wetness = 0.2;
    if (isMonotone) wetness += 0.35;
    else if (isTwoTone) wetness += 0.15;

    if (isConnected) wetness += 0.25;
    if (isHighCardHeavy) wetness += 0.15;
    if (isPaired) wetness -= 0.15; // Paired boards reduce straight/flush options

    wetness = Math.max(0.05, Math.min(1.0, wetness));

    const tags: string[] = [];
    if (wetness > 0.6) tags.push('潮濕牌面 (Wet / Dynamic)');
    else if (wetness < 0.35) tags.push('乾燥牌面 (Dry / Static)');
    else tags.push('中度牌面');

    if (isMonotone) tags.push('單色面 (Monotone)');
    else if (isTwoTone) tags.push('雙色面 (Two-tone)');
    else if (isRainbow) tags.push('彩虹面 (Rainbow)');

    if (isPaired) tags.push('公牌成對 (Paired)');
    if (isConnected) tags.push('連張順面 (Connected)');
    if (isHighCardHeavy) tags.push('大牌集中 (Broadway)');

    return {
      isMonotone,
      isTwoTone,
      isRainbow,
      isPaired,
      isConnected,
      isHighCardHeavy,
      wetnessScore: Number(wetness.toFixed(2)),
      description: tags.join(' · '),
    };
  }
}
