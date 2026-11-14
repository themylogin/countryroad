# trip-stats Specification

## Purpose

Shows how the drive of the user's car goes: its current speed, the distance and time driven, the average speed, and the number of overtakes. The statistics sit below the Start/Pause button.

## Requirements

### Requirement: Statistics below the button
The control panel SHALL show five statistics for the user's car below the Start/Pause button: "Current speed", "Distance", "Time", "Average speed", and "Overtakes completed". Each statistic SHALL have a label and a value.

#### Scenario: Statistics on load
- **WHEN** the page loads
- **THEN** the panel shows the labels "Current speed", "Distance", "Time", "Average speed", and "Overtakes completed" below the Start button
- **AND** the values read the current speed of the user's car, "0.0 km", "0:00:00", "–", and "0"

### Requirement: Statistic formats
Current speed and average speed SHALL show whole km/h. Distance SHALL show km with one decimal. Time SHALL show the simulated time as h:mm:ss. Overtakes completed SHALL show a whole number. Average speed SHALL be distance divided by time, and SHALL show "–" while the time is 0.

#### Scenario: Example values
- **WHEN** the user's car drives at 128.4 km/h and has driven 12.43 km in 872 s with 3 finished overtakes
- **THEN** the values read "128 km/h", "12.4 km", "0:14:32", "51 km/h", and "3"

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

### Requirement: Statistics refresh
While the simulation runs, the statistics SHALL refresh at least 4 times per second.

#### Scenario: Running values change
- **WHEN** the simulation runs at 10× for 1 s of real time
- **THEN** the time value changes at least 4 times
