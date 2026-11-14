import { HORIZON_VEHICLES, MAX_MANEUVER_SECONDS, type Hold } from '../sim/overtaking';
import { formatSpeed } from './trip-stats';

// Keeps float error from moving an exact value, such as a 2.0 s need, to the next step.
const ROUNDING_TOLERANCE = 1e-9;

function gapSeconds(seconds: number): string {
  return (Math.floor(Math.min(seconds, 99.9) * 10 + ROUNDING_TOLERANCE) / 10).toFixed(1);
}

function needSeconds(seconds: number): string {
  return (Math.ceil(Math.min(seconds, 99.9) * 10 - ROUNDING_TOLERANCE) / 10).toFixed(1);
}

function gapMetres(metres: number): string {
  return String(Math.floor(metres + ROUNDING_TOLERANCE));
}

function needMetres(metres: number): string {
  return String(Math.ceil(metres - ROUNDING_TOLERANCE));
}

export function holdText(hold: Hold): string {
  switch (hold.reason) {
    case 'oncoming':
      return `Oncoming ${gapMetres(hold.gap)} m away, need ${needMetres(hold.need)} m`;
    case 'laneBusy':
      return 'Another vehicle is overtaking.';
    case 'queueTooLong':
      return `The queue ahead has more than ${HORIZON_VEHICLES} vehicles.`;
    case 'noGap':
      return `No gap to return into: ${gapSeconds(hold.gap)} s between the cars, ${needSeconds(hold.need)} s needed.`;
    case 'tooClose':
      return `Too close to the vehicle ahead to pull out: ${gapMetres(hold.gap)} m gap, ${needMetres(hold.need)} m needed.`;
    case 'tooLong':
      return `The overtake takes more than ${MAX_MANEUVER_SECONDS} s at ${formatSpeed(hold.speed)}.`;
    case 'canReachSpeed':
      return 'The vehicle ahead can reach your overtaking speed.';
    case 'notSlower':
      return 'The vehicle ahead is not slower than My speed.';
  }
}
