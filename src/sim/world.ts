import { STEP } from './clock';
import { followingAcceleration, nextRecovering, nextSpeed, recoveryAcceleration } from './following';
import { overtakingRules } from './overtaking';
import { createRandom, type Random } from './random';
import { forwardDistance, relativePosition, ROAD_LENGTH, wrap, type Direction } from './road';
import { kmh, TRAFFIC_KINDS, VEHICLE_TYPES, type TrafficKind, type VehicleKind } from './vehicle-types';

export { STEP };
export const VIEW_BEHIND = 25;
export const VIEW_AHEAD = 225;
export const DIRECTIONS: readonly Direction[] = [1, -1];

const PLACEMENT_SPEED = kmh(65);
const PENDING_RETRY_INTERVAL = 1;
const INSERT_MARGIN = 5;
const VISIBLE_MARGIN = 20;

export type Phase = 'cruise' | 'out' | 'passing' | 'back';

export interface Maneuver {
  readonly speed: number;
  readonly plannedEnd: number;
  readonly limit: number;
  readonly behindTime: number;
  readonly aheadTime: number;
  readonly passedIds: readonly number[];
  readonly lastPassedId: number;
  laneChangeSteps: number;
}

export interface Vehicle {
  readonly id: number;
  readonly kind: VehicleKind;
  readonly direction: Direction;
  readonly length: number;
  readonly width: number;
  followingTime: number;
  readonly maxAcceleration: number;
  readonly comfortableBraking: number;
  desiredSpeed: number;
  y: number;
  speed: number;
  lateral: number;
  phase: Phase;
  maneuver: Maneuver | null;
  nextPlanTime: number;
  recovering: boolean;
}

export type TrafficCounts = Record<TrafficKind, number>;

export interface UserSettings {
  readonly speed: number;
  readonly followingTime: number;
  readonly overtakingSpeed: number;
  readonly oncomingGap: number;
  readonly returnFollowingTime: number;
  readonly cutInGap: number;
}

export interface WorldOptions {
  readonly seed: number;
  readonly counts: TrafficCounts;
  readonly user: UserSettings;
  readonly overtaking?: boolean;
}

export interface OvertakeStartEvent {
  readonly type: 'overtakeStart';
  readonly time: number;
  readonly vehicleId: number;
  readonly plannedEnd: number;
}

export interface OvertakeFinishEvent {
  readonly type: 'overtakeFinish';
  readonly time: number;
  readonly vehicleId: number;
  readonly gapBehind: number | null;
  readonly gapAhead: number | null;
  readonly timeToMeet: number | null;
  readonly limit: number;
  readonly behindLimit: number;
  readonly aheadLimit: number;
  readonly lateBy: number;
}

export type WorldEvent = OvertakeStartEvent | OvertakeFinishEvent;

export interface Neighbor {
  readonly vehicle: Vehicle;
  readonly gap: number;
}

export interface OvertakingRules {
  advance(world: World, vehicle: Vehicle, events: WorldEvent[]): void;
  maybeStart(world: World, vehicle: Vehicle, events: WorldEvent[]): void;
  blocksInsertion(world: World, direction: Direction, y: number): boolean;
}

export class World {
  time = 0;
  readonly vehicles: Vehicle[] = [];
  readonly user: Vehicle;
  userSettings: UserSettings;
  userDistance = 0;
  userOvertakes = 0;
  overtakingRules: OvertakingRules | null = null;
  private readonly random: Random;
  private nextId = 0;
  private readonly pending = new Map<string, number>();
  private nextPendingTime = PENDING_RETRY_INTERVAL;
  private readonly ordered = new Map<Direction, Vehicle[]>([
    [1, []],
    [-1, []],
  ]);
  private readonly laneIndex = new Map<Vehicle, number>();

  constructor(options: WorldOptions) {
    this.random = createRandom(options.seed);
    this.userSettings = options.user;
    if (options.overtaking !== false) {
      this.overtakingRules = overtakingRules;
    }
    this.user = this.createVehicle('user', 1, 0, 0);
    this.user.desiredSpeed = options.user.speed;
    this.user.followingTime = options.user.followingTime;
    this.placeInitial(options.counts);
  }

  countOf(kind: TrafficKind, direction: Direction): number {
    return this.vehicles.filter((vehicle) => vehicle.kind === kind && vehicle.direction === direction).length;
  }

  setUser(change: Partial<UserSettings>): void {
    this.userSettings = { ...this.userSettings, ...change };
    this.user.followingTime = this.userSettings.followingTime;
    this.applyRequestedUserSpeed();
  }

  userInOvertake(): boolean {
    if (this.user.maneuver !== null) {
      return true;
    }
    return this.vehicles.some((vehicle) => vehicle.maneuver?.passedIds.includes(this.user.id) === true);
  }

  setCount(kind: TrafficKind, count: number): void {
    for (const direction of DIRECTIONS) {
      const key = pendingKey(direction, kind);
      const present = this.countOf(kind, direction);
      const waiting = this.pending.get(key) ?? 0;
      const surplus = present + waiting - count;
      if (surplus > 0) {
        const fromPending = Math.min(waiting, surplus);
        this.pending.set(key, waiting - fromPending);
        this.remove(kind, direction, surplus - fromPending);
      } else {
        this.pending.set(key, waiting - surplus);
      }
    }
    this.insertPending();
  }

  spawn(kind: TrafficKind, direction: Direction, y: number, speed: number): Vehicle {
    const vehicle = this.createVehicle(kind, direction, y, speed);
    this.sortOrdered();
    return vehicle;
  }

  pendingCount(kind: TrafficKind, direction: Direction): number {
    return this.pending.get(pendingKey(direction, kind)) ?? 0;
  }

  effectiveDesiredSpeed(vehicle: Vehicle): number {
    if (vehicle.maneuver !== null) {
      return vehicle.maneuver.speed;
    }
    return vehicle.desiredSpeed;
  }

  *orderedFrom(vehicle: Vehicle): Generator<Vehicle> {
    const lane = this.orderedLane(vehicle.direction);
    const index = this.indexOf(vehicle);
    for (let offset = 1; offset < lane.length; offset += 1) {
      yield lane[(index + offset) % lane.length];
    }
  }

  opposite(direction: Direction): Vehicle[] {
    return this.orderedLane(direction === 1 ? -1 : 1);
  }

  homeLaneLeader(vehicle: Vehicle): Neighbor | null {
    const lane = this.orderedLane(vehicle.direction);
    const index = this.indexOf(vehicle);
    for (let offset = 1; offset < lane.length; offset += 1) {
      const candidate = lane[(index + offset) % lane.length];
      if (candidate.lateral < 1) {
        const gap = forwardDistance(vehicle.y, candidate.y, vehicle.direction) - candidate.length;
        return { vehicle: candidate, gap };
      }
    }
    return null;
  }

  homeLaneFollower(vehicle: Vehicle): Neighbor | null {
    const lane = this.orderedLane(vehicle.direction);
    const index = this.indexOf(vehicle);
    for (let offset = 1; offset < lane.length; offset += 1) {
      const candidate = lane[(index - offset + lane.length) % lane.length];
      if (candidate.lateral < 1) {
        const gap = forwardDistance(candidate.y, vehicle.y, vehicle.direction) - vehicle.length;
        return { vehicle: candidate, gap };
      }
    }
    return null;
  }

  isVisible(direction: Direction, y: number, length: number): boolean {
    const front = relativePosition(this.user.y, y);
    let low = front - length;
    let high = front;
    if (direction === -1) {
      low = front;
      high = front + length;
    }
    return high > -VIEW_BEHIND - VISIBLE_MARGIN && low < VIEW_AHEAD + VISIBLE_MARGIN;
  }

  step(): WorldEvent[] {
    const events: WorldEvent[] = [];
    const accelerations = this.vehicles.map((vehicle) => this.accelerationOf(vehicle));
    this.vehicles.forEach((vehicle, index) => {
      vehicle.speed = nextSpeed(vehicle.speed, accelerations[index], this.effectiveDesiredSpeed(vehicle), STEP);
      vehicle.y = wrap(vehicle.y + vehicle.direction * vehicle.speed * STEP);
    });
    this.time += STEP;
    this.userDistance += this.user.speed * STEP;
    this.sortOrdered();
    const rules = this.overtakingRules;
    if (rules !== null) {
      for (const vehicle of this.vehicles) {
        rules.advance(this, vehicle, events);
      }
      for (const vehicle of this.vehicles) {
        rules.maybeStart(this, vehicle, events);
      }
    }
    this.applyRequestedUserSpeed();
    for (const event of events) {
      if (event.type === 'overtakeFinish' && event.vehicleId === this.user.id) {
        this.userOvertakes += 1;
      }
    }
    if (this.time >= this.nextPendingTime) {
      this.nextPendingTime = this.time + PENDING_RETRY_INTERVAL;
      this.insertPending();
    }
    return events;
  }

  private applyRequestedUserSpeed(): void {
    if (!this.userInOvertake()) {
      this.user.desiredSpeed = this.userSettings.speed;
    }
  }

  private accelerationOf(vehicle: Vehicle): number {
    if (vehicle.maneuver !== null) {
      return Math.min(vehicle.maxAcceleration, (vehicle.maneuver.speed - vehicle.speed) / STEP);
    }
    const neighbor = this.homeLaneLeader(vehicle);
    if (neighbor === null) {
      vehicle.recovering = false;
      return followingAcceleration(vehicle, null);
    }
    const leader = { gap: neighbor.gap, speed: neighbor.vehicle.speed };
    const timeGap = neighbor.gap / Math.max(vehicle.speed, 0.1);
    vehicle.recovering = nextRecovering(vehicle.recovering, timeGap, vehicle.followingTime);
    if (vehicle.recovering) {
      return recoveryAcceleration(vehicle, leader);
    }
    return followingAcceleration(vehicle, leader);
  }

  private indexOf(vehicle: Vehicle): number {
    const index = this.laneIndex.get(vehicle);
    if (index === undefined) {
      throw new Error(`vehicle ${vehicle.id} is not on the road`);
    }
    return index;
  }

  private orderedLane(direction: Direction): Vehicle[] {
    const lane = this.ordered.get(direction);
    if (lane === undefined) {
      throw new Error(`no lane for direction ${direction}`);
    }
    return lane;
  }

  private sortOrdered(): void {
    for (const direction of DIRECTIONS) {
      const lane = this.vehicles.filter((vehicle) => vehicle.direction === direction);
      lane.sort((a, b) => wrap(direction * a.y) - wrap(direction * b.y));
      lane.forEach((vehicle, index) => this.laneIndex.set(vehicle, index));
      this.ordered.set(direction, lane);
    }
  }

  private createVehicle(kind: VehicleKind, direction: Direction, y: number, speed: number): Vehicle {
    const type = VEHICLE_TYPES[kind];
    const vehicle: Vehicle = {
      id: this.nextId,
      kind,
      direction,
      length: type.length,
      width: type.width,
      followingTime: type.followingTime,
      maxAcceleration: type.maxAcceleration,
      comfortableBraking: type.comfortableBraking,
      desiredSpeed: type.desiredSpeed,
      y: wrap(y),
      speed,
      lateral: 0,
      phase: 'cruise',
      maneuver: null,
      nextPlanTime: this.random() * 0.5,
      recovering: false,
    };
    this.nextId += 1;
    this.vehicles.push(vehicle);
    return vehicle;
  }

  private placeInitial(counts: TrafficCounts): void {
    for (const direction of DIRECTIONS) {
      const kinds: VehicleKind[] = [];
      for (const kind of TRAFFIC_KINDS) {
        for (let index = 0; index < counts[kind]; index += 1) {
          kinds.push(kind);
        }
      }
      shuffle(kinds, this.random);
      let start = this.random() * ROAD_LENGTH;
      if (direction === 1) {
        kinds.unshift('user');
        start = 0;
      }
      this.placeSequence(direction, kinds, start);
    }
    this.sortOrdered();
  }

  private placeSequence(direction: Direction, kinds: VehicleKind[], start: number): void {
    if (kinds.length === 0) {
      return;
    }
    const minimumGaps = kinds.map((kind) => VEHICLE_TYPES[kind].followingTime * PLACEMENT_SPEED);
    const used = kinds.reduce((total, kind, index) => total + VEHICLE_TYPES[kind].length + minimumGaps[index], 0);
    const slack = ROAD_LENGTH - used;
    if (slack < 0) {
      throw new Error(`counts need ${used.toFixed(0)} m of road, more than ${ROAD_LENGTH} m`);
    }
    const weights = kinds.map(() => -Math.log(1 - this.random()));
    const weightSum = weights.reduce((total, weight) => total + weight, 0);
    const placed: Vehicle[] = [];
    let front = start;
    kinds.forEach((kind, index) => {
      if (index > 0) {
        const previous = index - 1;
        front += minimumGaps[previous] + (slack * weights[previous]) / weightSum + VEHICLE_TYPES[kind].length;
      }
      if (kind === 'user') {
        this.user.y = wrap(direction * front);
        placed.push(this.user);
      } else {
        placed.push(this.createVehicle(kind, direction, direction * front, 0));
      }
    });
    placed.forEach((vehicle, index) => {
      const leader = placed[(index + 1) % placed.length];
      let speed = vehicle.desiredSpeed;
      if (leader !== vehicle) {
        const gap = forwardDistance(vehicle.y, leader.y, direction) - leader.length;
        speed = Math.min(vehicle.desiredSpeed, leader.desiredSpeed, gap / vehicle.followingTime);
      }
      vehicle.speed = speed;
    });
  }

  private remove(kind: TrafficKind, direction: Direction, count: number): void {
    const candidates = this.vehicles.filter((vehicle) => vehicle.kind === kind && vehicle.direction === direction);
    const hidden = candidates.filter((vehicle) => !this.isVisible(direction, vehicle.y, vehicle.length));
    const shown = candidates.filter((vehicle) => this.isVisible(direction, vehicle.y, vehicle.length));
    shuffle(hidden, this.random);
    shuffle(shown, this.random);
    const doomed = new Set([...hidden, ...shown].slice(0, count));
    for (let index = this.vehicles.length - 1; index >= 0; index -= 1) {
      if (doomed.has(this.vehicles[index])) {
        this.laneIndex.delete(this.vehicles[index]);
        this.vehicles.splice(index, 1);
      }
    }
    this.sortOrdered();
  }

  private insertPending(): void {
    for (const direction of DIRECTIONS) {
      for (const kind of TRAFFIC_KINDS) {
        const key = pendingKey(direction, kind);
        let waiting = this.pending.get(key) ?? 0;
        while (waiting > 0 && this.insertOne(kind, direction)) {
          waiting -= 1;
        }
        this.pending.set(key, waiting);
      }
    }
  }

  private insertOne(kind: TrafficKind, direction: Direction): boolean {
    this.sortOrdered();
    const type = VEHICLE_TYPES[kind];
    const lane = this.orderedLane(direction);
    const candidates: number[] = [];
    if (lane.length === 0) {
      candidates.push(this.random() * ROAD_LENGTH);
    }
    lane.forEach((behind, index) => {
      const ahead = lane[(index + 1) % lane.length];
      let gap = ROAD_LENGTH - behind.length;
      if (ahead !== behind) {
        gap = forwardDistance(behind.y, ahead.y, direction) - ahead.length;
      }
      const newSpeed = Math.min(type.desiredSpeed, ahead.speed);
      const behindNeed = behind.followingTime * behind.speed + INSERT_MARGIN;
      const aheadNeed = type.followingTime * newSpeed + INSERT_MARGIN;
      const spare = gap - behindNeed - type.length - aheadNeed;
      if (spare >= 0) {
        const front = direction * (wrap(direction * behind.y) + behindNeed + type.length + spare / 2);
        candidates.push(wrap(front));
      }
    });
    const allowed = candidates.filter((y) => this.overtakingRules?.blocksInsertion(this, direction, y) !== true);
    const hidden = allowed.filter((y) => !this.isVisible(direction, y, type.length));
    let pool = hidden;
    if (pool.length === 0) {
      pool = allowed;
    }
    if (pool.length === 0) {
      return false;
    }
    const y = pool[Math.floor(this.random() * pool.length)];
    const vehicle = this.createVehicle(kind, direction, y, 0);
    this.sortOrdered();
    const leader = this.homeLaneLeader(vehicle);
    vehicle.speed = vehicle.desiredSpeed;
    if (leader !== null) {
      vehicle.speed = Math.min(vehicle.desiredSpeed, leader.vehicle.speed);
    }
    return true;
  }
}

function pendingKey(direction: Direction, kind: TrafficKind): string {
  return `${direction}:${kind}`;
}

function shuffle<T>(items: T[], random: Random): void {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
}
