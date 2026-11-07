export const ROAD_LENGTH = 10_000;
export const LANE_WIDTH = 3.5;

export type Direction = 1 | -1;

export function wrap(position: number): number {
  const wrapped = position % ROAD_LENGTH;
  if (wrapped < 0) {
    return wrapped + ROAD_LENGTH;
  }
  return wrapped;
}

export function forwardDistance(from: number, to: number, direction: Direction): number {
  return wrap(direction * (to - from));
}

export function relativePosition(from: number, to: number): number {
  return wrap(to - from + ROAD_LENGTH / 2) - ROAD_LENGTH / 2;
}
