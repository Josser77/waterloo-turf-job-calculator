#!/bin/bash
# One-step publish for the Waterloo Turf Job Calculator.
#   1) Click "Download All", save the zip as files.zip into the REPO folder below.
#   2) Run this script. It unzips the files, stamps the real build date+time, copies
#      them into the repo AND the Electron app folder, then commits & pushes to GitHub.

set -e

REPO="/Users/byoss/Desktop/Waterloo Turf/Turf Job Calculator/waterloo-turf-job-calculator"
APP="/Users/byoss/Desktop/Waterloo Turf/Turf Job Calculator/waterloo-turf-app"
ZIP="$REPO/files.zip"

cd "$REPO"

if [ ! -f "$ZIP" ]; then
  echo "❌ files.zip not found in the repo folder:"
  echo "   $REPO"
  echo "   Save the 'Download All' zip there as files.zip, then run this again."
  exit 1
fi

echo "📦 Unzipping files.zip …"
TMP="$(mktemp -d)"
unzip -o -q "$ZIP" -d "$TMP"

# All four files go into the repo (published to GitHub Pages).
REPO_FILES="waterloo_turf_calculator.html waterloo_turf_tests.js README.md CHANGELOG.md"
# Only the two code files go into the Electron app folder (it doesn't need the repo docs).
APP_FILES="waterloo_turf_calculator.html waterloo_turf_tests.js"

echo "→ Repo:  $REPO"
copied=0
for name in $REPO_FILES; do
  src="$(find "$TMP" -type f -name "$name" -print -quit)"
  if [ -n "$src" ]; then cp "$src" "$REPO/$name"; echo "   ✓ $name"; copied=$((copied+1));
  else echo "   ⚠ $name not found in zip (skipped)"; fi
done

if [ "$copied" -eq 0 ]; then
  echo "❌ No expected files found in files.zip — nothing to publish."
  rm -rf "$TMP"; exit 1
fi

# ── Stamp the REAL build date+time (this Mac's clock, at push time) into the sidebar
#    marker. Every push gets a unique, ordered stamp — no manual date/counter to get wrong.
BUILD="$(date '+%Y-%m-%d %H:%M')"
if grep -q '>build [0-9]' "$REPO/waterloo_turf_calculator.html"; then
  sed -i '' "s/>build [0-9][0-9-]* *[0-9:]*</>build ${BUILD}</" "$REPO/waterloo_turf_calculator.html"
  echo "🔖 Stamped build: ${BUILD}"
else
  echo "⚠ Build marker not found in the HTML — skipped stamping (published as-is)."
fi

# Copy the (now-stamped) code files into the Electron app folder too.
echo "→ Electron app: $APP"
if [ -d "$APP" ]; then
  for name in $APP_FILES; do
    if [ -f "$REPO/$name" ]; then cp "$REPO/$name" "$APP/$name"; echo "   ✓ $name"; fi
  done
else
  echo "   ⚠ Electron folder not found — skipped (repo still updated)."
fi

rm -rf "$TMP"

git add -A
if git diff --cached --quiet; then
  echo "ℹ️  No changes to commit (repo already matches). Electron folder was still synced."
  exit 0
fi

git commit -m "Update calculator — build ${BUILD}"
git push
echo "🚀 Pushed. The GitHub Action should deploy shortly."
echo "   Verify the live sidebar shows: build ${BUILD}"
