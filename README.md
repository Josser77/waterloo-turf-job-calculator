# Waterloo Turf Job Calculator

A single-file desktop and web tool for calculating turf installation jobs.
Built for Waterloo Turf's internal use. The current build date is shown in the
app's sidebar (e.g. `build 2026-09-22`) so you can tell which version is live.

## What it does

**Quote Builder**
- Define turf rows (Base Yard, Alt Turf Option, Putting Green) per project
- Add infill, edging, rock, misc items, and installation consumables from shared catalogs
- Auto-generates every quote combination — turf variants, with/without putting green, infill tiers — each pre-priced with crew rates and profit margin applied

**Layout Tab**
- Import a Moasure CSV to get the yard's shape, sqft, and roll plan (auto-fits to the view on first open). Arc **center** points in the CSV are filtered out regardless of Moasure's spelling (CentrePoint / Center / etc.) so no stray lines are drawn
- Multi-layer CSV support: mark secondary shapes as Reference only, Separate turf area, Cutout, or Putting Green
- **Draw mode**: sketch on a blank canvas even with no import ("✏️ Start a blank drawing"), or add markup (lines, shapes, landscape elements). Draw a Rectangle or Circle, then **📐 Set size & lay turf** to enter its real dimensions and turn it into a measured turf layer with a roll plan and order — no Moasure needed. Lines are markup only
- **Move Layers**: drag any shape (main outline or added layers) freely to lay out a full yard from several measurements — the view holds steady so shapes stay where you place them. The single **⊙ Fit** button re-frames everything (it works in Move Layers too)
- **Blade direction**: one clear arrow per turf layer shows which way the roll grain runs, placed at the shape's interior center. Each layer's direction follows its roll and flips with the per-layer **⇄ Blades** button. Putting green is skipped (pile too low to matter); fringe arrows point inward toward the green
- Roll layout diagram showing strip/piece placement, seam lines, and scrap. Turf pieces draw in shades of green (putting green lightest, fringe darkest, main turf in between)
- Manual butt-seam cuts and drag-and-drop piece nesting into waste areas (in Cut Mode, a click toggles a cut and a press-and-drag nests a piece — no mode switching needed)
- **Display options** (collapsible): roll rectangles, shape dimensions, piece dimensions, shape labels, roll/piece labels, blade direction
- Cut List (📋): a CAD-style drawing of every piece with its cut dimensions in feet-and-inches. The width shown is the **full cut width including the S-seam side trim**. A **🖨 Print / PDF** button prints the layout diagram + full cut list for installers
- Every mode (Draw, Edit Shape, Move Layers, Cut) keeps its help text collapsed under a "ⓘ How … works" twisty to keep the toolbar clean

**Putting Green Fringe**
- Mark a secondary Moasure layer as the Putting Green to unlock fringe config
- Specify fringe turf product and width; the tool traces the green's actual outline and computes pieces automatically
- Nearby straight/curved sections are merged into single pieces (with mitered corners, no overlap) to minimize seams
- Toggle between showing individual fringe pieces on the canvas or a single smooth outline

**Settings** (all catalogs are inline-editable — type directly in the beige fields, ＋ Add at the bottom, × to delete)
- **Turf** products: WT name, vendor name, a multi-select **Type** dropdown (Standard / Putting Green / Fringe), cost, notes
- **Infill**, **Rock/Base** (with depth), **Edging**, and **Miscellaneous items** catalogs
- **Installation Consumables** (seam tape, glue, nails, weed barrier) with a per-product default and notes
- **Labor Rates & Price Sheet**: multiple crew rate sets, inline-editable, drag-to-reorder. Per-crew tiered (sqft-based) pricing for the standard and putting-green install rates — the whole job is billed at the bracket its installed sqft falls into
- **Daily-minimum labor floor**: a per-crew minimum on the **turf-install labor** (standard + putting-green install only; edging and materials are billed separately on top). Profit margin applies to the full job cost, including the floor
- Profit margin setting (margin-on-price)
- Configurable **backup-staleness reminder** (default: warn if no backup in 2 days)

**Other tabs**
- **Pavers**, **Bark/Mulch**, **River Rock**: standalone ground-cover estimators (see below); don't affect the turf quote
- **Dashboard**: job-history insights mined from saved projects
- **Vendor Pricing**: import and view each supplier's price list (see below)

**General**
- All data stored locally in `localStorage` — no server, no account required
- Per-project storage with Sync/Backup export/import for moving data between devices
- Runs as a desktop app (Mac + Windows via Electron) and as a web app via GitHub Pages

Live at: **https://turf.brianyoss.com**

---

## Updating the live site

The four files (`waterloo_turf_calculator.html`, `waterloo_turf_tests.js`,
`README.md`, `CHANGELOG.md`) are delivered as a single **`files.zip`**.

1. Save the downloaded `files.zip` into the **repo** folder (`waterloo-turf-job-calculator`)
2. Double-click **`Sync and Push.command`** (a thin wrapper that runs `sync-and-push.sh`)

The script:
1. Unzips `files.zip`
2. Copies all four files into the repo folder (published to GitHub Pages)
3. Copies the two code files (`waterloo_turf_calculator.html`, `waterloo_turf_tests.js`) into the **Electron app** folder so it stays current for a future desktop build
4. Prints the build stamp it's about to publish, then commits and pushes to GitHub — Pages redeploys in a minute or two

If the repo already matches the zip, it skips the commit (but still syncs the Electron folder). After a push, confirm the live sidebar shows the expected build stamp.

`files.zip` and `*.bak` are git-ignored so they aren't committed.

---

## Folder structure

```
Turf Job Calculator/
├── waterloo-turf-app/                    ← Electron desktop app project
│   └── waterloo_turf_calculator.html     ← kept in sync by the script (for a future app build)
│   └── waterloo_turf_tests.js
└── waterloo-turf-job-calculator/         ← this repo (GitHub Pages)
    ├── waterloo_turf_calculator.html     ← the app (published)
    ├── index.html                        ← redirects to the calculator
    ├── CNAME                             ← custom domain (turf.brianyoss.com)
    ├── waterloo_turf_tests.js            ← unit test suite
    ├── sync-and-push.sh                  ← unzip + sync-both-folders + push
    ├── Sync and Push.command             ← double-clickable wrapper (Mac)
    ├── CHANGELOG.md
    └── README.md
```

---

## Development

Run the test suite before shipping any change to `waterloo_turf_calculator.html`:

```bash
node waterloo_turf_tests.js
```

All tests should pass (currently **2165** — copy this from the runner's `Tests:`
line rather than adding to the previous figure). Each session that produces an
updated calculator file also updates this README and bumps the sidebar build stamp
to the current date (`.2`, `.3`, … for multiple builds on the same day).

See **[CHANGELOG.md](CHANGELOG.md)** for a full history of changes by session.

---

## Pavers tab

A standalone estimator for how many pavers to order. Uses the imported Moasure area by default (or a manually entered area), plus paver length/width and joint spacing (all in inches). Each paver tiles as a (length+spacing)×(width+spacing) cell; pavers = area ÷ cell, plus an overage % for cuts/breakage, rounded up to whole pavers. Does not affect the turf quote. Backed by the pure `computePaverPlan`.

## Bark/Mulch & River Rock tabs

Two standalone ground-cover estimators (same shell as Pavers). Each takes the Moasure or manual area, a depth (inches), a Type (name + a coverage value = ft² one cubic yard covers per inch, geometric = 324), an install rate ($/sq ft), and an optional material cost ($/cu yd). Cubic yards = (area × depth) ÷ coverage, rounded up to the next half yard; install = area × rate. Backed by the pure `computeGroundCoverPlan`. Does not affect the turf quote.

## Job History Dashboard (Dashboard tab)

Insight mined from saved projects — total jobs, turf sold (avg/median/largest job size), revenue (from jobs with a recorded price), most-used turf products, and a by-month timeline. No new data entry. Pure `computeJobStats`.

## Global Waste Minimizer (Layout → ✨ Minimize waste)

One click sweeps every roll direction (180° × 8 seam offsets) on the primary shape and every install layer, applies the lowest-waste option to each, and reports the reduction in ordered sqft. Pure `bestRollForPoints` powers both this and the per-layer Auto button.

## Project search (sidebar)

Live filter box over the project list — matches on name, address, and status (won/lost/pending). Multi-word AND matching. Pure `filterProjects`.

## Vendor Pricing (tab)

Import and view each supplier's price list (PDF / Excel / CSV), switchable per vendor like crews. PDFs embed; Excel/CSV render as a table (xlsx parsed library-free via DecompressionStream). Files stored in IndexedDB (not in the JSON backup — re-importable reference docs).
