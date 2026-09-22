import { describe, it, expect } from 'vitest';
import { Deck } from '../engine/Deck';

describe('Deck', () => {
  it('should initialize with exactly 52 cards and no duplicates', () => {
    const deck = new Deck();
    expect(deck.remaining()).toBe(52);

    const cards = deck.getCards();
    const ids = new Set(cards.map((c) => c.id));
    expect(ids.size).toBe(52);
  });

  it('should draw correctly and decrement remaining count', () => {
    const deck = new Deck();
    const card = deck.draw();
    expect(card).toBeDefined();
    expect(deck.remaining()).toBe(51);

    const three = deck.drawMany(3);
    expect(three.length).toBe(3);
    expect(deck.remaining()).toBe(48);
  });

  it('should throw error when drawing from empty deck', () => {
    const deck = new Deck();
    deck.drawMany(52);
    expect(deck.remaining()).toBe(0);
    expect(() => deck.draw()).toThrow();
  });

  it('should be deterministic when using same random seed', () => {
    const deck1 = new Deck(12345);
    deck1.shuffle();
    const cards1 = deck1.drawMany(10).map((c) => c.id);

    const deck2 = new Deck(12345);
    deck2.shuffle();
    const cards2 = deck2.drawMany(10).map((c) => c.id);

    expect(cards1).toEqual(cards2);
  });
});
