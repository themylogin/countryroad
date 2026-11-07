# Spec Delta

## MODIFIED Requirements

### Requirement: Overtaking speed
Cars SHALL overtake at 90 km/h. The user's car SHALL overtake at the higher of "My speed" and "Overtaking speed", as they are when the overtake starts. An overtaking car SHALL accelerate within the limits of the `traffic-flow` capability. It SHALL NOT drive faster than its overtaking speed to finish an overtake.

#### Scenario: Car passes a slow truck
- **WHEN** a car overtakes a slow truck
- **THEN** the car accelerates to 90 km/h and passes at that speed

#### Scenario: User overtakes faster than it cruises
- **WHEN** "My speed" is 100 km/h, "Overtaking speed" is 150 km/h, and the user's car overtakes
- **THEN** the user's car passes at 150 km/h
- **AND** it slows toward 100 km/h after its return lane change

#### Scenario: Overtaking speed below My speed
- **WHEN** "My speed" is 130 km/h, "Overtaking speed" is 100 km/h, and the user's car overtakes
- **THEN** the user's car passes at 130 km/h

### Requirement: Return to the home lane
An overtaking car SHALL return only when two conditions hold at the end of the return lane change. First, the vehicle it passed last is at least the cut-in gap behind it, measured at that vehicle's speed. Second, the next vehicle ahead in the home lane is at least the return following distance ahead, measured at the returning car's speed. Cars use a 2 s cut-in gap and a 3 s return following distance. A car MAY pass several vehicles in one overtake.

#### Scenario: Gap behind
- **WHEN** a car finishes its return lane change after it passed a slow truck
- **THEN** the gap from the car's rear to the slow truck's front is at least 2 s at the slow truck's speed

#### Scenario: Queue behind a slow truck
- **WHEN** a car follows a queue of two cars behind a slow truck, with 3 s gaps
- **AND** the oncoming lane is clear
- **THEN** the car passes both cars and the slow truck in one overtake
- **AND** it returns in front of the slow truck

### Requirement: Oncoming gap at return
When an overtaking car finishes its return lane change, the time to meet every oncoming vehicle ahead of it SHALL be at least 6.0 s. For the user's car, the limit SHALL be the value of the "Oncoming traffic gap" slider. The time to meet is the distance between the two vehicles divided by the sum of their speeds. This rule applies to oncoming vehicles in both lanes.

#### Scenario: Other cars
- **WHEN** any car other than the user's car finishes an overtake
- **THEN** the time to meet every oncoming vehicle ahead of it is at least 6.0 s

#### Scenario: User accepts a small gap
- **WHEN** the "Oncoming traffic gap" slider is at 1.0 s and the user's car finishes an overtake
- **THEN** the time to meet every oncoming vehicle ahead of it is at least 1.0 s

#### Scenario: Smaller gap allows more overtakes
- **WHEN** the planner checks the same traffic situations for the user's car, once with the slider at 6.0 s and once at 1.0 s
- **THEN** every overtake that the planner allows at 6.0 s, it also allows at 1.0 s
- **AND** it allows some overtakes only at 1.0 s

## ADDED Requirements

### Requirement: Return gaps of the user's car
The user's car SHALL use the "Cut-in gap" slider as its cut-in gap. It SHALL use the "Following distance" slider of the "Overtaking" group as its return following distance. After the return, the user's car SHALL recover its "Driving" following distance as the `traffic-flow` capability defines.

#### Scenario: Default return gaps
- **WHEN** the user's car finishes an overtake with the default sliders
- **THEN** the vehicle it passed last is at least 2.0 s behind it
- **AND** the next vehicle ahead is at least 2.0 s ahead

#### Scenario: Tight return
- **WHEN** "Cut-in gap" and the "Overtaking" "Following distance" are both 0.5 s, and the user's car finishes an overtake
- **THEN** both gaps are at least 0.5 s
- **AND** the user's car then recovers its "Driving" following distance

### Requirement: Braking room at return
An overtaking car SHALL return only if, at the end of the return lane change, it can slow to the speed of the vehicle ahead before it reaches that vehicle, while braking at 3 m/s² or less. This applies even when the return following distance allows a shorter gap.

#### Scenario: Fast return behind a slow vehicle
- **WHEN** the user's car overtakes at 180 km/h with an "Overtaking" "Following distance" of 0.5 s, and the next slot lies 0.5 s behind a slow truck at 65 km/h
- **THEN** the user's car does not return into that slot
- **AND** it returns only into a slot with enough room to brake to the speed of the vehicle ahead at 3 m/s² or less
