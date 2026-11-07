#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

compose() {
  docker compose --project-name countryroad-e2e --file compose.yaml --file compose.e2e.yaml "$@"
}

finish() {
  status=$?
  set +e
  if [ "$status" -ne 0 ]; then
    compose logs builder web
  fi
  compose down --volumes --remove-orphans
  exit "$status"
}

trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

compose build
compose run --rm e2e
