import { EliteDecisionTrace } from '../types';

export class EliteTraceStore {
  private static lastTrace: EliteDecisionTrace | null = null;

  public static setLastTrace(trace: EliteDecisionTrace): void {
    this.lastTrace = trace;
  }

  public static getLastTrace(): EliteDecisionTrace | null {
    return this.lastTrace;
  }

  public static clear(): void {
    this.lastTrace = null;
  }
}
