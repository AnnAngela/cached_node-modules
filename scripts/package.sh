#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
ESBUILD_BIN="$ROOT_DIR/node_modules/.bin/esbuild"
SRC_TARGETS=(
    "index"
    "post"
)

echo "Start packaging..."
echo "srcTargets: ${SRC_TARGETS[*]}"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

for target in "${SRC_TARGETS[@]}"; do
    echo "-------------------------------------------------------------------------"
    echo "Packaging ${target}.ts..."
    "$ESBUILD_BIN" "$ROOT_DIR/src/${target}.ts" \
        --bundle \
        --format=esm \
        --legal-comments=none \
        --log-level=info \
        --minify \
        --outfile="$DIST_DIR/${target}.js" \
        --platform=node \
        --target=node24
done

echo "-------------------------------------------------------------------------"
printf '%s\n' '{"type":"module"}' > "$DIST_DIR/package.json"

echo "Packaging completed successfully."
