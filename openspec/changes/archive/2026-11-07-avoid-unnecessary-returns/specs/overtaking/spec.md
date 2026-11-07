# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Return only after the planned vehicles
An overtaking car SHALL return only after it has passed every vehicle that its plan passes. A gap that opens earlier SHALL NOT end the overtake.

#### Scenario: No early return
- **WHEN** a car plans to pass three vehicles and the gap after the first one would also meet the return conditions
- **THEN** the car stays in the passing lane until it has passed all three
