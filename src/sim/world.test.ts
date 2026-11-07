import { describe, expect, it } from 'vitest';
import { forwardDistance, type Direction } from './road';
import { kmh, TRAFFIC_KINDS } from './vehicle-types';
import { DIRECTIONS, STEP, World, type TrafficCounts, type Vehicle } from './world';
import { userSettings } from './test-support';

const DEFAULT_COUNTS: TrafficCounts = { car: 15, semi: 3, slowTruck: 2 };
const MAX_COUNTS: TrafficCounts = { car: 100, semi: 20, slowTruck: 10 };

function createWorld(counts: TrafficCounts, seed = 1): World {
  return new World({ seed, counts, user: userSettings({ speed: kmh(130), oncomingGap: 6 }), overtaking: false });
}

function run(world: World, seconds: number): void {
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps; step += 1) {
    world.step();
  }
}

function inForwardOrder(world: World, direction: Direction): Vehicle[] {
  const lane = world.vehicles.filter((vehicle) => vehicle.direction === direction);
  return lane.sort((a, b) => forwardDistance(0, a.y, direction) - forwardDistance(0, b.y, direction));
}

function gaps(world: World, direction: Direction): { follower: Vehicle; gap: number }[] {
  const lane = inForwardOrder(world, direction);
  return lane.map((follower, index) => {
    const leader = lane[(index + 1) % lane.length];
    return { follower, gap: forwardDistance(follower.y, leader.y, direction) - leader.length };
  });
}

describe('initial placement', () => {
  it('puts every vehicle in its home lane', () => {
    const world = createWorld(DEFAULT_COUNTS);
    for (const vehicle of world.vehicles) {
      expect(vehicle.lateral).toBe(0);
      expect(vehicle.phase).toBe('cruise');
    }
  });

  it('places the default counts in each direction, plus the user car', () => {
    const world = createWorld(DEFAULT_COUNTS);
    for (const direction of DIRECTIONS) {
      for (const kind of TRAFFIC_KINDS) {
        expect(world.countOf(kind, direction)).toBe(DEFAULT_COUNTS[kind]);
      }
    }
    expect(world.vehicles.filter((vehicle) => vehicle.kind === 'user')).toHaveLength(1);
    expect(world.user.direction).toBe(1);
  });

  it('leaves at least the following time at 65 km/h in every gap, at maximum counts', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const world = createWorld(MAX_COUNTS, seed);
      for (const direction of DIRECTIONS) {
        for (const { follower, gap } of gaps(world, direction)) {
          expect(gap).toBeGreaterThanOrEqual(follower.followingTime * kmh(65) - 1e-6);
        }
      }
    }
  });

  it('places the same scene for the same seed', () => {
    const first = createWorld(DEFAULT_COUNTS, 9).vehicles.map((vehicle) => [vehicle.kind, vehicle.y]);
    const second = createWorld(DEFAULT_COUNTS, 9).vehicles.map((vehicle) => [vehicle.kind, vehicle.y]);
    expect(second).toEqual(first);
  });
});

describe('step loop', () => {
  it('keeps the counts constant over 10 simulated minutes', () => {
    const world = createWorld(DEFAULT_COUNTS);
    run(world, 600);
    for (const direction of DIRECTIONS) {
      for (const kind of TRAFFIC_KINDS) {
        expect(world.countOf(kind, direction)).toBe(DEFAULT_COUNTS[kind]);
      }
    }
  });

  it('lets a vehicle on a free road reach and keep its desired speed', () => {
    const world = createWorld({ car: 1, semi: 0, slowTruck: 0 });
    run(world, 60);
    for (const vehicle of world.vehicles) {
      expect(vehicle.speed).toBeCloseTo(vehicle.desiredSpeed, 3);
    }
    run(world, 60);
    for (const vehicle of world.vehicles) {
      expect(vehicle.speed).toBeCloseTo(vehicle.desiredSpeed, 3);
    }
  });

  it('moves the user direction toward higher positions and oncoming traffic toward lower ones', () => {
    const world = createWorld({ car: 1, semi: 0, slowTruck: 0 });
    const before = world.vehicles.map((vehicle) => vehicle.y);
    run(world, 1);
    world.vehicles.forEach((vehicle, index) => {
      const moved = forwardDistance(before[index], vehicle.y, vehicle.direction);
      expect(moved).toBeGreaterThan(0);
      expect(moved).toBeLessThan(60);
    });
  });
});

function neighborsOf(world: World, vehicle: Vehicle): { gapAhead: number; behind: Vehicle; gapBehind: number } {
  const lane = inForwardOrder(world, vehicle.direction);
  const index = lane.indexOf(vehicle);
  const ahead = lane[(index + 1) % lane.length];
  const behind = lane[(index - 1 + lane.length) % lane.length];
  return {
    gapAhead: forwardDistance(vehicle.y, ahead.y, vehicle.direction) - ahead.length,
    behind,
    gapBehind: forwardDistance(behind.y, vehicle.y, vehicle.direction) - vehicle.length,
  };
}

describe('count changes', () => {
  it('adds vehicles outside the visible road with following distances on both sides', () => {
    const world = createWorld(DEFAULT_COUNTS);
    run(world, 30);
    const before = new Set(world.vehicles.map((vehicle) => vehicle.id));
    world.setCount('car', 60);
    for (const direction of DIRECTIONS) {
      expect(world.countOf('car', direction)).toBe(60);
    }
    const added = world.vehicles.filter((vehicle) => !before.has(vehicle.id));
    expect(added).toHaveLength(90);
    for (const vehicle of added) {
      expect(world.isVisible(vehicle.direction, vehicle.y, vehicle.length)).toBe(false);
      const { gapAhead, behind, gapBehind } = neighborsOf(world, vehicle);
      expect(gapAhead).toBeGreaterThanOrEqual(vehicle.followingTime * vehicle.speed);
      expect(gapBehind).toBeGreaterThanOrEqual(behind.followingTime * behind.speed);
    }
  });

  it('removes hidden vehicles first and keeps the visible ones', () => {
    const world = createWorld(DEFAULT_COUNTS);
    run(world, 30);
    const visibleCars = world.vehicles.filter(
      (vehicle) => vehicle.kind === 'car' && world.isVisible(vehicle.direction, vehicle.y, vehicle.length),
    );
    world.setCount('car', 10);
    for (const direction of DIRECTIONS) {
      expect(world.countOf('car', direction)).toBe(10);
    }
    for (const vehicle of visibleCars) {
      expect(world.vehicles).toContain(vehicle);
    }
  });

  it('never removes the user car', () => {
    const world = createWorld(DEFAULT_COUNTS);
    world.setCount('car', 0);
    world.setCount('semi', 0);
    world.setCount('slowTruck', 0);
    expect(world.vehicles).toEqual([world.user]);
  });

  it('keeps vehicles that do not fit pending and adds them once room appears', () => {
    const world = createWorld(MAX_COUNTS);
    world.setCount('semi', 40);
    const waiting = world.pendingCount('semi', 1);
    expect(waiting).toBeGreaterThan(0);
    expect(world.countOf('semi', 1) + waiting).toBe(40);
    world.setCount('car', 0);
    run(world, 1.1);
    expect(world.pendingCount('semi', 1)).toBe(0);
    expect(world.countOf('semi', 1)).toBe(40);
  });

  it('applies count changes at once while no step runs', () => {
    const world = createWorld(DEFAULT_COUNTS);
    world.setCount('slowTruck', 9);
    for (const direction of DIRECTIONS) {
      expect(world.countOf('slowTruck', direction)).toBe(9);
    }
  });
});

describe('trip counters', () => {
  it('adds the distance that the user car drives', () => {
    const world = createWorld({ car: 0, semi: 0, slowTruck: 0 });
    run(world, 60);
    expect(world.userDistance).toBeCloseTo(60 * kmh(130), 3);
  });

  it('counts each finished overtake of the user car once', () => {
    const world = new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings() });
    world.user.y = 0;
    world.user.speed = kmh(65);
    world.spawn('slowTruck', 1, 69, kmh(65));
    world.spawn('slowTruck', 1, 1500, kmh(65));
    let finishes = 0;
    for (let step = 0; step < Math.round(120 / STEP); step += 1) {
      finishes += world
        .step()
        .filter((event) => event.type === 'overtakeFinish' && event.vehicleId === world.user.id).length;
    }
    expect(finishes).toBeGreaterThanOrEqual(2);
    expect(world.userOvertakes).toBe(finishes);
  });

  it('changes nothing while no step runs', () => {
    const world = createWorld(DEFAULT_COUNTS);
    run(world, 10);
    const distance = world.userDistance;
    const overtakes = world.userOvertakes;
    const time = world.time;
    world.setCount('car', 30);
    world.setUser({ speed: kmh(90) });
    expect(world.userDistance).toBe(distance);
    expect(world.userOvertakes).toBe(overtakes);
    expect(world.time).toBe(time);
  });
});
