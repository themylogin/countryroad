import './style.css';
import { STEP, World } from './sim/world';
import { createControls, DEFAULT_SETTINGS, PANEL_WIDTH, userSettingsFrom } from './ui/controls';
import { holdText } from './ui/hold-reason';
import { formatTrip } from './ui/trip-stats';
import { FrameClock } from './view/frame-clock';
import { Renderer } from './view/renderer';

const STATS_INTERVAL_MS = 250;

const root = document.getElementById('app');
if (!root) {
  throw new Error('index.html has no #app element');
}

const world = new World({
  seed: Math.floor(Math.random() * 2 ** 32),
  counts: { car: DEFAULT_SETTINGS.cars, semi: DEFAULT_SETTINGS.semis, slowTruck: DEFAULT_SETTINGS.slowTrucks },
  user: userSettingsFrom(DEFAULT_SETTINGS),
});
const clock = new FrameClock(STEP);
clock.speed = DEFAULT_SETTINGS.simulationSpeed;

const canvas = document.createElement('canvas');
canvas.className = 'road-canvas';
const renderer = new Renderer(canvas, PANEL_WIDTH);
const controls = createControls({
  setUser: (change) => world.setUser(change),
  setCount: (kind, count) => world.setCount(kind, count),
  setSimulationSpeed: (factor) => {
    clock.speed = factor;
  },
  toggleRunning: () => {
    clock.paused = !clock.paused;
    refreshStats();
    return !clock.paused;
  },
});
root.append(canvas, controls.panel);

let lastStatsRefresh = -Infinity;

function refreshStats(): void {
  controls.updateStats(
    formatTrip({
      speed: world.user.speed,
      distance: world.userDistance,
      time: world.time,
      overtakes: world.userOvertakes,
    }),
  );
  const hold = world.user.hold;
  let reason: string | null = null;
  if (hold !== null) {
    reason = holdText(hold);
  }
  controls.updateHoldReason(reason);
}

function layout(): void {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  controls.panel.style.left = `${renderer.panelLeft()}px`;
  renderer.draw(world);
}

function frame(now: number): void {
  const decision = clock.tick(now);
  for (let step = 0; step < decision.steps; step += 1) {
    world.step();
  }
  if (decision.render) {
    renderer.draw(world);
  }
  if (now - lastStatsRefresh >= STATS_INTERVAL_MS) {
    lastStatsRefresh = now;
    refreshStats();
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', layout);
layout();
refreshStats();
requestAnimationFrame(frame);
