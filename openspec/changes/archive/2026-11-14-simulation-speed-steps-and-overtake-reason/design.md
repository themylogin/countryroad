# Design

## Context

See proposal.md for the motivation. These parts of the current code shape the approach:

- `createSlider` in `src/ui/controls.ts` takes `min`, `max`, `step`, `value`, `format`, and `apply`. The `<output>` shows `format(value)`. No slider sets `aria-valuetext`.
- `FrameClock` does not depend on the speed. Each frame adds `speed × elapsed` of simulated time. It caps `elapsed` at 100 ms, so one frame runs at most 6 s of simulated time at 60× (360 steps).
- Step cost, measured in Docker (`countryroad-builder` image, Node 26), over 120 simulated seconds:

  | Traffic | Per step | 60 steps, mean | 60 steps, worst |
  |---|---|---|---|
  | Default (15/3/2) | 17 µs | 1.0 ms | 3.5 ms |
  | Maximum (100/20/10) | 73 µs | 4.4 ms | 9.9 ms |

- `overtakingRules.maybeStart` runs every 0.5 s (`PLAN_INTERVAL`) while a car cruises. It calls `isConstrained` and then `planOvertake`, which returns a plan or `null`. The `null` hides the cause.
- `planOvertake` has early exits: an empty queue, no candidate speed for the first vehicle, and the 4 s oncoming check. The user's car then tries every return slot from the queue end down to 0. Traffic cars try slots upward and stop at the first failure that is not `noFit`.
- `planSlot` checks in this order:
  1. `cannotPass`.
  2. The horizon (`blocked`, when the next vehicle is unknown).
  3. For each candidate speed: the pull-out room, the return time, and the return gap ahead.
  4. For the first speed that fits: the passing lane, then the oncoming traffic.

## Goals / Non-Goals

**Goals:**

- The reason is the result of the real decision. No second evaluation runs.
- The planner makes the same decisions as before. Only its return value gains a reason.
- The simulation layer has reason codes and raw numbers. The UI layer owns the texts and the rounding.

**Non-Goals:**

- Showing reasons for traffic cars.
- Smoothing or holding a reason to stop it from changing between decisions.
- Changing any overtaking rule, threshold, or decision interval.
- Speed-ups of the simulation step. The measured cost fits 60×.

## Decisions

### 1. Speed slider with six positions

The input has `min` 0, `max` 5, and `step` 1. Its value is a position. One list in `controls.ts`, `[1, 2, 4, 10, 30, 60]`, maps a position to a factor. `format`, `apply`, and the default position all use this list. `DEFAULT_SETTINGS.simulationSpeed` stays the factor 1. The slider starts at the position of that factor.

Alternatives:

- A `<select>`: rejected. It breaks the uniform slider panel, and it does not step with the arrow keys the same way.
- Radio buttons: rejected. Six buttons do not fit well in the 260 px panel.
- A 1–60 range with a `<datalist>`: rejected. Range inputs do not snap to `datalist` values.

### 2. `aria-valuetext` on every slider

`createSlider` sets `aria-valuetext` to `format(value)` at creation and on each `input` event. Without it, a screen reader reads the position number, for example "0", for the speed slider. All sliders get it, so `createSlider` keeps one code path.

### 3. No frame clock change

The measured worst case is 9.9 ms for one frame at 60×, at maximum counts. This is below the 16.7 ms frame. The 100 ms cap limits the catch-up after a stall to 360 steps, about 26 ms at maximum counts. Thus a slow frame cannot start a chain of slower frames. On a slow device, the simulation runs slower than 60×, but it does not freeze.

Rejected alternatives: a cap on steps per frame, and a Web Worker for the simulation. Both add complexity that the numbers do not justify.

### 4. Reason codes and priority

`overtaking.ts` exports a tuple of codes, from the highest priority to the lowest:

`['oncoming', 'laneBusy', 'queueTooLong', 'noGap', 'tooClose', 'tooLong', 'canReachSpeed', 'notSlower']`

`HoldReason` is the union of these codes. A code's priority is its index. A small helper, `strongerHold`, returns the stronger of two holds:

- A higher priority wins.
- For the same code, the try closer to its need wins, that is, the smaller `need − gap`.
- For `tooLong`, the higher speed wins.

The order puts the most useful explanation first, not the last check that ran:

- `queueTooLong` ranks above `noGap`. In a long, tight queue, every visible slot fails with `noGap`, and only the last slot sees the horizon. With the reverse order, the queue reason would almost never show.
- `tooClose` ranks above `tooLong`. The car prefers its highest speed, and the pull-out room fails first at high speeds. The lower speeds then fail as too slow. The pull-out room is the real cause.

### 5. `planOvertake` returns a decision with numbers

The new return type is `{ kind: 'plan'; plan } | { kind: 'hold'; hold: Hold | null }`. `Hold` is a union on `reason`:

| Reason | Numbers |
|---|---|
| `oncoming` | `gap` (the current distance) and `need`, in metres |
| `noGap` | `gap` (the current space between the two vehicles) and `need`, in seconds at the speed of the vehicle to pass last |
| `tooClose` | `gap` and `need`, in metres |
| `tooLong` | `speed`, in m/s |
| `laneBusy`, `queueTooLong`, `canReachSpeed`, `notSlower` | none |

Every current `return null` becomes a hold:

| Exit | Hold |
|---|---|
| Empty queue | `null`. This cannot happen while the car follows a vehicle. |
| No candidate speed for the first vehicle | `canReachSpeed` |
| 4 s oncoming check fails | `oncoming`, with the numbers of that check |
| Slot `cannotPass` | `canReachSpeed` |
| Slot `blocked`, next vehicle unknown | `queueTooLong` |
| Speed fails the pull-out room | `tooClose` |
| Speed fails the return time (`returnEnd` is `null`) | `tooLong`, with that candidate speed |
| Speed fails the return gap ahead | `noGap` |
| Slot `blocked` at the passing lane | `laneBusy` |
| Slot `blocked` at the oncoming check | `oncoming`, with the numbers of that check |

A `noFit` slot carries the strongest hold among its candidate speeds. Each failed slot result carries its hold, and the result kinds stay as they are. The user's loop keeps the strongest hold over all slots. The traffic loop keeps its control flow: it still stops at the first failure that is not `noFit`.

The checks return numbers instead of booleans. Each caller makes the same comparison as today, so every decision stays the same:

- `oncomingClear` becomes `oncomingConflict(world, car, motion, end, limit)`. Each vehicle fails by the same test as today: alongside, or `gapAtEnd / (speedAtEnd + oncomingSpeed) < limit + TIME_MARGIN`. For a failing vehicle, the need is `travelled + oncomingSpeed × end + limit × (speedAtEnd + oncomingSpeed)`, without the margin, and the gap is its current distance, or 0 when it is alongside. The function returns the failing vehicle with the largest `need − gap`, or `null` when no vehicle fails.
- `pullOutClear` becomes `pullOutRoom(world, ahead, motion)`. It returns the predicted room at the end of the lane change out, and `Infinity` when no vehicle is ahead. The caller fails the check when `room < PULL_OUT_MARGIN`. The hold has `gap`, the current gap to the first vehicle, and `need = gap − room + PULL_OUT_MARGIN`.
- The return gap check keeps its comparison in metres with `DISTANCE_MARGIN`. For the hold, `space` is the current distance from the front of the passed vehicle to the rear of the next vehicle. The need in metres is `space + needed − gapAhead`, without the margin. This is the space that would leave exactly `needed` ahead at the end. Both divide by the current speed of the passed vehicle, with a floor of 0.1 m/s. Thus `need − gap` is the shortfall of the check, and "between" is below "needed" exactly when the check fails.

When the 4 s check fails, the decision is a hold, but for the user's car the slot loop still runs to find the numbers. A slot plan cannot pass then: its maneuver is at least 4 s long, at least as fast, and ends at least as fast. So every oncoming vehicle that fails the 4 s check also fails the slot check. If the slot loop returns a plan anyway, the hold keeps the numbers of the 4 s check. If its strongest hold is `oncoming`, the hold takes those numbers. Otherwise, it keeps the numbers of the 4 s check, because oncoming traffic has the highest priority and blocks every overtake. Before this rule, the need dropped from the real plan, for example 2849 m, to the 4 s check, for example 486 m, each time an oncoming car came within the 4 s need. Traffic cars keep the early return, because nobody reads their holds.

A failing oncoming check now looks at every oncoming vehicle, and does not stop at the first one that fails. A passing check already does this, so the worst case does not change.

The two test call sites in `overtaking.test.ts` change from `!== null` to `kind === 'plan'`.

Rejected alternative: a separate `explainHold()` that runs the checks again when the stats refresh. It duplicates the planner logic, it can disagree with the real decision, and it adds planner runs.

### 6. Following test and the stored hold

`isConstrained` splits into two parts:

- `followedLeader(world, vehicle)` returns the home-lane leader when it is within `followingTime × speed + 20 m`. Otherwise it returns `null`.
- A speed test: the leader drives slower than the desired speed in force, less 1 km/h.

`isConstrained` stays exported, and it uses both parts. `Vehicle` gets `hold: Hold | null`, with `null` at creation. After the existing phase and plan-time gates, `maybeStart` sets it:

1. No followed leader: `null`.
2. A followed leader that is not slower: `notSlower`.
3. A plan: `null`, and the overtake starts.
4. A hold: the hold of the decision.

The hold stays `null` during an overtake, because `maybeStart` returns early outside the `cruise` phase. It stays `null` for 0.5 s after the overtake ends, until the next decision. The hold is stored for every overtaking vehicle, because this is cheap and easy to test. The UI reads only `world.user.hold`.

### 7. Panel paragraph

`src/ui/hold-reason.ts` exports `holdText(hold: Hold): string`. A `switch` on `reason` builds each text, and the compiler requires a case for every code. The rounding is in this module:

- Seconds: the gap is `Math.floor(gap × 10 + 1e-9) / 10`, and the need is `Math.ceil(need × 10 − 1e-9) / 10`. Both show with `toFixed(1)`.
- Metres: `Math.floor` for the gap and `Math.ceil` for the need, with the same tolerance.
- Seconds above 99.9 s show as 99.9 s, so that a very slow vehicle to pass does not give a long number.
- Speed: whole km/h with `Math.round`.

The 1e-9 tolerance stops float errors from moving an exact value to the next step, for example 2.0 s to "2.1 s needed".

After the `<dl class="trip-stats">`, `createControls` adds `<div class="hold-reason" hidden>` with an `<hr>` and a `<p>`. A new `Controls.updateHoldReason(text: string | null)` works like this:

- For `null`, it sets `hidden`.
- Otherwise, it sets the paragraph text and clears `hidden`.

It writes only on a change, like `updateStats`. `refreshStats` in `main.ts` calls it with `holdText(world.user.hold)`, or with `null` when there is no hold. So the reason refreshes with the statistics. One wrapper hides the rule and the paragraph with one attribute. The `<hr>` is the thematic break that the user asked for.

The CSS styles the `<hr>` as a 1 px line in the panel colors, and the paragraph in the label color. `.hold-reason` sets no `display` value, so the `hidden` attribute keeps working.

## Risks / Trade-offs

- [The planner refactor changes a decision] → The existing overtaking tests and the six long-run files run unchanged. The refactor keeps the check order and the loop flow.
- [The text and its numbers change between decisions, for example from an oncoming gap to "Another vehicle is overtaking."] → This shows the real state. It is accepted, and smoothing is a non-goal.
- [Inside the safety margins, a failing number can read the same as its need, for example "2.0 s gap, 2.0 s needed". For the oncoming distance, the 0.05 s margin is about 3 m at the sum of both speeds] → This lasts only a moment. The margins stay, because they protect the overtaking rules.
- [The return gap was the room left in front of the user's car after the cut-in, in seconds at its own speed. It did not match the visible space between the two cars] → The return reason shows the current space between the two cars and the space needed, both in seconds at the speed of the vehicle to pass.
- [A very slow vehicle to pass gives "99.9 s between the cars, 99.9 s needed" while the return fails] → This needs a vehicle below about 5 km/h, which is rare on this road. It is accepted.
- [The time gap at the return was 0.0 s in about two-thirds of the oncoming reasons. It is negative when the two vehicles would meet during the overtake, and in about half of these cases the vehicle was beyond the 225 m of visible road] → The oncoming reason shows the current distance and the needed distance in metres. These numbers are never stuck at 0 and show that the vehicle is beyond the view.
- [The reason is up to 0.5 s of simulated time old] → This is accepted. At 1×, it is half a second.
- [A slow device cannot keep 60×] → The 100 ms cap keeps the page responsive. The spec scenario uses ideal frame times in a frame-clock unit test. The e2e check uses a loose lower bound.
- [The car drives faster than its highest overtaking speed, for example just after the user lowers both speeds] → The candidate list is empty, and the reason reads `canReachSpeed`. This is rare and short, and it is accepted.
- [The "Reason texts" requirement is longer than 500 characters] → It is a warning, like two existing ones. One table keeps the priorities in one place.

## Migration Plan

None. This is a static app with no stored state. To roll back, revert the change.
