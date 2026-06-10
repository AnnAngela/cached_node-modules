#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
CACHE_DIR="$ROOT_DIR/.cache"
ESBUILD_BIN="$ROOT_DIR/node_modules/.bin/esbuild"
SRC_TARGETS=(
    "index"
    "post"
)

echo "Start packaging..."
echo "srcTargets: ${SRC_TARGETS[*]}"

rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"
mkdir -p "$CACHE_DIR"

# Build index and post in parallel — they share no state.
pids=()
for target in "${SRC_TARGETS[@]}"; do
    echo "-------------------------------------------------------------------------"
    echo "Packaging ${target}.ts..."
    "$ESBUILD_BIN" "$ROOT_DIR/src/${target}.ts" \
        --bundle \
        --packages=bundle \
        --banner:js='import{createRequire as __createRequire}from"node:module";const require=__createRequire(import.meta.url);' \
        --format=esm \
        --charset=utf8 \
        --drop:debugger \
        --keep-names \
        --legal-comments=eof \
        --log-level=info \
        --minify \
        --metafile="$CACHE_DIR/${target}-meta.json" \
        --outfile="$DIST_DIR/${target}.js" \
        --platform=node \
        --target=node24 \
        &
    pids+=($!)
done
# Wait for each background job individually — `wait` without arguments
# only returns the exit status of the last job, which can mask earlier
# esbuild failures.
for pid in "${pids[@]}"; do
    wait "$pid" || exit 1
done

echo "-------------------------------------------------------------------------"
node -e "require('fs').writeFileSync('$DIST_DIR/package.json', JSON.stringify({type:'module'}) + '\n')"

echo "Packaging completed successfully."
