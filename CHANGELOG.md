# Changelog — Waterloo Turf Job Calculator

All notable changes to the calculator are documented here.
Format: newest sessions at the top. Each entry covers one development session.

---

## 2026-06-17 (cont'd, 8) — Nesting: area decides, piece goes where you drop it

### Corrected the fit test (it was measuring the wrong thing)
The previous build refused to relocate a nested piece unless a clear *full-roll-width* column
existed in the target's waste, and otherwise drew it in place with a "won't fit" note. That was
wrong: a nested piece is a small CUT shape, not a full-width block, and the prior check compared
the piece's whole **bounding rectangle** (15 ft wide) against the waste — so pieces that plainly
fit by area were rejected. Eligibility is now purely by **area** (piece area ≤ target waste area,
as it already was at drop time), and the geometric refusal is gone.

### Placement now honors the drop
`assignNestPlacements` places each nested piece centered on the point where it was dropped
(both along and across the roll), clamped to stay within the target's rectangle, and only nudges
it along the roll to avoid stacking on another piece already nested there. `nestedPieceOffset`
uses the stored `_nestX`/`_nestY`; the full-width-column gate, the `_nestNoFit` in-place draw,
and the rejection toast were removed.

### Tests
- Section 49 rewritten to the real behavior: piece is placed (never refused) even on an irregular
  notch target, is centered on the dropped x, clamps near edges, and two pieces dropped close
  together are nudged apart. The integration test drives the real `computeRollLayout` and checks
  the piece is placed within the target rect in x and y on actual clipped geometry.
- **Total: 557 tests, all passing** (555 prior − 7 old section-49 + 9 new).

### Still open
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 7) — Nested pieces never overlap turf (geometry-aware) + layout integration tests

### Root cause found: full-width pieces vs partial-width waste
A nested piece is always the full roll width, but a roll's leftover waste is usually
*partial*-width (a side sliver or a notch). Earlier placement tried to set the piece down in
that waste and, when no full-roll-width clear column existed, it overlapped the installed
turf — visible in testing as a piece sitting on top of another piece's turf. (An integration
probe against the real `computeRollLayout` confirmed: with a notch-shaped waste an 840-sqft
overlap was unavoidable.)

### Fix: relocate only when it fits cleanly, otherwise draw in place
- New `clearXOrNull(...)` returns the nearest x with a genuinely clear full-roll-width column
  (avoiding the target's turf and any pieces already placed there), or `null` if none exists.
- `assignNestPlacements` now flags pieces with no clear column as `_nestNoFit`; `nestedPieceOffset`
  draws those in their own place (zero offset) rather than overlapping the turf. The area saving
  still applies, and a brief toast explains the in-place draw.
- `nearestClearX` keeps a least-overlap fallback for drawing only; nesting is never rejected,
  so the feature stays usable even though most real waste is partial-width.

### New: layout integration tests (catching these before you do)
The prior tests were unit-level with synthetic inputs, which is why on-canvas placement bugs
slipped through. Section 49 adds an integration test that drives the **real `computeRollLayout`**,
forces a nest between two strips using their actual clipped polygons, runs the placement pass,
and asserts the invariant: every nested piece is either drawn in place or has ~0 turf overlap.
Plus unit coverage for `clearXOrNull` (notch → null, clear end-waste → x, oversized piece → null)
and the `_nestNoFit` flag.

### Tests
- **Total: 555 tests, all passing** (548 prior + 7 new).

### Still open
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 6) — Nested pieces never overlap turf or each other

### Fix: pieces nested in the same roll no longer overlap
Placement previously avoided the target roll's installed turf but not other pieces already
nested in that same roll, so two dropped pieces could land on top of each other. Now every
nested piece's position is resolved together: pieces sharing a roll are placed one at a time
(in drop-x order), each avoiding the turf AND the pieces already placed there. Nothing
overlaps — not turf, not other nested pieces.

### How it works
- New `assignNestPlacements(layout)` runs at the start of each canvas draw. For each roll it
  walks its nested pieces in drop order and assigns a non-overlapping roll-frame x (stored on
  the unit as `_nestX`), accumulating occupied intervals as it goes.
- `nearestClearX` now takes an `occupied` list of `[x0,x1]` intervals and treats them as
  blocked in addition to the turf.
- `nestedPieceOffset` just uses the pre-assigned `_nestX` (its old inline scan was removed),
  so draw-time placement and overlap-avoidance share one code path.

### Tests
- Extended section 48 with 6 assertions: `nearestClearX` honoring occupied intervals (snaps
  to the nearest free side, clears turf + an occupied piece at once) and `assignNestPlacements`
  giving two pieces in the same roll non-overlapping positions inside the rectangle.
- **Total: 548 tests, all passing** (542 prior + 6 new).

### Still open
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 5) — Nested piece honors the drop AND stays off the turf

### Follow-up to the drop-point placement fix
The previous change made a dropped piece land where you dropped it, but it removed all
turf-avoidance — so a drop whose x-range overlaps the target roll's installed turf placed
the piece on top of that turf (a nested piece spans the full roll width, so any turf at that
x collides). Now placement honors the drop as the *preferred* position but **snaps to the
nearest clear x** so the piece lands in the waste, not on the turf. A drop that's already in
clear waste is kept exactly where dropped.

### How it works
- New pure helper `nearestClearX(preferredX, pieceWidth, rectX0, rectX1, targetClip, rectY0,
  rectY1)`: returns the preferred x if a pieceWidth-wide strip there doesn't overlap the
  target's clipped turf, otherwise the nearest x (scanning both directions) that's clear;
  falls back to the preferred x if nothing fully fits.
- `nestedPieceOffset` now feeds the drop's centered x through `nearestClearX` instead of
  using it raw.

### Tests
- Added section 48 ("Nesting: snap off turf"): 5 assertions — drop in clear waste kept as-is,
  drop on turf snaps just past the turf edge to the nearest clear x, deep-in-waste kept,
  and no-turf returns the preferred x unchanged.
- **Total: 542 tests, all passing** (537 prior + 5 new).

### Still open
- Two pieces nested into the *same* waste area can still overlap each other (placement
  avoids the target's turf, not other nested pieces).
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 4) — Nested pieces land where you drop them

### Fix: moving a cut piece to a waste area now honors the drop point
Previously, dropping a piece into a roll's waste area only recorded *which* roll it went
to — the draw code then auto-placed it at the first clear spot, ignoring where you actually
dropped it. So the piece never went where you put it. Now the drop position is captured (in
roll-frame coordinates) and the piece is placed there: centered on the drop point along the
target roll, clamped so the whole piece stays on the roll. Drop it again to nudge it. Pieces
nested before this change (with no stored position) still auto-place as before.

### How it works
- On drop, `endDragNesting` un-rotates the drop point to roll-frame and stores it in a new
  `proj.layout.nestPos` map (parallel to `proj.layout.nesting`, so the existing
  key→target mapping, compute, Put-back, and tests are unchanged).
- `getRollOpts` passes `nestPos` into `computeRollLayout`, which attaches the anchor to the
  nested unit; the draw step's `nestedPieceOffset` uses it via the new pure helper
  `nestPlacementX(dropRfX, pieceWidth, rectX0, rectX1)` (center-and-clamp). No anchor →
  the original auto-scan placement.
- "↩ Put back" and dropping a piece off the waste area both clear the stored position.

### Tests
- Added section 47 ("Nesting: honor drop point"): 9 assertions covering `nestPlacementX`
  (centering, clamping at both edges, non-zero rect origin, oversized piece), `getRollOpts`
  carrying `nestPos` through, and `computeRollLayout` attaching the anchor to the nested
  unit (and leaving it null when none was dropped).
- **Total: 537 tests, all passing** (528 prior + 9 new).

### Still open
- Overlap between two pieces nested into the *same* waste area isn't prevented (placement
  avoids the target's turf, not other nested pieces). Not addressed here.
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 3) — Per-crew tiered (sqft-based) labor pricing

### New feature: tiered pricing for standard & putting-green install rates
A crew's per-sqft **Standard Turf Install** and **Putting Green Install** rates can now
vary by job size instead of being a single flat number. Each can hold a set of brackets
(an upper sqft limit + a $/sqft rate) plus an "all other" rate for anything above the
largest limit. The **whole job is charged at the rate of the bracket its installed sqft
falls into** — flat per bracket, not progressive (e.g. "up to 1,000 → $8", "above → $7":
a 1,500 sqft yard bills at $7 × 1,500). Tiers are per-crew, so one crew can be flat while
another is tiered. The standard rate tiers off the standard install area; the putting
green rate tiers off the putting green area.

### How it works
- **Settings → Labor Rates:** the rate cell for those two lines now shows a **"Tiers…"**
  button (or "Edit tiers" when already tiered) that opens a tier editor modal — toggle
  "Use sqft-based tiered pricing," add/remove brackets, set the "all other" rate.
- **Quote Builder:** each option card's labor line shows the resolved per-sqft rate with a
  "tiered" tag so it's clear which bracket applied.
- **Data model:** a labor line item may carry `tiers: [{upTo, rate}, …, {upTo:null, rate}]`
  (upTo null = "and above"); absence of `tiers` = flat `rate`, unchanged. New helpers
  `resolveTierRate`, `getCrewItemsForQuote`, `getRateFor`, `itemIsTiered`; the quote labor
  calc now resolves standard/putting via `getRateFor(key, sqft)` instead of a flat lookup.
- **Bug fix:** copying a crew now deep-copies tier arrays so two crews never share the same
  brackets.

### Tests
- Added section 46 ("Tiered labor pricing"): 20 assertions covering `resolveTierRate`
  (flat fallback, bracket boundaries, unsorted tiers, missing unbounded tier) and
  `getRateFor` (project-crew resolution, tiered vs flat, default fallback).
- **Total: 528 tests, all passing** (508 prior + 20 new).

### Not in this change
- "Layout page as source of truth for Installed/Ordered SqFt (auto-apply to Quote Builder)"
  was scoped and deferred to the next session per build-order preference (tiered first).

---

## 2026-06-17 (cont'd, 2) — Cut/move/reset clarity; per-piece Put back tests

### UX clarity: distinguishing cuts from moved (nested) pieces
Users were conflating two separate things — *clearing a cut* vs *putting a moved piece
back* — and chasing the finicky "drag the piece off the waste area" gesture because the
docs presented it as the primary reset. No behavior changed; the functionality was already
complete (multiple cuts, multiple independent moves, and per-piece reset via the existing
"↩ Put back" button). The fixes are purely explanatory:
- Rewrote the nesting legend in Roll Results to name **"↩ Put back"** as the reliable reset
  and demote drag-off-waste to a fiddly secondary option. Clarified that putting a piece
  back keeps your cuts.
- Added sub-labels under the **Manual Cuts (Butt Seams)** and **Nested Pieces** lists
  spelling out the difference: "Clear all cuts" un-cuts the roll (and discards moves of
  those pieces); "↩ Put back" returns one moved piece to its own order while cuts stay
  intact.
- Updated the in-app docs (Manual Cuts and Drag-and-Drop Nesting sections) to match.

### Tests
- Added section 45 ("Nesting: per-piece Put back"): 6 assertions covering `unnestPiece`
  (removes exactly the targeted piece, leaves others nested, persists + re-renders, safe
  no-op when project/layout/nesting are missing) and the compute-level guarantee that
  removing a nesting key restores Ordered SqFt to the un-nested baseline.
- **Total: 508 tests, all passing** (502 prior + 6 new).

> **Doc-hygiene note:** the "Nested Pieces / ↩ Put back" feature itself is not recorded in
> the entries below — it appears to have shipped without a CHANGELOG entry. If the repo
> copy of this file also lacks one, backfill a short entry for it.

---

## 2026-06-17 (cont'd) — Cut Mode drag-to-nest fix; dead test section removed; test gate

### Bug fix: can't move a piece to a waste area while in Cut Mode
The earlier "cut disappears" fixes (touch-coordinate fallback, click-in-place guard in
`endDragNesting`) addressed nesting being cleared *after* a drop — but a separate root
cause remained: while Cut Mode was active you couldn't even start the drag. In Cut Mode,
`mousedown` went straight to `startCut`, which toggled the seam you grabbed (so the cut
line vanished) and never armed a drag, so the piece didn't move and the gesture appeared
to do nothing.

Fixed by making Cut Mode distinguish a **click** from a **press-and-drag** using the same
8px movement threshold used elsewhere:
- `startDragNesting` no longer bails when Cut Mode is on (it still bails in Move Layers and
  Edit Shape modes). On `mousedown` in Cut Mode it records the press position and arms a
  potential drag-nest.
- New `endCutClick` runs on release: if the pointer barely moved it performs the cut toggle
  (`startCut`); if it moved past the threshold it leaves the nest to `endDragNesting`.

Result: you can cut a strip and immediately drag a leftover piece into another roll's waste
area without switching modes. In-app docs updated to match.

### Test infrastructure: removed orphaned section + added a gate
- Removed a **duplicate summary block with a stray `process.exit()`** in
  `waterloo_turf_tests.js` that was silently terminating the run partway through — the
  entire "44. importLayoutCsv / Base Turf Area" section after it had never executed.
- That orphaned section referenced `getBaseShapesArea` / `getBaseSecondaryShapeIndices`,
  which were removed in the 2026-06-17 multi-CSV revert. It was hidden, not deleted; the
  revert is now actually complete and the stale section was removed (recoverable from git
  history if multi-CSV is revisited).
- `Sync and Push.command` now runs the suite as a **gate**: a failing test aborts the push,
  so failing code can't reach GitHub Pages.

### Tests
- Added section 44 ("Cut Mode drag-to-nest routing"): 10 assertions covering the
  click-vs-drag decision in `endCutClick` and the relaxed guard in `startDragNesting`.
  These are DOM-less unit tests of the routing logic, not real pointer drags — a manual
  drag on the layout canvas remains the only end-to-end check.
- **Total: 502 tests, all passing** (492 prior + 10 new; the orphaned section was never
  in the running count).

---

## 2026-06-17 — Nesting/cut persistence fix; multi-CSV reverted

### Bug fix: cut disappears when moving a piece to a waste area
Two bugs caused the cut to vanish immediately after dropping a piece into a waste area:

**Bug 1 — touch event coordinate failure (primary cause on mobile/touchscreen):** `touchend` events have an empty `evt.touches` list — the finger that lifted is only in `evt.changedTouches`. The code was reading `evt.touches[0]` on touchend, getting `undefined`, and computing NaN canvas coordinates. `endDragNesting` then received a nonsense drop position, found no valid waste area, and deleted the just-stored nesting entry — un-nesting the piece immediately after placing it. Fixed: `canvasEventToData` now falls back to `changedTouches[0]` when `touches[0]` is absent.

**Bug 2 — click-in-place clears nesting (desktop):** any click on the canvas (mousedown + mouseup without moving) triggered `endDragNesting`, treated the click position as a "drop outside waste," and deleted the nesting entry. Fixed: `startDragNesting` now records the pointer's start position; `endDragNesting` skips processing entirely if the pointer moved fewer than 8 canvas pixels — treating it as a click, not a drop.

### UI: "Apply Sqft to Order" clarification
Added a helper note below the button explaining it pushes the Ordered SqFt value (which already reflects nesting savings) into the selected turf row — so the workflow after nesting is: nest piece → Ordered SqFt updates → click Apply Sqft to Order.

### Reverted: multi-CSV import + Base Turf Area mode
The multi-CSV feature (additive imports, "Base Turf Area" secondary shape mode, merged roll layouts) introduced bugs in independent layer movement and was reverted in full. The nesting fix and touch fix above were kept. Multi-CSV support will be revisited in a future session with a different implementation approach.

### Tests
- Section 44 (multi-CSV) removed along with the revert
- **Total: 492 tests, all passing**

---

## 2026-06-16 (cont'd, 2) — Multi-CSV import + Base Turf Area mode (reverted)

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
