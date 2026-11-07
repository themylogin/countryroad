# Tasks

Every command and check runs through Docker, `scripts/*.sh`, `curl`, or file inspection. No step runs Node, npm, or a browser on the host. Screenshots come from the Playwright image and go to a temporary directory outside the project.

## 1. User settings

- [x] 1.1 Add `UserSettings` and `World.setUser(partial)` to `src/sim/world.ts`, replacing `userSpeed`, `userGap`, `setUserSpeed`, and `setUserGap`. Keep the hold for "My speed" during overtakes, make `Vehicle.followingTime` writable, and apply the user's `followingTime` at once. Add a `userSettings(overrides)` test helper with the defaults. Move all ten test files and `src/main.ts` to the new API. Verify that `scripts/unit.sh` exits with status 0 and that the test count is unchanged.

## 2. Following distance recovery

- [x] 2.1 Add `nextRecovering` and `recoveryAcceleration` to `src/sim/following.ts`, and a `recovering` field to `Vehicle`. Use them in `World` for cruising vehicles with a leader, as design.md describes. Extend `following.test.ts`:
  - A car cut in at 2 s drives at 80 km/h ± 1 km/h and returns to 90 km/h once its following time reaches 3 s.
  - A slow truck keeps 65 km/h behind a car 2 s ahead at 90 km/h.
  - A user car with a 4.0 s following time settles at 4.0 s ± 0.1 s behind a slow truck.
  - Raising the following time from 3 s to 4 s makes the follower drive 10 km/h slower until it reaches 4 s.
  - The existing approach tests start no recovery.
  - No recovery case brakes harder than 8.0 m/s² or overlaps.

  Verify with `scripts/unit.sh`.

## 3. Overtaking

- [x] 3.1 Add `behindTime` and `aheadTime` to `Maneuver`, and `behindLimit` and `aheadLimit` to `OvertakeFinishEvent`. Fill them in from fixed values for traffic and from the settings for the user's car. Use them in the planner and in `returnReady` instead of `GAP_BEHIND` and `GAP_AHEAD`. Change `runLong` to check each finish event against its own limits. Verify that the existing overtaking and long-run tests still pass with `scripts/unit.sh`.
- [x] 3.2 Plan the user's overtakes at `max(speed, overtakingSpeed)`. Add tests:
  - With "My speed" at 100 km/h and "Overtaking speed" at 150 km/h, the user's car passes at 150 km/h and slows toward 100 km/h after the return.
  - With "My speed" at 130 km/h and "Overtaking speed" at 100 km/h, it passes at 130 km/h.
  - Overtaking settings changed during an overtake leave that overtake's speed and limits unchanged, and apply to the next one.

  Verify with `scripts/unit.sh`.
- [x] 3.3 Add the braking room term to the planner's gap-ahead check, `returnReady`, and the safety-net return. Use the recovery target as the low speed of recovering vehicles in `speedBounds`. Add tests:
  - With default settings, the user's finish events show at least 2.0 s behind and 2.0 s ahead.
  - With 0.5 s for both gaps, the finish events show at least 0.5 s, and the user's car then recovers its driving following distance.
  - At 180 km/h with a 0.5 s return following distance, the user's car skips a slot 0.5 s behind a slow truck at 65 km/h and returns only where braking at 3 m/s² or less suffices.

  Verify with `scripts/unit.sh`.
- [x] 3.4 Add `src/sim/long-run-tight.test.ts`: 10 seeds × 20 simulated minutes of light traffic (15 cars, 3 semis, 2 slow trucks) with the tightest user settings from the `traffic-flow` spec. Every step must pass the invariants, and every finish event its own limits, with more than 10 overtakes per run. Verify that `scripts/unit.sh` exits with status 0 within 2 minutes.

## 4. Trip statistics

- [x] 4.1 Add `userDistance` and `userOvertakes` to `World`, updated only in `step()`. Add tests in `world.test.ts`: the distance grows by the user's speed times the elapsed time, the counter grows by 1 per user finish event, and no step means no change. Verify with `scripts/unit.sh`.
- [x] 4.2 Add `src/ui/trip-stats.ts` with `formatSpeed`, `formatDistance`, `formatTime`, and `formatAverage`, and `trip-stats.test.ts` with the "Example values" scenario and the "–" average at time 0. Verify with `scripts/unit.sh`.

## 5. Control panel

- [x] 5.1 Rebuild `src/ui/controls.ts` with the four fieldset groups, the ten sliders with the ranges, steps, and defaults from the `simulation-controls` spec, the per-direction note in "Traffic", and the Start/Pause button with the statistics below it. Return an `updateStats` function. Update `src/style.css` for the groups, the statistics, the compact spacing, and the scrolling panel. Wire `setUser`, the counts, the simulation speed, and the statistics refresh (at most every 250 ms, and at once on Start or Pause) in `src/main.ts`. Verify that `scripts/build.sh` succeeds. Then check a 1600 × 900 screenshot from the Playwright image against `docker compose up --build`: four groups in order, all ten sliders, the statistics below the button, and the panel fully visible.
- [x] 5.2 Update `e2e/simulation.spec.ts`: address sliders through their group, check the group order, the ten defaults, both "Following distance" sliders, and the step size. Add `e2e/trip-stats.spec.ts`:
  - The labels and values on load.
  - The time and distance grow after Start.
  - Nothing changes over 1 s after Pause.
  - At 10×, the time changes at least 4 times in 1 s.

  Verify that `scripts/e2e.sh` exits with status 0. Then change one Overtaking default in `controls.ts` and verify that `scripts/e2e.sh` exits non-zero and names the defaults test. Restore the default.
- [x] 5.3 Update `README.md`: the controls section by group, with the new sliders, the recovery rule in the traffic rules, and a "Trip statistics" paragraph. Verify that every control and statistic named there exists in `controls.ts`.

## 6. Integration checks

- [x] 6.1 Run `scripts/build.sh`, `docker compose up --build -d` with `docker compose down --volumes`, `scripts/unit.sh`, and `scripts/e2e.sh` with a `PATH` that has no Node, and verify that each exits with status 0. Then verify that the project has no `node_modules/`, `dist/` is the only build output, and the host has no `~/.cache/ms-playwright/`.
- [x] 6.2 Run `openspec validate add-driving-controls-and-trip-stats --strict` and verify that it reports no errors.
