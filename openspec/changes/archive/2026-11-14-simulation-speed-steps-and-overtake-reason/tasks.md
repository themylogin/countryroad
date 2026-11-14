# Tasks

All commands run in Docker: `scripts/unit.sh`, `scripts/build.sh`, and `scripts/e2e.sh`. Nothing runs on the host.

## 1. Simulation speed positions

- [x] 1.1 In `src/ui/controls.ts`, give the "Simulation speed" slider six positions with the list `[1, 2, 4, 10, 30, 60]`: `min` 0, `max` 5, `step` 1, starting at the position of `DEFAULT_SETTINGS.simulationSpeed`. `format` shows the factor with "×", and `apply` passes the factor. Verify that the `npx tsc` step of `scripts/unit.sh` passes.
- [x] 1.2 In `createSlider`, set `aria-valuetext` to `format(value)` at creation and on each `input` event. Verify with the e2e check in 1.4.
- [x] 1.3 In `src/view/frame-clock.test.ts`, make these changes:
  - Replace the 3× test with "passes 40 s ± 0.5 s in 10 s at 4×".
  - Add "passes 600 s ± 1 s in 10 s at 60×".
  - Change the 10× frame-rate test to 60× on a 120 Hz display.
  Verify that `scripts/unit.sh` passes.
- [x] 1.4 In `e2e/simulation.spec.ts`, make these changes:
  - Change the simulation speed row of `SLIDERS` to `min: '0'`, `max: '5'`, `step: '1'`, `value: '0'`, `shown: '1×'`.
  - Check that each slider's `aria-valuetext` equals its shown text.
  - Add a test: six ArrowRight presses from 1× show "2×", "4×", "10×", "30×", "60×", and "60×".
  Verify with `scripts/e2e.sh`.
- [x] 1.5 In `e2e/trip-stats.spec.ts`, make these changes:
  - Change `setSimulationSpeed` to press ArrowRight until the output reads the factor text, with at most five presses.
  - Change the 5× paused test to 4×.
  - Add a test: after 5 s of real time at 60× with default traffic, the time reads at least "0:04:00".
  Verify with `scripts/e2e.sh`.
- [x] 1.6 In `README.md`, change the "Simulation speed" line to the six positions 1×, 2×, 4×, 10×, 30×, and 60×. Verify that no "1× to 10×" text is left (`grep`).

## 2. Reason codes in the planner

- [x] 2.1 In `src/sim/overtaking.ts`, add these items:
  - The `HoldReason` tuple, in the priority order of design decision 4.
  - The `Hold` union with the numbers of design decision 5.
  - `strongerHold`, which compares priority first and then closeness to the need, or speed for `tooLong`.
  - `followedLeader`.
  Rebuild `isConstrained` from `followedLeader` and the speed test. Verify that the existing `isConstrained` tests pass in `scripts/unit.sh`.
- [x] 2.2 Change `oncomingClear` to `oncomingGap` and `pullOutClear` to `pullOutRoom`, which return numbers. Keep each comparison as it is today. Change `planOvertake` to return `{ kind: 'plan', plan }` or `{ kind: 'hold', hold }`. Map every exit, with its numbers, as the tables in design decision 5 show. The user's loop keeps the strongest hold over all slots, and the traffic loop keeps its control flow. Update the two call sites in `overtaking.test.ts`. Verify that every existing overtaking test and all six long-run files pass unchanged in `scripts/unit.sh`.
- [x] 2.3 Add `hold: Hold | null` to `Vehicle`, with `null` at creation. Set it in `maybeStart` as design decision 6 describes. Verify with the tests in 2.4.
- [x] 2.4 Add `src/sim/hold-reason.test.ts`, with one test for each code on the user's car:
  - `notSlower`: "My speed" is 90 km/h, and a car at 90 km/h is ahead.
  - `canReachSpeed`: "My speed" is 90 km/h and "Overtaking speed" is 80 km/h. Ahead is a car at 70 km/h with a free road in front of it.
  - `queueTooLong`: a tight queue of 13 vehicles.
  - `noGap`: two cars tight behind a slow truck, and a second slow truck close ahead. Check that `gap` is below `need` and that `need` is the return following distance.
  - `noGap` with braking room: "Overtaking speed" at 180 km/h, so that `need` is above the return following distance.
  - `tooClose`: 3 m behind a slow truck, with "My speed" at 130 km/h. At 5 m, the car can still pull out at 70 km/h and plans an overtake. Check that `gap` is about 3 m and that `need` leaves 2 m at the end of the lane change out.
  - `tooLong`: a semi at 80 km/h, with 85 km/h as the highest overtaking speed. Check that `speed` is 85 km/h.
  - `laneBusy`: another car passes the user's car.
  - `oncoming`: a slow truck ahead, and an oncoming car too close. Check that `gap` matches a hand calculation of the time to meet, and that `need` is the "Oncoming traffic gap".
  - `oncoming` alongside: an oncoming vehicle next to the user's car gives `gap` 0.
  Add these tests too:
  - The priority scenario of the spec. Place the oncoming car so that the 4 s check passes and only the whole-queue slot fails at the oncoming check.
  - `strongerHold`: a higher priority wins, then the smaller `need − gap`, then the higher speed for `tooLong`.
  - `null` on a free road.
  - `null` from the start of the overtake until the next decision after its end.
  Verify that `scripts/unit.sh` passes.

## 3. Reason paragraph in the panel

- [x] 3.1 Add `src/ui/hold-reason.ts` with `holdText(hold)` and the rounding of design decision 7. Add `src/ui/hold-reason.test.ts`, which asserts literal texts for these cases:
  - Each of the eight reasons.
  - Every number scenario of the spec: 4.17 s → "4.1 s gap", 1.98 s and 2.01 s → "1.9 s gap, 2.1 s needed", 3.32 s → "3.4 s needed", 12.6 m and 17.2 m → "12 m gap, 18 m needed", and 0 → "0.0 s gap".
  - Exact values with float error, for example a need of 2.0000000001 s, still read "2.0 s needed".
  Verify that `scripts/unit.sh` passes.
- [x] 3.2 In `createControls`, add `<div class="hold-reason" hidden>` with an `<hr>` and a `<p>` after the `<dl class="trip-stats">`. Add `updateHoldReason(text: string | null)`, which writes only on a change. In `src/style.css`, style the rule and the paragraph without a `display` value on `.hold-reason`. Verify with the e2e tests in 3.4.
- [x] 3.3 In `src/main.ts`, make `refreshStats` pass `holdText(world.user.hold)` to `updateHoldReason`, or `null` when there is no hold. Verify with the e2e tests in 3.4.
- [x] 3.4 Add e2e tests for these cases:
  - On load, no rule or reason paragraph is visible.
  - Set "Cars" and "Slow trucks" to their maximum with the End key, and start at 60×. Within 15 s, the paragraph shows a text that matches one of the eight reason patterns, numbers included. The rule is below the `<dl>`, and the paragraph is below the rule.
  - The paused test also compares the reason paragraph.
  Verify with `scripts/e2e.sh`.
- [x] 3.5 In the trip statistics section of `README.md`, describe the reason paragraph: when it shows, and an example text. Verify by reading the section.

## 4. Integration checks

- [x] 4.1 Run `scripts/unit.sh` and verify that all unit tests pass, including the long runs.
- [x] 4.2 Run `scripts/build.sh`, and then `scripts/e2e.sh`. Verify that `dist/` is exported and that all e2e tests pass.
- [x] 4.3 Run `openspec validate simulation-speed-steps-and-overtake-reason --strict`. Verify that the only finding is the length warning for "Reason texts".
- [x] 4.4 Rebuild and restart the compose stack on port 8080 (`docker compose up -d --build`). Verify that http://192.168.0.237:8080/ answers with the new bundle.

## 5. Oncoming distance instead of a time gap

At default traffic, the oncoming time gap read "0.0 s" in about two-thirds of the oncoming reasons, often with no oncoming vehicle in view. The oncoming reason now shows distances.

- [x] 5.1 In `src/sim/overtaking.ts`, replace `oncomingGap` with `oncomingConflict`, as design decision 5 describes. Keep the per-vehicle test exactly as it is. Verify that every existing overtaking test and all six long-run files pass unchanged in `scripts/unit.sh`.
- [x] 5.2 In `src/sim/hold-reason.test.ts`, make the oncoming tests check metres:
  - The early check: the distance is 400 m, and the need matches a hand calculation.
  - Alongside: the distance is 0.
  - The priority scenario: the distance is below the need.
  - A 3.0 s lower "Oncoming traffic gap" lowers the need by 3.0 s times the sum of both speeds at the end.
  Verify that `scripts/unit.sh` passes.
- [x] 5.3 In `src/ui/hold-reason.ts`, write "Oncoming car is \<distance\> m away, \<need\> m needed." with the metre rounding. In `src/ui/hold-reason.test.ts`, assert "Oncoming car is 800 m away, 1120 m needed." for 800.4 m and 1119.2 m, and "0 m away" for 0. Verify that `scripts/unit.sh` passes.
- [x] 5.4 In `e2e/trip-stats.spec.ts`, change the oncoming pattern to the new text. In `README.md`, change the example text. Verify with `scripts/e2e.sh` and a `grep` for "Oncoming traffic is too close".
- [x] 5.5 Run `scripts/build.sh`, restart the compose stack on port 8080, and verify that the served bundle has the new text.

## 6. Return gap as the space between the cars

The return gap was the room left in front of the user's car after the cut-in, at its own speed. It did not match the space that the user sees between the two cars. The return reason now shows that space and the space needed, in seconds at the speed of the car to pass.

- [x] 6.1 In `planSlot`, give the `noGap` hold `gap = max(0, space) / reference` and `need = (space + needed − gapAhead) / reference`, as design decision 5 describes. Keep the comparison as it is. Verify that every existing overtaking test and all six long-run files pass unchanged in `scripts/unit.sh`.
- [x] 6.2 In `src/sim/hold-reason.test.ts`, replace the `noGap` tests:
  - Two cars at 90 km/h, 125 m apart: the gap is 5.0 s, and the need is above it.
  - With the space set 1.5 m above the need, the user's car overtakes. With the space 0.5 m below the need, the reason is `noGap`.
  - A 1.0 s shorter return following distance lowers the need.
  - When the braking room sets the need, a change of the return following distance does not change it.
  Verify that `scripts/unit.sh` passes.
- [x] 6.3 In `src/ui/hold-reason.ts`, write "No gap to return into: \<gap\> s between the cars, \<need\> s needed." and cap seconds at 99.9 s. In `src/ui/hold-reason.test.ts`, assert the spec examples, the rounding, and the 99.9 s cap. Verify that `scripts/unit.sh` passes.
- [x] 6.4 In `e2e/trip-stats.spec.ts`, change the return pattern to the new text. Verify with `scripts/e2e.sh`.
- [x] 6.5 Run `scripts/build.sh`, restart the compose stack on port 8080, and verify that the served bundle has the new text.

## 7. Oncoming numbers from the real overtake

In a queue, the oncoming need jumped from the real plan, for example 2849 m, to the shortest overtake, for example 486 m, each time an oncoming car came within the 4 s need. The 4 s need belongs to an overtake that passes nobody.

- [x] 7.1 In `planOvertake`, when the 4 s check fails for the user's car, run the user's slot loop for the numbers only, as design decision 5 describes. The decision stays a hold. Verify that every existing overtaking test and all six long-run files pass unchanged in `scripts/unit.sh`.
- [x] 7.2 In `src/sim/hold-reason.test.ts`, add or change these tests:
  - Two cars behind a slow truck, and an oncoming car closer than the 4 s need: the need is that of the overtake past all three vehicles. It is much larger than the 4 s need.
  - The 4 s numbers stay when no return slot has room, for example in the tight queue with a second slow truck ahead.
  - The slider test and the hand calculation of the 4 s need use the tight-queue case.
  Verify that `scripts/unit.sh` passes.
- [x] 7.3 Run `scripts/e2e.sh` and `scripts/build.sh`, restart the compose stack on port 8080, and verify that all e2e tests pass and the served bundle is new.

## 8. Shorter oncoming text

- [x] 8.1 Change the oncoming text to "Oncoming \<distance\> m away, need \<need\> m" in the spec, `src/ui/hold-reason.ts`, its unit test, the e2e pattern, and `README.md`. Verify that `scripts/unit.sh` and `scripts/e2e.sh` pass, and that a `grep` finds no "Oncoming car is" outside the finished tasks.
- [x] 8.2 Run `scripts/build.sh`, restart the compose stack on port 8080, and verify that the served bundle has the new text.

## Workflow follow-up

- After review, archive the change with `/opsx:archive`.
