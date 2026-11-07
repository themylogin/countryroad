# simulation-view Specification

## Purpose

Defines what the page draws: the grass background, the road, the vehicles, the camera that follows the user's car, and the frame rate.

## Requirements

### Requirement: Grass background
The page SHALL show the grass image tiled across the full page as its background, at the image's own pixel size. The grass SHALL move with the road. While the simulation runs, the grass scrolls down past the user's car at the user's speed.

#### Scenario: Background on load
- **WHEN** the page loads
- **THEN** the grass image covers every part of the page outside the road and the control panel

#### Scenario: Grass moves with the road
- **WHEN** the simulation runs
- **THEN** the grass moves down the page at the same rate as the road markings

### Requirement: Road
The page SHALL draw a straight two-lane road, seen from above, from the bottom edge to the top edge of the page. Each lane SHALL be 3.5 m wide. The road SHALL show a solid line at each edge and a dashed center line.

#### Scenario: Road on load
- **WHEN** the page loads
- **THEN** the road runs from the bottom edge to the top edge of the page
- **AND** it shows two edge lines and a dashed center line

### Requirement: Scale
The view SHALL draw the road and all vehicles to one scale. At that scale, the page height shows 250 m of road. Vehicles SHALL keep the proportions of their real sizes.

#### Scenario: Window height changes
- **WHEN** the user resizes the window
- **THEN** the view still shows 250 m of road from the bottom edge to the top edge

### Requirement: Vehicle drawing
The view SHALL draw each vehicle from above, at its position in the lane. The user's car SHALL be red. All other vehicles SHALL be grey. Each vehicle type SHALL have its own shape: a car body with windows, a semi with a tractor and a long trailer, and a slow truck with a cab and a mixer drum.

#### Scenario: Colors
- **WHEN** the page loads
- **THEN** the user's car is red
- **AND** every other vehicle is grey

#### Scenario: Lane change on screen
- **WHEN** a vehicle changes lanes
- **THEN** the view moves it sideways between the lane centers over the 2 s of the lane change

### Requirement: Camera follows the user's car
The user's car SHALL stay at a fixed height near the bottom of the page. Its front SHALL be 25 m above the bottom edge. The road, the grass, and all other vehicles SHALL move relative to the user's car. During an overtake, the user's car SHALL move sideways on the screen.

#### Scenario: Faster than traffic
- **WHEN** the user's car drives at 130 km/h
- **AND** cars ahead of it in its lane drive at 90 km/h
- **THEN** those cars move down the page toward the user's car

#### Scenario: Fixed height
- **WHEN** the simulation runs at any speed
- **THEN** the front of the user's car stays 25 m above the bottom edge of the page

### Requirement: 60 frames per second
The view SHALL redraw 60 times per second while the page is visible, on displays that refresh at 60 Hz or faster. The frame rate SHALL NOT depend on the simulation speed. The simulation speed SHALL change only how much simulated time passes per frame.

#### Scenario: Fast display
- **WHEN** the display refreshes at 120 Hz
- **THEN** the view redraws 60 times per second, not 120

#### Scenario: High simulation speed
- **WHEN** the simulation speed is 10×
- **THEN** the view still redraws 60 times per second
- **AND** each frame advances the simulation by 10 times the real time since the previous frame

#### Scenario: Paused
- **WHEN** the simulation is paused
- **THEN** the view keeps the last state on screen, and no vehicle moves
