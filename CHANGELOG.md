# Changelog — Waterloo Turf Job Calculator

All notable changes to the calculator are documented here.
Format: newest sessions at the top. Each entry covers one development session.

---

## 2026-06-21 (cont'd, 45) — Layout right pane: sub-tabs instead of twisties; Layers back on the right

Restructures the Layout page's right pane on request. Test suite: **846** (sandbox 803),
unchanged (DOM structure, verified in-app).

- The five collapsible twisties (Roll Direction & Seam, Apply, Display & overlays, Fringe,
  Roll Results) are replaced by **sub-tabs** across the top of the right pane, so each
  section is one click away with no long scroll. The always-visible key-metrics block
  (Installed / Ordered SqFt, Linear Ft, Perimeter) stays pinned above the tabs.
- **Layers & roll grouping moved off the bottom of the page back into the right pane** as
  its own *Layers* tab. The below-canvas full-width strip is gone.
- The **Fringe** tab only appears when a layer is set to Putting Green (the tab button is
  shown/hidden by `renderFringeSection`; if you were on it when the green is removed, it
  falls back to Roll & Seam).
- New `switchLayoutSubtab(name)` toggles the active panel/button and remembers the choice.
  Sidebar widened from `clamp(260px,26vw,380px)` to `clamp(300px,30vw,440px)` to fit the
  layer cards (now single-column in the narrower pane). The Advanced details inside Results
  stays a small nested twisty.

---



Both were too quiet. Test suite: **846** (sandbox 803), unchanged (DOM/canvas warnings, verified in-app).

- **Free fill now warns whenever it's in use,** not only when it exceeds scrap. A persistent
  note under Installed SqFt spells out that the area is added to Installed but not ordered
  (assumed cut from leftover scrap), in amber; it escalates to red when the free-fill area
  is larger than the waste actually available. Choosing Free fill on a layer also fires a
  toast explaining the same thing.
- **Overlapping a placed piece with turf is now unmissable.** Previously the only cue was a
  red outline on the canvas. Now: a toast fires the moment you drop onto turf ("won't fit
  there"), and a persistent red banner under Installed SqFt counts how many placed pieces
  overlap turf until you move them clear. A too-big-to-nest drop also toasts instead of
  silently snapping back.

---



Test suite: **846** (sandbox 803), unchanged (UI wording + canvas-drop behavior, verified in-app).

- **Layer-mode dropdown reworded** and given a one-line explanation of the selected mode
  under it. "Overlay" is renamed **Free fill** everywhere it's user-visible (dropdown,
  the per-mode help line, the canvas label "(free fill)", the Installed SqFt note "incl. N
  ft² free fill from scrap", and the over-scrap warning), because "Overlay — cut from
  existing roll's waste" implied you could drag/place it, which you can't. The help line
  for Free fill now says plainly that it isn't rolled or placed and points to Install +
  drag for real placement. Other modes: "Measure only — doesn't change totals", "Install
  — separate turf area, its own rolls", "Cutout — subtract as a hole", "Putting green —
  for fringe calculation".
- **The red "overlaps turf" warning now actually fires when you aim at turf.** The drop
  handler previously only accepted a target when the drop point was in the *waste*
  (`!pointInPoly(displayClipped)`), so dropping onto a spot that already had turf was
  rejected outright — the piece snapped back and you saw nothing. Now a unit is a valid
  target when the drop point lands anywhere on its purchased rectangle (waste or turf) and
  it has enough waste; the piece lands where you aimed and is flagged **red** ("overlaps
  turf") if it sits on installed turf. `placedOverlapsTurf` itself was already correct.
- **Drag highlight spans layers:** the green dashed "valid target" outline now lights up
  eligible rolls in *every* layer (matching cross-layer nesting), not just the dragged
  piece's own layer.

---



Fixes the Layers & roll grouping panel jumping around while you adjust a slider.
Test suite: **846** (sandbox 803), unchanged (canvas-sizing behavior, verified in-app).

- `renderRollLayout` re-fit the canvas height to the rotating shape's bounding box on
  every render, so each tick of a roll-direction / seam / rotate slider changed the
  canvas height and shoved the panel directly below it up and down — you couldn't watch
  the layer while tuning it. The list rebuild was already drag-guarded; the canvas resize
  wasn't.
- During a live drag (slider `oninput`) the roll-direction, seam, and per-layer rotate
  sliders now render through `renderRollLayoutStableCanvas()`, which freezes the canvas
  size (`sizeLayoutCanvas` early-returns) so the panel stays put. The draw still fits the
  rotating content inside the fixed box. On release (`onchange`) the normal render runs and
  re-fits the canvas to the final shape. (Added an `onchange` to the secondary Rotate
  slider, which previously only had `oninput`.)

---



A piece can now be nested into a **different** install layer's roll waste, not just
its own. Test suite: **846** (sandbox 803), +14 (new section 61).

- **Drop handler** (`endDragNesting`): the target search now spans every install
  layer (secondary-first, matching draw z-order), and the drop anchor is stored in the
  **target** layer's roll frame — so the piece records where it lands in the layer whose
  waste it's tucked into.
- **Resolution** (`resolveCrossLayerNesting`, new): `computeRollLayout` resolves nesting
  per-layer, so a cross-layer target is invisible to it. A new pass runs after all layers
  are rolled (before summing): for each cross-layer nest that fits the target's waste, it
  marks the piece nested and **drops it from its own layer's order** (Ordered SqFt, Linear
  Ft, roll count) — the piece is cut from the other layer's already-bought roll waste. The
  target layer's order is unchanged; only its scrap falls. Combined Ordered SqFt falls by
  the piece while installed area is unchanged, so combined scrap falls — verified headless.
- **Draw**: a cross-layer nested piece is rendered in the target layer's waste by mapping
  its roll-frame footprint through the target's purchased rectangle
  (`rollPointToDisplayViaRect` / `nestedCrossLayerDisplayPoly`), since the source piece's
  own display transform belongs to a different layer and can't be reused directly.
- **Known limits (v1):** cross-layer placement is approximate — the piece lands in the
  target's waste near the drop point, clamped inside the rectangle; and the red
  "overlaps turf" check samples across frames, so it's a rough cue cross-layer. Both want
  a visual pass in the `file://` build.

---



Two small fixes. Test suite: **832** (sandbox 789), unchanged (UI only).

- **Alignment:** the previous fix relied on a label `min-height`, but "Roll Length — one
  full roll (ft)" wrapped to two lines and overran it, dropping that one input. Replaced
  the four per-field flex columns with a single flat grid (4 labels row, 4 inputs row, 4
  helpers row), so every input sits in the same grid row and stays aligned regardless of
  how a label wraps. Roll Length's label shortened to "Roll Length (ft)" (the "one full
  roll" detail moved to its helper text).
- **Cutting Margin treated like the others:** dropped the ⚠ icon, the orange bold label,
  the redundant yellow border, and the "main lever" framing in the card, intro, and
  in-app docs. It's now a plain field identical to Width / Length / Trim. (Width/length
  are physically fixed and trim is a shop constant, which is why it had been highlighted
  — but the override applies to all four equally, so there's no reason to single it out.)

---



Changing a roll setting with a project open now asks where it should apply, instead of a
pre-set Override checkbox. Test suite: **832** (sandbox 789).

- Editing a field (on `change`) with a project open opens a dialog: **Every project
  (global default)** / **Only this project** / **Cancel**. Global writes the global
  default and drops any prior override of that field; project writes a field-granular
  override; cancel reverts the field to its prior value (captured on focus).
- Overrides are now **field-granular** — overriding Cutting Margin still tracks the
  global width/length/trim. `setProjectRollOverrideField` / `clearProjectRollOverrideField`
  manage them; clearing the last field drops the override entirely.
- The checkbox is gone; a status line shows "uses the global default" or "overrides the
  global default (cutting margin)", with **Reset this job to the global default**.
- With no project open, editing writes straight to the global default (no dialog).

### Tests
- Section 58 extended: field-granular override set/clear, other fields still resolving to
  the global, and clearing the last field dropping the override.

---



Roll Width / Length / S-seam Trim / Cutting Margin are now a **global default** with an
optional **per-project override** (the hybrid). Test suite: **827** (sandbox 784).

- **Global default** lives in localStorage (`wt_rollDefaults`); every project uses it
  unless it overrides.
- **Per-project override** is stored on `proj.rollSettings`. A project "overrides" iff
  that object exists. `resolveRollSettings(proj, global)` returns the global default
  overlaid by the project's override (partial overrides fill missing keys from global).
- **UI:** a checkbox "Override for the current project: <name>" on the Roll Settings
  card. Unticked → editing the fields changes the global default (note explains this).
  Ticked → editing writes only this job's override; a "Reset to global" link drops it.
  Checking the box seeds the override from the current global so the job starts where it
  was. The contextual note + state refresh whenever you open a project or the tab.
- `onRollSettingChange` routes writes to the override or the global based on state; no
  silent cross-job changes — a job only diverges once you tick Override.

### Tests
- Section 58 reworked: global default read/merge, `resolveRollSettings` (no override →
  global; override wins and fills unspecified keys from global; an overriding job keeps
  its margin when the global changes), and `projectOverridesRoll`.

---



Two fixes to the Settings → Roll Settings card. Test suite: **821** (sandbox 778).

### Per-project roll settings (reverted from global)

Roll Width / Length / S-seam Trim / Cutting Margin are now **saved per project**
(`proj.rollSettings`) — Cutting Margin especially is a per-job lever. `getRollDefaults`
reads the current project's `rollSettings`, falling back to any legacy per-project
`proj.layout.*` fields, then the legacy global seed (`wt_rollDefaults`), then the
15×100/4/4 standard. `saveRollDefaults` writes `proj.rollSettings` and saves; nothing
writes the global store anymore. Inputs reload on tab/project switch via
`loadRollDefaultsToInputs`. In-app docs + stale "global" comments updated.

### Card alignment

The Cutting Margin field was in a boxed cell taller than the other three, so the row
didn't line up. All four fields are now uniform flex cells in one
`repeat(auto-fit,minmax(190px,1fr))` grid; labels share a `min-height` with bottom
alignment so the inputs line up despite 1- vs 2-line labels. The Cutting Margin box is
gone — it's now an orange bold label + a yellow-bordered input (no background box).

---



New layer mode for overlapping/stacked layers. Test suite: **821** (sandbox 778).

A fifth secondary-shape mode, **Overlay**, for the "Install on an existing roll because
of layer overlays" case. An overlay layer:

- **Adds to Installed SqFt** (`getOverlayArea`) — it's real installed turf.
- Adds **nothing to the order** — it's cut from an existing roll's waste, so no extra
  rolls and no Ordered SqFt / Linear Ft (it's excluded from `computeInstallLayerLayouts`,
  like ignore, but counted as installed).
- Never subtracts (it's not a cutout — `getAdjustedShapeArea` leaves the primary alone).
- Adds its edge to **Perimeter** (it's an installed piece).
- Drawn in violet with a dotted outline, labeled "(overlay, from waste)".
- **Waste check:** if the overlay area exceeds the roll waste actually available
  (Ordered − installed), a warning shows under Installed SqFt — past that it isn't all
  free and needs extra turf.

Installed SqFt label now reads e.g. "470 ft² (incl. 100 ft² overlay from waste)".

### Tests
- New section 60: `getOverlayArea` sums only overlay shapes; overlay never subtracts;
  overlay is excluded from install layers (adds no rolls/Ordered, identical to ignore
  for the order) while still counting as installed.

---



Four fixes from testing. Test suite: **816** (sandbox 773).

### 1. Secondary shapes default to "Measure only" (ignore), not Install

Installed SqFt was inflated because every secondary shape defaulted to **Install** and
summed in — double-counting sub-regions of the same yard and silently adding cutouts.
The default is now **ignore** (drawn + labeled, but not counted). "Install" means "ADD
as separate turf" and is opt-in. Dropdown relabeled and reordered (Measure only /
Install ADD / Exclude / Putting Green). Six `|| 'install'` defaults → `|| 'ignore'`.
Installed SqFt and the quote now show the primary area on a fresh import; the user opts
specific genuinely-separate pieces into Install.

### 2. Layer names persist on the diagram in every mode

Names + area only drew for Install layers, so changing a layer's dropdown made its label
vanish. Now every visible layer is labeled at its centroid with a mode tag — "(added)",
"(subtracted)", "(green)", or "(not counted)" — in a mode-matched color. The primary is
labeled whenever any other shape is present (previously only when >1 install layer).

### 3. Perimeter sums the same layers as Installed SqFt

Perimeter was primary-only. It now sums the primary plus every Install layer (each is a
separate piece with its own edge), and shows "(N layers)" when more than one. With the
new ignore default, a typical import shows the primary's perimeter.

### 4. Imported shape fills the canvas (less white space)

The canvas fit and the draw scale computed *different* bounding boxes (the draw always
included purchased rectangles), causing letterboxing/white space. Extracted one shared
`layoutFitPoints(layout, showRects)` used by both `sizeLayoutCanvas` and
`drawRollLayoutCanvas`: purchased RECTANGLES are only framed in when "Show purchased roll
rectangles" is on, hidden layers are excluded, and padding tightened (24→16). A fresh
import now hugs the actual shape.

### Tests
- Section 50 updated for the new default (set Install explicitly where layers must sum);
  added: secondaries default to ignore → primary is the only install layer, and
  default-ignored secondaries don't change the primary installed area.

---



Three fixes from real testing. Test suite: **814** (sandbox 771).

### 1. Installed SqFt now sums every Install layer (bug fix)

Installed SqFt showed the **primary shape only**, while Ordered SqFt already summed
all install layers — so the two top numbers disagreed on multi-layer jobs. Root cause:
`getAdjustedShapeArea` only *subtracts* cutouts, it never *adds* install layers.
Installed SqFt is now `combined.area − primary raw area + primary adjusted area` when
multiple install layers exist (= primary minus its exclusions, plus every secondary
'install' layer). Single-layer behavior unchanged. Does not touch pricing.

### 2. Primary layer name drawn on the diagram

Secondary install layers already drew their name + ordered ft² on the canvas; the
**primary** did not. It now does (bold green label at the primary centroid), shown when
there's more than one layer so single-shape jobs stay clean. Renaming any layer updates
the canvas label.

### 3. Layout right pane decluttered / fixed scroll-drag

- The sidebar's `.field-group` spacing was ~40 px of margin/padding/border *each*; cut to
  a compact 10 px, removing the per-field borders (the twisties separate sections now).
- Most twisties now default **closed** (Apply area, Display & overlays, Roll Results
  Advanced); only Roll Direction & Seam and Roll Results basics stay open. Summaries got
  a rotating ▸ caret.
- The **Layers** panel moved out of the right pane into its own **full-width strip below
  the canvas**, with layer cards in a responsive auto-fill grid (renamed "Layers & roll
  grouping"). It's the tallest control and benefits from the width.
- The **canvas column is now sticky** (`position:sticky;top:8px`) so scrolling the
  sidebar no longer drifts the diagram, and the sidebar `max-height` was relaxed.

### Tests
- Section 59: combined installed area = sum of all install layers (basis for the
  Installed SqFt fix).

---



Two changes. Test suite: **813** (sandbox 770).

### 1. Rename any layer

Each layer card in the Layers list (primary included) now has an editable name field
(`setLayerName`, with `escAttr` for safe attribute output). Primary name persists on
`proj.layout.primaryLayerName`, secondary names on `secondaryShapes[i].name`. The name
flows to the canvas labels, the per-layer breakdown, and the Nested Pieces list.

### 2. Per-layer roll grouping (multiple layers ≠ multiple rolls)

When more than one install layer exists, each layer gets a "Rolls" selector:

- **Share rolls with other layers** (default) — the layer's linear footage pools with
  the other shared layers and the roll count is `ceil(pooled linear ft ÷ roll length)`,
  i.e. they're cut from the same physical rolls.
- **Roll on its own** — the layer's rolls are counted independently (for a layer that's
  a different turf product).

Stored on `proj.layout.layerRollGroup[id]` (`getLayerRollGroup`/`setLayerRollGroup`,
default shared). `computeInstallLayerLayouts` tags each layer with its group;
`sumInstallLayouts` pools shared layers' linear ft and adds own layers' rolls
separately. **Grouping only changes the roll count — Ordered SqFt and Linear Ft are
unchanged** (verified: roll count never feeds pricing, only display/labels). The
per-layer breakdown now shows each shared layer's linear-ft contribution and a pooled
roll summary line.

### Tests
- Section 50 updated: default grouping is shared (rolls ≤ layer count); forcing each
  layer to `own` sums rolls independently and never changes Ordered SqFt.
- New section 59: `getLayerRollGroup` default + override; pooling math (30/40/20 ft →
  1 roll shared, 3 own, 2 mixed); grouping leaves Ordered SqFt / Linear Ft / piece count
  untouched; `computeInstallLayerLayouts` tags each layer's group.

---



Seven changes this session. Test suite: **799** (sandbox 756).

### 1. Nesting now lands exactly where you drop it (reverted the 2D auto-fit gate)

The previous entry's `findNestFit` gate had the opposite problem from the one it
fixed: when the exact drop point wasn't clear, it **relocated** the piece to the
nearest clear spot — so the piece jumped away from the cursor. That's the recurring
"the moved piece still doesn't get placed where I drop it" complaint. Root cause: the
tool was acting as an automatic fit-arbiter when what's wanted is a **manual
placement tool** — the installer judges the fit, the tool should honor the placement.

- **Removed `findNestFit` entirely.** Eligibility is back to area-based
  (`pieceArea ≤ rollWaste`) in resolution, the drop handler, and the drag highlight.
- **`assignNestPlacements` rewritten to honor the drop literally:** the piece's
  centroid lands on the drop point, clamped only so the whole piece stays in the
  target's purchased rectangle, and nudged only to avoid stacking on another nested
  piece. It is **never** relocated off turf and **never** refused.
- **Honest visual cue instead of refusal:** new `placedOverlapsTurf(u, x, y, target)`
  samples the placed piece against the target's installed turf. When the dropped
  position overlaps turf, the piece outlines **red** (`#e53935`) instead of orange and
  its label appends "— overlaps turf," so an impossible placement is obvious on the
  diagram rather than hidden — without the tool overriding you.
- Savings stay area-based (the documented "confirm visually" model). Per-layer nesting
  (Phase 3b inc 2) is unchanged.
- Verified honor-the-drop placement against the real 1-project export geometry, not
  just synthetic fixtures.

### 2. Apply Area on an Alt Turf row no longer silently no-ops

Alt Turf options are priced on the **base yard** area (line: `sqFt: baseSqFt`), so an
alt-turf row's own Installed SqFt is never read and its field is readonly. "Apply
Area" was writing that ignored field and popping a false "Applied X ft²." Extracted a
pure, testable **`computeApplyAreaForRow(proj, layout, row)`** that returns the
role-aware area for base (whole yard incl. green) and putting-green (adjusted as-is),
and **blocks alt-turf** with reason `alt-turf-priced-on-base`. The DOM wrapper now
explains this and points to the Base Yard row instead of faking success. (A separate
"alt turf covers a different area than base" feature remains a deliberate non-change.)

### 3. Opt-in: show elevation change from the CSV import

Moasure measures in 3D, so some exports carry a height/Z column. `parseLayoutCsv` now
detects an elevation column (`findElevationColumn` recognizes `Z:ft`, `Elevation`,
`Height`, `Altitude`, with/without units), carries `z` onto each point, and computes an
**elevation summary** (`min`/`max`/`range`/`count`, plus `unit` from the header) per
shape and overall (`elevationSummary`). Import stores it on `proj.layout.elevation`.
A new opt-in checkbox **"Show elevation change (from CSV)"** in the Layout sidebar
(`toggleLayoutElevation` / `renderLayoutElevation`, state on `layout.showElevation`)
shows the range when present and a plain "no elevation data found" note otherwise —
**no fabrication** when the CSV lacks a Z column. Purely informational; does not affect
area, rolls, or pricing.

**Verified against a real Moasure export (`Backyard.csv`):** header is `Z:ft`, parsed
correctly — Base Layer 0.83 ft fall (−0.63 → 0.20), Sub Layer 1 0.43 ft fall (0.78 →
1.21), whole-import span 1.84 ft over 25 points. Because that real file revealed a
raised sub-layer, the readout now **breaks elevation out per layer** (`elevationLayers`
stored at import, `formatElevationLayer`): each surface shows its own fall, since the
combined low→high range spans separate surfaces at different base heights and would
otherwise overstate the grade of any single one. Each non-base layer also reports its
**mean-height offset from the base layer** (`elevationLayerOffsets`, pure/testable;
`elevationSummary` now carries `mean`; the base layer is the one flagged primary, else
the first measured layer) — e.g. on `Backyard.csv`, "Sub Layer 1 sits 1.2 ft above the
base."

### 4. Opt-in: grade overlay (color the shape by height)

A second opt-in box, **"Show grade overlay (color the shape by height),"** paints each
imported shape's outline by measured elevation — blue (low) → green → red (high),
Moasure's palette — with a per-corner elevation label and a low→high color key, drawn
on the layout canvas. New pure/testable helpers `elevationColorRamp(t)` (5-stop ramp,
clamped) and `gradeBoundarySegments(points, zMin, zMax)` (midpoint-colored edge
segments, skipping edges with an unmeasured vertex). The canvas overlay (end of
`drawRollLayoutCanvas`) recovers each drawn vertex's `z` by index from the source
layout points and is fully wrapped in try/catch so a grade draw can never break the
roll plan. State on `layout.showGrade`; `toggleLayoutGrade` / `renderLayoutGradeNote`.

**Honesty note baked into the UI and docs:** a Moasure CSV records only the boundary
points it traced around each shape's edge, not interior surface points (verified on
`Backyard.csv` — every row is a `Dot2Dot`/`LastLeg` perimeter vertex). So the overlay
colors the outline and corners (real data) but draws no interior contour lines — the
in-app contours come from Moasure's full 3D capture, which the export doesn't include.
The note tells the user to walk a path across an interior dip/hump if they need its grade.

### 5. Manual cuts now work on sub-layers (per-layer cut routing)

`startCut` only ever searched the primary layer's strips and inverted clicks in the
primary frame, so clicking a secondary install layer's strip hit nothing — you couldn't
cut sub-layers at all. Extracted a pure, testable **`findCutTarget(layout, dataPt)`**
that searches the primary plus every *visible* install layer and returns the hit strip
**with that layer's own roll frame** (rotation/centroid); `startCut` then inverts the
click in the correct frame and stores the cut under the strip's already-prefixed key
(`L0_…`), which that layer's `computeRollLayout` (already fed `manualCuts`) splits. Net:
cuts land on whichever layer you click, measured in that layer's direction. Hidden
layers aren't cut-targetable. (Same-layer nesting of the resulting pieces already
worked via `getNestableUnitsByLayer`; cross-*layer* nesting remains intentionally
unsupported — each layer rolls on its own plan.)

### 6. Nesting actually reduces rolls; same-roll nesting; 90° rotation

Three connected upgrades so nesting does what it claims (cut a piece, drop it in a
roll's leftover, order less roll):

- **Reduces Linear Ft + roll count, not just Ordered SqFt.** A nested unit's
  `orderedLength` is now subtracted from `totalLinearFt` in `computeRollLayout`, and
  `countRollsAndPieces` skips nested units' length (it still counts them as installed
  pieces). Previously nesting lowered only the area figure while Linear Ft/rolls — what
  you actually buy — stayed put. Verified: on the test L-shape, a nest now drops Linear
  Ft (e.g. 35→30) and can drop the roll count when it crosses a roll boundary.
- **Same-roll nesting.** Eligibility now gates on the piece's INSTALLED (clipped) area
  vs the target's waste, not its full purchased rectangle. The purchased-area gate was
  too strict — it required the piece's whole 15ft rect (incl. its own internal waste) to
  fit, which blocked nesting a cut piece back into its own roll's leftover. Now a cut
  piece can nest into a sibling piece's waste on the same roll. (Savings/length stay
  based on purchased area / ordered length.)
- **90° rotation.** A nested piece can be flipped a quarter turn to run the grain the
  other way and fit a leftover that's longer across the roll than along it. State on
  `layout.nestRot` (per piece key), plumbed via `getRollOpts`/resolution. Placement
  (`assignNestPlacements`) rotates the piece's footprint about its centroid, swaps the
  bbox, re-clamps to the roll, and the overlap check + draw (`nestedDisplayClip`,
  `nestedPieceOffset` via `_nestRfX0/_nestRfY0`) use the rotated geometry consistently.
  UI: a "⟳ 90°" button per row in the Nested Pieces list (`toggleNestRotation`);
  cleared on "Put back."

### 7. Layout sidebar cleanup — key metrics on top, twisties, roll dimensions to Settings

- **Always-visible key metrics** at the top of the Layout sidebar: Installed SqFt,
  Ordered SqFt, Ordered Linear Ft, and **Perimeter (linear ft)** of the shape outline
  (new readout `layoutPerimeterOut`, populated in `renderRollLayout` via the existing
  `polygonPerimeter`). Ordered SqFt and Linear Ft were relocated up from Roll
  Results/Advanced (same element IDs, so population is unchanged — no duplicate IDs).
- **Roll dimensions** (Roll Width, Max Roll Length, S-Seam Side Trim, Cutting Margin)
  moved to a new **Roll Settings** card under the ⚙ Settings tab, and made **global**
  (one set for every project) rather than per-project. Standard rolls are always
  15 ft × 100 ft and trim/margin are shop-wide practice, so per-project storage was a
  footgun (an editable input that could silently desync a quote). New global store
  `wt_rollDefaults` via `getRollDefaults`/`saveRollDefaults`/`loadRollDefaultsToInputs`;
  the four inputs now call `onRollSettingChange` (persist global + re-render). The
  per-project load (`renderLayoutTab`) and writes (`renderRollLayout`) were removed; the
  computed layout still carries its own rollWidth/rollLength from opts, so downstream is
  unchanged. (Roll Direction & Seam stay on Layout — they're per-job, watched live.)
  The Roll Length field is labeled "one full roll" with helper text clarifying it's the
  physical roll length (the seam-split threshold), *not* what you order — what you order
  per job is Ordered Linear Ft (varies by job, always 15 ft wide). Width field notes the
  fixed 15 ft product width.
- **Every sidebar section is now a collapsible twistie**, reordered so Roll Direction &
  Seam sits right under the key metrics, then Apply area, Display & overlays
  (elevation + grade + view rotation), Layers, fringe, and detailed Roll Results.
- Verified: no duplicate element IDs, `<details>` tags balanced (7/7), layout panel
  `<div>` balance intact (62/62).

### Tests
- Reverted all `findNestFit`/`narrowtab@30` nesting tests back to area-based `lShape`
  fixtures (sections 5, 20, 22, 45 put-back, 48, nestPos anchor, 55 prefixed).
- Section 49 rewritten for honor-the-drop placement: centered-on-drop, edge-clamp,
  nudge-apart, triangle-centroid, **turf-overlap flag** (on-turf → flagged, clear →
  not), and a real-geometry integration placement.
- New `computeApplyAreaForRow` unit cases (base / putting-green / alt-turf blocked /
  no-area) and updated the end-to-end Apply test (alt-turf row now unchanged).
- New `parseLayoutCsv` elevation cases (Z column → summary, no Z → null, alternate
  headers via `findElevationColumn`, and a multi-layer case proving each layer keeps
  its own fall while the overall range spans both), plus `elevationLayerOffsets` cases
  (above/below the base, primary-vs-first reference, and a no-height layer).
- New `elevationColorRamp` cases (blue/green/red dominance, clamping) and
  `gradeBoundarySegments` cases (midpoint elevation per segment, distinct low/high
  colors, edges skipped at an unmeasured vertex).
- New section 56: `findCutTarget` routing — clicks resolve to primary vs sub-layer
  strips with the correct per-layer frame, hidden layers excluded, already-cut strips
  resolve to the right strip, empty space returns null.
- New section 57: nesting reduces Linear Ft by the nested unit's orderedLength;
  `countRollsAndPieces` drops a re-used piece's length (roll count falls across a
  boundary) while still counting it as a piece; whole nested strip adds no length;
  same-roll nesting via the installed-area gate.
- New section 49 case: 90° rotation swaps the placed bbox (40×5 → 5×40), records the
  flag, and keeps the centroid on the drop.
- Geometry section: `polygonPerimeter` cases (square = 40, 3-4-5 triangle = 12) for the
  new Layout perimeter metric.
- New section 58: global roll defaults — empty store returns 15×100 / 4 / 4; a stored
  partial override (e.g. cutting margin) is read back while missing keys keep 15×100.

---

## 2026-06-21 (cont'd, 31) — Nesting eligibility is now a genuine 2D fit (no more phantom savings / turf-jamming)

Replaces the old **area-only** nesting test (`pieceArea ≤ rollWaste`) with a real
2D fit. The area test over-reported badly on irregular yards: a roll's "waste area"
is mostly unused roll **width** and shape gaps, not contiguous room a piece can be
cut from. So a piece could pass the area check, get counted as savings, and then be
drawn **jammed on top of the installed turf** in a corner — the bug seen on a real
multi-layer job (a small primary strip needing ~5 ft of length "nested" into a roll
with ~1.25 ft of leftover length).

New helper **`findNestFit(src, target, preferredRf, obstacles)`** searches for a
placement where the piece's **actual shape** sits inside the target's purchased
rectangle, clear of the target's turf and of any piece already nested there. It
honors the user's drop point (piece centroid lands on the drop when that spot is
clear, otherwise the nearest clear spot), and returns `null` when nothing fits. The
fit is genuinely two-dimensional, so it correctly **allows** a narrow piece tucked
into a roll's width-waste **and** **rejects** a full-width piece dropped where there's
no clear room. Footprint overlap is tested by sampling the piece's shape (fast enough
to run per-frame at drag start), so very thin slivers should still be confirmed
visually — noted in the in-app docs.

The same function now gates all four nesting touch-points, so eligibility, savings,
placement and the drag highlight can never disagree:

1. **Resolution** (`computeRollLayout`) — the Ordered-SqFt reducer. A nest only
   applies (and only lowers Ordered SqFt) when `findNestFit` succeeds; the fit is
   stashed on the unit (`_nestFit`) and the placed polygon is accumulated per target
   so a second piece nested into the same roll avoids the first.
2. **Placement** (`assignNestPlacements`) — rewritten to position each piece via the
   fit (reusing the resolution fit for a single piece, recomputing with obstacles
   when stacking) instead of the old centroid-clamp-and-nudge math.
3. **Drop** (`endDragNesting`) — accepts the drop only on a real 2D fit; if you drop
   on a roll whose leftover can't hold the piece, it's refused and a toast explains
   why instead of snapping back silently.
4. **Highlight** — the green valid-target borders now come from a fit set computed
   once at drag start (`window._wtDragValidTargets`), so the per-frame draw stays cheap.

Docs + tests:
- In-app Help: the "area-based only / does not verify geometric fit" caveat and the
  drag-to-nest walkthrough were rewritten to describe the 2D fit and the refusal.
- Test suite: corrected the old fixtures that asserted **phantom** nests (L-shapes
  whose strips have ~1 ft leftover — they never physically fit). Added a `narrowtab`
  shape rolled at 30° that produces a genuinely fitting nest for the
  "nesting lowers Ordered SqFt" integration paths, plus a full set of `findNestFit`
  unit cases (width-fit, length-fit, too-tall, too-big, honor-the-drop, obstacle) and
  an "area-fits-but-2D-impossible → refused, no phantom savings" case. Suite green at
  **742** (699 in the headless sandbox).

Needs visual confirmation in-app (canvas draw isn't unit-testable): that a piece
which can't fit now refuses with a toast, that a legitimate nest still lands where you
drop it, and that secondary-layer nesting is unaffected.

---

## 2026-06-20 (cont'd, 30) — Per-layer nesting works end-to-end (Phase 3b inc 2)

Fixes the off-target nesting drop on multi-install-layer jobs: a piece dragged
within a **secondary** install layer now nests into another roll's waste **in that
same layer**, lands where you drop it, and reduces that layer's Ordered SqFt. Before
this, the drag machinery only saw the primary layer's pieces, and any drop point was
converted in the **primary's** roll frame — so secondary-layer pieces either couldn't
be picked up or landed in the wrong place. The data layer was already correct (Phase
3b inc 1 key-prefixing); this session wired the canvas glue, all routed through the
new `getNestableUnitsByLayer` so the shared `getNestableUnits` (and the Piece List cut
sheet it feeds) is untouched.

Seven coordinated changes, primary draw path left byte-identical:
- **Pickup** (`startDragNesting`) enumerates units across all install layers,
  secondary-first to match the on-canvas z-order.
- **Drop** (`endDragNesting`) resolves the dragged piece's layer, restricts valid
  targets to that **same** layer, and converts the drop point with that layer's
  transform via `displayPointToRollFrame` (identical math to the old inline code for
  the primary). Keys written are already layer-prefixed.
- **Placement** (`assignNestPlacements`) now spans all install layers, so a nested
  secondary piece gets a non-overlapping `_nestX/_nestY`.
- **Relocation draw** — `allUnitsByKey` and a new per-unit rotation map span all
  layers; `nestedPieceOffset` uses the piece's **own** layer rotation; and the
  secondary install-layer draw loop now iterates units and redraws a nested piece
  relocated into its target's waste (orange), stashing `_displayClippedMoved`.
- **Drag feedback** — the green valid-target highlight + drag ghost now follow the
  dragged piece's own layer (no longer gated on the primary being visible).
- **Undo** — the Nested Pieces "↩ Put back" list includes secondary-layer nests,
  tagged with the layer name; `unnestPiece` already works by (prefixed) key.

Nesting is **same-layer only** by design — each layer resolves its own prefixed
nesting keys, so a cross-layer target is silently inert (never misapplied). A test
locks this in.

### Needs your eyes (canvas draw isn't unit-testable here)
Open the app on a multi-install-layer job and confirm: a secondary piece drags and
drops onto a same-layer roll's waste; it draws where you dropped it (orange); the
green highlight only lights same-layer targets; "↩ Put back" reverts it. The primary
layer's nesting should behave exactly as before.

### Tests
- Section 55 extended (+6, 22 total): prefixed nesting reduces a secondary layer's
  totalOrdered; the nested unit records its same-layer prefixed target; a cross-layer
  (unprefixed) target does **not** resolve; `assignNestPlacements` places a secondary
  nested piece within its target's rectangle.
- Updated one section-49 fixture (drag-nest pickup now enumerates by layer, so the
  test unit lives on a strip).
- Suite: **735** (sandbox 692), up from 729.

### Still pending
- Per-layer **cut-click** routing (manual cuts are still primary-only), then label the
  Manual Cuts / Nested Pieces lists by layer.
- Open decision: should the Piece List cut sheet include secondary-layer pieces
  (currently primary-only)? Still unanswered — affects a real installer artifact.
- Per-piece "Roll N / Piece M" labels for nested **secondary** pieces on the canvas
  (they relocate and draw orange, but the on-canvas text label is primary-only for now).
- Primary **shape** rotation (render + hit-testing together).



Groundwork for fixing the nesting drop-placement bug (a piece dropped over a
**secondary** install layer's waste lands off-target, because the drop handler
converts the drop point in the **primary's** roll frame). This session lands only
the safe, fully-tested core; it does **not** yet change any drop/draw behavior.

Added two functions:
- **`getNestableUnitsByLayer(layout)`** — returns one group per install layer
  (primary + each secondary `install` layer), each carrying that layer's own
  `rotationDeg` / `cx` / `cy` and its units. The shared `getNestableUnits` and its
  other consumers (drag-ghost highlight, Piece List cut sheet, Nested Pieces list)
  are **left untouched on purpose**, so no user-facing list silently changes as a
  side effect of the nesting work.
- **`displayPointToRollFrame(dataPt, layerGroup)`** — converts a display point into
  a given layer's roll frame. For the primary group it reproduces the legacy inline
  conversion exactly (behavior-preserving); for a secondary layer it uses that
  layer's transform — the seam the drop handler needs to stop landing pieces in the
  wrong place.

The data layer was already ready for this (Phase 3b inc 1 key-prefixing means each
install layer's `computeRollLayout` resolves its own `nesting`/`nestPos`). What
remains for the bug to actually disappear — and is **not** in this session — is the
canvas glue, which must land together (data-correct-but-drawn-wrong is worse than
unstarted): the drop handler writing the prefixed key with the per-layer frame;
`assignNestPlacements` spanning all layers; `nestedPieceOffset` using the per-layer
rotation + a per-layer unit lookup; and the install-layers draw loop relocating
nested pieces. Those are partly un-unit-testable (pure canvas draw), so they want
the app open for visual confirmation.

### Tests
- New **section 55** (16 tests): group-per-layer enumeration, primary group matches
  `getNestableUnits` exactly, per-layer transforms carried correctly, primary-frame
  equivalence to the legacy conversion, secondary layer converting the same drop
  point to a *different* frame (the bug's root cause), round-trip inverse, and the
  no-install-layers degenerate case.
- Suite: **729** (sandbox 686), up from 713.

### Still pending (canvas-heavy — needs the app open)
- Wire the four drop/draw edits above so secondary-layer nesting works end-to-end.
- Open decision: should the Piece List cut sheet include secondary-layer pieces
  (currently primary-only)? Affects a real installer artifact — confirm before flipping.
- Per-layer cut-click routing, then label the Manual Cuts / Nested Pieces lists by layer.
- Primary **shape** rotation (render + hit-testing together).



For parity with secondary layers, the primary shape's row in the Layers list now
has **Roll dir** and **Seam off** controls (previously only on the global sliders at
the top of the roll panel). They write the same model fields (`proj.layout.rotation`
/ `.translation`) and sync the top sliders, and use the same drag-safe pattern (live
input updates the canvas only; the list rebuilds on drag end).

`setPrimaryRollDirection` / `setPrimarySeamOffset` added.

### Still pending (canvas-heavy — needs a dedicated session)
- Rotating the **primary shape's orientation** (only sub-layers can spin today;
  the primary supports move + edit but not rotation — needs a rotation offset in
  `renderRollLayout` plus matching hit-testing).
- **Nesting drop-placement bug**, now diagnosed: `getNestableUnits` only walks the
  primary layer's strips, and the drop handler converts the drop point with the
  *primary's* rotation/centroid — so secondary install layers (which roll at their
  own angle per Phase 3a) aren't valid/correct nest targets. This is Phase 3b
  increment 2 (per-layer transform routing).

### Tests
- Section 54: `setPrimaryRollDirection` / `setPrimarySeamOffset` write the model,
  wrap mod 180, and are drag-safe.
- **Total: 713 tests, all passing** (707 prior + 6 new).

---

## 2026-06-17 (cont'd, 27) — Fix: per-layer Roll dir / Seam off sliders now drag

The per-layer **Roll dir** and **Seam off** sliders in the Layers list could only
be clicked, not dragged. Cause: their `oninput` handlers called
`setLayerRollDirection` / `setLayerSeamOffset`, which rebuilt the entire Layers
list on every input event — destroying the slider being dragged after the first
tick. (The Rotate slider was unaffected because `setLayerRotation` never rebuilt
the list.)

Fix: the live `oninput` path now updates the model + canvas only (drag-safe); the
list rebuild — which refreshes the "matches primary / Match primary" indicator — is
deferred to `onchange` (drag end), running once.

### Tests
- Section 54: `setLayerRollDirection` / `setLayerSeamOffset` update the model on
  the live path without rebuilding the list, and rebuild exactly once on drag end.
- **Total: 707 tests, all passing** (701 prior + 6 new).

---

## 2026-06-17 (cont'd, 26) — Refactor: single source of truth for effective roll width

No behavior change. The usable-roll-width-after-trim formula
(`Math.max(0.01, rollWidth − sideTrim)`) was copy-pasted at five sites. Extracted
to `effectiveRollWidth(opts)` and routed all five through it, so the trim rule
lives in one place and can't drift.

### Tests
- Section 54: `effectiveRollWidth` — normal, 6in trim, missing-opts defaults, and
  the 0.01 floor when trim exceeds width.
- **Total: 701 tests, all passing** (697 prior + 4 new). Full suite re-run confirms
  the roll-layout math is unchanged.

---

## 2026-06-17 (cont'd, 25) — Phase 3b (increment 1): per-layer cut/nest key namespacing

Foundation for per-layer manual cuts and nesting, plus a fix for a latent
cross-layer bleed.

**The bug:** manual cuts and nesting are stored in `proj.layout.manualCuts` /
`.nesting` / `.nestPos`, all keyed by **strip key** (`'y'+y0`), which is local to a
layer's roll frame — not unique across layers. `computeInstallLayerLayouts` passed
the same global maps to every install layer, so a cut on the primary's strip at a
given y-position would bleed onto any secondary install layer with a strip at the
same position. Latent only because there's no per-layer cut UI yet.

**The fix:** `computeRollLayout` now takes `opts.keyPrefix`. The primary uses `''`
(existing cuts/nesting keyed by bare `'y<pos>'` keep working — no migration); each
secondary install layer gets `'L<id>_'`. Piece keys (`key+'_pN'`) and nesting keys
derive from the strip key, so they inherit the prefix automatically. Single-layer
jobs are completely unchanged.

**Not in this increment (next sessions):** (2) canvas hit-testing for cut clicks
and nest drags must resolve which install layer's strip/piece is under the cursor
and address it by its prefixed key — the fragile drag-machinery work, and where the
paused drop-placement bug lives; (3) per-layer labels in the cut/nest UI lists.

### Tests
- Section 54: prefix namespacing, piece keys inherit the prefix, back-compat for
  un-prefixed primary cuts, both bleed directions blocked, and
  `computeInstallLayerLayouts` assigning distinct prefixes per layer.
- **Total: 697 tests, all passing** (687 prior + 10 new).

---

## 2026-06-17 (cont'd, 24) — Alt Turf option no longer gated on a field it ignores

An Alt Turf option is priced on the **base yard** area (`sqFt: baseSqFt`), so the
alt row's own Installed SqFt was ignored for labor — yet it silently gated whether
the option appeared at all (`allRows` filters `installedSqFt > 0`). Blank alt sqft
→ the whole option vanished from the quote with no warning; a wrong value had no
pricing effect.

### Fix
Alt rows are now pulled from the full turf list and shown whenever they have a
**product** (or, for legacy rows, an installed area) — not gated on their own
Installed SqFt. Labor still prices on the base area; material still comes from the
alt row's own Sqft to Order. The alt row's Installed SqFt field is now a read-only
"= base yard" hint in both the Quote Builder and the New Project modal (with a
tooltip), the role dropdown re-renders the row live, and CSV prefill skips the
hint field.

### Tests
- D2: alt with blank installed sqft still appears and prices labor on the base area
  (1,500) with its own material ($3.00) → COGS 16,500.
- D3: an alt row with no product and no area produces no card.
- N2 updated: the zero-sqft filter still holds for base/PG rows (alt is gated on
  product by design).
- **Total: 687 tests, all passing** (681 prior + 6 new).

### Note
This assumes an Alt Turf option always covers the same area as the base yard. If an
alt ever needs a different area, that's a separate change (alt would need its own
labor area).

---

## 2026-06-17 (cont'd, 23) — "Apply Area" is role-aware (base/alt include the green)

Closes a latent inverse of the PG-material question. The Layout tab subtracts a
putting-green layer from the primary's Installed Area (like an Exclude hole), and
"Apply Area" used that subtracted total for every row. So applying a PG-marked
layout's area to the **base** turf row produced a green-*excluded* base sqft, which
then fed `stdSqFt = base − pg` and subtracted the green twice — silently
under-counting both standard labor and base material by the full green area.

### Fix
New `getPuttingGreenShapeArea(proj)`. `applyLayoutAreaToTurf` is now role-aware:
for a **Base Yard** or **Alt Turf** target it adds the putting-green area back
(base/alt cover the whole yard including the green spot, which is laid as its own
row), while true **Exclude** holes stay subtracted. A **Putting Green** target is
unchanged. The roll-plan scrap number and fringe outline are untouched — only the
value pushed into a base/alt row changes.

### Tests
- `getPuttingGreenShapeArea` sums only PG shapes; the apply-area math identity
  (adjusted + PG = primary − true holes); and an end-to-end `applyLayoutAreaToTurf`
  run asserting base/alt rows get the whole yard (1450 = 1500 − 50 hole) while a
  PG row does not (1300).
- **Total: 681 tests, all passing** (674 prior + 7 new).

### Note
This only affects the value "Apply Area" writes. If you type base Installed SqFt
manually from the Moasure whole-yard total, behavior is unchanged.

---

## 2026-06-17 (cont'd, 22) — End-to-end quote regression suite

Adds section 53: a reusable harness (`qEnv`) that renders real quote cards through
`loadProject` → `calcQuote` and asserts the dollar figures, line items, and card
structure. This is the safety net for the money path, where most of this session's
bugs lived. No application code changed — tests only.

### Coverage (54 new assertions)
Positive scenarios: A base-only, B base + putting green (No-PG and With-PG cards),
C putting-green-only (no empty No-PG card, no standard line), D alt turf + PG
(separate base/alt groups, alt material rate), E tiered standard **and** tiered
putting resolving on each type's own area, F misc items broken out per line and
split by role, G margin (cost / margin$ / price, and margin$ = price − cost).

Boundary tests: E2 tier cap is inclusive (1000 → $9, 1001 → $8), H putting-green
turf material rounds the order to a whole roll (100 → 105 × $3.50 = $367.50),
I margin clamps at 99%.

Negative tests: N1 empty project (no crash, no NaN, $0 card), N2 zero-sqft rows
filtered out, N3 garbage labor rate → $0 labor with no NaN, N4 $0-priced misc item
renders no line, N5 putting-green infill with no PG turf row is not billed and
produces no PG card, N6 negative margin treated as no margin.

### Tests
- **Total: 674 tests, all passing** (620 prior + 54 new).

---

## 2026-06-17 (cont'd, 21) — PG infill auto-tier, misc items broken out, "install" wording

### "Refresh from SqFt" now works for putting green infill
Root cause: a putting-green infill product added with the default Standard tier
pulls the base yard area (zero on a putting-green-only job), so refresh looked
broken. New `inferInfillTier(productName)` auto-classifies products whose name
contains "Putt" (e.g. GD Putting Sand) to the Putting Green tier when added (new
rows and at project creation), so Refresh fills them from the putting green area.
The row's Tier is still editable and remains the source of truth.

### Misc items broken out per line
Quote cards previously lumped all miscellaneous items into one "Misc items" line.
Each misc item now renders as its own line (name, qty × price → cost), split by
role (putting-green misc only on cards that include a green). COGS unchanged.

### "Install" wording on labor lines
Labor breakdown lines now read "Standard yard install", "Putting green install",
and "Turf install" (was "Standard yard" / "Putting green" / "Labor").

### Tests
- Section 46: `inferInfillTier` — putting-sand → putting-green, other sands →
  standard, blank/undefined → standard.
- **Total: 620 tests, all passing** (615 prior + 5 new).

### Note
The auto-tier applies to newly added infill rows; existing rows keep their stored
tier. A putting-green infill row already on the wrong tier can be fixed via its
Tier dropdown (which now re-derives sqft on change).

---

## 2026-06-17 (cont'd, 20) — Putting green quote cards: turf material, label, no empty standard line

Fixes three issues on putting-green quote cards (seen on a PG-only job):

- **Putting green turf material was never counted.** Turf material cost came only
  from the base/alt rows; the green's own turf product was ignored. Cards now include
  `pgTurfMatCost` (the PG row's roll-rounded ordered sqft × its $/sqft) in COGS and
  show it as a **Putting green turf** line.
- **Empty "Standard yard … × 0 sqft" line** no longer renders when there's no
  standard area (stdSqFt = 0).
- **Card now reads as a putting green** — title shows "Putting Green — <product>
  (<n> sqft)" instead of "With <product>", and a putting-green-only job's group
  header is "Putting Green" instead of "Base Quote".

### Tests
- Section 37c (end-to-end fringe/quote) updated: asserts the **Putting green turf**
  line is present and that COGS now includes the green's roll-rounded turf material
  (ceil(200/15)*15 × $3.50 = $735).
- **Total: 615 tests, all passing** (614 prior + 1 new assertion).

---

## 2026-06-17 (cont'd, 19) — Quote cards: roomier layout, margin $ line, no empty PG-only card

### Margin dollar amount
Each quote card with a profit margin now shows three figures — **Cost (COGS)**,
**Margin** in dollars (Price − Cost), and **Price** — instead of just cost and price.

### No empty "No Putting Green" card on putting-green-only jobs
`shouldIncludeNoPgCombo(baseSqFt, pgRowCount)` gates the "No Putting Green" combo:
shown only when there's standard yard area to install without the green (or when
there are no PG rows at all). A putting-green-only job no longer renders an empty
No-PG card.

### Less squished cards
Card grid switched from `auto-fill / minmax(260px)` to `auto-fit / minmax(300px)`
with a larger gap and `align-items:start`, and the price row can wrap — so cards get
more room and don't cramp when several options show.

### Tests
- Section 46: `shouldIncludeNoPgCombo` truth table; margin-dollars = `applyMargin`
  price − cost (incl. 0% margin).
- **Total: 614 tests, all passing** (607 prior + 7 new).

---

## 2026-06-17 (cont'd, 18) — Fix: putting green infill not affecting quote pricing

### Bug
Setting an infill row's Tier to **Putting Green** didn't re-derive that row's sqft.
The tier `onchange` only stored the new tier + recalced the quote; it never refilled
sqft from the putting-green area or recomputed bags. A row switched to Putting Green
kept its old/empty sqft → 0 bags → $0, so the putting green infill never showed up in
quote pricing.

### Fix
- New `infillAreaForTier(proj, tier)` helper (putting-green tier → PG area; else base
  yard area), used by both `autoPopulateInfill` and the tier change.
- `updateInfillField` now, on a tier change, re-derives the row's sqft from the right
  area, recomputes bags/line cost, and re-renders the row.
- Quote cards now show **Putting green infill** as its own breakdown line (separate
  from yard infill) so its contribution is visible. (Totals unchanged — it was always
  meant to be in COGS; it just wasn't being computed.)

### Tests
- Section 46: `infillAreaForTier` — PG tier → putting green sqft, standard/upgraded →
  base yard sqft (alt-turf excluded), no PG row → 0.
- **Total: 607 tests, all passing** (603 prior + 4 new).

---

## 2026-06-17 (cont'd, 17) — Fix: editing/renaming a labor line wiped its tiered pricing

### Bug
`saveRateItem` rebuilt the labor item from only `{id, name, desc, unit, rate, key}`,
so any field the edit form doesn't show — notably **`tiers`** — was dropped. Renaming
a tiered line (or editing its notes/unit) silently erased its whole tier table.

### Fix
New `buildEditedLaborItem(existing, fields)` spreads the existing item first, then
overwrites only the edited fields — preserving `tiers`, `key`, and anything else.
New items (no existing) still start clean. `saveRateItem` now uses it.

### Tests
- Section 46: rename preserves `tiers` (still tiered after) + `key` + `id`; a new
  item starts clean with a parsed rate and no leaked tiers.
- **Total: 603 tests, all passing** (597 prior + 6 new).

---

## 2026-06-17 (cont'd, 16) — Tier editor: clearer range entry, pre-filled tiers

Fixes the confusion where adding a tier showed a "From 0" that couldn't be edited
and new tiers appeared blank/0. The lower bound was always an auto-derived value
(by design, so tiers can't overlap) — it just looked like a stuck, broken field.

### Changes (UI only — no change to resolution math or stored data)
- **New tiers pre-fill** their upper limit (highest existing limit + 500, or 500
  for the first) instead of rendering blank, so every tier shows a real, editable
  number. `tierAddBracket` / the first-bracket default updated.
- **Lower bound is now a clearly static grey chip** (bordered pill, tooltip "fills
  in automatically… not editable") instead of looking like an input, so it's
  obvious you type the *upper* limit and the bottom fills itself in.
- Each row is labeled **Tier 1, Tier 2, …** with a one-line instruction above the
  rows: type the upper sqft limit + price; enter 500, 1,000, 1,500 → 0–500,
  501–1,000, 1,001–1,500; the bottom box covers anything larger.
- Standard vs putting green is unchanged and already correct: a turf row's **Role**
  (Base Yard / Alt Turf Option / Putting Green) decides it — Putting-Green-role
  sqft bills at the Putting Green Install rate/tiers, everything else at Standard.
  The tier modal now states plainly which role/area its brackets apply to (tiers
  are role-bound by which labor line they live on, not by a per-bracket role field).

### Tests
- No new pure functions; resolution + range logic unchanged and still covered by
  section 46. **Total remains 597, all passing.**

---

## 2026-06-17 (cont'd, 15) — Tiered pricing: non-overlapping whole-sqft ranges

### Brackets now read as clean integer ranges
Tier brackets are displayed as non-overlapping whole-sqft ranges: the lower bound is
the previous cap **+ 1**, so caps of 500 / 1,000 / 1,500 show as **0–500, 501–1,000,
1,001–1,500, 1,501+** instead of the previous overlapping 0–500 / 500–1,000 / … This
matches how brackets actually resolve (`s <= cap`, so 500 → the 0–500 bracket, 501 →
the next). Applied in both the tier editor's live "From" labels and the Labor Rates
table's range list (`getTierRanges`). The "above" box now reads "(maxCap + 1)+ sqft".

No change to resolution math or stored data — only how ranges are labeled.

### Putting greens (already supported, now clearer)
Putting Green Install has always been independently tierable (its own "Tiers…"
button) and the putting rate already bills only turf rows whose role is Putting
Green, at the bracket its putting-green area falls into. Guide text now spells this
out alongside the standard tiers.

### Tests
- Section 46 `getTierRanges` cases updated to the integer lower bounds (1001, 2001…),
  plus boundary assertions: exact cap → lower bracket, cap + 1 → next bracket.
- **Total: 597 tests, all passing** (595 prior + 2 new).

---

## 2026-06-17 (cont'd, 14) — Phase 3a: per-layer roll direction & seam offset

Multi-layer install layers can now each roll in their **own direction** instead of
sharing one global roll direction — so a yard measured as several sections can roll
each section the way that minimizes its own waste.

### What's new
- Each install layer in the Layers list has its own **Roll direction** slider +
  **Horizontal / Vertical / Auto** buttons and a **Seam offset** slider. "Auto"
  sweeps direction × seam offset on that layer's own footprint and picks the
  lowest-ordered combination (same search the global Auto-minimize uses).
- Until changed, a layer **"matches primary"** (uses the main roll-direction
  sliders); **"↺ Match primary"** clears a per-layer override. Stored in
  `proj.layout.layerRoll[layerId] = {rotation, translation}`; unset fields fall
  back to the primary's values (back-compatible — existing projects are unchanged).
- The per-layer breakdown under Roll Results now shows each layer's roll direction
  (`*` = matches primary).
- The primary layer continues to use the main sliders.

### Implementation
- New `getLayerRoll(proj, layerId, fallbackRot, fallbackTrans)` →
  `{rotation, translation, overridden}`.
- `computeInstallLayerLayouts` now rolls each install secondary at its own
  resolved direction/offset (primary uses the passed/global values), and tags each
  entry with `rollRotation` / `rollTranslation` / `rollOverridden`.
- New setters `setLayerRollDirection`, `setLayerSeamOffset`, `clearLayerRollOverride`,
  and per-layer `autoRotateLayer`.

### Tests
- Section 52 added: `getLayerRoll` fallback / partial + full override / overridden
  flag; `computeInstallLayerLayouts` honoring an override (rolled at the override
  angle) vs falling back, primary unaffected, non-install layers excluded.
- **Total: 595 tests, all passing** (580 prior + 15 new).

### Still open
- Phase 3b: per-layer cuts/nesting (still keyed to the primary roll plan).
- Nesting drop placement (paused).

---

## 2026-06-17 (cont'd, 13) — User Guide TOC, sticky layout toolbar, Basic/Advanced sidebar, tiered-pricing ranges

### User Guide: table of contents
A clickable contents list at the top of the User Guide jumps to any of the nine
sections. Because the guide is its own scroll container, anchor links alone don't
work — a `jumpToDocSection()` helper smooth-scrolls the modal to the section. Each
`docs-h2` now has an anchor id.

### Layout: sticky toolbar
The Edit Shape / Move Layers / Cut Mode / Import row (`#layoutToolbar`) is now
`position:sticky` and stays pinned to the top of the scroll area while you scroll
through the canvas and results. (Does not stick on narrow/mobile widths, where the
card uses `overflow-x:auto`, which disables sticky.)

### Layout: Basic / Advanced sidebar split
Roll Results is split to reduce clutter. **Basic** (always shown): rolls/pieces,
Ordered SqFt, and Apply. **Advanced** (collapsible `#rollAdvancedDetails`, closed by
default): purchased-rectangles toggle, Usable SqFt, Linear Ft, Scrap, the nesting
legend, manual-cuts list, nested-pieces list, and per-piece list. Entering Cut Mode
auto-opens Advanced so the cut/nest tools are visible. All field ids unchanged.

### Tiered labor pricing: explicit ranges + per-line installed area
- The tier editor and the Labor Rates table now show each bracket as an explicit
  **sqft range** ("From N to M sqft → $rate"); the lower bound auto-fills from the
  previous bracket's limit. New `getTierRanges(item)` derives `[{from,to,rate}]`
  (`to:null` = open-ended); the editor's "From" labels update live as caps change.
- Bracket selection is **per install type by its own installed area**: the standard
  rate tiers off the standard turf area (total − putting green), the putting green
  rate off the putting green area. (This reverts the brief "whole-job total"
  experiment from cont'd 12 per updated requirements — note it changes quote numbers
  on tiered jobs vs that interim version.)

### Tests
- Section 46 extended with `getTierRanges` coverage (range derivation, lower-bound =
  previous cap, open-ended bracket, unsorted input, alignment with `resolveTierRate`,
  flat-item empty case).
- **Total: 580 tests, all passing** (572 prior + 8 new).

### Still open
- Multi-layer Phase 3: per-layer roll direction/translation and per-layer cuts/nesting.
- Nesting drop placement (paused); doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 12) — Move Layers no longer jitters; Edit Shape works on any layer

### Fix: moving one layer made the others jump around
In Move Layers mode, each drag step called `renderRollLayout`, which recomputed the auto-fit
canvas transform from the new geometry — so moving one shape rescaled/recentred the whole view
and every other shape appeared to slide, and the drag delta (measured across the shifting
transform) compounded. The canvas transform is now **frozen during a layer drag** (and during a
vertex drag): `drawRollLayoutCanvas` honours a `_wtFreezeTransform` flag and reuses the stored
transform instead of re-fitting; the view re-fits once on drag end.

### New: edit any layer's shape, not just the primary
Edit Shape was hard-wired to the primary outline. It now hit-tests vertices/edges across **all
visible layers** and edits whichever one you grab:
- New `displayPointToLayerCanonical` inverts a layer's full forward transform (view-rotation →
  per-layer rotation about its centroid → position offset), so a dragged secondary vertex writes
  back to that shape's stored points correctly. A test confirms the inverse is exact.
- `findNearestVertexAnyLayer` / `findNearestEdgeAnyLayer` pick the nearest handle/edge across
  layers; `getLayerCanonicalPoints` / `recomputeLayerArea` read/write the right layer.
- Vertex handles are drawn on every visible layer (primary green, others blue).
- Undo history now records `{layerId, points}` per edit and restores the correct layer (old
  array-format entries still load).

### Tests
- Section 51 added: per-layer canonical inverse round-trip (view-rotation + rotation + offset),
  cross-layer nearest-vertex pick, and per-layer history/area. Section 6 history test updated for
  the new entry format.
- **Total: 572 tests, all passing** (567 prior + 5 new).

### Still open
- Multi-layer Phase 3: per-layer roll direction/translation and per-layer cuts/nesting.
- Nesting drop placement (paused at user's request); tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 11) — Multi-layer install Phase 2: each layer's roll plan drawn on the canvas

### Per-layer roll plans now render in place
Building on Phase 1 (math + summed totals), each install layer's roll plan is now drawn on the
canvas at its positioned/rotated location — the installed strips filled in the layer's colour,
plus the purchased rectangles with waste hatch when "Show purchased roll rectangles" is on, and
a label showing the layer name + its Ordered SqFt. The canvas bounding box was extended to
include every install layer's roll rects so nothing is clipped. The primary's rendering
(cuts, nesting, labels, drag) is untouched.

### Implementation
- `drawRollLayoutCanvas`: the secondary-shape `install` branch now looks up that layer's layout
  in `layout._installLayers` and draws its strips (`displayClipped` fill + optional `displayRect`
  hatch) via the shared canvas transform, with a centroid label. Empty bands (no turf) are
  skipped. Falls back to a plain outline if a layer has no computed strips.
- `allPts` (frame extents) now includes each install layer's strip rects.

### Tests
- Section 50 extended: install layers expose drawable strip geometry (`displayClipped`) and that
  geometry reflects the layer's moved position. (Canvas pixels themselves aren't unit-tested;
  these assert the data the renderer consumes.)
- **Total: 567 tests, all passing** (565 prior + 2 new).

### Still open
- Multi-layer Phase 3: per-layer roll direction/translation and per-layer cuts/nesting.
- Nesting drop placement (paused at user's request); tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 10) — Multi-layer install: each layer its own rolls, summed (Phase 1)

### New "Install" layer mode (now the default)
Multi-layer Moasure files often capture a yard as several separate pieces, not one outline
with cutouts. Layers now default to a new **Install — its own turf + rolls** mode: every
install layer (the primary plus each sub-layer left on Install) is rolled independently with
the shared roll settings, and the Roll Results show the **combined** Ordered SqFt / Usable /
Linear Ft / Rolls / Waste, with a per-layer breakdown beneath. "Apply" sends the combined
Ordered SqFt to the chosen turf row. Exclude / Ignore / Putting Green still work as before;
set a layer to one of those to drop it out of the install sum.

This is **Phase 1** (math + totals + apply). Per the plan: Phase 2 = draw each layer's roll
strips on the canvas at its position; Phase 3 = per-layer roll direction/translation and
per-layer cuts/nesting. Positioning today uses the existing "✋ Move Layers" drag and the
per-sub-layer Rotate slider; roll settings are shared across layers for now.

### Implementation
- `computeInstallLayerLayouts(proj, primaryLayout, secondaryShapes, rotation, translation, opts)`
  rolls the primary + every `install` secondary (on its positioned `displayPoints`).
- `sumInstallLayouts(list)` adds up ordered/usable/linear/area/rolls/pieces; combined
  scrap = total ordered − total installed area.
- `renderRollLayout` overrides the output fields with the combined totals and renders a
  per-layer breakdown when more than one install layer exists; `applyRollLayoutToTurf` applies
  the combined Ordered SqFt. Install layers draw as light-green turf areas on the canvas.
- `getAdjustedShapeArea` and the layer dropdown default changed from `exclude` to `install`;
  a replaced putting-green layer now demotes to `install`.

### Behavior-change note
Previously-imported multi-layer projects whose sub-layers had no explicit mode were treated as
**exclude** (cutouts); they now default to **install** (added to the sum). If a sub-layer is
actually a cutout, set it to Exclude in the Layers list.

### Tests
- Section 50 added: all-layers-install → N layouts, combined = sum of layers, exclude/ignore
  drop out, and translation-invariance of a positioned layer's ordered area. Two prior tests
  updated for the new `install` default (area not subtracted; PG demotes to install).
- **Total: 565 tests, all passing** (558 prior + 7 new).

### Still open
- Multi-layer Phase 2 (canvas roll strips per layer) and Phase 3 (per-layer direction/cuts).
- Nesting drop placement (paused at user's request); tiered-pricing work; doc/test-count reconciliation.

---

## 2026-06-17 (cont'd, 9) — Nested piece stays exactly where you drop it (centroid match)

### The piece jumped off the cursor onto the turf
While dragging, the ghost centers the piece's **centroid** under the cursor, but the drop code
placed the piece's **bounding-box centre** at the drop point. For a non-rectangular piece (a
triangle), centroid ≠ bbox centre, so on release the piece jumped away from where the ghost
showed it — often onto the neighbouring turf, even though clear waste was right where the user
aimed.

### Fix
`assignNestPlacements` now translates the piece so its **centroid** lands at the drop point
(falling back to the bbox centre only when a piece has no clipped polygon), matching the drag
ghost exactly. Clamping still keeps the whole piece inside the target rectangle, and the
anti-stacking nudge is unchanged. Net effect: the piece stays right where you drop it.

### Tests
- Added a test with an asymmetric triangle (centroid (1.33,1.0) vs bbox centre (2,1.5)) asserting
  the placed centroid is exactly at the drop point. Existing honor-drop tests still hold
  (rectangles have centroid = bbox centre).
- **Total: 558 tests, all passing** (557 prior + 1 new).

### Still open
- Layout → Quote Builder auto-apply; more tiered-pricing work; doc/test-count reconciliation.

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
