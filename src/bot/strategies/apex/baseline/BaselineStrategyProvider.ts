import { BotDecision, BotDecisionContext } from '../../../types';
import { EliteStrategyV1 } from '../../elite/EliteStrategyV1';

export class BaselineStrategyProvider {
  private eliteBaseline: EliteStrategyV1;

  constructor(seed?: number) {
    this.eliteBaseline = new EliteStrategyV1('BALANCED', seed);
  }

  public setSeed(seed: number): void {
    this.eliteBaseline.setSeed(seed);
  }

  public setRng(rng: () => number): void {
    this.eliteBaseline.setRng(rng);
  }

  public getBaselineDecision(context: BotDecisionContext): BotDecision {
    return this.eliteBaseline.decideAction(context);
  }

  public decideAction(context: BotDecisionContext): BotDecision {
    return this.eliteBaseline.decideAction(context);
  }
}
