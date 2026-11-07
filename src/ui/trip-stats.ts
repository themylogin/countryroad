export interface Trip {
  readonly speed: number;
  readonly distance: number;
  readonly time: number;
  readonly overtakes: number;
}

export interface FormattedTrip {
  readonly currentSpeed: string;
  readonly distance: string;
  readonly time: string;
  readonly averageSpeed: string;
  readonly overtakes: string;
}

export function formatSpeed(metersPerSecond: number): string {
  return `${Math.round(metersPerSecond * 3.6)} km/h`;
}

export function formatDistance(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatAverage(meters: number, seconds: number): string {
  if (seconds <= 0) {
    return '–';
  }
  return formatSpeed(meters / seconds);
}

export function formatTrip(trip: Trip): FormattedTrip {
  return {
    currentSpeed: formatSpeed(trip.speed),
    distance: formatDistance(trip.distance),
    time: formatTime(trip.time),
    averageSpeed: formatAverage(trip.distance, trip.time),
    overtakes: String(trip.overtakes),
  };
}
