# Spec Delta

## MODIFIED Requirements

### Requirement: Vehicle types
The simulation SHALL use these vehicle types (length × width, desired speed, following time):

- Car: 4.5 m × 1.8 m, 90 km/h, 3 s.
- Semi: 16.5 m × 2.55 m, 80 km/h, 5 s.
- Slow truck: 9.0 m × 2.55 m, 65 km/h, 5 s.
- User's car: 4.5 m × 1.8 m, the "My speed" slider, the "Following distance" slider of the "Driving" group.

No vehicle SHALL drive faster than its speed limit. The speed limit is the desired speed. During an overtake of the user's car, it is the overtaking speed of that overtake. A vehicle above its speed limit, such as the user's car after an overtake at a higher overtaking speed, SHALL slow down toward the limit and SHALL NOT speed up.

#### Scenario: Free road
- **WHEN** a vehicle has no vehicle ahead in its lane within 500 m
- **THEN** it reaches its desired speed and keeps it

#### Scenario: Speed limit per vehicle
- **WHEN** the simulation runs for 20 simulated minutes with maximum counts and with default counts
- **THEN** no vehicle drives faster than its speed limit at any step

#### Scenario: Slowing after a fast overtake
- **WHEN** the user's car finishes an overtake at 180 km/h with "My speed" at 80 km/h
- **THEN** it slows toward 80 km/h
- **AND** it never speeds up while it is above 80 km/h

#### Scenario: User's following time
- **WHEN** the "Driving" "Following distance" slider is at 4.0 s and the user's car catches up with a slow truck
- **THEN** the user's car settles at 65 km/h with a following time of 4.0 s ± 0.1 s

### Requirement: No collisions
Vehicles SHALL never collide. The footprints of two vehicles SHALL never overlap: not in one lane, not during a lane change, and not head-on.

#### Scenario: Dense traffic and an aggressive user
- **WHEN** every count slider is at its maximum, the user's speed is 180 km/h, and the user's oncoming gap is 1.0 s
- **AND** the simulation runs for 20 simulated minutes, for each of 10 random seeds
- **THEN** no two vehicle footprints overlap at any step

#### Scenario: Default settings
- **WHEN** the sliders have their default values and the simulation runs for 20 simulated minutes, for each of 10 random seeds
- **THEN** no two vehicle footprints overlap at any step

#### Scenario: Tightest user settings
- **WHEN** the user's car has "My speed" at 80 km/h, "Overtaking speed" at 180 km/h, "Oncoming traffic gap" at 1.0 s, both following distances at their minimum, and "Cut-in gap" at 0.5 s
- **AND** the simulation runs for 20 simulated minutes with light traffic, for each of 10 random seeds
- **THEN** no two vehicle footprints overlap at any step

## ADDED Requirements

### Requirement: Following distance recovery
A vehicle whose following time is more than 0.1 s below its target SHALL drive 10 km/h slower than the vehicle ahead, or at its own desired speed if that is lower. It SHALL keep that speed until its following time is back at the target, and then follow normally. It SHALL change speed within the limits of the "Gradual speed changes" requirement.

#### Scenario: Car cut in at 2 s
- **WHEN** a car drives at 90 km/h and another car at 90 km/h moves into its lane 2 s ahead
- **THEN** the car slows to 80 km/h
- **AND** it returns to 90 km/h once its following time is 3 s

#### Scenario: Slow truck behind a faster car
- **WHEN** a slow truck at 65 km/h finds a car 2 s ahead that drives 90 km/h
- **THEN** the slow truck keeps 65 km/h, because 80 km/h is above its desired speed

#### Scenario: User raises the following distance
- **WHEN** the user's car follows a car at 90 km/h with 3 s and the user sets the "Driving" "Following distance" to 4.0 s
- **THEN** the user's car drives at 80 km/h until its following time is 4.0 s
- **AND** it then drives at 90 km/h again
