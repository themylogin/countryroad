# overtaking Specification

## Purpose

Defines when a car overtakes, how it passes, when it returns to its lane, and the oncoming-traffic rule that keeps every overtake safe. The user's car follows the same rules, with an adjustable oncoming gap.

## Requirements

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

### Requirement: Return slot choice
The user's car SHALL pass the whole queue ahead of it in one overtake when the overtaking rules allow it. The queue is the vehicle directly ahead plus each next vehicle that holds the previous one back: it drives slower than the previous one's desired speed, within the previous one's following distance plus 20 m. When the rules do not allow the whole queue, the user's car SHALL pass as many vehicles of the queue as they allow.

#### Scenario: Whole queue on a clear road
- **WHEN** the user's car follows a queue of four cars and a slow truck at 65 km/h with 3 s gaps
- **AND** "Cut-in gap" and the "Overtaking" "Following distance" are both 0.5 s, and the oncoming lane is clear
- **THEN** the user's car passes all five vehicles in one overtake

#### Scenario: Cut in after one car of a queue
- **WHEN** the user's car follows a queue at 65 km/h at 1.0 s: car A, then car B 3 s behind a slow truck, with 3 s gaps
- **AND** "My speed" is 180 km/h, "Overtaking speed" is 130 km/h, "Oncoming traffic gap" is 1.0 s, and the "Overtaking" "Following distance" and "Cut-in gap" are both 0.5 s
- **AND** an oncoming vehicle leaves room to pass car A but not car B
- **THEN** the user's car passes car A only and returns between car A and car B
- **AND** car A is at least 0.5 s behind it and car B at least 0.5 s ahead of it

#### Scenario: Full speed past a queue when no gap fits
- **WHEN** the user's car follows a queue whose gaps are too short for any speed above the queue speed
- **AND** no vehicle is within 3 km ahead of the queue, and the oncoming lane is clear
- **THEN** the user's car passes the whole queue at its highest overtaking speed

#### Scenario: Faster car just ahead of the queue
- **WHEN** the user's car follows a slow truck, and a car at 90 km/h drives 70 m ahead of the slow truck
- **AND** "Cut-in gap" and the "Overtaking" "Following distance" are both 0.5 s, and the oncoming lane is clear
- **THEN** the user's car passes the slow truck only, because the car ahead does not hold the slow truck back

#### Scenario: Vehicle beyond the queue
- **WHEN** the user's car follows a queue of two cars behind a slow truck
- **AND** another car drives 1 km ahead of the slow truck, and the oncoming lane is clear
- **THEN** the user's car passes the two cars and the slow truck
- **AND** it returns in front of the slow truck, not in front of the car 1 km ahead

### Requirement: Return only after the planned vehicles
An overtaking car SHALL return only after it has passed every vehicle that its plan passes. A gap that opens earlier SHALL NOT end the overtake.

#### Scenario: No early return
- **WHEN** a car plans to pass three vehicles and the gap after the first one would also meet the return conditions
- **THEN** the car stays in the passing lane until it has passed all three

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
