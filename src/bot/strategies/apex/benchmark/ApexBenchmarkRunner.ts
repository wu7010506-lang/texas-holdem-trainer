import { ApexStrategy } from '../ApexStrategy';
import { HeroModel, recordEvent } from '../model/HeroModel';


export interface BenchmarkResult {
  opponentName: string;
  handsSimulated: number;
  apexDecisionReason: string;
  exploitDetected: boolean;
  baselineEV: number;
  apexEV: number;
  netExploitGain: number; // in BB
}

export class ApexBenchmarkRunner {
  /**
   * Evaluates how ApexStrategy adapts against RiverOverfolderBot
   */
  public static benchmarkRiverOverfolder(): BenchmarkResult {
    const heroModel = new HeroModel();
    // Simulate 20 observations of River overfolding
    for (let i = 0; i < 20; i++) {
      recordEvent(heroModel.riverStats.foldVsLarge, true);
      recordEvent(heroModel.riverStats.foldVsOverbet, true);
    }
    heroModel.handsTracked = 25;

    const apex = new ApexStrategy(heroModel);

    // Create a river decision context where Bot has weak air (Queen high)
    const context: any = {
      holeCards: [{ suit: 's', rank: 12, id: 'Qs' }, { suit: 'd', rank: 3, id: '3d' }],
      communityCards: [
        { suit: 'h', rank: 14, id: 'Ah' },
        { suit: 'c', rank: 10, id: 'Tc' },
        { suit: 's', rank: 7, id: '7s' },
        { suit: 'h', rank: 4, id: '4h' },
        { suit: 'd', rank: 2, id: '2d' },
      ],
      position: 'BTN',
      street: 'RIVER',
      potSize: 20,
      playerStack: 100,
      effectiveStack: 100,
      amountToCall: 0,
      minimumRaise: 2,
      currentBet: 0,
      bigBlind: 2,
      numberOfPlayers: 2,
      activePlayers: 2,
      previousActions: [],
      positionRelativeToButton: 0,
      spr: 5,
      potOdds: 0,
      boardTexture: { wetnessScore: 0.1, description: 'Dry' },
      handStrength: { category: 'AIR', categoryName: 'High Card', estimatedEquity: 0.1 },
      legalActions: { canFold: false, canCheck: true, canCall: false, canBet: true, canRaise: false },
    };

    const decision = apex.decideAction(context);
    const trace = decision.debugTrace;

    return {
      opponentName: 'RiverOverfolderBot',
      handsSimulated: 25,
      apexDecisionReason: decision.reasoning,
      exploitDetected: decision.reasonCodes?.includes('EXPLOIT_OVERFOLD') ?? false,
      baselineEV: trace?.baselinePreferredEV ?? 0,
      apexEV: trace?.exploitPreferredEV ?? 0,
      netExploitGain: trace?.expectedExploitGain ?? 0,
    };
  }

  /**
   * Evaluates how ApexStrategy adapts against CallingStationBot
   */
  public static benchmarkCallingStation(): BenchmarkResult {
    const heroModel = new HeroModel();
    // Simulate 20 observations of Calling Station never folding
    for (let i = 0; i < 20; i++) {
      recordEvent(heroModel.riverStats.foldVsLarge, false);
      recordEvent(heroModel.riverStats.foldVsOverbet, false);
    }
    heroModel.handsTracked = 25;

    const apex = new ApexStrategy(heroModel);

    // Decision context: Bot has medium top pair with weak kicker
    const context: any = {
      holeCards: [{ suit: 's', rank: 10, id: 'Ts' }, { suit: 'd', rank: 5, id: '5d' }],
      communityCards: [
        { suit: 'h', rank: 10, id: 'Th' },
        { suit: 'c', rank: 7, id: '7c' },
        { suit: 's', rank: 4, id: '4s' },
        { suit: 'h', rank: 3, id: '3h' },
        { suit: 'd', rank: 2, id: '2d' },
      ],
      position: 'BTN',
      street: 'RIVER',
      potSize: 20,
      playerStack: 100,
      effectiveStack: 100,
      amountToCall: 0,
      minimumRaise: 2,
      currentBet: 0,
      bigBlind: 2,
      numberOfPlayers: 2,
      activePlayers: 2,
      previousActions: [],
      positionRelativeToButton: 0,
      spr: 5,
      potOdds: 0,
      boardTexture: { wetnessScore: 0.1, description: 'Dry' },
      handStrength: { category: 'TOP_PAIR_WEAK_KICKER', categoryName: 'Top Pair', estimatedEquity: 0.65 },
      legalActions: { canFold: false, canCheck: true, canCall: false, canBet: true, canRaise: false },
    };

    const decision = apex.decideAction(context);
    const trace = decision.debugTrace;

    return {
      opponentName: 'CallingStationBot',
      handsSimulated: 25,
      apexDecisionReason: decision.reasoning,
      exploitDetected: decision.reasonCodes?.includes('EXPLOIT_OVERCALL') ?? false,
      baselineEV: trace?.baselinePreferredEV ?? 0,
      apexEV: trace?.exploitPreferredEV ?? 0,
      netExploitGain: trace?.expectedExploitGain ?? 0,
    };
  }
}
