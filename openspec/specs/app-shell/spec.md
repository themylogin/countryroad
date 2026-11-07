# app-shell Specification

## Purpose

Defines the page that the browser loads: its title, its root element, and the script that renders content into that element. Later features build on this shell.

## Requirements

### Requirement: Document title
The page SHALL have the document title `countryroad`.

#### Scenario: Title on load
- **WHEN** a browser loads the app root URL
- **THEN** the document title is `countryroad`

### Requirement: Script renders the simulation view
The app script SHALL render the simulation view into the root element: the drawing area with the road and the control panel. The HTML document SHALL NOT contain the simulation view before the script runs.

#### Scenario: View after script runs
- **WHEN** a browser loads the app root URL with scripts enabled
- **THEN** the page shows the road drawing and the control panel with a "Start" button

#### Scenario: Root element is empty in the served HTML
- **WHEN** a client fetches the app root URL without running scripts
- **THEN** the HTML response contains the root element
- **AND** the root element has no child content

### Requirement: Clean page load
The page SHALL load without console errors and without failed requests for its own assets.

#### Scenario: No errors on load
- **WHEN** a browser loads the app root URL
- **THEN** the browser console shows no error messages
- **AND** every request for an app asset returns a 2xx status
