export class SeededRng {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public static create(seed?: number): () => number {
    if (seed === undefined) {
      return Math.random;
    }
    const rng = new SeededRng(seed);
    return () => rng.next();
  }
}
