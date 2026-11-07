import { STEP } from './clock';
import { kmh, MAX_BRAKING } from './vehicle-types';

export const STANDSTILL_GAP = 0.5;
export const RECOVERY_SPEED_DROP = kmh(10);
export const RECOVERY_START_MARGIN = 0.1;

const SAFETY_GAP = 2;

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

export function nextRecovering(recovering: boolean, timeGap: number, followingTime: number): boolean {
  if (recovering) {
    return timeGap < followingTime;
  }
  return timeGap < followingTime - RECOVERY_START_MARGIN;
}

export function recoveryTarget(driver: Driver, leader: Leader): number {
  return Math.max(0, Math.min(driver.desiredSpeed, leader.speed - RECOVERY_SPEED_DROP));
}

export function recoveryAcceleration(driver: Driver, leader: Leader): number {
  const { speed, maxAcceleration, comfortableBraking } = driver;
  const target = recoveryTarget(driver, leader);
  let acceleration = Math.min(maxAcceleration, (target - speed) / STEP);
  if (speed > target) {
    acceleration = Math.max(-comfortableBraking, (target - speed) / STEP);
  }
  if (speed > leader.speed) {
    const needed = (speed - leader.speed) ** 2 / (2 * Math.max(leader.gap - SAFETY_GAP, 0.1));
    if (needed > comfortableBraking) {
      acceleration = Math.min(acceleration, -needed);
    }
  }
  return clamp(acceleration, -MAX_BRAKING, maxAcceleration);
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
