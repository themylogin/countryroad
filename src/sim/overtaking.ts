import { STEP } from './clock';
import { forwardDistance, ROAD_LENGTH, type Direction } from './road';
import { kmh, USER_MAX_SPEED, VEHICLE_TYPES } from './vehicle-types';
import type { OvertakingRules, Vehicle, World, WorldEvent } from './world';

export const LANE_CHANGE_SECONDS = 2;
export const LANE_CHANGE_STEPS = Math.round(LANE_CHANGE_SECONDS / STEP);
export const GAP_BEHIND = 2;
export const GAP_AHEAD = 3;
export const ONCOMING_GAP = 6;
export const PLAN_INTERVAL = 0.5;

const CONSTRAINED_SPEED_MARGIN = kmh(1);
const CONSTRAINED_GAP_MARGIN = 20;
const HORIZON_VEHICLES = 12;
const HORIZON_DISTANCE = 3000;
const MAX_MANEUVER_SECONDS = 90;
const DISTANCE_MARGIN = 1;
const TIME_MARGIN = 0.05;
const PASSING_LANE_AHEAD_MARGIN = 100;
const PASSING_LANE_BEHIND_MARGIN = 200;
const ALONGSIDE_MARGIN = 10;
const SPEED_BOUND_LOOKAHEAD = 1000;
const SPEED_ALLOWANCE = 0.3;
const LATE_FALLBACK_SECONDS = 0.5;
const FALLBACK_GAP_AHEAD = 1;
const INSERTION_ZONE_AHEAD = 3000;
const INSERTION_ZONE_BEHIND = 200;
const INSERTION_ZONE_MARGIN = 500;
const SCAN_STEP = 0.25;

export interface OvertakePlan {
  readonly speed: number;
  readonly end: number;
  readonly limit: number;
  readonly passedIds: readonly number[];
}

export interface Motion {
  distance(time: number): number;
  speed(time: number): number;
}

interface QueueEntry {
  readonly vehicle: Vehicle;
  readonly distance: number;
}

export interface SpeedBounds {
  readonly low: number;
  readonly high: number;
}

export function acceleratingMotion(start: number, target: number, acceleration: number): Motion {
  const from = Math.min(start, target);
  const rampTime = (target - from) / acceleration;
  const rampDistance = from * rampTime + 0.5 * acceleration * rampTime * rampTime;
  return {
    distance(time: number): number {
      if (time <= rampTime) {
        return from * time + 0.5 * acceleration * time * time;
      }
      return rampDistance + target * (time - rampTime);
    },
    speed(time: number): number {
      return Math.min(target, from + acceleration * time);
    },
  };
}

export function oncomingLimit(world: World, vehicle: Vehicle): number {
  if (vehicle.kind === 'user') {
    return world.userGap;
  }
  return ONCOMING_GAP;
}

export function maxPossibleSpeed(world: World, vehicle: Vehicle): number {
  if (vehicle.kind === 'user') {
    return USER_MAX_SPEED;
  }
  return world.effectiveDesiredSpeed(vehicle);
}

export function isConstrained(world: World, vehicle: Vehicle): boolean {
  const leader = world.homeLaneLeader(vehicle);
  if (leader === null) {
    return false;
  }
  const desired = world.effectiveDesiredSpeed(vehicle);
  if (leader.vehicle.speed >= desired - CONSTRAINED_SPEED_MARGIN) {
    return false;
  }
  return leader.gap <= vehicle.followingTime * vehicle.speed + CONSTRAINED_GAP_MARGIN;
}

export function speedBounds(world: World, vehicle: Vehicle): SpeedBounds {
  const chain: Vehicle[] = [];
  for (const ahead of world.orderedFrom(vehicle)) {
    if (ahead.lateral >= 1) {
      continue;
    }
    if (forwardDistance(vehicle.y, ahead.y, vehicle.direction) > SPEED_BOUND_LOOKAHEAD) {
      break;
    }
    chain.push(ahead);
  }
  let high = Infinity;
  let low = vehicle.speed;
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const ahead = chain[index];
    high = Math.max(ahead.speed, Math.min(world.effectiveDesiredSpeed(ahead), high));
    low = Math.min(low, ahead.speed);
  }
  const own = Math.max(vehicle.speed, Math.min(world.effectiveDesiredSpeed(vehicle), high));
  return { low: Math.max(0, low - SPEED_ALLOWANCE), high: own + SPEED_ALLOWANCE };
}

export function planOvertake(world: World, car: Vehicle): OvertakePlan | null {
  const speed = world.effectiveDesiredSpeed(car);
  const motion = acceleratingMotion(car.speed, speed, car.maxAcceleration);
  const limit = oncomingLimit(world, car);
  if (!oncomingClear(world, car, motion, 2 * LANE_CHANGE_SECONDS, limit)) {
    return null;
  }
  const { entries, complete } = homeQueue(world, car);
  for (let index = 0; index < entries.length; index += 1) {
    const passed = entries[index];
    const passedHigh = speedBounds(world, passed.vehicle).high;
    if (speed <= passedHigh + 0.05) {
      return null;
    }
    const clearNeed = passed.distance + car.length + DISTANCE_MARGIN;
    const clearTime = earliestTime((time) => motion.distance(time) - passedHigh * time - clearNeed);
    const gapTime = earliestTime(
      (time) => motion.distance(time) - passedHigh * time - clearNeed - GAP_BEHIND * passedHigh,
    );
    if (clearTime === null || gapTime === null) {
      return null;
    }
    const end = Math.max(gapTime, clearTime + LANE_CHANGE_SECONDS, 2 * LANE_CHANGE_SECONDS);
    if (end > MAX_MANEUVER_SECONDS) {
      return null;
    }
    const next = entries[index + 1];
    if (next === undefined && !complete) {
      return null;
    }
    if (next !== undefined) {
      const nextLow = speedBounds(world, next.vehicle).low;
      const gapAhead = next.distance - next.vehicle.length + nextLow * end - motion.distance(end);
      if (gapAhead < GAP_AHEAD * motion.speed(end) + DISTANCE_MARGIN) {
        continue;
      }
    }
    if (!passingLaneFree(world, car, motion.distance(end), end)) {
      return null;
    }
    if (!oncomingClear(world, car, motion, end, limit)) {
      return null;
    }
    return {
      speed,
      end,
      limit,
      passedIds: entries.slice(0, index + 1).map((entry) => entry.vehicle.id),
    };
  }
  return null;
}

export function returnReady(world: World, car: Vehicle): boolean {
  const maneuver = car.maneuver;
  if (maneuver === null) {
    return false;
  }
  const late = world.time > maneuver.plannedEnd - LANE_CHANGE_SECONDS + LATE_FALLBACK_SECONDS;
  const motion = acceleratingMotion(car.speed, maneuver.speed, car.maxAcceleration);
  const advance = motion.distance(LANE_CHANGE_SECONDS);
  const follower = world.homeLaneFollower(car);
  if (follower !== null) {
    if (follower.gap < DISTANCE_MARGIN) {
      return false;
    }
    const behindHigh = speedBounds(world, follower.vehicle).high;
    const gapBehind = follower.gap + advance - behindHigh * LANE_CHANGE_SECONDS;
    let needed = GAP_BEHIND * behindHigh + DISTANCE_MARGIN;
    if (late) {
      needed = DISTANCE_MARGIN;
    }
    if (gapBehind < needed) {
      return false;
    }
  }
  const leader = world.homeLaneLeader(car);
  if (leader !== null) {
    const aheadLow = speedBounds(world, leader.vehicle).low;
    const gapAhead = leader.gap + aheadLow * LANE_CHANGE_SECONDS - advance;
    let needed = GAP_AHEAD * motion.speed(LANE_CHANGE_SECONDS) + DISTANCE_MARGIN;
    if (late) {
      needed = FALLBACK_GAP_AHEAD * motion.speed(LANE_CHANGE_SECONDS) + DISTANCE_MARGIN;
    }
    if (gapAhead < needed) {
      return false;
    }
  }
  return true;
}

export function timeToMeetOncoming(world: World, car: Vehicle): number | null {
  let lowest: number | null = null;
  for (const oncoming of world.opposite(car.direction)) {
    const distance = forwardDistance(car.y, oncoming.y, car.direction);
    if (distance > ROAD_LENGTH / 2) {
      continue;
    }
    const time = distance / (car.speed + oncoming.speed);
    if (lowest === null || time < lowest) {
      lowest = time;
    }
  }
  return lowest;
}

export const overtakingRules: OvertakingRules = {
  advance(world: World, vehicle: Vehicle, events: WorldEvent[]): void {
    const maneuver = vehicle.maneuver;
    if (maneuver === null) {
      return;
    }
    if (vehicle.phase === 'out') {
      maneuver.laneChangeSteps += 1;
      vehicle.lateral = Math.min(1, maneuver.laneChangeSteps / LANE_CHANGE_STEPS);
      if (maneuver.laneChangeSteps >= LANE_CHANGE_STEPS) {
        vehicle.phase = 'passing';
        maneuver.laneChangeSteps = 0;
      }
      return;
    }
    if (vehicle.phase === 'passing') {
      if (returnReady(world, vehicle)) {
        vehicle.phase = 'back';
      }
      return;
    }
    if (vehicle.phase === 'back') {
      maneuver.laneChangeSteps += 1;
      vehicle.lateral = Math.max(0, 1 - maneuver.laneChangeSteps / LANE_CHANGE_STEPS);
      if (maneuver.laneChangeSteps >= LANE_CHANGE_STEPS) {
        finish(world, vehicle, events);
      }
    }
  },

  maybeStart(world: World, vehicle: Vehicle, events: WorldEvent[]): void {
    if (vehicle.phase !== 'cruise' || !VEHICLE_TYPES[vehicle.kind].overtakes) {
      return;
    }
    if (world.time < vehicle.nextPlanTime) {
      return;
    }
    vehicle.nextPlanTime = world.time + PLAN_INTERVAL;
    if (!isConstrained(world, vehicle)) {
      return;
    }
    const plan = planOvertake(world, vehicle);
    if (plan === null) {
      return;
    }
    vehicle.maneuver = {
      speed: plan.speed,
      plannedEnd: world.time + plan.end,
      limit: plan.limit,
      passedIds: plan.passedIds,
      laneChangeSteps: 0,
    };
    vehicle.phase = 'out';
    events.push({ type: 'overtakeStart', time: world.time, vehicleId: vehicle.id, plannedEnd: world.time + plan.end });
  },

  blocksInsertion(world: World, direction: Direction, y: number): boolean {
    for (const vehicle of world.vehicles) {
      const maneuver = vehicle.maneuver;
      if (maneuver === null) {
        continue;
      }
      const remaining = Math.max(0, maneuver.plannedEnd - world.time);
      const reach = (maneuver.speed + USER_MAX_SPEED) * (remaining + maneuver.limit) + INSERTION_ZONE_MARGIN;
      const ahead = forwardDistance(vehicle.y, y, vehicle.direction);
      if (ahead <= Math.max(INSERTION_ZONE_AHEAD, reach)) {
        return true;
      }
      if (ROAD_LENGTH - ahead <= INSERTION_ZONE_BEHIND) {
        return true;
      }
    }
    return false;
  },
};

function finish(world: World, vehicle: Vehicle, events: WorldEvent[]): void {
  const maneuver = vehicle.maneuver;
  if (maneuver === null) {
    return;
  }
  vehicle.lateral = 0;
  vehicle.phase = 'cruise';
  vehicle.maneuver = null;
  vehicle.nextPlanTime = world.time + PLAN_INTERVAL;
  const follower = world.homeLaneFollower(vehicle);
  const leader = world.homeLaneLeader(vehicle);
  let gapBehind: number | null = null;
  if (follower !== null && follower.vehicle !== vehicle) {
    gapBehind = follower.gap / follower.vehicle.speed;
  }
  let gapAhead: number | null = null;
  if (leader !== null && leader.vehicle !== vehicle) {
    gapAhead = leader.gap / vehicle.speed;
  }
  events.push({
    type: 'overtakeFinish',
    time: world.time,
    vehicleId: vehicle.id,
    gapBehind,
    gapAhead,
    timeToMeet: timeToMeetOncoming(world, vehicle),
    limit: maneuver.limit,
    lateBy: world.time - maneuver.plannedEnd,
  });
}

function homeQueue(world: World, car: Vehicle): { entries: QueueEntry[]; complete: boolean } {
  const entries: QueueEntry[] = [];
  let complete = true;
  for (const vehicle of world.orderedFrom(car)) {
    if (vehicle.lateral >= 1) {
      continue;
    }
    const distance = forwardDistance(car.y, vehicle.y, car.direction);
    if (distance > HORIZON_DISTANCE) {
      break;
    }
    if (entries.length >= HORIZON_VEHICLES) {
      complete = false;
      break;
    }
    entries.push({ vehicle, distance });
  }
  return { entries, complete };
}

function passingLaneFree(world: World, car: Vehicle, reach: number, end: number): boolean {
  for (const vehicle of world.orderedFrom(car)) {
    if (vehicle.maneuver === null && vehicle.lateral <= 0) {
      continue;
    }
    const ahead = forwardDistance(car.y, vehicle.y, car.direction);
    if (ahead <= reach + PASSING_LANE_AHEAD_MARGIN) {
      return false;
    }
    const behind = ROAD_LENGTH - ahead;
    if (behind <= (USER_MAX_SPEED - car.speed) * end + PASSING_LANE_BEHIND_MARGIN) {
      return false;
    }
  }
  return true;
}

function oncomingClear(world: World, car: Vehicle, motion: Motion, end: number, limit: number): boolean {
  const travelled = motion.distance(end);
  const speedAtEnd = motion.speed(end);
  for (const oncoming of world.opposite(car.direction)) {
    const distance = forwardDistance(car.y, oncoming.y, car.direction);
    if (ROAD_LENGTH - distance < oncoming.length + car.length + ALONGSIDE_MARGIN) {
      return false;
    }
    const oncomingSpeed = maxPossibleSpeed(world, oncoming);
    const gapAtEnd = distance - travelled - oncomingSpeed * end;
    if (gapAtEnd / (speedAtEnd + oncomingSpeed) < limit + TIME_MARGIN) {
      return false;
    }
  }
  return true;
}

function earliestTime(condition: (time: number) => number): number | null {
  let previous = 0;
  if (condition(0) >= 0) {
    return 0;
  }
  for (let time = SCAN_STEP; time <= MAX_MANEUVER_SECONDS; time += SCAN_STEP) {
    if (condition(time) >= 0) {
      let low = previous;
      let high = time;
      for (let iteration = 0; iteration < 30; iteration += 1) {
        const middle = (low + high) / 2;
        if (condition(middle) >= 0) {
          high = middle;
        } else {
          low = middle;
        }
      }
      return high;
    }
    previous = time;
  }
  return null;
}
