## MODIFIED Requirements

### Requirement: Statistics count simulated driving
The statistics SHALL count from page load. Distance SHALL be the distance that the user's car drove. Time SHALL be the simulated time. While the simulation is paused, no statistic SHALL change. An overtake SHALL count when the user's car finishes its return lane change.

#### Scenario: Time follows the simulation speed
- **WHEN** the simulation runs at 4× for 10 s of real time from page load
- **THEN** the time shows 0:00:39, 0:00:40, or 0:00:41

#### Scenario: Paused statistics
- **WHEN** the user presses "Pause"
- **THEN** no statistic changes until the user presses "Start" again

#### Scenario: Average speed
- **WHEN** the user's car has driven 10.0 km in 0:05:00
- **THEN** the average speed shows "120 km/h"

#### Scenario: Overtake count
- **WHEN** the user's car finishes an overtake
- **THEN** "Overtakes completed" increases by 1

