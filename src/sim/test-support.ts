import { kmh } from './vehicle-types';
import type { UserSettings } from './world';

export function userSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    speed: kmh(130),
    followingTime: 3,
    overtakingSpeed: kmh(130),
    oncomingGap: 6,
    returnFollowingTime: 2,
    cutInGap: 2,
    ...overrides,
  };
}
