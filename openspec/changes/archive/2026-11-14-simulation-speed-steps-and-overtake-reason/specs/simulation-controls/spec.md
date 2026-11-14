## MODIFIED Requirements

### Requirement: Slider ranges, steps, and defaults
The sliders SHALL have these groups, ranges, steps, and defaults:

| Group | Label | Range | Step | Default |
|---|---|---|---|---|
| Driving | My speed | 80–180 km/h | 5 km/h | 130 km/h |
| Driving | Following distance | 1.0–5.0 s | 0.1 s | 3.0 s |
| Overtaking | Overtaking speed | 80–180 km/h | 5 km/h | 130 km/h |
| Overtaking | Oncoming traffic gap | 1.0–6.0 s | 0.1 s | 6.0 s |
| Overtaking | Following distance | 0.5–3.0 s | 0.1 s | 2.0 s |
| Overtaking | Cut-in gap | 0.5–3.0 s | 0.1 s | 2.0 s |
| Traffic | Cars | 0–100 | 1 | 15 |
| Traffic | Semis | 0–20 | 1 | 3 |
| Traffic | Slow trucks | 0–10 | 1 | 2 |

The "Simulation" group SHALL hold the "Simulation speed" slider, with the positions that the "Simulation speed positions" requirement defines.

#### Scenario: Defaults on load
- **WHEN** the page loads
- **THEN** each slider shows its default value

#### Scenario: Step size
- **WHEN** the user moves the "My speed" slider one step up from 130 km/h
- **THEN** the slider shows 135 km/h

#### Scenario: Two following distances
- **WHEN** the page loads
- **THEN** the "Driving" group has a "Following distance" slider at 3.0 s
- **AND** the "Overtaking" group has a "Following distance" slider at 2.0 s

## ADDED Requirements

### Requirement: Simulation speed positions
The "Simulation speed" slider SHALL have six positions, from left to right: 1×, 2×, 4×, 10×, 30×, and 60×. One slider step SHALL move one position. The default SHALL be 1×. Assistive technology SHALL announce the shown factor, not the position number. At a simulation speed of N×, simulated time SHALL pass N times as fast as real time.

#### Scenario: Positions in order
- **WHEN** the user moves the "Simulation speed" slider one step at a time from 1× to the right
- **THEN** the slider shows 2×, 4×, 10×, 30×, and 60× in this order
- **AND** a further step right keeps 60×

#### Scenario: Four times as fast
- **WHEN** the simulation speed is 4× and the simulation runs for 10 s of real time
- **THEN** 40 s ± 0.5 s of simulated time pass

#### Scenario: Sixty times as fast
- **WHEN** the simulation speed is 60× and the simulation runs for 10 s of real time
- **THEN** 600 s ± 1 s of simulated time pass

## REMOVED Requirements

### Requirement: Simulation speed
**Reason**: The slider no longer has the linear steps 1× to 10×. The new "Simulation speed positions" requirement defines six fixed positions and keeps the N× time rule.

**Migration**: None. The slider keeps its label and its place in the "Simulation" group. The 3× scenario becomes the 4× scenario.
