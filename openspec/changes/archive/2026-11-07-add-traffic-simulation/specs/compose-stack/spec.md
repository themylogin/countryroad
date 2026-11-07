# Spec Delta

## ADDED Requirements

### Requirement: Unit test command returns the result
`scripts/unit.sh` SHALL run the unit tests in a container and exit with the result. It SHALL exit with status 0 only when the type check passes and all unit tests pass.

#### Scenario: All unit tests pass
- **WHEN** a developer runs `scripts/unit.sh` on source with passing unit tests
- **THEN** the command exits with status 0

#### Scenario: A unit test fails
- **WHEN** a developer runs `scripts/unit.sh` and one unit test fails
- **THEN** the command exits with a non-zero status
- **AND** the command output names the failed test

## MODIFIED Requirements

### Requirement: Every workflow needs only Docker on the host
Building, serving, testing, and dependency changes SHALL need only Docker and Docker Compose on the host. No workflow SHALL install Node, npm packages, or browsers on the host.

#### Scenario: Host without Node
- **WHEN** a host has Docker and Docker Compose but no Node installation
- **AND** a developer runs `scripts/build.sh`, `docker compose up --build`, `scripts/unit.sh`, `scripts/e2e.sh`, and the documented dependency command
- **THEN** each command completes with status 0

#### Scenario: No host leftovers
- **WHEN** a developer runs every workflow from the previous scenario
- **THEN** the project directory has no `node_modules/` directory
- **AND** the host has no Playwright browser download

#### Scenario: Dependency change
- **WHEN** a developer runs the documented dependency command to add or update a package
- **THEN** only `package.json` and `package-lock.json` change on the host
- **AND** both files keep their owner
