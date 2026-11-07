# Spec Delta

## Purpose

Defines when a car overtakes, how it passes, when it returns to its lane, and the oncoming-traffic rule that keeps every overtake safe. The user's car follows the same rules, with an adjustable oncoming gap.

## ADDED Requirements

### Requirement: Only cars overtake
Cars and the user's car SHALL be the only vehicles that overtake. Semis and slow trucks SHALL always stay in their lane.

#### Scenario: Semi behind a slow truck
- **WHEN** a semi follows a slow truck on an empty oncoming lane
- **THEN** the semi stays in its lane behind the slow truck

### Requirement: Overtake start
A car SHALL consider an overtake only while a slower vehicle ahead in its lane holds it below its desired speed. It SHALL start only when a prediction from the current state shows that the whole maneuver meets every rule in this spec. The prediction SHALL assume that every oncoming vehicle drives at its desired speed. No other vehicle in the car's direction SHALL be in the passing lane along the maneuver.

#### Scenario: Clear oncoming lane
- **WHEN** a car follows a slow truck and no oncoming vehicle is within 3 km
- **THEN** the car starts an overtake

#### Scenario: Oncoming vehicle too close
- **WHEN** a car follows a slow truck and an oncoming vehicle would be less than 6 s away at the end of the maneuver
- **THEN** the car stays behind the slow truck

#### Scenario: Passing lane in use
- **WHEN** a car follows a slow truck and another car in the same direction is already in the passing lane ahead of it
- **THEN** the car does not start an overtake until that car has returned to its lane

### Requirement: Lane change duration
Each lane change SHALL take 2 s: out to the passing lane, and back to the home lane. During a lane change, the vehicle SHALL occupy both lanes.

#### Scenario: Out and back
- **WHEN** a car overtakes
- **THEN** its move from the center of its lane to the center of the passing lane takes 2.0 s
- **AND** its move back takes 2.0 s

### Requirement: Overtaking speed
An overtaking car SHALL drive at its desired speed: 90 km/h for cars, and the speed slider value for the user's car. It SHALL accelerate within the limits of the `traffic-flow` capability. It SHALL NOT drive faster than its desired speed to finish an overtake.

#### Scenario: Car passes a slow truck
- **WHEN** a car overtakes a slow truck
- **THEN** the car accelerates to 90 km/h and passes at that speed

### Requirement: Return to the home lane
An overtaking car SHALL return only when two conditions hold at the end of the return lane change. First, the vehicle it passed last is at least 2 s behind it, measured at that vehicle's speed. Second, the next vehicle ahead in the home lane is at least 3 s ahead, measured at the returning car's speed. A car MAY pass several vehicles in one overtake.

#### Scenario: Gap behind
- **WHEN** a car finishes its return lane change after it passed a slow truck
- **THEN** the gap from the car's rear to the slow truck's front is at least 2 s at the slow truck's speed

#### Scenario: Queue behind a slow truck
- **WHEN** a car follows a queue of two cars behind a slow truck, with 3 s gaps
- **AND** the oncoming lane is clear
- **THEN** the car passes both cars and the slow truck in one overtake
- **AND** it returns in front of the slow truck

### Requirement: Oncoming gap at return
When an overtaking car finishes its return lane change, the time to meet every oncoming vehicle ahead of it SHALL be at least 6.0 s. For the user's car, the limit SHALL be the value of the oncoming-gap slider. The time to meet is the distance between the two vehicles divided by the sum of their speeds. This rule applies to oncoming vehicles in both lanes.

#### Scenario: Other cars
- **WHEN** any car other than the user's car finishes an overtake
- **THEN** the time to meet every oncoming vehicle ahead of it is at least 6.0 s

#### Scenario: User accepts a small gap
- **WHEN** the oncoming-gap slider is at 1.0 s and the user's car finishes an overtake
- **THEN** the time to meet every oncoming vehicle ahead of it is at least 1.0 s

#### Scenario: Smaller gap allows more overtakes
- **WHEN** the planner checks the same traffic situations for the user's car, once with the slider at 6.0 s and once at 1.0 s
- **THEN** every overtake that the planner allows at 6.0 s, it also allows at 1.0 s
- **AND** it allows some overtakes only at 1.0 s

### Requirement: Same rules for oncoming traffic
Oncoming cars SHALL overtake by the same rules, mirrored: they pass in the right lane and treat the user's direction as their oncoming traffic.

#### Scenario: Oncoming overtake
- **WHEN** an oncoming car follows an oncoming slow truck and the right lane is clear
- **THEN** the oncoming car overtakes in the right lane and returns to the left lane

### Requirement: Every overtake finishes
Every overtake that starts SHALL finish by the rules above. An overtaking car SHALL NOT need to brake back behind the vehicle it passes.

#### Scenario: Long run
- **WHEN** the simulation runs for 20 simulated minutes with maximum counts, for each of 10 random seeds
- **THEN** every started overtake finishes with a return that meets the gap behind, the gap ahead, and the oncoming gap
