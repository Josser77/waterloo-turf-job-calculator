#!/bin/bash
# Syncs waterloo_turf_calculator.html from the Electron app folder into the
# GitHub Pages repo, then commits and pushes.
#
# Usage: double-click this file (if marked executable and opened via
# Terminal), or run from Terminal:
#   ./sync-and-push.sh
#
# Expects this folder layout (adjust the paths below if yours differs):
#   Turf Job Calculator/
#     waterloo-turf-app/                    <- source of truth (Electron app)
#       waterloo_turf_calculator.html
#       waterloo_turf_tests.js
#     waterloo-turf-job-calculator/         <- this repo (GitHub Pages)
#       waterloo_turf_calculator.html
#       waterloo_turf_tests.js
#       sync-and-push.sh   <- this script

set -e  # stop on first error

# Resolve the directory this script lives in, so it works regardless of
# where it's run from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$SCRIPT_DIR"
APP_DIR="$(cd "$REPO_DIR/../waterloo-turf-app" && pwd)"

echo "Source (Electron app):  $APP_DIR"
echo "Destination (web repo): $REPO_DIR"
echo ""

# Files that get synced from the app folder into the repo. The HTML file is
# required; the test file is optional (only copied if present in the app
# folder) since not every session touches it.
HTML_SOURCE="$APP_DIR/waterloo_turf_calculator.html"
HTML_DEST="$REPO_DIR/waterloo_turf_calculator.html"
TESTS_SOURCE="$APP_DIR/waterloo_turf_tests.js"
TESTS_DEST="$REPO_DIR/waterloo_turf_tests.js"

if [ ! -f "$HTML_SOURCE" ]; then
  echo "ERROR: Source file not found at $HTML_SOURCE"
  echo "Did you save the updated waterloo_turf_calculator.html into the waterloo-turf-app folder?"
  exit 1
fi

cp "$HTML_SOURCE" "$HTML_DEST"
echo "Copied waterloo_turf_calculator.html into the web repo."

if [ -f "$TESTS_SOURCE" ]; then
  cp "$TESTS_SOURCE" "$TESTS_DEST"
  echo "Copied waterloo_turf_tests.js into the web repo."
else
  echo "(waterloo_turf_tests.js not found in waterloo-turf-app — skipping, leaving repo's copy as-is)"
fi

cd "$REPO_DIR"

# Check if anything actually changed across all tracked files
if git diff --quiet -- waterloo_turf_calculator.html waterloo_turf_tests.js README.md CHANGELOG.md && \
   git diff --cached --quiet -- waterloo_turf_calculator.html waterloo_turf_tests.js README.md CHANGELOG.md; then
  echo ""
  echo "No changes detected — nothing to commit or push."
  exit 0
fi

git add waterloo_turf_calculator.html
[ -f "$TESTS_DEST" ] && git add waterloo_turf_tests.js

# Also stage README and CHANGELOG if they were updated this session
[ -f "$REPO_DIR/README.md" ] && git add README.md
[ -f "$REPO_DIR/CHANGELOG.md" ] && git add CHANGELOG.md

# Use today's date in the commit message, plus allow an optional custom message
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
if [ -n "$1" ]; then
  MSG="$1"
else
  MSG="Update calculator ($TIMESTAMP)"
fi

git commit -m "$MSG"
echo ""
echo "Committed: $MSG"

git push
echo ""
echo "Pushed to GitHub. Pages will redeploy in a minute or two."
echo "Live at: https://josser77.github.io/waterloo-turf-job-calculator/"
