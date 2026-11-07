# Proposal

## Why

The app shows only a placeholder heading. This change turns it into its first real feature: a top-down simulation of traffic on a two-lane country road. The user drives a red car. Sliders change the user's speed, the traffic mix, and how much risk the user accepts when overtaking.

## What Changes

- Replace the placeholder heading with a full-page simulation view.
- Move `grass.webp` from the project root to `src/assets/grass.webp`. Tile it across the whole page as the background. The grass scrolls with the road.
- Draw a two-lane road from the bottom to the top of the screen, seen from above. Traffic drives on the right.
- Simulate a closed 10 km stretch of road in each direction. Vehicles that leave one end come back at the other end.
- Add three vehicle types with European sizes and fixed speeds: cars at 90 km/h, semis at 80 km/h, and slow trucks (such as concrete mixers) at 65 km/h. All other vehicles are grey.
- Keep a following distance of 3 s for cars and 5 s for trucks.
- Let cars overtake when it is safe. A car returns to its lane only with 2 s behind the passed vehicle and 3 s ahead. At that moment, every oncoming vehicle must still be at least 6 s away. Each lane change takes 2 s. Trucks never overtake. No vehicles ever collide.
- Add the user's car: red, near the bottom of the screen. It follows the same rules as other cars, but the user sets its speed and its oncoming-gap limit. The camera follows it, so the road moves past it.
- Add a control panel to the right of the road:
  - User speed: 80–180 km/h in 5 km/h steps.
  - Cars per direction: 0–100.
  - Semis per direction: 0–20.
  - Slow trucks per direction: 0–10.
  - User's oncoming gap: 1.0–6.0 s in 0.1 s steps.
  - Simulation speed: 1× to 10×.
  - A Start/Pause button.
- Render at 60 frames per second, at every simulation speed.
- Add unit tests for the simulation with Vitest. Add `scripts/unit.sh`, which runs them in a container.
- Update the e2e tests for the new page.

## Capabilities

### New Capabilities

- `traffic-flow`: The simulated road, the vehicle types and their sizes and speeds, the following-distance rule, the vehicle counts, and the no-collision guarantee.
- `overtaking`: When a car starts an overtake, how it passes, when it returns to its lane, and the oncoming-traffic safety rule. This includes the user's adjustable gap.
- `simulation-view`: What the page draws: the grass background, the road, the vehicles, the camera that follows the user's car, and the 60 fps rendering.
- `simulation-controls`: The control panel: the sliders, their ranges, steps, and defaults, the Start/Pause button, and the simulation speed.

### Modified Capabilities

- `app-shell`: The script no longer renders a placeholder heading. It renders the simulation view into the root element instead.
- `static-build`: The build scenarios check for the simulation view instead of the placeholder heading. Assets such as the grass image must also load from a sub-path.
- `compose-stack`: Add `scripts/unit.sh` for unit tests in a container. The "only Docker on the host" rule covers it.

## Impact

- New files: `src/assets/grass.webp` (moved from the project root), simulation modules under `src/sim/`, view and control modules under `src/view/` and `src/ui/`, `src/style.css`, unit tests next to the modules, and `scripts/unit.sh`.
- Changed files: `index.html`, `src/main.ts`, `e2e/app-shell.spec.ts`, `e2e/static-build.spec.ts`, `Dockerfile` (new `unit` stage), `package.json`, `package-lock.json`, and `README.md`.
- New dev dependency: `vitest` 5.1.
- The app still has no runtime dependencies. It still builds to static files.
- The grass image has a faint watermark in its center. Tiling repeats the watermark across the page. The user can replace the file later without code changes.
- Out of scope:
  - Sound.
  - Keyboard control.
  - Curves, hills, or intersections.
  - Vehicle speeds other than the fixed speeds above.
  - Overtaking by trucks.
  - Zoom.
  - Saving slider values between visits.
  - Mobile layout.
