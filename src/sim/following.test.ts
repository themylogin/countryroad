import { describe, expect, it } from 'vitest';
import { followingAcceleration, nextRecovering, nextSpeed, recoveryAcceleration } from './following';
import { kmh, MAX_BRAKING, VEHICLE_TYPES, type VehicleKind } from './vehicle-types';

const DT = 1 / 60;

interface Scene {
  readonly followerKind: VehicleKind;
  readonly leaderSpeed: number;
  readonly startGap: number;
  readonly seconds: number;
  readonly startSpeed?: number;
  readonly followerDesired?: number;
  readonly followingTime?: number;
  readonly laterFollowingTime?: { readonly at: number; readonly value: number };
}

interface Outcome {
  readonly followerSpeed: number;
  readonly gap: number;
  readonly followingTime: number;
  readonly minGap: number;
  readonly maxAcceleration: number;
  readonly minAcceleration: number;
  readonly everRecovering: boolean;
  readonly lowestRecoverySpeed: number;
  readonly highestRecoverySpeed: number;
  readonly recoveryEnd: number | null;
  readonly timeGapAtRecoveryEnd: number | null;
}

function simulate(scene: Scene): Outcome {
  const type = VEHICLE_TYPES[scene.followerKind];
  const desiredSpeed = scene.followerDesired ?? type.desiredSpeed;
  let followingTime = scene.followingTime ?? type.followingTime;
  let speed = scene.startSpeed ?? desiredSpeed;
  let gap = scene.startGap;
  let recovering = false;
  let minGap = gap;
  let maxAcceleration = -Infinity;
  let minAcceleration = Infinity;
  let everRecovering = false;
  let lowestRecoverySpeed = Infinity;
  let highestRecoverySpeed = -Infinity;
  let recoveryEnd: number | null = null;
  let timeGapAtRecoveryEnd: number | null = null;
  for (let step = 0; step < scene.seconds / DT; step += 1) {
    const time = step * DT;
    if (scene.laterFollowingTime !== undefined && time >= scene.laterFollowingTime.at) {
      followingTime = scene.laterFollowingTime.value;
    }
    const driver = { ...type, desiredSpeed, followingTime, speed };
    const leader = { gap, speed: scene.leaderSpeed };
    const wasRecovering = recovering;
    recovering = nextRecovering(recovering, gap / Math.max(speed, 0.1), followingTime);
    if (wasRecovering && !recovering && recoveryEnd === null) {
      recoveryEnd = time;
      timeGapAtRecoveryEnd = gap / speed;
    }
    let acceleration = followingAcceleration(driver, leader);
    if (recovering) {
      acceleration = recoveryAcceleration(driver, leader);
      everRecovering = true;
    }
    const updated = nextSpeed(speed, acceleration, desiredSpeed, DT);
    const applied = (updated - speed) / DT;
    maxAcceleration = Math.max(maxAcceleration, applied);
    minAcceleration = Math.min(minAcceleration, applied);
    speed = updated;
    if (recovering) {
      lowestRecoverySpeed = Math.min(lowestRecoverySpeed, speed);
      highestRecoverySpeed = Math.max(highestRecoverySpeed, speed);
    }
    gap += (scene.leaderSpeed - speed) * DT;
    minGap = Math.min(minGap, gap);
  }
  return {
    followerSpeed: speed,
    gap,
    followingTime: gap / speed,
    minGap,
    maxAcceleration,
    minAcceleration,
    everRecovering,
    lowestRecoverySpeed,
    highestRecoverySpeed,
    recoveryEnd,
    timeGapAtRecoveryEnd,
  };
}

function follow(
  followerKind: VehicleKind,
  leaderKind: VehicleKind,
  startGap: number,
  seconds: number,
  followerDesired = VEHICLE_TYPES[followerKind].desiredSpeed,
  followingTime = VEHICLE_TYPES[followerKind].followingTime,
): Outcome {
  return simulate({
    followerKind,
    leaderSpeed: VEHICLE_TYPES[leaderKind].desiredSpeed,
    startGap,
    seconds,
    followerDesired,
    followingTime,
  });
}

describe('following distance', () => {
  it('settles a car at 3 s behind a slow truck', () => {
    const outcome = follow('car', 'slowTruck', 400, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
    expect(outcome.everRecovering).toBe(false);
  });

  it('settles a car at 3 s behind a semi', () => {
    const outcome = follow('car', 'semi', 400, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(80), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
    expect(outcome.everRecovering).toBe(false);
  });

  it('settles a semi at 5 s behind a slow truck', () => {
    const outcome = follow('semi', 'slowTruck', 400, 400);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(4.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(5.1);
    expect(outcome.everRecovering).toBe(false);
  });

  it('recovers 5 s behind a slow truck that it starts close to, at the same speed', () => {
    const outcome = follow('slowTruck', 'slowTruck', 60, 400);
    expect(outcome.everRecovering).toBe(true);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 3);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(5);
    expect(outcome.followingTime).toBeLessThanOrEqual(5.5);
  });

  it('keeps a car at 3 s or more behind a car at 90 km/h', () => {
    const outcome = follow('car', 'car', 80, 300);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(90), 1);
    expect(outcome.minGap / kmh(90)).toBeGreaterThanOrEqual(3);
    expect(outcome.everRecovering).toBe(false);
  });

  it('settles the user car at 3 s behind a slow truck', () => {
    const outcome = follow('user', 'slowTruck', 1000, 300, kmh(130));
    expect(outcome.followingTime).toBeGreaterThanOrEqual(2.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
    expect(outcome.everRecovering).toBe(false);
  });

  it('settles the user car at its own following time of 4.0 s behind a slow truck', () => {
    const outcome = follow('user', 'slowTruck', 1000, 300, kmh(130), 4);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(3.9);
    expect(outcome.followingTime).toBeLessThanOrEqual(4.1);
  });
});

describe('following distance recovery', () => {
  it('slows a car cut in at 2 s to 80 km/h and returns it to 90 km/h at 3 s', () => {
    const outcome = simulate({ followerKind: 'car', leaderSpeed: kmh(90), startGap: 2 * kmh(90), seconds: 120 });
    expect(outcome.everRecovering).toBe(true);
    expect(outcome.lowestRecoverySpeed).toBeGreaterThanOrEqual(kmh(79));
    expect(outcome.lowestRecoverySpeed).toBeLessThanOrEqual(kmh(81));
    expect(outcome.timeGapAtRecoveryEnd).toBeGreaterThanOrEqual(3);
    expect(outcome.timeGapAtRecoveryEnd).toBeLessThan(3.1);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(90), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(3);
    expect(outcome.followingTime).toBeLessThanOrEqual(3.1);
  });

  it('keeps a slow truck at 65 km/h behind a car 2 s ahead at 90 km/h', () => {
    const outcome = simulate({ followerKind: 'slowTruck', leaderSpeed: kmh(90), startGap: 2 * kmh(65), seconds: 60 });
    expect(outcome.everRecovering).toBe(true);
    expect(outcome.lowestRecoverySpeed).toBeCloseTo(kmh(65), 6);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(65), 6);
  });

  it('drives 10 km/h slower until a raised following time of 4 s is back', () => {
    const outcome = simulate({
      followerKind: 'user',
      followerDesired: kmh(130),
      leaderSpeed: kmh(90),
      startSpeed: kmh(90),
      startGap: 0.5 + 3 * kmh(90),
      seconds: 120,
      laterFollowingTime: { at: 5, value: 4 },
    });
    expect(outcome.everRecovering).toBe(true);
    expect(outcome.lowestRecoverySpeed).toBeGreaterThanOrEqual(kmh(79));
    expect(outcome.lowestRecoverySpeed).toBeLessThanOrEqual(kmh(81));
    expect(outcome.timeGapAtRecoveryEnd).toBeGreaterThanOrEqual(4);
    expect(outcome.followerSpeed).toBeCloseTo(kmh(90), 1);
    expect(outcome.followingTime).toBeGreaterThanOrEqual(4);
    expect(outcome.followingTime).toBeLessThanOrEqual(4.1);
  });

  it('stays within the braking limit and keeps a gap when cut in tight at a high speed difference', () => {
    const outcome = simulate({
      followerKind: 'user',
      followerDesired: kmh(180),
      leaderSpeed: kmh(90),
      startSpeed: kmh(180),
      startGap: 120,
      seconds: 60,
    });
    expect(outcome.everRecovering).toBe(true);
    expect(outcome.minAcceleration).toBeGreaterThanOrEqual(-MAX_BRAKING - 1e-9);
    expect(outcome.minGap).toBeGreaterThan(0);
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
    expect(outcome.everRecovering).toBe(false);
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
