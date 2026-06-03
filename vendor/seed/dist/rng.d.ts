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
export declare function createRng(seed: number): () => number;
//# sourceMappingURL=rng.d.ts.map