import { Card } from '../engine/types';
import { Deck } from '../engine/Deck';
import { HandEvaluator } from '../engine/HandEvaluator';
import { BotProfile } from './types';
import { OpponentRange, OpponentRangeModel } from './OpponentRangeModel';

export interface OpponentPublicInfo {
  id: string;
  position: string;
  profile?: BotProfile;
  actionHistory?: { action: string; amount?: number; reasoning?: string }[];
  range?: OpponentRange;
}

export interface EquityCalculationRequest {
  heroHoleCards: Card[];
  communityCards: Card[];
  opponents: OpponentPublicInfo[] | number; // Opponent public metadata or count
  mode?: 'range' | 'random';
  simulations?: number;
  seed?: number;
}

export interface EquityCalculationResult {
  equity: number;       // Pot share: sum(heroShare) / simulations (0.0 to 1.0)
  winRate: number;      // Sole winner percentage (0.0 to 1.0)
  tieRate: number;      // Split pot percentage (0.0 to 1.0)
  lossRate: number;     // Lost percentage (0.0 to 1.0)
  standardError: number;// Standard error of the mean
  marginOfError: number;// 95% Confidence Interval half-width (~1.96 * SE)
  simulations: number;  // Actual trials performed
  isExact: boolean;     // True if exact enumeration was used
  mode: 'range' | 'random';
}

export class EquityCalculator {
  /**
   * Mulberry32 PRNG for deterministic, reproducible simulations
   */
  private static createRng(seed?: number): () => number {
    if (seed === undefined) {
      return Math.random;
    }
    let s = Math.floor(seed);
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Computes Hero's equity, win rate, tie rate, and loss rate against multiway opponents.
   */
  public static calculate(request: EquityCalculationRequest): EquityCalculationResult {
    const {
      heroHoleCards,
      communityCards,
      opponents,
      mode = 'range',
      simulations = 10000,
      seed,
    } = request;

    if (heroHoleCards.length < 2) {
      return {
        equity: 0,
        winRate: 0,
        tieRate: 0,
        lossRate: 1,
        standardError: 0,
        marginOfError: 0,
        simulations: 0,
        isExact: false,
        mode,
      };
    }

    // Normalize opponents list
    const opponentList: OpponentPublicInfo[] = Array.isArray(opponents)
      ? opponents
      : Array.from({ length: Math.max(1, opponents) }, (_, i) => ({
          id: `opp_${i}`,
          position: i === 0 ? 'BTN' : 'CO',
        }));

    const numOpponents = opponentList.length;

    // Check if River Exact Enumeration applies:
    // When board is complete (5 cards) and facing 1 opponent with defined or small range
    if (communityCards.length === 5 && numOpponents === 1) {
      return this.enumerateRiver(heroHoleCards, communityCards, opponentList[0], mode);
    }

    // Otherwise run Monte Carlo simulation
    return this.runMonteCarlo(
      heroHoleCards,
      communityCards,
      opponentList,
      mode,
      simulations,
      seed
    );
  }

  /**
   * Exact enumeration on River for 1 opponent (0 remaining community cards).
   * Evaluates every legal combo with zero sampling error.
   */
  private static enumerateRiver(
    heroHoleCards: Card[],
    communityCards: Card[],
    opponent: OpponentPublicInfo,
    mode: 'range' | 'random'
  ): EquityCalculationResult {
    const deadCards = [...heroHoleCards, ...communityCards];
    const deadSet = new Set(deadCards.map((c) => c.id));

    // Get candidate combos
    const range =
      mode === 'range'
        ? opponent.range ||
          OpponentRangeModel.buildRange(
            opponent.position,
            opponent.profile,
            opponent.actionHistory,
            communityCards,
            deadCards
          )
        : null;

    const candidateCombos: { cards: [Card, Card]; weight: number }[] = [];

    if (mode === 'range' && range) {
      for (const wc of range.combos) {
        if (!deadSet.has(wc.cards[0].id) && !deadSet.has(wc.cards[1].id) && wc.weight > 0) {
          candidateCombos.push({ cards: wc.cards, weight: wc.weight });
        }
      }
    } else {
      // Random mode: all legal combos from remaining deck
      const all = OpponentRangeModel.getAllCombos();
      for (const item of all) {
        if (!deadSet.has(item.cards[0].id) && !deadSet.has(item.cards[1].id)) {
          candidateCombos.push({ cards: item.cards, weight: 1.0 });
        }
      }
    }

    if (candidateCombos.length === 0) {
      return {
        equity: 1,
        winRate: 1,
        tieRate: 0,
        lossRate: 0,
        standardError: 0,
        marginOfError: 0,
        simulations: 0,
        isExact: true,
        mode,
      };
    }

    const heroEval = HandEvaluator.evaluate([...heroHoleCards, ...communityCards]);

    let totalWeight = 0;
    let weightedHeroShare = 0;
    let weightedWins = 0;
    let weightedTies = 0;
    let weightedLosses = 0;

    for (const combo of candidateCombos) {
      const oppEval = HandEvaluator.evaluate([...combo.cards, ...communityCards]);
      const comp = HandEvaluator.compareScores(heroEval.score, oppEval.score);

      totalWeight += combo.weight;

      if (comp > 0) {
        // Hero wins sole pot
        weightedWins += combo.weight;
        weightedHeroShare += combo.weight * 1.0;
      } else if (comp === 0) {
        // Tie (2-way split)
        weightedTies += combo.weight;
        weightedHeroShare += combo.weight * 0.5;
      } else {
        // Hero loses
        weightedLosses += combo.weight;
      }
    }

    const equity = totalWeight > 0 ? Number((weightedHeroShare / totalWeight).toFixed(4)) : 0;
    const winRate = totalWeight > 0 ? Number((weightedWins / totalWeight).toFixed(4)) : 0;
    const tieRate = totalWeight > 0 ? Number((weightedTies / totalWeight).toFixed(4)) : 0;
    const lossRate = totalWeight > 0 ? Number((weightedLosses / totalWeight).toFixed(4)) : 0;

    return {
      equity,
      winRate,
      tieRate,
      lossRate,
      standardError: 0, // Exact enumeration has 0 variance
      marginOfError: 0,
      simulations: candidateCombos.length,
      isExact: true,
      mode,
    };
  }

  /**
   * Runs Monte Carlo multiway simulation simultaneously evaluating Hero vs all active opponents.
   */
  private static runMonteCarlo(
    heroHoleCards: Card[],
    communityCards: Card[],
    opponents: OpponentPublicInfo[],
    mode: 'range' | 'random',
    simulations: number,
    seed?: number
  ): EquityCalculationResult {
    const rng = this.createRng(seed);
    const numOpponents = opponents.length;
    const boardNeeded = 5 - communityCards.length;

    const baseKnownCards = [...heroHoleCards, ...communityCards];
    const baseKnownIds = new Set(baseKnownCards.map((c) => c.id));

    // Full 52 card deck
    const fullDeck = new Deck().getCards();
    const availablePool = fullDeck.filter((c) => !baseKnownIds.has(c.id));

    // Pre-build ranges for opponents if in range mode
    const opponentRanges: (OpponentRange | null)[] = opponents.map((opp) => {
      if (mode === 'range') {
        return (
          opp.range ||
          OpponentRangeModel.buildRange(
            opp.position,
            opp.profile,
            opp.actionHistory,
            communityCards,
            baseKnownCards
          )
        );
      }
      return null;
    });

    let totalHeroShare = 0;
    let heroShareSquared = 0;
    let wins = 0;
    let ties = 0;
    let losses = 0;

    for (let sim = 0; sim < simulations; sim++) {
      const trialUnavailableIds = new Set(baseKnownIds);
      const oppCardsList: [Card, Card][] = [];

      // Sample cards for each opponent without replacement
      let sampleFailed = false;

      for (let o = 0; o < numOpponents; o++) {
        let oppCards: [Card, Card] | null = null;
        const range = opponentRanges[o];

        if (mode === 'range' && range && range.combos.length > 0) {
          oppCards = OpponentRangeModel.sampleCombo(range, trialUnavailableIds, rng);
        }

        // Fallback to random if range sampling was empty or in random mode
        if (!oppCards) {
          const pool = availablePool.filter((c) => !trialUnavailableIds.has(c.id));
          if (pool.length < 2) {
            sampleFailed = true;
            break;
          }
          // Pick 2 random cards
          const i1 = Math.floor(rng() * pool.length);
          const c1 = pool[i1];
          pool.splice(i1, 1);
          const i2 = Math.floor(rng() * pool.length);
          const c2 = pool[i2];
          oppCards = [c1, c2];
        }

        trialUnavailableIds.add(oppCards[0].id);
        trialUnavailableIds.add(oppCards[1].id);
        oppCardsList.push(oppCards);
      }

      if (sampleFailed || oppCardsList.length !== numOpponents) {
        continue;
      }

      // Draw remaining community cards from deck pool without collision
      const remainingDeck = availablePool.filter((c) => !trialUnavailableIds.has(c.id));
      if (remainingDeck.length < boardNeeded) {
        continue;
      }

      const simBoard = [...communityCards];
      for (let b = 0; b < boardNeeded; b++) {
        const randIdx = Math.floor(rng() * remainingDeck.length);
        const drawCard = remainingDeck[randIdx];
        remainingDeck.splice(randIdx, 1);
        trialUnavailableIds.add(drawCard.id);
        simBoard.push(drawCard);
      }

      // Assertion: Ensure all dealt cards are unique in this trial
      const allDealtCount =
        heroHoleCards.length + simBoard.length + numOpponents * 2;
      if (trialUnavailableIds.size !== allDealtCount) {
        throw new Error(
          `Card removal integrity assertion failed: expected ${allDealtCount} unique cards, got ${trialUnavailableIds.size}`
        );
      }

      // Multiway Showdown: Evaluate all participants
      const heroEval = HandEvaluator.evaluate([...heroHoleCards, ...simBoard]);
      let maxScore = heroEval.score;
      let topTiedCount = 1;
      let heroIsTop = true;

      for (let o = 0; o < numOpponents; o++) {
        const oppEval = HandEvaluator.evaluate([...oppCardsList[o], ...simBoard]);
        const comp = HandEvaluator.compareScores(oppEval.score, maxScore);

        if (comp > 0) {
          maxScore = oppEval.score;
          topTiedCount = 1;
          heroIsTop = false;
        } else if (comp === 0) {
          topTiedCount++;
        }
      }

      // Compute Hero's Pot Share
      let heroShare = 0;
      if (heroIsTop) {
        heroShare = 1.0 / topTiedCount;
        if (topTiedCount === 1) {
          wins++;
        } else {
          ties++;
        }
      } else {
        heroShare = 0;
        losses++;
      }

      totalHeroShare += heroShare;
      heroShareSquared += heroShare * heroShare;
    }

    const equity = simulations > 0 ? Number((totalHeroShare / simulations).toFixed(4)) : 0;
    const winRate = simulations > 0 ? Number((wins / simulations).toFixed(4)) : 0;
    const tieRate = simulations > 0 ? Number((ties / simulations).toFixed(4)) : 0;
    const lossRate = simulations > 0 ? Number((losses / simulations).toFixed(4)) : 0;

    // Sample variance of heroShare: s^2 = (sum(x^2) - (sum(x)^2)/N) / (N - 1)
    const variance =
      simulations > 1
        ? Math.max(0, (heroShareSquared - (totalHeroShare * totalHeroShare) / simulations) / (simulations - 1))
        : 0;
    const standardError = Number((Math.sqrt(variance / simulations)).toFixed(4));
    const marginOfError = Number((1.96 * standardError).toFixed(4));

    return {
      equity,
      winRate,
      tieRate,
      lossRate,
      standardError,
      marginOfError,
      simulations,
      isExact: false,
      mode,
    };
  }
}
