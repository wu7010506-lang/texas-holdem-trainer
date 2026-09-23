import { ApexDecisionTrace } from '../types';

export class ApexTelemetryService {
  private static latestTrace: ApexDecisionTrace | null = null;
  private static listeners: ((trace: ApexDecisionTrace) => void)[] = [];

  public static setLatestTrace(trace: ApexDecisionTrace): void {
    this.latestTrace = trace;
    this.listeners.forEach(fn => fn(trace));
  }

  public static getLatestTrace(): ApexDecisionTrace | null {
    return this.latestTrace;
  }

  public static subscribe(fn: (trace: ApexDecisionTrace) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
}
