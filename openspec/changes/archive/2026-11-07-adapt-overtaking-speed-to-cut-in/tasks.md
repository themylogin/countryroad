# Tasks

Every command and check runs through Docker, `scripts/*.sh`, `curl`, or file inspection. No step runs Node, npm, or a browser on the host.

## 1. Planner

- [x] 1.1 In `src/sim/overtaking.ts`, add the candidate speeds as design.md describes. For the user's car, they run from the highest overtaking speed down in 5 km/h steps, above both its current speed and the passed vehicle's high bound. Traffic cars get only their overtaking speed. Restructure `planOvertake` into the slot loop with an inner speed loop, and move the pull-out check into the inner loop. Run the early oncoming check with the slowest candidate for the user's car. Verify that `scripts/unit.sh` exits with status 0 with all existing tests unchanged.
- [x] 1.2 Add tests to `src/sim/overtaking.test.ts`:
  - The "Cut in after one car of a queue" scenario: the user's car passes only car A, returns between car A and car B with at least 0.5 s on both sides, passes below 130 km/h, and can brake to car B's speed at 3 m/s² or less.
  - The "Full speed past a queue when no gap fits" scenario at the default return gaps: the user's car passes the whole queue at 130 km/h.
  - The "User overtakes faster than it cruises" and "Overtaking speed below My speed" tests still pass with no vehicle within 3 km ahead.
  - A traffic car behind the same queue passes at 90 km/h or not at all.

  Verify with `scripts/unit.sh`.
- [x] 1.3 Verify that the long-run tests still pass. Compare the user's overtakes in `long-run-tight.test.ts` before and after the change by probing one seed in a container, and report the numbers. Verify that `scripts/unit.sh` exits with status 0 within 2 minutes.

## 2. Docs and integration

- [x] 2.1 Update the "Overtaking speed" line and the overtaking rules in `README.md`. The slider is the highest overtaking speed, and the user's car may pass slower to fit a short gap, preferring the fewest passed vehicles. Verify that the README matches the `overtaking` spec delta.
- [x] 2.2 Run `scripts/e2e.sh` and verify that it exits with status 0. Run `openspec validate adapt-overtaking-speed-to-cut-in --strict` and verify that it reports no errors.
