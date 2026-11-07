# Spec Delta

## MODIFIED Requirements

### Requirement: Build writes a self-contained output directory
`scripts/build.sh` SHALL build the app in a container and write `index.html` and every asset that the page references into `dist/` on the host. The files SHALL belong to the user who runs the script. The output SHALL NOT need a server-side runtime.

#### Scenario: Successful build
- **WHEN** a developer runs `scripts/build.sh` on valid source
- **THEN** the command exits with status 0
- **AND** `dist/index.html` exists
- **AND** every script, stylesheet, and image that the page references exists inside `dist/`
- **AND** every file in `dist/` belongs to the user who ran the command

#### Scenario: Plain file server serves the output
- **WHEN** a plain static file server serves `dist/` with no rewrite rules
- **THEN** the page loads and shows the simulation view

### Requirement: Output works from any URL path
The output SHALL reference its assets with relative paths. The page SHALL work when a host serves `dist/` from the site root or from a sub-path.

#### Scenario: Served from a sub-path
- **WHEN** a static file server serves the contents of `dist/` under `/nested/path/`
- **AND** a browser loads `/nested/path/`
- **THEN** every asset request, including the grass image, returns a 2xx status
- **AND** the page shows the simulation view
