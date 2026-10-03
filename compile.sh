#!/usr/bin/env bash
set -euo pipefail

pushd ~/quartz

# Public site: pages, assets, and discovery output for everything public.
# `env` is required: a bare VAR=x line is a shell variable and is not
# exported to child processes.
time env QUARTZ_BUILD_MODE=public npx quartz build --directory ~/brain --output public

# Private overlay: private pages, private assets, and the private index only.
time env QUARTZ_BUILD_MODE=private npx quartz build --directory ~/brain --output private

popd
