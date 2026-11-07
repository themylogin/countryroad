import { describe, expect, it } from 'vitest';
import { followingAcceleration, nextSpeed } from './following';
import { kmh, MAX_BRAKING, VEHICLE_TYPES, type VehicleKind } from './vehicle-types';

const DT = 1 / 60;

interface Outcome {
  readonly followerSpeed: number;
  readonly gap: number;
  readonly followingTime: number;
  readonly minGap: number;
  readonly maxAcceleration: number;
  readonly minAcceleration: number;
}

function follow(
  followerKind: VehicleKind,
  leaderKind: VehicleKind,
  startGap: number,
  seconds: number,
  followerDesired = VEHICLE_TYPES[followerKind].desiredSpeed,
): Outcome {
  const follower = VEHICLE_TYPES[followerKind];
  const leader = VEHICLE_TYPES[leaderKind];
  let speed = followerDesired;
  let gap = startGap;
  let minGap = gap;
  let maxAcceleration = -Infinity;
  let minAcceleration = Infinity;
  for (let step = 0; step < seconds / DT; step += 1) {
    const acceleration = followingAcceleration(
      { ...follower, desiredSpeed: followerDesired, speed },
      { gap, speed: leader.desiredSpeed },
    );
    const updated = nextSpeed(speed, acceleration, followerDesired, DT);
    const applied = (updated - speed) / DT;
    maxAcceleration = Math.max(maxAcceleration, applied);
    minAcceleration = Math.min(minAcceleration, applied);
    speed = updated;
    gap += (leader.desiredSpeed - speed) * DT;
    minGap = Math.min(minGap, gap);
  }
  return { followerSpeed: speed, gap, followingTime: gap / speed, minGap, maxAcceleration, minAcceleration };
}

describe('following distance', () => {
  it('settles a car at 3 s behind a slow truck', () => {
    const outcome = follow('car', 'slowTruck', 400, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
  });

  it('settles a car at 3 s behind a semi', () => {
    const outcome = follow('car', 'semi', 400, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(80), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
  });

  it('settles a semi at 5 s behind a slow truck', () => {
    const outcome = follow('semi', 'slowTruck', 400, 400);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(4.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(5.1);
  });

  it('settles a slow truck at 5 s behind a slow truck that it starts close to', () => {
    const outcome = follow('slowTruck', 'slowTruck', 60, 400);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(4.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(5.1);
  });

  it('keeps a car at 3 s or more behind a car at 90 km/h', () => {
    const outcome = follow('car', 'car', 80, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(90), 1);
    expect(outcome.minGap / kmh(90)).toBeGreaterThanOrEqual(3);
  });

  it('settles the user car at 3 s behind a slow truck', () => {
    const outcome = follow('user', 'slowTruck', 1000, 300, kmh(130));
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
  });
});

describe('speed changes', () => {
  it('keeps cars within 2.0 m/s² and 8.0 m/s² braking', () => {
    for (const leader of ['car', 'semi', 'slowTruck'] as const) {
      const outcome = follow('car', leader, 300, 300);
      expect(outcome.maxAcceleration).toBeLessThanOrEqual(2 + 1e-9);
      expect(outcome.minAcceleration).toBeGreaterThanOrEqual(-MAX_BRAKING - 1e-9);
    }
  });

  it('keeps trucks within 0.8 m/s²', () => {
    const outcome = follow('semi', 'slowTruck', 300, 300);
    expect(outcome.maxAcceleration).toBeLessThanOrEqual(0.8 + 1e-9);
    expect(outcome.minAcceleration).toBeGreaterThanOrEqual(-MAX_BRAKING - 1e-9);
  });

  it('brakes the user car from 180 km/h behind a slow truck without contact', () => {
    const outcome = follow('user', 'slowTruck', 1000, 300, kmh(180));
    expect(outcome.minGap).toBeGreaterThan(40);
    expect(outcome.minAcceleration).toBeGreaterThanOrEqual(-MAX_BRAKING - 1e-9);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
  });

  it('brakes the user car from 180 km/h when a slow truck appears 300 m ahead', () => {
    const outcome = follow('user', 'slowTruck', 300, 120, kmh(180));
    expect(outcome.minGap).toBeGreaterThan(0);
    expect(outcome.minAcceleration).toBeGreaterThanOrEqual(-MAX_BRAKING - 1e-9);
  });

  it('never drives faster than the desired speed', () => {
    let speed = 0;
    for (let step = 0; step < 3600; step += 1) {
      const acceleration = followingAcceleration({ ...VEHICLE_TYPES.car, speed }, null);
      speed = nextSpeed(speed, acceleration, VEHICLE_TYPES.car.desiredSpeed, DT);
      expect(speed).toBeLessThanOrEqual(VEHICLE_TYPES.car.desiredSpeed);
    }
    expect(speed).toBeCloseTo(VEHICLE_TYPES.car.desiredSpeed, 1);
  });
});
