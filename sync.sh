#!/usr/bin/env bash
set -euo pipefail

# Both targets land under /srv/brain/; rsync scopes --delete to the
# per-target subdirectory it creates (public/, private/).
time rsync --delete -rlpD --chmod=ug+rwX ~/quartz/public ilya@vorontsovie.xyz:/srv/brain/
time rsync --delete -rlpD --chmod=ug+rwX ~/quartz/private ilya@vorontsovie.xyz:/srv/brain/
