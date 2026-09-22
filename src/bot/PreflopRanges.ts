import { Card } from '../engine/types';
import { VALUE_TO_RANK } from '../engine/Card';

export class PreflopRanges {
  /**
   * Converts 2 cards into standard 169 notation:
   * e.g., "AA", "AKs", "AKo", "72o"
   */
  public static getHandNotation(c1: Card, c2: Card): string {
    const higher = c1.value >= c2.value ? c1 : c2;
    const lower = c1.value >= c2.value ? c2 : c1;

    const r1 = VALUE_TO_RANK[higher.value];
    const r2 = VALUE_TO_RANK[lower.value];

    if (higher.value === lower.value) {
      return `${r1}${r2}`;
    }

    const suited = higher.suit === lower.suit ? 's' : 'o';
    return `${r1}${r2}${suited}`;
  }

  /**
   * Approximate preflop hand strength percentile from 0.0 (worst like 32o) to 1.0 (AA).
   */
  public static getHandPower(handNotation: string): number {
    // Premiums (Top 2-3%)
    if (['AA', 'KK', 'QQ'].includes(handNotation)) return 0.98;
    if (['AKs', 'JJ'].includes(handNotation)) return 0.94;
    if (['AKo', 'AQs', 'TT'].includes(handNotation)) return 0.90;

    // Strong (Top 8-12%)
    if (['AQo', 'AJs', 'KQs', '99'].includes(handNotation)) return 0.85;
    if (['ATs', 'KJs', 'QJs', '88', 'AJo'].includes(handNotation)) return 0.80;
    if (['KQo', 'KTs', 'QTs', 'JTs', '77'].includes(handNotation)) return 0.75;

    // Medium-Strong (Top 15-22%)
    if (['ATo', 'KJo', 'QJo', 'A9s', 'A8s', '66'].includes(handNotation)) return 0.70;
    if (['A5s', 'A4s', 'K9s', 'Q9s', 'J9s', 'T9s', '55'].includes(handNotation)) return 0.65;
    if (['KTo', 'QTo', 'JTo', 'A7s', 'A6s', 'A3s', 'A2s', '44'].includes(handNotation)) return 0.60;

    // Playable / Speculative (Top 25-35%)
    if (['98s', '87s', '76s', '65s', '33', '22'].includes(handNotation)) return 0.55;
    if (['K8s', 'Q8s', 'J8s', 'T8s', '97s', '86s'].includes(handNotation)) return 0.50;
    if (['A9o', 'K9o', 'Q9o', 'J9o', 'T9o'].includes(handNotation)) return 0.45;

    // Marginal (Top 35-50%)
    if (handNotation.endsWith('s')) {
      return 0.40; // Any suited Ace or King or suited connector
    }

    if (['A8o', 'A7o', 'K8o', 'Q8o', '98o', '87o'].includes(handNotation)) return 0.35;
    if (['A6o', 'A5o', 'A4o', 'A3o', 'A2o'].includes(handNotation)) return 0.30;

    // Weak / Trash
    if (['72o', '83o', '82o', '92o', '93o', 'T2o'].includes(handNotation)) return 0.05;
    return 0.20;
  }

  /**
   * Baseline open-raise percentage required based on position.
   */
  public static getPositionOpenThreshold(pos: string): number {
    const cleanPos = pos.toUpperCase();
    if (cleanPos.includes('UTG')) return 0.78; // Top ~22%
    if (cleanPos.includes('HJ')) return 0.72;  // Top ~28%
    if (cleanPos.includes('CO')) return 0.62;  // Top ~38%
    if (cleanPos.includes('BTN')) return 0.45; // Top ~55%
    if (cleanPos.includes('SB')) return 0.55;  // Top ~45%
    return 0.65; // Default / BB
  }
}
