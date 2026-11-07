export type VehicleKind = 'car' | 'semi' | 'slowTruck' | 'user';
export type TrafficKind = Exclude<VehicleKind, 'user'>;

export interface VehicleType {
  readonly length: number;
  readonly width: number;
  readonly desiredSpeed: number;
  readonly followingTime: number;
  readonly maxAcceleration: number;
  readonly comfortableBraking: number;
  readonly overtakes: boolean;
}

export function kmh(value: number): number {
  return value / 3.6;
}

export const MAX_BRAKING = 8;
export const USER_MAX_SPEED = kmh(180);
export const TRAFFIC_KINDS: readonly TrafficKind[] = ['car', 'semi', 'slowTruck'];

export const VEHICLE_TYPES: Readonly<Record<VehicleKind, VehicleType>> = {
  car: {
    length: 4.5,
    width: 1.8,
    desiredSpeed: kmh(90),
    followingTime: 3,
    maxAcceleration: 2,
    comfortableBraking: 2,
    overtakes: true,
  },
  semi: {
    length: 16.5,
    width: 2.55,
    desiredSpeed: kmh(80),
    followingTime: 5,
    maxAcceleration: 0.8,
    comfortableBraking: 1.5,
    overtakes: false,
  },
  slowTruck: {
    length: 9,
    width: 2.55,
    desiredSpeed: kmh(65),
    followingTime: 5,
    maxAcceleration: 0.8,
    comfortableBraking: 1.5,
    overtakes: false,
  },
  user: {
    length: 4.5,
    width: 1.8,
    desiredSpeed: kmh(130),
    followingTime: 3,
    maxAcceleration: 2,
    comfortableBraking: 2,
    overtakes: true,
  },
};
