import { describe, expect, it } from 'vitest';
import { FrameClock } from './frame-clock';

const STEP = 1 / 60;

interface Totals {
  readonly renders: number;
  readonly simSeconds: number;
}

function drive(clock: FrameClock, refreshHz: number, seconds: number): Totals {
  let renders = 0;
  let steps = 0;
  const frames = Math.round(refreshHz * seconds);
  for (let frame = 0; frame <= frames; frame += 1) {
    const decision = clock.tick((frame * 1000) / refreshHz);
    if (decision.render) {
      renders += 1;
    }
    steps += decision.steps;
  }
  return { renders, simSeconds: steps * STEP };
}

function runningClock(speed: number): FrameClock {
  const clock = new FrameClock(STEP);
  clock.paused = false;
  clock.speed = speed;
  return clock;
}

describe('frame rate', () => {
  it('renders every frame on a 60 Hz display', () => {
    const totals = drive(runningClock(1), 60, 10);
    expect(totals.renders).toBe(601);
  });

  it('renders every second frame on a 120 Hz display', () => {
    const totals = drive(runningClock(1), 120, 10);
    expect(totals.renders).toBeGreaterThanOrEqual(599);
    expect(totals.renders).toBeLessThanOrEqual(602);
  });

  it('averages 60 frames per second on a 144 Hz display', () => {
    const totals = drive(runningClock(1), 144, 10);
    expect(totals.renders).toBeGreaterThanOrEqual(595);
    expect(totals.renders).toBeLessThanOrEqual(605);
  });

  it('still renders 60 frames per second at 60x', () => {
    const totals = drive(runningClock(60), 120, 10);
    expect(totals.renders).toBeGreaterThanOrEqual(599);
    expect(totals.renders).toBeLessThanOrEqual(602);
  });
});

describe('simulated time', () => {
  it('passes 40 s ± 0.5 s of simulated time in 10 s of real time at 4x', () => {
    const totals = drive(runningClock(4), 60, 10);
    expect(totals.simSeconds).toBeGreaterThanOrEqual(39.5);
    expect(totals.simSeconds).toBeLessThanOrEqual(40.5);
  });

  it('passes 600 s ± 1 s of simulated time in 10 s of real time at 60x', () => {
    const totals = drive(runningClock(60), 60, 10);
    expect(totals.simSeconds).toBeGreaterThanOrEqual(599);
    expect(totals.simSeconds).toBeLessThanOrEqual(601);
  });

  it('passes 100 s of simulated time in 10 s of real time at 10x on a 144 Hz display', () => {
    const totals = drive(runningClock(10), 144, 10);
    expect(totals.simSeconds).toBeGreaterThanOrEqual(99.5);
    expect(totals.simSeconds).toBeLessThanOrEqual(100.5);
  });

  it('advances at most 100 ms times the speed after a 2 s stall', () => {
    const clock = runningClock(4);
    clock.tick(0);
    clock.tick(1000 / 60);
    const decision = clock.tick(1000 / 60 + 2000);
    expect(decision.render).toBe(true);
    expect(decision.steps * STEP).toBeLessThanOrEqual(0.1 * 4 + STEP);
  });

  it('renders but runs no steps while paused', () => {
    const clock = new FrameClock(STEP);
    clock.speed = 5;
    const totals = drive(clock, 60, 5);
    expect(totals.renders).toBe(301);
    expect(totals.simSeconds).toBe(0);
  });
});
