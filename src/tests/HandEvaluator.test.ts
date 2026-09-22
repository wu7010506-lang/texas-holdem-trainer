import { describe, it, expect } from 'vitest';
import { HandEvaluator } from '../engine/HandEvaluator';
import { parseCards } from '../engine/Card';
import { HandRank } from '../engine/types';

describe('HandEvaluator', () => {
  it('evaluates Royal Flush', () => {
    const cards = parseCards('As Ks Qs Js Ts');
    const result = HandEvaluator.evaluate(cards);
    expect(result.handRank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(result.rankName).toBe('Royal Flush');
    expect(result.score[1]).toBe(14);
  });

  it('evaluates Straight Flush', () => {
    const cards = parseCards('9h 8h 7h 6h 5h');
    const result = HandEvaluator.evaluate(cards);
    expect(result.handRank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(result.rankName).toBe('Straight Flush');
    expect(result.score[1]).toBe(9);
  });

  it('evaluates Wheel Straight Flush (5-high)', () => {
    const cards = parseCards('Ah 2h 3h 4h 5h');
    const result = HandEvaluator.evaluate(cards);
    expect(result.handRank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(result.score[1]).toBe(5);
  });

  it('evaluates Four of a Kind with kicker', () => {
    const cards = parseCards('Kh Kd Ks Kc 2d');
    const result = HandEvaluator.evaluate(cards);
    expect(result.handRank).toBe(HandRank.FOUR_OF_A_KIND);
    expect(result.score[1]).toBe(13); // King
    expect(result.score[2]).toBe(2);  // 2 kicker
  });

  it('evaluates Full House', () => {
    const cards = parseCards('Th Td Ts 7c 7s');
    const result = HandEvaluator.evaluate(cards);
    expect(result.handRank).toBe(HandRank.FULL_HOUSE);
    expect(result.score[1]).toBe(10); // Tens full of
    expect(result.score[2]).toBe(7);  // Sevens
  });

  it('evaluates Flush and distinguishes higher kickers', () => {
    const flushA = HandEvaluator.evaluate(parseCards('Ah Jh 8h 6h 2h'));
    const flushB = HandEvaluator.evaluate(parseCards('Ah Th 9h 6h 2h'));
    expect(flushA.handRank).toBe(HandRank.FLUSH);
    expect(flushB.handRank).toBe(HandRank.FLUSH);

    // flushA has Jack vs flushB Ten
    expect(HandEvaluator.compareScores(flushA.score, flushB.score)).toBeGreaterThan(0);
  });

  it('evaluates normal Straight and Wheel Straight', () => {
    const straight9 = HandEvaluator.evaluate(parseCards('9d 8c 7s 6h 5d'));
    expect(straight9.handRank).toBe(HandRank.STRAIGHT);
    expect(straight9.score[1]).toBe(9);

    const wheel = HandEvaluator.evaluate(parseCards('As 2d 3c 4h 5s'));
    expect(wheel.handRank).toBe(HandRank.STRAIGHT);
    expect(wheel.score[1]).toBe(5);

    // 6-high straight beats 5-high wheel straight
    const straight6 = HandEvaluator.evaluate(parseCards('6c 5d 4h 3s 2c'));
    expect(HandEvaluator.compareScores(straight6.score, wheel.score)).toBeGreaterThan(0);
  });

  it('evaluates Three of a Kind with 2 kickers', () => {
    const trips = HandEvaluator.evaluate(parseCards('8s 8d 8c Ah Kd'));
    expect(trips.handRank).toBe(HandRank.THREE_OF_A_KIND);
    expect(trips.score[1]).toBe(8);
    expect(trips.score[2]).toBe(14);
    expect(trips.score[3]).toBe(13);
  });

  it('evaluates Two Pair with kicker', () => {
    const twoPairA = HandEvaluator.evaluate(parseCards('Ks Kd 8s 8c Ad'));
    const twoPairB = HandEvaluator.evaluate(parseCards('Ks Kh 8d 8h Qd'));
    expect(twoPairA.handRank).toBe(HandRank.TWO_PAIR);
    expect(twoPairB.handRank).toBe(HandRank.TWO_PAIR);
    // Ace kicker beats Queen kicker
    expect(HandEvaluator.compareScores(twoPairA.score, twoPairB.score)).toBeGreaterThan(0);
  });

  it('evaluates One Pair and High Card', () => {
    const pair = HandEvaluator.evaluate(parseCards('Js Jd 9s 7c 4h'));
    expect(pair.handRank).toBe(HandRank.ONE_PAIR);

    const highCard = HandEvaluator.evaluate(parseCards('As Qd 9s 7c 4h'));
    expect(highCard.handRank).toBe(HandRank.HIGH_CARD);
  });

  it('correctly picks the best 5 cards from 7 cards (Holdem style)', () => {
    // 2 hole cards: Ah Kh, 5 community: Qh Jh Th 2c 3d -> Royal flush!
    const sevenCards = parseCards('Ah Kh Qh Jh Th 2c 3d');
    const result = HandEvaluator.evaluate(sevenCards);
    expect(result.handRank).toBe(HandRank.STRAIGHT_FLUSH);
    expect(result.rankName).toBe('Royal Flush');
    expect(result.best5.length).toBe(5);
  });

  it('identifies tie / split pot correctly', () => {
    const p1 = HandEvaluator.evaluate(parseCards('Ah Kd Qs Js Ts 2c 3d')); // Straight to Ace
    const p2 = HandEvaluator.evaluate(parseCards('Ac Kh Qd Jc Th 4c 5d')); // Same straight to Ace
    expect(HandEvaluator.compareScores(p1.score, p2.score)).toBe(0);
  });
});
