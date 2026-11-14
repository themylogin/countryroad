## MODIFIED Requirements

### Requirement: 60 frames per second
The view SHALL redraw 60 times per second while the page is visible, on displays that refresh at 60 Hz or faster. The frame rate SHALL NOT depend on the simulation speed. The simulation speed SHALL change only how much simulated time passes per frame.

#### Scenario: Fast display
- **WHEN** the display refreshes at 120 Hz
- **THEN** the view redraws 60 times per second, not 120

#### Scenario: High simulation speed
- **WHEN** the simulation speed is 60×
- **THEN** the view still redraws 60 times per second
- **AND** each frame advances the simulation by 60 times the real time since the previous frame

#### Scenario: Paused
- **WHEN** the simulation is paused
- **THEN** the view keeps the last state on screen, and no vehicle moves
