import { Card, Street } from '../engine/types';
import { HandHistoryRecord } from './HandHistory';

export interface ReplayFrame {
  actionIndex: number;
  totalActions: number;
  street: Street;
  communityCards: Card[];
  currentPot: number;
  lastActionDescription: string;
  activeSeat: number;
  playerBets: Record<string, number>;
  playerStacks: Record<string, number>;
  playerFolded: Record<string, boolean>;
}

export class HandReplayer {
  private record: HandHistoryRecord;
  private currentStep: number = 0;
  private frames: ReplayFrame[] = [];

  constructor(record: HandHistoryRecord) {
    this.record = record;
    this.buildFrames();
  }

  private buildFrames(): void {
    const stacks: Record<string, number> = { ...this.record.initialStacks };
    const bets: Record<string, number> = {};
    const folded: Record<string, boolean> = {};

    this.record.players.forEach((p) => {
      bets[p.id] = 0;
      folded[p.id] = false;
    });

    let currentPot = 0;
    const commCards: Card[] = [];

    // Frame 0: Initial deal
    this.frames.push({
      actionIndex: 0,
      totalActions: this.record.actions.length,
      street: 'PREFLOP',
      communityCards: [],
      currentPot: 0,
      lastActionDescription: 'Cards dealt',
      activeSeat: -1,
      playerBets: { ...bets },
      playerStacks: { ...stacks },
      playerFolded: { ...folded },
    });

    // Step through each recorded action
    this.record.actions.forEach((act, idx) => {
      // Update street community cards
      if (act.street === 'FLOP' && commCards.length < 3 && this.record.communityCards.length >= 3) {
        commCards.length = 0;
        commCards.push(...this.record.communityCards.slice(0, 3));
      } else if (act.street === 'TURN' && commCards.length < 4 && this.record.communityCards.length >= 4) {
        commCards.length = 0;
        commCards.push(...this.record.communityCards.slice(0, 4));
      } else if (act.street === 'RIVER' && commCards.length < 5 && this.record.communityCards.length >= 5) {
        commCards.length = 0;
        commCards.push(...this.record.communityCards.slice(0, 5));
      }

      if (act.action === 'FOLD') {
        folded[act.playerId] = true;
      } else {
        const added = act.amount;
        if (stacks[act.playerId] !== undefined) {
          stacks[act.playerId] -= added;
        }
        bets[act.playerId] = (bets[act.playerId] || 0) + added;
        currentPot += added;
      }

      this.frames.push({
        actionIndex: idx + 1,
        totalActions: this.record.actions.length,
        street: act.street,
        communityCards: [...commCards],
        currentPot: act.potAfter || currentPot,
        lastActionDescription: `${act.playerName}: ${act.action} ${act.amount > 0 ? act.amount : ''} ${act.reasoning ? '(' + act.reasoning + ')' : ''}`,
        activeSeat: act.seat,
        playerBets: { ...bets },
        playerStacks: { ...stacks },
        playerFolded: { ...folded },
      });
    });
  }

  public getFrame(index: number): ReplayFrame {
    const clamped = Math.max(0, Math.min(this.frames.length - 1, index));
    this.currentStep = clamped;
    return this.frames[clamped];
  }

  public next(): ReplayFrame {
    return this.getFrame(this.currentStep + 1);
  }

  public prev(): ReplayFrame {
    return this.getFrame(this.currentStep - 1);
  }

  public reset(): ReplayFrame {
    return this.getFrame(0);
  }

  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getTotalSteps(): number {
    return this.frames.length - 1;
  }
}
