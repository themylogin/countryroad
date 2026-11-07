import { describe, expect, it } from 'vitest';
import { isConstrained, LANE_CHANGE_SECONDS, planOvertake } from './overtaking';
import { forwardDistance } from './road';
import { kmh } from './vehicle-types';
import {
  STEP,
  World,
  type OvertakeFinishEvent,
  type OvertakeStartEvent,
  type Vehicle,
  type WorldEvent,
} from './world';

const QUEUE_SPEED = kmh(65);

function emptyWorld(userGap = 6, userSpeed = kmh(80)): World {
  return new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, userSpeed, userGap });
}

function runFor(world: World, seconds: number, onStep: (events: WorldEvent[]) => void = () => {}): WorldEvent[] {
  const all: WorldEvent[] = [];
  const steps = Math.round(seconds / STEP);
  for (let step = 0; step < steps; step += 1) {
    const events = world.step();
    all.push(...events);
    onStep(events);
  }
  return all;
}

function startsOf(events: WorldEvent[], vehicle: Vehicle): OvertakeStartEvent[] {
  return events.filter(
    (event): event is OvertakeStartEvent => event.type === 'overtakeStart' && event.vehicleId === vehicle.id,
  );
}

function finishesOf(events: WorldEvent[], vehicle: Vehicle): OvertakeFinishEvent[] {
  return events.filter(
    (event): event is OvertakeFinishEvent => event.type === 'overtakeFinish' && event.vehicleId === vehicle.id,
  );
}

function carBehindSlowTruck(world: World, front = 5000): { car: Vehicle; truck: Vehicle } {
  const car = world.spawn('car', 1, front, QUEUE_SPEED);
  const truck = world.spawn('slowTruck', 1, front + 60 + 9, QUEUE_SPEED);
  return { car, truck };
}

describe('maneuver state machine', () => {
  it('takes 2.0 s for the lane change out and 2.0 s for the lane change back', () => {
    const world = emptyWorld();
    const { car } = carBehindSlowTruck(world);
    const phaseTimes = new Map<string, number>();
    let previous = car.phase;
    runFor(world, 60, () => {
      if (car.phase !== previous) {
        phaseTimes.set(`${previous}->${car.phase}`, world.time);
        previous = car.phase;
      }
    });
    const out = phaseTimes.get('cruise->out');
    const passing = phaseTimes.get('out->passing');
    const back = phaseTimes.get('passing->back');
    const done = phaseTimes.get('back->cruise');
    if (out === undefined || passing === undefined || back === undefined || done === undefined) {
      throw new Error(`incomplete maneuver: ${[...phaseTimes.keys()].join(', ')}`);
    }
    expect(passing - out).toBeCloseTo(LANE_CHANGE_SECONDS, 6);
    expect(done - back).toBeCloseTo(LANE_CHANGE_SECONDS, 6);
  });

  it('occupies the home lane during the lane change out and leaves it once in the passing lane', () => {
    const world = emptyWorld();
    const { car, truck } = carBehindSlowTruck(world);
    const follower = world.spawn('car', 1, 5000 - 60 - 4.5, QUEUE_SPEED);
    follower.nextPlanTime = Infinity;
    let checkedOut = false;
    let checkedPassing = false;
    runFor(world, 30, () => {
      if (car.phase === 'out' && car.lateral > 0.4 && car.lateral < 0.6 && !checkedOut) {
        expect(world.homeLaneLeader(follower)?.vehicle).toBe(car);
        checkedOut = true;
      }
      if (car.phase === 'passing' && !checkedPassing) {
        expect(world.homeLaneLeader(follower)?.vehicle).toBe(truck);
        checkedPassing = true;
      }
    });
    expect(checkedOut).toBe(true);
    expect(checkedPassing).toBe(true);
  });
});

describe('overtake start', () => {
  it('starts when the oncoming lane is clear', () => {
    const world = emptyWorld();
    const { car } = carBehindSlowTruck(world);
    const events = runFor(world, 1);
    expect(startsOf(events, car)).toHaveLength(1);
  });

  it('stays behind while an oncoming vehicle would be less than 6 s away at the end', () => {
    const world = emptyWorld();
    const { car } = carBehindSlowTruck(world);
    const oncoming = world.spawn('car', -1, 5000 + 1100, kmh(90));
    const early = runFor(world, 15);
    expect(startsOf(early, car)).toHaveLength(0);
    expect(car.lateral).toBe(0);
    const later = runFor(world, 40);
    expect(startsOf(later, car).length).toBeGreaterThan(0);
    const start = startsOf(later, car)[0];
    expect(start.time).toBeGreaterThan(15);
    expect(oncoming.direction).toBe(-1);
  });

  it('waits while another car in the same direction is in the passing lane', () => {
    const world = emptyWorld();
    const { car } = carBehindSlowTruck(world);
    const other = world.spawn('car', 1, 5075, kmh(90));
    other.phase = 'passing';
    other.lateral = 1;
    other.maneuver = { speed: kmh(90), plannedEnd: 20, limit: 6, passedIds: [], laneChangeSteps: 0 };
    let startedWhileBusy = false;
    const events = runFor(world, 40, (stepEvents) => {
      if (startsOf(stepEvents, car).length > 0 && other.maneuver !== null) {
        startedWhileBusy = true;
      }
    });
    expect(startedWhileBusy).toBe(false);
    expect(finishesOf(events, other)).toHaveLength(1);
    expect(startsOf(events, car).length).toBeGreaterThan(0);
  });

  it('keeps a semi behind a slow truck', () => {
    const world = emptyWorld();
    const semi = world.spawn('semi', 1, 5000, QUEUE_SPEED);
    world.spawn('slowTruck', 1, 5000 + 100 + 9, QUEUE_SPEED);
    let maxLateral = 0;
    const events = runFor(world, 60, () => {
      maxLateral = Math.max(maxLateral, semi.lateral);
    });
    expect(maxLateral).toBe(0);
    expect(startsOf(events, semi)).toHaveLength(0);
  });
});

describe('return to the home lane', () => {
  it('returns at least 2 s ahead of the slow truck with the next vehicle at least 3 s ahead', () => {
    const world = emptyWorld();
    const { car, truck } = carBehindSlowTruck(world);
    const events = runFor(world, 60);
    const [finish] = finishesOf(events, car);
    expect(finish).toBeDefined();
    expect(world.homeLaneFollower(car)?.vehicle).toBe(truck);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(2);
    expect(finish.gapAhead).toBeGreaterThanOrEqual(3);
    expect(car.speed).toBeCloseTo(kmh(90), 3);
  });

  it('passes a queue of two cars and a slow truck in one overtake', () => {
    const world = emptyWorld();
    const car = world.spawn('car', 1, 5000, QUEUE_SPEED);
    const first = world.spawn('car', 1, 5000 + 54 + 4.5, QUEUE_SPEED);
    const second = world.spawn('car', 1, 5000 + 2 * (54 + 4.5), QUEUE_SPEED);
    const truck = world.spawn('slowTruck', 1, 5000 + 2 * (54 + 4.5) + 54 + 9, QUEUE_SPEED);
    first.nextPlanTime = Infinity;
    second.nextPlanTime = Infinity;
    const events = runFor(world, 90);
    expect(startsOf(events, car)).toHaveLength(1);
    const [finish] = finishesOf(events, car);
    expect(finish).toBeDefined();
    expect(world.homeLaneFollower(car)?.vehicle).toBe(truck);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(2);
  });
});

describe('oncoming traffic', () => {
  it('overtakes in the right lane by the mirrored rules', () => {
    const world = emptyWorld();
    const car = world.spawn('car', -1, 5000, QUEUE_SPEED);
    const truck = world.spawn('slowTruck', -1, 5000 - 60 - 9, QUEUE_SPEED);
    let reachedPassingLane = false;
    const events = runFor(world, 60, () => {
      if (car.lateral === 1) {
        reachedPassingLane = true;
      }
    });
    expect(reachedPassingLane).toBe(true);
    const [finish] = finishesOf(events, car);
    expect(finish).toBeDefined();
    expect(car.lateral).toBe(0);
    expect(world.homeLaneFollower(car)?.vehicle).toBe(truck);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(2);
  });
});

function userBehindSlowTruck(userGap: number, oncomingDistance: number): World {
  const world = emptyWorld(userGap, kmh(130));
  world.user.y = 0;
  world.user.speed = QUEUE_SPEED;
  world.spawn('slowTruck', 1, 60 + 9, QUEUE_SPEED);
  world.spawn('car', -1, oncomingDistance, kmh(90));
  return world;
}

describe('user car', () => {
  it('refuses a 3 s oncoming gap at 6.0 s and accepts it at 1.0 s, with at least 1.0 s at return', () => {
    const careful = userBehindSlowTruck(6, 750);
    expect(startsOf(runFor(careful, 4), careful.user)).toHaveLength(0);

    const bold = userBehindSlowTruck(1, 750);
    const events = runFor(bold, 30);
    expect(startsOf(events, bold.user)).toHaveLength(1);
    const [finish] = finishesOf(events, bold.user);
    expect(finish).toBeDefined();
    expect(finish.limit).toBe(1);
    expect(finish.timeToMeet).toBeGreaterThanOrEqual(1);
    expect(finish.timeToMeet).toBeLessThan(6);
  });

  it('allows every 6.0 s overtake at 1.0 s too, and some only at 1.0 s, in the same situations', () => {
    const world = new World({ seed: 5, counts: { car: 15, semi: 3, slowTruck: 2 }, userSpeed: kmh(130), userGap: 6 });
    let bothOrNeither = 0;
    let onlyAtOne = 0;
    let onlyAtSix = 0;
    for (let second = 0; second < 30 * 60; second += 1) {
      runFor(world, 1);
      if (world.user.phase !== 'cruise' || !isConstrained(world, world.user)) {
        continue;
      }
      world.setUserGap(6);
      const careful = planOvertake(world, world.user) !== null;
      world.setUserGap(1);
      const bold = planOvertake(world, world.user) !== null;
      world.setUserGap(6);
      if (careful && !bold) {
        onlyAtSix += 1;
      } else if (bold && !careful) {
        onlyAtOne += 1;
      } else {
        bothOrNeither += 1;
      }
    }
    expect(onlyAtSix).toBe(0);
    expect(onlyAtOne).toBeGreaterThan(0);
    expect(bothOrNeither).toBeGreaterThan(0);
  }, 120_000);

  it('keeps the overtaking speed when the user lowers the speed during an overtake', () => {
    const world = emptyWorld(6, kmh(150));
    world.user.y = 0;
    world.user.speed = kmh(90);
    world.spawn('car', 1, 75 + 4.5, kmh(90)).nextPlanTime = Infinity;
    let lowered = false;
    let largestDrop = 0;
    let previousSpeed = world.user.speed;
    let speedAtFinish = 0;
    runFor(world, 40, (events) => {
      if (world.user.maneuver !== null && lowered) {
        largestDrop = Math.max(largestDrop, previousSpeed - world.user.speed);
      }
      if (startsOf(events, world.user).length > 0) {
        world.setUserSpeed(kmh(100));
        lowered = true;
      }
      previousSpeed = world.user.speed;
      if (finishesOf(events, world.user).length > 0) {
        speedAtFinish = world.user.speed;
      }
    });
    expect(lowered).toBe(true);
    expect(speedAtFinish).toBeCloseTo(kmh(150), 3);
    expect(largestDrop).toBe(0);
    expect(world.user.speed).toBeLessThan(kmh(110));
    expect(world.user.speed).toBeGreaterThanOrEqual(kmh(100) - 0.1);
  });
});

describe('user speed changes during an overtake', () => {
  it('keeps the overtaking speed when the user raises the speed during an overtake', () => {
    const world = emptyWorld(6, kmh(130));
    world.user.y = 0;
    world.user.speed = kmh(90);
    world.spawn('car', 1, 75 + 4.5, kmh(90)).nextPlanTime = Infinity;
    let raised = false;
    let fastestDuringManeuver = 0;
    let speedAtFinish = 0;
    runFor(world, 40, (events) => {
      if (world.user.maneuver !== null && raised) {
        fastestDuringManeuver = Math.max(fastestDuringManeuver, world.user.speed);
        expect(world.user.desiredSpeed).toBeCloseTo(kmh(130), 9);
      }
      if (startsOf(events, world.user).length > 0) {
        world.setUserSpeed(kmh(180));
        raised = true;
      }
      if (finishesOf(events, world.user).length > 0) {
        speedAtFinish = world.user.speed;
      }
    });
    expect(raised).toBe(true);
    expect(fastestDuringManeuver).toBeLessThanOrEqual(kmh(130) + 1e-9);
    expect(speedAtFinish).toBeCloseTo(kmh(130), 3);
    expect(world.user.desiredSpeed).toBeCloseTo(kmh(180), 9);
    expect(world.user.speed).toBeGreaterThan(kmh(140));
  });

  it('keeps the old speed while another car passes the user car', () => {
    const world = emptyWorld(6, kmh(80));
    world.user.y = 0;
    world.user.speed = kmh(80);
    const passer = world.spawn('car', 1, 10_000 - 80, kmh(90));
    let raised = false;
    let heldWhilePassed = true;
    const events = runFor(world, 60, (stepEvents) => {
      if (passer.maneuver !== null && raised && world.user.desiredSpeed !== kmh(80)) {
        heldWhilePassed = false;
      }
      if (startsOf(stepEvents, passer).length > 0) {
        world.setUserSpeed(kmh(180));
        raised = true;
      }
    });
    expect(raised).toBe(true);
    expect(heldWhilePassed).toBe(true);
    const [finish] = finishesOf(events, passer);
    expect(finish).toBeDefined();
    expect(finish.gapBehind).toBeGreaterThanOrEqual(2);
    expect(world.user.desiredSpeed).toBeCloseTo(kmh(180), 9);
  });
});

describe('insertion during an overtake', () => {
  it('adds new cars outside the 3 km ahead of an active overtaker, in both directions', () => {
    const world = emptyWorld();
    const { car } = carBehindSlowTruck(world);
    runFor(world, 1);
    expect(car.maneuver).not.toBeNull();
    const before = new Set(world.vehicles.map((vehicle) => vehicle.id));
    world.setCount('car', 30);
    const added = world.vehicles.filter((vehicle) => !before.has(vehicle.id));
    expect(world.countOf('car', 1)).toBe(30);
    expect(world.countOf('car', -1)).toBe(30);
    expect(added.length).toBe(59);
    for (const vehicle of added) {
      const ahead = forwardDistance(car.y, vehicle.y, car.direction);
      expect(ahead).toBeGreaterThan(3000);
      expect(10_000 - ahead).toBeGreaterThan(200);
    }
  });
});
