# Spec Delta

## ADDED Requirements

### Requirement: Script renders the simulation view
The app script SHALL render the simulation view into the root element: the drawing area with the road and the control panel. The HTML document SHALL NOT contain the simulation view before the script runs.

#### Scenario: View after script runs
- **WHEN** a browser loads the app root URL with scripts enabled
- **THEN** the page shows the road drawing and the control panel with a "Start" button

#### Scenario: Root element is empty in the served HTML
- **WHEN** a client fetches the app root URL without running scripts
- **THEN** the HTML response contains the root element
- **AND** the root element has no child content

## REMOVED Requirements

### Requirement: Script renders the placeholder heading
**Reason**: The simulation view replaces the placeholder heading. The page no longer shows a level-1 heading.
**Migration**: Tests that look for the heading must look for the simulation view instead, as the requirement "Script renders the simulation view" describes.
