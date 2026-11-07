import { describe, expect, it } from 'vitest';
import { formatAverage, formatDistance, formatSpeed, formatTime, formatTrip } from './trip-stats';

describe('trip statistics formats', () => {
  it('formats the example values from the spec', () => {
    expect(
      formatTrip({ speed: 128.4 / 3.6, distance: 12_430, time: 872, overtakes: 3 }),
    ).toEqual({
      currentSpeed: '128 km/h',
      distance: '12.4 km',
      time: '0:14:32',
      averageSpeed: '51 km/h',
      overtakes: '3',
    });
  });

  it('shows the values of a fresh page', () => {
    expect(formatTrip({ speed: 130 / 3.6, distance: 0, time: 0, overtakes: 0 })).toEqual({
      currentSpeed: '130 km/h',
      distance: '0.0 km',
      time: '0:00:00',
      averageSpeed: '–',
      overtakes: '0',
    });
  });

  it('shows 120 km/h for 10.0 km in 5 minutes', () => {
    expect(formatAverage(10_000, 300)).toBe('120 km/h');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatTime(0)).toBe('0:00:00');
    expect(formatTime(59.99)).toBe('0:00:59');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(4 * 3600 + 5 * 60 + 9)).toBe('4:05:09');
  });

  it('rounds speeds to whole km/h and distances to 0.1 km', () => {
    expect(formatSpeed(0)).toBe('0 km/h');
    expect(formatSpeed(25)).toBe('90 km/h');
    expect(formatDistance(49)).toBe('0.0 km');
    expect(formatDistance(1_250)).toBe('1.3 km');
  });
});
