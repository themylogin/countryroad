import { describe, expect, it } from 'vitest';
import { runLong } from './invariants';
import { kmh } from './vehicle-types';
import { userSettings } from './test-support';

const SEEDS = [1, 2, 3, 4, 5];

describe('20 simulated minutes at default settings', () => {
  for (const seed of SEEDS) {
    it(`seed ${seed} keeps every invariant and every overtake rule`, () => {
      const result = runLong({ seed, counts: { car: 15, semi: 3, slowTruck: 2 }, user: userSettings({ speed: kmh(130), oncomingGap: 6 }) }, 20 * 60);
      expect(result.violations).toEqual([]);
      expect(result.badReturns).toEqual([]);
      expect(result.finishes).toBeGreaterThan(0);
    }, 300_000);
  }
});
