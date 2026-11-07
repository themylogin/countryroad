import { ROAD_LENGTH, wrap } from './road';
import { MAX_BRAKING } from './vehicle-types';
import { STEP, World, type Vehicle, type WorldOptions } from './world';

type Lane = 'right' | 'left';

interface Footprint {
  readonly vehicle: Vehicle;
  readonly start: number;
  readonly end: number;
}

const TOLERANCE = 1e-6;
const MAX_REPORTED = 20;

export class InvariantMonitor {
  readonly violations: string[] = [];
  private readonly previousSpeeds = new Map<Vehicle, number>();
  private readonly previousLimits = new Map<Vehicle, number>();

  constructor(private readonly world: World) {
    this.remember();
  }

  check(): void {
    this.checkOverlaps();
    this.checkSpeeds();
    this.remember();
  }

  private report(message: string): void {
    if (this.violations.length < MAX_REPORTED) {
      this.violations.push(`t=${this.world.time.toFixed(2)}s ${message}`);
    }
  }

  private checkOverlaps(): void {
    const lanes = new Map<Lane, Footprint[]>([
      ['right', []],
      ['left', []],
    ]);
    for (const vehicle of this.world.vehicles) {
      const footprint = footprintOf(vehicle);
      for (const lane of lanesOf(vehicle)) {
        lanes.get(lane)?.push(footprint);
      }
    }
    for (const [lane, footprints] of lanes) {
      footprints.sort((a, b) => a.start - b.start);
      footprints.forEach((footprint, index) => {
        if (footprints.length < 2) {
          return;
        }
        const next = footprints[(index + 1) % footprints.length];
        let nextStart = next.start;
        if (index === footprints.length - 1) {
          nextStart += ROAD_LENGTH;
        }
        if (nextStart < footprint.end - TOLERANCE) {
          this.report(
            `overlap in the ${lane} lane: ${describe(footprint.vehicle)} and ${describe(next.vehicle)} by ${(footprint.end - nextStart).toFixed(2)} m`,
          );
        }
      });
    }
  }

  private checkSpeeds(): void {
    for (const vehicle of this.world.vehicles) {
      const limit = this.world.effectiveDesiredSpeed(vehicle);
      const previous = this.previousSpeeds.get(vehicle);
      if (previous === undefined) {
        if (vehicle.speed > limit + TOLERANCE) {
          this.report(`${describe(vehicle)} starts at ${vehicle.speed.toFixed(3)} m/s above its limit ${limit.toFixed(3)} m/s`);
        }
        continue;
      }
      const stepLimit = Math.max(limit, this.previousLimits.get(vehicle) ?? limit);
      if (vehicle.speed > stepLimit + TOLERANCE && vehicle.speed > previous + TOLERANCE) {
        this.report(`${describe(vehicle)} speeds up to ${vehicle.speed.toFixed(3)} m/s above its limit ${stepLimit.toFixed(3)} m/s`);
      }
      const acceleration = (vehicle.speed - previous) / STEP;
      if (acceleration > vehicle.maxAcceleration + TOLERANCE) {
        this.report(`${describe(vehicle)} accelerates at ${acceleration.toFixed(3)} m/s²`);
      }
      if (acceleration < -MAX_BRAKING - TOLERANCE) {
        this.report(`${describe(vehicle)} brakes at ${(-acceleration).toFixed(3)} m/s²`);
      }
    }
  }

  private remember(): void {
    this.previousSpeeds.clear();
    this.previousLimits.clear();
    for (const vehicle of this.world.vehicles) {
      this.previousSpeeds.set(vehicle, vehicle.speed);
      this.previousLimits.set(vehicle, this.world.effectiveDesiredSpeed(vehicle));
    }
  }
}

function lanesOf(vehicle: Vehicle): Lane[] {
  let home: Lane = 'right';
  let passing: Lane = 'left';
  if (vehicle.direction === -1) {
    home = 'left';
    passing = 'right';
  }
  const lanes: Lane[] = [];
  if (vehicle.lateral < 1) {
    lanes.push(home);
  }
  if (vehicle.lateral > 0) {
    lanes.push(passing);
  }
  return lanes;
}

function footprintOf(vehicle: Vehicle): Footprint {
  let start = wrap(vehicle.y - vehicle.length);
  if (vehicle.direction === -1) {
    start = vehicle.y;
  }
  return { vehicle, start, end: start + vehicle.length };
}

function describe(vehicle: Vehicle): string {
  return `${vehicle.kind}#${vehicle.id} (dir ${vehicle.direction}, y ${vehicle.y.toFixed(1)}, lateral ${vehicle.lateral.toFixed(2)})`;
}

export interface LongRunResult {
  readonly violations: string[];
  readonly badReturns: string[];
  readonly starts: number;
  readonly finishes: number;
}

const LATE_TOLERANCE = 0.1;

export function runLong(options: WorldOptions, seconds: number): LongRunResult {
  const world = new World(options);
  const monitor = new InvariantMonitor(world);
  const badReturns: string[] = [];
  let starts = 0;
  let finishes = 0;
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps; step += 1) {
    for (const event of world.step()) {
      if (event.type === 'overtakeStart') {
        starts += 1;
        continue;
      }
      finishes += 1;
      const problems: string[] = [];
      if (event.gapBehind !== null && event.gapBehind < event.behindLimit - TOLERANCE) {
        problems.push(`gap behind ${event.gapBehind.toFixed(2)} s`);
      }
      if (event.gapAhead !== null && event.gapAhead < event.aheadLimit - TOLERANCE) {
        problems.push(`gap ahead ${event.gapAhead.toFixed(2)} s`);
      }
      if (event.timeToMeet !== null && event.timeToMeet < event.limit - TOLERANCE) {
        problems.push(`time to meet ${event.timeToMeet.toFixed(2)} s below ${event.limit} s`);
      }
      if (event.lateBy > LATE_TOLERANCE) {
        problems.push(`${event.lateBy.toFixed(2)} s later than planned`);
      }
      if (problems.length > 0 && badReturns.length < MAX_REPORTED) {
        badReturns.push(`t=${event.time.toFixed(2)}s vehicle ${event.vehicleId}: ${problems.join(', ')}`);
      }
    }
    monitor.check();
  }
  return { violations: monitor.violations, badReturns, starts, finishes };
}
