# Tasks

Every verification step runs through Docker, `scripts/*.sh`, `curl`, or file inspection. No step runs Node, npm, or a browser on the host.

## 1. Project setup

- [x] 1.1 Create `package.json` with `"name": "countryroad"`, `"private": true`, `"type": "module"`, and one script: `"build": "tsc && vite build"`. Verify that `scripts` in the file holds only `build`.
- [x] 1.2 Add the dev dependencies `vite@^8.3.6`, `typescript@^7.0.2`, and `@playwright/test@1.65.0` (exact, no caret). Generate `package-lock.json` with the container command from design.md. Verify that `package.json` lists the three versions, that `package-lock.json` exists, that both files belong to the host user, and that the project has no `node_modules/`.
- [x] 1.3 Create `.gitignore` with `node_modules/`, `dist/`, `test-results/`, and `playwright-report/`. Create `.dockerignore` with the same entries plus `.git`, `openspec/`, and `.claude/`. Verify that both files contain these entries.

## 2. Static build in Docker

- [x] 2.1 Create `index.html`, `src/main.ts`, `tsconfig.json`, and `vite.config.ts` as design.md describes. Create `Dockerfile` with the stages `builder`, `dist-build`, `dist`, and `e2e`. Add one comment at the Playwright `FROM` line: the image tag must match the exact `@playwright/test` version in `package.json`. Verify that `docker build --target dist-build .` and `docker build --target e2e .` succeed, and that `tsc` in the builder image reports version 7.0.
- [x] 2.2 Create the executable script `scripts/build.sh` as design.md describes. Verify that it exits with status 0, that `dist/index.html` references only `./assets/...` paths, that each referenced file exists, and that every file in `dist/` belongs to the host user.
- [x] 2.3 Check the type-error scenario. Add a type error to `src/main.ts` and record the file list and modification times of `dist/`. Verify that `scripts/build.sh` exits non-zero, names `src/main.ts` and the line, and leaves `dist/` unchanged. Remove the error.
- [x] 2.4 Check the stale-file scenario. Create `dist/stale.txt` and run `scripts/build.sh`. Verify that `dist/stale.txt` no longer exists.
- [x] 2.5 Write the `README.md` sections "Requirements" (Docker with Compose 2.24 or later, nothing else) and "Build static files" (`scripts/build.sh`). State that any static host can serve `dist/` from any URL path. Remove all host npm instructions. Verify that the documented command runs as written.

## 3. Compose dev stack

- [x] 3.1 Create `compose.yaml` with the services `builder` and `web` and the named volume `dist`, as design.md describes. Verify that `docker compose up --build` serves the app at `http://localhost:8080/` with status 200, that the volume holds only the build output, and that no `e2e` container starts.
- [x] 3.2 Verify the port override: `WEB_PORT=9090 docker compose up --build` serves the app at `http://localhost:9090/`.
- [x] 3.3 Verify the source-change scenario. Change the heading text and run `docker compose up --build` again. Confirm with `curl` that the served script contains the new text and that the old asset file is gone from the volume. Restore the text.
- [x] 3.4 Verify the build-fail scenario. Add a type error, run `docker compose up --build` from a stopped stack, and confirm that `builder` exits non-zero and `web` does not start. Remove the error and run `docker compose down --volumes`.
- [x] 3.5 Write the README section "Serve with Docker" with `docker compose up --build`, the `WEB_PORT` override, and `docker compose down`. Verify that the commands run as written.

## 4. E2E tests in Docker

- [x] 4.1 Create `playwright.config.ts` with `testDir: 'e2e'`, `reporter: 'list'`, one Desktop Chrome project, and `use.baseURL` from `BASE_URL` only. Create `compose.e2e.yaml` with `web.ports: !reset []` and the `e2e` service. Verify that `docker compose -f compose.yaml -f compose.e2e.yaml config` shows no published port for `web` and shows `BASE_URL=http://web/` for `e2e`.
- [x] 4.2 Create `e2e/app-shell.spec.ts` with one test per scenario in `specs/app-shell/spec.md`, and `e2e/static-build.spec.ts` with the sub-path test from design.md. Create the executable script `scripts/e2e.sh` as design.md describes. Verify that `scripts/e2e.sh` exits with status 0 and reports 5 passed tests.
- [x] 4.3 Remove the `h1` append from `src/main.ts`. Verify that `scripts/e2e.sh` exits non-zero, the heading test fails, and the empty-root test passes. Restore the code.
- [x] 4.4 Set `base: '/'` in `vite.config.ts`. Verify that `scripts/e2e.sh` exits non-zero and the sub-path test fails. Restore `base: './'`.
- [x] 4.5 Verify the failed-test scenario. Change an expected value in `e2e/app-shell.spec.ts`. Confirm that `scripts/e2e.sh` exits non-zero and its output names the failed test. Restore the test.
- [x] 4.6 Verify the build-fail scenario. Add a type error to `src/main.ts`. Confirm that `scripts/e2e.sh` exits non-zero, prints the `tsc` error from the `builder` logs, and runs no test. Remove the error.
- [x] 4.7 Verify cleanup after each run in 4.2 to 4.6. `docker ps -a`, `docker volume ls`, and `docker network ls`, filtered on `label=com.docker.compose.project=countryroad-e2e`, must list nothing.
- [x] 4.8 Verify isolation. Start the dev stack with `docker compose up --build -d`, then run `scripts/e2e.sh`. Confirm that the run exits with status 0, and that the dev `web` container keeps its ID and still returns status 200 on port 8080. Run `docker compose down --volumes`.
- [x] 4.9 Write the README section "End-to-end tests" with `scripts/e2e.sh`, its exit-code contract, the isolation note, and the Playwright version coupling. Verify that the command runs as written.

## 5. Dependency changes in a container

- [x] 5.1 Write the README section "Change dependencies" with the container command from design.md. Run it with an existing package at its current version. Verify that `package.json` and `package-lock.json` keep their content and owner, and that no `node_modules/` appears in the project.

## 6. Integration checks

- [x] 6.1 Verify the host-without-Node scenario. Create a directory with symlinks to only `docker`, `sh`, and the shell utilities that the scripts call. With `PATH` set to that directory, run `scripts/build.sh`, `docker compose up --build -d` with `docker compose down --volumes`, `scripts/e2e.sh`, and the dependency command. Confirm that each one exits with status 0.
- [x] 6.2 Verify the no-leftovers scenario after 6.1. The project has no `node_modules/` and no `test-results/`, and the host has no `~/.cache/ms-playwright/`.
- [x] 6.3 Run `openspec validate scaffold-web-app --strict` and verify that it reports no errors.
