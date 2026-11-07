# countryroad

A traffic simulation of a two-lane country road, seen from above. It builds to static files.

## What the app does

The page shows a straight road from the bottom to the top of the screen, on a grass background. Traffic drives on the right. Your car is red and stays near the bottom of the screen, so the road and the other vehicles move past it. All other vehicles are grey.

The simulation models 10 km of road in each direction. Vehicles that leave one end come back at the other end.

Vehicle types:

| Type | Size | Speed | Following distance |
|---|---|---|---|
| Car | 4.5 m × 1.8 m | 90 km/h | 3 s |
| Semi | 16.5 m × 2.55 m | 80 km/h | 5 s |
| Slow truck | 9.0 m × 2.55 m | 65 km/h | 5 s |
| Your car | 4.5 m × 1.8 m | "My speed" slider | 3 s |

Overtaking rules:

- Only cars overtake, and your car follows the same rules. Trucks stay in their lane.
- A car overtakes at its own speed. Each lane change takes 2 s.
- A car returns to its lane only with at least 2 s to the vehicle it passed and 3 s to the next vehicle ahead.
- When a car is back in its lane, every oncoming vehicle is still at least 6 s away. That is the time until they would meet, at their combined speed. For your car, the "My overtaking gap" slider sets this limit.
- Vehicles never collide.

Controls, to the right of the road:

- **My speed:** 80–180 km/h in 5 km/h steps. The default is 130 km/h.
- **Cars:** 0–100 per direction. The default is 15.
- **Semis:** 0–20 per direction. The default is 3.
- **Slow trucks:** 0–10 per direction. The default is 2.
- **My overtaking gap:** 1.0–6.0 s in 0.1 s steps. The default is 6.0 s.
- **Simulation speed:** 1× to 10×. The view always draws 60 frames per second.
- **Start / Pause:** the simulation starts paused.

## Requirements

Docker with Compose 2.24 or later. Nothing else.

Every workflow runs in containers. Do not run `npm` or `npx` on the host. No workflow creates `node_modules/` or downloads browsers on the host.

## Build static files

Build the app in a container and write the static files to `dist/`:

```sh
scripts/build.sh
```

The build type-checks `src/` first. A type error stops the build, and `dist/` stays unchanged. A successful build replaces all of `dist/`. The files belong to the user who runs the script.

Any static file host can serve `dist/`, from the site root or from a sub-path such as `/apps/countryroad/`. The files reference each other with relative paths. The host needs no rewrite rules.

## Serve with Docker

Build the app and serve it with nginx on <http://localhost:8080/>:

```sh
docker compose up --build
```

The `builder` service builds the app into a shared volume, then exits. The `web` service starts only after a successful build. A type error stops `builder`, and `web` does not start.

To use a different host port, set `WEB_PORT`:

```sh
WEB_PORT=9090 docker compose up --build
```

Stop the stack and remove its containers:

```sh
docker compose down
```

## Unit tests

Type-check the source and run the unit tests in a container:

```sh
scripts/unit.sh
```

The script exits with status 0 only when the type check passes and all unit tests pass. Otherwise, it exits with a non-zero status, and the output names each failed test. The unit tests live next to the code, in `src/**/*.test.ts`.

## End-to-end tests

Build the app, serve it with nginx, and run the Playwright tests against it:

```sh
scripts/e2e.sh
```

The script exits with status 0 only when the build succeeds and all tests pass. Otherwise, it exits with a non-zero status. On failure, it also prints the `builder` and `web` logs, so a build error is visible. On every result, it removes its containers, network, and volume.

The script uses a separate Compose project, `countryroad-e2e`, and publishes no host port. A dev stack from `docker compose up` keeps running during the test run.

The `e2e` image tag in `Dockerfile` must equal the exact `@playwright/test` version in `package.json`. Change both together.

## Change dependencies

Add or update a dev dependency in a container. Run this command from the project root, and replace `<package>@<version>`:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD":/app -w /app node:26-alpine \
  npm install --package-lock-only --save-dev <package>@<version>
```

The command changes only `package.json` and `package-lock.json`. It creates no `node_modules/`. The next image build installs the new packages inside the images.

For `@playwright/test`, also pass `--save-exact`. Then change the `e2e` image tag in `Dockerfile` to the same version.
