# Proposal

## Why

Since the last change, the user's car chooses the return slot that passes the fewest vehicles. On a clear road, it therefore takes a queue in hops. In a probe with four cars and a slow truck at 65 km/h, the user's car made five overtakes at 100 km/h. Each time it returned behind the next car and pulled out again 0.5 s later. A driver with a clear oncoming lane passes the whole queue at once, and cuts in only when oncoming traffic forces it.

## What Changes

- The user's car passes the whole queue ahead of it in one overtake when the rules allow it.
- A queue is the vehicle directly ahead plus each vehicle that holds the previous one back: slower than its desired speed, at its following distance plus 20 m or less. A vehicle beyond a larger gap is not part of the queue, so the user's car never stays in the passing lane to reach it.
- When the rules do not allow the whole queue, the user's car passes as many vehicles of the queue as they allow and cuts in there. It passes the rest in later overtakes.
- The speed choice stays the same: the highest speed, up to the highest overtaking speed, that fits the chosen slot.
- Every overtaking car returns only after it has passed every vehicle that its plan passes. It no longer takes an earlier gap that happens to fit. The late-return safety net stays.
- Traffic cars keep their slot choice. Their 3 s return gap already makes them pass whole queues.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `overtaking`:
  - "Return slot choice" changes from the fewest vehicles to the whole queue, or else the most vehicles the rules allow.
  - A new requirement, "Return only after the planned vehicles", says that a car returns only after it has passed every planned vehicle.

## Impact

- Code: `planOvertake` and `returnReady` in `src/sim/overtaking.ts`, and a `lastPassedId` field on `Maneuver` in `src/sim/world.ts`. Tests go in `src/sim/overtaking.test.ts`, plus `README.md`.
- No change to the controls, the statistics, or the e2e tests.
- Out of scope: slot choice for traffic cars, and braking in the passing lane.
