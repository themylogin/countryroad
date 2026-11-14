# Proposal

## Why

The simulation speed slider stops at 10×. Long drives take too much real time to watch, and the linear 1×–10× steps waste positions on small differences.

When the user's car follows a vehicle and does not overtake, the user cannot see why. The planner knows the reason, but the panel does not show it.

## What Changes

- The "Simulation speed" slider gets six positions: 1×, 2×, 4×, 10×, 30×, and 60×. The default stays 1×. The 3× and 5× speeds go away.
- The spec scenarios that use 3× now use 4×. The 60 fps scenario now uses 60×, the new top speed.
- A new paragraph below "Overtakes completed" explains why the user's car does not overtake. A horizontal rule (`<hr>`) separates it from the statistics.
- The paragraph shows only while the user's car follows a vehicle and does not overtake. At all other times, the panel shows neither the rule nor the paragraph.
- The reason is one short sentence from a fixed list of eight. The latest overtake decision of the user's car selects it.
- Four reasons show the planner's numbers: the gap it predicted and the gap it needs, or the speed it tried. An example is "Oncoming 800 m away, need 1120 m".
- Two reasons name the planner's fixed limits: 12 vehicles in a queue, and 90 s for one overtake.
- When one decision finds several reasons, the panel shows the one with the highest priority.
- Every slider gets an accessible value text that matches its shown value. The simulation speed slider needs this, because its raw value is a position, not a factor.

## Capabilities

### New Capabilities

- `overtake-reason`: shows why the user's car follows a vehicle and does not overtake. It covers the position of the reason in the panel, when it shows, the eight reason texts, their numbers, and how one decision selects one reason.

### Modified Capabilities

- `simulation-controls`: the simulation speed slider has six fixed positions from 1× to 60×. Its row leaves the slider table. A new "Simulation speed positions" requirement replaces "Simulation speed". It keeps the N× time rule, turns the 3× scenario into 4×, and adds a 60× scenario.
- `trip-stats`: the "Time follows the simulation speed" scenario uses 4× instead of 3×.
- `simulation-view`: the "High simulation speed" scenario uses 60× instead of 10×.

## Impact

- Code:
  - `src/ui/controls.ts`: the slider positions, the accessible value text, and the reason paragraph.
  - `src/style.css`: styles for the rule and the paragraph.
  - `src/main.ts`: passes the reason to the panel.
  - A new `src/ui/hold-reason.ts` maps reason codes to texts.
  - `src/sim/overtaking.ts`: the planner returns a reason when it does not plan.
  - `src/sim/world.ts`: each vehicle keeps its latest reason.
- Tests:
  - Unit tests for each reason, the priority rule, the text map, and the 60× frame clock.
  - The e2e slider table and the simulation speed helper change.
  - New e2e tests for the reason paragraph and for 60×.
- Performance: at 60×, each frame runs about 60 simulation steps. In Docker, 60 steps take about 1 ms at default traffic and about 4.4 ms at maximum counts. Both fit the 16.7 ms frame.
- Docs: the README sections on the controls and the trip statistics.
- Dependencies: none.
