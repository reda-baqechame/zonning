/**
 * Deterministic pseudo-random generator so the demo dataset is byte-for-byte
 * reproducible across machines and reruns. Idempotent seeding depends on this:
 * the same seed always yields the same externalIds, coordinates and values.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Force into a non-zero 32-bit integer.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** Mulberry32 — small, fast, well-distributed. Returns [0, 1). */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Float in [min, max), rounded to `decimals`. */
  float(min: number, max: number, decimals = 2): number {
    const v = this.next() * (max - min) + min;
    const f = 10 ** decimals;
    return Math.round(v * f) / f;
  }

  /** Pick one element. */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** Pick `count` distinct elements (or all if count exceeds length). */
  sample<T>(arr: readonly T[], count: number): T[] {
    const copy = [...arr];
    const out: T[] = [];
    const n = Math.min(count, copy.length);
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(this.next() * copy.length);
      out.push(copy.splice(idx, 1)[0]!);
    }
    return out;
  }

  /** True with probability `p`. */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
}

/** Stable string hash → seed, so a label can deterministically seed an Rng. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
