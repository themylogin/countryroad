#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

exec docker build --target unit --progress=plain --no-cache-filter unit .
