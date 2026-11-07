# compose-stack Specification

## Purpose

Defines the Docker Compose stack that builds the app, serves the built files, and runs e2e tests against them. Every project workflow needs only Docker on the host, so developers and CI get the same result.

## Requirements

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

### Requirement: One command builds and serves the app
`docker compose up --build` SHALL build the app from the current source and serve the built files over HTTP on host port 8080. The `WEB_PORT` environment variable SHALL override the host port.

#### Scenario: Default port
- **WHEN** a developer runs `docker compose up --build`
- **THEN** `http://localhost:8080/` returns status 200 with the app page

#### Scenario: Custom port
- **WHEN** a developer runs `WEB_PORT=9090 docker compose up --build`
- **THEN** `http://localhost:9090/` returns status 200 with the app page

#### Scenario: E2E tests do not run by default
- **WHEN** a developer runs `docker compose up --build`
- **THEN** the stack does not start the e2e tests

### Requirement: Served files match the current source
Each stack start with `--build` SHALL serve output built from the current source. Output from an earlier run SHALL NOT remain.

#### Scenario: Source changes between runs
- **WHEN** a developer changes the source
- **AND** runs `docker compose up --build` again
- **THEN** the served page shows the change

### Requirement: Serving waits for a successful build
The stack SHALL start the web server only after the build completes with success.

#### Scenario: Build fails
- **WHEN** the source contains a type error
- **AND** a developer runs `docker compose up --build`
- **THEN** the build exits with a non-zero status
- **AND** the web server does not start

### Requirement: E2E run command returns the test result
`scripts/e2e.sh` SHALL build the app, serve it, run the e2e tests against the served files, and exit with the result. It SHALL exit with status 0 only when the build succeeds and all tests pass.

#### Scenario: All tests pass
- **WHEN** a developer runs `scripts/e2e.sh` on valid source with passing tests
- **THEN** the command exits with status 0

#### Scenario: A test fails
- **WHEN** a developer runs `scripts/e2e.sh` and one test fails
- **THEN** the command exits with a non-zero status
- **AND** the command output names the failed test

#### Scenario: Build fails
- **WHEN** a developer runs `scripts/e2e.sh` on source with a type error
- **THEN** the command exits with a non-zero status
- **AND** no e2e test runs

### Requirement: E2E tests target the served build
The e2e tests SHALL send requests to the web server of the stack. They SHALL NOT use a development server.

#### Scenario: Test target
- **WHEN** `scripts/e2e.sh` runs the e2e tests
- **THEN** every page request from the tests goes to the stack web server

### Requirement: E2E run removes its containers
`scripts/e2e.sh` SHALL stop and remove the containers that it started when it finishes, for every result.

#### Scenario: Cleanup after a failed run
- **WHEN** `scripts/e2e.sh` finishes after a test failure
- **THEN** Docker lists no containers from the e2e run

### Requirement: E2E run is isolated from a running dev stack
`scripts/e2e.sh` SHALL NOT stop, change, or reuse a stack that `docker compose up` started. The e2e run SHALL NOT publish a host port.

#### Scenario: Dev stack runs during an e2e run
- **WHEN** a developer runs `docker compose up --build` and the stack serves on port 8080
- **AND** the developer runs `scripts/e2e.sh` in a second terminal
- **THEN** the e2e run completes
- **AND** `http://localhost:8080/` still returns status 200 after the e2e run finishes

### Requirement: Unit test command returns the result
`scripts/unit.sh` SHALL run the unit tests in a container and exit with the result. It SHALL exit with status 0 only when the type check passes and all unit tests pass.

#### Scenario: All unit tests pass
- **WHEN** a developer runs `scripts/unit.sh` on source with passing unit tests
- **THEN** the command exits with status 0

#### Scenario: A unit test fails
- **WHEN** a developer runs `scripts/unit.sh` and one unit test fails
- **THEN** the command exits with a non-zero status
- **AND** the command output names the failed test
