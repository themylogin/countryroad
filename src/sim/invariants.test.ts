import { describe, expect, it } from 'vitest';
import { InvariantMonitor } from './invariants';
import { kmh } from './vehicle-types';
import { STEP, World } from './world';

describe('invariants without overtaking', () => {
  it('keeps footprints apart and speeds within limits at maximum counts for 20 minutes', () => {
    const world = new World({
      seed: 11,
      counts: { car: 100, semi: 20, slowTruck: 10 },
      userSpeed: kmh(180),
      userGap: 1,
      overtaking: false,
    });
    const monitor = new InvariantMonitor(world);
    for (let step = 0; step < 20 * 60 / STEP; step += 1) {
      world.step();
      monitor.check();
    }
    expect(monitor.violations).toEqual([]);
  }, 120_000);

  it('reports an overlap when two vehicles share road', () => {
    const world = new World({
      seed: 3,
      counts: { car: 1, semi: 0, slowTruck: 0 },
      userSpeed: kmh(130),
      userGap: 6,
      overtaking: false,
    });
    const car = world.vehicles.find((vehicle) => vehicle.kind === 'car' && vehicle.direction === 1);
    if (car === undefined) {
      throw new Error('scene has no car in the user direction');
    }
    car.y = world.user.y + 2;
    const monitor = new InvariantMonitor(world);
    monitor.check();
    expect(monitor.violations.join('\n')).toContain('overlap in the right lane');
  });
});
