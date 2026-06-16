#!/bin/bash
# Double-clickable entry point. This is intentionally a THIN WRAPPER around
# sync-and-push.sh (the single source of truth, which includes the test gate),
# rather than a second full copy — so the two can never drift apart.
#
# Double-click this in Finder, or run from Terminal:
#   ./Sync_and_Push.command            # timestamped commit message
#   ./Sync_and_Push.command "message"  # custom commit message
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/sync-and-push.sh" "$@"
