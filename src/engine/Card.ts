import { Card, Rank, Suit } from './types';

export const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  'T': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14,
};

export const VALUE_TO_RANK: Record<number, Rank> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

export const SUIT_NAMES: Record<Suit, string> = {
  s: 'Spades',
  h: 'Hearts',
  d: 'Diamonds',
  c: 'Clubs',
};

export const RANK_NAMES: Record<Rank, string> = {
  '2': 'Deuce',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  'T': 'Ten',
  'J': 'Jack',
  'Q': 'Queen',
  'K': 'King',
  'A': 'Ace',
};

export function createCard(rank: Rank, suit: Suit): Card {
  return {
    rank,
    suit,
    value: RANK_VALUES[rank],
    id: `${rank}${suit}`,
  };
}

export function parseCard(cardStr: string): Card {
  const trimmed = cardStr.trim();
  if (trimmed.length < 2) {
    throw new Error(`Invalid card string: ${cardStr}`);
  }
  const rank = trimmed[0].toUpperCase() as Rank;
  const suit = trimmed[1].toLowerCase() as Suit;

  if (!RANKS.includes(rank)) {
    throw new Error(`Invalid rank: ${rank} in ${cardStr}`);
  }
  if (!SUITS.includes(suit)) {
    throw new Error(`Invalid suit: ${suit} in ${cardStr}`);
  }

  return createCard(rank, suit);
}

export function parseCards(cardsStr: string): Card[] {
  // Support space-separated or comma-separated e.g. "Ah Kd Qs" or "Ah,Kd,Qs"
  const tokens = cardsStr.split(/[\s,]+/).filter(Boolean);
  return tokens.map(parseCard);
}

export function cardToString(card: Card): string {
  return card.id;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === 'h' || suit === 'd';
}
