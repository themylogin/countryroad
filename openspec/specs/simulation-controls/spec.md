# simulation-controls Specification

## Purpose

Defines the control panel: the sliders that set the user's car, the traffic, and the simulation speed, and the button that starts and pauses the simulation.

## Requirements

### Requirement: Control panel placement
The page SHALL show a control panel to the right of the road. The panel SHALL hold four labeled groups in this order: "Driving", "Overtaking", "Traffic", and "Simulation". Together they SHALL hold ten labeled sliders, one Start/Pause button, and the trip statistics. Each slider label SHALL show the current value with its unit. The "Traffic" group SHALL state that the counts are per direction on 10 km of road.

#### Scenario: Panel on load
- **WHEN** the page loads
- **THEN** the control panel is to the right of the road
- **AND** it shows the groups "Driving", "Overtaking", "Traffic", and "Simulation" in this order
- **AND** it shows ten labeled sliders, a Start button, and the trip statistics below that button

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

### Requirement: Start and pause
On load, the simulation SHALL be paused, with all vehicles in place. The button SHALL read "Start" while the simulation is paused and "Pause" while it runs. Each press SHALL switch between the two states.

#### Scenario: First start
- **WHEN** the user presses "Start"
- **THEN** the vehicles start to move
- **AND** the button reads "Pause"

#### Scenario: Pause
- **WHEN** the user presses "Pause"
- **THEN** all vehicles stop on screen
- **AND** the button reads "Start"

### Requirement: Slider changes apply at once
A slider change SHALL take effect at once, while the simulation runs and while it is paused, with one exception. A "My speed" change SHALL wait while an overtake involves the user's car, because that overtake was planned at the old speed. The change SHALL take effect when the overtake finishes. The count sliders SHALL change the counts as the `traffic-flow` capability defines. The four sliders of the "Overtaking" group SHALL apply from the next overtake decision of the user's car.

#### Scenario: Change speed while running
- **WHEN** the simulation runs and the user sets "My speed" to 100 km/h
- **THEN** the user's car changes speed toward 100 km/h within the acceleration limits

#### Scenario: Lower speed during an overtake
- **WHEN** the user's car overtakes at 150 km/h and the user sets "My speed" to 100 km/h
- **THEN** the user's car keeps 150 km/h until it finishes its return lane change
- **AND** it then slows toward 100 km/h

#### Scenario: Higher speed during an overtake
- **WHEN** the user's car overtakes at 130 km/h and the user sets "My speed" to 180 km/h
- **THEN** the user's car keeps 130 km/h until it finishes its return lane change
- **AND** it then speeds up toward 180 km/h

#### Scenario: Speed change while another car passes
- **WHEN** another car overtakes the user's car and the user sets "My speed" to 180 km/h
- **THEN** the user's car keeps its old desired speed until that car finishes its return lane change
- **AND** that car returns with at least 2 s to the user's car

#### Scenario: Change counts while paused
- **WHEN** the simulation is paused and the user sets "Cars" to 60
- **THEN** each direction holds 60 cars at once
- **AND** the only exception is a lack of room, and then the missing cars appear once the simulation runs and room appears

#### Scenario: Driving following distance while running
- **WHEN** the user's car follows a car at 3 s and the user sets the "Driving" "Following distance" to 4.0 s
- **THEN** the user's car starts to recover the longer following distance at once

#### Scenario: Overtaking sliders during an overtake
- **WHEN** the user's car overtakes and the user changes any slider of the "Overtaking" group
- **THEN** the running overtake keeps its old values
- **AND** the next overtake decision of the user's car uses the new values

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
