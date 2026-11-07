import { MAX_BRAKING } from './vehicle-types';

export const STANDSTILL_GAP = 0.5;

export interface Driver {
  readonly speed: number;
  readonly desiredSpeed: number;
  readonly followingTime: number;
  readonly maxAcceleration: number;
  readonly comfortableBraking: number;
}

export interface Leader {
  readonly gap: number;
  readonly speed: number;
}

export function followingAcceleration(driver: Driver, leader: Leader | null): number {
  const { speed, desiredSpeed, maxAcceleration, comfortableBraking, followingTime } = driver;
  let free = maxAcceleration * (1 - (speed / desiredSpeed) ** 4);
  if (speed > desiredSpeed) {
    free = -comfortableBraking;
  }
  if (leader === null) {
    return clamp(free, -MAX_BRAKING, maxAcceleration);
  }
  const approachRate = speed - leader.speed;
  const brakingTerm = (speed * approachRate) / (2 * Math.sqrt(maxAcceleration * comfortableBraking));
  const desiredGap = STANDSTILL_GAP + Math.max(0, speed * followingTime + brakingTerm);
  const gap = Math.max(leader.gap, 0.01);
  const interaction = maxAcceleration * (1 - (desiredGap / gap) ** 2);
  return clamp(Math.min(free, interaction), -MAX_BRAKING, maxAcceleration);
}

export function nextSpeed(speed: number, acceleration: number, desiredSpeed: number, dt: number): number {
  let updated = speed + acceleration * dt;
  if (acceleration > 0) {
    updated = Math.min(updated, desiredSpeed);
  }
  return Math.max(updated, 0);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
