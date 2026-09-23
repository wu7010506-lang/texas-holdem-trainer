import { HeroModel, getPosteriorRate } from './HeroModel';
import { Street } from '../../../../engine/types';

export interface PredictedResponse {
  foldRate: number;
  callRate: number;
  raiseRate: number;
  confidence: number;
}

export class HeroResponsePredictor {
  /**
   * Predicts Hero's response distribution P(Fold), P(Call), P(Raise) given a proposed bet sizing.
   */
  public static predictResponse(
    model: HeroModel,
    street: Street,
    betFractionOfPot: number,
    boardTextureKey = 'DRY'
  ): PredictedResponse {
    let fold = 0.45;
    let call = 0.45;
    let raise = 0.10;
    let confidence = 0.20;

    if (street === 'FLOP') {
      const flop = model.getFlopStats(boardTextureKey);
      const flopFold = getPosteriorRate(flop.foldVsCbet);
      const flopRaise = getPosteriorRate(flop.raiseVsCbet);

      // Higher sizing slightly increases fold rate
      const sizeMultiplier = betFractionOfPot <= 0.35 ? 0.85 : betFractionOfPot >= 0.75 ? 1.15 : 1.0;
      fold = Math.min(0.90, flopFold * sizeMultiplier);
      raise = flopRaise;
      call = Math.max(0.05, 1.0 - fold - raise);
      confidence = Math.min(1.0, flop.foldVsCbet.opportunities / 25);
    } else if (street === 'TURN') {
      const turnFold = getPosteriorRate(model.turnFoldVsBet);
      fold = betFractionOfPot >= 0.75 ? turnFold * 1.10 : turnFold * 0.95;
      raise = 0.10;
      call = Math.max(0.05, 1.0 - fold - raise);
      confidence = Math.min(1.0, model.turnFoldVsBet.opportunities / 20);
    } else if (street === 'RIVER') {
      if (betFractionOfPot >= 1.10) {
        // Overbet 125%+
        fold = getPosteriorRate(model.riverStats.foldVsOverbet);
        raise = 0.05;
        call = Math.max(0.02, 1.0 - fold - raise);
        confidence = Math.min(1.0, model.riverStats.foldVsOverbet.opportunities / 15);
      } else if (betFractionOfPot >= 0.70) {
        // Standard 75%
        fold = getPosteriorRate(model.riverStats.foldVsLarge);
        raise = 0.08;
        call = Math.max(0.05, 1.0 - fold - raise);
        confidence = Math.min(1.0, model.riverStats.foldVsLarge.opportunities / 20);
      } else {
        // Small 33%
        const smallPosterior = getPosteriorRate(model.riverStats.foldVsSmall);
        const largePosterior = getPosteriorRate(model.riverStats.foldVsLarge);
        // A player cannot fold MORE to a small bet than to a large bet!
        fold = model.riverStats.foldVsLarge.opportunities >= 5
          ? Math.min(smallPosterior, largePosterior * 0.90)
          : smallPosterior;
        raise = 0.12;
        call = Math.max(0.10, 1.0 - fold - raise);
        confidence = Math.min(1.0, Math.max(model.riverStats.foldVsSmall.opportunities, model.riverStats.foldVsLarge.opportunities) / 20);
      }
    }

    // Normalize
    const total = fold + call + raise;
    return {
      foldRate: fold / total,
      callRate: call / total,
      raiseRate: raise / total,
      confidence,
    };
  }
}
