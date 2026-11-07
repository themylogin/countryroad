# Spec Delta

## Purpose

Defines the simulated road, the vehicle types, how vehicles follow each other, how many vehicles drive, and the guarantee that vehicles never collide.

## ADDED Requirements

### Requirement: Two-lane road with right-hand traffic
The road SHALL have one lane per direction, and traffic SHALL drive on the right. The user's direction SHALL drive toward the top of the page in the right lane. Oncoming traffic SHALL drive toward the bottom of the page in the left lane. A vehicle SHALL use the other lane only while it overtakes.

#### Scenario: Lanes after start
- **WHEN** the simulation starts
- **THEN** every vehicle in the user's direction is in the right lane
- **AND** every oncoming vehicle is in the left lane

### Requirement: Closed stretch of road
The simulation SHALL model a closed stretch of road, 10 km long per direction. A vehicle that reaches one end SHALL continue from the other end. Vehicles SHALL NOT appear or disappear unless a count slider changes.

#### Scenario: Counts stay constant
- **WHEN** the simulation runs for 10 simulated minutes and no slider changes
- **THEN** each direction holds the same number of cars, semis, and slow trucks as at the start

### Requirement: Vehicle types
The simulation SHALL use these vehicle types (length × width, desired speed, following time):

- Car: 4.5 m × 1.8 m, 90 km/h, 3 s.
- Semi: 16.5 m × 2.55 m, 80 km/h, 5 s.
- Slow truck: 9.0 m × 2.55 m, 65 km/h, 5 s.
- User's car: 4.5 m × 1.8 m, the user's speed slider, 3 s.

No vehicle SHALL drive faster than its desired speed.

#### Scenario: Free road
- **WHEN** a vehicle has no vehicle ahead in its lane within 500 m
- **THEN** it reaches its desired speed and keeps it

#### Scenario: Speed limit per vehicle
- **WHEN** the simulation runs for 20 simulated minutes with maximum counts and with default counts
- **THEN** no vehicle drives faster than its desired speed at any step

### Requirement: Following distance
A vehicle that follows a slower vehicle in its lane SHALL settle at its following time. The following time is the gap from the leader's rear to the follower's front, divided by the follower's speed. The distance in meters therefore shrinks when a queue drives slower.

#### Scenario: Car behind a slow truck
- **WHEN** a car catches up with a slow truck and does not overtake
- **THEN** the car settles at 65 km/h with a following time of 3.0 s ± 0.1 s, about 54 m

#### Scenario: Semi behind a slow truck
- **WHEN** a semi catches up with a slow truck
- **THEN** the semi settles at 65 km/h with a following time of 5.0 s ± 0.1 s, about 90 m

#### Scenario: Car behind a car
- **WHEN** a car follows another car that drives at 90 km/h
- **THEN** the gap stays at 3 s or more, and both drive at 90 km/h

### Requirement: Gradual speed changes
Vehicles SHALL change speed gradually. Cars and the user's car SHALL accelerate at most 2.0 m/s². Semis and slow trucks SHALL accelerate at most 0.8 m/s². No vehicle SHALL brake harder than 8.0 m/s².

#### Scenario: Limits in every step
- **WHEN** the simulation runs for 20 simulated minutes with maximum counts
- **THEN** no vehicle's speed changes faster than its limits in any time step

### Requirement: No collisions
Vehicles SHALL never collide. The footprints of two vehicles SHALL never overlap: not in one lane, not during a lane change, and not head-on.

#### Scenario: Dense traffic and an aggressive user
- **WHEN** every count slider is at its maximum, the user's speed is 180 km/h, and the user's oncoming gap is 1.0 s
- **AND** the simulation runs for 20 simulated minutes, for each of 10 random seeds
- **THEN** no two vehicle footprints overlap at any step

#### Scenario: Default settings
- **WHEN** the sliders have their default values and the simulation runs for 20 simulated minutes, for each of 10 random seeds
- **THEN** no two vehicle footprints overlap at any step

### Requirement: Vehicle counts follow the sliders
Each direction SHALL hold the number of cars, semis, and slow trucks that the count sliders set. Both directions SHALL hold the same counts. The user's car SHALL NOT count as a car. When there is no room for a new vehicle, the simulation SHALL add it as soon as room appears.

#### Scenario: Initial placement
- **WHEN** the page loads
- **THEN** each direction holds the default counts
- **AND** every gap between two vehicles in a lane is at least the follower's following time at 65 km/h

#### Scenario: Raise a count
- **WHEN** the user raises a count slider
- **THEN** the simulation adds vehicles of that type to each direction
- **AND** it places each new vehicle outside the visible part of the road, when such room exists
- **AND** each new vehicle has at least its following time to the vehicle ahead, and the vehicle behind has at least its own following time

#### Scenario: Lower a count
- **WHEN** the user lowers a count slider
- **THEN** the simulation removes vehicles of that type from each direction
- **AND** it removes vehicles outside the visible part of the road first
- **AND** it never removes the user's car
