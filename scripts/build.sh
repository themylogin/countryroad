#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

staging=$(mktemp -d)
trap 'rm -rf "$staging"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir "$staging/dist"
docker build --target dist --output "type=local,dest=$staging/dist" .
rm -rf dist
mv "$staging/dist" dist
