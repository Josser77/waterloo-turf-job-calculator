# Changelog — Waterloo Turf Job Calculator

All notable changes to the calculator are documented here.
Format: newest sessions at the top. Each entry covers one development session.

---

## 2026-07-22 (cont'd 93) — Edging: click segments on the drawing

Added click-a-segment on the layout drawing. A "✏ Click edges on the drawing" toggle in the
Edging panel enters click mode (mutually exclusive with Cut/Draw/Edit/Move like the other canvas
modes); clicking a segment toggles it, and the segment under the cursor is outlined dashed-blue
as hover feedback. The hit-test runs against the SAME rotated point arrays the shapes are drawn
from (basePoints / displayPoints), so clicks map to the correct segment index at any rotation
(verified: click a segment at 0°, and again after rotating 40° — both hit the right edge). Writes
the same per-segment selection, so the checklist, highlight, total, and boards all update. Works
by mouse and by touch (iPad tap).

Tests **1881 → 1886** (README **1886**): mode toggle + button, hit-test off the drawn arrays,
click/hover wiring, dashed hover. Verified end-to-end with real simulated clicks (select/deselect,
and correct mapping after a 40° rotation). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 92) — Edging selection: granular per-segment picking (parent/child)

Selecting a "side" was too coarse. Each multi-segment side (a merged straight run or a curve) is
now a PARENT checkbox with an expandable list of per-segment CHILD checkboxes, so you can edge
one segment of a run instead of the whole thing. Parent shows checked / indeterminate (some
segments) / unchecked and toggling it selects/deselects all its segments; single-segment sides
stay a plain checkbox. Selection is still stored per edge, so the total, highlight, and boards
all reflect the exact segments chosen. layoutSidesForShapes now returns per-segment 
(key + length); new toggleEdgingEdge / toggleEdgingExpand handlers.

Tests **1877 → 1881** (README **1881**): per-segment edges with lengths, single-segment selection
(8 ft not the 24 ft side), and the handler/indeterminate wiring. Verified end-to-end (expand a
3-segment side, pick one → 8 ft, parent indeterminate; parent-all → 24 ft). Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 91) — Fix: edging checklist didn't refresh on project switch

Same class as the Profit Audit fix. renderEdgingSelection ran on sub-tab open and on toggle,
but not in the layout render path, so switching projects while on the Edging sub-tab left the
previous project's sides/checkboxes showing. Added renderEdgingSelection(proj) alongside
renderFringeSection in the layout render.

Tests **1876 → 1877** (README **1877**). Verified end-to-end (switching Alpha→Bravo updates side
count, checkboxes, and total). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 90) — Edging runs highlight on the layout drawing

Selected edging runs now highlight boldly on the layout canvas — bright orange with a soft glow
and endpoint dots, drawn last so it's unmistakable. Rendered from the SAME rotated point arrays
the shapes are drawn from (main = basePoints, secondary = displayPoints, same index order), so
the highlight lands exactly on the drawn edges at any roll rotation (verified at 0° and 35°).
Hidden layers aren't highlighted. Toggling a side from the checklist redraws the highlight
immediately.

Still to come: clicking a side directly ON the drawing to toggle it (the highlight + checklist
are now both ready to reflect it).

Tests **1872 → 1876** (README **1876**): highlight pass present, main via basePoints, secondary
via displayPoints, hidden-layer skip. Verified visually at 0° and 35° rotation. Green under UTC
and America/Los_Angeles.

---

## 2026-07-22 (cont'd 89) — Edging run selection: checklist + auto-fill (canvas click next)

New "Edging" sub-tab on the Layout page. It lists every shape's sides (contiguous runs between
corners — a straight run or gentle curve is one clickable side, not many segments), each with a
checkbox and length, plus "Whole perimeter" and "Clear". Ticking sides sums their length and
auto-fills Linear Feet of Edging on the Quote Builder (which then drives boards + the top-bar
EDGING total). Lets you edge the whole perimeter or only the runs that actually need it (skip
the driveway/house sides). Selection is stored per project (proj.layout.edgingSelection).

Deferred to next: click-a-side directly on the layout drawing + highlighting the selected runs
(needs the canvas's roll-rotation transform handled carefully so clicks/highlights line up with
the rotated view). The click will write the same selection state, so the checklist stays in sync.

Tests **1867 → 1872** (README **1872**): sub-tab/panel present, toggle/all/clear handlers,
auto-fill-then-recompute wiring, per-project persistence. Verified end-to-end (tick sides →
edging linFt 30, whole perimeter 60, clear empties; top bar reflects it). Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 88) — Edging edge-selection: pure core (canvas UI to follow)

Groundwork for "select which perimeter runs need benderboard": pure, tested helpers to
enumerate a layout's edges with lengths (layoutEdges), list the selectable shapes with stable
keys (layoutShapesForEdging), sum a selection into linear feet (selectedEdgingLength), and
convert to boards (edgingBoardsForLength, ceil(linFt/20)). This total is what will feed the
existing calcEdging. The canvas selection UI (interaction model TBD with Brian) comes next.

Tests **1853 → 1861** (README **1861**): edge enumeration (closed polygon vs line vs too-few
points), shape listing, selection summing across shapes, unknown-key safety, and boards math.
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 87) — Profit Audit: thousands commas + fix the double-click bug

Two Profit Audit fixes:
- Money fields (Contract Price, Actual Revenue, Quoted, Actual) now format with thousands
  commas ("3,940.50"). They're text inputs (number inputs can't show separators) that store the
  raw comma-free value, so the math is unchanged; new fmtMoneyInput / stripCommas helpers.
- Fixed the "have to click twice" bug: committing a cell used to call renderProfitAudit, which
  rebuilt the whole panel and destroyed the input you were clicking into. Commits now update
  only the computed cells in place (recalcProfitAudit) — clicking straight from one cell to
  another works on the first click. Add/remove row still do a full render (no focus involved).

Tests **1844 → 1853** (README **1853**): comma formatting (incl. negatives, typed decimals,
already-formatted input, blank), stripCommas, compute-on-raw-values, and the in-place-commit
wiring. Verified end-to-end (single-click cell-to-cell focus + live comma recompute). Green
under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 86) — Consistent "Back up now" naming everywhere

Swept the remaining "Export Everything" / "↓ Backup" wording to "Back up now" across the
Backup & Sync card text, the Auto-Backups dialog, the Vendor tab note, the Help guide, and the
empty-selection alert. Also removed the now-redundant "↓ Export Everything" button — the
prominent "Back up now" does the identical full export, so the card no longer has two buttons
for the same action. The underlying exportBackup('all') is unchanged.

Tests **1844** (unchanged). Verified the card now shows a single Back up now (plus Export
Selected / Import / Auto-backups / Reset). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 85) — Align http banner wording with the "Back up now" button

The http/wrong-address banner still said "Export Everything" and "Import → Replace" (it predated
the Back up now button). Updated it to "Back up now" and "Import & Replace All" so it matches the
actual button labels and the franchise migration message. Copy-only.

Tests **1844** (unchanged). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 84) — Fix: switching projects didn't reload the Profit Audit tab

loadProject re-renders whichever estimator tab is active (pavers/mulch/riverRock/dashboard) so
it reflects the newly loaded project, but panel-profit was missing from that list — so with the
Profit Audit tab open, switching projects left the previous project's audit on screen. Added
the panel-profit case.

Tests **1843 → 1844** (README **1844**). Verified in-browser (Contract Price + panel switch
from one project to another). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 83) — One-click "Back up now" + last-backup reminder

Web-first backup nudge (no Mac/Windows app work):
- A prominent green **Back up now** button at the top of Settings -> Backup & Sync runs a full
  Export Everything, and a status line shows "Last backup: today / N days ago / you haven't
  backed up yet" (red when stale).
- A full export now records the time (wt_last_backup_at). When the last backup is 7+ days old
  (or never), an amber "Back up now" nudge appears in the always-visible sidebar so people are
  reminded without opening Settings; it clears once they back up.

New pure helpers daysSince / backupStatus (threshold 7 days). Export Selected does not count
as a backup (partial), so it doesn't reset the reminder.

Tests **1832 -> 1843** (README **1843**): day math, never/today/yesterday/N-days labels, stale
threshold, and the button/nudge/timestamp wiring. Verified end-to-end (nudge shows when stale,
clears after backup, Settings line updates). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 82) — Wrong-address banner (http → https migration safety)

Added a sticky red banner that appears only when the app is loaded over plain http at the real
host (turf.brianyoss.com) — the case where a user's data is stranded in the http origin and the
project list looks empty. It tells them, in plain language, to Export Everything here, then
reopen at https://turf.brianyoss.com and Import → Replace, with a direct link to the correct
address. Dismissible (remembered via localStorage).

Deliberately conservative — never fires on https, file:// (opening the HTML directly),
localhost/loopback, or GitHub preview hosts, so it can't cry wolf. New pure helper
shouldWarnWrongAddress.

Tests **1824 → 1832** (README **1832**): warn only on http+canonical host, case-insensitive,
and silent everywhere else; plus banner/URL wiring. Verified in-browser (renders, dismiss
persists). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 81) — Filter the project list by status (All / Pending / Won / Lost)

Added a status filter bar under the sidebar search: All / Pending / Won / Lost, each showing a
live count (respecting the search box). Pending = anything not marked Won or Lost, so
brand-new/no-status projects show under Pending. Stacks on top of the text search and the
A–Z/New/Old sort. New pure helper filterByStatus (non-mutating, null-safe).

Tests **1814 → 1824** (README **1824**): each status, empty/null → all, non-mutating,
search+status composition, and the button wiring. Verified end-to-end in a browser (counts and
filtered lists correct). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 80) — Profit Audit: Contract Price starts blank

Per request, a new Profit Audit no longer pre-fills Contract Price from the last quoted price —
it starts blank for manual entry. Actual Revenue was already blank.

Tests **1813 → 1814** (README **1814**). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 79) — New per-project "Profit Audit" tab

Added a Profit Audit tab (after Dashboard) to each project, mirroring the reference sheet:
- Header: Job Name + Install Date (from the project), and editable Contract Price and Actual
  Revenue.
- A cost table with editable Cost Category / Quoted Cost / Actual Cost and computed Variance
  and Variance %, color-coded (over budget red, under green). Add/remove category rows;
  defaults ship as Turf, Turf Accessories (infill), Base Materials, Dump Fees, Labor, Shipping,
  Other.
- Totals: Total COGS, Gross Profit (revenue − COGS), and Gross Margin (profit ÷ revenue), each
  with Expected / Actual / Variance / Variance %. Gross-side variances are green when positive.

Quoted and actual costs are entered manually (Contract Price pre-fills from the last quoted
price, editable). Stored per project in proj.profitAudit. New pure computeProfitAudit reproduces
the reference Margaret McLean sheet to the cent.

Tests **1800 → 1813** (README **1813**): every figure from the reference sheet (rows, COGS,
gross profit, gross margin, variances), plus empty/divide-by-zero edge cases and the tab/panel
wiring. Verified in-browser. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 78) — Note in Auto-Backups dialog that vendor lists are export-only

Added a one-line note to the Auto-Backups dialog: auto-backups don't include vendor price
lists — use Export Everything to move those between devices. Copy-only, no behavior change.

Tests **1799 → 1800** (README **1800**): the note is present. Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 77) — Vendor price lists now included in full backups

"Export Everything" now bundles vendor price lists — both the vendor metadata and the actual
files (PDF/xlsx/CSV), base64-encoded inside the JSON — and a full "Replace" import restores
them to the receiving device (metadata to localStorage, bytes back into IndexedDB). Previously
vendor files lived on one device only. Selective (project-only) exports stay project-only and
do NOT carry vendors, so they can't clobber another device's vendor setup.

Note: this makes the full backup file larger (a few MB per PDF price list). exportBackup/import
became async only when files are present, so the no-vendor path stays synchronous.

New helpers: abToBase64 / base64ToAb, vendorFileIdsWithData (pure), collectVendorFiles /
restoreVendorFiles (async IndexedDB).

Tests **1793 → 1799** (README **1799**): which vendors get backed up, base64 losslessness, and
that full export/replace-import carry vendors while selective export doesn't. Verified
end-to-end in a browser (export captures the file, clear, import restores exact bytes). Green
under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 76) — Rock/base area now includes the putting green

Per Brian: base goes under the putting green too. rockBaseSqFt now sums <strong>base-role +
putting-green-role</strong> turf (the full outline), instead of base only. Alt-turf rows stay
excluded (an alternate product for the same base footprint). autoPopulateRock uses the same
helper, so both the live area-mode sqft and any priced rock line now cover base + green.

Example (Back putting green: base install 82.37 + green 91.52) → rock area 173.89 sqft, the
whole outline.

Tests **1792 → 1793** (README **1793**): base+green sum with alt-turf excluded, and a
green-only job still gets rock. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 75) — Area-mode rock rows are now robustly live-linked to the turf area

Area-mode rock/base rows already re-pulled the base turf area on a turf edit, but three gaps
made it unreliable: a total>0 guard skipped the sync when base area was 0 (leaving a stale
value), cubic-yards rows had their unused sqft clobbered, and load-time didn't re-sync.

New pure helpers rockBaseSqFt (base-role turf area) and syncAreaModeRockSqFt (writes it into
area-mode rows only). Wired into renderRockRows (so it's live on load and every render),
autoPopulateRock (replaces the guarded block), and calcQuote (re-syncs before pricing rock).
Result: change or clear the installed turf area and area-mode rock — and its priced line —
follow immediately; cubic-yards rows keep the yards you typed.

Note: rock area = base-role turf only (unchanged), so putting-green / alt-turf areas are not
counted toward rock. Flagging in case that undercounts rock on green-heavy jobs — say the word
if rock should also cover those.

Tests **1786 → 1792** (README **1792**): base-area sum, area rows track (incl. →0), yards rows
untouched, no-entryMode defaults to area. Verified end-to-end (400 → 900 → 0 → reload 650).
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 74) — Show $/Cu. Yd column in the rock settings table

The Rock / Base Materials settings table now has a <strong>$/Cu. Yd</strong> column (before
$/SqFt @ 1"), so the cost-per-yard that drives quote pricing is visible at a glance, not just
inside the edit modal. Blank costs show "—".

Tests **1784 → 1786** (README **1786**): the table header and the per-row cost render. Verified
in-browser. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 73) — Remove the rock "Unit" entry mode

Dropped the Unit entry mode from the Rock / Base card — it couldn't be priced by cost-per-yard
and added confusion. Rows now have just <strong>Area (auto)</strong> and <strong>Cubic
yards</strong>. rockRowOrder no longer returns units/unitLabel; the unused onRockTextInput and
the "Cu. Yards / Qty" header wording were removed. Any old row saved as "unit" falls back to
area (no crash).

Tests **1786 → 1784** (README **1784**): removed the unit-mode assertions, added a fallback
check. Verified the row now offers only the two modes. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 72) — Rock/base: cost per cubic yard + optional priced line on the quote

Follow-up to cont'd 71:
- Rock catalog items now have a <strong>Cost per Cubic Yard</strong> field (Settings → Rock /
  Base Materials).
- New Settings toggle <strong>"Show rock/base cost on quotes"</strong> (off by default) for
  businesses that do NOT build rock into their crew's per-sqft labor rate. When on, rock cost
  = each material's cost/yd × its cubic yards is added to COGS and shown as a "Rock / base"
  line on every scenario (per-project, like shipping, so margin applies to it).
- Cost is driven by the specified depth: cubic yards = area × (depth/12) / 27 (area mode) or
  the yards typed (cubic-yards mode). Unit mode has no cubic yards, so it isn't priced by the
  per-yard cost.

New pure helpers rockRowCost / sumRockCost + getRockInQuote/setRockInQuote (localStorage
wt_rock_in_quote_v1). Default OFF keeps existing quotes unchanged.

Tests **1774 → 1786** (README **1786**): cost per yard, depth sensitivity (½ depth → ½ cost),
per-mode pricing, no-cost/no-catalog safety, sum across lines, toggle default off, and COGS
wiring. Verified end-to-end (toggle off → no line, $1,050; on → +$275 rock line). Green under
UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 71) — Rock/base: enter by cubic yard or by unit (not just auto-from-area)

Each Rock / Base line now has an "Enter by" mode:
- **Area (auto)** — the existing behavior: tons & cubic yards derived from the turf area ×
  the catalog depth (default, so nothing changes for existing rows).
- **Cubic yards** — type the cubic yards directly; tons are derived at 1.4 ton/yd³.
- **Unit** — type a plain count plus your own label (e.g. "loads", "tons", "bags"); carried
  as-is with no conversion.

New pure helper rockRowOrder (mode-aware); rows store entryMode / yards / units / unitLabel
(old rows default to area). Unit-mode rows contribute no tons to the top-bar total (correct —
a "load" isn't a ton). Note: rock is still an ORDER-QUANTITY helper only — it does not price
into the customer quote (rock cost lives in the crew's per-sqft labor rate, unchanged).

Tests **1766 → 1774** (README **1774**): all three modes, rounding, blank/NaN safety, unit
label default, and that unit rows add no tons to the total. Verified end-to-end in a browser.
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 70) — Remove the layout diagram from walkthrough step 4

Dropped the small SVG app-layout diagram from the "Lay out the job" step; it now reads as plain
text. Also removed the now-unused WIZARD_LAYOUT_SVG constant (no dead code left).

Tests **1766** (unchanged). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 69) — Walkthrough card can minimize to a pill (stops covering Layout controls)

The floating coach card sits bottom-right, which is exactly where the Layout tab's right-pane
controls live. Added a minimize button (–) that collapses the card to a small "▸ Getting
Started · Step X of 6" pill in the corner; click the pill to bring the card back. Also,
clicking a step's action button (Open Settings / Start a project / Go to Layout) now
auto-minimizes the card, so you land on the page you navigated to with nothing in the way.
Minimize works on touch too (unlike a drag), so it's iPad-safe.

Tests **1762 → 1766** (README **1766**): minimize/expand functions, the pill reopens on click,
and actions auto-minimize. Verified end-to-end in a browser. Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 68) — Fix totals-strip location in walkthrough + docs (above the tabs)

The walkthrough's Layout step said the order figures sit "just right of ⚙ Settings" — wrong.
The totals bar (#topMetrics) is its own row directly above the tab row. Corrected the
walkthrough copy to "just above the tabs", and fixed the same stale description in two places
in the User Guide.

Tests **1762** (unchanged count; updated the Layout-step assertion to the corrected wording).
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 67) — Walkthrough copy fixes: multi-file import + order figures

Two accuracy fixes in the walkthrough:
- Create step no longer implies you can import several Moasure files in the new-project modal
  (you can't). It now imports one CSV in the modal, and notes that combining multiple files
  into one job is done on the Layout tab.
- Layout step no longer vaguely says the Layout tab "tells you how much to order." It points
  to the always-visible top-bar totals strip (Installed / Ordered / Turf LF / Scrap, right of
  ⚙ Settings) as the easy running reference.

Tests **1759 → 1762** (README **1762**): the create step ties multi-file import to the Layout
tab (not the modal), and the Layout step points at the top-bar strip. Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 66) — Walkthrough Settings step: drop Vendor Pricing, add Roll Settings

The Settings step wrongly listed "Vendor pricing" — that's its own tab, not part of Settings.
Removed it and added <strong>Roll Settings</strong> (roll width/length, S-seam side trim,
cutting margin — the values that drive how much turf is ordered), which is genuinely the first
card in the Settings tab. Added a parenthetical noting supplier price lists live on the Vendor
Pricing tab, so users aren't left looking for them.

Tests **1757 → 1759** (README **1759**): the Settings step covers Roll Settings and no longer
lists Vendor Pricing as a Settings item. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 65) — Walkthrough is now a guided, non-blocking coach card with per-step actions

Turned the Getting Started walkthrough from a blocking centered modal into a floating,
non-blocking coach card (bottom-right, no backdrop, pointer-events:none on the overlay so the
app stays fully usable behind it). Each work step now has an action button that drops the user
on the right page while the card stays open to guide the next step:
- "Set up your Settings" → ⚙ Open Settings (switches to the Settings tab)
- "Create a project & import Moasure" → ＋ Start a new project (opens the new-project modal)
- "Lay out the job" → 📐 Go to the Layout tab

The card sits above other modals (z-index 1300) so it keeps guiding even while the new-project
modal is open. Do the action, then Next → to continue.

Tests **1752 → 1757** (README **1757**): non-blocking overlay, the three navigation actions,
and that the work steps carry their action buttons. Verified end-to-end in a browser (each
action navigates, the card stays open, and the new-project modal is clickable — not blocked by
the card). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 64) — Walkthrough steps reordered to match the real workflow

Reordered the Getting Started steps to follow the order owners actually work in:
1. Welcome, 2. **Set up your Settings first** (turf products, infill, rock/base, edging, crew
labor rates, vendor pricing), 3. **Create a project & import the Moasure file**, 4. **Lay out
the job** on the Layout tab (rotation, seam offsets, layers, minimize waste), 5. Pricing
(optional, Jobber note), 6. Backups & help. Previously Settings came last and the create/plan
steps were out of order.

Tests **1748 → 1752** (README **1752**): assert the step order (Settings → create+import →
Layout) and the key content of each. Verified in-browser. Green under UTC and
America/Los_Angeles.

---

## 2026-07-22 (cont'd 63) — Walkthrough shows every launch (opt-out) + Layout/Jobber framing

Per rollout feedback:
- The Getting Started walkthrough now opens on EVERY launch by default, with a "Don't show
  this again" checkbox. Closing/skipping without ticking it keeps it appearing next time;
  ticking it sets a dismiss flag (wt_wizard_hide_v1) so it stops. Still replayable from ? Help
  regardless. (No longer keyed to the one-time SETUP flag.)
- Step 2 no longer says users will "live in Quote Builder." It now points them at the Layout
  tab (after importing Moasure) as the main workspace, and notes the Quote Builder is a
  pricing add-on since customer quotes are built in Jobber. Step 4 reworded to match (it no
  longer calls the priced options "your quote" — it's a reference to carry into Jobber).

Tests **1745 → 1748** (README **1748**): every-launch/opt-out wiring, the checkbox, and the
Layout/Jobber copy. Verified end-to-end (shows again when not opted out, stops when the box is
ticked, Help still replays). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 62) — Getting Started walkthrough (onboarding wizard)

Added a skippable, replayable 6-step Getting Started walkthrough for new users (franchise
pilot rollout). Steps: welcome + "you can ignore most of the buttons", a small diagram of the
app layout, start a project, get your quote, set up Settings once, and backups/help. The copy
deliberately reassures users they don't need every option to make a quote.

- Auto-opens on first launch (replaces the bare first-launch banner); marks SETUP_KEY +
  WIZARD_KEY on finish/skip so it doesn't re-nag.
- Replayable anytime via a "▶ Getting Started walkthrough" button in the ? Help dialog.
- Progress bar + Back/Next/Skip; the final step offers "Create my first project" (opens the
  new-project modal) or "Explore on my own".

Data-driven WIZARD_STEPS + pure clampWizardStep. Tests **1734 → 1745** (README **1745**):
step clamping edge cases, and that the wizard is wired in (modal present, first-launch open,
Help replay, create-first-project CTA, seen-flag). Verified end-to-end in a browser.
Green under UTC and America/Los_Angeles.

Note: a one-time tour helps users START but won't fix an overwhelming UI on its own — if the
pilot feedback persists, the next step is progressive disclosure (hiding advanced tabs until
needed).

---

## 2026-07-22 (cont'd 61) — Turf products can have multiple types + a Fringe role at project creation

Two related changes:
- A turf product can now be MORE THAN ONE type. The Settings product Type is now checkboxes
  (Standard / Putting Green / Fringe) instead of a single dropdown, so e.g. K9 Cascade Pro can
  be both Standard and Fringe. Stored as a `types` array (old single `type` auto-migrates; a
  legacy `type` mirror is kept for older reads). The product table shows a combined label
  ("Standard · Fringe"), and the Fringe tab offers any product whose types include Fringe.
- The New Project turf picker's Role dropdown adds a **Fringe** option (alongside Base Yard /
  Alt Turf Option / Putting Green). Marking a product Fringe designates it as the project's
  fringe turf (enables fringe + sets its product); its sqft fields are disabled since fringe
  is measured from the green's border. It is deliberately NOT added as an area-priced turf
  row — pricing stays on the single border-geometry linear-feet calc, so there's no double
  count. (Fixed along the way: a fringe-only project with no imported CSV now gets a complete
  empty layout instead of a partial one that crashed rendering.)

New pure helpers getTurfTypes / turfTypesLabel / productHasType.

Tests **1721 → 1734** (README **1734**): type migration/merge/label, and the modal Fringe role
wiring (role present, sqft disabled, excluded from priced rows, sets the fringe product).
Verified end-to-end in a browser. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 60) — Don't hardcode K9 as fringe; type is a hint, not a lock

Follow-up to cont'd 59. Reverted the default catalog so K9 Cascade Pro ships as "standard"
again — the app no longer presumes any product is the fringe. You designate your own fringe
product by setting its type to Fringe in Settings.

Clarified (and covered by tests) that a product's type never restricts where it's used: the
new-project picker lists every turf product regardless of type, and the row role
(base / alt / putting-green) is independent of type. So a product typed "Fringe" is still
fully usable as base yard turf — the type only labels it and sets the Fringe tab's default.
Softened the in-app help text accordingly.

Tests **1718 → 1720** (README **1720**): K9 ships standard, Fringe is an available type
option, and the product picker isn't type-filtered. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 59) — "Fringe" turf type (designate your fringe product)

Added Fringe as a third turf type alongside Standard and Putting Green (Settings → Turf
Products → Type). Parallels how a putting-green product is typed: mark your fringe turf (e.g.
K9 Cascade Pro) as "Fringe" and the Layout → Fringe tab defaults to it automatically, listing
fringe-type products first. The default catalog now ships K9 Cascade Pro as type "fringe"
(PDX Putt stays "putting"). New pure helper turfTypeLabel; the product table chip and the
labor-line meta now show "Fringe" where applicable.

Note: this designates the fringe product by type; the fringe is still configured and priced
via the Layout → Fringe tab (its own line, by linear feet). It is not a separate quote-builder
turf ROW — say the word if you also want a fringe row there.

Tests **1712 → 1718** (README **1718**): type label for all three types + fallback, and the
default catalog's K9=fringe / PDX Putt=putting. Verified in-browser: Type dropdown shows
Fringe, K9 shows the Fringe chip, and the Fringe tab auto-selects the fringe-type product.
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 58) — Fix: putting-green fringe was ordered/priced as area, not roll linear feet

The fringe was massively over-ordered and over-priced. It computed the fringe MATERIAL area
(≈ perimeter × fringe width, e.g. 68 sqft for a 20×10 green with 1 ft fringe) and then
multiplied that area by the turf's per-LINEAR-FOOT cost — treating ~68 sqft as ~68 linear
feet of roll. On a $30/lin-ft roll that's ~$2,040 for fringe that should cost ~$180.

Fix: fringe pieces are cut with their length across the roll WIDTH (blades facing the green),
so they're now packed across the roll width (first-fit-decreasing) into rows; each row uses
one fringe-width of roll LENGTH. Order quantity is those linear feet (rounded up to a whole
foot), and cost = linear feet × per-lin-ft. New pure helper `fringeOrderFromPieces`;
computeFringePlan now returns linearFtToOrder / fringeRows / orderedSqFt. The Fringe summary
and the quote breakdown now show "lin ft to order" instead of sqft.

Example (20×10 green, 1 ft fringe, 15 ft roll): 6 pieces of 11–12 ft pack to 6 rows → 6 lin
ft (only one 11–12 ft piece fits across a 15 ft width), i.e. ~$180 not ~$2,040.

Tests **1705 → 1712** (README **1712**): packing across the width, rounding, zero cases, and
the full-plan linear-feet output; updated the three end-to-end fringe assertions that had
codified the old area pricing. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 57) — Cut list PDF filename now "<project name> - Cut List"

When you Print / Save-as-PDF the installer cut list, the suggested filename is taken from the
print document's <title>. Changed that title from "Turf Cut List — <name>" to
"<project name> - Cut List" (e.g. "Smith Backyard - Cut List"), so saved files sort and read
by project. Blank/unnamed projects fall back to "Turf Job - Cut List". Pure helper
`cutListDocTitle`.

Tests **1700 → 1705** (README **1705**): name formatting, trimming, fallbacks, and that the
print doc's <title> uses it. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 56) — Reorder crew chips too (shared with vendors)

Crew chips are now drag-to-reorder, same as vendors: each has a ⠿ grip, drop it on another
chip to move it, order is saved. Reordering never changes which crew is active. Factored the
move into one pure helper `reorderById(list, dragId, dropId)`; `reorderVendors` now delegates
to it, so crews and vendors share the exact same tested logic. Same desktop-only caveat as
vendors (HTML5 drag; no iPad touch-drag).

Tests **1695 → 1700** (README **1700**): crew moves via reorderById, reorderVendors delegates
consistently, non-mutating. Verified drag end-to-end headlessly (order changes + persists,
active crew preserved). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 55) — Reorder vendor chips by drag-and-drop

Vendor chips can now be dragged to sort them however you like. Each chip gets a ⠿ grip and
is draggable; drop it on another chip to move it there, and the new order is saved. Pure
`reorderVendors(list, dragId, dropId)` does the move (new array, non-mutating, no-ops on
unknown/same ids). Note: HTML5 drag works on desktop (Mac/Windows); touch-drag on iPad isn't
supported by this method — ask if you want ◀ ▶ buttons for iPad too.

Tests **1687 → 1695** (README **1695**): forward/backward/adjacent moves, self- and
unknown-id no-ops, non-mutating, null-safe. Verified drag end-to-end headlessly (order
changes and persists). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 54) — New default Side Trim (10 in) and Cutting Margin (6 in)

Changed the default Roll Settings: S-Seam Side Trim 4 → 10 in (total, not per side) and
Cutting Margin 4 → 6 in (per piece). Updated in both the input defaults and
ROLL_DEFAULTS_FALLBACK, so new/reset installs get 10/6. Default usable width is now
15 − 10/12 = 14.167 ft.

Note: this only affects fresh/new-user state and anywhere the app falls back to the default
— existing saved roll settings (global or per-project) keep their current values until reset.

Test updated (the guardrail that asserts the default correctly caught the change): default
trim/margin now 10/6. Tests **1687**, green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 53) — Clarify Side Trim & Cutting Margin help text (no math change)

Reworded the Roll Settings help text (and the User Guide glossary) to remove a per-side
ambiguity. The math was already correct and is unchanged:
- S-Seam Side Trim is a TOTAL taken off the roll width once (usable = rollWidth − trim/12),
  not per edge. Text now says "enter both edges combined, not per side. E.g. 4 in means 4 in
  total."
- Cutting Margin is added once per cut piece (a single allowance, not per end) before
  rounding up to the next whole foot. Text now says so.

No code or test change (1687). Verified parse + suite green.

---

## 2026-07-22 (cont'd 52) — Vendor Pricing: remove an imported price list

Added a "🗑 Remove price list" button on the Vendor Pricing tab (next to Import). It shows
only when the active vendor has a file; clicking it confirms, then deletes the file bytes
from IndexedDB and clears the vendor's fileName/fileType — the vendor itself stays, ready
for a fresh import. (Deleting the whole vendor via its × chip already removed its file too;
this is the "keep the vendor, drop just the file" case.)

Verified headlessly: after import the button is visible and the table renders; after Remove
the IndexedDB blob is gone, the metadata is cleared, the vendor remains, and the viewer
returns to the "no price list yet" prompt.

Tests **1687** (README **1687**), green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 51) — Vendor UI consistency: crew-style chips + modal (no browser prompts)

Made vendor add/rename/select match the crew "pricing" UI exactly, per request:
- The vendor dropdown is now a chip row identical to the crew tabs — each vendor is a
  [ name ✓ ][ ✎ rename ][ × delete ] chip, active one highlighted green. "+ Add vendor"
  and "↑ Import price list" sit alongside.
- Add and Rename now open a styled modal (the same look as the Add/Rename Crew modal),
  replacing the plain browser prompt() I'd used.

Added one reusable name modal (openNameModal/saveNameModal/closeNameModal) and also routed
the project Rename (Actions menu) through it, so there are NO browser prompt() dialogs left
anywhere in the app — everything uses the app's own modal styling. Enter saves; Esc/Cancel
closes.

No test-count change (UI wiring; the vendor data/parsers are already covered). Verified
headlessly: chips render, the modal opens titled correctly, and add/rename update the vendor
list. Tests **1687** (README **1687**), green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 50) — Vendor Pricing tab (import & view PDF / Excel / CSV per vendor)

New Vendor Pricing tab. Keep each supplier's price list for quick reference, switch between
vendors with a dropdown (like crews): + Add vendor, Rename, Delete, and ↑ Import price list.

- PDF price lists render in an embedded viewer (blob URL in an iframe).
- Excel (.xlsx) and CSV render as a scrollable table. xlsx is parsed with NO library: the
  file is unzipped using the browser's built-in DecompressionStream (deflate-raw), and the
  sheet + shared strings are parsed from their XML. Streamed/exotic xlsx falls back to a
  download link.
- Storage: file BYTES live in IndexedDB (a PDF is far too big for localStorage's ~5MB
  shared budget); vendor metadata (name, filename, type) lives in localStorage. IMPORTANT:
  vendor files are NOT in the JSON export/backup — they're re-importable reference docs, so
  moving machines means re-importing. Metadata is small and does ride along in localStorage.

Pure, tested parsers: parseCSV (quotes/doubled-quotes/embedded commas), parseXlsxSharedStrings,
parseXlsxSheet (shared-string / inline / number cells, entity decoding), vendorFileKind,
renderVendorTable. Full path (real .xlsx → IndexedDB → unzip → table, and PDF embed)
verified headlessly with an openpyxl-generated workbook.

Tests **1672 → 1687** (README **1687**). Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 49) — Fix: Minimize waste reported a saving but nothing changed

The ✨ Minimize waste (all layers) button showed a "saved X ft²" toast but the layout,
ordered footage, and roll direction never actually changed for the PRIMARY shape.

Root cause: renderRollLayout() reads the primary rotation/translation from the slider
inputs (rollRotationInput / rollTranslationInput) and then overwrites proj.layout.rotation
from them. optimizeAllLayers set proj.layout.rotation but not the sliders, so the very next
redraw clobbered the optimized value back to the old slider position. The toast's numbers
came from an independent sweep, so it promised a saving that was never applied. (Install
layers were fine — they read proj.layout.layerRoll, which the optimizer does update.)

Fix: optimizeAllLayers now also writes the chosen primary rotation + seam offset to the two
slider inputs (and computes over getBaseLayoutPoints, matching the renderer's coordinate
frame). Verified in a headless browser: a 40×20 job went from 1,230 → 945 ft² ordered with
the rotation slider moving 0° → 88°, matching the toast.

Tests **1667 → 1672** (README **1672**): the source updates both sliders and proj.layout on
a win, and the sweep still finds a real reduction. Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 48) — Top bar always visible; sidebar Actions menu (new/rename/duplicate/delete)

- The project top bar (project name / Crew / Status / legend / Help) now stays visible at
  all times. With no project selected it shows a disabled "Select a project" title and
  disabled Crew/Status; picking a project in the sidebar populates and enables everything.
  Side benefit: the ? Help button is now always reachable, including the empty state.
- Replaced the sidebar's two buttons (New / Delete) with an "⚙ Actions ▾" dropdown:
  New Project, Rename Project (prompt), Duplicate Project, Delete Project. Rename and
  Delete no-op with a nudge if nothing is selected.
- Duplicate makes a deep copy as a fresh quote: new id/created, "(copy)" name, status reset
  to pending, recorded price dropped. Pure `duplicateProjectObject` does the copy.

Tests **1659 → 1667** (README **1667**): duplicate gets a fresh id/created, "(copy)" name,
pending status, dropped price, deep-copied turf/settings, originals untouched, and null-safe.
Green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 47) — Help button to the project top bar; Backup & Sync to the bottom of Settings

- Moved the "? Help" button off the tab row and onto the project top bar (the row with the
  project name / Crew / Status), right-aligned next to the color legend. Note: that bar is
  only visible when a project is open, so on the empty state (no projects) Help isn't shown
  there — open or create a project to reach it.
- Moved the Backup & Sync card from the top of the Settings tab to the BOTTOM (after
  Default Shipping), so Settings opens on Roll Settings / catalogs as before.

Both are presentational moves. Panel div-balance re-verified (the structural guard from
cont'd 46 still passes: Backup & Sync is now the last card inside panel-settings).

Tests **1659** (unchanged; README **1659**), green under UTC and America/Los_Angeles.

---

## 2026-07-22 (cont'd 46) — Fix: Settings cards leaked onto every tab (Dashboard, etc.)

Regression from cont'd 45: inserting the Backup & Sync card consumed the Roll Settings
card's opening `<div class="card">` without re-adding one, so Roll Settings' closing tag
closed `panel-settings` itself. Every settings card after that point (Turf Products, Infill,
Rock, Edging, Misc, Labor Rates, Profit Margin, Default Shipping) was left OUTSIDE any tab
panel and therefore rendered on ALL tabs — including the Dashboard. Restored the missing
card wrapper; panel-settings now closes after its last card (Default Shipping).

Added a structural test that walks each tab panel's div balance and asserts panel-settings
still contains its last card and the dashboard panel doesn't swallow settings cards — this
would have caught the leak.

Tests **1656 → 1659** (README **1659**). Verified headlessly: no settings card is visible on
the Dashboard tab, and all of them show on the Settings tab.

---

## 2026-07-22 (cont'd 45) — Layout declutter: totals bar, sidebar room, Help + Sync moved

Several UI moves to give the project list more room and tidy the chrome:
- The live totals bar (Installed / Ordered / Turf LF / Edging / Rock / Sand / Scrap) now
  sits ABOVE the tab row instead of below it.
- Shrank the sidebar Waterloo Turf logo (160→90px) and tightened its padding, so the
  project list (flex:1) gets noticeably more vertical space.
- Moved "How to Use This Tool" out of the sidebar to a compact "? Help" button at the
  right end of the always-visible tab row.
- Moved the "⇄ Sync / Backup" dropdown out of the sidebar into a "Backup & Sync" card at
  the top of the ⚙ Settings tab (Export Selected/All, Import Merge/Replace, Auto-backups,
  Reset). "Export Selected" still reads the sidebar checkboxes. In-app docs updated to the
  new location.

Net effect: the sidebar bottom is just New/Delete Project, so more projects show at once.

Tests **1655 → 1656** (README **1656**): updated the layout assertion — the metrics bar is
its own bar (not nested in the tab row) and now sits above the tabs.

---

## 2026-07-22 (cont'd 44) — Auto-backup: on/off toggle + configurable interval

The Auto-Backups dialog (Sync menu → ↻ Auto-backups) now has a "back up while I work"
toggle and an interval picker (1, 5, 10, 15, 30 min, or 1 hour). The interval was hardcoded
at 5 minutes and couldn't be turned off. maybeAutoBackup() now reads the saved config and
skips entirely when disabled, or throttles to the chosen interval (Electron disk path and
browser localStorage path both honor it). Still keeps the last 8 snapshots.

Config stored in localStorage (`wt_autobackup_config_v1`); pure `normalizeAutoBackupConfig`
defaults to enabled/5-min and clamps the interval to 1..1440 minutes so a bad value can't
break throttling. A custom saved interval outside the presets is preserved in the dropdown.

Tests **1643 → 1655** (README **1655**): defaults, clamping (0/negative/huge/non-numeric),
enabled:false honored, round-trip + derived ms, and maybeAutoBackup writes when enabled,
skips when disabled, and throttles within the interval.

---

## 2026-07-22 (cont'd 43) — Project search

Added a search box at the top of the project sidebar. Type to filter the list live; matches
(case-insensitive) on project name, job address, and status label (won / lost / pending
quote). Multiple words are AND-matched, so "smith won" finds Smith jobs marked won. A ✕
clears it, and an empty search shows everything. Sort still applies on top of the filtered
set, and "All" now selects just the visible (filtered) projects rather than the whole
hidden list.

Pure `filterProjects(projects, query)` does the matching; renderSidebar applies the current
query.

Tests **1631 → 1643** (README **1643**): matches on name/address/status, case-insensitive,
multi-term AND, empty/whitespace → all, no-match → empty, non-mutating, and safe on
null/nameless input.

---

## 2026-07-22 (cont'd 42) — Backed out Send to Jobber

Removed the Send-to-Jobber feature added in cont'd 41 — the real backend (OAuth broker,
token refresh, GraphiQL field verification, ongoing hosting) is more than it's worth for
now. Reverted cleanly: the 🧾 Send to Jobber button, the Settings card, all JS
(getJobberConfig/setJobberConfig/buildJobberQuotePayload + the send/search/connect UI),
the localStorage config, tests (section 130), and the companion jobber-worker.js /
SETUP_JOBBER.md files. `applyMargin` and everything else untouched. Building a Jobber quote
stays manual from the quote totals, as before.

Tests **1645 → 1631** (README **1631**): back to the pre-Jobber count; all green under UTC
and America/Los_Angeles.

---

## 2026-07-22 (cont'd 41) — Send to Jobber (finished lump-sum quote via a small backend)

New 🧾 Send to Jobber button (Quote Builder) + Settings → Send to Jobber card. Pushes the
current quote into Jobber as a single lump-sum line ("Artificial Turf Installation") at
your quoted price, attached to an existing Jobber client you search & pick. The quote lands
as a draft for you to review and send in Jobber.

Architecture: the calculator stays Jobber-agnostic. Pure `buildJobberQuotePayload(proj,
opts)` builds a neutral payload (dollars, one line, the picked client id) and POSTs it to a
small Cloudflare Worker (delivered separately: jobber-worker.js + SETUP_JOBBER.md) that
holds the OAuth client secret — which cannot live in a single-file browser app — completes
the one-time Jobber connect, auto-refreshes the hourly token, searches clients, and runs
the GraphQL quoteCreate. Config (backend URL + shared secret) stored in localStorage
(`wt_jobber_v1`); the send flow is a modal with total confirm + client search.

Constraints (documented in the guide): the live Jobber calls could not be tested in this
environment, so three field details (money dollars-vs-cents, the quoteCreate input shape,
the client-search arg) are marked to verify once in Jobber's GraphiQL — each is a one-line
switch in the Worker. This is opt-in; leave the settings blank and nothing changes.

Tests **1631 → 1645** (README **1645**): payload requires a client and positive total,
emits exactly one lump-sum line at the sell price in dollars, applies title/description/
message/total overrides, rounds money robustly (0.1+0.2 → 0.30), and the config
round-trips. (The fetch/OAuth paths live in the Worker and are verified on-device.)

---

## 2026-07-22 (cont'd 40) — Tiered pricing display: readable mini-table (was cramped/wrapping)

The Settings labor-rates Rate column was capped at 120px, so a tiered rate's sqft ranges
wrapped 2-3 lines each ("0-359" split, "901- 1,500 sqft" on three lines) — hard to scan.
Widened the Rate column to 270px (Service 35%→28%, Unit fixed 70px to make room) and
redesigned each tiered line as a bordered mini-table: one row per bracket, range (nowrap)
on the left in muted text, bold rate on the right, alternating zebra striping. Verified the
rendered output on the exact screenshot's 9-tier item.

Purely presentational — getTierRanges and the pricing math are unchanged.

Tests **1624 → 1631** (README **1631**): the Rate column is >=240px, tier rows render in a
bordered striped mini-table, and getTierRanges still yields correct explicit brackets.

---

## 2026-07-22 (cont'd 39) — Dashboard honesty: quotes vs won jobs (status + close rate)

The Dashboard treated every saved project as a completed job, so "revenue" counted quotes
that were never landed — misleading. Added a per-project Status (Quote/pending · Won ·
Lost), set from a dropdown in the Quote Builder top bar (`proj.status`, default pending;
existing projects read as pending).

`computeJobStats` is now status-aware. It splits the view into:
- Pipeline (all quotes): quote count, open/won/lost tally, a close rate (won ÷ (won +
  lost)), and open pipeline value (sum of pending quotes' prices).
- Booked (WON jobs only): revenue, turf installed, job sizes, product mix, and the monthly
  timeline — none of which count pending or lost quotes anymore.

renderDashboard shows the two sections separately and prompts you to mark jobs Won once you
land them. Booked revenue/turf are "—" until something is Won.

Tests **1622 → 1624** (README **1624**): won/lost/pending tally (no-status → pending),
close rate = won ÷ decided (null when nothing's decided), booked revenue/sqft/products/
timeline count won jobs only, lost/pending excluded, pipeline sums pending quotes, and
getProjectStatus normalizes junk to pending.

---

## 2026-07-22 (cont'd 38) — Fix: estimator tabs didn't refresh on project switch (paver settings LOOKED global)

Paver settings were already stored per project (`proj.pavers`), and mulch/river rock too
(`proj.mulch` / `proj.riverRock`) — the data was never global. But `loadProject` only
refreshed the Quote and Layout tabs, so switching projects while viewing Pavers / Bark /
River Rock left the PREVIOUS project's numbers on screen until you clicked away and back.
That stale display is what made the settings look global.

`loadProject` now re-renders whichever estimator tab (Pavers, Bark/Mulch, River Rock, or
Dashboard) is currently active, so its fields immediately reflect the project you switched
to. No data-model change — the per-project storage was already correct.

Tests **1616 → 1622** (README **1622**): two projects keep independent paver settings, a
fresh project gets defaults (not another project's values), river-rock config is
per-project, and loadProject re-renders the active estimator tab.

---

## 2026-07-22 (cont'd 37) — Layout totals moved to their own header bar (below the tabs)

The live totals (Installed, Ordered, Turf LF, Edging, Rock, Sand, Scrap) used to sit on the
SAME row as the page tabs, anchored to the right of Settings — so on anything but a very
wide window they ran off the side and scrolled within a cramped strip. Moved `#topMetrics`
out of the tab row into its own full-width bar directly below the tabs: bigger, evenly
spaced values on a light background, easy to scan, and no longer competing with the tabs
for horizontal room. On a narrow window the whole bar scrolls sideways rather than clipping
a cell. No logic change — the same ids are populated by the same render code.

Tests **1615 → 1616** (README **1616**): the metrics bar is now a sibling AFTER the tab row
(not a child), has its own bottom border, and still scrolls when tight.

---

## 2026-07-22 (cont'd 36) — River Rock: pick a size to auto-fill supplier coverage

The River Rock tab now has a Rock size dropdown. Picking a size fills the Coverage field
with that size's coverage, so you don't retype it per job. Sizes are a small catalog you
maintain (an inline "Manage sizes & coverage" editor): each row is a size name + its
coverage (ft² one cubic yard covers per inch), entered from your supplier. Two defaults
ship — a 1.5" and a larger 3-5" — both at geometric 324 until you set your supplier's real
numbers (nothing invented). The Coverage field stays editable for one-off overrides, and
the free-text field is now "Type / notes". Mulch is unchanged.

Since coverage drives the volume math (cubic yards = area × depth ÷ coverage), a
lower-coverage (bigger, more-voids) rock automatically orders more. Catalog stored in
localStorage (`wt_rockSizes_v1`); the selected size persists on `proj.riverRock.typeName`.
Pure `getRockSizes`/`coverageForRockSize`.

Tests **1607 → 1615** (README **1615**): defaults ship at 324, coverage round-trips per
size, unknown/empty → null, and a lower-coverage size needs more cubic yards.

---

## 2026-07-22 (cont'd 35) — Removed the Proposal & Share Link features (Jobber handles customer-facing docs)

Removed both customer-facing features and all their code, per how the business actually
works (Jobber is used for proposals/quotes to customers):

- Buttons: 📄 Proposal and 🔗 Share Link (Quote Builder).
- Functions: openProposal, shareProject, maybeRenderSharedProposal, renderSharedProposal,
  buildProposalModel, buildSharePayload, the base64url byte helpers, encodeShareString,
  decodeShareString, renderCleanDiagram, roleLabel, and the Business Info helpers
  (getBusinessInfo/setBusinessInfo/saveBusinessInfoFromUI/populateBusinessInfoUI).
- Settings → Business Info card, and the #share= link detection in window.onload.
- Tests: sections 124 (proposal model), 125 (proposal polish), 126 (shareable link), and
  the now-unused TextEncoder/TextDecoder test-sandbox globals.

Preserved: `calcQuote` still records the recommended scenario's sell price on
`proj.quotedPrice` (decoupled from the deleted proposal stash) so the Job History
Dashboard keeps summing revenue. Supplier Order and Installer Sheet exports are untouched.

Tests **1640 → 1607** (README **1607**): the drop is the removed proposal/share asserts;
all remaining tests pass under UTC and America/Los_Angeles, and the Dashboard revenue tests
still pass on the preserved quotedPrice path.

---

## 2026-07-22 (cont'd 34) — Fix: Dashboard mis-filed month-boundary jobs west of UTC (timezone bug)

`computeJobStats` bucketed the monthly timeline by `new Date(installDate)` then read
`.getMonth()` in local time. An install date is a date-only string ('YYYY-MM-DD') that
`Date` parses as UTC midnight, so for users west of UTC (e.g. Pacific) a job dated the 1st
shifted to the previous day — and into the previous MONTH — on the dashboard. This also
failed two dashboard tests on a Pacific machine while passing on a UTC box.

New `monthKeyOf(val)` reads the year-month straight from a date-only string (no Date
parsing → no shift) and falls back to local calendar components for a numeric timestamp
(`created`). The timeline now buckets by the calendar date shown, in every timezone.

Tests **1635 → 1640** (README **1640**): monthKeyOf reads the literal year-month, handles
year-end and blank/null, and a 2026-06-01 job buckets into 2026-06. Verified the whole
suite passes under UTC, America/Los_Angeles, Asia/Tokyo, and Australia/Sydney.

---

## 2026-07-22 (cont'd 33) — Fix: test suite could fail Sync & Push on a newer Node (async codec test)

The share-codec test added in cont'd 30 ran an un-awaited `(async () => { ... })()` block.
On Node builds where `CompressionStream`/`Response` are ambient globals, the sandbox could
take the gzip path and reject the promise, producing an UNHANDLED rejection that exits
`node` non-zero — so `Sync and Push.command` aborted even though the printed count read
"Failed: 0". (It happened to exit 0 on the dev box, hiding the problem.)

Replaced the async block with a deterministic SYNCHRONOUS roundtrip that forces the raw
(non-gzip) path via the already-tested byte base64url, and made the runner source
TextEncoder/TextDecoder from `util` so the suite behaves identically on every Node version
(no reliance on globals leaking into the vm). No app code changed — this is a test-suite
robustness fix.

Tests **1632 → 1635** (README **1635**): the 3 codec-roundtrip asserts are now counted
(they weren't before, being fire-and-forget). Runner exits 0 deterministically.

---

## 2026-07-22 (cont'd 32) — One-click global waste minimizer — list item #4

New ✨ Minimize waste (all layers) button on the Layout toolbar. It runs the roll-direction
sweep (all 180° × 8 seam offsets) on the primary shape AND every install layer at once,
applies each layer's lowest-ordered-footage direction, and shows a toast with the
before/after ordered sqft and how many layers changed.

Refactored the sweep into a pure `bestRollForPoints(pts, opts)` shared by the existing
per-layer "Auto" button and the new global pass (`optimizeAllLayers`), so they can't drift.
optimizeAllLayers returns { beforeOrdered, afterOrdered, changed } and skips deselected /
non-install layers.

Known limitation: each layer is optimized independently for lowest ordered footage. For
layers that SHARE physical rolls (Share roll-group), the true global optimum can differ
slightly because cross-layer nesting interacts; for separate rolls it's exact.

Tests **1625 → 1632** (README **1632**): the sweep is no worse than either fixed
orientation, beats the worse one when a real saving exists, returns an angle within a half
turn, handles <3 points / null → null, and a square is no worse than axis-aligned.

---

## 2026-07-22 (cont'd 31) — Job History Dashboard — list item #3

New Dashboard tab that mines the projects already in localStorage — no new data entry.
Shows total jobs, total turf sold (with average/median/largest/smallest job size), a
revenue summary, a most-used-turf-products bar list, and a by-month timeline of jobs and
turf area. Pure `computeJobStats(projects, priceOf?)` does the aggregation.

Revenue is summed only for jobs that have a known price. calcQuote now records the
recommended sell price on the project (`proj.quotedPrice`) so revenue populates as you
open quotes; a custom price accessor is also supported. Alt-turf rows are excluded from
sqft and product mix everywhere, matching the rest of the app.

Tests **1613 → 1625** (README **1625**): counts, total/avg/median/largest sqft, revenue
only from priced jobs, product ranking with alt-turf excluded, monthly aggregation keyed
by install date (else created), empty-portfolio zeros, and a custom price accessor.

Note: hit the recurring str_replace dropped-header bug (the edit that added renderDashboard
ate renderPaverTab's header); caught by the parse check + a grep for both function
definitions, and re-added.

---

## 2026-07-22 (cont'd 30) — Shareable no-backend proposal link — list item #2

New 🔗 Share Link button (Quote Builder). It serializes a CUSTOMER-SAFE slice of the job
into the URL hash and copies the link: anyone can open it in a browser — no login, no
server. Opening a `#share=` link renders a full-page, read-only proposal (business header,
job/site/date, a clean site diagram redrawn from the shared geometry, the Scope &
Materials table, and the total), with an option dropdown when the job has more than one
scenario.

Customer-safe by construction: the payload carries the proposal materials, the layout
geometry (rounded points, for redrawing the diagram), and the SELL prices per scenario —
never COGS, margin, the catalog, or crews. `buildSharePayload` builds it; the link is
gzipped via the browser's CompressionStream (with a plain-text fallback) and encoded with
a pure, URL-safe base64url (no +, /, =). `maybeRenderSharedProposal` runs first thing on
load and, on a share link, renders the proposal and skips the app entirely.

Tests **1604 → 1613** (README **1613**): base64url is URL-safe and byte-exact (incl. odd
lengths and high bytes); the payload leaks no cost/margin/catalog/crew data; options carry
sell prices; alt-turf excluded; points rounded; and the encode→decode roundtrip
reconstructs the payload and layout. (Test sandbox now provides TextEncoder/Uint8Array so
the codec path runs headlessly.)

---

## 2026-07-22 (cont'd 29) — Proposal polish: clean site diagram + pick which scenario to quote

Two follow-ups on the proposal.

1. CLEAN diagram. The proposal previously snapshotted the canvas as-is — roll rectangles,
   waste hatch, and piece/edge dimensions included, which look technical to a customer.
   New `renderCleanDiagram()` temporarily switches those three toggles off, redraws,
   snapshots, then restores every toggle to exactly what the user had — so the customer
   sees the yard and its shapes, not the cutting plan, and the on-screen view is unchanged.

2. Scenario picker. calcQuote now stashes EVERY scenario (label + COGS), not just the
   first. When a job has more than one option, the proposal window shows an "Option shown
   to customer" dropdown that switches the Total Investment between scenarios instantly
   (each option carries its own sell price; no reopen). A single-option job shows no
   picker and behaves as before.

Tests **1594 → 1604** (README **1604**): the clean diagram turns the roll toggles off at
snapshot time and restores them, redrawing twice; per-scenario price = each scenario's
COGS with margin; and openProposal wires the clean diagram, the >1-scenario picker, and
the updatable total.

---

## 2026-07-22 (cont'd 28) — Branded customer Proposal (print / Save-as-PDF) — list item #1

A one-click customer-facing proposal (Quote Builder → 📄 Proposal). Opens a clean, branded
one-pager in a new window with your business header, the job/site/date, the SITE DIAGRAM
pasted from the layout canvas, a Scope & Materials table (turf by product + installed sqft,
infill, edging, misc — alt-turf excluded), and the total investment. Print or Save as PDF
from there. No backend — the diagram is a PNG from the canvas.

The price is the SELL price (COGS with your margin), never the raw cost — pulled from the
recommended (first) quote scenario's COGS, which calcQuote now stashes. Business identity
(name, tagline, phone, email, license) lives in a new Settings → Business Info card,
stored globally, defaulting to "Waterloo Turf".

Pure `buildProposalModel(proj, marginPct, business, cogs)` assembles the model (used by the
tests); `openProposal()` renders/opens the window.

Tests **1583 → 1594** (README **1594**): price = COGS with margin; alt-turf excluded;
base+green listed; totals; zero-qty rows dropped; multi-line address flattened; business
info defaults + round-trip; role labels.

---

## 2026-07-22 (cont'd 27) — New Bark/Mulch & River Rock tabs (ground-cover estimators)

Two new standalone tabs, same shell as Pavers, sharing one pure `computeGroundCoverPlan`.
Each takes the Moasure area (or manual), a depth in inches, a Type (a name plus a coverage
value), an install rate per sq ft, and an optional material cost per cubic yard.

Both materials are ordered by the cubic yard. Coverage is modelled the way landscaping
coverage charts work: square feet one cubic yard covers per inch of depth — geometric fill
is 324 (27 ft³ × 12 in), and lowering it accounts for materials that settle/pack so you
need more. Cubic yards = (area × depth) ÷ coverage, rounded UP to the next half yard;
install = area × rate; material = ordered yards × $/yd; total = both. Result card shows
yards to order (exact + rounded), the job total broken into install/material, and the
area/depth/coverage/volume. Settings persist per project (`proj.mulch`, `proj.riverRock`).
Standalone estimators — they don't change the turf quote or COGS.

Tests **1568 → 1583** (README **1583**): geometric coverage matches area×depth/12/27;
lower coverage needs more; install/material/total; half-yard round-up; missing inputs →
not ok; per-material default depths; and Moasure vs manual area.

---

## 2026-07-22 (cont'd 26) — New Pavers tab: how many pavers to order

Added a standalone Pavers tab. It estimates how many pavers to order for an area: it uses
the imported Moasure area by default (toggle off to enter an area by hand), plus paver
length, width, and joint spacing (all in inches), and an overage %.

Math (pure `computePaverPlan`): each paver tiles with a joint on two sides, so one paver
occupies a grid cell of (length + spacing) × (width + spacing); pavers = area ÷ cell; the
overage % is added for cuts/breakage/pattern loss and the total rounds UP to whole pavers.
The result card shows pavers to order (with the overage broken out), the cell size, a
bare-fit count, and the face coverage of the order as a cross-check. Paver settings persist
per project (`proj.pavers`). The tab is a standalone estimator — it does not change the turf
quote or COGS.

Tests **1553 → 1568** (README **1568**): jointless 12×12 over 100 ft² = 100 pavers; a joint
enlarges the cell and needs fewer; overage adds and rounds up; fractional need rounds up;
rectangular pavers; missing inputs → not ok / 0; config defaults; and useMoasure vs manual
area source.

---

## 2026-07-22 (cont'd 25) — Fix: over-length strip still shown as ONE row in the piece list (rendering half of the last fix)

The previous fix corrected the roll LABELS (an over-length strip is split across rolls in
the label map), but the piece-list RENDERER still drew the strip as a single row using its
full ordered length — so a 102 ft strip on a 100 ft roll still showed as one "Roll 1 /
Piece 1 — 102.0 ft" row. The label map knew it spanned two rolls; the row builder ignored
that.

`pieceRow` → `pieceRows` now emits ONE ROW PER SEGMENT when a strip spans multiple rolls
(rp.extraParts): each row gets its own roll-length segment and roll label, with a note that
it's part of a longer run split across rolls. So a 102 ft run shows as "Roll 1 / Piece 1 —
100 ft" and "Roll 2 / Piece 1 — 2 ft"; no row ever exceeds the roll length. The nested and
butt-seam paths are unchanged.

Tests **1549 → 1553** (README **1553**): the 102 ft strip produces ≥2 rows, no row exceeds
100 ft, the rows sum to 102, and the segments land on separate rolls.

---

## 2026-07-22 (cont'd 24) — Fix: piece list showed a single piece longer than the roll (over-length rolls)

The Piece List could show a roll whose pieces summed to more than the Max Roll Length —
e.g. a 120 ft piece on a 100 ft roll. Cause: `assignRollPieceLabels` (which numbers the
Roll N / Piece M labels) packed each strip WHOLE, while `layoutUnitLengths` (which counts
rolls and footage) first SEGMENTS an over-length strip into roll-length pieces. So a strip
running 120 ft got counted as 100+20 across two rolls for the roll count, but LABELLED as
one 120 ft piece on one roll in the list — an impossible cut.

`assignRollPieceLabels` now segments a multi-segment strip (numSegments>1) into
roll-length pieces before packing, exactly like the counter does, and records the extra
roll each segment lands on. So an over-length run shows as (e.g.) a 100 ft piece on Roll 1
and a 20 ft piece on Roll 2, and no roll in the list ever exceeds the roll length.

Tests **1544 → 1549** (README **1549**): for a shape whose strips run 120 ft on a 100 ft
roll, every roll in the labels sums ≤ 100 ft and the over-length strip is split across
two rolls.

---

## 2026-07-22 (cont'd 23) — Fringe pieces drawn at full width (they honored the width, but LOOKED short at corners)

Follow-up to the fringe split. Every fringe piece already honored the fringe width in
the CUT data — each is ordered as length × fringe-width, and the ordered length uses the
outer (longer) mitered edge so the rectangle fully covers the piece. But on the canvas
the pieces were drawn as the mitered trapezoid `[p0,p1,p2,p3]`, whose slanted ends made
corner pieces look shallower than the fringe width even though the cut is full depth.

The canvas now draws each fringe piece as its full-width cut rectangle (the inner edge
extended outward by the fringe width along the outward normal), so what you see matches
what gets cut. Pieces may now visibly overlap slightly at corners — that's honest: each
piece really is cut full-width and the miter is trimmed on site.

Added a guard test: for several green shapes and widths, EVERY piece's cut width equals
the fringe setting and totalSqFt = sum(length × fringe width).

Tests **1531 → 1544** (README **1544**).

---

## 2026-07-22 (cont'd 22) — Fringe: blades face the green, pieces capped at the roll width

Two fringe-cutting rules. All fringe blades must face IN toward the green, so the grain
runs radially (across the fringe depth). Because of that orientation, each piece's length
(the run along the green's edge) lies across the roll's WIDTH — so no fringe piece can be
longer than the roll is wide. `computeFringePlan` now takes the roll width (default 15 ft,
follows the layout's roll width minus side trim) and splits any piece longer than that
into equal segments that each fit, walking both the inner (true boundary) and outer
(mitered) edges so the sub-pieces still tile the ring exactly.

Total sqft to order is preserved — splitting a run into roll-width pieces doesn't change
its length × width — so pricing is essentially unchanged; there are just more, shorter
pieces (more seams). A narrower roll produces more pieces. The plan now reports
`bladeDirection: 'radial-inward'` and `maxPieceLength`.

Updated the fringe tests that assumed 4 pieces for a 20×10 green — its 24 ft mitered
sides now split at 15 ft (6 pieces: 12,12,12,12,14,14); totalSqFt stays 152.

Tests **1509 → 1531** (README **1531**): no piece exceeds the roll width, long sides
split (40×30 → 14 pieces) while small greens keep one piece per side, splitting
preserves total sqft, and a narrower roll splits more.

---

## 2026-07-22 (cont'd 21) — Disabled buttons now look disabled (⬒ Make Layer wasn't visibly greyed)

There was no CSS for the disabled button state, so buttons that get set `disabled` —
notably ⬒ Make Layer, which is disabled until a closed shape is selected — still looked
fully active. That made the "select a shape first, then click" flow non-obvious (it read
as a dead button). Added a `.btn:disabled / .btn[disabled]` rule: 0.4 opacity,
not-allowed cursor, no hover. Now Make Layer (and Delete/Copy/Paste) visibly grey out
until there's a valid selection, then light up. No behavior change — the buttons were
already correctly unclickable; they just didn't show it.

Tests **1504 → 1509** (README **1509**): the disabled rule exists and dims + blocks the
button, and Make Layer ships disabled by default.

---

## 2026-07-22 (cont'd 20) — Crew daily-minimum labor floor (small-job pay minimum)

Some crews must be paid a minimum for the day even when a small job's per-sqft labor
comes out below it. Added a **Daily Minimum (labor floor)** rate item per crew: when the
scenario's install labor (turf install + edging) is below the crew's daily minimum, the
quote adds the shortfall as a **Daily minimum adjustment** line so the crew earns its
minimum. Big jobs clear the floor on their own and are unaffected; materials (turf,
infill) are not part of the floor.

- Flat single-day amount — it does not scale with job size (per your call: small jobs
  are one day, so a flat floor is the right model).
- Per crew, blank = no floor — only the crews you set an amount for use it.
- Existing crews are migrated to include the item (blank) on load, so nobody loses their
  rates; new crews get it by default. The item is per-day (no per-sqft tiers).

Pure `applyDailyMinimum(laborSubtotal, dailyMin)` → `{labor, floored, shortfall}` and
`getCrewDailyMinimum()` read the active crew's rate; `ensureCrewItems` does the
idempotent migration.

Tests **1493 → 1504** (README **1504**): the floor lifts a short labor total and leaves
a sufficient one alone, ignores 0/NaN, doesn't scale, and the migration adds exactly one
item and is idempotent.

---

## 2026-07-22 (cont'd 19) — Putting green: its own roll-direction controls + roll rectangle on canvas

Now that the green rolls as its own layer, two pieces of the roll UI still treated it as
a non-rolled cutout:

- **Roll direction / seam controls.** The Layers-list card that carries Roll dir +
  Horizontal / Vertical / Auto + Seam offset was gated to `mode === 'install'`. The
  putting-green layer now gets the same card, so you can rotate the green's roll to
  minimize waste (Auto picks the best angle). It flows through `getLayerRoll` →
  `computeInstallLayerLayouts` exactly like an install layer — verified a 20×8 green
  drops from 300 ft² ordered at 0° to 240 at 90°.

- **Roll rectangle on canvas.** The canvas draw branch for a putting green only drew the
  green fill + fringe, never its roll plan. It now draws the green's installed strips
  and — when "Show purchased roll rectangles" is on — the purchased rectangle + waste
  hatch, just like a base/install shape, with the green fill and fringe on top.

Tests **1486 → 1493** (README **1493**): the PG layer gets roll-direction controls; the
draw branch renders its strips + purchased rectangle; rotating the green roll changes
its order/waste; and the green layer honors its own roll direction via `layerRoll`.

---

## 2026-07-22 (cont'd 18) — Fix: the wall thickness handle was invisible on freehand-drawn walls

The tooltip promised a draggable thickness handle on a selected wall, but it usually
didn't appear. Cause: `wallThicknessHandle` anchored to the wall's FIRST segment — and a
freehand-drawn wall starts with a degenerate first segment (the mousedown point and the
first drag point land on nearly the same spot), so the segment length was ~0 and the
function returned null. No handle.

The handle now anchors to the MIDDLE of the wall (the point halfway along its total
length, skipping zero-length segments), which is always a real, grabbable spot. It's
also offset far enough off the centerline to clear the wall body on thin walls, drawn
larger (radius 7) with a white ring and a dashed leader line so it's easy to spot, and
its hit target already uses the handle tolerance.

Tests **1484 → 1486** (README **1486**): the handle sits at the wall's middle and is
offset clear of the line; and a freehand wall with a degenerate first segment still
returns a handle (previously null).

---

## 2026-07-22 (cont'd 17) — Draw toolbar: label Color/Width/Fill as "Shape style" (they read as landscape controls)

The Color, Width, and Fill controls sit right after the Landscape buttons, so they
looked like they configured the landscape elements — but they apply to the basic shapes
(Line, Rectangle, Circle, Freehand), and landscape elements have their own built-in look
and ignore them. Grouped them under a "Shape style:" label with tooltips: Color/Width/
Fill explain they're for drawn shapes, the Width tooltip clarifies it's pixels and NOT
the retaining-wall thickness (which is the separate "Wall in" inches box), and the
help text under the toolbar says the same. No behavior change.

Tests **1481 → 1484** (README **1484**): the "Shape style" label exists, explains
landscape elements ignore it, and the Width control disambiguates from wall thickness.

---

## 2026-07-22 (cont'd 16) — Top bar breaks out base vs putting green; "Linear ft" → "Turf LF"

On a base + putting green job the top bar now shows both numbers for Installed, Ordered,
and Turf LF as "base · green" (e.g. Installed 82 · 92 ft², Ordered 285 · 150 ft², Turf
LF 19 · 10 ft), with a tooltip spelling out which is which. A base-only job is unchanged
(single figure). The "Linear ft" label is renamed "Turf LF".

Backed by pure `splitTurfTotals(layout)` → `{base, green}`: base = adjusted primary
(outline minus green) + any non-green install layers; green = the putting-green layer(s).
Returns null with no green layer so the cells fall back to the single combined value.

Tests **1468 → 1481** (README **1481**): base/green split for installed/ordered/linear;
a side-yard install layer counts toward base not green; null when there's no green; the
cell formatter; and the "Turf LF" label rename.

---

## 2026-07-22 (cont'd 15) — ROOT CAUSE: new projects never designated the green SHAPE — now set at creation

The reason base-minus-green kept coming out wrong across a fresh import: `createProject`
attached the CSV's secondary shapes but set **no `secondaryShapeModes`** — so every
imported shape, including the green, defaulted to `'ignore'`. Marking a turf PRODUCT as
Putting Green in the dialog (which already existed) never linked to the green SHAPE, so
`getPuttingGreenShapeArea` returned 0 and the base subtracted nothing. Every later fix
was downstream of a green that was never designated in the first place.

The New Project dialog now shows a **"Which imported shape is the putting green?"**
selector whenever a turf is marked Putting Green and the CSV has secondary shapes. It
lists each measured shape by name and area and defaults to the largest (a stray
mis-measure is usually smaller). On create, the picked shape is set to `putting-green`
mode — so the base yard computes as outline-minus-green, and the green rolls on its own,
from the very first render. No fragile post-creation designation step.

Tests **1461 → 1468** (README **1468**): createProject sets secondaryShapeModes from
the selector and designates the picked shape as putting-green; the selector refresh and
control exist; and once designated, base = outline − green (82.37) and green = 91.52.

---

## 2026-07-22 (cont'd 14) — Designating the green now updates the base row immediately; live link syncs base + PG rows

Matches the real workflow: import → create → designate which shape is the putting green.
Two gaps were leaving the base row stale after that last step.

1. `setSecondaryShapeMode` recomputed the layout but never re-synced the turf rows, so
   the base row kept its pre-designation area (the full outline) until some later slider
   nudge. It now calls `syncLinkedTurfRow` right after a mode change, so setting the
   green immediately recomputes the base row to outline-minus-green (and its infill).

2. The live link only synced a manually-picked target row (plus PG rows). The workflow
   doesn't involve picking a target, so the base row was never touched. The link now
   syncs the picked target plus **every base and putting-green row** by role — base
   draws the base plan, PG draws the green plan — so no target pick is needed.

Traced a COGS shift this surfaced rather than just re-baselining it: with the link now
syncing orders, the fringe-fixture's base row orders the real full-outline roll plan
(2,250 ft² after waste, not the hand-set 1,800) and the PG row its own plan (300 ft²).
Base turf material rises to 2250×$2.50; the numbers are correct — the old fixture used
orders inconsistent with its own layout.

Tests **1457 → 1461** (README **1461**): after designating the green, base row =
outline−green (82.43) and PG row = green (91.52), and base+green tile the outline; plus
a guard that setSecondaryShapeMode re-syncs the rows.

---

## 2026-07-22 (cont'd 13) — Fix: green-as-layer inflated the base row's Installed back to the full outline

Regression from step 1. Once the green rolled as its own install layer, `_combined.area`
included it — and the base row's Installed formula (`combo.area − shapeArea + adj`) added
every install layer, so it added the green back. The base row showed the FULL outline
(173.95) instead of outline−green (82.43), and base infill followed it (medium sand
sized to 173.95, not 82.43).

`computeApplyAreaForRow` for a base/alt row now subtracts any putting-green layers'
area from that combined expression: base = adjusted primary + other install layers −
green layers. A detached side-yard install layer is still added (unchanged); only the
green is excluded (it belongs on the PG row).

Verified on the reference job: base row Installed 82.43, base (medium sand) infill 82.43,
PG row 91.52, PG (putting sand) infill 91.52. The top-bar Installed metric already netted
correctly to the outline (total turf 82+92); it was the base ROW that was wrong.

Tests **1454 → 1457** (README **1457**): base row = outline−green with the green as a
layer; a non-green side yard is still summed; and a base + side yard + green job gives
adjusted primary + side yard, green excluded.

---

## 2026-07-22 (cont'd 12) — Base scrap measured against the rolled outline (base/PG split, step 3)

Final step of the base/PG roll split. The single-layer scrap line computed
`scrap = totalOrdered − adjustedArea`, where adjustedArea is the base outline MINUS the
green. Since the base rolls the full outline and cuts the green out on site, that
counted the intentionally-cut green footprint as roll waste — inflating the scrap % (the
71% in the screenshot).

Scrap now measures against `layout.shapeArea` (the rolled outline), so it reflects
actual roll waste. For the reference job the base drops from ~71% to ~40%. The green's
own roll waste is accounted for in its own layer, and the combined (multi-layer) scrap
path was already correct — it sums each layer's `ordered − its own rolled area`.

That completes the base/PG roll split: the green rolls as its own layer (step 1), each
row draws its order from its own plan (step 2), and scrap reflects real roll waste
(step 3). End-to-end on the reference job (outline 174, green 92): base Installed 82 /
Order 300, PG Installed 92 / Order 150, 2 rolls / 3 pieces, scrap ~41%, and Results
lists "Primary Shape" and "Putting Green" separately.

Tests **1448 → 1454** (README **1454**): scrap subtracts the rolled outline not the
green-subtracted area; the base waste % is a sane ~40% not ~70%; and the combined
scrap equals ordered − total rolled area.

---

## 2026-07-22 (cont'd 11) — Each turf row draws its order from its own roll plan (base/PG split, step 2)

Step 2 of the base/PG roll split. With the green now rolled as its own layer (step 1),
the order routing was still applying one combined figure to one selected row — which is
why the screenshot showed the base row's SqFt to Order at 0 with the whole order dumped
on the PG row.

New pure `orderedFromLayoutForRole(layout, role)` sums the roll plan's per-layer order
by role: a base/alt row draws from the base primary (+ any non-green install layers); a
putting-green row draws only from the green layer. Both the **live link** and the
**Apply Ordered SqFt** button now use it:

- Live link syncs the selected target row (as before) **plus every putting-green row**,
  so the green's order always lands on the PG row without pointing the link at it. Base
  order → base row, green order → PG row.
- Apply Ordered applies the picked row's own-role order, so applying to the base row no
  longer pulls in the green's footage.

A single-layer job (no green) is unchanged: the base row gets the whole plan and a PG
row gets null (left untouched, not zeroed).

Caught a latent PG turf-material error while updating the fringe-COGS test: the test
assumed the green's order was `ceil(area/15)*15`, but the green in that fixture is 20 ft
wide against a 15 ft roll — it can't be covered by one strip, so the real roll plan
orders 300 ft², not 210. Now that the PG row draws from the green's actual roll plan,
its turf material is correct (300 × $3.50), where before it was under-ordered.

Still to come: step 3 — the base scrap %, still measured against the green-subtracted
area (inflating it) rather than the rolled outline.

Tests **1438 → 1448** (README **1448**): base row ← base plan, PG row ← green plan,
base sums multiple non-green layers, single-layer PG → null, and the live-link wiring
routes every PG row.

---

## 2026-07-22 (cont'd 10) — Putting green now rolls as its own layer (base/PG roll split, step 1)

First step of giving a base + green job two independent roll plans. The green was a
cutout — subtracted from the base but never rolled, so Results showed one combined plan
and the green had no rolls/pieces of its own.

`computeInstallLayerLayouts` now rolls the `putting-green` layer too (not just
`install` layers): its own roll plan, labeled "Putting Green", cut from its **own**
rolls (it's a different product from the base, so it never pools rolls with base turf).
The base still rolls the **full outline** (green filled in, cut to fit on site) — that
part was already correct; the green is simply rolled alongside it.

Verified there's no area double-count: the green is subtracted from the base's Installed
figure and rolled back as its own layer, and the Installed metric nets it out — for the
reference job base install stays ~82, and total Installed = ~174 (82 base + 92 green),
not 266. Base and green now produce separate rolls/pieces, which the per-layer Results
breakdown renders by layer name automatically.

Still to come (next steps): route each turf row's order to its own plan (base row ←
base rolls, PG row ← green rolls), and fix the base scrap % (currently measured against
the green-subtracted area, inflating it).

Tests **1429 → 1438** (README **1438**): the green rolls as a second layer tagged
isPuttingGreen, on its own rolls; the base still rolls the full ~174 outline; and the
Installed metric nets to ~174 rather than double-counting to 266.

---

## 2026-07-22 (cont'd 9) — Apply Area is role-aware: the PG row gets the green's area, not the base's

The Putting Green turf row was showing ~82.4 ft² (the base yard's outline-minus-green
figure) instead of the green's own 91.52 — its Installed SqFt and infill were both
wrong. Cause: `computeApplyAreaForRow` was role-blind — it returned the base-adjusted
area for every row. A base row wants outline − green; a PG row wants the green itself.

Now: a `putting-green` row returns `getPuttingGreenShapeArea` (the green's area); a base
row returns outline − green as before; alt-turf stays blocked. Since the three Installed
writers cascade to infill (cont'd 8), the PG infill now follows the green too.

Two old-model tests that asserted the PG row used the base-adjusted area were the bug
written down; updated to expect the green's own area.

Tests **1425 → 1429** (README **1429**): base row → 82.37, PG row → 91.52, alt-turf
blocked, and a PG row with no green shape → no-area.

NOTE — three related issues from the same report are NOT yet addressed and need a larger
change (the putting green becoming a first-class install layer with its own roll plan,
while still subtracting its footprint from the base install): (a) Results doesn't break
out rolls/pieces by base vs PG, (b) the layout's per-layer base numbers don't subtract
the green, (c) base SqFt to Order. Tracked for a dedicated session.

---

## 2026-07-22 (cont'd 8) — Infill now follows the corrected base install (was left stale)

Follow-on to cont'd 7. The base row's Installed SqFt was being set correctly to the
outline-minus-green figure, but the **infill rows weren't re-derived from it** — so in
the Quote Builder the base infill kept its old full-outline area even though Installed
had dropped. The green wasn't being subtracted from the infill.

Cause: all three paths that set a turf row's Installed programmatically — the live link
(`syncLinkedTurfRow`), Apply Ordered SqFt, and Apply Installed SqFt — updated the turf
row and recomputed its own linear/ordered figures via `calcTurfRow`, but none called
`autoPopulateInfill`, and `calcTurfRow` doesn't touch infill. So Installed → infill
never cascaded.

All three now call `autoPopulateInfill()` right after setting Installed, so base infill
follows the base install (outline − green) and PG infill follows the green. For the
reference job base infill is now on 82.37 (base sand), PG infill on 91.52 (PG sand).

Tests **1421 → 1425** (README **1425**): the live-link and Apply-Installed paths call
autoPopulateInfill; base infill area = base install (82.37); PG infill = green (91.52).

---

## 2026-07-22 (cont'd 7) — Base turf installs on outline MINUS the green (money-path model corrected)

Corrects how a base + putting-green job accounts for turf, infill, and labor. The green
gets its own PG turf; **no base turf is laid under it.** So:

- **Base row Installed SqFt** is now the outline **minus** the green (and minus any
  Exclude holes). Apply Area no longer adds the green footprint back. For the reference
  job (outline 173.89, green 91.52) the base row now reads **82.37**, not 173.89.
- **Base infill** follows Installed, so it's ordered on 82.37 (your base sand), not the
  full outline — the over-order by the green's footprint is gone.
- **Putting green** stays **whole** (91.52) for its own turf, its own infill product,
  and PG-rate labor. Installed turf never subtracts from the green.
- **Standard-yard labor** is on the base area directly. The **"No Putting Green"**
  comparison card reconstructs the full outline (base would cover the green's spot),
  so that scenario still prices correctly.

The area split is now a single pure function `splitInstallArea(baseInstall,
greenFootprint, pgInstalled)` → `{std, pg}`, used by the labor calc: full outline =
baseInstall + greenFootprint, standard yard = outline − the green THIS scenario lays.
Base turf is still ORDERED for the full outline via the roll plan (bought in rolls, cut
to fit around the green).

This reverses the earlier "base covers the whole yard including the green" model, which
was built on a wrong premise (confirmed with the customer: the green area gets only PG
turf). Three tests that encoded the old model were updated after verifying the new
numbers are arithmetically correct — notably the PG-card COGS rises because standard
labor now runs on the true base area rather than a green-subtracted figure.

Tests **1413 → 1421** (README **1421**): `splitInstallArea` for the with-green and
no-green scenarios using the real CSV numbers (82.37 / 173.89), the whole-green
guarantee, clamping at 0, and string/blank coercion; plus the updated Apply Area and
COGS assertions.

---

## 2026-07-22 (cont'd 6) — Deselecting a layer now removes it from ALL accounting (not just the canvas)

Reported via a real CSV (Back_putting_green.csv): a stray Moasure measurement the user
had *deselected* was still changing the quote. Root cause — visibility and accounting
were deliberately independent: unticking a layer hid it on the canvas but it still
counted in the area math, the putting-green area, the install/roll plan, and therefore
infill and labor. Four loops filtered by mode, never by visibility.

All four now skip any layer with `layerVisibility[i] === false`: `getAdjustedShapeArea`,
`getPuttingGreenShapeArea`, the overlay-area total, and `computeInstallLayerLayouts`.
A deselected layer contributes nothing — no area, no subtraction, no roll, no infill,
no labor. Unticking a layer is now how you drop a stray/mistaken measurement; re-tick
to restore, or ✕ to delete permanently.

This reverses a previously-encoded design (a test asserted "hiding a layer does not
change its exclude/ignore effect on Installed Area"). That test was the old decision
written down; it's been updated to the new intent. The behavior change is deliberate
and matches how a user reads an unchecked box — with the noted consequence that
unticking a layer purely to declutter will now also drop it from the quote.

Verified against the real job geometry: base outline 173.89 ft², putting green 91.52
(inside the base), stray 38.82. Deselect the stray → base turf installs on 173.89 −
91.52 = **82.37**, and the green stays **whole at 91.52** (installed turf never
subtracts from the green).

Tests **1405 → 1413** (README **1413**): the updated visibility test (a deselected
exclude layer no longer subtracts; a visible one still does; deselected PG contributes
0), plus a scenario using the real CSV's three areas.

---

## 2026-07-22 (cont'd 5) — Fences, mulch & rock beds, and a drag handle for wall thickness

More landscape elements plus a nicer way to set wall thickness:

- **🟫 Mulch bed** and **⚪ Rock bed** — area beds, one `LANDSCAPE_ICONS` entry each
  (deterministic-seeded speckle / pebbles so the texture doesn't shimmer between
  redraws). Drag a rectangle, same as pavers.
- **⊟ Fence** — a curved path with posts placed every ~1.5 ft of real length. Its own
  thin path type, reusing the wall/freehand capture.
- **Wall thickness handle** — a selected wall now shows an orange knob offset
  perpendicular from its first segment; drag it to set thickness directly (2 in–4 ft),
  no longer only via the toolbar inches box. It's a new `'thickness'` select-op,
  hit-tested before the rotate/resize handles (it sits outside the bbox so there's no
  collision).

New pure helpers `wallThicknessHandle(a)` (knob position + unit normal) and
`wallThicknessFromDrag(handle, pt)` (2 × perpendicular distance, clamped) keep the drag
math testable.

The registry now holds five stamps (bush, tree, pavers, mulch, rockbed) and there are
two path types (wall, fence) — and everything still rides the one annotation
pipeline, still excluded from every calc.

Tests **1389 → 1405** (README **1405**): mulch/rock/fence registered and in the
toolbar; a fence selectable on its line; the thickness handle position and normal;
drag→thickness on both sides with min/max clamps; non-walls and degenerate walls
returning no handle; and fences staying out of the money path.

---

## 2026-07-22 (cont'd 4) — Landscape: pavers (area) and retaining wall (thick curved line)

Two more landscape elements, each in the shape category it actually belongs to:

- **▦ Pavers** — a rectangular paver area. Fits the stamp two-point box exactly, so
  it's **one `LANDSCAPE_ICONS` entry**: the draw function fills the box with a
  running-bond paver grid. Reuses the whole stamp pipeline (place/move/resize/rotate/
  select-by-box).
- **🧱 Wall** — a retaining wall: a curved multi-point path (captured like freehand)
  with a **real thickness in feet**, drawn to scale so it reads as a wall and scales
  with zoom. Thickness is set in inches from a toolbar input (default 8"). This is its
  own annotation type (`type:'wall'`), because the box model doesn't fit a variable-
  length path — but it reuses freehand capture and the select/move/rotate machinery.

Wall hit-testing is widened by half the wall's thickness, so a click just off the drawn
centerline still grabs it — a thin line at the same offset wouldn't (tested).

Both remain visual-only: the money-path guard from the previous entry now also covers
walls — `layoutFitPoints`, `calcQuote`, `sumRockTons` read no annotations of any kind.

The split proves the architecture: pavers cost one registry line; the wall needed a
small new render+capture branch but no new selection/transform/persistence code.

Tests **1376 → 1389** (README **1389**): the pavers icon and tool; a paver area
selectable inside its box; the wall tool and thickness input; a wall grabbable on its
centerline and within half-thickness but not beyond; the same offset missing a thin
line (proving thickness widened the grab zone); and walls staying out of the money path.

---

## 2026-07-22 (cont'd 3) — Landscape stamps: decorative vector icons in Draw mode (foundation)

First slice of landscape design elements. Draw mode gains a **Landscape** group with
**🌳 Bush** and **🌲 Tree** tools: click to drop one at a default ~3 ft size, or drag to
size it, then Select to move/resize/rotate/delete it — all reusing the existing
annotation pipeline. Persists per project with the other annotations.

Design decisions, driven by the app's constraints:

- **Vector, not images.** Icons are pure draw functions (a few lines each), not
  base64-embedded photos — so the single-file size stays flat and localStorage isn't
  filled with binary. Requested images would have broken both.
- **Visual only.** Confirmed and *tested*: nothing in `layoutFitPoints`, `calcQuote`,
  `calcTurfTotals`, `sumRockTons`, or `packPiecesIntoRolls` reads annotations, so a
  stamp can never move a square-foot or dollar figure. A stamp is an annotation
  (`type:'stamp'`, `stampKind`), riding the exclusion every annotation already has.
- **Extensible by design.** A `LANDSCAPE_ICONS` registry maps kind → a draw function
  that paints into a unit box; `drawLandscapeStamp` handles the box→canvas mapping and
  rotation. Adding pavers, a retaining wall, or grass later is **one registry entry** —
  no new interaction code. (Exposed via `landscapeIcons()` so it's reachable without
  depending on const hoisting — same lesson as the infill-const TDZ.)

Two integration fixes: stamps update their box on drag (they'd otherwise route through
`drawShapePoints`, which only knows line/rect/circle), and `annoHitTest` treats a stamp
as its filled bounding box so it's grabbable anywhere inside, not just along the
two-point diagonal.

This is the **foundation**, shipped with two icons to prove the whole pipeline end to
end. Pavers, retaining walls, grass, and turf-area fills are follow-on registry
entries.

Tests **1361 → 1376** (README **1376**): the registry and both icons' draw
functions/labels; a stamp is hit anywhere in its box and missed outside; a click-placed
zero-size stamp is caught by the default-box path; the two tools are in the toolbar;
and — the one that matters — the money-path functions contain no reference to
annotations or stamps.

---

## 2026-07-22 (cont'd 2) — Top bar scrolls instead of clipping at medium window widths

With seven cells, the top bar could push its last cell (Scrap) off the right edge on a
non-maximized laptop window (~860px to full width) — above the 860px breakpoint where
the whole tab row starts scrolling, but wide enough that the bar overran the header,
and `flex-shrink:0` meant it never yielded. A clip on the primary device, not just
mobile.

`.top-metrics` now scrolls itself (`overflow-x:auto`, `min-width:0`, thin styled
scrollbar) and no longer refuses to shrink; the cells keep `flex-shrink:0` so they
hold their width and the bar scrolls rather than squishing them. The scroll is isolated
to the bar: a maximized laptop/monitor (the primary case) sees no scrollbar because
everything fits, a windowed laptop gets a small in-bar scroll instead of a lost cell,
and small screens are unchanged (the whole tab row already scrolls below 860px).

Tests **1357 → 1361** (README **1361**): `.top-metrics` carries `overflow-x:auto` and
`min-width:0` and no longer sets `flex-shrink:0`, while `.top-metrics .tm` does — the
combination that scrolls instead of clipping. (Visual behavior itself isn't headlessly
testable — verified on-device.)

---

## 2026-07-22 (cont'd) — Top bar shows order totals: edging, rock, sand (replacing Perimeter)

The Layout top bar's **Perimeter** cell is replaced with three job-wide order totals
pulled from the project, so the numbers you actually order sit next to the live layout
figures:

- **Edging** — linear feet and boards to order (`212 ft · 11 bd`), from `proj.edging`.
- **Rock** — total tons across every rock line (`6 tons`), summed.
- **Sand** — total infill bags and weight across every infill line
  (`60 bags · 3,000 lbs (1.5 tons)`), reusing the infill-weight helpers; tons appear
  past 2,000 lbs.

Rock and sand sum across all lines because a job can have several of each. Backed by
pure `sumRockTons` / `sumInfillBags` / `fmtTopRock` / `fmtTopEdging` / `fmtTopInfill`,
with a thin `updateTopBarMaterials(proj)` DOM writer called from both
`updateMaterialsSummary` (Quote side) and the layout render, so the bar tracks edits on
either tab.

**Latent bug caught:** `infillWeightLbs` referenced the `const INFILL_LBS_PER_BAG`
defined ~1900 lines *later* in the file. Existing callers all sat after that line so it
never fired, but the new top-bar helpers are earlier — hitting the const's temporal
dead zone. Inlined the literal so the function no longer depends on declaration order.

The Materials Summary card on Quote Builder is unchanged: it still carries the
per-product turf/rock/infill lines the compact bar can't hold. The bar now duplicates
its order *totals*; the card remains the place for per-line detail.

Tests **1339 → 1357** (README **1357**): rock/bag sums across multiple lines with
string/blank parsing; edging with and without boards; each cell's dash-when-empty; the
sand cell's lbs→tons threshold; and that the Perimeter cell is gone while the three new
cells exist.

---

## 2026-07-22 — Removed the dead turf "Type" column (it looked like it priced putting greens; it didn't)

Each Quote Builder turf row had **two** dropdowns offering "Putting Green":

| Column | Field | What it did |
|---|---|---|
| **Type** | `turfType` | **Nothing.** Written, displayed, and backfilled from the catalog — never read by any calculation. |
| **Role** | `role` | **Everything.** PG turf cost, PG labor rate, PG infill and PG misc all filter on `role === 'putting-green'`. |

So the mysterious "—" simply meant "no type set," and it didn't matter, because nothing
consumed the field. The real hazard wasn't the blank option: setting **Type = Putting
Green** looked exactly like it would price a green, and silently did nothing — the Role
column next to it is the one that works.

Verified before removing: all six `turfType` references were writes, a backfill, or the
dropdown itself; no pricing, labor, quote, export, or roll-plan path reads it. The
catalog's own Type field in Settings is unaffected (it's a label there) and is still
stored on the row, so no data is lost — only the misleading control is gone.

The row and header grids drop from 8 columns to 7 together.

Tests **1332 → 1339** (README **1339**): the Type dropdown and its header are gone, the
role dropdown remains, pricing still filters on role, and the row and header grids
declare the *same* seven columns — so the table can't skew if one is edited without the
other.

---

## 2026-07-15 (cont'd 20) — Misc catalog items can be flagged "always include on new projects"

The Settings misc catalog was already global (shared by every project), but nothing
from it carried onto a new job — `miscItems: []` — while `rock` auto-populated from
its catalog. That inconsistency meant re-adding the same seam tape and nails on every
quote.

Catalog items now have an **"Always include on new projects"** checkbox. Flagged items
are seeded onto every new project at qty 1; unflagged ones stay available to add by
hand. The Settings table shows a **"On new jobs"** column so it's visible at a glance
which are which.

Deliberately per-item rather than all-or-nothing: rock auto-populates because every job
needs base rock, but most misc items (haul-away, a gate repair) are job-specific — so
seeding the whole catalog would mean deleting the irrelevant rows on every quote, which
is worse than adding the one you need. The flag carries that distinction.

Backed by a pure `defaultMiscItemsForNewProject(catalogItems)` that returns **fresh row
objects**, never references to the catalog entries, so editing a price on one job can't
reach back and change the catalog.

Tests **1313 → 1332** (README **1332**): only flagged items seed a project; a
job-specific item is excluded; rows come out at qty 1 with the base role and
`fromCatalog`; price/unit/notes carry with sane defaults for a sparse entry; editing a
seeded row leaves the catalog untouched; and empty/null/junk/unflagged/explicitly-false
input all seed nothing without throwing.

---

## 2026-07-15 (cont'd 19) — Fix: "Fit" ignored hidden layers on a multi-CSV job

Reported: with several CSVs imported, unticking a secondary shape and pressing **Fit**
left the view sized as if the layer were still there — it didn't shrink to the primary.

Cause: `layoutFitPoints` checked visibility in **one** of the three places it collects
points. The `secondaryShapes` loop skipped hidden layers (so the outline was excluded),
but the `_installLayers` loop below it — which contributes each install layer's roll
pieces and purchased rectangles — had **no visibility check**, so the hidden layer's
turf pieces were still framed. The view stayed sized around geometry that wasn't drawn,
making "Fit" look like it did nothing. The primary had the same gap: `basePoints` and
`layout.strips` were added unconditionally, so hiding the primary wouldn't shrink the
view either.

Fit now frames **only what's actually drawn**: a hidden layer contributes neither its
outline nor its pieces, hiding the primary drops its outline and strips, and a hidden
putting-green layer no longer contributes its fringe. If every layer is hidden it falls
back to the primary outline rather than producing an empty (NaN) transform.

All three fit paths — the Fit button, the auto-fit on render, and the re-fit when a
shape is dropped out of frame — share this function, so all three are fixed.

Diagnostic: primary at x 0..10 with a hidden install layer at x 100..110 — previous
build framed **0..110**, current build frames **0..10**.

Tests **1307 → 1313** (README **1313**): a visible layer is included; a hidden layer's
pieces are excluded (fails against the previous build); a hidden layer's rectangle is
excluded with rectangles shown; hiding the primary frames only the remaining layer;
all-hidden falls back to the primary outline; and explicit `visible:true` behaves like
the default.

---

## 2026-07-15 (cont'd 18) — Layout toolbar buttons are all the same height

The Layout toolbar's controls didn't line up: Import CSV and Add CSV sat a couple of
pixels shorter than Edit Shape, Move Layers, Cut Mode, Draw, etc. Cause — those two
are `<label class="btn">` (a label wrapping a hidden file input), the rest are
`<button class="btn">`, and `.btn` set no `display` / `box-sizing` / `line-height`, so
a label (default `display:inline`) and a button (default `inline-block` with its own
line box) computed different heights from the same padding.

`.btn` now uses `display:inline-flex; align-items:center; justify-content:center;
box-sizing:border-box; line-height:1.2`, so every element type styled as a button
renders at the same height and centers its label. Applies app-wide (109 buttons);
full-width buttons (`width:100%`) are unaffected beyond their content now centering,
which is the intended look anyway.

Tests **1302 → 1307** (README **1307**): `.btn` carries the inline-flex / border-box /
align-items rule (so it can't be dropped silently), and the toolbar still mixes a
label-button (Import CSV) with real buttons — the exact case the rule equalizes.

---

## 2026-07-15 (cont'd 17) — Piece dimensions toggle; dimension labels no longer spam on curves

Two fixes prompted by "why doesn't the nested piece show dimensions?"

**1. Curve/segment noise (the real problem in the screenshot).** A Moasure import
represents a straight wall as dozens of tiny segments and a curve as many more, and
`polygonEdgeLabels` was labelling every raw segment — so a curved edge became a swarm
of "0'11"" tags. It now **merges near-collinear consecutive edges into one run**
(labelled once, with the run's total length) and drops runs under ~2 ft. A 30-segment
straight wall reads as a single "30'0"" instead of thirty "1'0"" tags; a tight curve
shows few or no labels rather than clutter. An explicit closing-duplicate vertex is
stripped first so the final edge isn't lost.

**2. A separate "Show piece dimensions" toggle.** The original toggle only walked the
measured shapes (yard + layers), never the cut pieces — which is why the nested piece
had no labels. Rather than fold pieces into the shape toggle (which would clutter the
yard-outline view), there's now a second, independent checkbox that labels each
drawn cut/roll piece — including pieces nested into another roll's waste, using the
piece's moved (`_displayClippedMoved`) polygon so the label follows it into the waste.
Both toggles persist per project (`showDimensions`, `showPieceDimensions`).

Tests **1293 → 1302** (README **1302**): section 92 rewritten for the merge — a
30-segment wall collapsing to one 30 ft label, a curve yielding ≤3 labels, the 2 ft
default threshold, a lower threshold keeping short edges, closing-duplicate handling,
and the 3-4-5 triangle; plus a new section asserting the two toggles exist, persist to
separate flags independently, and that the piece draw reads the moved polygon for
nested pieces.

---

## 2026-07-15 (cont'd 16) — The guide links were invisible — reworked as "?" badges on section titles

The per-tab guide links added in cont'd 14 shipped as faint ghost buttons (transparent
background, grey text, 11px) tucked in the top-right corner — technically present,
practically unnoticeable, which is why they couldn't be found. A help affordance nobody
sees isn't one.

Reworked as a **green circular "?" badge** (new `.help-badge` style) sitting **right on
the first section title of each tab** — "Job Info & Exports" (Quote), "Site Layout &
Roll Plan" (Layout), "Roll Settings" (Settings) — where the eye already goes. Each opens
the User Guide at that tab's section via the same `openGuideAt`. The Layout tab's badge
also replaces the faint toolbar button, so there's one clear affordance, not a hidden
one plus a corner one.

Tests **1289 → 1293** (README **1293**): the guide links render as `help-badge`
elements, and a badge for each of `doc-quote` / `doc-layout` / `doc-settings` sits on a
section title (rather than just asserting the onclick exists, which the invisible
version also passed).

---

## 2026-07-15 (cont'd 15) — Layout tab: trimmed the text stacked above the canvas

The Layout tab had a block of always-on text pushing the shapes down. Two causes:

- The **"Show dimensions" documentation paragraph** added in cont'd 13 shipped
  **without `display:none`**, so a full paragraph about the toggle sat permanently at
  the top of the tab. Removed — that detail belongs in the guide, and the toggle's own
  label plus a tooltip already explain it. (My error from that session.)
- The **Import-CSV intro** was three lines of prose. Cut to one line with a "Guide"
  link, and it now **hides once a layout is loaded** — it's orientation for the empty
  state, pure clutter once you're working.

The per-mode hints (Edit Shape, Move Layers, Cut Mode) were already correct — hidden
by default, shown only in their mode — and are untouched.

Tests **1283 → 1289** (README **1289**): the 3-line intro is gone, the shortened intro
has an id so it can be toggled, the stray Show-dimensions paragraph is removed, and the
three mode hints still ship hidden.

---

## 2026-07-15 (cont'd 14) — Less inline text; a "? Guide" button per tab

The app carried too much inline explanatory text. First pass at trimming it:

- **A "? Guide" button on each tab** (Quote Builder, Layout, Settings) opens the User
  Guide modal scrolled straight to that tab's section, via a new `openGuideAt(id)`
  (opens the modal, then jumps). So detail lives in one place and a control can point
  at it instead of repeating it.
- **Long inline explainers trimmed to one line**, with the guide carrying the rest:
  the rock depth/density note, the per-project shipping override paragraph, the
  multi-shape layer note, the Cut Mode and Nested Pieces blurbs, and the Roll Settings
  and Default Shipping card intros.

Deliberately **kept** (not trimmed): the edging "trim to the runs that actually need
edging" warnings on both the Quote Builder and New Project — they prevent a real
over-quote and a warning you have to hover wouldn't get read. And **nothing was moved
into hover tooltips**: the app is used on iPad, where hover doesn't exist, so a
tooltip would simply vanish on the device it's quoted from. Short hints stay as inline
text; the ? Guide is the path to more.

Tests **1272 → 1283** (README **1283**): each tab's ? button links to its guide section
(`doc-quote` / `doc-layout` / `doc-settings`), those sections exist as anchors,
`openGuideAt` opens the modal, and the trimmed explainers stay gone (guards against
them creeping back). This is a first pass — more inline text can follow the same
pattern.

---

## 2026-07-15 (cont'd 13) — "Show dimensions" toggle: edge lengths on every shape

New checkbox above the layout canvas, **"Show dimensions (edge lengths on every
shape)"**. When on, every edge of every visible shape — the primary yard and each
added layer — is labelled with its length in feet and inches, so the yard's actual
measurements read straight off the layout instead of only its area. Independent of the
"Show purchased roll rectangles" toggle, works in any mode, and remembered per project
(`layout.showDimensions`, loaded/saved like `showRects`).

Backed by a pure `polygonEdgeLabels(points, minLenFt)` that returns each edge's
midpoint, length, and an outward unit normal (so labels nudge just outside the shape,
away from the centroid). Edges below the minimum length are skipped, so a polygon's
repeated closing vertex or a sliver edge doesn't drop a zero-length label on the
drawing.

Tests **1256 → 1272** (README **1272**): a rectangle's four edge lengths and
midpoints; outward normals pointing away from the centroid and unit-length; a repeated
closing vertex and sub-threshold slivers skipped; a 3-4-5 triangle; and degenerate
input (empty, single point, null) returning no labels without throwing. The canvas
draw itself isn't reachable by the Node harness — verified on-device.

---

## 2026-07-15 (cont'd 12) — Cut List: "full width" note no longer lies on narrow pieces

The Turf Cut List tagged pieces **"Cut full width, trim S-seam on site"** whenever the
cut added the S-seam allowance — which is *any* piece that isn't cut exactly at its
footprint. So a 9 ft piece, cut 9'4" to cover 9'0", was labelled "full width" despite
being nowhere near the 15 ft roll. The **cut width itself was always right**
(`seamCutWidth` = min(footprint + trim, roll width)); only the sentence was wrong.

Now the note distinguishes the two real cases:
- Piece spans the full usable width → cut the whole roll: **"Cut full roll width, trim
  S-seam on site."**
- Narrower piece → **"Cut with S-seam allowance, trim on site"** — cut the footprint
  plus the allowance, not the roll.

The decision is extracted into a pure `cutWidthNoteKind(footW, cutW, rollWidth)` →
`'full' | 'allowance' | 'none'`, so it's testable rather than buried in a template
ternary.

Tests **1249 → 1256** (README **1256**): a 9 ft and a 6 ft piece are 'allowance', a
full-usable-width piece is 'full', a piece cut exactly at roll width with no added trim
is 'none', a narrow piece with no allowance is 'none', a piece just under full width
still caps to 'full', and a sub-tolerance difference gets no note.

---

## 2026-07-15 (cont'd 11) — Infill lines show total weight (50 lb bags)

Each infill line in the quote card and the Supplier Order now shows its **total
weight** next to the bag count — e.g. "GD Medium Sand: 15 bags · 750 lbs". Weight is
in lbs, adding tons once it reaches 2,000 lbs ("60 bags · 3,000 lbs (1.5 tons)"). When
a job has more than one infill product, a combined **Infill total** line sums the bags
and weight; a single-product job doesn't get a redundant total.

Weight is computed on the **bags actually ordered** (already rounded up in
`calcInfillRow`), not raw sqft × lbs — you take home whole bags, and a weight figure is
for planning delivery and handling of what arrives. Two pure helpers:
`infillWeightLbs(bags)` (× 50) and `fmtInfillWeight(lbs)` (lbs, with tons past 2,000).

Tests **1235 → 1249** (README **1249**): weight per bag count including blank/string
inputs; the lbs/tons threshold at exactly 2,000; ton pluralization (1 ton singular,
1.5 and 2.5 tons plural — the first pass wrongly printed "1.5 ton"); thousands
separators; and the realistic 500 sqft × 1.5 lbs/sqft = 15 bags = 750 lbs path.

---

## 2026-07-15 (cont'd 10) — Removed the butt-seam setting: it could only ever make a job worse

The supplier cuts rolls to length, which makes butt seams across a roll join a switch
with no upside. Demonstrated across every combination on a job of primary 60+30 and
shed 40:

| | rolls | lengths | total to order |
|---|---|---|---|
| shared, seams off | 2 | [90, 40] | **130 ft** |
| shared, seams on | 2 | [100, 30] | **130 ft** |
| own, seams off | 2 | [90, 40] | **130 ft** |
| own, seams on | 2 | [90, 40] | **130 ft** |

The total never moves. Seaming a run across a join only **redistributes** footage
between rolls; it never reduces it. So the setting's best case was "no change" and its
worst case was an unnecessary seam in a customer's lawn — one mis-click from a worse
product, for nothing. Removed rather than left as a trap.

Gone: the checkbox, both `getElementById('allowJoinSeamsInput')` reads, the
`loadRollDefaultsToInputs` sync, the scope-dialog field labels, and the now-dead
`seamsOn` branches in the Piece List. `getRollOpts` hard-wires `allowJoinSeams: false`.

**Kept deliberately:** `packPiecesIntoRolls(lengths, rollLength, allowJoinSeams)` still
takes the flag and is still tested both ways, and the roll-join seam drawing and Piece
List seam note remain. A fixed-length supply is a one-line revert (flip the hard-wired
false), not a rewrite. The generic `isRollBoolField`/`rollElValue`/`setRollElValue`
helpers stay too — they're what stop the next checkbox repeating the `parseFloat("on")
→ NaN` bug from cont'd 18.

**The per-layer Rolls dropdown stays.** It's a different mechanism, not a duplicate:
it decides how the same footage splits into physical rolls (one 55 ft roll vs a 42 ft
plus a 13 ft). Also verified `resolveCrossLayerNesting` doesn't read `rollGroup` — so
sharing rolls doesn't gate cross-layer nesting; the dropdown's only effect is the roll
count and each roll's length. It's cost-neutral and already defaults to `shared`, which
is the standing rule ("include a separate layer on a roll if it fits within 100 and the
direction works") — so it needs no attention, and the packer handles the "if it fits"
clause automatically.

Tests **1227 → 1235** (README **1235**): the checkbox and its DOM reads are gone, opts
hard-wire seams off, a layout built through the real path never seams and no piece
carries `parts`, the packer still behaves correctly in *both* modes for the revert
path, and seamed vs seamless footage is asserted identical — the fact that made the
setting pointless.

---

## 2026-07-15 (cont'd 9) — Delete a layer

Each additional layer now has a **✕** button in the Layers list. Until now a layer
imported by mistake could only be hidden or set to "Measure only" — never removed.

The confirmation is mode-aware: if the layer is set to anything other than "Measure
only" it says outright that deleting will change Installed/Ordered SqFt and the quote,
rather than letting the numbers move silently. Deleting takes the shape's cuts and
nesting with it. Not undoable — re-import the CSV to get the shape back.

**The real work was reindexing, not removing.** Every per-layer setting is keyed by
the layer's **array index**, so splicing a shape out of `secondaryShapes` re-points
everything above it. Delete layer 1 and old layer 2 — now index 1 — would read the
**deleted** layer's mode, offset, roll direction, visibility, and roll group. Strip
keys are worse: `manualCuts` / `nestPos` / `nestRot` / `nesting` are namespaced
`L<idx>_y0.00` (see `keyPrefix`), so old layer 2 would look up `L1_` and inherit the
deleted layer's cuts. Not data loss — **wrong data silently applied to the wrong
shape**, which is worse, and invisible until a crew cut to it.

So deletion goes through pure helpers: `reindexLayerIndexMap` (drop the index, shift
higher ones down, leave non-numeric keys like `'primary'` alone),
`remapLayerStripKey` / `reindexLayerStripKeyMap` (renumber the `L<idx>_` prefix; the
primary's un-prefixed keys are never touched), and `reindexNestingMap` — which remaps
**both** sides, since nesting is `{sourceStripKey: targetStripKey}`, and drops any
entry whose source *or* target lived on the deleted layer (a piece can't nest into a
roll that no longer exists). `deleteSecondaryLayer(proj, idx)` applies all of them.

Tests **1189 → 1227** (README **1227**): index maps for first/middle/last deletion
and non-numeric key survival; strip-key remapping including multi-digit indices and
the primary's un-prefixed keys; nesting remapped on both sides and dropped from either
end; and a full delete asserting that layer C's mode, offset, visibility, roll
rotation, roll group, cuts, nest position/rotation and nesting all follow it down to
index 1 while B's are gone rather than inherited. Plus guards: out-of-range, negative,
null project, no layout, no shapes — all refused without mutating — and deleting the
only layer leaving no orphaned settings.

---

## 2026-07-15 (cont'd 8) — "Use CSV perimeter" on the New Project dialog too

The cont'd 6 button went on the **Quote Builder's** Edging card — which you only reach
*after* the project exists. The New Project dialog has its own separate CSV import
(`handleNewProjCsv`), already computed the perimeter, already displayed it
("Perimeter: 133.7 ft"), and already had an **Edging (Linear Feet)** field — with
nothing joining them. So the obvious place to set edging from the CSV was the one
place the button wasn't.

Added there too: **"↧ Use CSV perimeter (X ft, N shapes)"** under the dialog's Edging
field, appearing as soon as a CSV is attached and hiding again when it's cleared or
the dialog is reset. Still a click, not an auto-fill, for the same reason as before —
the total is the *maximum* possible edging, and no yard edges against its house,
patio, or driveway.

The dialog's displayed "Perimeter" is the **main outline only**, so the button offers
a new all-shapes total (`perimAll`) instead: edging can wrap beds, tree wells, and an
added yard too. That matches what the Layers tab calls "Total — all edges" once the
project exists, so the figure doesn't change on create.

Tests **1182 → 1189** (README **1189**): the button exists in the dialog, is wired to
its handler, ships hidden (no CSV → no perimeter), is never auto-filled, computes an
all-shapes total, hides again on clear, and offers the same 60 ft that
`totalLayerPerimeter` reports post-create for the same shapes.

---

## 2026-07-15 (cont'd 7) — Live link ships ON; README test count corrected (the "+43 offset" was just wrong)

**Auto-apply already existed and was already the default** — `isLiveLinkOn()` returns
`liveLink !== false`, `scheduleLinkedSync()` runs at the end of every
`renderRollLayout()` (so every rotation, seam, shape edit, layer move, CSV import and
roll-setting change triggers it, debounced 250ms and deferred while a drag is live),
and `syncLinkedTurfRow()` pushes **both** Ordered SqFt (via `orderedFromLayout`,
which reads `_combined`) and Installed SqFt (via `computeApplyAreaForRow`, made
layer-aware in cont'd 6). So a multi-layer job now auto-applies all-layer figures on
both sides.

But the checkbox **shipped unchecked** while the logic defaulted to on. `loadProject`
papered over it by assigning `.checked` on load, so the mismatch was invisible — until
any stray `toggleLayoutLiveLink()` fired against an unchecked box and wrote
`liveLink = false` **permanently** for that project, silently killing auto-apply. That
is the most likely way a project ends up with it off. The markup now ships `checked`,
matching `isLiveLinkOn()`. (An explicit `false` is still respected — a real choice
isn't overridden.) This is the same DOM-default-vs-logic-default trap as the butt-seam
checkbox in cont'd 18.

**README test count fixed — and the convention killed.** The README claimed **1216**
while `node waterloo_turf_tests.js` printed **1173**. There is exactly one test file
and no skipped tests: the "+43 offset" had no basis. It was a stale error frozen into
a convention and then faithfully preserved on roughly ten bumps this session — a
wrong number kept in lockstep with a right one. The README now states exactly what the
runner prints, with an inline note to copy it from the runner rather than add to the
previous figure.

Tests **1173 → 1182** (README **1182**, no offset): the live-link default across
undefined / true / false / no-layout / null; an assertion that the shipped `<input
id="rollLiveLink">` markup actually carries `checked`, so the DOM default can't drift
from the logic default again (this fails against the previous build); and that both
auto-applied figures are layer-aware (Ordered 825 not 422, Installed 566.9 not 422.4).

---

## 2026-07-15 (cont'd 6) — "Use layout perimeter" for edging; Apply Area now counts every layer

**New: one-click edging from the layout.** A *"↧ Use layout perimeter (X ft)"* button
under **Linear Feet of Edging** fills the field with the layout's total boundary
length across every shape — the same "Total — all edges" the Layers tab shows, via a
pure `totalLayerPerimeter(proj)` reading the same `layerPerimeters` the panel does.
The button only appears once a layout exists and its figure tracks shape edits.

It is a **click, not an automatic fill**, on purpose. That total is the *maximum*
possible edging: edging only goes where turf meets soil or a bed, so any run against
a house, patio, or driveway needs none. Auto-filling would silently over-quote every
job with a hardscape edge — and invisibly, because the number looks authoritative. So
it's offered, shown, and left to be trimmed, with a toast saying as much.

**Fix: Apply Area ignored install layers.** On a 2-layer job, one click on Apply
pushed a layer-aware **Ordered SqFt** (`applyRollLayoutToTurf` reads `_combined`)
alongside a primary-only **Installed SqFt** — 422 ft² written under a 566.8 ft²
header, with infill, labor, and rock all sized off the wrong number.
`computeApplyAreaForRow` read `layout.adjustedShapeArea ?? layout.shapeArea`, which
is the primary alone. It now uses the same expression as the Installed metric —
`_combined.area - shapeArea + adjustedShapeArea` — so every install layer counts while
the primary's own exclusions still come off. Both Apply buttons (Apply Area and Apply
Roll Layout) share this function, so both are fixed.

Tests **1159 → 1173** (README **1202 → 1216**): `totalLayerPerimeter` across
multi-shape, cutout, moved/rotated (perimeter is transform-invariant), degenerate,
and null cases, and agreeing exactly with the Layers panel's printed total; plus
Apply pushing the combined 566.9 ft² rather than the primary's 422.4 (the old build
returns 422.4), primary exclusions still coming off, single-layer jobs unchanged,
alt-turf still blocked, and zero-area still reported rather than silently applied.

Known gap: overlay ("free fill from scrap") area is counted in the top-bar Installed
metric but still not in Apply — unchanged behaviour, called out here rather than
quietly bundled into this fix.

---

## 2026-07-15 (cont'd 5) — Multi-layer: the Piece List and Rolls to order now see every layer

Reported from a live 2-layer job: the top bar read **Linear Ft 55**, the panel showed
**Primary Shape 42 lf + Shed yard 13 lf**, but the Piece List listed only the
primary's two pieces (23 + 19 = 42 ft). The Shed yard's piece was missing from the
list entirely.

Cause: `renderPieceList` enumerated with `getNestableUnits(layout)`, which only ever
walks `layout.strips` — the **primary** layer. (`buildCutList` already iterated
`_installLayers`, which is why the Cut List was complete.) `rollLengthSummary` had
the same blind spot, so a shared second layer was silently absent from the length to
order — 42 ft when the answer was 55 ft.

Both now walk every install layer. Each layer numbers its own rolls/pieces, so with
more than one layer each row is prefixed with the layer name ("Shed yard — Roll 1 /
Piece 1") and the flat list is grouped layer by layer. In Rolls to order, layers set
to **share rolls** are pooled onto the same rolls; a layer set to **roll on its own**
is packed separately.

**Also fixed — the division bug, third instance.** `sumInstallLayouts` still computed
pooled shared rolls as `ceil(sharedLinear / rollLength)`, ignoring both the packing
introduced for single-layer jobs and the butt-seam setting entirely. Shared layers now
pool their **pieces** and pack them like everything else.

All three paths (roll count, shared pooling, Rolls to order) now read one extracted
`layoutUnitLengths(layout)` — the single definition of what consumes roll length —
so they can't drift apart again. That drift is what produced today's roll-count,
label, footage, and now layer bugs.

Tests **1144 → 1159** (README **1187 → 1202**): `layoutUnitLengths` across plain,
nested, empty-strip, over-long-segmented, and null inputs; the real job pooling to
55 ft on one roll (the old build returned 42); "roll on its own" staying unpooled at
23 + 13 across 2 rolls; pooled 60+60 needing 2 rolls in both seam modes; and
single-layer jobs unchanged.

---

## 2026-07-15 (cont'd 4) — A layer drag no longer dies at the edge of the canvas

A shape couldn't be dragged past a point well short of the visible panel — most
obvious when zoomed out, where the drawing stopped around 64% of the way across an
otherwise empty white box.

Two causes, both about the canvas *element* being smaller than it looks:

1. Zoom sets `canvas.style.width = bitmap x zoom`, so below 100% the element is
   narrower than its wrapper. The cursor crosses its right edge long before the panel
   ends — which is exactly where the shape stopped.
2. `mouseleave` called `endDragLayer` (and `endDragNesting`). Crossing that edge
   didn't merely stop delivering moves, it **ended the drag outright**.

`mouseleave` no longer ends layer or nesting drags. Instead both are tracked on
`window` `mousemove`/`mouseup`, bound once alongside the canvas handlers: the drag
follows the cursor anywhere on the page and finishes wherever it's released.
`canvasEventToData` already works from viewport coordinates, so no coordinate change
was needed. Both handlers early-return when no drag is in progress, so the window
listeners cost nothing when idle, and the binding is guarded on
`typeof window.addEventListener === 'function'` for the Node harness. Touch is
unaffected — touch events already continue to fire at their original target once a
gesture starts. Pan, cut, and vertex-edit behaviour on `mouseleave` is unchanged.

Tests unchanged at **1144** (README **1187**) — event binding isn't reachable by the
Node harness; verified on-device.

---

## 2026-07-15 (cont'd 3) — Move Layers: the view now grows when a shape is dropped out of frame

Dragging a layer past the edge of the canvas cut it off, and the view never expanded
to show it. Reported straight after (cont'd 2) unblocked moving a second CSV — the
first thing you do with two imported shapes is drag one clear of the other, which is
exactly the case that ran off the edge.

Cause: this was the (cont'd 3, 2026-07-14) view-freeze doing its job too well. Move
Layers holds `_wtFreezeTransform` so the canvas doesn't re-fit and rescale under the
cursor mid-drag (without it, moving one shape made every other shape appear to jump).
But the frozen branch reuses `minX/minY/scale` verbatim, so the view can never grow —
anything dragged outside is simply clipped.

Dropping the freeze would bring the jumping back. Instead the fit is re-checked
**once, on release**: if any point now sits outside the viewport, the view re-fits and
re-freezes, with a "View re-fit to show everything" toast. Inside the viewport,
nothing moves — arranging stays stable. Never mid-drag, which is what the freeze is
for. "⤢ Fit view" still re-frames on demand.

Backed by a pure `pointsFitInView(pts, transform, tol)` that inverts the same mapping
the draw path uses, and the check reads the same `showRectanglesToggle` the renderer
does — so it frames exactly the points that get drawn, rather than re-fitting for
rectangles that aren't shown.

Tests **1129 → 1144** (README **1172 → 1187**): shapes inside need no re-fit; off the
right/left/top/bottom each trigger one; the tolerance keeps an edge-grazing shape from
re-fitting on every nudge while a clearly-outside point still does; the padded margin
counts as visible; and degenerate input (no transform, no points, zero/NaN scale)
never forces a spurious re-fit — which would rescale the view under the user for no
reason.

---

## 2026-07-15 (cont'd 2) — Revert: install layers are movable again (multi-CSV jobs were unlayoutable)

**Reverts the ban added in (cont'd 12).** Reported from a live job: importing a
primary Moasure CSV and then a second one ("Shed yard — Base Layer") gave two shapes
sitting on top of each other, with no way to separate them. Each CSV arrives on its
own origin, so a second measured area *always* needs positioning by hand — and
(cont'd 12) had made exactly that impossible: `clearInstallLayerOffsets` zeroed
install-layer offsets on every render, and `startDragLayer` refused the grab.

The ban was an over-correction. Install-layer outlines wandered away from their
bodies only when their pieces were **nested** into another roll's waste — the pieces
are redrawn at the host roll, so the outline was left marking an area with nothing
drawn on it. Banning all movement treated a nesting-display problem as a movement
problem. (cont'd 13) then drew a dashed, named outline for every layer and (cont'd
14) made Edit Shape draw pieces at their home position, which fixed the visibility
properly — leaving the ban as dead weight that blocked real work.

`clearInstallLayerOffsets` is removed and the grab refusal with it: **every layer
mode is movable.** Un-nested pieces follow the shape (they're built from its moved
points). Nested pieces are cut from their host roll's waste and stay drawn there,
which is correct but easy to misread, so the grab toast now names the count:
*"Moving: Shed yard — 2 nested pieces stay in the host roll's waste"*.

Tests **1131 → 1129** (README **1174 → 1172**): section 79 previously asserted the
ban (offsets cleared for install layers). It now asserts the opposite — an install
layer's move offset survives and commits like any other layer's, and moving it
doesn't change its area — plus `countNestedPiecesForLayer` across nested/un-nested/
primary/unknown/null/bare-strip cases. Net −2 tests: the ban's coverage is gone
because the ban is gone.

---

## 2026-07-15 (cont'd) — Fix: the Cut List subtotal contradicted the pieces it listed

Reported from a live job: the Cut List printed **Piece 1 = 7'1"** and **Piece 2 =
23'8"** — 30'9" between them — under a subtotal reading **"33.0 ft total cut"**.

Cause: `buildCutList` summed `u.orderedLength` (8 + 25 = 33) into the subtotal while
each piece *displayed* `footL`, the trimmed footprint (7'1", 23'8"). Two different
definitions of "length" in one panel. The local was even named `cutLength` while
holding the ordered length, which is what made it look right.

The subtotal now sums the lengths the panel actually prints, and is shown in feet
and inches to match them ("30'9" total cut"). The ordered length is kept per piece as
`rollLength` — a genuinely different number (footprint + cutting margin, rounded up
to the whole foot) that belongs to ordering, not cutting. The footer now says so
outright, and points at "ft to order" in Rolls to order as the figure to buy against.

**The Cut List total is not an order quantity** — the order is smaller here, not
bigger: Piece 1 is nested into Piece 2's waste, so it costs no roll length. 25 ft is
correct and reconciles (375 ft² ordered − 256.82 installed = 118 ft² scrap).

Tests **1125 → 1131** (README **1168 → 1174**): the printed subtotal equals the sum
of the printed footprints; each piece's `cutLength` **is** its `footL`; ordered
length is never shorter than the piece cut from it; and ordered vs printed totals are
asserted to be genuinely different numbers (123 ft vs 120 ft on a 40×30 shape).
The old test compared the total against `p.cutLength` — which *was* `orderedLength` —
so it was self-consistent and never checked the displayed dimension. That tautology
is why this shipped.

---

## 2026-07-15 — Fix: the Piece List counted nested pieces as linear footage to order

Reported from a live job: the top bar read **Linear Ft 25**, Rolls to order read
**25.0 ft**, but the Piece List read **33.0 ft total linear footage** — three numbers,
two answers. The 25 was right.

The job's two pieces were a 25 ft band and an 8 ft band **nested into the 25 ft
band's waste** (the piece list even noted "cut from Roll 1 / Piece 2 waste", and the
job showed "SAVED (NESTED) 120 ft²"). A nested piece is cut from a roll that's
already being bought, so it adds **no** linear footage — that's the entire point of
nesting. Everything else reconciled at 25 ft: Ordered 375 ft² = 25 ft × 15 ft, minus
256.82 ft² installed = 118 ft² scrap.

Cause: the Piece List totalled `rows.reduce((s,r) => s + r.length, 0)` — every row,
nested or not — while `computeRollLayout` correctly subtracts nested pieces from
`totalLinearFt` (hence the correct 25 in the top bar and in Rolls to order). Ordering
33 ft would have paid for that 8 ft **twice**: once inside the host roll's length,
and again as its own.

The Piece List total now excludes nested pieces, so it matches the top bar and Rolls
to order. The cut footage isn't lost — when anything is nested, a line underneath
reads "33.0 ft of pieces get cut, but 8.0 ft of that is nested from another roll's
waste — only the 25.0 ft above is ordered", which is what an installer needs while
keeping the order figure honest. Fringe pieces are real material and still count.

Tests **1119 → 1125** (README **1162 → 1168**): a rendered regression case built to
mirror the real job — a 25 ft band with genuine waste plus an 8 ft band nested into
it — asserting the order reads 25 ft and *not* 33 ft, that the cut footage and the
nested portion are both surfaced, and that Rolls to order agrees at 25 ft. These fail
against the previous build (it reported "33.0 ft total linear footage").

---

## 2026-07-14 (cont'd 20) — Butt seams now default OFF: they save nothing on a cut-to-length supply

Confirmed the supplier **cuts rolls to length**. That collapses the trade-off the
(cont'd 16) setting was built around: **butt seams save no material.** Total footage
is identical either way — three 60 ft runs are 180 ft whether that's 3 seamless rolls
of 60 ft or 2 seamed rolls of 100 + 80; the live job is 157 ft in both modes. Seams
only redistribute footage across rolls. They pay off *only* when you must buy
fixed-length rolls and eat the leftover — which doesn't apply here. So seams-on was
pure downside: same order, extra seam.

**"Allow butt seams across roll joins" now defaults to OFF** (fallback, checkbox,
opts, and layout flag all flipped). Every run is seamless, each roll is cut only as
long as it needs to be, and the order total is unchanged. The setting stays for the
case of a fixed-length supply, and the Roll Settings help now leads with when *not*
to use it.

Also simplified **Rolls to order**: the "X ft would go unused on a full roll" column
and the full-roll comparison were noise for a cut-to-length order — dropped. It now
reads "Cut-to-length: order each roll at this length", lists each roll's length and
the total, and (only when seams are on) points out that turning them off would order
the same footage with no seams.

Tests **1117 → 1119** (README **1160 → 1162**): the three roll-count/label/manual-cut
suites now assert seams-**off** as the default and opt in explicitly to cover the
seamed path; the resolver's fallback default is off, a project can override in either
direction, and `false` is still treated as a real value rather than "missing"; the
piece-list render asserts no seam note, no roll padded to 100 ft, each roll at 60 ft,
and the same 180 ft total as the seamed case. The harness's checkbox stub was
flipped to unchecked to mirror the shipped page — the same mock-vs-reality trap
called out in (cont'd 16).

---

## 2026-07-14 (cont'd 19) — "Rolls to order": the length each roll actually needs to be

The Piece List gave total linear footage and a roll count, but never the figure you
order against: **how long each individual roll needs to be**. That gap costs money
with butt seams off, where a roll is deliberately left part-used to keep a run
seamless — the live job needs Roll 1 = 70 ft and Roll 2 = 87 ft, but nothing said
so, so you'd buy two full 100 ft rolls and pay for 43 ft you never lay.

New **Rolls to order** section under the Piece List: every roll with its required
length (rounded **up** to the whole foot — you can't buy 69.4 ft), how much of a full
roll would go unused, a total to order, and a note of what buying full rolls instead
would waste. It follows the butt-seam setting, since that's what decides whether a
roll gets filled end to end or left short.

Backed by a pure `rollLengthSummary(layout)` reading the same
`packPiecesIntoRolls` as the roll count and the labels, so all three agree. Nested
pieces are cut from already-purchased waste and add nothing to any roll's length.

Tests **1094 → 1117** (README **1137 → 1160**): the live 18/10/42/43/44 job in both
modes (seams off → 70 + 87 with 30/13 ft unused; seams on → 100 + 57, no scrap on
the filled roll) and the same 157 ft total either way — only its distribution
differs; 3×60 ft (3 rolls of 60, wasting 40 ft each if bought full, vs 2 rolls
seamed); fractional lengths rounding up (50.5 → 51); nested pieces adding no length;
empty/degenerate layouts safe; plus the summary actually rendering in the piece list.

---

## 2026-07-14 (cont'd 18) — Fix: the butt-seam checkbox didn't do anything

Unticking "Allow butt seams across roll joins" had no effect — the layout still drew
seams, and returning to Settings showed the box ticked again. The setting shipped
(cont'd 16) non-functional.

Cause: `onRollSettingEdit` was written for the four number inputs and read
`parseFloat(el.value)`. On a checkbox `el.value` is the string `"on"`, so
`parseFloat` returned `NaN` and the handler hit its "invalid number" guard on the
third line — bailing out before saving anything, and never reaching
`renderRollLayout()`. The box appeared to untick only because the browser had
already toggled it; nothing was stored, so the next `loadRollDefaultsToInputs()`
repainted it from the unchanged default.

Boolean fields now route separately (`isRollBoolField` / `rollElValue` /
`setRollElValue`): the value is read from `.checked`, the global/project scope
dialog shows "On"/"Off" instead of `true`/`false`, and Cancel restores `.checked`
rather than writing a string into `.value`. A checkbox has no `onfocus` to stash a
previous value, so for a toggle the previous value is taken as the opposite of the
new one.

Tests **1081 → 1094** (README **1124 → 1137**): a checkbox reads `.checked` (not
`parseFloat("on")`); unchecked reads `false` — the value that was being discarded;
number inputs still read `.value`; Cancel reverts the right property for each; and a
project can override butt seams to **off** through `resolveRollSettings` without
`false` being mistaken for "missing" and replaced by the default. These fail against
the previous build.

---

## 2026-07-14 (cont'd 17) — Roll-join butt seams are drawn on the diagram

The seam forced by a roll join was in the numbers and the Piece List but not on the
CAD drawing — no use to a crew working off the diagram. Each forced seam is now
drawn as a **dashed red line** across the strip at exactly the point along the run
where it falls, tagged **"roll join"**. Dashed distinguishes it from your own Cut
Mode seams, which stay solid: one is forced by the roll length, the other is your
decision. Seams are only drawn when "Allow butt seams across roll joins" is on —
with it off there are none to draw, by definition.

Also fixed a real inconsistency introduced in (cont'd 16): `assignRollPieceLabels`
packed **nested** pieces at full length while `countRollsAndPieces` excluded them,
so labels and the roll count could disagree on a job with nesting. A nested piece is
cut from another roll's already-purchased waste and consumes no new roll length, so
it now packs at **zero length** — keeping its place in the sequence and its
"Roll N / Piece M" identity without pushing anything onto a new roll. Nested pieces
are never marked butt-seamed and get no seam line.

Tests **1078 → 1081** (README **1121 → 1124**): a zero-length (nested) entry adds no
roll, holds its sequence position, and is never flagged as seamed. The seam
*drawing* itself is canvas work and isn't reachable by the Node harness — verified
on-device.

---

## 2026-07-14 (cont'd 16) — Butt seams across roll joins are now a setting, not an assumption

**Correction to (cont'd 15).** That entry claimed `ceil(totalLinearFt ÷ rollLength)`
*under-orders*. It doesn't — it's correct **if** you butt-seam across the roll join
(three 60 ft runs on 100 ft rolls really do fit on 2 rolls: 60 + 40 | 20 + 60). The
old math wasn't wrong about the count; it silently **assumed** a seam nobody chose,
and the labels never admitted it. The (cont'd 15) packer then swung to the opposite
extreme — every run seamless — which quietly made every job buy more rolls. Both
behaviours are legitimate; the defect was that the choice was invisible.

New Roll Setting: **"Allow butt seams across roll joins"** (default **on**, matching
long-standing behaviour, so no job's roll count changes on upgrade).

- **On** — a piece that won't fit uses the remainder and finishes on the next roll,
  joined by a butt seam. Fewest rolls, least material.
- **Off** — the remainder is scrap and the piece starts a fresh roll. Every run
  seamless, more rolls.

`packPiecesIntoRolls(lengths, rollLength, allowJoinSeams)` now returns placements
(`{index, length, part, parts}`) rather than bare indices, so a seamed run is
explicit: which rolls it spans and how much comes off each. The roll count, the
"Roll N / Piece M" labels, and the Piece List all read the same packing. The Piece
List spells the seam out — *"butt seam — 2 parts: 40'0" from Roll 1 + 20'0" from
Roll 2"* — so it reaches the person holding the knife. A run longer than a whole roll
is always seamed regardless of the setting; it can't be cut in one piece.

Tests **1050 → 1078** (README **1093 → 1121**): both modes for 3×60 ft (2 rolls
seamed / 3 rolls seamless) at the packer, layout, and label level; the live
18/10/42/43/44 job in both modes with no roll ever exceeding 100 ft; part/parts and
per-roll footage on a seamed run; exact fits (50+50) needing no seam or extra roll;
oversized runs always seamed; cut order preserved; degenerate input safe; and the
Piece List surfacing the seam note. Also fixed the test harness's element mock,
which returned `checked:false` for every unknown checkbox — it was silently
exercising the opposite of the shipped default.

---

## 2026-07-14 (cont'd 15) — Rolls are packed, not divided: pieces can no longer span a roll join

**Material bug.** Reported from a live job: Roll 1 was labelled with pieces of 18 +
10 + 42 + 43 ft = **113 ft on a 100 ft roll**. A piece is cut in one continuous run
and cannot start on one roll and finish on the next.

Two places assumed it could:

1. `assignRollPieceLabels` only started a new roll once the *cumulative* length had
   already passed a roll boundary — it never checked whether the piece **fits** in
   what's left. A 43 ft piece beginning at 70 ft was still labelled Roll 1 and ran
   to 113 ft.
2. `countRollsAndPieces` computed `ceil(totalLinearFt / rollLength)` — pure
   division, which silently assumes turf can be split across the join. **This
   under-counts rolls and under-orders material:** three 60 ft pieces total 180 ft,
   so division says 2 rolls, but only one 60 ft piece fits per 100 ft roll — it
   really needs 3. A crew would have arrived a roll short.

Both now go through one pure `packPiecesIntoRolls(lengths, rollLength)` — next-fit
in cut order, matching how a crew actually rolls out and cuts: when the next piece
won't fit the remainder, that remainder is scrap and the piece starts a new roll.
Labels and the roll count are derived from the same packing, so they can't disagree.

**The old test suite asserted the bug** — including, verbatim, "3 pieces totaling
180ft needs ceil(180/100)=2 rolls" — which is why this survived ~1000 tests. Those
expectations are corrected to physical reality, and the in-app docs (which stated
the same wrong rule and example) are rewritten.

Tests **1031 → 1050** (README **1074 → 1093**): the live 18/10/42/43/44 job packs
into 2 rolls with no roll exceeding 100 ft; 3×60 ft needs 3 rolls; exact fits (50+50
= 100) don't spill to a second roll; 50+51 does; cut order is preserved; an
oversized piece takes its own roll; empty/invalid input doesn't throw. Six existing
tests updated from the divisive assumption to packing.

Note: this can **increase** the roll count on jobs with several long pieces — that's
the correction, not a regression. Ordered SqFt (manual) is unchanged.

---

## 2026-07-14 (cont'd 14) — Edit Shape shows the shape: nested pieces draw at home while editing

Editing a layer whose pieces were nested elsewhere split it into two disjoint things
on screen: the body over in some roll's waste, and the outline with its edit dots
somewhere else entirely. Adding a dashed outline (cont'd 13) made the dots visible
but left the incoherence — you still had to edit one object while looking at another
in a different part of the canvas.

Fix: **while Edit Shape is active, every piece draws at its home position** — the
nest relocation is suppressed at draw time (both the primary's pieces and each
install layer's). Each shape and its points are one object in one place. Nesting is
material accounting (where a piece is *cut from*); editing is geometry (what shape
the area *is*) — so the roll plan, Ordered SqFt, Linear Ft, roll count, and every
nest placement are untouched, and the nesting view redraws the instant you click
"✓ Done Editing".

The dashed per-layer outline + name from (cont'd 13) is kept: it still identifies
which layer each set of dots belongs to.

Tests unchanged at **1031** (README **1074**) — canvas drawing isn't reachable by the
Node harness; verified on-device.

---

## 2026-07-14 (cont'd 13) — Edit dots now always sit on a visible outline

The edit dots for an added (install) layer appeared to float in empty white space
instead of on the shape. They weren't misplaced — they were on the layer's real
outline, but **nothing was drawn there**: an install layer renders its *pieces*, not
its outline, and once those pieces are nested into another roll's waste they're
redrawn over at the target roll. The body moves; the outline stays where the yard
area actually is; the dots look orphaned.

Fix: Edit mode now strokes a **dashed outline** around every visible layer (green
for the primary, blue for the others) and labels each one "<layer name> — outline"
at its centroid. The dots always land on a shape you can see and identify, wherever
that layer lives. Nothing about placement or math changed — this is purely making
the thing you're editing visible.

The dots deliberately do **not** follow the nested pieces: a layer's pieces can nest
into several different rolls, while its outline is a single polygon — it can't be in
two places. The outline stays at the layer's true position, which is the geometry the
points actually describe.

Tests unchanged at **1031** (README **1074**) — canvas drawing isn't reachable by the
Node harness; verified on-device.

---

## 2026-07-14 (cont'd 12) — Install-layer outlines no longer wander away from their pieces

Root cause of the long-running "moved layer edits in the wrong place" bug — and it
was never a coordinate problem. **An install (added) layer's visible body is its cut
pieces, which are always drawn where the roll plan nests them** (they tuck into roll
waste to save material). The layer's polygon is only a *boundary* used to compute
those pieces. So a move offset on an install layer moved the **outline** while the
**pieces** stayed in roll space — the outline (and its edit dots) wandered off into
empty space, away from the shape it was supposed to bound, and the body appeared to
"snap back to the original location."

Fix: install layers carry no move offset. `clearInstallLayerOffsets` zeroes any that
exist — including ones saved by older builds, so stranded outlines snap back onto
their pieces on the next render — and Move Layers now refuses to grab an install
layer, explaining why in the toast instead of silently doing nothing. Layer types
whose drawn body *is* their outline (overlay, subtracted, putting-green, ignore)
are unaffected and still move freely.

Tests **1019 → 1031** (README **1062 → 1074**): install offsets clear while
overlay/putting-green/ignore offsets survive, rotation-only offsets clear, the
helper is idempotent, unmoded layers default to `ignore` and keep their offset, and
null/missing layout doesn't throw. Canvas wiring verified on-device.

**Discoverability — the reason this bug was chased for so long:** the moves were an
attempt to *reduce waste* by dragging layers into roll waste. Move Layers can't do
that (it's cosmetic and never touches Ordered SqFt), and it actively **disables**
nesting — the tool that does. So the mode being used was the one mode that turns the
wanted feature off. The refusal toast now names the right tool ("exit Move Layers and
drag a piece onto a roll's red waste"), and the Move Layers help states plainly that
it doesn't reduce waste and points at nesting.

Note: the earlier (cont'd 11) offset-baking on Edit-mode entry is retained — it's
correct for the layer types that *can* move.

---

## 2026-07-14 (cont'd 11) — Moved shapes are now edited in place, not back at the origin

After moving a layer with Move Layers, entering Edit Shape mode dropped you back at
the shape's pre-move origin to drag its points — the move was saved (it lived as a
separate visual offset in `layerOffsets`), but the edit round-trip kept reverting
the shape to its un-moved canonical position. You couldn't edit the shape where you
actually put it.

Fix: entering Edit mode now **commits** each layer's move offset into its real
points (`commitLayerOffsetsToPoints`) and zeroes the offset, so the moved position
*becomes* the canonical geometry. Vertices are then edited exactly where the shape
sits — what you see is what you edit — with no offset round-trip left to misapply.
The bake re-applies the forward transform (view-rotate → in-place layer-rotate →
translate) and backs out only the view rotation; per-point elevation (z) is
preserved by index. Translation and rotation don't change area or the roll plan, so
this is math-neutral — Ordered SqFt, roll counts, and scrap are unaffected.

One behavior note: once you enter Edit mode, a moved layer's position is baked in,
so the old "reset position" no longer snaps it back to the import origin — the move
is now part of the shape. Re-move it with Move Layers if you need to reposition.

Tests **1005 → 1019** (README **1048 → 1062**): added coverage for
`commitLayerOffsetsToPoints` — translation and primary/secondary paths fold
correctly, offsets zero out, area stays invariant under translation and rotation, a
no-op case reports no change, and z elevation is preserved by index. The Edit-mode
wiring itself (canvas) is verified on-device.

---

## 2026-07-14 (cont'd 10) — Zoom now works while in Move Layers mode

Zoom was a no-op the entire time Move Layers mode was on — you couldn't enlarge
the canvas to place shapes precisely. Cause: Move Layers holds
`_wtFreezeTransform = true` for the whole mode (so dragging one shape doesn't
reflow the canvas or make the others jump), and `sizeLayoutCanvas` bailed out at
the very top whenever that flag was set — *before* it applied the display-size
zoom. The freeze and the zoom are separable: the freeze pins the fitted **bitmap**
(the auto-fit), while zoom is a separate **CSS display scale** on top. The frozen
early-return now still applies the current zoom to the canvas's CSS width/height
before returning, so the fit stays steady while zoom enlarges the view. Dragging
stays accurate at any zoom because `canvasEventToData` already divides cursor
position by the CSS/bitmap ratio. Updated the in-app Move Layers help to note zoom
works while arranging.

DOM/canvas behavior (freeze gating + CSS sizing) isn't reachable by the Node
harness, so tests are unchanged at **1005** (README **1048**) and this is verified
on-device: in Move Layers mode, the zoom controls / Ctrl+Cmd-scroll enlarge the
canvas, shapes still drop where aimed, and other shapes don't jump.

---

## 2026-07-14 (cont'd 9) — Top-bar metrics no longer clip at the right edge

The always-visible layout totals (Installed / Ordered / Linear ft / Perimeter /
Scrap) were pinned to the far right of the tab bar (`margin-left: auto`), so on a
full-width screen the last two (Perimeter, Scrap) ran off the right edge and were
cut off. The strip is now **anchored on the left, immediately after the Settings
tab**, with a divider (`border-left`) and a fixed gap — empty space now lives on
the right instead of clipping the values. Each value field also switched from a
fixed `76px` width to `field-sizing: content` (min 28px / max 170px), so long
readouts like the scrap `"601 ft² (49.5%)"` hug their own width and never truncate;
browsers without `field-sizing` fall back to the default input width (still no clip).

CSS-only change — tests unchanged at **1005** (README **1048**). Verified in-browser.

---

## 2026-07-14 (cont'd 8) — Quiet the benign "ResizeObserver loop" console error

The layout canvas's `ResizeObserver` called `sizeLayoutCanvas()` synchronously,
which resizes the canvas *inside* the observed wrapper — re-entering the observer
in the same frame, which browsers surface as **"ResizeObserver loop completed with
undelivered notifications."** It's benign (no functional effect) but noisy in the
console/preview. The observer callback now defers its resize + redraw to
`requestAnimationFrame`, with a flag that coalesces bursts of resize events, so it
no longer loops within a frame. Added a narrowly-scoped `window` `error` handler
that swallows *only* that exact message as a safety net — it touches nothing else.

Tests unchanged at **1005** (README **1048**): `ResizeObserver` isn't present in the
Node harness, so this is verified in-browser.

---

## 2026-07-14 (cont'd 7) — Removed the duplicate Roll Direction / Seam Offset block from Layers

The Roll Direction + Seam Offset sliders that (cont'd 5) placed at the top of the
Layers tab duplicated the per-layer controls: the primary shape already has its own
**Roll dir / Seam off** sliders (with Horizontal / Vertical) in its Layers-list
card via `setPrimaryRollDirection` / `setPrimarySeamOffset`, and each install layer
has the same. Removed the visible block. The two inputs (`rollRotationInput`,
`rollTranslationInput`) and their value spans stay in the DOM as **hidden state** —
`renderRollLayout` reads rotation/translation from them and
`setPrimaryRollDirection` / `setRollDirection` / auto-rotate write to them, so no
logic had to be rewired. Added an **Auto** (minimize-waste) button to the primary
card, since that button previously only lived in the removed block. Docs updated.

Tests unchanged at **1005** (README **1048**): a markup-only removal — render paths
and element IDs are unchanged.

---

## 2026-07-14 (cont'd 6) — Fix: first-launch crash after moving totals to the top bar

Moving the totals strip into the `.tabs` bar (cont'd 5) made it the last child of
that bar, so `.tab:last-child` — used on first launch to route to the Settings
tab — matched the metrics strip (not a `.tab`) and returned null. `switchTab(name,
null)` then threw **"Cannot read properties of null (reading 'classList')"** on a
fresh load with no saved data. Gave the Settings tab a stable `id="tabSettings"`
and select it by id, and null-guarded `switchTab` (it now falls back to finding
the tab by its onclick target and skips the panel if absent) so a missing element
can never crash tab routing again.

Tests unchanged at **1005** (README **1048**): the first-launch/onload path isn't
exercised by the headless harness — its DOM stubs never return null — so this was
verified by removing the null source and guarding the consumer.

---

## 2026-07-14 (cont'd 5) — Layout: totals moved to the top bar; Roll & Seam folded into Layers

Moved the five live layout totals — **Installed SqFt, Ordered SqFt, Ordered
Linear Ft, Perimeter, Scrap** — out of the right pane and into the **top toolbar**,
just right of the ⚙ Settings tab, so they stay visible on every tab (the strip
scrolls horizontally on narrow screens). The readouts keep their element IDs
(`layoutArea`, `rollOrderedOut`, `rollLinearOut`, `layoutPerimeterOut`,
`rollWasteOut`), so the existing render logic writes to them unchanged; the
overlay/nest warnings stay in the right pane, in context. Removed the separate
**Roll & Seam** sub-tab and merged its Roll Direction + Seam Offset controls into
the top of the **Layers** tab — **Layers is now the default sub-tab**, and the
fringe-tab fallback points there. With the metrics block gone, the sub-tab row
(Layers, Results, Apply, Display, Fringe) sits higher. In-app docs updated.

Tests unchanged at **1005** (README **1048**): a layout/markup restructure — the
render code paths and IDs are unchanged, so the suite covers the logic as before;
the visual layout is verified on-device.

---

## 2026-07-14 (cont'd 4) — Move Layers: grab the shape you clicked (topmost) + "Moving:" confirmation

With several shapes arranged into one yard, dragging a layer could grab a
*different* shape sitting underneath the one you clicked. The hit-test scanned
secondary layers low-index-first, but they're *drawn* low-index-underneath, so on
an overlap the bottom shape won. Moving that hidden shape while the one you aimed
at stayed put looked like "the layer snaps back where it was." The hit-test now
resolves **top-down** — `pickTopLayerIndex`, extracted from `startDragLayer` so it
can be unit-tested — so the shape you see under the cursor is the one that moves.
Added a brief **"Moving: &lt;layer&gt;"** toast on grab so you can confirm which
layer you picked up. Also hardened the visibility guard against a missing
`layerVisibility` map.

Tests **998 → 1005** (README **1041 → 1048**): `pickTopLayerIndex` returns the
higher (top) index when shapes overlap, grabs the lower layer when only it is hit,
skips hidden layers, ignores degenerate/absent polygons, and returns -1 off every
shape.

---

## 2026-07-14 (cont'd 3) — Move Layers: view stays put so shapes stay where you drop them

Dragging a layer in Move Layers mode dropped it, then the canvas immediately
**re-fit to frame everything** — rescaling and recentering the whole view, so the
layer appeared to jump somewhere other than where you placed it. You couldn't
spread shapes out to lay out a full yard because every release reflowed the view.
The freeze that held the view steady only lasted for the duration of a single
drag (`endDragLayer` set `_wtFreezeTransform = false` on drop, and the next render
recomputed the fit). Now the view is **held steady for the entire Move Layers
session**: `endDragLayer` keeps the frozen transform while the mode is active, and
`toggleMoveLayersMode` re-freezes right after its initial fit. Each dropped shape
stays exactly where you put it. Added a **⤢ Fit view** button (shown only in Move
Layers mode) backed by `fitLayoutViewNow()` to re-frame everything on demand when
shapes spread past the edge; exiting the mode ("✓ Done Moving") re-fits as before.
In-app docs and the mode hint updated.

Tests unchanged at **998** (README **1041**): a canvas-interaction fix, verified
on-device — the freeze/re-fit timing isn't headlessly testable.

---

## 2026-07-14 (cont'd 2) — Fix: Print / PDF still printed nothing (iframe wasn't laid out)

The previous fix moved printing into a hidden `<iframe>`, but styled it
`visibility:hidden; width:0; height:0`. Chromium/Electron don't lay out or paint
a zero-size, visibility-hidden iframe, so `contentWindow.print()` fired on an
empty render — the dialog showed a blank page or never opened. Changed the iframe
to render **off-screen at a real page size** (`position:fixed; left:-10000px;
width:816px; height:1056px`, no `visibility:hidden`), so its document is fully
laid out and prints. Print-document assembly and the diagram capture are
unchanged.

Tests unchanged at **998** (README **1041**): a print-rendering fix, not
headlessly verifiable — confirmed by printing a real job on-device.

---

## 2026-07-14 (cont'd) — Fix: Cut List "Print / PDF" printed a blank page

The first cut of the Print/PDF button used an `@media print` stylesheet that hid
every element except an off-screen print node — but that node lived **inside the
`.app` wrapper**, and the "hide everything else" rule hid `.app` (and with it the
print node), so the dialog opened on a blank page. `display:block` on the node
couldn't override an ancestor set to `display:none`. Rewrote it to render the
sheet inside an **isolated hidden `<iframe>`** with its own self-contained
document and styles: immune to the app's DOM nesting and CSS, works in the
Electron app and on GitHub Pages, still no PDF library. The print document is now
assembled by a pure `buildCutListPrintDoc()` (job header, optional roll-layout
diagram, cut list) so it's unit-testable; printing waits for the base64 diagram
image to decode before opening the dialog. Removed the dead `#cutlistPrintRoot`
node and the `@media print` block.

Tests **989 → 998** (README **1032 → 1041**): `buildCutListPrintDoc` returns a
standalone document carrying its own `:root` vars and `@page` margins, embeds the
job name and cut list, shows the diagram section only when an image is supplied,
and has valid defaults with no args.

---

## 2026-07-14 — Cut List: S-seam cut width + Print / PDF for installers

**Cut width now accounts for the S-Seam Side Trim.** The Cut List's per-piece
"× wide" figure was showing the *trimmed footprint* width (e.g. 14'8" = the 15'
roll minus the 4" side trim), but installers cut the **full roll width** and
trim the S-seam edge on site. New `seamCutWidth(footW, sideTrim, rollWidth) =
min(footW + sideTrim, rollWidth)` makes the displayed width the **cut** width: a
full-coverage strip now reads the full **15'0"** with a "cut full width, trim
S-seam on site (covers 14'8")" note, while a genuinely narrow filler strip keeps
its own width plus the same allowance, never exceeding the roll. The CAD drawing
still shows the trimmed footprint at installed size. `buildCutList` attaches
`cutW` per piece (deriving the trim from the layer's own setting, the parent
layout, or `effW` as a fallback); `renderCutListHtml` falls back to the
footprint width if `cutW` is ever absent.

**🖨 Print / PDF button in the Cut List dialog.** Builds a one-shot printable
sheet — job name, install address/date, the current roll-layout diagram
(captured from the canvas via `toDataURL`), and the full cut list — then opens
the print dialog for **Save as PDF** (or a printer) to hand installers. Done
with an `@media print` stylesheet (`.printing-cutlist` on `<body>` plus an
off-screen `#cutlistPrintRoot`), so it needs no PDF library and works in the
Electron app and on GitHub Pages. Each cut piece is kept whole across page
breaks; only the sheet prints, not the rest of the app.

Tests **976 → 989** (README **1019 → 1032**): new `seamCutWidth` section
(full-width caps to 15', narrow strips gain the 4" allowance, a zero-trim
setting leaves width unchanged, and the effW + trim = roll invariant) plus
cut-list render assertions for the new cut-width text and the "trim on site"
note. In-app Cut List docs updated for both the cut-width behavior and Print/PDF.

---

## 2026-06-21 (cont'd, 81) — Fix: cut list showed roll width (15.0) instead of the real cut size

The per-piece cut text read "Cut 15.0 × 13.0 ft off the roll" — the **15.0 was the full roll width**,
printed for every piece even though each trimmed piece is narrower, and it didn't say which number was
length vs width. Now it reads **"Cut {length} long × {width} wide"** using the piece's actual footprint
(`footL` along the roll, `footW` across it) in feet-and-inches, matching the dimensions already drawn on
the diagram (e.g. "Cut 12' long × 7' 10" wide"). The explanatory note and in-app docs were updated to
spell out that length runs along the roll (horizontal) and width across it (vertical); the misleading
"full roll width × ordered length" wording is gone.

Tests **973 → 976** (README **1019**): assert the cut text uses actual ft-in length × width, no longer
shows 15.0, and drops the old "off the roll" line. Confirmed against the screenshot's pieces headlessly.

---



Replaced the fixed ~82vh height cap (cont'd 79) with a **measured** one. `sizeLayoutCanvas` now reads
the canvas wrapper's actual on-screen top (`getBoundingClientRect().top`) and caps the canvas to
`window.innerHeight − top − 14px` — the exact space remaining below it — and sets the wrapper's
max-height to match. So the whole shape shows at 100% with **no vertical scroll**, adapting to the
real monitor/window size (accounts for the toolbar, zoom row, etc. stacked above the canvas). Aspect
ratio preserved (tall shapes letterbox). Added a throttled `window` resize handler so a height-only
resize re-fits too (the wrapper ResizeObserver only caught width changes).

Verified headlessly: wrapper 330px down on a 1000px screen → 656px-tall canvas; 300px down on an
800px screen → 486px; wide shapes still fill width. Suite unchanged at **1016** (sandbox 973).

---



Follow-up to cont'd 78. The canvas fit was **width-only**, so after widening the container a tall
shape (e.g. a narrow triangle) scaled up to fill the width and ran off the bottom of the view.
`sizeLayoutCanvas` now **fits to the box**: it caps the canvas height at ~82vh and shrinks the width
proportionally (preserving aspect), so a tall shape shows fully — letterboxed horizontally — at
100%/Fit. Wide shapes are unchanged (still fill the width). `drawRollLayoutCanvas` already fit-to-box
into the canvas dimensions, so the two stay consistent and all drag/edit transforms remain accurate.

Verified headlessly: a 20×60 (tall) shape → 278×820 canvas (height capped, aspect preserved); a 60×20
(wide) shape → 1400×488 (fills width). Suite unchanged at **1016** (sandbox 973).

---



The layout canvas fits to its container's width, so this widens that container three ways:

- **Collapsible project-list nav (desktop).** A **«** button at the top of the left sidebar collapses
  it to a thin 40 px rail; **»** brings it back. The state is remembered (`wt_navCollapsed`), and the
  canvas re-fits to the new width on toggle. Mobile keeps its existing ☰ drawer, untouched.
- **Narrower right field pane** — the layout grid's right column went from `clamp(300px,30vw,440px)`
  to `clamp(280px,24vw,360px)`, handing the width to the canvas.
- **Taller canvas box** — the canvas wrapper's max-height went 80vh → 86vh.

No logic touched; suite unchanged at **1016** (sandbox 973). The collapse toggle/persist/restore was
verified headlessly; the sizing is visual and needs on-device confirmation on both desktop and iPad.

---



Applied cont'd 76's treatment to the Installer Sheet too: misc items now read **name: quantity — notes**
(unit dropped, note resolved via `miscItemNotes` the same way). Both exports are now consistent.
Suite unchanged at **1016** (sandbox 973; the installer misc assertion updated for the new format).

---



On the Supplier Order, misc items now read **name: quantity — notes** instead of **name: quantity unit**:
- **Unit dropped** — just the quantity.
- **Notes added** — from the item's own stored notes, falling back to the matching Settings misc
  catalog item by name. Notes are now copied onto a misc item when it's added from the catalog, and a
  one-off custom item (not in the catalog) simply shows no note.

Only the Supplier Order changed; the Installer Sheet still shows misc items with their unit. New pure
`miscItemNotes(item, catalog)` helper. Tests **968 → 973** (README **1016**).

---



The Supplier Order now adds a **Benderboard stakes** line whenever there are edging boards: **20 stakes
per board** (`STAKES_PER_BOARD` constant), quantity shown as e.g. "120 (20 per board × 6)". The stakes
**color matches the selected edging material's color** — if no material is picked, or it has no color,
the stakes print without one. No stakes line when there's no edging.

Tests **967 → 968** (README **1011**). Color-matched and no-material cases verified headlessly.

---



**Supplier Order**
- Turf now lists by its **Vendor Product Name** (`tdName` from Settings) instead of the internal name,
  falling back to the internal name when no vendor name is set.
- Removed the "rock is ordered separately" note (rock is still excluded from the list).

**Installer Sheet**
- Added an **Infill** section (product + bags) and an **Edging** section (material + boards + linear ft).
- Added two fixed sections: **Waterloo Turf provides** — turf, infill, edging, stakes, and screws;
  **Turf installer provides** — rock, weed cloth, 12" seam tape, adhesive, 6" non-galvanized nails,
  install labor, and equipment.

**Edging Materials catalog (new)**
- Settings → **Edging Materials**: add/edit/delete materials with **name, color, notes, and price per
  20 ft board** (uses the same catalog-item modal as turf/infill/rock).
- Quote Builder → Edging card has an **Edging Material** dropdown. The selected material's price drives
  the edging materials cost in the quote (overriding the crew's board rate; no selection falls back to
  that rate — backward compatible). The material's name + color print on the Supplier Order and
  Installer Sheet.
- New helpers: `turfVendorName`, `getProjectEdgingMaterial`, `edgingMaterialLabel`, `edgingBoardCost`,
  plus `edging` added to the catalog defaults/`getCatalog`.

Tests **954 → 967** (README **1010**): 13 assertions on the resolvers (vendor-name fallback, edging
lookup/label/price-override/crew-fallback), and the section-72 export tests updated for the new
content (vendor name, no rock note, infill/edging/provides sections). Full supplier + installer output
verified headlessly.

**Note on pricing unit:** the edging material price is **per 20 ft board** (matches the existing boards
model). Say so if you'd rather price edging per linear foot.

---



Replaced the "stamp $150 into new projects" model with a resolver, matching how roll settings work
and the actual workflow (standard $150 on every job, change it for one-offs).

- **`resolveShipping` now returns the Settings default unless the project overrides it.** Missing or
  blank shipping → the default; an explicit number (including **0** for free freight) → a per-job
  override. So *every* project — old or new — follows the $150 standard automatically; no more
  old-vs-new split.
- **New projects are no longer stamped** with a baked-in value (`createProject` seed removed), so they
  follow the default like everything else.
- **Quote Builder field:** blank = use the default (placeholder shows it, e.g. "150 (default)");
  enter a number to override this one job; clear it to revert. `setProjectShipping` deletes the
  override on blank.
- **Changing Settings → Default Shipping updates every non-overridden project live** (`updateDefaultShipping`
  refreshes the placeholder + recomputes the open quote).
- New `projectOverridesShipping` helper.

Tests **945 → 950** (README **993**): section 76 rewritten for resolver semantics (missing/blank/null
→ default, override wins, explicit 0 respected, negative clamped, override-detection). The 13
end-to-end COGS scenarios now seed `wt_shippingDefault=0` so they stay shipping-neutral (that they
shifted by exactly +$150 first confirmed shipping is correctly flowing into COGS).

**Migration note:** any project created under cont'd 72 has $150 *baked in as an override*; it'll show
150 in the field and won't follow default changes until you clear that field. Truly-old projects and
all new ones follow the default automatically.

---



New projects now carry a **shipping / freight** cost, defaulting to **$150**, editable per project and
added to every quote option.

- **Configurable default (not hardcoded).** Settings → **Default Shipping** holds the seed value
  ($150 out of the box). New projects inherit it; change it once when your freight rate changes
  instead of editing every project. It only affects projects created afterward.
- **Per-project edit** on the Quote Builder tab (Quote Options card) → `proj.shipping`.
- **In COGS**, so your profit margin applies to it like every other line; it shows as its own
  "Shipping / freight" line in each option's breakdown, identical across scenarios (freight is
  per-delivery, not per-combo).
- **Existing projects are protected.** `resolveShipping` treats a missing/blank shipping field as
  **$0**, so quotes saved before this change are never silently bumped — the field is blank until you
  enter a value. Only newly created projects seed the $150 default.

Tests **937 → 945** (README **988**): 8 assertions on `resolveShipping` (explicit value, missing→0,
blank/null→0, negative clamped, string parsed) and the $150 fallback of `getDefaultShipping`.

---



**Live link — Installed SqFt follows the shape.** The Live link now keeps *both* fields on the
selected row in sync, each with its own no-op guard:
- **Ordered SqFt ← roll plan** (moves with rotation / seam offset), as before.
- **Installed SqFt ← shape area, role-aware** (Base Yard adds the putting-green footprint; Alt Turf
  rows are skipped, priced on base). Updates when the shape/exclusions change and cascades to infill,
  rock, and labor.

Because installed is gated on area, rotation/seam changes are a no-op for it — so materials don't
churn while you compare roll options, honoring the earlier "rotation = ordered only" rule while still
making installed auto-live on shape edits. Verified headlessly: rotation moves ordered only
(installed held), a shape-area change moves both, alt rows skip installed, and the toggle-off path
writes nothing.

**Layout tab scrolling — one scroll region, canvas pinned.** The right-hand field pane no longer has
its own scrollbar; it scrolls with the page while the canvas pane (already `position:sticky`) stays
pinned, so the shapes don't drift out of view while you scroll the fields. Removed the sidebar's
`overflow-y:auto` + `max-height`; the topbar and tabs sit outside the scroll region so they stay put.
On phones / iPad-portrait (≤860px) the canvas reverts to static so it doesn't eat the screen.

Suite unchanged at **980** (sandbox 937) — behavior is DOM/CSS-coupled; the sync math was verified
headlessly and the layout change is visual (needs on-device confirmation).

---



Replaces the manual "Apply Ordered SqFt" click with an optional live link. A **🔗 Live** checkbox
(on by default, saved per project) under *Apply Ordered SqFt* pushes the roll layout's Ordered SqFt
to the selected turf row automatically whenever roll **rotation** or **seam offset** changes.

- **Ordered only — by design.** It writes `sqFtToOrder` and never touches `installedSqFt`, so infill,
  rock, and labor stay tied to the shape's area (rotating rolls changes what you *buy*, not what you
  *cover*). This also means far less churn than a full re-apply: only turf material cost moves.
- **Fires on release, not mid-drag.** A 250 ms debounce plus a freeze-flag guard defers the sync
  until you let go of a slider, so it never rebuilds the turf-row DOM while a slider is held (the
  known slider-breaking pattern). No-op when the value is unchanged, so no needless re-render.
- Targets the row chosen in the existing *Apply Ordered SqFt* dropdown; the manual button stays as a
  fallback. Combined install-layer totals are respected (`_combined.ordered`).
- **Known gap (documented, not silently handled):** the link does *not* set Installed SqFt, so a new
  shape still needs Installed applied once (import or the Installed button) or infill/rock/labor read
  stale; and editing the shape won't refresh Installed through this link.

Tests **931 → 937** (README **980**): 6 assertions on the pure `orderedFromLayout` (single vs
combined, 0.01 rounding, null/zero handling). The ordered-only write, toggle-off no-op, combined
totals, and no-churn-on-unchanged were verified headlessly (DOM-coupled path).

---



The Draw tool could only make markup. Now a **⬒ Make Layer** button in the draw toolbar converts
the selected closed shape (Rectangle / Circle / Freehand — Lines are skipped, no area) into a full
**Install** layer: perimeter, installed sqft, ordered sqft, and a roll layout, exactly like an
imported layer. On convert it drops Draw mode and opens the Layers list so those numbers are visible;
the layer starts with no turf assigned (pick one there to get ordered sqft + pricing).

- **Correct placement under view rotation.** Drawn shapes live in the display frame; a layer stores
  canonical points that get view-rotated back. The new `annotationToLayerPoints` helper inverse-rotates
  by −viewRotation about the view centroid so the layer lands exactly where it was drawn — verified to
  machine epsilon (round-trip error ~1e-15) at 0/15/37/−50/90°.
- The markup annotation is consumed (removed) once converted, so it isn't drawn twice.
- Button is disabled unless a ≥3-point shape is selected; a Line selection shows a "needs area" toast.
- Freehand keeps every captured point, so its roll layout can have many small pieces — noted in the
  in-app docs; Rectangle/Circle or a deliberate outline cut cleaner.

Tests **920 → 931** (README **974**): 11 assertions on the coordinate frame — identity at
viewRotation 0, no source mutation, area = 240 sqft for a 20×12 rect, and round-trip + area-invariance
across four rotations. End-to-end convert (layer created with mode=install, offset zeroed, annotation
removed, Line blocked) verified headlessly.

---



The app already had a real mobile layout (hamburger drawer, 860px breakpoint, sideways-scrolling
data grids, 92vw modals). This pass closes the most common iOS annoyances — all CSS, no logic, so
the suite is unchanged at **963** (sandbox 920); the visual result needs on-device confirmation.

- **No more zoom-jump when tapping a field.** iOS Safari zooms the page whenever you focus an input
  under 16px. A `@media (pointer: coarse)` rule forces all inputs/selects/textareas to 16px (over
  inline sizes), so tapping any field on iPhone/iPad no longer yanks the viewport around.
- **Bigger × buttons on touch** — per-row remove buttons go 32→40px so they're easier to hit.
- **Momentum scrolling** on the data grids, tab strip, canvas wrapper, and modals.
- **`text-size-adjust: 100%`** stops iOS from auto-inflating text in landscape.

Deferred (need your eyes / a decision): iPad **portrait** currently gets the phone drawer layout
(≤860px) — could keep the two-pane desktop layout instead; broader tap-target sizing on the dense
layout toolbar; and whether the wide turf/infill/rock rows should stack on iPhone instead of
scrolling sideways.

---



Reordered the Quote Builder tab so the **Materials Summary** card sits just **above** the Quote
Options section instead of below it — ordering reference is visible before you scroll into the
generated quotes. No logic change; suite unchanged at **963** (sandbox 920).

---



- **Removed the Materials tab.** Its two cards now live in the Quote Builder tab for one-screen
  reference: **Rock / Base** sits right after Infill (the natural material grouping), and the full
  **Materials Summary** sits at the bottom under Quote Options. The tab button is gone; nothing else
  moved. `switchTab` refreshes the summary when you land on Quote Builder (it was already refreshed
  on every render, so this is just belt-and-suspenders).
- **Rock now shows cubic yards alongside tons.** The Rock / Base card gained a **Cu. Yards** column,
  and the Materials Summary shows rock as "N yd³ · N tons." Cubic yards is the raw volume
  (sqft × depth ÷ 27); tons is that × 1.4 density — **tons values are unchanged**, yards is derived
  from the same calc. New pure `rockQuantities(sqFt, depth)` helper.

Tests **901 → 920** (README **963**): 19 new assertions confirm tons match the previous formula
across five sqft/depth pairs, yards equal the raw volume, yards < tons at 1.4 density, and blank/zero
inputs yield 0 with no NaN. In-app docs and nav updated (the "Materials Tab" section is now "Rock &
Materials Summary" and every stray "Materials tab" reference was repointed to the new location).

---



New **Job Info & Exports** card at the top of the Quote Builder tab. Three per-project fields —
Job Address, Delivery Date, Install Date — plus two copy-to-clipboard exports. (No Jobber
integration: the app is a single static file with no backend, so address/dates are entered here.)

- **📦 Supplier Order** — job, delivery address, delivery date, and every orderable material with
  its quantity: turf (ordered sqft + linear ft @ 15 ft roll), infill (bags), bender board edging
  (boards), and misc items. **Rock is excluded** by design (sourced separately) and noted at the
  bottom.
- **🔧 Installer Sheet** — job, install address, install date, turf to install **per product** with
  each installed sqft (base yard, putting green, etc.), and all misc items with quantities.
  Alt-turf rows (no separate install area) are omitted.
- Both open a panel with the formatted text and a **⎘ Copy** button — paste straight into an email.
- New fields persist on the project (`address`, `deliveryDate`, `installDate`) and reload with it.

Pure, DOM-free builders `buildSupplierOrderText` / `buildInstallerSheetText` / `fmtExportDate` —
**+24 sandbox tests** (now **901**, README **944**) covering ordered-qty formatting, rock
exclusion, per-product install sqft, alt-turf omission, zero-qty skipping, multi-line address
flattening, and empty/null graceful degradation.

---



Editing a shape's points previously only worked via double-click — which never fired on touch
(iPad) and is finicky to land on an exact point. Now there's an explicit, single-tap path.

- **Point tool in Edit mode.** Entering Edit mode shows a <strong>Point tool</strong> row:
  <strong>✥ Move</strong> (drag points, the default), <strong>➕ Add</strong> (one click/tap on an
  edge inserts a point), <strong>➖ Delete</strong> (one click/tap on a point removes it). Same
  gesture on desktop and touch — no double-click required. The 3-point-minimum floor still holds.
- **Touch double-tap** also works as a shortcut in Move mode (mirrors the desktop double-click),
  so the old muscle memory still adds/deletes on an iPad.
- Refactored the shared delete/add logic into `editDeletePointAtCanvas` / `editAddPointAtData`;
  the double-click handler now calls the same helpers, so all three entry points behave identically.

Test suite unchanged at **920** (sandbox 877) — the new paths are DOM/touch-coupled and were
verified headlessly: delete-mode click removes a point (5→4), add-mode click on an edge inserts
one (4→5), move-mode click still starts a drag, and deleting at 3 points is blocked.

---



Test suite unchanged at **920** (sandbox 877) — canvas/scroll changes verified headlessly: a long
label whose pieces sit in the top-right corner clamps to x≈434 (inside the 600-wide canvas), and
a pan drag scrolls the wrapper by the drag delta while standing down when content fits or a piece
is grabbed.

- **Labels no longer get cut off at the edges.** The primary and secondary layer name/area labels
  now clamp to the canvas bounds (like the piece labels already did), so a label whose pieces sit
  against the top/right waste stays fully readable instead of running off the edge.
- **Pan a zoomed-in layout.** The canvas wrapper is now a fixed-height scroll viewport
  (max-height 80vh). In idle mode, dragging an empty part of the canvas scrolls/pans it (cursor
  shows a hand when there's room to pan); grabbing a piece still nests it. Touch uses native
  one-finger scroll. Scrollbars / two-finger scroll work too. Pan won't fire when everything
  already fits.
- Canvas size is also held during a layer drag (the frozen-transform guard added to
  `sizeLayoutCanvas`), so panning/zoom state doesn't fight an in-progress move.

---



Test suite unchanged at **920** (sandbox 877) — both fixes are in canvas/sizing code the pure
harness can't render. Verified headlessly: at 2× the internal canvas stays 600 while CSS width
doubles to 1200; an install layer's label lands on its drawn pieces (x≈493) not the outline
centroid (x≈87).

- **Zoom (＋ / －) now scales properly.** `#rollLayoutCanvas` had `max-width:100%`, which clamped
  the display so zooming in couldn't enlarge it, and labels were fixed-pixel so they never
  scaled. Now `sizeLayoutCanvas` keeps the internal resolution at the 1× fit and sets the CSS
  display size to `fit × zoom`, so the browser scales the whole bitmap — shapes and labels grow
  and shrink together — and the wrapper scrolls when zoomed past its width. `canvasEventToData`
  already maps via `canvas.width/rect.width`, so pointer hit-testing stays correct at any zoom.
- **Canvas size now holds during a layer drag.** `sizeLayoutCanvas` also bails while
  `_wtFreezeTransform` is set, so the view no longer resizes mid-drag against the frozen
  transform (which shifted everything vertically).
- **An install layer's label follows its pieces.** When a layer's pieces are nested into roll
  waste, its outline isn't drawn there anymore — but the name/area label was still anchored to
  the outline centroid, so it stayed behind. The label now anchors to the centroid of the
  layer's actually-drawn pieces (their relocated positions when nested), so it travels with
  them. Non-install layers and un-nested install layers are unchanged.

---



Test suite: **920** (sandbox 877, +4), data-dependent 43. New `pasteOffset` cases in section 70;
the snap-on / off-grid-origin / snap-off paths verified headlessly (corner lands on grid, size
preserved in every case).

- **Bug:** Paste always offset the copy by a fractional `16/scale` ft, so with snap on the
  pasted shape landed off the grid even when the original was on it.
- **Fix:** extracted pure `pasteOffset(pts, nudge, step)`. With snap on it translates the whole
  shape (no distortion) so the bbox corner lands on a grid intersection and it's offset by at
  least one whole grid cell; an off-grid original gets its corner pulled onto the grid. Snap off
  keeps the plain nudge. Size is preserved in all cases.

---



Test suite: **916** (sandbox 873, +10), data-dependent 43. New section 71 covers `ftIn`
(feet-inch formatting) and `cutPieceSvg` (valid SVG, dimension labels present, degenerate
piece safe). Drawings rendered from real rect/L/triangle layouts and eyeballed via a preview.

- The cut list dialog now shows a **drawing per piece** instead of a plain table: each card has
  a CAD-style SVG of the piece's <strong>actual trimmed footprint</strong> with overall
  <strong>width × length dimension lines</strong> (arrowheads + feet-inch labels), plus the cut
  size and turf area beneath. Irregular pieces draw amber and keep the <em>trim to shape</em>
  tag; nested pieces keep the <em>nested</em> tag. Per-layer subtotals + grand total unchanged.
- `buildCutList` now also returns each piece's normalized footprint polygon (`poly`, roll-frame,
  translated to origin). New pure helpers `ftIn(feet)` and `cutPieceSvg(piece)` build the
  drawing as a string; `renderCutListHtml` lays the cards out in a wrapping flex grid.
- Dimensions are the footprint bounding box (real measured data); the drawing is the true
  clipped outline, so rectangles look rectangular and corner/triangle pieces show their real
  shape.

---



Test suite: **906** (sandbox 863, +4), data-dependent 43. New section 70 covers `snapPt`;
copy/paste duplication, paste offset, snap-on-create, and snap-on-move (whole grid steps)
verified headlessly through the real handlers.

- **Sticky toolbar:** the draw toolbar is now `position:sticky; top:0` with a shadow, so it
  stays pinned to the top while you scroll/draw instead of scrolling out of view.
- **Copy / Paste:** ⧉ Copy / ⎘ Paste buttons (enabled by selection / clipboard) plus
  Ctrl/Cmd+C / Ctrl/Cmd+V, and Delete/Backspace to remove — bound once via a draw-mode-scoped
  keydown listener. Paste deep-clones the shape, offsets it a zoom-consistent nudge
  (16px/scale), and selects it. Clipboard persists for the session.
- **Snap to grid:** toggle in the toolbar (persists on `proj.layout.drawSnap`). Snaps new shape
  points, moves (whole grid steps), and the resized corner onto the grid spacing from the
  Display tab; rotation snaps to 15°. Grid lines sit at data multiples of the spacing, so
  snapping lands exactly on the visible grid.
- Implementation: pure `snapPt`/`drawSnapStep`; `copySelectedAnnotation`/`pasteAnnotation`;
  `toggleDrawSnap`; `updateAnnoDeleteBtn` extended to drive Copy/Paste/Delete enablement; snap
  applied in the create + select-transform handlers; snap state restored on render and on
  entering draw mode.

---



Test suite unchanged at **902** (sandbox 859). Fix verified headlessly: `drawRollLayoutCanvas`
called with `null`, `undefined`, and `{}` no longer throws, and exiting draw mode with no
current layout is safe.

- **Bug:** entering then exiting Draw mode before importing a CSV threw an opaque
  `Uncaught Error: Script error.` The draw-mode-exit redraw called
  `drawRollLayoutCanvas(window._wtCurrentRollLayout)` with a null layout, which hit
  `assignNestPlacements`/`layoutFitPoints` and threw.
- **Fix:** `drawRollLayoutCanvas` now clears the canvas and returns early when there's no
  usable layout (`!layout || !Array.isArray(layout.strips)`), plus a guard for empty fit
  points. This protects every caller that can run before a layout exists — draw-mode exit,
  the grid toggle, and all annotation edits.

---



Test suite: **902** (sandbox 859, +9), data-dependent 43. New section 69 builds real
layouts via `computeRollLayout` and checks `buildCutList` totals (rect sums to 1200 ft²,
L-shape to 900 ft², trim flag fires, cut width = roll width, empty layout → empty list).

- **📋 Cut List** button (toolbar, works when locked) opens a dialog listing every physical
  turf piece across all install layers. Per piece: <strong>Cut from roll</strong> (roll width ×
  ordered length, incl. cutting margin), <strong>Covers</strong> (turf footprint bounding box,
  W×L), and <strong>Turf area</strong>. Tags: <em>trim to shape</em> (coverage doesn't fill the
  rectangle) and <em>nested</em>. Per-layer subtotals + grand total for multi-layer jobs.
- Pure `buildCutList(layout)` reads the same strips/pieces drawn on canvas (`s.pieces || [s]`),
  using each unit's roll-frame `clipped` polygon for the real footprint and `orderedLength` for
  the cut — so it always matches the canvas and the order math. `renderCutListHtml` +
  `openCutListModal` handle display; new `cutListModal` mirrors the docs-modal pattern.
- Framed explicitly as a *cut* list, separate from roll/area *order* quantities (which stay on
  the layout panel + Materials tab), so the two aren't confused.

---



Test suite: **893** (sandbox 850, +11), data-dependent 43. New section 68 covers the pure
transforms (`translatePoints`, `scalePointsAbout`, `rotatePointsAbout`, `annoBBox`,
`annoHandles`, `annoHitTest`); the full select→move→resize→rotate→delete flow verified
headlessly through the real mouse handlers.

- Draw toolbar gains a <strong>↖ Select</strong> tool and a <strong>🗑 Delete</strong> button.
  With Select active: click a shape to select it (dashed box + corner handles + a rotate knob);
  drag the body to <strong>move</strong>, a corner to <strong>resize</strong> (about the opposite
  corner), or the top knob to <strong>rotate</strong> (about center). Click empty space to
  deselect.
- Color/width inputs now edit the selected shape live (and the toolbar syncs to a shape's
  color/width when you select it). Delete button enables only when something is selected.
- Transforms are baked into the shape's points (no separate transform state), so everything
  still saves as plain `{points}`. Known v1 limit: resizing an already-rotated shape scales in
  world axes (can skew) — documented in-app.
- Implementation: handlers branch on the `select` tool ahead of shape creation; pure helpers
  added; selection box/handles drawn in the annotation pass of `drawRollLayoutCanvas`; selection
  cleared on draw-mode exit. Still markup only — never touches turf, rolls, or the quote.

---



Test suite: **882** (sandbox 839, +9), data-dependent 43. New section 67 covers
`drawShapePoints` + `annotationHasSize`; draw-handler append/undo and grid persistence
verified headlessly.

- **✏️ Draw** button in the Layout toolbar opens a drawing toolbar: <strong>Line</strong>,
  <strong>Rectangle</strong>, <strong>Circle</strong>, <strong>Freehand</strong>, a color
  picker, line width, optional fill, plus Undo / Clear / Done. Drag on the canvas to draw.
  Shapes are stored in <strong>data (feet) coordinates</strong> on `proj.layout.annotations`,
  so they scale and stay anchored through zoom/rotation, and persist per project.
- **Markup only:** drawn shapes never touch turf area, rolls, or the quote — that's a
  deliberate guard so free-drawing can't silently move the money. (A future "convert to
  cutout" can bridge to real cutouts.) Draw is mutually exclusive with Edit/Move/Cut and is
  disabled when the layout is locked.
- **Reference grid:** Display tab gains <strong>Show grid</strong> + <strong>Grid spacing
  (in)</strong> — a to-scale graph-paper overlay drawn behind the layout (data-aligned, density
  capped for performance). View-only; stays usable when locked.
- Implementation: pure `drawShapePoints(type,start,end)` + `annotationHasSize`; draw mouse/
  touch handlers wired ahead of the edit/move/cut/nest dispatch; grid + annotation passes
  added to `drawRollLayoutCanvas` (grid behind, annotations on top). State restored on render.

---



Test suite: **873** (sandbox 830, +5), data-dependent 43. New section 66 covers
`layerPerimeters`; values verified against Michel_yard.csv.

- The **Layers** tab now shows an <strong>Edging perimeter (per layer)</strong> block: the
  boundary length of every measured shape (main outline + each cutout — tree wells, beds,
  paver borders) and a <strong>Total — all edges</strong>.
- This reconciles the gap some users see against other tools: the top-of-pane
  <strong>Perimeter</strong> metric is the turf outline only (plus Install layers), so a
  perimeter that includes inner cutout edges (e.g. edging around a tree well) reads longer.
  On Michel_yard: main outline 244.8 ft (exactly the raw CSV boundary), sub-layers 31.7 /
  26.6 / 60.6 / 51.1, total all edges 414.7 ft.
- Pure helper `layerPerimeters(proj)` → `[{id, name, perimeter}]`; perimeter is rotation /
  translation invariant so layer position doesn't affect it.

---



Test suite: **868** (sandbox 825, +9), data-dependent 43. New section 65 covers
`bandCoverageRuns` + the end-to-end auto-cut; verified against Michel_yard.csv.

- **Problem:** each strip's roll length was the full min-to-max extent of its turf along the
  roll. When a notch split a strip into turf / gap / turf, that one length spanned the gap, so
  the roll was ordered as a single continuous piece running through the empty middle — pure
  waste (visible as one rectangle crossing the notch in Michel_yard's right edge).
- **Fix:** a new `bandCoverageRuns` finds the separate turf runs along the roll within each
  band (union of horizontal scanlines at the band edges, every interior vertex, and midpoints
  between them). A new pass in `computeRollLayout` turns any multi-run band into
  gap-separated **pieces** — one per run, each with its own cutting margin — and drops the gap
  from Ordered SqFt, Linear Ft, and the roll count. Pieces reuse the existing manual-cut piece
  structure, so the draw, labels, nesting, and totals all already handle them.
- **Guards:** only gaps `≥ max(2 ft, 2× cutting margin)` are cut (a tiny gap isn't worth a
  seam); a strip the user has **manually cut** keeps the manual cuts instead. A gap-free shape
  is byte-for-byte unchanged (existing 816 tests still pass untouched).
- On Michel_yard at the vertical-roll orientation, the right-edge notch band now orders as two
  pieces and drops a ~13 ft gap (~190 ft² no longer ordered through the waste).

---



Test suite: **859** (sandbox 816, +5), data-dependent 43. New section 64 covers the append
placement math (`computeAppendOffset`, `layoutPlacedPoints`); append wiring verified
headlessly by feeding Backyard.csv twice.

- New **＋ Add CSV** button in the Layout toolbar (beside Import CSV). It brings an
  additional Moasure file's shapes in as new movable layers **without replacing** the current
  layout — for yards captured as several separate measurements.
- Because every Moasure file shares a (0,0) origin, added shapes are dropped as a group into
  open space to the **right** of the existing content (single shared offset per file, so the
  capture keeps its internal layout), then positioned with **✋ Move Layers**.
- The added file's **main shape defaults to Install** (separate area + own rolls, counts
  toward totals); its sub-shapes default to **Ignore** so cutouts don't silently change the
  quote. Layers are named "&lt;file&gt; — &lt;layer&gt;". A toast explains what happened and
  jumps to the Layers sub-tab.
- **Import CSV** now confirms before replacing an existing layout (so a multi-file layout
  isn't wiped by accident), and points to ＋ Add CSV. **Add CSV** with no layout yet behaves
  like a first import. Both are blocked while the layout is **locked**.
- Implementation: `addLayoutCsv` (append path) + pure helpers `computeAppendOffset` and
  `layoutPlacedPoints`. Appended shapes go onto `secondaryShapes` with their own
  `layerOffsets` / `secondaryShapeModes` entries, so the existing per-layer move, rotate,
  mode, visibility, and roll-direction controls all apply to them unchanged.

---



Test suite: **854** (sandbox 811, +5), data-dependent 43. New section 63 covers the
`isLayoutLocked` predicate; the disable/enable wiring is DOM and verified in-app.

- New **🔓 Lock** button, pinned first in the Layout toolbar alongside Edit Shape / Move
  Layers / Cut Mode / Import. Clicking it freezes the whole plan.
- **Locked disables:** every slider and adjustment (roll direction, translation, seam, view
  rotation, roll settings, per-layer controls, fringe), the three edit-mode buttons, all
  on-canvas vertex editing / layer moving / cutting / piece-dragging (guarded in the
  mousedown + touchstart dispatchers), and CSV import over the layout.
- **Stays live (view-only / non-mutating):** zoom, the purchased-rectangles toggle, sub-tab
  navigation, and both Apply buttons. Controls opt out of locking via `data-lockok="1"`.
- Implementation: `proj.layout.locked` (persisted per project) + `window._wtLayoutLocked`
  mirror for the canvas guards. `applyLayoutLockState()` disables every non-exempt
  input/select/button in the toolbar + layout content and is re-applied at the end of
  `renderRollLayout` and `renderLayersList` so dynamically-rebuilt per-layer controls inherit
  the state. `toggleLayoutLock()` exits any active edit mode before freezing. The mode
  toggles and `importLayoutCsv` also self-guard against the locked state.

---



Test suite: **849** (sandbox 806), unchanged (on-canvas label gating; verified by headless
draw harness against real Backyard.csv geometry + a synthetic single-shape layout).

- **Bug:** the primary shape's on-canvas "&lt;name&gt; — &lt;area&gt; ft²" label was gated behind
  `hasOtherShapes` — it only drew when at least one *visible secondary* layer was present. On
  an ordinary single-shape yard (no secondary layers), or when the lone secondary layer was
  toggled off, that gate was false, so the name + area label disappeared and only the
  "Roll N / Piece M" piece labels remained. Read as "label names and sq ft are gone."
- **Fix:** the primary label now draws whenever the primary layer is visible and has ≥3
  points, regardless of how many other shapes exist. Secondary-shape labels are unchanged
  (still one per visible secondary).
- Traced end-to-end with a headless canvas harness (parser → `computeRollLayout` →
  `renderRollLayout` → `drawRollLayoutCanvas`) to confirm the label code itself emits every
  label correctly; the gate was the only thing suppressing them.

---



Test suite: **849** (sandbox 806), unchanged (apply/cascade wiring, verified in-app).

- **Bug:** infill sq ft derives (via `autoPopulateInfill` → `infillAreaForTier`) from each
  turf row's <strong>Installed SqFt</strong>. But "Apply Ordered SqFt" only set
  `sqFtToOrder`, never `installedSqFt` — so infill (and anything else keyed to installed
  area) had nothing to read and stayed empty. Applying the order made it look like nothing
  propagated to the products.
- **Fix:** `applyRollLayoutToTurf` now also sets the row's Installed SqFt (role-aware, via
  `computeApplyAreaForRow`) before `calcTurfRow`, so infill, labor, and rock all cascade
  from the one click. The confirmation alert reports the installed value it set. Alt-turf
  rows are still skipped for Installed (they're priced on the base area by design), so they
  just get their order amount.
- Help text + docs updated to say the Ordered apply fills both SqFt to Order and Installed
  SqFt; each apply still targets the one row picked in its dropdown.

---



Test suite: **849** (sandbox 806), unchanged (field placement, verified in-app).

- Removed the **Usable SqFt** field from Advanced (it was unclear — installed area after
  side trim, redundant with Installed SqFt). Both DOM field and its two JS assignments are
  gone.
- **Scrap** moved out of Advanced up into the always-visible key-metrics block at the top of
  the right pane, alongside Installed SqFt, Ordered SqFt, Ordered Linear Ft, and Perimeter
  (now five metrics). Same value/format, same id (`rollWasteOut`).

---



Test suite: **849** (sandbox 806), +3 (section 62).

- **Clipping fix:** the canvas fit (`layoutFitPoints`) only framed in a roll's purchased
  rectangle when rectangles were shown. But a nested piece is drawn in the waste (the
  rectangle, outside the installed shape), so a roll that *hosts* a nested piece had that
  piece fall outside the frame and get clipped on the edge whenever rectangles were off.
  Now a host roll's rectangle is always included in the fit (non-host rectangles still only
  when shown), so nested pieces are never cut off. The loops also walk per-piece now.
- **No resize on toggle:** the "Show purchased roll rectangles" checkbox renders through
  `renderRollLayoutStableCanvas()`, so flipping it doesn't re-fit/resize the canvas height
  (the draw fits the content into the existing box). Hit "⊙ Fit" if you want it re-sized to
  the rectangles.

---



Test suite: **846** (sandbox 803), unchanged (DOM placement, verified in-app).

- Both apply actions now live together on the **Apply** tab: <em>Apply Installed SqFt →
  turf row</em> and <em>Apply Ordered SqFt → turf row</em> (relabeled from "Apply Area" /
  "Apply Sqft to Order" so it's obvious which figure each pushes). The Ordered apply was
  moved out of the Results tab. Same IDs/handlers, so behavior is unchanged.
- **"Show purchased roll rectangles (waste)"** moved out of the Advanced twisty to a fixed
  spot just above the canvas, visible on every tab — it's the toggle you need on to see
  waste and drag-nest pieces, so it shouldn't be buried. Label now notes it's needed to
  drag/nest.

---



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
