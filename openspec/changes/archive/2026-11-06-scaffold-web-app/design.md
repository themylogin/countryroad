# Design

## Context

The `countryroad/` directory holds only the OpenSpec setup. It has no source, no `package.json`, and no git repository. See proposal.md - Why for motivation.

The project must use no host tool except Docker. The planning host has Node installed, but no workflow may depend on it.

Versions on 2026-11-06:

| Tool | Version |
|---|---|
| Docker on the planning host | 29.9.3 |
| Docker Compose on the planning host | 5.7.0 |
| Node in `node:26-alpine` | 26 (current LTS, "Lithium") |
| `vite` (npm latest) | 8.3.6 |
| `typescript` (npm latest) | 7.0.2 |
| `@playwright/test` (npm latest) | 1.65.0 |

The image `mcr.microsoft.com/playwright:v1.65.0-resolute` exists. The tags `node:26-alpine` and `nginx:stable-alpine` also exist.

## Goals / Non-Goals

**Goals:**

- The host needs only Docker. Build, serve, test, and dependency changes all run in containers. No workflow writes `node_modules/` or browsers to the host.
- One build command. The Compose builder and the static export both run `npm run build` from the `builder` stage.
- Tests run against the same nginx-served files that a developer sees.
- A test run gives a reliable exit code and leaves no containers or volumes behind.

**Non-Goals:**

- Type-checking of `e2e/` and config files. Playwright and Vite strip types at load time. Only `src/` is type-checked.
- Custom nginx configuration: cache headers, compression, SPA fallback.
- Test artifacts (traces, HTML reports) from container runs. Results go to stdout only.
- Concurrent e2e runs on one Docker host.
- A dev server with live reload. `docker compose up --build` serves the built app instead. A later change can add a Compose dev service.

## Decisions

### Vite with plain TypeScript, files written by hand

Vite gives hashed asset names, a relative `base` option, and a fast production build. This change does not use its dev server or preview server. No UI framework is used.

Write the files by hand instead of with `npm create vite`. The template adds a counter demo and SVG assets that this change would delete.

`package.json` has one script: `build`. It has no `dev`, `preview`, or test script, because nothing runs npm on the host.

Alternatives:
- `tsc` only, with native ES modules: no bundling and no hashed names.
- `esbuild` directly: needs hand-written HTML injection.

### Relative asset base

`vite.config.ts` sets `base: './'`. The built `index.html` then references `./assets/...`. The output works from the site root and from any sub-path, with no build-time knowledge of the deploy path.

Alternatives:
- `base: '/'`: breaks under a sub-path.
- A base from an environment variable: needs the deploy path at build time.

### Build script type-checks first

`package.json` sets `"build": "tsc && vite build"`. `tsconfig.json` sets `noEmit: true`, `strict: true`, and includes only `src/`. Vite does not type-check, so `tsc` must run first. A type error stops the script before Vite writes any file.

### Output directory from an environment variable

`vite.config.ts` reads `build.outDir` from `BUILD_OUT_DIR` and falls back to `dist`. It also sets `build.emptyOutDir: true`. Vite does not empty an output directory outside the project root unless this option is set.

The builder image sets `BUILD_OUT_DIR=/dist` and runs `npm run build` unchanged.

Alternative: `npm run build -- --outDir /dist`. npm appends these arguments to the last command in the script. A reorder of the script would then pass them to the wrong command.

### Placeholder rendering

`index.html` contains `<main id="app"></main>` and loads `src/main.ts` as a module. `src/main.ts` creates the `h1` element and appends it to `#app`. The served HTML therefore has an empty root, and the heading proves that the bundle ran.

`index.html` also contains `<link rel="icon" href="data:,">`. Without it, the browser requests `/favicon.ico`, gets a 404, and logs a console error. That error would break the clean-load test.

### One Dockerfile with four stages

| Stage | Base | Copies | What runs |
|---|---|---|---|
| `builder` | `node:26-alpine` | `package*.json`, then `tsconfig.json`, `vite.config.ts`, `index.html`, `src/` | `npm run build` when the container starts. Compose uses this stage. |
| `dist-build` | `builder` | nothing new | `RUN npm run build` at image build time. The output goes to `/dist` in the image. |
| `dist` | `scratch` | `/dist/` from `dist-build` | Nothing. This stage exists only for export to the host. |
| `e2e` | `mcr.microsoft.com/playwright:v1.65.0-resolute` | `package*.json`, then `playwright.config.ts`, `e2e/` | `npx playwright test` when the container starts. |

Each stage runs its own `npm ci`. The two base images use different C libraries (musl and glibc). Vite's native dependencies differ per platform, so the stages cannot share `node_modules`.

Each stage copies `package*.json` and runs `npm ci` before it copies other files. A source change then does not reinstall dependencies. The `e2e` stage does not copy `src/`, so a source change does not rebuild the e2e image.

Alternative: two Dockerfiles. One file keeps the install pattern in one place.

### Static export: `scripts/build.sh`

The script exports the `dist` stage to the host with the BuildKit local exporter:

1. Create a temporary directory with `mktemp -d`.
2. Run `docker build --target dist --output type=local,dest=<temporary directory>/dist .`.
3. On success, remove `dist/` and move the new output into its place.
4. On every result, remove the temporary directory.

A type error fails step 2, so `dist/` stays unchanged. The Docker CLI writes the exported files as the user who runs it, so the host gets no root-owned files.

Alternatives:
- Bind-mount `dist/` into a `node` container: the files belong to root, unless every run passes `--user`.
- `docker compose cp` from the `dist` volume: needs a running stack.

### Dependency changes in a container

The README documents one command for dependency changes:

```sh
docker run --rm --user "$(id -u):$(id -g)" -e npm_config_cache=/tmp/npm-cache \
  -v "$PWD":/app -w /app node:26-alpine \
  npm install --package-lock-only --save-dev <package>@<version>
```

- `--package-lock-only` updates `package.json` and `package-lock.json` and creates no `node_modules/`.
- `--user` keeps both files owned by the developer.
- `npm_config_cache` points to `/tmp`, because the mapped user has no home directory in the image.

An update of `@playwright/test` also needs the same version in the `e2e` image tag.

### Compose set: two files

`compose.yaml` defines the dev stack:

- `builder`: target `builder`. It mounts the named volume `dist` at `/dist`.
- `web`: image `nginx:stable-alpine` with the stock config. It mounts `dist` read-only at `/usr/share/nginx/html`, with `volume.nocopy: true`. It publishes `${WEB_PORT:-8080}:80`. It depends on `builder` with `condition: service_completed_successfully`. A health check runs `wget -q --spider http://127.0.0.1/`.

`compose.e2e.yaml` overrides and extends the dev stack:

- `web`: `ports: !reset []` removes the host port.
- `e2e`: target `e2e`. It depends on `web` with `condition: service_healthy`. It sets `BASE_URL=http://web/`, `ipc: host`, and `init: true`, as the Playwright Docker docs recommend for Chromium.

`docker compose up --build` reads only `compose.yaml`, so it never starts `e2e`.

`volume.nocopy: true` matters. Without it, Docker copies the nginx default `index.html` into an empty `dist` volume on first mount.

The service is named `builder`, not `build`. This avoids confusion between `docker compose build` and `docker compose up build`.

Alternatives:
- A `test` profile in one file: the e2e run then publishes port 8080 and collides with a running dev stack.
- A multi-stage image where nginx contains the build: this has no separate build step and no shared output for other consumers.

### E2E entry point: `scripts/e2e.sh`

The script runs Compose with `--project-name countryroad-e2e --file compose.yaml --file compose.e2e.yaml`. The separate project name gives the run its own containers, network, and volume. A dev stack in the project `countryroad` stays untouched.

Steps:

1. Build the images with `build`.
2. Run the tests with `run --rm e2e`. `run` starts `builder` and `web` through `depends_on`. It also returns the exit code of `e2e`.
3. On exit, for every result:
   - If the status is not 0, print the logs of `builder` and `web`. `run` does not show dependency logs, so a build error is otherwise invisible.
   - Run `down --volumes --remove-orphans`.
   - Exit with the saved status.

Alternative: `up --exit-code-from e2e`. This option implies `--abort-on-container-exit`. The one-shot `builder` exits first, and Compose then stops the stack before the tests run.

### Playwright configuration

- `testDir: 'e2e'` and `reporter: 'list'`.
- One project: Desktop Chrome.
- `baseURL` comes from `BASE_URL` only. `compose.e2e.yaml` sets it to `http://web/`. The tests run only in the `e2e` container, never on the host.
- Pin `@playwright/test` to the exact version `1.65.0`, with no caret. The Docker image tag must match this version.

### Test-to-spec mapping

| Test file | Spec scenarios |
|---|---|
| `e2e/app-shell.spec.ts` | Title, heading, empty root (in a context with `javaScriptEnabled: false`), no console errors and no failed asset requests |
| `e2e/static-build.spec.ts` | Sub-path scenario. A `page.route` handler maps `/nested/path/*` to `/*` on the same server. The test then loads `/nested/path/`. |

The type-error, stale-file, ownership, port, cleanup, isolation, and host-leftover scenarios need file edits or Docker inspection. The tasks verify them by hand, with `scripts/build.sh`, Compose, and `docker` commands only.

## Risks / Trade-offs

- [The Playwright npm version and the image tag drift apart] → Pin the exact version in `package.json`. Add a Dockerfile comment at the `FROM` line that states the coupling. A mismatch fails loudly: Playwright reports a missing browser executable.
- [TypeScript 7 is the new native compiler, and `tsc` options can differ from 5.x] → The config uses only basic options. If `tsc` 7 rejects one, pin `typescript@^6` and record the reason.
- [The relative `base` breaks deep links once client-side routing exists] → No routing exists now. The change that adds routing must revisit `base` and the nginx fallback.
- [Two e2e runs on one Docker host share the project name `countryroad-e2e` and collide] → This is a non-goal. A later CI change can set a unique project name per job.
- [`ipc: host` shares the host IPC namespace with the test container] → The container runs only our own tests against our own app. The dev stack does not use this setting.
- [The builder runs on every `up --build`, even with no source change] → The build of a placeholder app takes seconds. Revisit if build time grows.
- [Editors on the host cannot resolve package types, because `node_modules/` does not exist there] → This is the cost of the Docker-only rule. A later change can add a dev container for editor support.
- [`docker build --output` needs BuildKit] → Docker 23 and later use BuildKit by default. The planning host runs Docker 29.

## Migration Plan

This is a new project, so no migration applies. Rollback means deleting the added files.
