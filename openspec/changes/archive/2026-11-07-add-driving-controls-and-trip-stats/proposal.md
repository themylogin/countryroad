# Proposal

## Why

The user can set only the speed and the oncoming gap of their car. How close the car follows, how fast it overtakes, and how tightly it cuts back in are fixed. The page also gives no feedback on how the drive goes. This change gives the user control over their own driving style and shows the effect as trip statistics.

## What Changes

- Group the control panel into four labeled sections: **Driving**, **Overtaking**, **Traffic**, and **Simulation**.
- **Driving**:
  - "My speed": unchanged.
  - New "Following distance": 1.0–5.0 s in 0.1 s steps, default 3.0 s. It sets the following time of the user's car, which is a fixed 3 s today.
- **Overtaking**:
  - New "Overtaking speed": 80–180 km/h in 5 km/h steps, default 130 km/h. The user's car overtakes at the higher of this value and "My speed".
  - "Oncoming traffic gap": the slider that is now called "My overtaking gap", renamed. The range and default stay.
  - New "Following distance": 0.5–3.0 s in 0.1 s steps, default 2.0 s. This is the gap that the user's car accepts to the vehicle ahead when it returns to its lane. Today it is a fixed 3 s.
  - New "Cut-in gap": 0.5–3.0 s in 0.1 s steps, default 2.0 s. This is the space the user's car leaves for the vehicle it passed. Today it is a fixed 2 s.
- **Traffic**: the cars, semis, and slow trucks sliders, unchanged.
- **Simulation**: the simulation speed slider and the Start/Pause button, unchanged.
- New following-distance recovery for every vehicle. A vehicle that is closer to the vehicle ahead than its following time drives 10 km/h slower than that vehicle until its following time is back. This happens, for example, after a car cuts in with a short gap.
- New trip statistics below the Start/Pause button: current speed, distance, time, average speed, and overtakes completed. They cover the user's car and count simulated time from page load.
- A safety floor for short gaps ahead. The user's car returns only if it can slow to the speed of the vehicle ahead at 3 m/s² or less. Without this, a 0.5 s gap at a high speed difference could cause a collision.
- Traffic keeps its rules: a following distance of 3 s for cars and 5 s for trucks, and a return 2 s ahead of the passed vehicle with 3 s to the next vehicle. The oncoming gap stays 6 s.

## Capabilities

### New Capabilities

- `trip-stats`: The statistics for the user's car below the Start/Pause button, with their definitions, units, and update behavior.

### Modified Capabilities

- `simulation-controls`: Four control groups, four new sliders, a renamed slider, and the rules for when each new slider takes effect.
- `traffic-flow`: The user's car takes its following time from a slider. It may exceed "My speed" while it overtakes at a higher overtaking speed. Every vehicle recovers a short following distance by driving 10 km/h slower than the vehicle ahead.
- `overtaking`: The user's car overtakes at the higher of "My speed" and "Overtaking speed". The return gaps of the user's car come from the "Following distance" and "Cut-in gap" sliders, with a braking safety floor for the gap ahead. The oncoming gap slider gets its new name.

## Impact

- Code:
  - `src/sim/world.ts`: user settings, the recovery state, and trip counters.
  - `src/sim/following.ts`: the recovery rule.
  - `src/sim/overtaking.ts`: per-car return gaps, the user's overtaking speed, the safety floor, and the speed bounds of recovering vehicles.
  - `src/sim/invariants.ts`: checks against the limits of each overtake.
  - `src/ui/controls.ts`: groups, new sliders, and statistics.
  - `src/main.ts`, `src/style.css`, and `README.md`.
- Tests: every test that builds a `World` moves to the new user-settings object. New unit tests cover recovery, the new sliders, and the statistics. A long-run set stresses the most aggressive user settings. The e2e tests address sliders through their group, because two sliders are named "Following distance".
- No new dependencies. The build, serve, and test commands stay the same.
- Out of scope:
  - Statistics for traffic.
  - Resetting the statistics.
  - Saving slider values between visits.
  - Changing the traffic rules.
