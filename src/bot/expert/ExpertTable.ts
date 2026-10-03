import { ActionRecord } from "../../engine/types";
import { BotDecision, BotDecisionContext } from "../types";
import type { ExpertStrategy } from "./ExpertStrategy";

interface SeatSession {
  worker?: Worker;
  local?: ExpertStrategy;
  pending?: {
    id: number;
    resolve: (decision: BotDecision) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  };
}

/** Five private strategy sessions. Only allowlisted contexts and public betting records cross this interface. */
export class ExpertTable {
  private sessions = new Map<number, SeatSession>();
  private history: ActionRecord[][] = [];
  private requestId = 0;
  private disposed = false;

  observe(history: ActionRecord[]): void {
    if (!history.length) return;
    this.history.push(history);
    if (this.history.length > 80) this.history.shift();
    for (const session of this.sessions.values()) {
      session.worker?.postMessage({ type: "observe", history });
      session.local?.observe(history);
    }
  }

  async decide(
    context: BotDecisionContext,
    styleIndex: number,
  ): Promise<BotDecision> {
    if (this.disposed) throw new Error("Expert session is closed");
    const seat = context.selfSeat;
    if (seat === undefined) throw new Error("Missing expert seat");
    let session = this.sessions.get(seat);
    if (!session) {
      session = {};
      this.sessions.set(seat, session);
      if (typeof Worker !== "undefined") {
        const worker = new Worker(
          new URL("./expert.worker.ts", import.meta.url),
          { type: "module" },
        );
        session.worker = worker;
        worker.postMessage({ type: "init", styleIndex, history: this.history });
        const current = session;
        worker.onmessage = (
          event: MessageEvent<{
            id: number;
            decision?: BotDecision;
            error?: string;
          }>,
        ) => {
          const pending = current.pending;
          if (!pending || pending.id !== event.data.id) return;
          clearTimeout(pending.timer);
          current.pending = undefined;
          if (event.data.decision) pending.resolve(event.data.decision);
          else
            pending.reject(
              new Error(event.data.error ?? "Expert decision failed"),
            );
        };
        worker.onerror = () => {
          if (current.pending) {
            clearTimeout(current.pending.timer);
            current.pending.reject(new Error("對手運算失敗，請重新整理牌桌。"));
            current.pending = undefined;
          }
        };
      } else {
        // Node test/benchmark adapter exercises the same expert implementation.
        const { ExpertStrategy } = await import("./ExpertStrategy");
        session.local = new ExpertStrategy({
          styleIndex,
          seed: 0x45585000 + seat,
        });
        for (const history of this.history) session.local.observe(history);
      }
    }
    if (session.local) return session.local.decideAction(context);
    if (session.pending)
      throw new Error("A decision is already pending for this seat");
    const current = session;
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        current.pending = undefined;
        current.worker?.terminate();
        this.sessions.delete(seat);
        reject(new Error("對手思考逾時，請重新整理牌桌。"));
      }, 15000);
      current.pending = { id, resolve, reject, timer };
      current.worker!.postMessage({ type: "decide", id, context });
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const session of this.sessions.values()) {
      session.worker?.terminate();
      if (session.pending) {
        clearTimeout(session.pending.timer);
        session.pending.reject(new Error("Expert session is closed"));
      }
    }
    this.sessions.clear();
  }
}
