import { kmh, type TrafficKind } from '../sim/vehicle-types';
import type { UserSettings } from '../sim/world';
import type { FormattedTrip } from './trip-stats';

export const PANEL_WIDTH = 260;

export interface Settings {
  readonly mySpeed: number;
  readonly drivingFollowing: number;
  readonly overtakingSpeed: number;
  readonly oncomingGap: number;
  readonly overtakingFollowing: number;
  readonly cutInGap: number;
  readonly cars: number;
  readonly semis: number;
  readonly slowTrucks: number;
  readonly simulationSpeed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  mySpeed: 130,
  drivingFollowing: 3,
  overtakingSpeed: 130,
  oncomingGap: 6,
  overtakingFollowing: 2,
  cutInGap: 2,
  cars: 15,
  semis: 3,
  slowTrucks: 2,
  simulationSpeed: 1,
};

export function userSettingsFrom(settings: Settings): UserSettings {
  return {
    speed: kmh(settings.mySpeed),
    followingTime: settings.drivingFollowing,
    overtakingSpeed: kmh(settings.overtakingSpeed),
    oncomingGap: settings.oncomingGap,
    returnFollowingTime: settings.overtakingFollowing,
    cutInGap: settings.cutInGap,
  };
}

export interface ControlHandlers {
  setUser(change: Partial<UserSettings>): void;
  setCount(kind: TrafficKind, count: number): void;
  setSimulationSpeed(factor: number): void;
  toggleRunning(): boolean;
}

export interface Controls {
  readonly panel: HTMLElement;
  updateStats(trip: FormattedTrip): void;
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

const STAT_LABELS: ReadonlyArray<readonly [keyof FormattedTrip, string]> = [
  ['currentSpeed', 'Current speed'],
  ['distance', 'Distance'],
  ['time', 'Time'],
  ['averageSpeed', 'Average speed'],
  ['overtakes', 'Overtakes completed'],
];

const speedText = (value: number): string => `${value} km/h`;
const secondsText = (value: number): string => `${value.toFixed(1)} s`;
const countText = (value: number): string => `${value}`;

export function createControls(handlers: ControlHandlers): Controls {
  const panel = document.createElement('aside');
  panel.className = 'controls';
  panel.append(
    createGroup('Driving', [
      createSlider({
        id: 'my-speed',
        label: 'My speed',
        min: 80,
        max: 180,
        step: 5,
        value: DEFAULT_SETTINGS.mySpeed,
        format: speedText,
        apply: (value) => handlers.setUser({ speed: kmh(value) }),
      }),
      createSlider({
        id: 'driving-following',
        label: 'Following distance',
        min: 1,
        max: 5,
        step: 0.1,
        value: DEFAULT_SETTINGS.drivingFollowing,
        format: secondsText,
        apply: (value) => handlers.setUser({ followingTime: value }),
      }),
    ]),
    createGroup('Overtaking', [
      createSlider({
        id: 'overtaking-speed',
        label: 'Overtaking speed',
        min: 80,
        max: 180,
        step: 5,
        value: DEFAULT_SETTINGS.overtakingSpeed,
        format: speedText,
        apply: (value) => handlers.setUser({ overtakingSpeed: kmh(value) }),
      }),
      createSlider({
        id: 'oncoming-gap',
        label: 'Oncoming traffic gap',
        min: 1,
        max: 6,
        step: 0.1,
        value: DEFAULT_SETTINGS.oncomingGap,
        format: secondsText,
        apply: (value) => handlers.setUser({ oncomingGap: value }),
      }),
      createSlider({
        id: 'overtaking-following',
        label: 'Following distance',
        min: 0.5,
        max: 3,
        step: 0.1,
        value: DEFAULT_SETTINGS.overtakingFollowing,
        format: secondsText,
        apply: (value) => handlers.setUser({ returnFollowingTime: value }),
      }),
      createSlider({
        id: 'cut-in-gap',
        label: 'Cut-in gap',
        min: 0.5,
        max: 3,
        step: 0.1,
        value: DEFAULT_SETTINGS.cutInGap,
        format: secondsText,
        apply: (value) => handlers.setUser({ cutInGap: value }),
      }),
    ]),
    createGroup('Traffic', [
      createSlider({
        id: 'cars',
        label: 'Cars',
        min: 0,
        max: 100,
        step: 1,
        value: DEFAULT_SETTINGS.cars,
        format: countText,
        apply: (value) => handlers.setCount('car', value),
      }),
      createSlider({
        id: 'semis',
        label: 'Semis',
        min: 0,
        max: 20,
        step: 1,
        value: DEFAULT_SETTINGS.semis,
        format: countText,
        apply: (value) => handlers.setCount('semi', value),
      }),
      createSlider({
        id: 'slow-trucks',
        label: 'Slow trucks',
        min: 0,
        max: 10,
        step: 1,
        value: DEFAULT_SETTINGS.slowTrucks,
        format: countText,
        apply: (value) => handlers.setCount('slowTruck', value),
      }),
      createNote('Vehicles per direction on 10 km of road.'),
    ]),
  );

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'start-button';
  button.textContent = 'Start';
  button.addEventListener('click', () => {
    const running = handlers.toggleRunning();
    button.textContent = running ? 'Pause' : 'Start';
  });

  const stats = document.createElement('dl');
  stats.className = 'trip-stats';
  const values = new Map<keyof FormattedTrip, HTMLElement>();
  for (const [key, label] of STAT_LABELS) {
    const term = document.createElement('dt');
    term.textContent = label;
    const value = document.createElement('dd');
    values.set(key, value);
    stats.append(term, value);
  }

  panel.append(
    createGroup('Simulation', [
      createSlider({
        id: 'simulation-speed',
        label: 'Simulation speed',
        min: 1,
        max: 10,
        step: 1,
        value: DEFAULT_SETTINGS.simulationSpeed,
        format: (value) => `${value}×`,
        apply: (value) => handlers.setSimulationSpeed(value),
      }),
      button,
      stats,
    ]),
  );

  return {
    panel,
    updateStats(trip: FormattedTrip): void {
      for (const [key, element] of values) {
        if (element.textContent !== trip[key]) {
          element.textContent = trip[key];
        }
      }
    },
  };
}

function createGroup(title: string, children: HTMLElement[]): HTMLElement {
  const group = document.createElement('fieldset');
  group.className = 'control-group';
  const legend = document.createElement('legend');
  legend.textContent = title;
  group.append(legend, ...children);
  return group;
}

function createNote(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'controls-note';
  paragraph.textContent = text;
  return paragraph;
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
