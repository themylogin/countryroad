import { describe, expect, it } from 'vitest';
import { brakingRoom, isConstrained, LANE_CHANGE_SECONDS, planOvertake } from './overtaking';
import { forwardDistance } from './road';
import { userSettings } from './test-support';
import { kmh } from './vehicle-types';
import {
  STEP,
  World,
  type OvertakeFinishEvent,
  type OvertakeStartEvent,
  type UserSettings,
  type Vehicle,
  type WorldEvent,
} from './world';

const QUEUE_SPEED = kmh(65);

function emptyWorld(userGap = 6, userSpeed = kmh(80)): World {
  return new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings({ speed: userSpeed, oncomingGap: userGap }) });
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
    other.maneuver = { speed: kmh(90), plannedEnd: 20, limit: 6, behindTime: 2, aheadTime: 3, passedIds: [], lastPassedId: -1, laneChangeSteps: 0 };
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
    const world = new World({ seed: 5, counts: { car: 15, semi: 3, slowTruck: 2 }, user: userSettings({ speed: kmh(130), oncomingGap: 6 }) });
    let bothOrNeither = 0;
    let onlyAtOne = 0;
    let onlyAtSix = 0;
    for (let second = 0; second < 30 * 60; second += 1) {
      runFor(world, 1);
      if (world.user.phase !== 'cruise' || !isConstrained(world, world.user)) {
        continue;
      }
      world.setUser({ oncomingGap: 6 });
      const careful = planOvertake(world, world.user).kind === 'plan';
      world.setUser({ oncomingGap: 1 });
      const bold = planOvertake(world, world.user).kind === 'plan';
      world.setUser({ oncomingGap: 6 });
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
        world.setUser({ speed: kmh(100) });
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
        world.setUser({ speed: kmh(180) });
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
        world.setUser({ speed: kmh(180) });
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

describe('user overtaking settings', () => {
  function userBehindSemi(settings: Partial<UserSettings>): World {
    const world = new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings(settings) });
    world.user.y = 0;
    world.user.speed = kmh(80);
    world.spawn('semi', 1, 3 * kmh(80) + 16.5, kmh(80));
    return world;
  }

  it('passes at the overtaking speed when it is above my speed, then slows back', () => {
    const world = userBehindSemi({ speed: kmh(100), overtakingSpeed: kmh(150) });
    let maneuverSpeed = 0;
    let fastest = 0;
    const events = runFor(world, 60, () => {
      if (world.user.maneuver !== null) {
        maneuverSpeed = world.user.maneuver.speed;
        fastest = Math.max(fastest, world.user.speed);
      }
    });
    expect(finishesOf(events, world.user)).toHaveLength(1);
    expect(maneuverSpeed).toBeCloseTo(kmh(150), 9);
    expect(fastest).toBeGreaterThan(kmh(140));
    expect(fastest).toBeLessThanOrEqual(kmh(150) + 1e-9);
    expect(world.user.desiredSpeed).toBeCloseTo(kmh(100), 9);
    expect(world.user.speed).toBeLessThanOrEqual(kmh(100) + 0.1);
  });

  it('passes at my speed when the overtaking speed is lower', () => {
    const world = userBehindSemi({ speed: kmh(130), overtakingSpeed: kmh(100) });
    let maneuverSpeed = 0;
    runFor(world, 30, () => {
      if (world.user.maneuver !== null) {
        maneuverSpeed = world.user.maneuver.speed;
      }
    });
    expect(maneuverSpeed).toBeCloseTo(kmh(130), 9);
  });

  it('keeps a running overtake on its old settings and uses new settings for the next one', () => {
    const world = userBehindSemi({ speed: kmh(100), overtakingSpeed: kmh(130) });
    world.spawn('slowTruck', 1, 1000, kmh(65));
    const startSpeeds: number[] = [];
    let changed = false;
    const events = runFor(world, 180, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null) {
        startSpeeds.push(world.user.maneuver.speed);
        if (!changed) {
          world.setUser({ overtakingSpeed: kmh(160), oncomingGap: 2, returnFollowingTime: 1, cutInGap: 1 });
          changed = true;
        }
      }
    });
    const finishes = finishesOf(events, world.user);
    expect(finishes.length).toBeGreaterThanOrEqual(2);
    expect(startSpeeds[0]).toBeCloseTo(kmh(130), 9);
    expect(finishes[0].limit).toBe(6);
    expect(finishes[0].behindLimit).toBe(2);
    expect(finishes[0].aheadLimit).toBe(2);
    expect(startSpeeds[1]).toBeCloseTo(kmh(160), 9);
    expect(finishes[1].limit).toBe(2);
    expect(finishes[1].behindLimit).toBe(1);
    expect(finishes[1].aheadLimit).toBe(1);
  });
});

describe('user return gaps and braking room', () => {
  function userScene(settings: Partial<UserSettings>): World {
    const world = new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings(settings) });
    world.user.y = 0;
    world.user.speed = kmh(65);
    return world;
  }

  it('returns with at least 2.0 s behind and ahead at the default settings', () => {
    const world = userScene({});
    world.spawn('slowTruck', 1, 60 + 9, kmh(65));
    world.spawn('car', 1, 69 + 140 + 4.5, kmh(90)).nextPlanTime = Infinity;
    const events = runFor(world, 40);
    const [finish] = finishesOf(events, world.user);
    expect(finish).toBeDefined();
    expect(finish.behindLimit).toBe(2);
    expect(finish.aheadLimit).toBe(2);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(2);
    expect(finish.gapAhead).toBeGreaterThanOrEqual(2);
  });

  it('returns with 0.5 s gaps and then recovers its driving following distance', () => {
    const world = userScene({ returnFollowingTime: 0.5, cutInGap: 0.5 });
    const truck = world.spawn('slowTruck', 1, 60 + 9, kmh(65));
    const car = world.spawn('car', 1, 69 + 70 + 4.5, kmh(90));
    car.nextPlanTime = Infinity;
    let finish: OvertakeFinishEvent | undefined;
    let recoveredAfterFinish = false;
    let bestTimeGapAfterFinish = 0;
    runFor(world, 90, (events) => {
      const [justFinished] = finishesOf(events, world.user);
      if (justFinished !== undefined && finish === undefined) {
        finish = justFinished;
        world.user.nextPlanTime = Infinity;
      }
      if (finish !== undefined) {
        recoveredAfterFinish ||= world.user.recovering;
        const leader = world.homeLaneLeader(world.user);
        if (leader !== null) {
          bestTimeGapAfterFinish = Math.max(bestTimeGapAfterFinish, leader.gap / world.user.speed);
        }
      }
    });
    if (finish === undefined) {
      throw new Error('the user car did not overtake');
    }
    expect(finish.behindLimit).toBe(0.5);
    expect(finish.aheadLimit).toBe(0.5);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(0.5);
    expect(finish.gapAhead).toBeGreaterThanOrEqual(0.5);
    expect(finish.gapAhead).toBeLessThan(3);
    expect(recoveredAfterFinish).toBe(true);
    expect(bestTimeGapAfterFinish).toBeGreaterThanOrEqual(3);
    expect(truck.direction).toBe(1);
  });

  it('skips a slot that leaves no room to brake from 180 km/h to a slow truck', () => {
    const world = userScene({ speed: kmh(180), overtakingSpeed: kmh(180), returnFollowingTime: 0.5, cutInGap: 0.5 });
    const first = world.spawn('slowTruck', 1, 60 + 9, kmh(65));
    const second = world.spawn('slowTruck', 1, 69 + 120 + 9, kmh(65));
    const events = runFor(world, 40);
    const [finish] = finishesOf(events, world.user);
    expect(finish).toBeDefined();
    expect(world.homeLaneFollower(world.user)?.vehicle).toBe(second);
    expect(world.homeLaneFollower(world.user)?.vehicle).not.toBe(first);
  });

  it('never returns closer than the braking room in a long run at the tightest settings', () => {
    const world = new World({
      seed: 3,
      counts: { car: 15, semi: 3, slowTruck: 2 },
      user: userSettings({
        speed: kmh(80),
        followingTime: 1,
        overtakingSpeed: kmh(180),
        oncomingGap: 1,
        returnFollowingTime: 0.5,
        cutInGap: 0.5,
      }),
    });
    const violations: string[] = [];
    let userFinishes = 0;
    runFor(world, 20 * 60, (events) => {
      for (const event of finishesOf(events, world.user)) {
        userFinishes += 1;
        const leader = world.homeLaneLeader(world.user);
        if (leader !== null && leader.gap < brakingRoom(world.user.speed, leader.vehicle.speed) - 1) {
          violations.push(`t=${event.time.toFixed(1)} gap ${leader.gap.toFixed(1)} m`);
        }
      }
    });
    expect(userFinishes).toBeGreaterThan(0);
    expect(violations).toEqual([]);
  }, 120_000);
});

describe('return slot choice', () => {
  const QUEUE_GAP = 0.5 + 3 * kmh(65);

  function queueScene(settings: Partial<UserSettings>): { world: World; carA: Vehicle; carB: Vehicle; truck: Vehicle } {
    const world = new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings(settings) });
    world.user.y = 0;
    world.user.speed = kmh(65);
    const carA = world.spawn('car', 1, kmh(65) * world.userSettings.followingTime + 4.5, kmh(65));
    const carB = world.spawn('car', 1, carA.y + QUEUE_GAP + 4.5, kmh(65));
    const truck = world.spawn('slowTruck', 1, carB.y + QUEUE_GAP + 9, kmh(65));
    for (const vehicle of [carA, carB, truck]) {
      vehicle.nextPlanTime = Infinity;
    }
    return { world, carA, carB, truck };
  }

  it('cuts in after one car of a queue at a lower speed, with room to brake', () => {
    const { world, carA, carB } = queueScene({
      speed: kmh(180),
      followingTime: 1,
      overtakingSpeed: kmh(130),
      oncomingGap: 1,
      returnFollowingTime: 0.5,
      cutInGap: 0.5,
    });
    world.spawn('car', -1, 600, kmh(90));
    let chosenSpeed = 0;
    let finish: OvertakeFinishEvent | undefined;
    let behindAtFinish: Vehicle | undefined;
    let aheadAtFinish: Vehicle | undefined;
    let roomAtFinish = 0;
    let neededAtFinish = 0;
    runFor(world, 30, (events) => {
      if (startsOf(events, world.user).length > 0 && world.user.maneuver !== null && chosenSpeed === 0) {
        chosenSpeed = world.user.maneuver.speed;
      }
      const [justFinished] = finishesOf(events, world.user);
      if (justFinished !== undefined && finish === undefined) {
        finish = justFinished;
        behindAtFinish = world.homeLaneFollower(world.user)?.vehicle;
        const ahead = world.homeLaneLeader(world.user);
        aheadAtFinish = ahead?.vehicle;
        roomAtFinish = ahead?.gap ?? 0;
        neededAtFinish = brakingRoom(world.user.speed, ahead?.vehicle.speed ?? 0);
        world.user.nextPlanTime = Infinity;
      }
    });
    if (finish === undefined) {
      throw new Error('the user car did not overtake');
    }
    expect(behindAtFinish).toBe(carA);
    expect(aheadAtFinish).toBe(carB);
    expect(finish.gapBehind).toBeGreaterThanOrEqual(0.5);
    expect(finish.gapAhead).toBeGreaterThanOrEqual(0.5);
    expect(chosenSpeed).toBeLessThan(kmh(130));
    expect(chosenSpeed).toBeGreaterThan(kmh(65));
    expect(roomAtFinish).toBeGreaterThanOrEqual(neededAtFinish);
  });

  it('passes the whole queue at the highest overtaking speed when no gap fits', () => {
    const { world, truck } = queueScene({ speed: kmh(130), overtakingSpeed: kmh(130) });
    let chosenSpeed = 0;
    let passedCount = 0;
    const events = runFor(world, 60, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null && chosenSpeed === 0) {
        chosenSpeed = world.user.maneuver.speed;
        passedCount = world.user.maneuver.passedIds.length;
      }
      if (finishesOf(stepEvents, world.user).length > 0) {
        expect(world.homeLaneFollower(world.user)?.vehicle).toBe(truck);
        world.user.nextPlanTime = Infinity;
      }
    });
    expect(finishesOf(events, world.user)).toHaveLength(1);
    expect(chosenSpeed).toBeCloseTo(kmh(130), 9);
    expect(passedCount).toBe(3);
  });

  it('lets a traffic car behind the same queue overtake only at 90 km/h', () => {
    const { world, carA } = queueScene({ speed: kmh(80) });
    world.user.y = 5000;
    const follower = world.spawn('car', 1, carA.y - carA.length - QUEUE_GAP, kmh(65));
    const speeds: number[] = [];
    runFor(world, 90, (events) => {
      if (startsOf(events, follower).length > 0 && follower.maneuver !== null) {
        speeds.push(follower.maneuver.speed);
      }
    });
    for (const speed of speeds) {
      expect(speed).toBeCloseTo(kmh(90), 9);
    }
  });
});

describe('whole queue and no early return', () => {
  const QUEUE_SPEED_65 = kmh(65);
  const QUEUE_GAP = 0.5 + 3 * kmh(65);
  const TIGHT = {
    speed: kmh(180),
    followingTime: 1,
    overtakingSpeed: kmh(130),
    oncomingGap: 1,
    returnFollowingTime: 0.5,
    cutInGap: 0.5,
  };

  function queue(world: World, cars: number): Vehicle[] {
    world.user.y = 0;
    world.user.speed = QUEUE_SPEED_65;
    const vehicles: Vehicle[] = [];
    let front = QUEUE_SPEED_65 * world.userSettings.followingTime + 4.5;
    for (let index = 0; index < cars; index += 1) {
      vehicles.push(world.spawn('car', 1, front, QUEUE_SPEED_65));
      front += QUEUE_GAP + 4.5;
    }
    vehicles.push(world.spawn('slowTruck', 1, front + 4.5, QUEUE_SPEED_65));
    for (const vehicle of vehicles) {
      vehicle.nextPlanTime = Infinity;
    }
    return vehicles;
  }

  function tightWorld(): World {
    return new World({ seed: 1, counts: { car: 0, semi: 0, slowTruck: 0 }, user: userSettings(TIGHT) });
  }

  it('passes a whole queue of four cars and a slow truck in one overtake on a clear road', () => {
    const world = tightWorld();
    const vehicles = queue(world, 4);
    const truck = vehicles[vehicles.length - 1];
    const plannedCounts: number[] = [];
    const events = runFor(world, 90, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null) {
        plannedCounts.push(world.user.maneuver.passedIds.length);
      }
      if (finishesOf(stepEvents, world.user).length > 0) {
        expect(world.homeLaneFollower(world.user)?.vehicle).toBe(truck);
        world.user.nextPlanTime = Infinity;
      }
    });
    expect(plannedCounts).toEqual([5]);
    expect(finishesOf(events, world.user)).toHaveLength(1);
  });

  it('passes only the slow truck when a faster car drives just ahead of it', () => {
    const world = tightWorld();
    world.user.y = 0;
    world.user.speed = QUEUE_SPEED_65;
    const truck = world.spawn('slowTruck', 1, QUEUE_SPEED_65 + 9, QUEUE_SPEED_65);
    const car = world.spawn('car', 1, truck.y + 70 + 4.5, kmh(90));
    car.nextPlanTime = Infinity;
    const plannedCounts: number[] = [];
    runFor(world, 30, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null) {
        plannedCounts.push(world.user.maneuver.passedIds.length);
      }
    });
    expect(plannedCounts[0]).toBe(1);
  });

  it('returns in front of the slow truck and leaves a car 1 km beyond the queue ahead', () => {
    const world = tightWorld();
    const vehicles = queue(world, 2);
    const truck = vehicles[vehicles.length - 1];
    const farCar = world.spawn('car', 1, truck.y + 1000 + 4.5, kmh(90));
    farCar.nextPlanTime = Infinity;
    let behind: Vehicle | undefined;
    let plannedCount = 0;
    runFor(world, 60, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null && plannedCount === 0) {
        plannedCount = world.user.maneuver.passedIds.length;
      }
      if (finishesOf(stepEvents, world.user).length > 0 && behind === undefined) {
        behind = world.homeLaneFollower(world.user)?.vehicle;
        world.user.nextPlanTime = Infinity;
      }
    });
    expect(plannedCount).toBe(3);
    expect(behind).toBe(truck);
    expect(forwardDistance(world.user.y, farCar.y, 1)).toBeLessThan(5000);
  });

  it('stays in the passing lane until it has passed every planned vehicle, even when an earlier gap fits', () => {
    const world = new World({
      seed: 1,
      counts: { car: 0, semi: 0, slowTruck: 0 },
      user: userSettings({ ...TIGHT, speed: kmh(100), overtakingSpeed: kmh(100) }),
    });
    world.user.y = 0;
    world.user.speed = QUEUE_SPEED_65;
    const carA = world.spawn('car', 1, QUEUE_SPEED_65 + 4.5, QUEUE_SPEED_65);
    const carB = world.spawn('car', 1, carA.y + 70 + 4.5, QUEUE_SPEED_65);
    const truck = world.spawn('slowTruck', 1, carB.y + QUEUE_GAP + 9, QUEUE_SPEED_65);
    for (const vehicle of [carA, carB, truck]) {
      vehicle.nextPlanTime = Infinity;
    }
    let backStartedBeforeTruck = false;
    let plannedCount = 0;
    let previousPhase = world.user.phase;
    runFor(world, 60, (stepEvents) => {
      if (startsOf(stepEvents, world.user).length > 0 && world.user.maneuver !== null && plannedCount === 0) {
        plannedCount = world.user.maneuver.passedIds.length;
      }
      if (previousPhase === 'passing' && world.user.phase === 'back') {
        backStartedBeforeTruck ||= forwardDistance(world.user.y, truck.y, 1) < 5000;
      }
      previousPhase = world.user.phase;
      if (finishesOf(stepEvents, world.user).length > 0) {
        world.user.nextPlanTime = Infinity;
      }
    });
    expect(plannedCount).toBe(3);
    expect(backStartedBeforeTruck).toBe(false);
  });
});
