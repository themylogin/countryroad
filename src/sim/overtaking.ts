import { STEP } from './clock';
import { recoveryTarget } from './following';
import { forwardDistance, ROAD_LENGTH, type Direction } from './road';
import { kmh, USER_MAX_SPEED, VEHICLE_TYPES } from './vehicle-types';
import type { OvertakingRules, Vehicle, World, WorldEvent } from './world';

export const LANE_CHANGE_SECONDS = 2;
export const LANE_CHANGE_STEPS = Math.round(LANE_CHANGE_SECONDS / STEP);
export const TRAFFIC_CUT_IN_GAP = 2;
export const TRAFFIC_RETURN_FOLLOWING_TIME = 3;
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
const RETURN_BRAKING = 3;
const RETURN_BRAKING_STANDSTILL = 2;
const PULL_OUT_MARGIN = 2;
const CANDIDATE_SPEED_STEP = kmh(5);
const QUEUE_GAP_MARGIN = 20;
const INSERTION_ZONE_AHEAD = 3000;
const INSERTION_ZONE_BEHIND = 200;
const INSERTION_ZONE_MARGIN = 500;
const SCAN_STEP = 0.25;

export interface OvertakePlan {
  readonly speed: number;
  readonly end: number;
  readonly limit: number;
  readonly behindTime: number;
  readonly aheadTime: number;
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
    return world.userSettings.oncomingGap;
  }
  return ONCOMING_GAP;
}

export function overtakingSpeed(world: World, vehicle: Vehicle): number {
  const desired = world.effectiveDesiredSpeed(vehicle);
  if (vehicle.kind === 'user') {
    return Math.max(desired, world.userSettings.overtakingSpeed);
  }
  return desired;
}

export function brakingRoom(speed: number, aheadSpeed: number): number {
  if (speed <= aheadSpeed) {
    return 0;
  }
  return (speed - aheadSpeed) ** 2 / (2 * RETURN_BRAKING) + RETURN_BRAKING_STANDSTILL;
}

export function returnGaps(world: World, vehicle: Vehicle): { behindTime: number; aheadTime: number } {
  if (vehicle.kind === 'user') {
    return { behindTime: world.userSettings.cutInGap, aheadTime: world.userSettings.returnFollowingTime };
  }
  return { behindTime: TRAFFIC_CUT_IN_GAP, aheadTime: TRAFFIC_RETURN_FOLLOWING_TIME };
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
  let low = lowestSpeed(vehicle, chain[0]);
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const ahead = chain[index];
    high = Math.max(ahead.speed, Math.min(world.effectiveDesiredSpeed(ahead), high));
    low = Math.min(low, lowestSpeed(ahead, chain[index + 1]));
  }
  const own = Math.max(vehicle.speed, Math.min(world.effectiveDesiredSpeed(vehicle), high));
  return { low: Math.max(0, low - SPEED_ALLOWANCE), high: own + SPEED_ALLOWANCE };
}

export function candidateSpeeds(car: Vehicle, highest: number, passedHigh: number): number[] {
  const floor = passedHigh + 0.05;
  if (highest <= floor || highest < car.speed) {
    return [];
  }
  if (car.kind !== 'user') {
    return [highest];
  }
  const speeds: number[] = [];
  for (let speed = highest; speed > floor && speed >= car.speed; speed -= CANDIDATE_SPEED_STEP) {
    speeds.push(speed);
  }
  return speeds;
}

interface PlanContext {
  readonly highest: number;
  readonly limit: number;
  readonly behindTime: number;
  readonly aheadTime: number;
  readonly entries: readonly QueueEntry[];
  readonly complete: boolean;
}

type SlotResult =
  | { readonly kind: 'plan'; readonly plan: OvertakePlan }
  | { readonly kind: 'cannotPass' }
  | { readonly kind: 'noFit' }
  | { readonly kind: 'blocked' };

export function queueEnd(world: World, entries: readonly QueueEntry[]): number {
  let end = 0;
  while (end + 1 < entries.length) {
    const current = entries[end];
    const next = entries[end + 1];
    const gap = next.distance - next.vehicle.length - current.distance;
    const tooFar = gap > current.vehicle.followingTime * current.vehicle.speed + QUEUE_GAP_MARGIN;
    const notSlower = next.vehicle.speed >= world.effectiveDesiredSpeed(current.vehicle) - CONSTRAINED_SPEED_MARGIN;
    if (tooFar || notSlower) {
      break;
    }
    end += 1;
  }
  return end;
}

export function planOvertake(world: World, car: Vehicle): OvertakePlan | null {
  const { entries, complete } = homeQueue(world, car);
  const first = entries[0];
  if (first === undefined) {
    return null;
  }
  const context: PlanContext = {
    highest: overtakingSpeed(world, car),
    limit: oncomingLimit(world, car),
    ...returnGaps(world, car),
    entries,
    complete,
  };
  const firstCandidates = candidateSpeeds(car, context.highest, speedBounds(world, first.vehicle).high);
  const slowest = firstCandidates[firstCandidates.length - 1];
  if (slowest === undefined) {
    return null;
  }
  const slowestMotion = acceleratingMotion(car.speed, slowest, car.maxAcceleration);
  if (!oncomingClear(world, car, slowestMotion, 2 * LANE_CHANGE_SECONDS, context.limit)) {
    return null;
  }
  if (car.kind === 'user') {
    for (let index = queueEnd(world, entries); index >= 0; index -= 1) {
      const result = planSlot(world, car, context, index);
      if (result.kind === 'plan') {
        return result.plan;
      }
    }
    return null;
  }
  for (let index = 0; index < entries.length; index += 1) {
    const result = planSlot(world, car, context, index);
    if (result.kind === 'plan') {
      return result.plan;
    }
    if (result.kind !== 'noFit') {
      return null;
    }
  }
  return null;
}

function planSlot(world: World, car: Vehicle, context: PlanContext, index: number): SlotResult {
  const { entries, complete, highest, limit, behindTime, aheadTime } = context;
  const passed = entries[index];
  const passedHigh = speedBounds(world, passed.vehicle).high;
  const candidates = candidateSpeeds(car, highest, passedHigh);
  if (candidates.length === 0) {
    return { kind: 'cannotPass' };
  }
  const next = entries[index + 1];
  if (next === undefined && !complete) {
    return { kind: 'blocked' };
  }
  let nextLow = 0;
  if (next !== undefined) {
    nextLow = speedBounds(world, next.vehicle).low;
  }
  for (const speed of candidates) {
    const motion = acceleratingMotion(car.speed, speed, car.maxAcceleration);
    if (!pullOutClear(world, entries[0], motion)) {
      continue;
    }
    const end = returnEnd(car, passed, passedHigh, behindTime, motion);
    if (end === null) {
      continue;
    }
    if (next !== undefined) {
      const gapAhead = next.distance - next.vehicle.length + nextLow * end - motion.distance(end);
      const speedAtEnd = motion.speed(end);
      const needed = Math.max(aheadTime * speedAtEnd, brakingRoom(speedAtEnd, nextLow));
      if (gapAhead < needed + DISTANCE_MARGIN) {
        continue;
      }
    }
    if (!passingLaneFree(world, car, motion.distance(end), end)) {
      return { kind: 'blocked' };
    }
    if (!oncomingClear(world, car, motion, end, limit)) {
      return { kind: 'blocked' };
    }
    return {
      kind: 'plan',
      plan: {
        speed,
        end,
        limit,
        behindTime,
        aheadTime,
        passedIds: entries.slice(0, index + 1).map((entry) => entry.vehicle.id),
      },
    };
  }
  return { kind: 'noFit' };
}

function returnEnd(car: Vehicle, passed: QueueEntry, passedHigh: number, behindTime: number, motion: Motion): number | null {
  const clearNeed = passed.distance + car.length + DISTANCE_MARGIN;
  const clearTime = earliestTime((time) => motion.distance(time) - passedHigh * time - clearNeed);
  const gapTime = earliestTime((time) => motion.distance(time) - passedHigh * time - clearNeed - behindTime * passedHigh);
  if (clearTime === null || gapTime === null) {
    return null;
  }
  const end = Math.max(gapTime, clearTime + LANE_CHANGE_SECONDS, 2 * LANE_CHANGE_SECONDS);
  if (end > MAX_MANEUVER_SECONDS) {
    return null;
  }
  return end;
}

export function returnReady(world: World, car: Vehicle): boolean {
  const maneuver = car.maneuver;
  if (maneuver === null) {
    return false;
  }
  const late = world.time > maneuver.plannedEnd - LANE_CHANGE_SECONDS + LATE_FALLBACK_SECONDS;
  if (!late && !hasPassed(world, car, maneuver.lastPassedId)) {
    return false;
  }
  const motion = acceleratingMotion(car.speed, maneuver.speed, car.maxAcceleration);
  const advance = motion.distance(LANE_CHANGE_SECONDS);
  const follower = world.homeLaneFollower(car);
  if (follower !== null) {
    if (follower.gap < DISTANCE_MARGIN) {
      return false;
    }
    const behindHigh = speedBounds(world, follower.vehicle).high;
    const gapBehind = follower.gap + advance - behindHigh * LANE_CHANGE_SECONDS;
    let needed = maneuver.behindTime * behindHigh + DISTANCE_MARGIN;
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
    const speedAtEnd = motion.speed(LANE_CHANGE_SECONDS);
    let timeGap = maneuver.aheadTime;
    if (late) {
      timeGap = FALLBACK_GAP_AHEAD;
    }
    const needed = Math.max(timeGap * speedAtEnd, brakingRoom(speedAtEnd, aheadLow)) + DISTANCE_MARGIN;
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
      behindTime: plan.behindTime,
      aheadTime: plan.aheadTime,
      passedIds: plan.passedIds,
      lastPassedId: plan.passedIds[plan.passedIds.length - 1],
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
    behindLimit: maneuver.behindTime,
    aheadLimit: maneuver.aheadTime,
    lateBy: world.time - maneuver.plannedEnd,
  });
}

function hasPassed(world: World, car: Vehicle, vehicleId: number): boolean {
  const vehicle = world.vehicles.find((candidate) => candidate.id === vehicleId);
  if (vehicle === undefined) {
    return true;
  }
  return forwardDistance(car.y, vehicle.y, car.direction) > ROAD_LENGTH / 2;
}

function pullOutClear(world: World, ahead: QueueEntry | undefined, motion: Motion): boolean {
  if (ahead === undefined) {
    return true;
  }
  const aheadLow = speedBounds(world, ahead.vehicle).low;
  const gapAtEnd = ahead.distance - ahead.vehicle.length + aheadLow * LANE_CHANGE_SECONDS - motion.distance(LANE_CHANGE_SECONDS);
  return gapAtEnd >= PULL_OUT_MARGIN;
}

function lowestSpeed(vehicle: Vehicle, leader: Vehicle | undefined): number {
  if (!vehicle.recovering || leader === undefined) {
    return vehicle.speed;
  }
  return Math.min(vehicle.speed, recoveryTarget(vehicle, { gap: 0, speed: leader.speed }));
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
