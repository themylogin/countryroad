# Spec Delta

## Purpose

Defines the page that the browser loads: its title, its root element, and the script that renders content into that element. Later features build on this shell.

## ADDED Requirements

### Requirement: Document title
The page SHALL have the document title `countryroad`.

#### Scenario: Title on load
- **WHEN** a browser loads the app root URL
- **THEN** the document title is `countryroad`

### Requirement: Script renders the placeholder heading
The app script SHALL render one level-1 heading with the text `countryroad` into the root element. The HTML document SHALL NOT contain this heading before the script runs.

#### Scenario: Heading after script runs
- **WHEN** a browser loads the app root URL with scripts enabled
- **THEN** the page shows one level-1 heading with the text `countryroad`

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
