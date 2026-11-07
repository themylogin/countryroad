# Spec Delta

## MODIFIED Requirements

### Requirement: Overtaking speed
Cars SHALL overtake at 90 km/h. The highest overtaking speed of the user's car SHALL be the higher of "My speed" and "Overtaking speed", as they are when the overtake starts. For its chosen return slot, the user's car SHALL overtake at the highest speed up to that value, in 5 km/h steps, that meets every return rule. An overtaking car SHALL accelerate within the limits of the `traffic-flow` capability. It SHALL NOT drive faster than its chosen speed to finish an overtake.

#### Scenario: Car passes a slow truck
- **WHEN** a car overtakes a slow truck
- **THEN** the car accelerates to 90 km/h and passes at that speed

#### Scenario: User overtakes faster than it cruises
- **WHEN** "My speed" is 100 km/h, "Overtaking speed" is 150 km/h, and the user's car overtakes a semi with no other vehicle within 3 km ahead
- **THEN** the user's car passes at 150 km/h
- **AND** it slows toward 100 km/h after its return lane change

#### Scenario: Overtaking speed below My speed
- **WHEN** "My speed" is 130 km/h, "Overtaking speed" is 100 km/h, and the user's car overtakes a semi with no other vehicle within 3 km ahead
- **THEN** the user's car passes at 130 km/h

#### Scenario: Slower pass into a short gap
- **WHEN** the user's car cuts in between two cars of a queue at 65 km/h
- **AND** its highest overtaking speed is 180 km/h
- **THEN** it passes at a speed below 180 km/h
- **AND** at the end of its return lane change it can slow to the speed of the car ahead while braking at 3 m/s² or less

## ADDED Requirements

### Requirement: Return slot choice
The user's car SHALL choose the return slot that passes the fewest vehicles, among the slots that meet every overtaking rule at some speed up to its highest overtaking speed.

#### Scenario: Cut in after one car of a queue
- **WHEN** the user's car follows a queue at 65 km/h at 1.0 s: car A, then car B 3 s behind a slow truck, with 3 s gaps
- **AND** "My speed" is 180 km/h, "Overtaking speed" is 130 km/h, "Oncoming traffic gap" is 1.0 s, and the "Overtaking" "Following distance" and "Cut-in gap" are both 0.5 s
- **AND** the oncoming lane is clear
- **THEN** the user's car passes car A only and returns between car A and car B
- **AND** car A is at least 0.5 s behind it and car B at least 0.5 s ahead of it

#### Scenario: Full speed past a queue when no gap fits
- **WHEN** the user's car follows a queue whose gaps are too short for any speed above the queue speed
- **AND** no vehicle is within 3 km ahead of the queue, and the oncoming lane is clear
- **THEN** the user's car passes the whole queue at its highest overtaking speed
