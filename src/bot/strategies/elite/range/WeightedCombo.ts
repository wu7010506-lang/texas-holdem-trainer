import { Card } from '../../../../engine/types';

export interface WeightedCombo {
  cards: [Card, Card];
  weight: number; // 0.0 ~ 1.0
  notation?: string;
}

export class HandRange {
  public combos: WeightedCombo[];

  constructor(combos: WeightedCombo[] = []) {
    this.combos = combos;
  }

  public getTotalWeight(): number {
    return this.combos.reduce((sum, c) => sum + c.weight, 0);
  }

  public normalize(): HandRange {
    const total = this.getTotalWeight();
    if (total <= 0) return this;
    for (const c of this.combos) {
      c.weight /= total;
    }
    return this;
  }

  public filter(predicate: (c: WeightedCombo) => boolean): HandRange {
    return new HandRange(this.combos.filter(predicate));
  }

  public adjustWeight(factor: number | ((c: WeightedCombo) => number)): HandRange {
    const newCombos: WeightedCombo[] = this.combos.map((c) => {
      const mult = typeof factor === 'function' ? factor(c) : factor;
      return {
        cards: [c.cards[0], c.cards[1]],
        weight: Math.max(0, Math.min(1.0, c.weight * mult)),
        notation: c.notation,
      };
    });
    return new HandRange(newCombos.filter((c) => c.weight > 0.0001));
  }

  public removeCards(deadCards: Card[]): HandRange {
    const deadIds = new Set(deadCards.map((c) => c.id));
    return this.filter(
      (c) => !deadIds.has(c.cards[0].id) && !deadIds.has(c.cards[1].id)
    );
  }

  public removeBlockers(deadCards: Card[]): HandRange {
    return this.removeCards(deadCards);
  }

  public sampleWeighted(rng: () => number = Math.random): [Card, Card] | null {
    const total = this.getTotalWeight();
    if (total <= 0 || this.combos.length === 0) return null;

    let target = rng() * total;
    for (const combo of this.combos) {
      target -= combo.weight;
      if (target <= 0) {
        return combo.cards;
      }
    }
    return this.combos[this.combos.length - 1].cards;
  }

  public clone(): HandRange {
    return new HandRange(
      this.combos.map((c) => ({
        cards: [c.cards[0], c.cards[1]],
        weight: c.weight,
        notation: c.notation,
      }))
    );
  }
}
