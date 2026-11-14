# overtake-reason Specification

## Purpose

Explains in the control panel why the user's car follows a vehicle and does not overtake. The reason sits below the trip statistics and uses the rules of the `overtaking` capability.

## Requirements

### Requirement: Reason below the statistics
The control panel SHALL show the reason in its own paragraph below "Overtakes completed". A horizontal rule SHALL separate the paragraph from the statistics. The reason SHALL be one sentence from the reason table. While the panel shows no reason, it SHALL show neither the rule nor the paragraph. The reason SHALL refresh together with the statistics.

#### Scenario: Reason position
- **WHEN** the panel shows a reason
- **THEN** a horizontal rule is below "Overtakes completed"
- **AND** the paragraph with the reason is below that rule

#### Scenario: No reason on load
- **WHEN** the page loads
- **THEN** the panel shows no rule and no reason paragraph

### Requirement: When the reason shows
While the user's car does not overtake, it SHALL make an overtake decision every 0.5 s of simulated time. The panel SHALL show the result of the latest decision. The decision SHALL give a reason when the user's car follows a vehicle and does not start an overtake, and only then. The user's car follows a vehicle when the next vehicle ahead in its lane is within the "Driving" following distance plus 20 m. Before the first decision and while the user's car overtakes, the panel SHALL show no reason.

#### Scenario: Following a slow truck with oncoming traffic
- **WHEN** the user's car follows a slow truck and an oncoming car is too close for an overtake
- **THEN** the panel shows a reason that starts with "Oncoming "

#### Scenario: Overtake starts
- **WHEN** the user's car starts an overtake
- **THEN** the panel shows no rule and no reason paragraph until the overtake ends

#### Scenario: Free road
- **WHEN** the user's car has no vehicle ahead within its following distance plus 20 m
- **THEN** the panel shows no reason after the next decision

#### Scenario: Another car passes the user's car
- **WHEN** the user's car follows a slow truck on an otherwise empty road
- **AND** another car overtakes the user's car
- **THEN** the panel shows "Another vehicle is overtaking."

#### Scenario: Paused
- **WHEN** the user presses "Pause"
- **THEN** the reason does not change until the user presses "Start" again

### Requirement: Reason texts
Each reason SHALL use this text. A reason applies when its condition is true in the decision. Priority 1 is the highest. The number requirements below define the numbers in angle brackets.

| Priority | Condition | Text |
|---|---|---|
| 1 | An oncoming vehicle breaks the oncoming gap rule. | Oncoming \<distance\> m away, need \<need\> m |
| 2 | Another vehicle in the same direction uses the passing lane. | Another vehicle is overtaking. |
| 3 | The decision sees 12 vehicles, the limit. All 12 are in the queue, and more vehicles follow within 3 km. | The queue ahead has more than 12 vehicles. |
| 4 | The vehicle ahead of the return slot leaves too little room for the return. | No gap to return into: \<gap\> s between the cars, \<need\> s needed. |
| 5 | The lane change out leaves less than 2 m to the vehicle ahead. | Too close to the vehicle ahead to pull out: \<gap\> m gap, \<need\> m needed. |
| 6 | The overtake needs more than 90 s, the limit. | The overtake takes more than 90 s at \<speed\> km/h. |
| 7 | A vehicle to pass can reach the highest overtaking speed. | The vehicle ahead can reach your overtaking speed. |
| 8 | The vehicle ahead is not slower than "My speed" less 1 km/h. | The vehicle ahead is not slower than My speed. |

#### Scenario: Leader at My speed
- **WHEN** "My speed" is 90 km/h and the user's car follows a car that drives at 90 km/h
- **THEN** the panel shows "The vehicle ahead is not slower than My speed."

#### Scenario: Overtaking speed too close to the truck speed
- **WHEN** the user's car follows a semi at 80 km/h on an otherwise empty road
- **AND** its highest overtaking speed is 85 km/h
- **THEN** the panel shows "The overtake takes more than 90 s at 85 km/h."

#### Scenario: Long queue
- **WHEN** the user's car follows a queue of more than 12 vehicles within 3 km on an otherwise empty road
- **AND** the queue has no gap to return into
- **THEN** the panel shows "The queue ahead has more than 12 vehicles."

### Requirement: Oncoming distance number
The distance SHALL be the current distance to the oncoming vehicle that breaks the oncoming gap rule by the most. It SHALL be 0 m while that vehicle is alongside the user's car. The need SHALL be the sum of three distances: the travel of the user's car until the end of the return lane change, the travel of the oncoming vehicle in the same time, and the "Oncoming traffic gap" at the sum of both speeds at that time.

#### Scenario: Oncoming distance
- **WHEN** the oncoming vehicle is 800.4 m away and the overtake needs 1119.2 m
- **THEN** the panel shows "Oncoming 800 m away, need 1120 m"

#### Scenario: Oncoming vehicle beyond the view
- **WHEN** the only oncoming vehicle is 600 m away, beyond the visible road, and the overtake needs 1000 m
- **THEN** the panel shows "Oncoming 600 m away, need 1000 m"

#### Scenario: Oncoming vehicle alongside
- **WHEN** an oncoming vehicle is alongside the user's car
- **THEN** the distance reads "0 m away"

#### Scenario: Smaller oncoming traffic gap
- **WHEN** the user lowers the "Oncoming traffic gap" by 3.0 s
- **THEN** the need of the next decision drops by 3.0 s times the sum of both speeds at the end of the return lane change

### Requirement: Oncoming numbers from the real overtake
Before the return slots, the decision SHALL check the shortest overtake: 2 s out and 2 s back at the lowest overtaking speed. When an oncoming vehicle fails this check, the user's car SHALL NOT start an overtake. It SHALL still try the return slots, but only to find the numbers. The oncoming numbers SHALL come from the closest try of a return slot that fails the oncoming gap rule. Only when no try gets to that rule SHALL they come from the shortest overtake.

#### Scenario: Near oncoming car and a queue
- **WHEN** the user's car follows two cars behind a slow truck on an otherwise empty road
- **AND** an oncoming car is closer than the shortest overtake needs
- **THEN** the need is the need of the overtake past all three vehicles
- **AND** it is not the need of the shortest overtake

#### Scenario: No return slot gets to the oncoming rule
- **WHEN** no return slot has room for the return
- **AND** an oncoming car is closer than the shortest overtake needs
- **THEN** the oncoming numbers come from the shortest overtake

### Requirement: Return gap number
The gap SHALL be the current space from the front of the vehicle to pass last to the rear of the vehicle ahead of it. The need SHALL be the space for the cut-in gap, the user's car, the return following distance or the braking room, and the safety margins. It SHALL include the predicted change of the space until the return ends. Both SHALL be in seconds at the current speed of the vehicle to pass last.

#### Scenario: Two cars 5 s apart
- **WHEN** the space between the two cars is 125 m and the return needs 137 m
- **AND** the car that the user's car would pass drives at 90 km/h
- **THEN** the panel shows "No gap to return into: 5.0 s between the cars, 5.5 s needed."

#### Scenario: Need predicts the decision
- **WHEN** the panel shows a need of N s for a return slot
- **THEN** the user's car can return into that slot when the space is at least N s
- **AND** it cannot when the space is less than N s

#### Scenario: Shorter return following distance
- **WHEN** the user lowers the Overtaking "Following distance" and the braking room does not set the need
- **THEN** the need of the next decision is lower

#### Scenario: Braking room sets the need
- **WHEN** the braking rule needs more room than the return following distance
- **THEN** a change of the Overtaking "Following distance" does not change the need

### Requirement: Pull-out gap number
The pull-out gap SHALL be the current gap to the vehicle ahead, in metres. The need SHALL be the smallest current gap that leaves 2 m at the end of the lane change out.

#### Scenario: Pull-out gap
- **WHEN** the current gap is 12.6 m and a gap of 17.2 m leaves 2 m at the end of the lane change out
- **THEN** the panel shows "Too close to the vehicle ahead to pull out: 12 m gap, 18 m needed."

### Requirement: Number format
Seconds SHALL show one decimal, up to 99.9 s. A larger value SHALL show as 99.9 s. Metres and km/h SHALL show whole numbers. Gaps and distances SHALL round down, and needs SHALL round up. The speed in the 90 s reason SHALL be the highest overtaking speed that the decision tried.

#### Scenario: Gap rounds down, need rounds up
- **WHEN** a return gap is 1.98 s and its need is 2.01 s
- **THEN** the panel shows "No gap to return into: 1.9 s between the cars, 2.1 s needed."

#### Scenario: Very slow car to pass
- **WHEN** the car to pass drives so slowly that the space is more than 99.9 s
- **THEN** the gap reads "99.9 s between the cars"

### Requirement: One reason per decision
One decision SHALL try each return slot that the `overtaking` capability allows, at each overtaking speed it allows. Each failed try SHALL have one reason from the reason table. When the decision finds more than one reason, the panel SHALL show the reason with the highest priority. When more than one try fails for the shown reason, its numbers SHALL come from the try that came closest to the need. For the 90 s reason, this is the fastest try.

#### Scenario: Oncoming traffic blocks the only fitting slot
- **WHEN** the user's car follows two cars behind a slow truck with no gap between them
- **AND** the road after the truck is free, but an oncoming car blocks the overtake of all three vehicles
- **THEN** the panel shows a reason that starts with "Oncoming "
- **AND** it does not show a reason that starts with "No gap to return into:"

#### Scenario: Closest try gives the numbers
- **WHEN** one try fails with an oncoming vehicle 600 m away and a need of 1100 m
- **AND** another try fails with an oncoming vehicle 800 m away and a need of 1120 m
- **THEN** the panel shows "Oncoming 800 m away, need 1120 m"
