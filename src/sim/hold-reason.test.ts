import { describe, expect, it } from 'vitest';
import { acceleratingMotion, overtakingRules, strongerHold, type Hold } from './overtaking';
import { userSettings } from './test-support';
import { kmh, VEHICLE_TYPES, type TrafficKind } from './vehicle-types';
import { World, type UserSettings, type Vehicle } from './world';

const TRUCK_SPEED = kmh(65);
const SLOWEST_PAST_TRUCK = kmh(130) - 12 * kmh(5);
const CAR_SPEED = kmh(90);

function userWorld(userSpeed: number, overrides: Partial<UserSettings> = {}): World {
  const world = new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings(overrides) });
  world.user.y = 0;
  world.user.speed = userSpeed;
  return world;
}

function queue(world: World, kinds: readonly TrafficKind[], firstGap: number, gap: number, speed: number): Vehicle[] {
  const vehicles: Vehicle[] = [];
  let rear = firstGap;
  for (const kind of kinds) {
    const vehicle = world.spawn(kind, 1, rear + VEHICLE_TYPES[kind].length, speed);
    vehicles.push(vehicle);
    rear = vehicle.y + gap;
  }
  return vehicles;
}

function twoCarsAhead(space: number, overrides: Partial<UserSettings> = {}): World {
  const world = userWorld(CAR_SPEED, overrides);
  queue(world, ['car', 'car'], 75.5, space, CAR_SPEED);
  return world;
}

function shortestOvertakeNeed(oncomingGap: number): number {
  const motion = acceleratingMotion(TRUCK_SPEED, SLOWEST_PAST_TRUCK, VEHICLE_TYPES.user.maxAcceleration);
  return motion.distance(4) + kmh(90) * 4 + oncomingGap * (motion.speed(4) + kmh(90));
}

function decide(world: World): Hold | null {
  world.user.nextPlanTime = world.time;
  overtakingRules.maybeStart(world, world.user, []);
  return world.user.hold;
}

function expectGapHold(hold: Hold | null, reason: 'oncoming' | 'noGap' | 'tooClose'): { gap: number; need: number } {
  if (hold === null || hold.reason !== reason || !('gap' in hold)) {
    throw new Error(`expected ${reason}, got ${JSON.stringify(hold)}`);
  }
  return hold;
}

describe('hold reason of the user car', () => {
  it('is notSlower behind a car at My speed', () => {
    const world = userWorld(kmh(90), { speed: kmh(90) });
    queue(world, ['car'], 60, 0, kmh(90));
    expect(decide(world)).toEqual({ reason: 'notSlower' });
  });

  it('is canReachSpeed behind a car that can speed up to the highest overtaking speed', () => {
    const world = userWorld(kmh(70), { speed: kmh(90), overtakingSpeed: kmh(80) });
    queue(world, ['car'], 50, 0, kmh(70));
    expect(decide(world)).toEqual({ reason: 'canReachSpeed' });
  });

  it('is queueTooLong behind a tight queue of 13 vehicles', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, [...Array<TrafficKind>(12).fill('car'), 'slowTruck'], 40, 30, TRUCK_SPEED);
    expect(decide(world)).toEqual({ reason: 'queueTooLong' });
  });

  it('is noGap with the space between two cars at 90 km/h and the space needed, in seconds at their speed', () => {
    const hold = expectGapHold(decide(twoCarsAhead(125)), 'noGap');
    expect(hold.gap).toBeCloseTo(5, 9);
    expect(hold.need).toBeGreaterThan(5);
    expect(hold.need).toBeLessThan(6);
  });

  it('returns when the space is just above the need, and not when it is just below', () => {
    const need = expectGapHold(decide(twoCarsAhead(125)), 'noGap').need * CAR_SPEED;
    const above = twoCarsAhead(need + 1.5);
    expect(decide(above)).toBeNull();
    expect(above.user.maneuver).not.toBeNull();
    expect(decide(twoCarsAhead(need - 0.5))?.reason).toBe('noGap');
  });

  it('lowers the need when the return following distance is 1.0 s shorter', () => {
    const needAt = (returnFollowingTime: number): number =>
      expectGapHold(decide(twoCarsAhead(90, { returnFollowingTime })), 'noGap').need;
    expect(needAt(1)).toBeLessThan(needAt(2) - 1);
  });

  it('keeps the need when the braking room sets it and the return following distance changes', () => {
    const needAt = (returnFollowingTime: number): number => {
      const world = userWorld(kmh(170), { speed: kmh(170), overtakingSpeed: kmh(180), returnFollowingTime });
      queue(world, ['slowTruck', 'slowTruck'], 150, 40, TRUCK_SPEED);
      const hold = expectGapHold(decide(world), 'noGap');
      expect(hold.gap).toBeLessThan(hold.need);
      return hold.need;
    };
    expect(needAt(1)).toBeCloseTo(needAt(2), 9);
  });

  it('is tooClose 3 m behind a slow truck, with the need that leaves 2 m after the lane change out', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['slowTruck'], 3, 0, TRUCK_SPEED);
    const hold = expectGapHold(decide(world), 'tooClose');
    const travelled = acceleratingMotion(TRUCK_SPEED, SLOWEST_PAST_TRUCK, VEHICLE_TYPES.user.maxAcceleration).distance(2);
    const truckTravelled = (TRUCK_SPEED - 0.3) * 2;
    expect(hold.gap).toBeCloseTo(3, 9);
    expect(hold.need).toBeCloseTo(travelled - truckTravelled + 2, 9);
  });

  it('is tooLong at 85 km/h behind a semi at 80 km/h', () => {
    const world = userWorld(kmh(80), { speed: kmh(85), overtakingSpeed: kmh(80) });
    queue(world, ['semi'], 60, 0, kmh(80));
    const hold = decide(world);
    if (hold === null || hold.reason !== 'tooLong') {
      throw new Error(`expected tooLong, got ${JSON.stringify(hold)}`);
    }
    expect(hold.speed).toBeCloseTo(kmh(85), 9);
  });

  it('is laneBusy while another car passes the user car', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['slowTruck'], 60, 0, TRUCK_SPEED);
    const passer = world.spawn('car', 1, 10_000 - 80, kmh(90));
    passer.nextPlanTime = 0;
    world.user.nextPlanTime = Infinity;
    world.step();
    expect(passer.maneuver).not.toBeNull();
    expect(decide(world)).toEqual({ reason: 'laneBusy' });
  });

  it('uses the need of the overtake past the whole queue while the shortest overtake check fails', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['car', 'car', 'slowTruck'], 40, 30, TRUCK_SPEED);
    world.spawn('car', -1, 300, kmh(90));
    expect(shortestOvertakeNeed(6)).toBeGreaterThan(300);
    const hold = expectGapHold(decide(world), 'oncoming');
    expect(hold.gap).toBe(300);
    expect(hold.need).toBeGreaterThan(shortestOvertakeNeed(6) + 500);
  });

  it('keeps the numbers of the shortest overtake when no return slot has room', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['car', 'car', 'slowTruck', 'slowTruck'], 40, 30, TRUCK_SPEED);
    world.spawn('car', -1, 400, kmh(90));
    const hold = expectGapHold(decide(world), 'oncoming');
    expect(hold.gap).toBe(400);
    expect(hold.need).toBeCloseTo(shortestOvertakeNeed(6), 9);
  });

  it('lowers the oncoming need by the gap change times the sum of both speeds', () => {
    const needAt = (oncomingGap: number): number => {
      const world = userWorld(TRUCK_SPEED, { oncomingGap });
      queue(world, ['car', 'car', 'slowTruck', 'slowTruck'], 40, 30, TRUCK_SPEED);
      world.spawn('car', -1, 250, kmh(90));
      return expectGapHold(decide(world), 'oncoming').need;
    };
    expect(needAt(6) - needAt(3)).toBeCloseTo(shortestOvertakeNeed(6) - shortestOvertakeNeed(3), 9);
  });

  it('is oncoming at 0 m away while an oncoming vehicle is alongside', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['slowTruck'], 60, 0, TRUCK_SPEED);
    world.spawn('car', -1, 10_000 - 3, kmh(90));
    const hold = expectGapHold(decide(world), 'oncoming');
    expect(hold.gap).toBe(0);
    expect(hold.need).toBeGreaterThan(0);
  });

  it('shows the oncoming reason of the whole-queue slot, not the noGap of the shorter slots', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['car', 'car', 'slowTruck'], 40, 30, TRUCK_SPEED);
    world.spawn('car', -1, 800, kmh(90));
    const motion = acceleratingMotion(TRUCK_SPEED, SLOWEST_PAST_TRUCK, VEHICLE_TYPES.user.maxAcceleration);
    const earlyGap = (800 - motion.distance(4) - kmh(90) * 4) / (motion.speed(4) + kmh(90));
    expect(earlyGap).toBeGreaterThan(6.05);
    const hold = expectGapHold(decide(world), 'oncoming');
    expect(hold.gap).toBe(800);
    expect(hold.need).toBeGreaterThan(800);
  });

  it('is null on a free road and behind a vehicle beyond the following distance plus 20 m', () => {
    const free = userWorld(TRUCK_SPEED);
    expect(decide(free)).toBeNull();
    const far = userWorld(TRUCK_SPEED);
    queue(far, ['slowTruck'], 200, 0, TRUCK_SPEED);
    expect(decide(far)).toBeNull();
  });

  it('is null from the start of the overtake until the next decision after its end', () => {
    const world = userWorld(TRUCK_SPEED);
    queue(world, ['slowTruck'], 60, 0, TRUCK_SPEED);
    world.spawn('car', -1, 400, kmh(90));
    let sawOncoming = false;
    let started = false;
    let heldDuringOvertake = false;
    let finishedAt: number | null = null;
    let heldBeforeNextDecision = false;
    for (let step = 0; step < 60 * 90 && finishedAt === null; step += 1) {
      const wasCruising = world.user.phase === 'cruise';
      const events = world.step();
      if (world.user.hold?.reason === 'oncoming') {
        sawOncoming = true;
      }
      if (world.user.phase !== 'cruise') {
        started = true;
        heldDuringOvertake ||= world.user.hold !== null;
      }
      if (!wasCruising && events.some((event) => event.type === 'overtakeFinish' && event.vehicleId === world.user.id)) {
        finishedAt = world.time;
      }
    }
    expect(sawOncoming).toBe(true);
    expect(started).toBe(true);
    expect(heldDuringOvertake).toBe(false);
    expect(finishedAt).not.toBeNull();
    const nextDecision = world.user.nextPlanTime;
    while (world.time < nextDecision - 1e-9) {
      world.step();
      heldBeforeNextDecision ||= world.user.hold !== null;
    }
    expect(heldBeforeNextDecision).toBe(false);
  });
});

describe('strongerHold', () => {
  const noGap: Hold = { reason: 'noGap', gap: 1, need: 2 };
  const oncomingFar: Hold = { reason: 'oncoming', gap: 800, need: 1120 };
  const oncomingNear: Hold = { reason: 'oncoming', gap: 600, need: 1100 };

  it('prefers the higher priority in either order', () => {
    expect(strongerHold(noGap, oncomingNear)).toBe(oncomingNear);
    expect(strongerHold(oncomingNear, noGap)).toBe(oncomingNear);
  });

  it('prefers the try closer to its need for the same reason', () => {
    expect(strongerHold(oncomingNear, oncomingFar)).toBe(oncomingFar);
    expect(strongerHold(oncomingFar, oncomingNear)).toBe(oncomingFar);
  });

  it('prefers the higher speed for tooLong', () => {
    const slow: Hold = { reason: 'tooLong', speed: kmh(85) };
    const fast: Hold = { reason: 'tooLong', speed: kmh(90) };
    expect(strongerHold(slow, fast)).toBe(fast);
    expect(strongerHold(fast, slow)).toBe(fast);
  });

  it('keeps the other hold when one is null', () => {
    expect(strongerHold(null, noGap)).toBe(noGap);
    expect(strongerHold(noGap, null)).toBe(noGap);
    expect(strongerHold(null, null)).toBeNull();
  });
});
