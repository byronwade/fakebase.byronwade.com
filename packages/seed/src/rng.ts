/**
 * A tiny seeded pseudo-random number generator (mulberry32).
 *
 * The built-in data provider must not lean on `Math.random()` — determinism is
 * a guarantee of the seed engine, so all randomness flows through a seeded RNG.
 */

/**
 * Create a deterministic RNG from a numeric seed.
 *
 * @returns a function that yields floats in the half-open range [0, 1).
 */
export function createRng(seed: number): () => number {
  // Normalize the seed to a 32-bit unsigned integer.
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
