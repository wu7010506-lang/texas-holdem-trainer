import { GameConfig, GameState, HandEvaluation, PlayerAction, PlayerState } from './types';
import { Deck } from './Deck';
import { ActionValidator } from './ActionValidator';
import { PotManager } from './PotManager';
import { TurnManager } from './TurnManager';
import { HandEvaluator } from './HandEvaluator';

export class PokerGame {
  private state: GameState;
  private deck: Deck;
  private config: GameConfig;

  constructor(config: GameConfig, initialPlayers?: PlayerState[]) {
    this.config = { ...config };
    this.deck = new Deck(this.config.randomSeed);

    const players: PlayerState[] =
      initialPlayers ||
      Array.from({ length: this.config.playerCount }, (_, i) => ({
        id: `p${i}`,
        name: i === this.config.heroSeat ? 'Hero' : `Bot ${i}`,
        seat: i,
        isHuman: i === this.config.heroSeat,
        stack: this.config.startingStack,
        holeCards: [],
        currentBet: 0,
        totalBetThisHand: 0,
        folded: false,
        allIn: false,
        acted: false,
        position: '',
      }));

    this.state = {
      bigBlind: this.config.bigBlind,
      handId: 0,
      street: 'PREFLOP',
      dealerSeat: 0,
      smallBlindSeat: 1,
      bigBlindSeat: 2,
      currentPlayerSeat: 0,
      communityCards: [],
      pot: 0,
      sidePots: [],
      currentBet: 0,
      minimumRaise: this.config.bigBlind * 2,
      lastRaiseAmount: this.config.bigBlind,
      players,
      actionHistory: [],
      handComplete: true,
      isHeadsUp: this.config.playerCount === 2,
    };
  }

  public getState(): GameState {
    // Return deep/defensive copy
    return JSON.parse(JSON.stringify(this.state));
  }

  public getConfig(): GameConfig {
    return { ...this.config };
  }

  public setConfig(config: Partial<GameConfig>): void {
    this.config = { ...this.config, ...config };
    this.state.bigBlind = this.config.bigBlind;
  }

  /** Rebuy is an engine mutation, never a mutation of the defensive UI snapshot. */
  public rebuyPlayer(seat: number): GameState {
    const player = this.state.players[seat];
    if (!this.state.handComplete || !player || player.stack > 0) return this.getState();
    player.stack = this.config.startingStack;
    return this.getState();
  }

  /**
   * Starts a brand new hand.
   * Handles button rotation, rebuy of depleted bot stacks if enabled,
   * deck reshuffle, blind posting, card dealing, and first-to-act determination.
   */
  public startNewHand(): GameState {
    this.state.handId += 1;
    this.state.street = 'PREFLOP';
    this.state.communityCards = [];
    this.state.actionHistory = [];
    this.state.winners = undefined;
    this.state.handComplete = false;

    // Filter players with stack > 0, or auto-rebuy if enabled
    this.state.players.forEach((p) => {
      if (p.stack <= 0 && (!p.isHuman || this.config.autoNextHand)) {
        p.stack = this.config.startingStack;
      }
    });

    const activePlayers = this.state.players.filter((p) => p.stack > 0);
    if (activePlayers.length < 2) {
      throw new Error('Not enough players with chips to start a hand.');
    }

    const n = this.state.players.length;
    this.state.isHeadsUp = activePlayers.length === 2;

    // Advance dealer button (clockwise to next seated player with chips)
    if (this.state.handId > 1) {
      let nextDealer = (this.state.dealerSeat + 1) % n;
      while (this.state.players[nextDealer].stack <= 0) {
        nextDealer = (nextDealer + 1) % n;
      }
      this.state.dealerSeat = nextDealer;
    }

    // Determine SB and BB seats
    if (this.state.isHeadsUp) {
      this.state.smallBlindSeat = this.state.dealerSeat;
      this.state.bigBlindSeat = (this.state.dealerSeat + 1) % n;
    } else {
      let sb = (this.state.dealerSeat + 1) % n;
      while (this.state.players[sb].stack <= 0) sb = (sb + 1) % n;
      let bb = (sb + 1) % n;
      while (this.state.players[bb].stack <= 0) bb = (bb + 1) % n;

      this.state.smallBlindSeat = sb;
      this.state.bigBlindSeat = bb;
    }

    // Assign position names
    TurnManager.assignPositions(this.state.players, this.state.dealerSeat);

    // Reset player per-hand state
    this.state.players.forEach((p) => {
      p.holeCards = [];
      p.currentBet = 0;
      p.totalBetThisHand = 0;
      p.folded = p.stack <= 0;
      p.allIn = false;
      p.acted = false;
      p.raiseReopenAt = undefined;
      p.lastAction = undefined;
    });

    // Reset and shuffle deck
    this.deck.reset();
    this.deck.shuffle();

    // Deal 2 hole cards to each active player
    for (let round = 0; round < 2; round++) {
      for (const p of this.state.players) {
        if (!p.folded) {
          p.holeCards.push(this.deck.draw());
        }
      }
    }

    // Post Small Blind
    const sbPlayer = this.state.players[this.state.smallBlindSeat];
    const sbAmount = Math.min(sbPlayer.stack, this.config.smallBlind);
    sbPlayer.stack -= sbAmount;
    sbPlayer.currentBet = sbAmount;
    sbPlayer.totalBetThisHand = sbAmount;
    if (sbPlayer.stack === 0) sbPlayer.allIn = true;
    this.recordAction(sbPlayer, 'BET', sbAmount, 'Small Blind');

    // Post Big Blind
    const bbPlayer = this.state.players[this.state.bigBlindSeat];
    const bbAmount = Math.min(bbPlayer.stack, this.config.bigBlind);
    bbPlayer.stack -= bbAmount;
    bbPlayer.currentBet = bbAmount;
    bbPlayer.totalBetThisHand = bbAmount;
    if (bbPlayer.stack === 0) bbPlayer.allIn = true;
    this.recordAction(bbPlayer, 'BET', bbAmount, 'Big Blind');

    this.state.currentBet = this.config.bigBlind;
    this.state.lastRaiseAmount = this.config.bigBlind;
    this.state.minimumRaise = this.config.bigBlind * 2;

    this.updatePots();

    // Set first player to act Preflop
    this.state.currentPlayerSeat = TurnManager.getFirstToAct(
      this.state.players,
      'PREFLOP',
      this.state.dealerSeat,
      this.state.isHeadsUp
    );

    this.updateLegalActions();
    return this.getState();
  }

  /**
   * Applies an action for the current player.
   */
  public applyAction(action: PlayerAction): GameState {
    if (this.state.handComplete) {
      throw new Error('Hand is already complete. Start a new hand.');
    }

    const player = this.state.players[this.state.currentPlayerSeat];
    if (!player || player.folded || player.allIn) {
      throw new Error(`Player at seat ${this.state.currentPlayerSeat} cannot act.`);
    }

    // Validate action
    const validation = ActionValidator.validate(
      player,
      action,
      this.state.currentBet,
      this.state.lastRaiseAmount,
      this.config.bigBlind
    );

    if (!validation.valid || !validation.normalizedAction) {
      throw new Error(`Illegal action: ${validation.reason}`);
    }

    const normAction = validation.normalizedAction;
    normAction.reasoning = action.reasoning;

    // Execute action
    switch (normAction.type) {
      case 'FOLD':
        player.folded = true;
        player.acted = true;
        player.lastAction = normAction;
        this.recordAction(player, 'FOLD', 0, action.reasoning);
        break;

      case 'CHECK':
        player.acted = true;
        player.lastAction = normAction;
        this.recordAction(player, 'CHECK', 0, action.reasoning);
        break;

      case 'CALL': {
        const callNeeded = this.state.currentBet - player.currentBet;
        const actualCall = Math.min(player.stack, callNeeded);
        player.stack -= actualCall;
        player.currentBet += actualCall;
        player.totalBetThisHand += actualCall;
        player.acted = true;
        player.lastAction = normAction;
        if (player.stack === 0) player.allIn = true;
        this.recordAction(player, 'CALL', actualCall, action.reasoning);
        break;
      }

      case 'BET': {
        const betAmount = normAction.amount!;
        player.stack -= betAmount;
        player.currentBet = betAmount;
        player.totalBetThisHand += betAmount;
        player.acted = true;
        player.lastAction = normAction;
        if (player.stack === 0) player.allIn = true;

        this.state.currentBet = betAmount;
        this.state.lastRaiseAmount = betAmount;
        this.state.minimumRaise = betAmount * 2;
        this.resetOtherPlayersActed(player.seat);
        this.recordAction(player, 'BET', betAmount, action.reasoning);
        break;
      }

      case 'RAISE': {
        const targetTotal = normAction.amount!;
        const additionalChips = targetTotal - player.currentBet;
        player.stack -= additionalChips;
        player.totalBetThisHand += additionalChips;
        const raiseIncrement = targetTotal - this.state.currentBet;
        player.currentBet = targetTotal;
        player.acted = true;
        player.lastAction = normAction;
        if (player.stack === 0) player.allIn = true;

        this.state.lastRaiseAmount = raiseIncrement;
        this.state.currentBet = targetTotal;
        this.state.minimumRaise = targetTotal + raiseIncrement;
        this.resetOtherPlayersActed(player.seat);
        this.recordAction(player, 'RAISE', targetTotal, action.reasoning, additionalChips);
        break;
      }

      case 'ALL_IN': {
        const allInTotal = player.currentBet + player.stack;
        const additionalChips = player.stack;
        player.stack = 0;
        player.totalBetThisHand += additionalChips;
        player.allIn = true;
        player.acted = true;
        player.lastAction = normAction;

        if (allInTotal > this.state.currentBet) {
          const raiseDiff = allInTotal - this.state.currentBet;
          if (raiseDiff >= this.state.lastRaiseAmount) {
            this.state.lastRaiseAmount = raiseDiff;
            this.state.minimumRaise = allInTotal + raiseDiff;
            this.resetOtherPlayersActed(player.seat);
          }
          this.state.currentBet = allInTotal;
          this.state.minimumRaise = allInTotal + Math.max(this.config.bigBlind, this.state.lastRaiseAmount);
        }

        player.currentBet = allInTotal;
        this.recordAction(player, 'ALL_IN', allInTotal, action.reasoning, additionalChips);
        break;
      }
    }

    player.raiseReopenAt = this.state.currentBet + Math.max(this.config.bigBlind, this.state.lastRaiseAmount);
    this.updatePots();

    // Check if betting round or hand is complete
    this.advanceGame();

    return this.getState();
  }

  private advanceGame(): void {
    const nonFolded = this.state.players.filter((p) => !p.folded);

    // Case 1: Everyone folded except 1 player -> Hand complete
    if (nonFolded.length <= 1) {
      this.concludeHand();
      return;
    }

    // Case 2: Round complete
    if (TurnManager.isRoundComplete(this.state.players, this.state.currentBet)) {
      this.advanceStreet();
    } else {
      // Advance to next active player
      const nextSeat = TurnManager.getNextToAct(this.state.players, this.state.currentPlayerSeat);
      if (nextSeat === -1) {
        // No one else can act (e.g. all in) -> advance street
        this.advanceStreet();
      } else {
        this.state.currentPlayerSeat = nextSeat;
        this.updateLegalActions();
      }
    }
  }

  private advanceStreet(): void {
    const nonFolded = this.state.players.filter((p) => !p.folded);
    const activeWithChips = nonFolded.filter((p) => !p.allIn);

    // Reset bets for next street
    this.state.players.forEach((p) => {
      p.currentBet = 0;
      p.acted = false;
      p.raiseReopenAt = undefined;
      p.lastAction = undefined;
    });
    this.state.currentBet = 0;
    this.state.lastRaiseAmount = this.config.bigBlind;
    this.state.minimumRaise = this.config.bigBlind;

    // If 0 or 1 player has chips left (all others all-in), run out board automatically
    if (activeWithChips.length <= 1) {
      this.runOutBoard();
      this.concludeHand();
      return;
    }

    // Normal street progression
    switch (this.state.street) {
      case 'PREFLOP':
        // Deal Flop (3 cards)
        this.state.street = 'FLOP';
        this.state.communityCards.push(...this.deck.drawMany(3));
        break;

      case 'FLOP':
        // Deal Turn (1 card)
        this.state.street = 'TURN';
        this.state.communityCards.push(this.deck.draw());
        break;

      case 'TURN':
        // Deal River (1 card)
        this.state.street = 'RIVER';
        this.state.communityCards.push(this.deck.draw());
        break;

      case 'RIVER':
        // Showdown!
        this.concludeHand();
        return;
    }

    // Set first to act for new postflop street
    this.state.currentPlayerSeat = TurnManager.getFirstToAct(
      this.state.players,
      this.state.street,
      this.state.dealerSeat,
      this.state.isHeadsUp
    );

    this.updateLegalActions();
  }

  private runOutBoard(): void {
    while (this.state.communityCards.length < 5) {
      this.state.communityCards.push(this.deck.draw());
    }
    this.state.street = 'SHOWDOWN';
  }

  private concludeHand(): void {
    this.state.street = 'SHOWDOWN';
    this.state.handComplete = true;

    const nonFolded = this.state.players.filter((p) => !p.folded);
    const evaluations = new Map<string, HandEvaluation>();

    // If multiple players reach showdown, evaluate everyone's best 5
    if (nonFolded.length > 1) {
      for (const p of nonFolded) {
        const allCards = [...p.holeCards, ...this.state.communityCards];
        evaluations.set(p.id, HandEvaluator.evaluate(allCards));
      }
    }

    // Award pots
    const winners = PotManager.resolveShowdown(
      this.state.sidePots,
      this.state.players,
      evaluations,
      this.state.dealerSeat
    );

    this.state.winners = winners;

    // Distribute winnings back to players' stacks
    winners.forEach((w) => {
      const winnerPlayer = this.state.players.find((p) => p.id === w.playerId);
      if (winnerPlayer) {
        winnerPlayer.stack += w.amount;
      }
    });

    this.state.legalActions = undefined;
  }

  private resetOtherPlayersActed(actingSeat: number): void {
    this.state.players.forEach((p) => {
      if (p.seat !== actingSeat && !p.folded && !p.allIn) {
        p.acted = false;
      }
    });
  }

  private updatePots(): void {
    this.state.sidePots = PotManager.calculatePots(this.state.players);
    this.state.pot = this.state.sidePots.reduce((sum, p) => sum + p.amount, 0);
  }

  private updateLegalActions(): void {
    const current = this.state.players[this.state.currentPlayerSeat];
    if (current && !current.folded && !current.allIn) {
      this.state.legalActions = ActionValidator.getLegalActions(
        current,
        this.state.currentBet,
        this.state.lastRaiseAmount,
        this.config.bigBlind
      );
    } else {
      this.state.legalActions = undefined;
    }
  }

  private recordAction(
    player: PlayerState,
    action: any,
    amount: number,
    reasoning?: string,
    chipsMoved: number = amount
  ): void {
    const pot = this.state.players.reduce((sum, p) => sum + p.totalBetThisHand, 0);
    this.state.actionHistory.push({
      handId: this.state.handId,
      street: this.state.street,
      seat: player.seat,
      playerId: player.id,
      playerName: player.name,
      action,
      amount,
      position: player.position,
      potBefore: pot - chipsMoved,

      potAfter: pot,
      stackBefore: player.stack + chipsMoved,
      stackAfter: player.stack,
      reasoning,
      timestamp: Date.now(),
    });
  }
}
