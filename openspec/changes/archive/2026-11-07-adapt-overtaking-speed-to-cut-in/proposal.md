# Proposal

## Why

The user's car does not cut into a queue, even with a short cut-in gap, a short return following distance, and a clear oncoming lane. An overtaking car accelerates toward its overtaking speed for the whole maneuver. At 180 km/h or 130 km/h, it reaches the gap after the first car of a queue at about 120 km/h, about 20 m behind the next car at 65 km/h. Braking from 120 to 65 km/h at 3 m/s² needs about 41 m, and a 3 s queue gap at 65 km/h is only 54.7 m. So the planner passes the whole queue or nothing. At 100 km/h, the same car cuts in after one car. A real driver eases off and slots in.

## What Changes

- "Overtaking speed" becomes the highest speed of an overtake by the user's car, not a fixed speed. The user's car still overtakes at the higher of "My speed" and "Overtaking speed" when the return slot allows it.
- The planner tries lower speeds for the user's car, in 5 km/h steps. A speed must lie above the speed of every passed vehicle. For each return slot, the planner picks the highest speed that lets the user's car return with its cut-in gap, its return following distance, and enough room to brake at 3 m/s² or less.
- The planner prefers the slot that passes the fewest vehicles. The user's car can therefore cut in after one car of a queue, and then pass the next car in a later overtake.
- The oncoming-gap rule and all other overtaking rules stay as they are, checked at the chosen speed.
- Traffic cars keep their fixed 90 km/h overtaking speed.
- The control label stays "Overtaking speed". The README describes it as the highest overtaking speed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `overtaking`: The "Overtaking speed" requirement changes. The user's car overtakes at the highest speed up to its overtaking speed that fits the chosen return slot, and the planner prefers the slot with the fewest passed vehicles.

## Impact

- Code: the planner in `src/sim/overtaking.ts`. The return check needs no change, because it already uses the speed that the maneuver stores. Tests go in `src/sim/overtaking.test.ts`, plus `README.md`.
- No change to the controls, the statistics, or the e2e tests.
- Order: this change edits the "Overtaking speed" requirement, which `add-driving-controls-and-trip-stats` also edits. Archive that change first, so the main spec gets this version last.
- Out of scope: slower overtakes for traffic cars, braking during an overtake, and new controls.
