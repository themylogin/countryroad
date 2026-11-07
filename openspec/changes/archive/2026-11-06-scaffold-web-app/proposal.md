# Proposal

## Why

The countryroad project has no code. Feature work needs a base first. That base is a web app that builds to static files, a Docker stack that serves the files, and e2e tests that prove the served app works. All of it runs in Docker, so the host needs no other tools.

## What Changes

- Add a plain TypeScript web app built with Vite. It has no UI framework and no features. It shows one placeholder heading.
- Add a static build that runs in Docker. `scripts/build.sh` type-checks and builds the app in a container, then writes a self-contained `dist/` directory to the host. Any static file host can serve `dist/` from any URL path.
- Add a Docker Compose set with three services:
  - `builder` builds the app into a shared volume, then exits.
  - `web` serves the built files with nginx.
  - `e2e` runs Playwright tests against `web`. It lives in a separate Compose file, so `docker compose up` does not run it.
- Add one command that runs the full stack, returns the e2e exit code, and removes the containers. The command does not touch a running dev stack.
- Add a Playwright smoke test for the placeholder page.
- Keep the host free of project tools. The host needs only Docker. No workflow installs Node, npm packages, or browsers on the host. Dependency changes also run in a container.

## Capabilities

### New Capabilities

- `app-shell`: The page that the browser loads: document title, root element, and the script that renders into it. Later features grow from this shell.
- `static-build`: The build that turns the source into static files, and the properties of those files (self-contained, path-independent, type-checked).
- `compose-stack`: The Docker Compose services that build, serve, and e2e-test the app, the exit-code contract for test runs, and the rule that every workflow needs only Docker on the host.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- New files at the project root: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/`, `e2e/`, `playwright.config.ts`, `Dockerfile`, `compose.yaml`, `compose.e2e.yaml`, `.dockerignore`, `.gitignore`, `scripts/`, `README.md`.
- New dev dependencies: `vite`, `typescript`, `@playwright/test`.
- New container images: `node:26-alpine`, `nginx:stable-alpine`, `mcr.microsoft.com/playwright:v1.65.0-resolute`.
- The host needs only Docker with Compose 2.24 or later. Node, npm packages, and browsers exist only inside images.
- Out of scope: app features, routing, a UI framework, a dev server with live reload, CI pipeline setup, production deployment, and cross-browser testing beyond Chromium.
