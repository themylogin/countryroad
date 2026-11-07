import { describe, expect, it } from 'vitest';
import { forwardDistance, relativePosition, wrap } from './road';

describe('wrap', () => {
  it('keeps positions inside the loop unchanged', () => {
    expect(wrap(0)).toBe(0);
    expect(wrap(4321.5)).toBe(4321.5);
  });

  it('wraps past the top end to the start', () => {
    expect(wrap(10_000)).toBe(0);
    expect(wrap(10_250)).toBe(250);
  });

  it('wraps below zero to the end', () => {
    expect(wrap(-1)).toBe(9_999);
    expect(wrap(-10_250)).toBe(9_750);
  });
});

describe('forwardDistance', () => {
  it('measures ahead toward the top for the user direction', () => {
    expect(forwardDistance(100, 300, 1)).toBe(200);
    expect(forwardDistance(9_900, 100, 1)).toBe(200);
  });

  it('measures ahead toward the bottom for oncoming traffic', () => {
    expect(forwardDistance(300, 100, -1)).toBe(200);
    expect(forwardDistance(100, 9_900, -1)).toBe(200);
  });

  it('treats a vehicle just behind as almost one loop ahead', () => {
    expect(forwardDistance(300, 299, 1)).toBe(9_999);
  });
});

describe('relativePosition', () => {
  it('returns the shortest signed offset on the loop', () => {
    expect(relativePosition(9_990, 10)).toBe(20);
    expect(relativePosition(10, 9_990)).toBe(-20);
    expect(relativePosition(500, 400)).toBe(-100);
  });
});
