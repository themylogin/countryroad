# Design

## Context

See proposal.md - Why. The current code fixes these values:

- The user's following time is `VEHICLE_TYPES.user.followingTime = 3`, copied into a read-only `Vehicle.followingTime`.
- The return gaps are the constants `GAP_BEHIND = 2` and `GAP_AHEAD = 3` in `src/sim/overtaking.ts`, for every car.
- The user's overtaking speed is the user's desired speed, read through `World.effectiveDesiredSpeed`.
- `WorldOptions` carries `userSpeed` and `userGap`. Ten test files build a `World` with them.
- Following uses IDM+ in `src/sim/following.ts`. Its equilibrium gap is `0.5 m + T·v`, so a settled follower sits just above its following time.
- The controls are a flat list of six sliders in `src/ui/controls.ts`, with one handler per slider.

The user confirmed these points before planning:

- The new sliders set the user's car only.
- The "Overtaking" "Following distance" is the gap ahead at return.
- Recovery means 10 km/h slower than the vehicle ahead, until the following time is back.
- The names "Cut-in gap" and "Overtakes completed".

## Goals / Non-Goals

**Goals:**

- One user-settings object that the world, the planner, and the controls share.
- Recovery that replaces IDM+ braking only when a vehicle is clearly too close, so settled queues behave as before.
- No loss of the guarantees: no collisions, and every overtake meets its rules, now with per-overtake limits.
- Statistics that come from the world, with pure formatting functions that unit tests can check.

**Non-Goals:**

- New rules for traffic. Traffic keeps its following times, its 2 s / 3 s return gaps, and its 6 s oncoming gap.
- Statistics for other vehicles, a reset button, or persistent settings.

## Decisions

### User settings object

`src/sim/world.ts` gets:

```ts
export interface UserSettings {
  speed: number;                // m/s, "My speed"
  followingTime: number;        // s, "Driving" "Following distance"
  overtakingSpeed: number;      // m/s, "Overtaking speed"
  oncomingGap: number;          // s, "Oncoming traffic gap"
  returnFollowingTime: number;  // s, "Overtaking" "Following distance"
  cutInGap: number;             // s, "Cut-in gap"
}
```

- `WorldOptions` replaces `userSpeed` and `userGap` with `user: UserSettings`.
- `World.setUser(partial)` applies a change.
- The world applies `speed` through the existing hold, which waits while an overtake involves the user's car.
- `followingTime` takes effect at once, so `Vehicle.followingTime` becomes writable.
- The other four values are read when the planner starts an overtake. They are stored in the `Maneuver`, so a running overtake never sees a change.

Alternative: one setter per slider. Six setters and six handler entries add code and do not add clarity.

A test helper, `userSettings(overrides)`, builds the object from the defaults. The ten test files then change one line each.

### Maneuver limits

`Maneuver` gets three new fields: `behindTime` (the cut-in gap), `aheadTime` (the return following distance), and `limit` (the oncoming gap, which exists today). The planner fills them in:

- Traffic cars: 2, 3, and 6.
- The user's car: its settings.

The return check and the finish event use the stored values. `OvertakeFinishEvent` reports `behindLimit` and `aheadLimit` next to the measured gaps. The long-run check compares each event against its own limits instead of constants.

### Overtaking speed

The planner uses `v_ot = max(speed, overtakingSpeed)` for the user's car and the desired speed for traffic. `effectiveDesiredSpeed` already returns `maneuver.speed` during a maneuver, so:

- the speed-limit invariant allows the higher speed during the overtake;
- after the return, the free-road term brakes at the comfortable rate back toward "My speed".

Other vehicles still predict the user's car at 180 km/h in their oncoming checks, so a high overtaking speed is already covered.

### Following distance recovery

`Vehicle` gets a `recovering: boolean` field. Each step, for a vehicle in `cruise` with a home-lane leader:

- **Start:** the time gap `gap / speed` is below `T − 0.1 s`.
- **Stop:** the time gap is back at `T` or more.
- **While recovering:**
  - the target speed is `min(desiredSpeed, leader.speed − 10 km/h)`;
  - the acceleration toward the target is `−comfortableBraking` above it, and up to `maxAcceleration` below it, so the vehicle holds the target once it reaches it;
  - a kinematic safety term caps the result. When the vehicle closes in and the needed braking `(v − v_lead)² / (2·max(gap − 2 m, 0.1 m))` exceeds the comfortable rate, it brakes at least that hard. The result stays clamped to `[−8.0, a_max]`.
- **Otherwise:** IDM+ as today.

The 0.1 s band keeps IDM+'s small approach errors from starting recovery. A settled follower sits at `0.5 m + T·v`, above the stop threshold, so settled queues never toggle. The function lives in `following.ts` as `recoveryAcceleration(driver, leader)`. A pure `nextRecovering(recovering, timeGap, followingTime)` holds the start and stop rule, so unit tests can drive both without a world.

Alternative: rely on IDM+ alone. IDM+ also opens a short gap, but at a speed that depends on the gap, not at 10 km/h below the leader. The request asks for the explicit rule.

### Braking room at return

The planner's gap-ahead check and `returnReady` both require the following at the end of the return lane change:

`gapAhead ≥ max(aheadTime · v, (v − v_low)² / (2 · 3 m/s²) + 2 m) + 1 m`

- `v` is the returning car's speed at that time.
- `v_low` is the low speed bound of the vehicle ahead.

After the return, recovery or IDM+ slows the car. The safety term in recovery brakes at least as hard as needed, and this floor keeps the needed rate at 3 m/s² or less. The safety-net return, used only when a return is late, keeps its 1 s floor and also gets the braking room term.

### Pull-out room

The long runs at the user's 2 s return gap found a new case. The user's car came back at 180 km/h only 2 s behind a car at 90 km/h. It was still braking when the planner started its next overtake. The lane change out is kinematic and occupies the home lane for 2 s, so the car touched the vehicle ahead.

The planner now also requires that the gap to the vehicle ahead stays at least 2 m during the lane change out. It predicts that vehicle at its low speed bound and the overtaker on its acceleration ramp. The gap is smallest at the end of the lane change, so one check there covers the whole lane change.

### Speed limit after a fast overtake

After an overtake at a higher "Overtaking speed", the user's car is above "My speed" until it has braked back down. The `traffic-flow` spec therefore says that a vehicle above its limit slows down toward the limit and never speeds up. The invariant monitor checks exactly that. A speed increase must stay within the limit that applied during the step, which is still the overtaking speed in the step where the overtake finishes.

### Speed bounds of recovering vehicles

`speedBounds` gives the low speed of the vehicle ahead. A recovering vehicle will slow to `leader.speed − 10 km/h`, which can be below every current speed in the chain. For each vehicle in the chain, the low bound therefore uses the lower of its current speed and, while it recovers, its target speed. The high bound needs no change, because recovery only lowers speeds.

A new recovery can also start during an overtake, after an IDM+ approach error larger than 0.1 s. The long-run tests flag any late return, and a late return is how a wrong bound shows up. If one appears, the fix is to treat closing vehicles in the chain as recovering.

### Trip statistics

- `World` gets `userDistance` (the sum of `user.speed · dt` per step) and `userOvertakes` (incremented on the user's finish event). Time is `world.time`. The values change only in `step()`, so a pause freezes them.
- `src/ui/trip-stats.ts` holds pure formatters, unit-tested without a DOM: `formatSpeed`, `formatDistance`, `formatTime` (h:mm:ss), and `formatAverage`, which returns "–" at time 0.
- `main.ts` updates the statistics DOM at most every 250 ms of real time, and at once after Start or Pause. That gives the required 4 refreshes per second and avoids DOM writes in every frame.

### Control panel layout

- Each group is a `<fieldset>` with a `<legend>`: "Driving", "Overtaking", "Traffic", "Simulation". A fieldset has the accessible role `group`, named by its legend.
- Two sliders share the label "Following distance". Their ids are `driving-following` and `overtaking-following`. The e2e tests address them with `getByRole('group', { name: 'Driving' }).getByRole('slider', { name: 'Following distance' })`.
- The statistics are a `<dl class="trip-stats">` below the Start/Pause button in the "Simulation" group. Each `<dt>` is a label and each `<dd>` a value.
- The layout is more compact than before: smaller gaps between sliders, and 13 px text. The panel has `max-height: calc(100vh - 48px)` with `overflow-y: auto`, so a short window scrolls the panel instead of cutting it off.
- `controls.ts` takes one handler per kind of setting: `setUser(partial)`, `setCount(kind, n)`, `setSimulationSpeed(n)`, `toggleRunning()`. It returns the panel and an `updateStats(stats)` function.

### Tests

- **`following.test.ts`:**
  - A car cut in at 2 s drives at 80 km/h and returns to 90 km/h at 3 s.
  - A slow truck keeps 65 km/h behind a faster car.
  - The user's car settles at 4.0 s.
  - No recovery starts in the existing approach tests.
- **`overtaking.test.ts`:**
  - Overtaking speed above and below "My speed".
  - The default and tight return gaps.
  - The braking-room scene.
  - Overtaking sliders changed mid-overtake.
- **`world.test.ts`:** the trip distance, the overtake counter, and the driving following time applied at once.
- **`src/ui/trip-stats.test.ts`:** the formats from the `trip-stats` spec.
- **`long-run-tight.test.ts`:** a new long-run file with 10 seeds of light traffic at the tightest user settings, from the `traffic-flow` "Tightest user settings" scenario. The existing long-run files keep their settings in the new object.
- **E2E:** `e2e/simulation.spec.ts` addresses sliders by group, and checks the group order and both "Following distance" sliders. A new `e2e/trip-stats.spec.ts` checks:
  - the values on load;
  - that the time and distance grow while running;
  - that nothing changes while paused;
  - more than 4 changes of the time in 1 s at 10×.

## Risks / Trade-offs

- [IDM+ approach errors start recovery, and a car visibly drops 10 km/h at the end of an approach] → The 0.1 s band. The existing approach tests assert that no recovery starts.
- [A recovery that starts during an overtake makes the gap ahead smaller than predicted] → The low bound covers vehicles that recover at plan time. The long-run tests flag any late return. The fix path is in "Speed bounds of recovering vehicles".
- [A panel with ten sliders and statistics is tall] → The compact layout, and a scrolling panel in short windows. The e2e tests run at 1280 × 720, where Playwright scrolls to each control.
- [Run time of `scripts/unit.sh` grows by the new long-run file] → Light traffic runs about 1.5 s per seed, so the budget of 2 minutes holds.

## Migration Plan

None. The defaults reproduce today's behavior, except for three points:

- The user's return following distance drops from 3 s to 2 s.
- Recovery replaces IDM+ when a vehicle is more than 0.1 s too close.
- The braking floor applies to every return.
