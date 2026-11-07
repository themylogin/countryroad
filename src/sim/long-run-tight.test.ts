import { describe, expect, it } from 'vitest';
import { runLong } from './invariants';
import { userSettings } from './test-support';
import { kmh } from './vehicle-types';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const TIGHTEST = userSettings({
  speed: kmh(80),
  followingTime: 1,
  overtakingSpeed: kmh(180),
  oncomingGap: 1,
  returnFollowingTime: 0.5,
  cutInGap: 0.5,
});

describe('20 simulated minutes of light traffic at the tightest user settings', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed} keeps every invariant and every overtake rule`, () => {
      const result = runLong({ seed, counts: { car: 15, semi: 3, slowTruck: 2 }, user: TIGHTEST }, 20 * 60);
      expect(result.violations).toEqual([]);
      expect(result.badReturns).toEqual([]);
      expect(result.finishes).toBeGreaterThan(10);
    }, 300_000);
  }
});
