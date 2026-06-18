# Waterloo Turf Job Calculator

A single-file desktop and web tool for calculating turf installation jobs.
Built for Waterloo Turf's internal use.

## What it does

**Quote Builder**
- Define turf rows (Base Yard, Alt Turf Option, Putting Green) per project
- Add infill, edging, rock, and misc items from a shared catalog
- Auto-generates every quote combination — turf variants, with/without putting green, infill tiers — each pre-priced with crew rates and profit margin applied, ready for Jobber

**Layout Tab**
- Import a Moasure CSV to get the yard's shape, sqft, and roll plan
- Multi-layer CSV support: mark secondary shapes as holes, informational, or Putting Green
- Roll layout diagram showing strip/piece placement, seam lines, and scrap
- Manual butt-seam cuts and drag-and-drop piece nesting into waste areas (in Cut Mode, a click toggles a cut and a press-and-drag nests a piece — no mode switching needed)
- Piece List cut sheet: length × width for every piece (main yard + fringe), labeled by roll, with total linear footage

**Putting Green Fringe**
- Mark a secondary Moasure layer as the Putting Green to unlock fringe config
- Specify fringe turf product and width; the tool traces the green's actual outline and computes pieces automatically
- Nearby straight/curved sections are merged into single pieces (with mitered corners, no overlap) to minimize seams — accepts slightly more material in exchange for fewer cuts
- Toggle between showing individual fringe pieces on the canvas or a single smooth outline matching the installed look

**Materials Tab**
- Auto-populated material quantities from Quote Builder inputs
- Rock/base materials catalog with depth settings

**Settings**
- Turf, infill, rock, and misc item catalog
- Multiple crew rate sets (labor rates per sqft, edging, etc.)
- Per-crew tiered (sqft-based) pricing for the standard and putting-green install rates — the whole job is billed at the rate of the bracket its installed sqft falls into
- Profit margin setting (margin-on-price)

**General**
- All data stored locally in `localStorage` — no server, no account required
- Per-project storage with Sync/Backup export/import for moving data between devices
- Runs as a desktop app (Mac + Windows via Electron) and as a web app via GitHub Pages

---

## Updating the live site

After saving an updated `waterloo_turf_calculator.html` into the
`waterloo-turf-app` folder, double-click **`Sync and Push.command`** in this
folder. It will:

1. Copy `waterloo_turf_calculator.html` from `../waterloo-turf-app/` into this repo
2. **Run the test suite as a gate** — if any test fails, the script stops here and nothing is committed or pushed
3. Commit the change with a timestamped message (or pass a custom message: `./sync-and-push.sh "describe the change"`)
4. Push to GitHub — Pages redeploys automatically in a minute or two

Live at: **https://josser77.github.io/waterloo-turf-job-calculator/**

If there are no changes since the last push, the script does nothing.

---

## Folder structure

```
Turf Job Calculator/
├── waterloo-turf-app/                    ← Electron desktop app project
│   └── waterloo_turf_calculator.html     ← source of truth; save updates here
└── waterloo-turf-job-calculator/         ← this repo (GitHub Pages)
    ├── waterloo_turf_calculator.html     ← copy of the above (synced by script)
    ├── index.html                        ← redirects to the calculator
    ├── waterloo_turf_tests.js            ← unit test suite
    ├── sync-and-push.sh                  ← sync + push script (Terminal)
    ├── Sync and Push.command             ← same script, double-clickable on Mac
    └── README.md
```

---

## Development

Run the test suite before committing any changes to `waterloo_turf_calculator.html`:

```bash
node waterloo_turf_tests.js
```

All tests should pass (currently **603**). The `Sync and Push.command` script runs
this suite as a gate and refuses to commit or push if any test fails.

Each session that produces an updated calculator file also updates this README
to reflect any new features, test count changes, or workflow changes.

See **[CHANGELOG.md](CHANGELOG.md)** for a full history of changes by session.
