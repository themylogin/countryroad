# Spec Delta

## Purpose

Defines the control panel: the sliders that set the user's car, the traffic, and the simulation speed, and the button that starts and pauses the simulation.

## ADDED Requirements

### Requirement: Control panel placement
The page SHALL show a control panel to the right of the road. The panel SHALL hold six labeled sliders and one Start/Pause button. Each slider label SHALL show the current value with its unit. The panel SHALL state that the counts are per direction on 10 km of road.

#### Scenario: Panel on load
- **WHEN** the page loads
- **THEN** the control panel is to the right of the road
- **AND** it shows six labeled sliders and a Start button

### Requirement: Slider ranges, steps, and defaults
The sliders SHALL have these ranges, steps, and defaults:

| Label | Range | Step | Default |
|---|---|---|---|
| My speed | 80–180 km/h | 5 km/h | 130 km/h |
| Cars | 0–100 | 1 | 15 |
| Semis | 0–20 | 1 | 3 |
| Slow trucks | 0–10 | 1 | 2 |
| My overtaking gap | 1.0–6.0 s | 0.1 s | 6.0 s |
| Simulation speed | 1×–10× | 1× | 1× |

#### Scenario: Defaults on load
- **WHEN** the page loads
- **THEN** each slider shows its default value

#### Scenario: Step size
- **WHEN** the user moves the "My speed" slider one step up from 130 km/h
- **THEN** the slider shows 135 km/h

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
A slider change SHALL take effect at once, while the simulation runs and while it is paused, with one exception. A "My speed" change SHALL wait while an overtake involves the user's car, because that overtake was planned at the old speed. The change SHALL take effect when the overtake finishes. The count sliders SHALL change the counts as the `traffic-flow` capability defines. The "My overtaking gap" slider SHALL apply from the next overtake decision of the user's car.

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

### Requirement: Simulation speed
At a simulation speed of N×, simulated time SHALL pass N times as fast as real time.

#### Scenario: Three times as fast
- **WHEN** the simulation speed is 3× and the simulation runs for 10 s of real time
- **THEN** 30 s ± 0.5 s of simulated time pass
