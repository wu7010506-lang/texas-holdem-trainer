import { Card } from './types';
import { createCard, RANKS, SUITS } from './Card';

export class Deck {
  private cards: Card[] = [];
  private rng: () => number;

  constructor(seed?: number) {
    this.rng = seed !== undefined ? this.createPrng(seed) : Math.random;
    this.reset();
  }

  /**
   * Simple Mulberry32 pseudo-random number generator for seeded reproducibility
   */
  private createPrng(seed: number): () => number {
    let s = Math.floor(seed);
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  public reset(): void {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(createCard(rank, suit));
      }
    }
  }

  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  public draw(): Card {
    if (this.cards.length === 0) {
      throw new Error('Deck is empty! Cannot draw more cards.');
    }
    return this.cards.pop()!;
  }

  public drawMany(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      drawn.push(this.draw());
    }
    return drawn;
  }

  public remaining(): number {
    return this.cards.length;
  }

  public getCards(): Card[] {
    return [...this.cards];
  }

  public static createStandardDeck(): Deck {
    return new Deck();
  }
}

