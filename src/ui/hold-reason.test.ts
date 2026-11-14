import { describe, expect, it } from 'vitest';
import { kmh } from '../sim/vehicle-types';
import { holdText } from './hold-reason';

describe('holdText', () => {
  it('writes each of the eight reasons', () => {
    expect(holdText({ reason: 'oncoming', gap: 800.4, need: 1119.2 })).toBe('Oncoming 800 m away, need 1120 m');
    expect(holdText({ reason: 'laneBusy' })).toBe('Another vehicle is overtaking.');
    expect(holdText({ reason: 'queueTooLong' })).toBe('The queue ahead has more than 12 vehicles.');
    expect(holdText({ reason: 'noGap', gap: 125 / 25, need: 137 / 25 })).toBe('No gap to return into: 5.0 s between the cars, 5.5 s needed.');
    expect(holdText({ reason: 'tooClose', gap: 12.6, need: 17.2 })).toBe(
      'Too close to the vehicle ahead to pull out: 12 m gap, 18 m needed.',
    );
    expect(holdText({ reason: 'tooLong', speed: kmh(85) })).toBe('The overtake takes more than 90 s at 85 km/h.');
    expect(holdText({ reason: 'canReachSpeed' })).toBe('The vehicle ahead can reach your overtaking speed.');
    expect(holdText({ reason: 'notSlower' })).toBe('The vehicle ahead is not slower than My speed.');
  });

  it('rounds gaps down and needs up', () => {
    expect(holdText({ reason: 'noGap', gap: 1.98, need: 2.01 })).toBe('No gap to return into: 1.9 s between the cars, 2.1 s needed.');
    expect(holdText({ reason: 'noGap', gap: 0.5, need: 3.32 })).toBe('No gap to return into: 0.5 s between the cars, 3.4 s needed.');
    expect(holdText({ reason: 'oncoming', gap: 600, need: 1000 })).toBe('Oncoming 600 m away, need 1000 m');
  });

  it('shows 0 m away for an oncoming vehicle alongside', () => {
    expect(holdText({ reason: 'oncoming', gap: 0, need: 950.3 })).toBe('Oncoming 0 m away, need 951 m');
  });

  it('keeps exact values with float error on their step', () => {
    expect(holdText({ reason: 'noGap', gap: 1.9999999999, need: 2.0000000001 })).toBe(
      'No gap to return into: 2.0 s between the cars, 2.0 s needed.',
    );
    expect(holdText({ reason: 'noGap', gap: (2 * 36.1) / 36.1 - 1, need: (2 * 36.1) / 36.1 })).toBe(
      'No gap to return into: 1.0 s between the cars, 2.0 s needed.',
    );
    expect(holdText({ reason: 'tooClose', gap: 17.9999999999, need: 18.0000000001 })).toBe(
      'Too close to the vehicle ahead to pull out: 18 m gap, 18 m needed.',
    );
  });

  it('caps seconds at 99.9 s for a very slow car to pass', () => {
    expect(holdText({ reason: 'noGap', gap: 1250, need: 1400 })).toBe('No gap to return into: 99.9 s between the cars, 99.9 s needed.');
    expect(holdText({ reason: 'noGap', gap: 42.04, need: 120 })).toBe('No gap to return into: 42.0 s between the cars, 99.9 s needed.');
  });
});
