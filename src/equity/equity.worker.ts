import {
  EquityCalculator,
  EquityCalculationRequest,
} from "../bot/EquityCalculator";

self.onmessage = (
  event: MessageEvent<{ id: string; request: EquityCalculationRequest }>,
) => {
  const { id, request } = event.data;
  try {
    self.postMessage({ id, result: EquityCalculator.calculate(request) });
  } catch {
    self.postMessage({ id, error: true });
  }
};
