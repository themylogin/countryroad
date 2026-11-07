import type { TrafficKind } from '../sim/vehicle-types';

export const PANEL_WIDTH = 260;

export interface Settings {
  readonly mySpeed: number;
  readonly cars: number;
  readonly semis: number;
  readonly slowTrucks: number;
  readonly myGap: number;
  readonly simulationSpeed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  mySpeed: 130,
  cars: 15,
  semis: 3,
  slowTrucks: 2,
  myGap: 6,
  simulationSpeed: 1,
};

export interface ControlHandlers {
  setMySpeed(kmh: number): void;
  setCount(kind: TrafficKind, count: number): void;
  setMyGap(seconds: number): void;
  setSimulationSpeed(factor: number): void;
  toggleRunning(): boolean;
}

interface SliderSpec {
  readonly id: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  format(value: number): string;
  apply(value: number): void;
}

export function createControls(handlers: ControlHandlers): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'controls';
  const sliders: SliderSpec[] = [
    {
      id: 'my-speed',
      label: 'My speed',
      min: 80,
      max: 180,
      step: 5,
      value: DEFAULT_SETTINGS.mySpeed,
      format: (value) => `${value} km/h`,
      apply: (value) => handlers.setMySpeed(value),
    },
    {
      id: 'cars',
      label: 'Cars',
      min: 0,
      max: 100,
      step: 1,
      value: DEFAULT_SETTINGS.cars,
      format: (value) => `${value}`,
      apply: (value) => handlers.setCount('car', value),
    },
    {
      id: 'semis',
      label: 'Semis',
      min: 0,
      max: 20,
      step: 1,
      value: DEFAULT_SETTINGS.semis,
      format: (value) => `${value}`,
      apply: (value) => handlers.setCount('semi', value),
    },
    {
      id: 'slow-trucks',
      label: 'Slow trucks',
      min: 0,
      max: 10,
      step: 1,
      value: DEFAULT_SETTINGS.slowTrucks,
      format: (value) => `${value}`,
      apply: (value) => handlers.setCount('slowTruck', value),
    },
    {
      id: 'my-gap',
      label: 'My overtaking gap',
      min: 1,
      max: 6,
      step: 0.1,
      value: DEFAULT_SETTINGS.myGap,
      format: (value) => `${value.toFixed(1)} s`,
      apply: (value) => handlers.setMyGap(value),
    },
    {
      id: 'simulation-speed',
      label: 'Simulation speed',
      min: 1,
      max: 10,
      step: 1,
      value: DEFAULT_SETTINGS.simulationSpeed,
      format: (value) => `${value}×`,
      apply: (value) => handlers.setSimulationSpeed(value),
    },
  ];
  for (const spec of sliders) {
    panel.append(createSlider(spec));
    if (spec.id === 'slow-trucks') {
      const note = document.createElement('p');
      note.className = 'controls-note';
      note.textContent = 'Vehicles per direction on 10 km of road.';
      panel.append(note);
    }
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'start-button';
  button.textContent = 'Start';
  button.addEventListener('click', () => {
    const running = handlers.toggleRunning();
    button.textContent = running ? 'Pause' : 'Start';
  });
  panel.append(button);
  return panel;
}

function createSlider(spec: SliderSpec): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'control';
  const header = document.createElement('div');
  header.className = 'control-header';
  const label = document.createElement('label');
  label.htmlFor = spec.id;
  label.textContent = spec.label;
  const output = document.createElement('output');
  output.htmlFor.add(spec.id);
  output.textContent = spec.format(spec.value);
  header.append(label, output);
  const input = document.createElement('input');
  input.type = 'range';
  input.id = spec.id;
  input.min = String(spec.min);
  input.max = String(spec.max);
  input.step = String(spec.step);
  input.value = String(spec.value);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    output.textContent = spec.format(value);
    spec.apply(value);
  });
  wrapper.append(header, input);
  return wrapper;
}
