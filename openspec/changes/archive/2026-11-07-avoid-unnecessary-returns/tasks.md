# Tasks

Every command and check runs through Docker, `scripts/*.sh`, `curl`, or file inspection. No step runs Node, npm, or a browser on the host.

## 1. Planner and return

- [x] 1.1 Probe the user's overtakes at the screenshot settings (180 / 130 km/h, 1.0 s following distance, 1.0 s oncoming gap, 0.5 s return gaps, light traffic) for seeds 1–3 in a container. Record the overtakes and vehicles passed per seed as the "before" numbers. Verify that the numbers are written down in the task report.
- [x] 1.2 Add `queueEnd` and the user's slot order (from the queue end down to 0, trying a nearer slot after a passing-lane or oncoming failure) to `planOvertake` in `src/sim/overtaking.ts`, as design.md describes. Leave the traffic order unchanged. Verify that `scripts/unit.sh` exits with status 0. Update the existing "cuts in after one car of a queue" test so that an oncoming vehicle leaves room for car A only.
- [x] 1.3 Add `lastPassedId` to `Maneuver` in `src/sim/world.ts`, fill it in when an overtake starts, and make `returnReady` wait until that vehicle is behind the car's front, except in the late-return safety net. Verify with `scripts/unit.sh`.

## 2. Tests

- [x] 2.1 Add tests to `src/sim/overtaking.test.ts` for the `overtaking` spec delta:
  - "Whole queue on a clear road": one overtake passes all five vehicles.
  - "Vehicle beyond the queue": the user's car returns in front of the slow truck, with the car 1 km ahead still ahead.
  - "No early return": a car with a three-vehicle plan stays out until it has passed all three, even when the first gap fits.
  - The existing "Full speed past a queue when no gap fits" test still passes.

  Verify with `scripts/unit.sh`.
- [x] 2.2 Repeat the probe from 1.1 and report the "after" numbers next to the "before" numbers. Verify that the long-run tests pass and that `scripts/unit.sh` exits with status 0 within 2 minutes.

## 3. Docs and integration

- [x] 3.1 Update the overtaking rules in `README.md`: the user's car passes the whole queue when the oncoming lane allows, and otherwise as many vehicles as it allows. Every car returns only after its planned vehicles. Verify that the README matches the spec delta.
- [x] 3.2 Run `scripts/e2e.sh` and verify that it exits with status 0. Run `openspec validate avoid-unnecessary-returns --strict` and verify that it reports no errors. Rebuild the running app with `docker compose up --build -d` and verify that http://192.168.0.237:8080/ returns status 200.
