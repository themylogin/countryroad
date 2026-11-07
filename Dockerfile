FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
ENV BUILD_OUT_DIR=/dist
CMD ["npm", "run", "build"]

FROM builder AS dist-build
RUN npm run build

FROM scratch AS dist
COPY --from=dist-build /dist/ /

FROM builder AS unit
RUN npx tsc && npx vitest run --reporter=verbose

# The tag must equal the exact @playwright/test version in package.json.
FROM mcr.microsoft.com/playwright:v1.65.0-resolute AS e2e
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY playwright.config.ts ./
COPY e2e ./e2e
CMD ["npx", "playwright", "test"]
