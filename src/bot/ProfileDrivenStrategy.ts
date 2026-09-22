import { BotDecision, BotDecisionContext, BotProfile, IBotStrategy } from './types';
import { PreflopRanges } from './PreflopRanges';

export class ProfileDrivenStrategy implements IBotStrategy {
  public name = 'ProfileDrivenStrategy';

  public decideAction(
    context: BotDecisionContext,
    profile: BotProfile,
    rng: () => number = Math.random
  ): BotDecision {
    const { legalActions } = context;

    if (context.street === 'PREFLOP') {
      return this.decidePreflop(context, profile, rng);
    } else {
      return this.decidePostflop(context, profile, rng);
    }
  }

  private decidePreflop(
    context: BotDecisionContext,
    profile: BotProfile,
    rng: () => number
  ): BotDecision {
    const { holeCards, legalActions, currentBet, bigBlind, position } = context;
    const notation = holeCards.length === 2 ? PreflopRanges.getHandNotation(holeCards[0], holeCards[1]) : '';
    const rawPower = PreflopRanges.getHandPower(notation);

    // Profile adjusted power: VPIP shifts how loose the bot plays
    const power = rawPower + (profile.vpip - 0.25) * 0.4;
    const baseOpenThreshold = PreflopRanges.getPositionOpenThreshold(position);
    // PFR shifts open raise frequency
    const openThreshold = Math.max(0.2, baseOpenThreshold - (profile.pfr - 0.18) * 0.5);

    const isFacingRaise = currentBet > bigBlind;
    const roll = rng();

    let foldScore = 0;
    let callScore = 0;
    let raiseScore = 0;

    // Sizing: default open 2.5x to 3.0x BB
    const openSize = Math.max(legalActions.minRaise, Math.round(bigBlind * 2.5));

    if (!isFacingRaise) {
      // Unopened / limped pot
      if (power >= openThreshold) {
        raiseScore = 0.85;
        callScore = 0.15;
      } else if (power >= openThreshold - 0.15) {
        if (legalActions.canCheck) {
          callScore = 0.95; // Free check from BB
        } else {
          callScore = profile.vpip > 0.35 ? 0.6 : 0.2;
          foldScore = 1.0 - callScore;
        }
      } else {
        if (legalActions.canCheck) {
          callScore = 1.0; // Always check if free
        } else {
          foldScore = 0.95;
          raiseScore = roll < profile.bluffFrequency ? 0.05 : 0;
        }
      }
    } else {
      // Facing a raise or 3-bet
      if (power >= 0.88) {
        // Monster (AA, KK, QQ, AKs) -> 3-bet or 4-bet
        raiseScore = 0.85;
        callScore = 0.15;
      } else if (power >= 0.70) {
        // Strong playable
        if (roll < profile.threeBetFrequency * 2) {
          raiseScore = 0.60;
          callScore = 0.40;
        } else {
          callScore = 0.80;
          foldScore = 0.20;
        }
      } else if (power >= 0.50 && profile.vpip > 0.30) {
        // Speculative calling hands (suited connectors, pocket pairs)
        callScore = 0.65;
        foldScore = 0.35;
      } else {
        // Facing raise with weak hand
        foldScore = 0.90;
        if (roll < profile.bluffFrequency * 0.5 && legalActions.canRaise) {
          raiseScore = 0.10;
        }
      }

      // Respect foldToThreeBet
      if (currentBet >= bigBlind * 6) {
        foldScore = Math.min(0.95, foldScore * (1 + profile.foldToThreeBet * 0.5));
      }
    }

    // Normalize scores
    const totalScore = foldScore + callScore + raiseScore;
    foldScore /= totalScore;
    callScore /= totalScore;
    raiseScore /= totalScore;

    // Pick action
    if (roll < foldScore) {
      if (legalActions.canCheck) {
        return {
          action: 'CHECK',
          reasoning: `Preflop ${notation} (power: ${(power * 100).toFixed(0)}%). Free to check.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return {
        action: 'FOLD',
        reasoning: `Preflop ${notation} (power: ${(power * 100).toFixed(0)}%). Below playable threshold for ${profile.name}.`,
        debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
      };
    } else if (roll < foldScore + callScore) {
      if (legalActions.canCheck) {
        return {
          action: 'CHECK',
          reasoning: `Preflop ${notation}. Checking option in position.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return {
        action: 'CALL',
        amount: legalActions.callAmount,
        reasoning: `Preflop ${notation}. Calling ${legalActions.callAmount} within VPIP range.`,
        debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
      };
    } else {
      if (legalActions.canRaise) {
        const raiseAmount = Math.min(
          legalActions.maxRaise,
          Math.max(legalActions.minRaise, isFacingRaise ? currentBet * 3 : openSize)
        );
        return {
          action: 'RAISE',
          amount: raiseAmount,
          reasoning: `Preflop ${notation} (power: ${(power * 100).toFixed(0)}%). ${profile.name} opening/3-betting to ${raiseAmount}.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      if (legalActions.canCall) {
        return {
          action: 'CALL',
          amount: legalActions.callAmount,
          reasoning: `Preflop ${notation}. Strong hand, calling bet.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return { action: 'CHECK', reasoning: 'Checking default.' };
    }
  }

  private decidePostflop(
    context: BotDecisionContext,
    profile: BotProfile,
    rng: () => number
  ): BotDecision {
    const {
      handStrength,
      boardTexture,
      potOdds,
      potSize,
      legalActions,
      currentBet,
      street,
      spr,
    } = context;

    const roll = rng();
    const isFacingBet = currentBet > 0;
    const equity = handStrength.estimatedEquity;

    let foldScore = 0;
    let callScore = 0;
    let raiseScore = 0;

    // Helper for bet sizing
    const pickSizing = (): number => {
      let fraction = profile.betSizing.medium;
      if (boardTexture.wetnessScore > 0.65 || handStrength.category === 'QUADS_OR_BETTER') {
        fraction = profile.betSizing.large;
      } else if (boardTexture.wetnessScore < 0.35) {
        fraction = profile.betSizing.small;
      }
      if (spr < 2.0 && equity > 0.75) {
        fraction = profile.betSizing.overbet;
      }
      const rawAmt = Math.round(potSize * fraction);
      return Math.min(legalActions.maxBet || legalActions.maxRaise, Math.max(legalActions.minBet || legalActions.minRaise, rawAmt));
    };

    if (!isFacingBet) {
      // Unopened postflop street (Can Check or Bet)
      if (equity >= 0.75) {
        // Monster/Very Strong hand: value bet or check-raise trap
        if (roll < profile.aggression) {
          raiseScore = 0.85;
          callScore = 0.15;
        } else {
          callScore = 0.75; // Slow play check
          raiseScore = 0.25;
        }
      } else if (equity >= 0.55) {
        // Top Pair / Good Made Hand
        if (roll < profile.continuationBet) {
          raiseScore = 0.70;
          callScore = 0.30;
        } else {
          callScore = 0.80;
        }
      } else if (handStrength.hasFlushDraw || handStrength.hasOESD) {
        // Strong Draw -> Semi-bluff
        if (roll < profile.bluffFrequency + 0.3) {
          raiseScore = 0.65;
          callScore = 0.35;
        } else {
          callScore = 0.90;
        }
      } else {
        // Air / Weak Pair
        if (roll < profile.bluffFrequency && boardTexture.wetnessScore < 0.4) {
          raiseScore = 0.40;
          callScore = 0.60;
        } else {
          callScore = 1.0; // Free check
        }
      }
    } else {
      // Facing a bet (Can Fold, Call, Raise)
      const potOddsFraction = potOdds; // e.g. 0.25

      if (equity >= 0.80) {
        // Monster hand facing bet -> Raise or Call
        if (roll < profile.aggression) {
          raiseScore = 0.75;
          callScore = 0.25;
        } else {
          callScore = 0.85;
        }
      } else if (equity >= 0.60) {
        // Good made hand (Top pair)
        if (equity > potOddsFraction + 0.2) {
          callScore = 0.75;
          raiseScore = profile.aggression > 0.6 ? 0.20 : 0.05;
          foldScore = 0.05;
        } else {
          callScore = 0.60;
          foldScore = 0.40;
        }
      } else if (handStrength.hasFlushDraw || handStrength.hasOESD) {
        // Drawing hand
        if (equity >= potOddsFraction) {
          // Mathematically profitable call
          callScore = 0.80;
          raiseScore = roll < profile.checkRaiseFrequency * 2 ? 0.20 : 0;
        } else if (equity >= potOddsFraction - 0.08 && profile.aggression > 0.6) {
          // Implied odds call/semi-bluff
          callScore = 0.60;
          foldScore = 0.40;
        } else {
          foldScore = 0.75;
          callScore = 0.25;
        }
      } else if (equity >= 0.35) {
        // Marginal pair / weak showdown value
        if (potOddsFraction < 0.20 || profile.id === 'calling_station') {
          callScore = 0.70;
          foldScore = 0.30;
        } else {
          foldScore = 0.70;
          callScore = 0.30;
        }
      } else {
        // Trash / Air
        if (street === 'RIVER' && roll < profile.riverBluffFrequency && legalActions.canRaise) {
          raiseScore = 0.25;
          foldScore = 0.75;
        } else {
          foldScore = 0.95;
          callScore = legalActions.canCheck ? 1.0 : 0.05;
        }
      }
    }

    const total = foldScore + callScore + raiseScore;
    foldScore /= total;
    callScore /= total;
    raiseScore /= total;

    if (roll < foldScore) {
      if (legalActions.canCheck) {
        return {
          action: 'CHECK',
          reasoning: `${street} ${handStrength.description}. Checking with marginal hand.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return {
        action: 'FOLD',
        reasoning: `${street} ${handStrength.description}. Equity ${(equity * 100).toFixed(0)}% insufficient vs pot odds ${(potOdds * 100).toFixed(1)}%.`,
        debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
      };
    } else if (roll < foldScore + callScore) {
      if (legalActions.canCheck) {
        return {
          action: 'CHECK',
          reasoning: `${street} ${handStrength.description}. Checking to see next street.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return {
        action: 'CALL',
        amount: legalActions.callAmount,
        reasoning: `${street} ${handStrength.description}. Pot odds ${(potOdds * 100).toFixed(1)}% acceptable for call.`,
        debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
      };
    } else {
      const betAmt = pickSizing();
      if (legalActions.canBet) {
        return {
          action: 'BET',
          amount: betAmt,
          reasoning: `${street} ${handStrength.description}. ${profile.name} betting ${betAmt} (${Math.round((betAmt / (potSize || 1)) * 100)}% pot).`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      if (legalActions.canRaise) {
        const raiseAmt = Math.min(legalActions.maxRaise, Math.max(legalActions.minRaise, betAmt));
        return {
          action: 'RAISE',
          amount: raiseAmt,
          reasoning: `${street} ${handStrength.description}. Raising to ${raiseAmt} with aggression factor ${profile.aggression}.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      if (legalActions.canCall) {
        return {
          action: 'CALL',
          amount: legalActions.callAmount,
          reasoning: `${street} ${handStrength.description}. Calling outstanding bet.`,
          debugScores: { foldScore, callScore, raiseScore, randomRoll: roll },
        };
      }
      return { action: 'CHECK', reasoning: 'Checking fallback.' };
    }
  }
}
