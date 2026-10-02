#!/usr/bin/env bash
set -euo pipefail

pushd ~/quartz

# Public site: pages, assets, and discovery output for everything public.
QUARTZ_BUILD_MODE=public
time npx quartz build --directory ~/brain --output public

# Private overlay: private pages, private assets, and the private index only.
QUARTZ_BUILD_MODE=private
time npx quartz build --directory ~/brain --output private

popd
