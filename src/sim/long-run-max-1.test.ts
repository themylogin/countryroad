import { describe, expect, it } from 'vitest';
import { runLong } from './invariants';
import { kmh } from './vehicle-types';

const SEEDS = [1, 2, 3, 4, 5];

describe('20 simulated minutes at maximum counts, user at 180 km/h with a 1.0 s gap', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed} keeps every invariant and every overtake rule`, () => {
      const result = runLong({ seed, counts: { car: 100, semi: 20, slowTruck: 10 }, userSpeed: kmh(180), userGap: 1 }, 20 * 60);
      expect(result.violations).toEqual([]);
      expect(result.badReturns).toEqual([]);
    }, 300_000);
  }
});
