import { ActionRecord } from "../../engine/types";
import { BotDecisionContext } from "../types";
import { ExpertStrategy } from "./ExpertStrategy";

let strategy: ExpertStrategy;
self.onmessage = (
  event: MessageEvent<
    | { type: "init"; styleIndex: number; history: ActionRecord[][] }
    | { type: "observe"; history: ActionRecord[] }
    | { type: "decide"; id: number; context: BotDecisionContext }
  >,
) => {
  const message = event.data;
  if (message.type === "init") {
    // Strategy randomness is independent of the real deck seed.
    strategy = new ExpertStrategy({
      styleIndex: message.styleIndex,
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
    });
    for (const history of message.history) strategy.observe(history);
  } else if (message.type === "observe") strategy.observe(message.history);
  else {
    try {
      self.postMessage({
        id: message.id,
        decision: strategy.decideAction(message.context),
      });
    } catch (error) {
      self.postMessage({
        id: message.id,
        error:
          error instanceof Error ? error.message : "Expert decision failed",
      });
    }
  }
};
