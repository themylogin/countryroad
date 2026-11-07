# Tasks

Every command and check runs through Docker, `scripts/*.sh`, `curl`, or file inspection. No step runs Node, npm, or a browser on the host. Screenshots come from the Playwright image and go to a temporary directory outside the project, which is deleted afterwards.

## 1. Setup

- [x] 1.1 Add `vitest@^5.1.0` with the container dependency command from `README.md`. Verify that `package.json` lists it, that `package-lock.json` changed, that both files keep their owner, and that no `node_modules/` appears.
- [x] 1.2 Move `grass.webp` from the project root to `src/assets/grass.webp`. Add `src/vite-env.d.ts` with the Vite client type reference. Verify that the file exists only at the new path and that `docker build --target dist-build .` succeeds.
- [x] 1.3 Add the `unit` stage to `Dockerfile` and the executable `scripts/unit.sh`, as design.md describes. Add `src/sim/random.ts` (seeded mulberry32) with `src/sim/random.test.ts`, which checks that the same seed gives the same sequence. Verify that `scripts/unit.sh` exits with status 0 and lists the test. Break one assertion and verify that the script exits non-zero and names the test, then restore it.
- [x] 1.4 Add a "Unit tests" section to `README.md` with `scripts/unit.sh` and its exit-code contract. Verify that the command runs as written.

## 2. Traffic flow core

- [x] 2.1 Add `src/sim/vehicle-types.ts` with the table from the `traffic-flow` spec, and `src/sim/road.ts` with wrap and forward distance on the 10 km loop, for both directions. Add `road.test.ts` for wrap at both ends and for forward distance in each direction. Verify with `scripts/unit.sh`.
- [x] 2.2 Add `src/sim/following.ts` with the three-term controller from design.md. Add `following.test.ts`:
  - The follower settles at 3.0 s ± 0.1 s behind a car, a semi, and a slow truck.
  - A semi and a slow truck settle at 5.0 s ± 0.1 s behind a slow truck.
  - Acceleration stays within 2.0 / 0.8 m/s², and braking within 8.0 m/s².
  - A car at 180 km/h that reaches a slow truck brakes without overlap.

  Tune the gains until all cases pass. Verify with `scripts/unit.sh`.
- [x] 2.3 Add `src/sim/world.ts` with state, seeded initial placement, lanes, the step loop without overtaking, and step events. Add `world.test.ts`:
  - Every vehicle starts in its home lane.
  - Initial gaps are at least the follower's following time at 65 km/h.
  - Counts stay constant over 10 simulated minutes.
  - A vehicle on a free road reaches its desired speed.

  Verify with `scripts/unit.sh`.
- [x] 2.4 Add count changes to `world.ts`: adding with the visible-window preference, the pending list retried every simulated second, removal outside the window first, and the user's car never removed. Extend `world.test.ts` with the three count scenarios from the `traffic-flow` spec. Verify with `scripts/unit.sh`.
- [x] 2.5 Add `src/sim/invariants.ts`, test-support checks for footprint overlap (same lane, lane changes, head-on), speed limits, and acceleration limits. Add an invariant test with overtaking turned off, at maximum counts, for one seed over 20 simulated minutes. Verify with `scripts/unit.sh`.

## 3. Overtaking

- [x] 3.1 Add the maneuver state machine to `src/sim/overtaking.ts`: `cruise → out → passing → back`. `p` moves linearly over 2 s, the vehicle occupies both lanes during a lane change, and leaders are found by lane occupancy. Add tests that both lane changes take 2.0 s and that the occupancy is right in each phase. Verify with `scripts/unit.sh`.
- [x] 3.2 Add the planner: the constrained trigger, the conservative prediction, the return-slot search, the oncoming check in both lanes, the free passing lane, and cars only. Add `overtaking.test.ts` scenes for each scenario in the `overtaking` spec:
  - A clear lane leads to a start; an oncoming vehicle too close leads to a refusal.
  - A busy passing lane makes the car wait; a semi stays behind a slow truck.
  - A car passes a whole queue in one overtake.
  - At return, the gap behind is at least 2 s and the gap ahead at least 3 s.
  - Oncoming cars overtake by the mirrored rules.

  Verify with `scripts/unit.sh`.
- [x] 3.3 Add the user's car rules: the gap slider value `G`, and "My speed" changes that wait while an overtake involves the user's car, either as the overtaker or as a passed vehicle. Set the defaults to 15 cars, 3 semis, and 2 slow trucks everywhere they appear. Add tests:
  - The time to meet is at least 1.0 s with the slider at 1.0 s.
  - In the same traffic situations, the planner allows every 6.0 s overtake at 1.0 s too, and some only at 1.0 s.
  - The "Lower speed during an overtake", "Higher speed during an overtake", and "Speed change while another car passes" scenarios hold.

  Verify with `scripts/unit.sh`.
- [x] 3.4 Exclude the 3 km ahead of every active overtaker from vehicle insertion. Add a test that raises the car count during an overtake and checks that the new cars land outside that zone. Verify with `scripts/unit.sh`.
- [x] 3.5 Add the long-run invariant tests, split over several files:
  - 10 seeds × 20 simulated minutes at maximum counts, with the user at 180 km/h and a 1.0 s gap.
  - 10 seeds × 20 minutes at the default settings.

  Every step must pass the invariants, and every overtake-finish event must meet the gap behind, the gap ahead, and the oncoming gap. Verify that `scripts/unit.sh` exits with status 0 within 2 minutes. If it takes longer, profile and speed up the step loop.

## 4. Frame clock

- [x] 4.1 Add `src/view/frame-clock.ts` and `frame-clock.test.ts`, with fake timestamps:
  - A 60 Hz display renders every frame, a 120 Hz display every second frame, and a 144 Hz display averages 60 fps over 10 s.
  - At 3×, 10 s of real time gives 30 s ± 0.5 s of simulated time.
  - At 10×, the display still renders 60 fps.
  - A 2 s stall advances at most 100 ms × speed.
  - A paused clock renders but runs no steps.

  Verify with `scripts/unit.sh`.

## 5. View and controls

- [x] 5.1 Change `index.html` and `src/main.ts` to mount the full-window canvas and the panel, and remove the heading. Add `src/style.css`. Verify that `scripts/build.sh` succeeds and that `dist/` contains the hashed grass image with a relative reference.
- [x] 5.2 Add `src/view/renderer.ts` and `src/view/vehicle-shapes.ts` as design.md describes: the scrolling grass pattern, the road with lines, the 250 m scale, the camera mapping with the user's front 25 m above the bottom, the shapes, the colors, and the eased lateral position. Run the frame loop in `main.ts`. Verify with a screenshot from the Playwright image against `docker compose up --build`:
  - Grass is outside the road.
  - The road shows both edge lines and a dashed center line.
  - The red car is near the bottom, and the grey cars and trucks have their own shapes.
- [x] 5.3 Add `src/ui/controls.ts`: six labeled sliders with the ranges, steps, and defaults from the `simulation-controls` spec, value outputs with units, the per-direction note, and the Start/Pause button. Position the panel 32 px right of the road and wire every control to the world and the frame clock. Verify with a screenshot that the panel sits right of the road and shows the defaults.
- [x] 5.4 Update `e2e/app-shell.spec.ts` and `e2e/static-build.spec.ts` for the simulation view, and add `e2e/simulation.spec.ts` as design.md describes. Verify that `scripts/e2e.sh` exits with status 0. Then change one slider default in `controls.ts` and verify that `scripts/e2e.sh` exits non-zero and names the defaults test. Restore the default.
- [x] 5.5 Add a "What the app does" section near the top of `README.md`, with the road, the traffic rules, and each control. Verify that each control named there exists on the page.

## 6. Integration checks

- [x] 6.1 Take screenshots at the default settings after 60 simulated seconds at 5×, with an overtake on screen if one happens. Show them to the user for review of the default counts and the 250 m visible length.
- [x] 6.2 Verify the host-without-Node scenario with the updated command list: `scripts/build.sh`, `docker compose up --build -d` with `docker compose down --volumes`, `scripts/unit.sh`, `scripts/e2e.sh`, and the dependency command. Each must exit with status 0. Then verify that the project has no `node_modules/` and the host has no `~/.cache/ms-playwright/`.
- [x] 6.3 Run `openspec validate add-traffic-simulation --strict` and verify that it reports no errors.
