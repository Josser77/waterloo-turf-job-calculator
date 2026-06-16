# Changelog — Waterloo Turf Job Calculator

All notable changes to the calculator are documented here.
Format: newest sessions at the top. Each entry covers one development session.

---

## 2026-06-17 — Cut + nesting persistence fix

### Bug fix: cut disappears / nesting clears immediately after dropping a piece
Two separate bugs caused this:

**Touch event coordinate bug (primary cause):** on mobile/touchscreen, `touchend` events have an empty `evt.touches` list — the touch that just ended is only in `evt.changedTouches`, not `evt.touches`. The canvas event helper was reading `evt.touches[0]`, getting `undefined`, and returning NaN coordinates. `endDragNesting` then received a nonsense drop position, found no valid waste area, and deleted the just-stored nesting entry — clearing the nest immediately after it was placed.

**Click-in-place clears nesting (desktop cause):** any mousedown+mouseup on the canvas without moving (a click, not a drag) would trigger `endDragNesting`, compute a drop position on top of the piece's filled area (not in any waste zone), and delete nesting. This meant clicking anywhere on the canvas after successfully nesting a piece would un-nest it.

**Fixes:** updated `canvasEventToData` to fall back to `changedTouches[0]` when `touches[0]` is absent, so touchend events get correct coordinates. Added a drag-distance guard to `endDragNesting`: if the pointer moved fewer than 8 canvas pixels from where the drag started, treat it as a click (not a drop) and leave nesting state entirely unchanged.

### UI: "Apply Sqft to Order" clarification
Added a short helper note below the "Apply Sqft to Order" button clarifying that it pushes the Ordered SqFt value (which already accounts for pieces nested into waste) into the turf row — so the flow after nesting is: nest the piece → Ordered SqFt updates → click Apply Sqft to Order.

### Tests
No new test sections (the bugs were in canvas event handling, which requires a real browser DOM to test meaningfully). Confirmed 513/513 passing with no regressions.

---

## 2026-06-16 (cont'd, 2) — Multi-CSV import + Base Turf Area mode

### New feature: import multiple separate Moasure CSVs into one project
- "Import CSV" no longer replaces the whole layout on a second import — the first import still sets the primary shape as before, but every CSV imported after that appends its shape(s) as additional layers, for jobs where the yard was measured in more than one Moasure session
- New secondary-shape mode: **"Base Turf Area"** — alongside the existing Exclude/Ignore/Putting Green options. A shape marked Base Turf Area gets its own independent roll layout (same Roll Width/Direction/Seam Offset/margins as the primary shape), its own strips and pieces on the canvas and in the Piece List, and its area is added to Installed Area (rather than subtracted, like Exclude). Multiple Base shapes can exist; their sqft combines into one total, applied to a single turf row via "Apply Area" exactly as before
- Each Base shape can be repositioned independently via "Move Layers", same as any other layer
- Canvas: Base shapes draw with a solid green outline (matching the primary shape's style) rather than the dashed/informational treatment, since their strips already render filled/colored like real turf

### Under the hood
- `computeRollLayout` gained an optional `keyPrefix` parameter so strips from different shapes never collide on the same manual-cut/nesting key, even when two shapes happen to produce strips at the same roll-frame position
- `getAdjustedShapeArea` keeps its original subtract-only semantics (exclude/putting-green); a new `getBaseShapesArea` helper sums Base-mode shapes separately, avoiding any double-counting between the merge step and the area-adjustment step

### Tests
- Added section 44: additive CSV import behavior (first import sets primary, second appends as secondary), `getAdjustedShapeArea`/`getBaseShapesArea`/`getBaseSecondaryShapeIndices` unit coverage, and a full end-to-end `renderRollLayout` test with a primary shape plus a Base-mode secondary shape — verifying merged strip tagging, combined area with no double-counting, `totalOrdered` matching the sum of two independent roll layouts, globally unique strip keys, and correct "Apply Area" output
- **Total: 513 tests, all passing**

---

## 2026-06-16 (cont'd) — Stray line fix, round 2

### Bug fix: stray line still appeared with "Show purchased roll rectangles" on
- The previous fix (same day) suppressed a degenerate strip's clipped polygon and ordered length, but missed that its purchased-rectangle outline (`displayRect`) still had 4 points even though they collapsed to zero area — and the canvas drawing code only checks `.length` (truthy with 4 points) before drawing that rectangle's hatching and outline
- With "Show purchased roll rectangles" checked, this meant the degenerate strip's near-zero-area rectangle still got drawn, appearing as the same kind of stray line
- Fix: a degenerate strip's `displayRect` is now an empty array (not a 4-point zero-area shape), consistent with how `clipped`/`displayClipped` were already handled — every draw-site check (`u.displayRect.length`) now correctly skips it
- Reproduced and verified against a real customer yard CSV (Melanie_yard.csv) at the exact settings from the report: Roll Direction 89°, Seam Offset 0ft, rectangles shown

### Tests
- Added section 43: degenerate strips' `displayRect` is empty (not 4 zero-area points), verified against both the real reproduction CSV and the synthetic shape from the prior fix, at multiple seam offsets; confirmed real strips keep their normal 4-point rectangles
- **Total: 492 tests, all passing**

---

## 2026-06-16 — Stray line fix (round 1), cutting margin prominence

### Bug fix: stray line at extreme seam offset
- Fixed a rendering bug where, at certain Seam Offset slider positions (especially the extremes), a thin "ghost" strip could appear as a stray horizontal line extending well past the actual yard shape
- Root cause: when a roll strip's band only grazes the shape boundary (barely touching a vertex), `clipPolygonToRect` can return a degenerate sliver — near-zero area, but with a long x-extent (a thin triangle's bounding box isn't bounded by its height). This sliver's misleading extent was being used to compute `orderedLength`, producing a long, thin, visible rectangle on the canvas
- Fix: any strip whose true clipped area is at or below 0.1 sqft is now treated as having no material — its ordered length, clipped polygon, and display geometry all collapse to zero/empty instead of drawing a stray shape
- Verified no impact on real strips: same strip count and consistent total clipped area at both seam offset extremes on the reproduction shape

### Cutting Margin — visual prominence
- The Cutting Margin field (Layout → Roll Settings) is now visually distinct from the other Roll Settings fields: amber background, left accent border, warning icon in the label, and a short explanation directly beneath it
- Clarifies that this is the main lever controlling how much buffer length gets added to every cut piece before rounding up to the next whole foot — no calculation changes, this was a pure UI/clarity update

### Tests
- Added section 42: degenerate near-zero-area sliver strips produce zero ordered length, empty clipped/display polygons, and zero-area display rectangles (not stray visible shapes) — tested at both extremes of the seam offset range, with a sanity check that real strip counts and total areas are unaffected
- **Total: 484 tests, all passing**

---

## 2026-06-15 — GitHub Pages, Icons, Fringe polish

### GitHub / Deployment
- Created public GitHub repo `Josser77/waterloo-turf-job-calculator`
- Enabled GitHub Pages — live at https://josser77.github.io/waterloo-turf-job-calculator/
- Added `index.html` redirect so root URL works
- Added `Sync and Push.command` (double-clickable Mac script) that copies the updated calculator from `waterloo-turf-app/`, commits, and pushes to GitHub automatically
- Added `README.md` and `CHANGELOG.md` (this file)

### App Icons
- Designed Mac (`.icns`) and Windows (`.ico`) app icons using Waterloo Turf brand colors and Raleway ExtraBold font
- Dark green background (`#173326`), white "WT" monogram, kelly green (`#55B763`) underline accent, "JOB CALCULATOR" subtitle at full size
- Icon sizes: 16–1024px (ICNS), 16–256px multi-resolution (ICO)

### Putting Green Fringe — geometry overhaul
- Fixed critical bug in `mergeCollinearEdges`: loop termination error caused the function to revisit points and produce 134 pieces (one per original boundary point) instead of the correct ~11 merged pieces, with a blown-up ring area (~600 sqft vs ~53 sqft for a 1ft fringe)
- Replaced overlapping "extend each piece by width" corner design with proper mitered polygon offsetting — adjacent pieces now share exact corners with zero overlap and zero gap
- Added miter-limit clamping (2× fringe width) to prevent unbounded spikes at sharp corners on fine-grained outlines
- Added gap-closing post-pass: snaps adjacent pieces' outer corners together at any clamped reflex corners so no bare slivers remain

### Fringe outline (smooth display)
- Added `computeFringeOutline(pgPoints, width)` — a per-vertex smooth offset following every original boundary point (not the coarser merged piece corners), used for "outline only" canvas display
- Fixed spike at the polygon seam (duplicate closing point with zero-length edge) by carrying forward the previous valid edge normal instead of emitting `{0,0}` for degenerate edges
- "Show fringe pieces" unchecked now draws this smooth outline, matching how the fringe would look once installed

### Layout sidebar
- Widened sidebar column: `clamp(220px, 22vw, 320px)` → `clamp(260px, 26vw, 380px)`
- Increased spacing between field-group sections in the layout sidebar (22px gap, 18px padding, subtle divider line between sections)
- Section header labels get more breathing room (8px bottom margin vs 5px)
- Changes are scoped to `#layoutSidebar` only — other tabs unaffected

### Tests
- Added section 39: `mergeCollinearEdges` regression tests including real-world Sub Layer 1 shape (134 points), rotation invariance, and piece count/ring area sanity checks
- Added section 40: fringe visibility toggle — `piecesVisible:true` draws labeled pieces, `piecesVisible:false` draws smooth outline, default behavior when key is absent
- Added section 41: `computeFringeOutline` — distance accuracy (avg ≈ width, max < 1.2×width), no self-intersections, no spike vertices at seam (max local deviation < 0.45)
- **Total: 472 tests, all passing**

---

## 2026-06-14 — Fringe cuts optimization, piece list, piece visibility toggle

### Putting Green Fringe — edge merging for fewer seams
- Added `mergeCollinearEdges(pgPoints, maxDeviation, maxRunLength)` — greedily merges consecutive near-straight edges into single chord pieces where all intermediate vertices stay within `width/2` of the chord, capped at `rollLength - width` per piece
- Motivation: Moasure "Arc" path segments produce many tiny edges (~0.3ft each); without merging, this creates one fringe piece per edge (potentially 100+) with seams everywhere
- Tolerance scales with fringe width — wider fringe merges more aggressively
- All `computeFringePlan` call sites updated to pass `rollLength` from project layout settings

### Piece List (Length × Width view)
- New "Piece List" section in Roll Results (below Manual Cuts)
- Table columns: Roll N / Piece M label, Length (ft), Width (ft), SqFt, Notes
- Notes column shows "cut from Roll N / Piece M waste" for nested pieces, "PG fringe" for fringe pieces
- Fringe pieces appended below main-yard pieces when fringe is enabled, using their own length/width (not roll width)
- Total piece count and total linear footage shown at bottom
- Hidden automatically when no layout is present

### Fringe pieces visibility toggle
- New checkbox "Show fringe pieces on canvas (uncheck for just the outline)" in fringe config
- `piecesVisible: true` (default): draws each piece filled + outlined + labeled "Fringe N"
- `piecesVisible: false`: draws outer boundary as a single closed polygon
- Setting persisted to `proj.layout.fringe.piecesVisible`
- Toggle only affects canvas drawing — Piece List, sqft, and pricing unchanged

---

## 2026-06-13 — Putting Green Fringe (initial implementation)

### New feature: Putting Green Fringe
- New layer mode `'putting-green'` for secondary Moasure shapes (alongside existing `'exclude'` and `'ignore'`)
- Only one shape can be the PG at a time — selecting it elsewhere demotes the previous one to `'exclude'`
- `getAdjustedShapeArea` updated: `'putting-green'` mode subtracts area like `'exclude'`
- New "Putting Green Fringe" config section appears in Layout tab when a PG layer is marked
- Config: enable checkbox, fringe turf product dropdown (from catalog), fringe width (ft)
- `computeFringePlan(pgPoints, width)`: computes per-edge fringe pieces outward from the PG outline, returns `{pieces, perimeter, pgArea, ringArea, totalSqFt}`
- `computeFringeOutline`: smooth per-vertex offset polygon (added later — see above)
- Canvas: fringe pieces drawn in orange (`#C77800`) with "Fringe N" labels when pieces visible
- Fringe summary panel shows: PG perimeter, fringe width, ring area, sqft to order, material cost, piece count
- Fringe material cost added to COGS for all PG-inclusive quote options; "No Putting Green" cards unaffected

### Geometry helpers added
- `signedPolygonArea(poly)` — signed area for winding-direction detection
- `polygonPerimeter(poly)` — sum of edge lengths
- `mergeCollinearEdges` — (see above, built in follow-up session)
- `computeFringeOutline` — (see above, built in follow-up session)

---

## 2026-06-12 — Piece List, docs sweep, fringe groundwork

### Layout tab
- Roll Results section restructured: Manual Cuts list and Piece List added below the roll diagram
- `renderManualCutsList` rewritten to show strips with stale cuts (out of range after geometry changes) with a "Clear these cuts" button
- Stale cut detection: iterates all keys in `proj.layout.manualCuts` (not just strips with active pieces)

### Materials tab
- Rock/Base card simplified from 5 columns to 2 (Material name + Tons), with remove button
- `makeRockRow` rewritten; `updateRockSqFt` removed (dead code)
- Rock cost excluded from quote totals (included in crew's per-sqft labor rate)

### Quote Builder
- Multi-layer CSV support for secondary shapes confirmed working for main yard + PG combinations
- Verified `calcQuote` correctly generates per-turf-product groups with PG/no-PG cards
- Fringe cost line added to breakdown for PG-inclusive cards

### Docs
- Swept all `$X` default claims in How to Use — removed false "default $8/$9/$55" rate references
- Updated nesting docs: pieces labeled "from Roll N / Piece M waste" (not old "from R{N} waste" format)
- Added Piece List docs section
- Updated Recommended Workflow to include Layout tab steps

---

## 2026-06-11 — Global Roll/Piece labeling, profit margin, sort persistence

### Roll/Piece labeling
- `assignRollPieceLabels(layout)` — walks all strips/pieces in array order, tracks cumulative ordered length, starts new roll when crossing a multiple of `rollLength`
- Replaces old per-strip "Roll N.M" scheme
- Canvas labels, Manual Cuts list chips, and piece list all use "Roll N / Piece M" format
- Nested pieces labeled "from Roll N / Piece M waste" in their notes

### Profit margin
- `MARGIN_KEY = 'wt_profit_margin'`; `getProfitMargin()` / `setProfitMargin(pct)` (clamped 0–99)
- `applyMargin(cogs, pct) = cogs / (1 - margin/100)` (margin-on-price, not markup)
- New Settings card "Profit Margin" with `#profitMarginInput`
- Quote cards show COGS and sell price side-by-side when `marginPct > 0`

### Project sort persistence
- `SORT_KEY = 'wt_sort_mode'`; `sortMode` initialized from localStorage
- `sortProjects(mode, btn)` persists via `localStorage.setItem`
- Sort buttons given `data-mode` attributes; `renderSidebar()` syncs active class

### Multiple crew rate sets
- Multiple named crew configurations, each with independent labor rates
- Active crew selector in the UI; `getRates()` resolves rates from the active crew
- `calcQuote` uses active crew rates for all pricing

---

## 2026-06-10 — New Project modal, role selection, rock catalog

### New Project modal
- Supports both "installed sqft" and "sqft to order" fields per turf product
- Role selection (Base Yard / Alt Turf Option / Putting Green) at project creation time
- `checkCreateBtn()` validation: requires "sqft to order" > 0 for all checked turf products before enabling Create
- Fixed: role dropdown `onchange` handler not re-running auto-populate after role switches (rock calculation doubling bug)

### Settings — Rock catalog
- Rock products catalog with Default Depth and Price per SqFt @ 1"
- Rock rows auto-sync from catalog; depth locked to settings values
- Rock cost excluded from quote totals

### Infill
- `calcInfillRow` computes bags from sqft × lbsPerSqFt / 50
- Infill sqft auto-populates per tier (standard / upgraded / putting-green)

---

## 2026-06-09 — Initial build

### Core architecture
- Single self-contained HTML/CSS/JS file (`waterloo_turf_calculator.html`)
- `localStorage` persistence — no server, no account required
- Electron wrapper for Mac/Windows desktop app (`waterloo-turf-app/`)
- Sidebar project list with A-Z / Newest / Oldest sort, multi-select export

### Quote Builder tab
- Turf rows with role (Base Yard / Alt Turf Option / Putting Green)
- Infill rows with tier (Standard / Upgraded / Putting Green)
- Edging (linear ft → boards + install cost)
- Misc items with per-job role assignment
- `calcQuote()`: generates every combination of turf × infill tier × PG option as labeled cards (A, B, C…)

### Layout tab
- Moasure CSV import (`parseLayoutCsv`)
- Roll layout engine: strips, clipping to yard polygon, scrap/waste calculation
- Canvas with zoom, pan, rotation, view rotation slider
- Manual cuts (butt seams): click seam lines on canvas or enter positions in list
- Drag-and-drop piece nesting into waste areas
- Layer visibility toggles for multi-shape CSVs

### Materials tab
- Auto-populated from Quote Builder inputs
- Turf: ordered sqft, linear ft, estimated cost
- Infill: bags per product
- Rock/base: tons per product

### Settings tab
- Turf catalog (name, type, cost per linear ft)
- Infill catalog (name, lbs/sqft, cost/bag)
- Rock catalog (name, default depth, cost)
- Misc items catalog
- Labor rates (standard, putting green, edging, edging board)
- How to Use documentation

### Test suite
- `waterloo_turf_tests.js` — Node.js unit tests run against the extracted script
- Sandboxed VM context with mocked DOM/localStorage/ResizeObserver
- Initial coverage: layout geometry, clipping, nesting, infill, quote generation
