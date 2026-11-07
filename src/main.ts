import './style.css';
import { kmh } from './sim/vehicle-types';
import { STEP, World } from './sim/world';
import { createControls, DEFAULT_SETTINGS, PANEL_WIDTH } from './ui/controls';
import { FrameClock } from './view/frame-clock';
import { Renderer } from './view/renderer';

const root = document.getElementById('app');
if (!root) {
  throw new Error('index.html has no #app element');
}

const world = new World({
  seed: Math.floor(Math.random() * 2 ** 32),
  counts: { car: DEFAULT_SETTINGS.cars, semi: DEFAULT_SETTINGS.semis, slowTruck: DEFAULT_SETTINGS.slowTrucks },
  userSpeed: kmh(DEFAULT_SETTINGS.mySpeed),
  userGap: DEFAULT_SETTINGS.myGap,
});
const clock = new FrameClock(STEP);
clock.speed = DEFAULT_SETTINGS.simulationSpeed;

const canvas = document.createElement('canvas');
canvas.className = 'road-canvas';
const renderer = new Renderer(canvas, PANEL_WIDTH);
const panel = createControls({
  setMySpeed: (value) => world.setUserSpeed(kmh(value)),
  setCount: (kind, count) => world.setCount(kind, count),
  setMyGap: (seconds) => world.setUserGap(seconds),
  setSimulationSpeed: (factor) => {
    clock.speed = factor;
  },
  toggleRunning: () => {
    clock.paused = !clock.paused;
    return !clock.paused;
  },
});
root.append(canvas, panel);

function layout(): void {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
  panel.style.left = `${renderer.panelLeft()}px`;
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
  requestAnimationFrame(frame);
}

window.addEventListener('resize', layout);
layout();
requestAnimationFrame(frame);
