# Design

## Context

The app is a static Vite + TypeScript page. It has no UI framework and no runtime dependencies. `src/main.ts` renders one placeholder heading. Every workflow runs in Docker (see the `compose-stack` spec). The e2e tests in `e2e/` look for the heading, so they must change.

`grass.webp` sits in the project root. It is an 800 × 800 px seamless tile of 231 KB, with a faint watermark in its center.

The user confirmed these rules before planning:

- The oncoming gap is the time to meet: distance divided by the sum of speeds.
- Each count slider sets the count per direction on a 10 km loop.
- Only cars overtake.
- A returning car needs 3 s ahead.
- A car overtakes at its desired speed.

Vitest 5.1.0 is the latest version. It supports Vite 8 and Node 26.

## Goals / Non-Goals

**Goals:**

- A deterministic simulation core with no DOM access, so unit tests can run hours of simulated traffic in seconds.
- Safety by construction. The overtake planner predicts conservatively, so no overtake has to abort and no collision can happen. Long-run tests prove it.
- Smooth 60 fps rendering at every simulation speed, on one canvas.

**Non-Goals:**

- Realistic driver variety. All cars share one desired speed and one following time, as the request states.
- A physics engine. Motion is one-dimensional along the road, plus a lateral lane position.
- Pixel-exact visual tests. The e2e tests sample a few pixels and compare frames. They do not compare screenshots.

## Decisions

### Module layout

```
src/
  main.ts                 bootstraps the page and wires the modules
  style.css               layout of the canvas and the panel
  vite-env.d.ts           Vite client types, for the .webp import
  assets/grass.webp       moved from the project root
  sim/
    random.ts             seeded PRNG (mulberry32)
    vehicle-types.ts      the vehicle table from the traffic-flow spec
    road.ts               loop geometry: wrap, forward distance
    world.ts              state, placement, counts, step()
    following.ts          longitudinal controller
    overtaking.ts         planner and maneuver state machine
    *.test.ts             unit tests next to each module
  view/
    frame-clock.ts        60 fps gate and simulated-time accumulator
    renderer.ts           canvas drawing
    vehicle-shapes.ts     top-view shapes per type
  ui/
    controls.ts           panel DOM, slider and button wiring
```

`src/sim/` imports nothing from `view/` or `ui/`, and it uses no DOM types. The simulation runs in Node under Vitest.

Alternative: one `simulation.ts` file. The planner alone has several hundred lines, and separate modules keep the tests focused.

### Road model

- One coordinate `y` in meters along the road, increasing toward the top of the page. The loop length is `L = 10 000` m, and positions wrap modulo `L`.
- A vehicle has a direction `d`: +1 for the user's direction, −1 for oncoming. It moves by `d · v · dt`. Its `y` is the position of its front bumper.
- The forward distance from `a` to `b` for direction `d` is `mod(d · (b − a), L)`.
- The lateral position `p` runs from 0 (home lane) to 1 (passing lane). A vehicle occupies its home lane while `p < 1`, and the passing lane while `p > 0`. During a lane change it occupies both lanes, as the spec requires.

Alternative: spawn vehicles ahead and remove them behind a window around the user. That needs density bookkeeping, and the counts drift. The loop keeps the counts exact. At 40 km/h relative speed, the user meets the same vehicle again only after 15 minutes.

### Time step

- The step is fixed at `dt = 1/60` s of simulated time. `world.step()` is pure apart from mutating the world. It returns the events of the step: overtake starts and overtake finishes, with the measured gaps.
- The simulation speed sets how many steps run per frame, through the frame clock below.
- Integration uses semi-implicit Euler. First `v ← clamp(v + a·dt, 0, v_desired)`, then `y ← y + d·v·dt`.

### Longitudinal controller

Each step, a vehicle in its home lane uses IDM+, the variant of the Intelligent Driver Model that takes the minimum of its two terms:

`a = a_max · min(1 − (v / v_des)^4, 1 − (s* / s)²)`, with `s* = 0.5 m + max(0, v·T + v·(v − v_lead) / (2·√(a_max·b)))`

- `s` is the bumper-to-bumper gap, and `T` is 3 s or 5 s.
- `b` is the comfortable braking rate: 2.0 m/s² for cars, 1.5 m/s² for trucks.
- The `min` makes the equilibrium gap exactly `0.5 m + v·T`. That is within 0.03 s of the spec's following time at 65 km/h.
- The `v·(v − v_lead)` term starts braking early on a fast approach. The user's car at 180 km/h begins to brake about 550 m before a slow truck at 65 km/h, and stays near the comfortable rate.
- When the user lowers the desired speed below the current speed, the free term becomes `−b`.

The result is clamped to `[−8.0, a_max]`. `a_max` is 2.0 m/s² for cars and 0.8 m/s² for trucks. A positive acceleration never takes the speed above the desired speed. The leader is the next vehicle ahead in the same direction that occupies the home lane. The leader search has no range limit, so approach braking can always start early enough.

During an overtake, the car does not use this controller. It accelerates at `a_max` to its overtaking speed and never brakes, so the planner can predict its motion exactly.

Alternatives:
- Plain IDM: its equilibrium gap misses 3 s by about 20 % behind slower leaders.
- A linear time-gap controller, `k_s·(s − T·v) + k_v·(v_lead − v)`: this was the first plan. Its speed-difference term demands the full 8 m/s² about 160 m before a slow truck when the user drives 180 km/h.
- Instant speed matching: it causes visible jumps and breaks the acceleration limits.

### Overtake planner

The planner runs only for cars and the user's car. It runs at most every 0.5 s per vehicle, and only while the vehicle is constrained. A vehicle is constrained when it follows a leader slower than its desired speed by more than 1 km/h and its gap is below `T·v + 20 m`.

The plan predicts the future from the current state:

1. **The overtaker** starts at its current speed and accelerates at `a_max` to its overtaking speed `v_ot` (its desired speed). This gives a closed-form position `x_c(t)`.
2. **Home-lane vehicles ahead** (`P1, P2, …`, up to 12 vehicles or 3 km) each keep a constant predicted speed. One shared function, `speedBounds`, gives two bounds per vehicle from the vehicles within 1 km ahead of it. The low bound is the lowest current speed in that chain. The high bound is the fastest speed the chain allows, capped by each vehicle's desired speed. Both carry a 0.3 m/s allowance. The planner predicts a vehicle it passes at its high bound, and the next vehicle ahead at its low bound. The predicted gaps are therefore never larger than the real ones.
3. **Return slot:** for `k = 1, 2, …`, take `Pk` as the last vehicle passed and `N = P(k+1)` as the next vehicle ahead. The return lane change can start only when the car's rear is clear of `Pk`'s front, because a lane change occupies both lanes from its first step. So `t_e` is the latest of three times: the clear time plus 2 s, the time at which the gap behind reaches `2 s · v_Pk`, and 4 s. Bisection finds both times. Then check at `t_e` that:
   - the gap from `Pk`'s front to the car's rear is at least `2 s · v_Pk`;
   - the gap from the car's front to `N`'s rear is at least `3 s · v_c(t_e)`.

   The gap ahead only shrinks over time, so if it fails at the earliest `t_r`, slot `k` fails and the planner tries `k + 1`. When no slot exists within the horizon, there is no plan.
4. **Oncoming check:** each oncoming vehicle ahead, in either lane, is predicted at its desired speed. That is its fastest possible approach, so the check is conservative. At `t_e`, the time to meet must be at least `G`:

   `distance(t_e) / (v_c(t_e) + v_O_desired) ≥ G`

   `G` is 6.0 s, or the slider value for the user's car. Two vehicles that approach each other only get closer, so `t_e` is the closest point before the car is back in its lane. A collision before `t_e` is therefore impossible.
5. **Passing lane free:** no same-direction vehicle may have `p > 0` between 200 m behind the car and 100 m beyond the return point.

The car starts the maneuver only when steps 3–5 all pass. It stores the plan: overtaking speed, last vehicle to pass, and `t_e`.

Before step 2, the planner runs the oncoming check once with the shortest possible end time, 4 s. A plan that fails then fails at every later end time too, so this early exit changes no result. It halves the run time in dense traffic.

**Execution** is a small state machine: `cruise → out (2 s) → passing → back (2 s) → cruise`.

- `p` moves linearly in simulated time, so collision checks stay simple. The renderer eases the drawn position with a smoothstep.
- In `passing`, the car checks the return conditions each step with the actual positions and the same `speedBounds` function. It starts `back` at the first moment when it is clear of the vehicle behind and the conditions will hold 2 s later. Real gaps are never worse than the predicted ones, so this moment comes no later than `t_r`.
- Safety net: if the return start is more than 0.5 s late, the car returns as soon as it is clear behind and has 1 s ahead. The long-run tests count every late return as a rule breach, so this path must stay unused. It exists so that a planner bug causes a rule breach, not a head-on collision.
- In `out` and `passing`, the car drives at `v_ot` with no leader, because its passing lane is free.
- In `back`, the controller uses `N` as the leader.

Alternative: plan with current speeds and abort when the plan fails. The spec requires that every overtake finishes. Aborts also look unrealistic and need their own safety rules. The conservative prediction removes them.

### Interaction between overtakes

The oncoming check covers vehicles in both lanes. Opposite-direction overtakes therefore protect each other:

- A car that starts later sees the earlier overtaker as oncoming traffic. Its own check keeps the time to meet at least `G` at its own `t_e`.
- The earlier plan assumed that oncoming vehicles drive at their desired speed. A later overtaker only reaches that speed, so the earlier plan stays valid.

A same-direction overtake cannot start while another one is active in the same stretch, because of rule 5. The count slider never inserts a vehicle within 3 km ahead of an active overtaker. It may remove a vehicle at any time, because that only makes gaps larger.

### User speed changes during an overtake

A "My speed" change during an overtake that involves the user's car would break that overtake's plan, so the change waits (see the `simulation-controls` spec):

- **While the user's car overtakes:** a lower speed would delay the return. A higher speed can also shorten the oncoming gap at the return, when the car is close to its return point.
- **While another car overtakes the user's car:** a higher speed can make the user's car keep pace with that car, so it never gets the 2 s it needs to return.

`World.setUserSpeed` stores the requested speed. The world applies it in the first step in which the user's car has no maneuver and is in no active maneuver's list of vehicles to pass. Other vehicles' oncoming checks still predict the user's car at 180 km/h, the slider maximum, so a later change can never invalidate their plans.

### Placement and counts

- **Initial placement** (seeded): for each direction, shuffle the list of vehicles. The user's car goes first in the user's direction, at `y = 0`. Each gap gets its minimum size, the follower's `T` at 65 km/h. The slack `L − Σ(minimum gaps + lengths)` is spread at random with exponential weights. At maximum counts the minimum total is about 9.0 km, which leaves 1.0 km of slack. Initial speed is the smallest of the vehicle's desired speed, its leader's desired speed, and `gap / T`.
- **Adding vehicles** at run time: take the home-lane gaps between consecutive vehicles. Keep those that hold the new vehicle with both following distances at the neighbors' current speeds. Drop gaps within 3 km ahead of an active overtaker. Prefer gaps outside the visible window, which runs from 25 m behind to 225 m ahead of the user's front bumper, in both directions. A vehicle that does not fit goes into a pending list, which is retried once per simulated second.
- **Removing vehicles:** remove vehicles of the type outside the visible window first, picked at random. The user's car is never removed.

### Frame clock

`frame-clock.ts` is a pure class that receives timestamps from `requestAnimationFrame`. On each call it decides whether to render, and how many simulation steps to run.

- It renders when at least 1000/60 ms minus 1 ms of tolerance has passed since the last rendered frame. A 120 Hz display renders every second frame. A 144 Hz display averages 60 fps.
- On a rendered frame, it adds `speed × elapsed` to an accumulator, with `elapsed` capped at 100 ms. A hidden tab or a stall therefore causes no burst. It then runs `floor(accumulator / dt)` steps and keeps the rest.
- While paused, it renders and runs no steps.

Unit tests drive the class with fake timestamps for 60 Hz, 120 Hz, and 144 Hz, and with speeds of 1× to 10×.

Alternative: a fixed 10 steps per frame at 10×. That ties simulated time to the frame count, so dropped frames slow the simulation. The spec ties simulated time to real time.

### Rendering

- **Canvas:** one `<canvas>` fills the window (`position: fixed; inset: 0`), sized `innerWidth × innerHeight × devicePixelRatio`. The context is scaled by the device pixel ratio, so drawing code uses CSS pixels.
- **Scale:** `scale = canvasCssHeight / 250` px per meter. On a 1080p window, that is about 3.8 px/m. A car is then about 17 px long, and a lane is about 13 px wide.
- **Horizontal layout:** the road is centered at `x_road = (width − panelWidth) / 2`. The panel sits 32 px right of the road's edge. `main.ts` sets it on resize.
- **Grass:** a `CanvasPattern` of the imported image, at its native size in CSS pixels. Its translation is the accumulated distance of the user's car, times the scale, modulo 800. The accumulated distance does not wrap at the end of the loop, so the grass never jumps. The pattern covers the full canvas, under the panel too. The panel has a translucent dark background, so its text stays readable.
- **Road:** asphalt `#3b3b3b`, 7 m wide, with 0.15 m solid white edge lines. The center line is dashed, 6 m dash and 14 m gap, anchored to the world `y` so it scrolls. The 20 m period divides the 10 km loop, so the dashes do not jump at the end of the loop.
- **Screen mapping:** for a vehicle, `r = wrap(y − y_user)` lies in `(−L/2, L/2]`, and `screen_y = height − (25 + r) · scale`. Only vehicles with `−40 m < r < 260 m` are drawn.
- **Lanes:** the user's direction uses the lane right of center, and oncoming traffic the lane left of center. The drawn lateral position is `lerp(home, other, smoothstep(p))`.
- **Shapes** (`vehicle-shapes.ts`), all rotated to face the direction of travel:
  - Car: a rounded body with a darker windshield and rear window.
  - Semi: a 2.4 m cab, a 0.4 m gap, and a 13.7 m trailer box.
  - Slow truck: a 2.3 m cab and a drum drawn as a rounded ellipse with two stripes.
- **Colors:** the user's car is `#d32f2f`. Others use greys from `#8c8c8c` to `#b4b4b4`: a darker trailer, a lighter drum.

Alternatives:
- DOM elements per vehicle: hundreds of nodes moving at 60 fps cost more and look worse.
- WebGL: not needed at this vehicle count.

### Controls

`controls.ts` builds an `<aside>` panel. Each slider has a `<label>` with the visible name, an `<input type="range">`, and an `<output>` that shows the value and unit. Labels give each slider an accessible name, so the e2e tests can use `getByRole('slider', { name: 'My speed' })`. The button is a `<button>` whose text is "Start" or "Pause". A note under the count sliders reads "Vehicles per direction on 10 km of road." Each change calls a typed setter on the world.

### Test strategy

- **Unit tests** (Vitest, Node environment), each mapped to spec scenarios:
  - `following.test.ts`: settling at 3 s and 5 s, and the acceleration and braking limits.
  - `overtaking.test.ts`: hand-built scenes for start, refusal, queue passing, gaps at return, mirrored direction, trucks staying put, and the user's gap slider.
  - `world.test.ts`: placement, counts up and down, pending insertions, the visible-window preference, and constant counts.
  - `invariants.test.ts` and `long-run-*.test.ts`: long runs with fixed seeds. Every step checks for footprint overlaps (same lane, lane changes, head-on), speed limits, and acceleration limits. Every overtake-finish event is checked for the gap behind, the gap ahead, the oncoming gap, and lateness against the plan.
  - At maximum counts, traffic forms solid queues and no overtake starts, so those runs cannot test the overtake rules. A third set, `long-run-light.test.ts`, runs 10 seeds of light traffic (15 cars, 3 semis, 2 slow trucks) with the user at 180 km/h and a 1.0 s gap. There, more than 10 overtakes finish per run.
  - `frame-clock.test.ts`: frame rates and the simulated-time ratio.
- **Run-time budget:** the long runs have 10 seeds × 20 simulated minutes, about 72 000 steps each. They are split over several test files, so Vitest runs them in parallel. The target is under 2 minutes for `scripts/unit.sh`. If the target is missed, profile the step loop before cutting coverage.
- **E2E tests** (Playwright):
  - The existing app-shell and sub-path tests change to look for the canvas and the "Start" button.
  - The clean-load test also covers the grass image request.
  - A new `e2e/simulation.spec.ts` checks the slider defaults and steps and the Start/Pause text. It checks that the canvas changes between two frames while running and stays the same while paused, using `toDataURL`. It samples a green grass pixel left of the road and a red pixel at the user's car position.

### Unit test command

- The `Dockerfile` gets a `unit` stage: `FROM builder`, then `RUN npx tsc && npx vitest run`.
- `scripts/unit.sh` runs `docker build --target unit --progress=plain --no-cache-filter unit .`. The test output is always visible, and only the test step rebuilds, not `npm ci`.
- The exit code of `docker build` is the result.
- Add Vitest with the container dependency command from the README: `npm install --package-lock-only --save-dev vitest@^5.1.0`.

### TypeScript setup

- `src/vite-env.d.ts` holds `/// <reference types="vite/client" />`, so `import grassUrl from './assets/grass.webp'` type-checks.
- The test files live in `src/`, so `tsc` checks them too.
- Vite bundles only what `index.html` imports, so the tests stay out of `dist/`.

## Risks / Trade-offs

- [The planner's conservative prediction makes overtakes rarer than real drivers would make them] → The spec puts safety first. The user can lower the gap of their own car to 1.0 s.
- [Long-run tests may be slow] → The run-time budget and parallel files are above. Performance work on the step loop comes before any cut in coverage.
- [At 3.8 px/m, cars are small on screen (about 17 × 7 px)] → The request fixes real sizes. Showing 250 m is a compromise between vehicle size and overtake context. The value is one constant, and a later change can add zoom.
- [The time-gap gains may not settle every combination of `T` and speed within ±0.1 s] → The unit tests check each combination: car behind car, car behind semi, car behind slow truck, and truck behind truck. Tune the gains until all pass.
- [The grass tile repeats its watermark across the page] → The user can replace `src/assets/grass.webp` with a clean tile. No code change is needed.
- [A 144 Hz display cannot hit exactly 60 fps, because frames come every 6.9 ms] → The clock averages 60 fps with alternating intervals of 13.9 ms and 20.8 ms. The spec says 60 per second, not exact intervals.
- [`docker build --no-cache-filter` needs BuildKit] → It is the default in Docker 23 and later.

## Migration Plan

Remove the placeholder heading in the same change that adds the view, so no release shows both. Rollback means reverting the change. The build and serve commands stay the same.

## Review outcome

- The first default counts, 40 cars, 8 semis, and 4 slow trucks, packed traffic into long queues behind trucks. The user's car could overtake only about 2 times in 30 minutes, at any gap setting. The defaults are now 15 cars, 3 semis, and 2 slow trucks, which give about 10 overtakes in 30 minutes. The slider ranges stay the same.
- The user reviewed the 250 m visible length on screenshots and kept it.
