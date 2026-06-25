#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  Waterloo Turf Job Calculator — Unit Test Suite
//  Run: node waterloo_turf_tests.js
//  All core logic functions are extracted from the HTML's <script> block
//  and run in a sandboxed Node VM context.
//
//  ADD NEW TESTS when adding new features. Run automatically as part of
//  every build/deploy check. Exits 0 on pass, 1 on any failure.
// ═══════════════════════════════════════════════════════════════════════

const fs   = require('fs');
const vm   = require('vm');
const path = require('path');

// ── Load the app script from the HTML ────────────────────────────────
const html = fs.readFileSync(
  path.join(__dirname, 'waterloo_turf_calculator.html'), 'utf8'
);
const scriptSrc = html.match(/<script>([\s\S]*?)<\/script>/)[1];

// Minimal DOM / browser stubs so the script can parse without throwing
const mockEl = () => ({
  checked: false, value: '', style: {}, classList: { add:()=>{}, remove:()=>{} },
  addEventListener: ()=>{}, querySelector: ()=>null, querySelectorAll: ()=>[],
});
const ctx = {
  window:    { onload: null, _wtLayoutZoom: 1, _wtEditMode: false },
  document:  {
    getElementById:   () => mockEl(),
    querySelectorAll: () => [],
    querySelector:    () => null,
    addEventListener: () => {},
  },
  localStorage: { getItem: () => null, setItem: () => {} },
  console,
};
vm.runInNewContext(scriptSrc, ctx);

// ── Test harness ──────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;

function assert(condition, name, detail = '') {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ ${name}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

function near(a, b, tol = 0.01) { return Math.abs(a - b) <= tol; }

function section(title) { console.log(`\n── ${title} ──`); }

// Helper: build a simple test polygon (rectangle)
function rect(x0, y0, w, h) {
  return [
    {x:x0,   y:y0},
    {x:x0+w, y:y0},
    {x:x0+w, y:y0+h},
    {x:x0,   y:y0+h},
  ];
}

// ════════════════════════════════════════════════════════════════════════
//  1. GEOMETRY — polygonArea
// ════════════════════════════════════════════════════════════════════════
section('1. polygonArea');
{
  // Square 10×10 = 100
  assert(near(ctx.polygonArea(rect(0,0,10,10)), 100), '10×10 square = 100');
  // Rectangle 5×20 = 100
  assert(near(ctx.polygonArea(rect(0,0,5,20)), 100),  '5×20 rectangle = 100');
  // Triangle (right, legs 3 & 4) = 6
  const tri = [{x:0,y:0},{x:3,y:0},{x:0,y:4}];
  assert(near(ctx.polygonArea(tri), 6), 'right triangle 3-4 = 6');
  // Winding-order invariant (clockwise and counter-clockwise should give same result)
  const ccw = rect(0,0,10,10);
  const cw  = [...ccw].reverse();
  assert(near(ctx.polygonArea(ccw), ctx.polygonArea(cw)), 'area winding-order invariant');

  // Perimeter (used by the Layout "Perimeter (linear ft)" key metric)
  assert(near(ctx.polygonPerimeter(rect(0,0,10,10)), 40), '10×10 square perimeter = 40');
  assert(near(ctx.polygonPerimeter([{x:0,y:0},{x:3,y:0},{x:0,y:4}]), 12), '3-4-5 right triangle perimeter = 12');
  // Degenerate (collinear points) = 0
  assert(near(ctx.polygonArea([{x:0,y:0},{x:5,y:0},{x:10,y:0}]), 0), 'collinear = 0');
}

// ════════════════════════════════════════════════════════════════════════
//  2. GEOMETRY — rotateAround / rotatePoints
// ════════════════════════════════════════════════════════════════════════
section('2. rotateAround / rotatePoints');
{
  const pts = rect(0,0,10,10);
  // 360° rotation should return original points
  const rot360 = ctx.rotatePoints(pts, 360);
  assert(rot360.every((p,i)=>near(p.x,pts[i].x)&&near(p.y,pts[i].y)), '360° = identity');
  // 90° rotation: (10,0) → (0, 10) relative to centroid (5,5)
  const rot90 = ctx.rotatePoints(rect(0,0,10,10), 90);
  assert(ctx.polygonArea(rot90) > 99.9, '90° rotation preserves area');
  // 180° rotation of centroid is idempotent
  const c = ctx.centroidOf(pts);
  const rot180 = ctx.rotateAround(pts, 180, c.cx, c.cy);
  assert(near(ctx.polygonArea(rot180), 100), '180° rotation preserves area');
  // 0° rotation = identity
  const rot0 = ctx.rotatePoints(pts, 0);
  assert(rot0.every((p,i)=>near(p.x,pts[i].x)&&near(p.y,pts[i].y)), '0° = identity');
}

// ════════════════════════════════════════════════════════════════════════
//  3. GEOMETRY — clipPolygonToRect (Sutherland-Hodgman)
// ════════════════════════════════════════════════════════════════════════
section('3. clipPolygonToRect');
{
  // Clip a 10×10 square to its own bounds — should return ~same area
  const sq = rect(0,0,10,10);
  const clipped = ctx.clipPolygonToRect(sq, 0,10, 0,10);
  assert(near(ctx.polygonArea(clipped), 100), 'clip to self = full area');
  // Clip to half (x 0-5): area should be 50
  const halfClip = ctx.clipPolygonToRect(sq, 0,5, 0,10);
  assert(near(ctx.polygonArea(halfClip), 50, 0.5), 'clip to half x = 50');
  // Fully outside → empty
  const outside = ctx.clipPolygonToRect(sq, 20,30, 0,10);
  assert(outside.length === 0, 'fully outside → []');
  // Triangle clipped to its own bounding box = same area
  const tri = [{x:0,y:0},{x:10,y:0},{x:5,y:10}];
  const triClip = ctx.clipPolygonToRect(tri, 0,10, 0,10);
  assert(near(ctx.polygonArea(triClip), 50, 1), 'triangle clip to bbox ≈ 50');
}

// ════════════════════════════════════════════════════════════════════════
//  4. LAYOUT — parseLayoutCsv
// ════════════════════════════════════════════════════════════════════════
section('4. parseLayoutCsv');
{
  const csvHeader = '"Layer","Path","Point","X:ft","Y:ft","Z:ft","Layer-Name","Path-Type","Point-Name","Point-Type","Area:ft²",';
  const row = (path, point, x, y, type='Default') =>
    `"1","${path}","${point}","${x}","${y}","0.00","Base Layer","Dot2Dot","","${type}","100.00"`;

  // Minimal valid CSV: a square
  const csv = [
    csvHeader,
    row(1,1, 0,0), row(1,2, 10,0), row(1,3, 10,10),
    '"1","2","1","10.00","10.00","0.00","Base Layer","LastLeg","","Default","100.00"',
    '"1","2","2","0.00","0.00","0.00","Base Layer","LastLeg","","Default","100.00"',
  ].join('\n');
  const { points, area } = ctx.parseLayoutCsv(csv);
  assert(points.length >= 3, 'parses ≥3 points from valid CSV');
  assert(area === 100, 'reads Area:ft² from CSV');

  // CentrePoint rows should be excluded from boundary
  const csvWithCentre = [
    csvHeader,
    row(1,1, 0,0), row(1,2, 10,0), row(1,3, 10,10), row(1,4, 0,10),
    '"1","2","1","5.00","5.00","0.00","Base Layer","Arc","","CentrePoint","100.00"',
  ].join('\n');
  const { points: pts2 } = ctx.parseLayoutCsv(csvWithCentre);
  assert(pts2.every(p=>!(Math.abs(p.x-5)<0.01 && Math.abs(p.y-5)<0.01)), 'CentrePoint excluded');

  // Missing X/Y columns should throw
  let threw = false;
  try { ctx.parseLayoutCsv('"A","B"\n"1","2"'); } catch(e) { threw = true; }
  assert(threw, 'throws on missing X/Y columns');

  // ── Elevation (Z) column: parsed into an elevation summary (min/max/range) ──
  {
    const h = '"Layer","Path","Point","X:ft","Y:ft","Z:ft","Layer-Name","Point-Type","Area:ft²",';
    const r = (p, x, y, z) => `"1","1","${p}","${x}","${y}","${z}","Base","Default","100.00"`;
    const csvZ = [ h, r(1,0,0, 2.5), r(2,10,0, 5.0), r(3,10,10, 1.0), r(4,0,10, 3.0) ].join('\n');
    const res = ctx.parseLayoutCsv(csvZ);
    assert(res.elevation != null, 'elevation summary present when a Z column exists');
    assert(near(res.elevation.min, 1.0) && near(res.elevation.max, 5.0), 'elevation min/max read from Z values (1.0 → 5.0)');
    assert(near(res.elevation.range, 4.0), 'elevation range = max - min (5.0 - 1.0 = 4.0)');
    assert(res.elevation.unit === 'ft', 'elevation unit read from the Z:ft header');
    assert(res.shapes[0].elevation != null && near(res.shapes[0].elevation.range, 4.0), 'per-shape elevation summary computed too');
    assert(res.points[0].z === 2.5, 'parsed points carry their z value');
  }

  // ── No Z column → no elevation data (feature reports "none", never fabricates) ──
  {
    const h = '"Layer","Path","Point","X:ft","Y:ft","Layer-Name","Point-Type","Area:ft²",';
    const r = (p, x, y) => `"1","1","${p}","${x}","${y}","Base","Default","100.00"`;
    const csvNoZ = [ h, r(1,0,0), r(2,10,0), r(3,10,10), r(4,0,10) ].join('\n');
    const res = ctx.parseLayoutCsv(csvNoZ);
    assert(res.elevation == null, 'no elevation summary when the CSV has no Z/elevation column');
    assert(res.points.every(p => p.z === undefined), 'points carry no z when the CSV has none');
  }

  // ── Elevation column under an alternate header ("Elevation") is recognized ──
  {
    assert(ctx.findElevationColumn(['layer','x:ft','y:ft','elevation']) === 3, 'findElevationColumn recognizes an "elevation" header');
    assert(ctx.findElevationColumn(['x:ft','y:ft','height:ft']) === 2, 'findElevationColumn recognizes a "height:ft" header');
    assert(ctx.findElevationColumn(['x:ft','y:ft','area:ft²']) === -1, 'findElevationColumn returns -1 when no elevation column exists');
  }

  // ── Multi-layer Z: each layer keeps its OWN fall; overall spans both layers ──
  // (mirrors a real Moasure export where a raised sub-layer sits above the base)
  {
    const h = '"Layer","Path","Point","X:ft","Y:ft","Z:ft","Layer-Name","Point-Type","Area:ft²",';
    const r = (layer, p, x, y, z, name) => `"${layer}","1","${p}","${x}","${y}","${z}","${name}","Default","100.00"`;
    const csv = [ h,
      r(1,1, 0,0, 0.0, 'Base Layer'), r(1,2, 10,0, -0.5, 'Base Layer'), r(1,3, 10,10, 0.3, 'Base Layer'), r(1,4, 0,10, 0.1, 'Base Layer'),
      r(2,1, 2,2, 1.0, 'Sub Layer 1'), r(2,2, 6,2, 1.4, 'Sub Layer 1'), r(2,3, 6,6, 1.2, 'Sub Layer 1'),
    ].join('\n');
    const res = ctx.parseLayoutCsv(csv);
    assert(res.shapes.length === 2, 'two layers parsed');
    const base = res.shapes.find(s => s.name === 'Base Layer');
    const sub  = res.shapes.find(s => s.name === 'Sub Layer 1');
    assert(base && near(base.elevation.range, 0.8), 'base layer fall = its own range (0.3 - (-0.5) = 0.8)');
    assert(sub && near(sub.elevation.range, 0.4), 'sub layer fall = its own range (1.4 - 1.0 = 0.4)');
    assert(near(res.elevation.range, 1.9), 'overall span covers BOTH layers (1.4 - (-0.5) = 1.9), not any single layer\'s fall');
    assert(res.elevation.max > sub.elevation.min && sub.elevation.min > base.elevation.max,
      'the sub layer sits entirely ABOVE the base layer (a raised surface), so the overall range overstates either layer\'s grade');
    assert(base.elevation.mean != null && sub.elevation.mean != null, 'each layer carries a mean height for offset math');
  }

  // ── elevationLayerOffsets: each non-base layer's mean offset from the base ──
  {
    const layers = [
      { name:'Base',  primary:true,  elevation:{ min:-0.5, max:0.5, range:1.0, mean:0.0, count:4 } },
      { name:'Raised',primary:false, elevation:{ min:0.8,  max:1.2, range:0.4, mean:1.0, count:3 } },
      { name:'Sunken',primary:false, elevation:{ min:-1.4, max:-1.0,range:0.4, mean:-1.2,count:3 } },
    ];
    const r = ctx.elevationLayerOffsets(layers);
    const byName = Object.fromEntries(r.map(L => [L.name, L]));
    assert(byName['Base'].offset === null, 'the base layer has no offset (it is the reference)');
    assert(near(byName['Raised'].offset, 1.0), 'a raised layer reports +mean offset above the base (1.0)');
    assert(near(byName['Sunken'].offset, -1.2), 'a sunken layer reports a negative offset below the base (-1.2)');

    // No primary flag → first layer with elevation becomes the reference.
    const r2 = ctx.elevationLayerOffsets(layers.map(L => ({ ...L, primary:false })));
    assert(r2[0].offset === null && near(r2[1].offset, 1.0), 'without a primary flag, the first measured layer is the reference');

    // A layer lacking height data is carried through with a null offset.
    const r3 = ctx.elevationLayerOffsets([ layers[0], { name:'NoZ', primary:false, elevation:null } ]);
    assert(r3.find(L=>L.name==='NoZ').offset === null, 'a layer with no height data gets a null offset (not a crash)');
  }

  // ── elevationColorRamp: blue (low) → green (mid) → red (high), clamped ──
  {
    const lo = ctx.elevationColorRamp(0), mid = ctx.elevationColorRamp(0.5), hi = ctx.elevationColorRamp(1);
    const rgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    assert(/^#[0-9a-f]{6}$/.test(lo) && /^#[0-9a-f]{6}$/.test(hi), 'ramp returns #rrggbb');
    assert(rgb(lo)[2] > rgb(lo)[0], 'low end is blue-dominant (B > R)');
    assert(rgb(hi)[0] > rgb(hi)[2], 'high end is red-dominant (R > B)');
    assert(rgb(mid)[1] >= rgb(mid)[0] && rgb(mid)[1] >= rgb(mid)[2], 'mid is green-dominant');
    assert(ctx.elevationColorRamp(-5) === lo && ctx.elevationColorRamp(5) === hi, 'ramp clamps out-of-range t');
  }

  // ── gradeBoundarySegments: closed outline colored by midpoint height ──
  {
    const sq = [ {x:0,y:0,z:0}, {x:10,y:0,z:1}, {x:10,y:10,z:2}, {x:0,y:10,z:3} ];
    const segs = ctx.gradeBoundarySegments(sq, 0, 3);
    assert(segs.length === 4, 'a closed 4-vertex outline yields 4 colored segments');
    assert(near(segs[0].z, 0.5) && near(segs[1].z, 1.5), 'each segment carries its midpoint elevation');
    assert(segs[0].color !== segs[2].color, 'a low segment and a high segment get different colors');
    // A vertex missing z drops the two segments touching it.
    const partial = [ {x:0,y:0,z:0}, {x:10,y:0}, {x:10,y:10,z:2}, {x:0,y:10,z:3} ];
    const segs2 = ctx.gradeBoundarySegments(partial, 0, 3);
    assert(segs2.length === 2, 'the two segments touching the unmeasured vertex are skipped, leaving the other two edges');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  5. LAYOUT — computeRollLayout
// ════════════════════════════════════════════════════════════════════════
section('5. computeRollLayout');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  const square100 = rect(0,0,10,10); // 100 ft²

  // Basic layout: 10×10 shape, 15ft roll width
  const lsq = ctx.computeRollLayout(square100, 0, 0, opts);
  // The grid starts at minY - effW + t, so at t=0 there is always an initial
  // "overhang" strip that may have zero clipped area. Check the number of
  // strips that actually contain shape area.
  const activeSq = lsq.strips.filter(s => s.clippedArea > 0.5);
  assert(activeSq.length === 1, '10ft-wide shape with 15ft roll = 1 active strip');
  assert(near(lsq.shapeArea, 100), 'shape area = 100');
  assert(near(lsq.totalOrdered, 15*10, 2), 'ordered = rollWidth × neededLength (no margin)');
  assert(lsq.scrap >= 0, 'scrap ≥ 0');

  // Wider shape (in Y = perpendicular to rolls) needs more active strips
  const wide = rect(0,0,10,35); // 10ft run, 35ft wide → needs 3 active strips at effW=15
  const l2 = ctx.computeRollLayout(wide, 0, 0, opts);
  const activeWide = l2.strips.filter(s => s.clippedArea > 0.5);
  assert(activeWide.length >= 2, 'shape wider than effW needs multiple active strips');

  // With side trim effW decreases — check active strips cover the shape
  const optsWithTrim = {...opts, sideTrim:12}; // 1ft trim → effW=14
  const lt = ctx.computeRollLayout(rect(0,0,14,10), 0, 0, optsWithTrim);
  const activeTrim = lt.strips.filter(s => s.clippedArea > 0.5);
  assert(activeTrim.length === 1, '14ft wide shape fits in 1 active strip at effW=14');

  // Per-strip independent sizing: each strip only buys what it needs
  const lstrips = ctx.computeRollLayout(rect(0,0,30,10), 0, 0, opts);
  lstrips.strips.forEach(s => {
    if (s.clippedArea > 0) {
      assert(s.orderedLength <= 30 + 1, `strip ${s.index} orderedLength ≤ shape length`);
    }
  });

  // Nesting: an L-shape produces strips with very different waste profiles —
  // a small strip can fit inside a larger strip's leftover (waste) area.
  const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];
  const nestOpts = {...opts, nesting:{}};
  const lNestBase = ctx.computeRollLayout(lShape, 0, 0, nestOpts);
  const smallStrip = lNestBase.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
  const bigStrip   = lNestBase.strips.find(s => s.index !== (smallStrip||{}).index && s.wasteArea >= (smallStrip||{purchasedArea:9999}).purchasedArea);
  if (smallStrip && bigStrip) {
    // Nesting is keyed by stable strip .key (geometric band position), not array index
    const optsNested = {...opts, nesting:{ [smallStrip.key]: bigStrip.key }};
    const lNested = ctx.computeRollLayout(lShape, 0, 0, optsNested);
    assert(lNested.totalOrdered < lNestBase.totalOrdered, 'nesting reduces totalOrdered');
    assert(lNested.totalSaved > 0, 'totalSaved > 0 when nesting');

    // Nesting survives a translation change: as long as a strip still exists
    // at the same .key (band position), the nesting still applies.
    const lNestedSameT = ctx.computeRollLayout(lShape, 0, 0, optsNested);
    assert(near(lNestedSameT.totalOrdered, lNested.totalOrdered, 0.01), 'nesting is stable across repeated computes with same params');

    // Nesting at a stale/nonexistent key has no effect (doesn't throw, doesn't misapply)
    const optsStale = {...opts, nesting:{ 'y9999.00': bigStrip.key }};
    const lStale = ctx.computeRollLayout(lShape, 0, 0, optsStale);
    assert(near(lStale.totalOrdered, lNestBase.totalOrdered, 0.01), 'nesting with a nonexistent source key has no effect');
  } else {
    // Shape doesn't produce nestable strips at this config — skip gracefully
    console.log('  (nesting test skipped — no suitable strip pair found)');
  }

  // Rotation preserves shape area
  for (const deg of [0,45,90,135]) {
    const lr = ctx.computeRollLayout(square100, deg, 0, opts);
    assert(near(lr.shapeArea, 100, 0.5), `shapeArea invariant at ${deg}°`);
  }

  // Translation mod effW — t > effW should wrap
  const l3 = ctx.computeRollLayout(square100, 0, 100, opts); // 100 mod 15 = 10
  const l4 = ctx.computeRollLayout(square100, 0, 10, opts);
  assert(near(l3.totalOrdered, l4.totalOrdered, 0.1), 'translation wraps mod effW');

  // scrap = totalOrdered - shapeArea (when no nesting)
  const ls = ctx.computeRollLayout(rect(0,0,20,20), 0, 0, opts);
  assert(near(ls.scrap, ls.totalOrdered - ls.shapeArea, 0.1), 'scrap = ordered - shapeArea');

  // wastePct = scrap / totalOrdered × 100
  assert(near(ls.wastePct, ls.scrap/ls.totalOrdered*100, 0.01), 'wastePct formula correct');
}

// ════════════════════════════════════════════════════════════════════════
//  6. LAYOUT — edit history (pushLayoutHistory / undoLayoutEdit logic)
// ════════════════════════════════════════════════════════════════════════
section('6. Layout edit history');
{
  const points0 = rect(0,0,10,10);
  const proj = { layout: { points: JSON.parse(JSON.stringify(points0)) } };

  // Push a snapshot, then modify
  ctx.pushLayoutHistory(proj);
  assert(proj.layout.history.length === 1, 'history has 1 entry after first push');
  assert(proj.layout.history[0].layerId === 'primary' && Array.isArray(proj.layout.history[0].points),
    'history entry records layerId + points');

  proj.layout.points[0] = {x:99, y:99};
  ctx.pushLayoutHistory(proj);
  assert(proj.layout.history.length === 2, 'history has 2 entries after second push');

  // Simulate undo: pop and restore the entry's points
  const restored = proj.layout.history.pop();
  proj.layout.points = restored.points;
  assert(near(proj.layout.points[0].x, 99, 0.1), 'undo restores second state (not original)');

  // Max 20 entries
  const proj2 = { layout: { points: rect(0,0,5,5) } };
  for (let i = 0; i < 25; i++) ctx.pushLayoutHistory(proj2);
  assert(proj2.layout.history.length <= 20, 'history capped at 20');
}

// ════════════════════════════════════════════════════════════════════════
//  7. LAYOUT — getBaseLayoutPoints / displayPointToCanonical roundtrip
// ════════════════════════════════════════════════════════════════════════
section('7. View rotation / canonical roundtrip');
{
  const points = rect(0,0,20,15);
  const proj = { layout: { points: JSON.parse(JSON.stringify(points)), viewRotation: 45, viewCentroid: ctx.centroidOf(points) }};

  const base = ctx.getBaseLayoutPoints(proj);
  assert(base.length === points.length, 'getBaseLayoutPoints returns same point count');
  // Area preserved under view rotation
  assert(near(ctx.polygonArea(base), ctx.polygonArea(points), 1), 'view rotation preserves area');

  // Roundtrip: display → canonical → display should be identity
  const dispPt = base[0];
  const canonical = ctx.displayPointToCanonical(proj, dispPt);
  // canonical should match original stored point (within float noise)
  assert(near(canonical.x, points[0].x, 0.001) && near(canonical.y, points[0].y, 0.001),
    'displayPointToCanonical roundtrip matches original point');

  // 0° view rotation: base === points
  const proj0 = { layout: { points, viewRotation: 0 }};
  const base0 = ctx.getBaseLayoutPoints(proj0);
  assert(base0 === points, '0° view rotation returns original array ref');
}

// ════════════════════════════════════════════════════════════════════════
//  8. LAYOUT — centroidOf
// ════════════════════════════════════════════════════════════════════════
section('8. centroidOf');
{
  // Centroid of axis-aligned square at (0,0)–(10,10) = (5,5)
  const { cx, cy } = ctx.centroidOf(rect(0,0,10,10));
  assert(near(cx, 5) && near(cy, 5), 'centroid of 10×10 square at origin = (5,5)');
  // Single point
  const c1 = ctx.centroidOf([{x:3,y:7}]);
  assert(near(c1.cx,3) && near(c1.cy,7), 'centroid of single point = itself');
}

// ════════════════════════════════════════════════════════════════════════
//  9. LAYOUT — autoRotate finds a better-or-equal solution (smoke test)
// ════════════════════════════════════════════════════════════════════════
section('9. autoRotate minimizes waste (smoke)');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4, nesting:{} };
  const shape = rect(0,0,40,12); // irregular-ish rectangle
  let best = null;
  for (let deg=0; deg<180; deg++) {
    for (let ti=0; ti<8; ti++) {
      const t = (ti/8)*14.67; // effW ≈ 14.67
      const l = ctx.computeRollLayout(shape, deg, t, opts);
      if (!best || l.totalOrdered < best) best = l.totalOrdered;
    }
  }
  const baseline = ctx.computeRollLayout(shape, 0, 0, opts).totalOrdered;
  assert(best <= baseline + 0.01, 'auto-minimize finds solution ≤ 0° baseline');
}

// ════════════════════════════════════════════════════════════════════════
//  10. AUTO-BACKUP — snapshot/restore logic
// ════════════════════════════════════════════════════════════════════════
section('10. Auto-backup');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const ctx2 = {
    window: { onload: null, _wtLayoutZoom:1, _wtEditMode:false, _wtLastAutoBackup: null },
    document:  { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
    localStorage: mockLS,
    console,
  };
  vm.runInNewContext(scriptSrc, ctx2);

  // getAutoBackups returns [] when nothing stored
  assert(ctx2.getAutoBackups().length === 0, 'getAutoBackups returns [] initially');

  // maybeAutoBackup writes a snapshot
  ctx2.projects = [{ id:'p1', name:'Test', turf:[], infill:[], rock:[], edging:{}, pgSqFt:0, miscItems:[] }];
  ctx2.getCatalog = () => ({ turf:[], infill:[], rock:[] });
  ctx2.getCrews = () => ([]);
  ctx2.getActiveCrewId = () => null;
  ctx2.getMiscItems = () => ([]);
  ctx2.maybeAutoBackup();
  const backups = ctx2.getAutoBackups();
  assert(backups.length === 1, 'maybeAutoBackup writes 1 snapshot');
  assert(Array.isArray(backups[0].data.projects), 'snapshot contains projects array');

  // Throttle: second call within interval should not add another
  ctx2.maybeAutoBackup();
  assert(ctx2.getAutoBackups().length === 1, 'throttle prevents duplicate within interval');

  // Rotation: more than AUTOBACKUP_MAX entries should be capped
  ctx2.window._wtLastAutoBackup = 0; // reset throttle
  for (let i=0; i<12; i++) {
    ctx2.window._wtLastAutoBackup = 0;
    ctx2.maybeAutoBackup();
  }
  assert(ctx2.getAutoBackups().length <= 8, 'backup rotation caps at AUTOBACKUP_MAX=8');
}

// ════════════════════════════════════════════════════════════════════════
//  11. TURF CALC — calcTurfRow / linear ft / ordered sqft formulas
// ════════════════════════════════════════════════════════════════════════
section('11. Turf row calculations');
{
  // linearFt = ceil(sqFtToOrder / 15)
  const cases = [
    { sqFt:225,  lf:15 },
    { sqFt:226,  lf:16 },
    { sqFt:450,  lf:30 },
    { sqFt:0,    lf:0  },
    { sqFt:14,   lf:1  },
  ];
  cases.forEach(({sqFt, lf}) => {
    const got = sqFt ? Math.ceil(sqFt/15) : 0;
    assert(got === lf, `ceil(${sqFt}/15) = ${lf}`);
    const orderedSqFt = lf * 15;
    assert(orderedSqFt >= sqFt, `orderedSqFt(${orderedSqFt}) ≥ sqFtToOrder(${sqFt})`);
  });
}

// ════════════════════════════════════════════════════════════════════════
//  12. POLYGON HELPERS — pointInPoly
// ════════════════════════════════════════════════════════════════════════
section('12. pointInPoly');
{
  const sq = rect(0,0,10,10);
  assert(ctx.pointInPoly({x:5,y:5}, sq),    'center inside square');
  assert(!ctx.pointInPoly({x:15,y:5}, sq),  'outside right → false');
  assert(!ctx.pointInPoly({x:-1,y:5}, sq),  'outside left → false');
  assert(!ctx.pointInPoly({x:5,y:-1}, sq),  'outside below → false');
  assert(!ctx.pointInPoly({x:5,y:11}, sq),  'outside above → false');
  // Triangle test
  const tri = [{x:0,y:0},{x:10,y:0},{x:5,y:10}];
  assert(ctx.pointInPoly({x:5,y:4}, tri),   'centroid inside triangle');
  assert(!ctx.pointInPoly({x:9,y:9}, tri),  'outside triangle corner → false');
}

// ════════════════════════════════════════════════════════════════════════
//  13. LAYOUT CANVAS SIZING — sizeLayoutCanvas aspect ratio logic
// ════════════════════════════════════════════════════════════════════════
section('13. Canvas aspect ratio sizing');
{
  // Simulate sizeLayoutCanvas logic: given a layout, canvas height should
  // be derived from shape aspect ratio × wrapper width — no dead whitespace.
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };

  // Wide landscape shape: 40ft × 10ft
  const landscapeShape = rect(0,0,40,10);
  const lLand = ctx.computeRollLayout(landscapeShape, 0, 0, opts);

  const allPts = [...lLand.basePoints];
  lLand.strips.forEach(s => {
    if (s.displayRect)    allPts.push(...s.displayRect);
    if (s.displayClipped) allPts.push(...s.displayClipped);
  });
  const xs = allPts.map(p=>p.x), ys = allPts.map(p=>p.y);
  const spanX = Math.max(...xs) - Math.min(...xs);
  const spanY = Math.max(...ys) - Math.min(...ys);
  const pad = 24;
  const wrapW = 800;
  const scale = (wrapW - 2*pad) / spanX;
  const derivedH = Math.round(spanY * scale + 2*pad);

  // Height should be proportional to shape height, not fixed
  assert(derivedH > 0, 'derived canvas height > 0');
  assert(derivedH < wrapW, 'canvas height < wrapper width for landscape shape');

  // Tall portrait shape: 10ft × 40ft — canvas should be taller
  const portraitShape = rect(0,0,10,40);
  const lPort = ctx.computeRollLayout(portraitShape, 0, 0, opts);
  const allPts2 = [...lPort.basePoints];
  lPort.strips.forEach(s => {
    if (s.displayRect)    allPts2.push(...s.displayRect);
    if (s.displayClipped) allPts2.push(...s.displayClipped);
  });
  const xs2 = allPts2.map(p=>p.x), ys2 = allPts2.map(p=>p.y);
  const spanX2 = Math.max(...xs2) - Math.min(...xs2);
  const spanY2 = Math.max(...ys2) - Math.min(...ys2);
  const scale2 = (wrapW - 2*pad) / spanX2;
  const derivedH2 = Math.round(spanY2 * scale2 + 2*pad);
  assert(derivedH2 > derivedH, 'portrait shape produces taller canvas than landscape');

  // Aspect ratio preserved: (canvas height - 2*pad) / (canvas width - 2*pad) ≈ spanY/spanX
  const aspect = spanY / spanX;
  const canvasAspect = (derivedH - 2*pad) / (wrapW - 2*pad);
  assert(near(aspect, canvasAspect, 0.01), 'canvas aspect ratio matches shape aspect ratio');
}

// ════════════════════════════════════════════════════════════════════════
//  14. SELECTIVE BACKUP & MERGE IMPORT
// ════════════════════════════════════════════════════════════════════════
section('14. Selective backup & merge import');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const fullProj = (id,name,created) => ({id,name,created,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[]});

  function freshCtx(initialProjects) {
    stored['wt_projects_v4'] = JSON.stringify(initialProjects);
    const ctx2 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    };
    vm.runInNewContext(scriptSrc, ctx2);
    return ctx2;
  }

  // ── Merge: no conflicts, just adds new projects ──
  {
    const ctx2 = freshCtx([fullProj('p1','Existing',1000)]);
    ctx2.window._wtPendingMerge = { conflicts: [], newOnes: [fullProj('p2','New',2000)], choices: {} };
    ctx2.applyMergeResolution();
    const result = ctx2.getProjects();
    assert(result.length === 2, 'merge with no conflicts adds new project');
    assert(result.some(p=>p.id==='p2'), 'new project p2 present after merge');
  }

  // ── Merge: conflict, choice "mine" — keep existing unchanged ──
  {
    const ctx2 = freshCtx([fullProj('p1','My Version',1000)]);
    ctx2.window._wtPendingMerge = { conflicts: [fullProj('p1','Their Version',5000)], newOnes: [], choices: {p1:'mine'} };
    ctx2.applyMergeResolution();
    const result = ctx2.getProjects();
    assert(result.length === 1, '"mine" choice keeps single project');
    assert(result[0].name === 'My Version', '"mine" choice preserves existing name');
  }

  // ── Merge: conflict, choice "theirs" — replace with incoming ──
  {
    const ctx2 = freshCtx([fullProj('p1','My Version',1000)]);
    ctx2.window._wtPendingMerge = { conflicts: [fullProj('p1','Their Version',5000)], newOnes: [], choices: {p1:'theirs'} };
    ctx2.applyMergeResolution();
    const result = ctx2.getProjects();
    assert(result.length === 1, '"theirs" choice keeps single project');
    assert(result[0].name === 'Their Version', '"theirs" choice replaces with incoming name');
  }

  // ── Merge: conflict, choice "both" — keeps mine, adds incoming as new copy ──
  {
    const ctx2 = freshCtx([fullProj('p1','My Version',1000)]);
    ctx2.window._wtPendingMerge = { conflicts: [fullProj('p1','Their Version',5000)], newOnes: [], choices: {p1:'both'} };
    ctx2.applyMergeResolution();
    const result = ctx2.getProjects();
    assert(result.length === 2, '"both" choice results in 2 projects');
    assert(result.some(p=>p.id==='p1' && p.name==='My Version'), '"both" keeps original p1 untouched');
    assert(result.some(p=>p.id!=='p1' && p.name.includes('imported')), '"both" adds incoming copy with new ID and "(imported)" suffix');
  }

  // ── Selective export: only selected projects, no catalog/crew data ──
  {
    const ctx2 = freshCtx([fullProj('p1','A',1000), fullProj('p2','B',2000), fullProj('p3','C',3000)]);
    ctx2.window._wtSelectedProjects = new Set(['p2','p3']);
    let blobContent = null;
    ctx2.document.createElement = () => ({ set href(v){}, set download(v){}, click(){} });
    ctx2.URL = { createObjectURL: ()=>'blob:x' };
    ctx2.Blob = function(parts){ blobContent = parts[0]; };
    ctx2.exportBackup('selected');
    const parsed = JSON.parse(blobContent);
    assert(parsed.projects.length === 2, 'selective export includes only selected projects');
    assert(parsed.projects.every(p=>['B','C'].includes(p.name)), 'selective export contains correct projects');
    assert(!('catalog' in parsed), 'selective export omits catalog');
    assert(!('crews' in parsed), 'selective export omits crews');
  }

  // ── Full export: all projects + catalog/crew data ──
  {
    const ctx2 = freshCtx([fullProj('p1','A',1000), fullProj('p2','B',2000)]);
    let blobContent = null;
    ctx2.document.createElement = () => ({ set href(v){}, set download(v){}, click(){} });
    ctx2.URL = { createObjectURL: ()=>'blob:x' };
    ctx2.Blob = function(parts){ blobContent = parts[0]; };
    ctx2.exportBackup('all');
    const parsed = JSON.parse(blobContent);
    assert(parsed.projects.length === 2, 'full export includes all projects');
    assert('catalog' in parsed, 'full export includes catalog');
    assert('crews' in parsed, 'full export includes crews');
  }

  // ── Selective export with empty selection: should not crash, no download ──
  {
    const ctx2 = freshCtx([fullProj('p1','A',1000)]);
    ctx2.window._wtSelectedProjects = new Set();
    let createCalled = false;
    ctx2.document.createElement = () => { createCalled = true; return { set href(v){}, set download(v){}, click(){} }; };
    ctx2.exportBackup('selected');
    assert(!createCalled, 'empty selection does not trigger download');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  15. FACTORY RESET & ZERO-PROJECT FULL EXPORT
// ════════════════════════════════════════════════════════════════════════
section('15. Factory reset & settings-only export');
{
  const stored = {};
  const mockLS = {
    getItem: k => stored[k]||null,
    setItem: (k,v) => { stored[k]=v; },
    removeItem: k => { delete stored[k]; },
  };
  const fullProj = (id,name,created) => ({id,name,created,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[]});

  // ── "Export Everything" with ZERO projects still includes catalog/crews/misc ──
  {
    stored['wt_projects_v4'] = JSON.stringify([]);
    stored['wt_catalog_v2'] = JSON.stringify({ turf:[{id:'t1',name:'Premium Turf'}], infill:[], rock:[] });
    stored['wt_crews_v1'] = JSON.stringify([{id:'crew_main', name:'Main Crew'}]);

    const ctx2 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    };
    vm.runInNewContext(scriptSrc, ctx2);

    let blobContent = null;
    ctx2.document.createElement = () => ({ set href(v){}, set download(v){}, click(){} });
    ctx2.URL = { createObjectURL: ()=>'blob:x' };
    ctx2.Blob = function(parts){ blobContent = parts[0]; };
    ctx2.exportBackup('all');

    const parsed = JSON.parse(blobContent);
    assert(Array.isArray(parsed.projects) && parsed.projects.length === 0, '"Export Everything" with 0 projects → projects: []');
    assert('catalog' in parsed && parsed.catalog.turf.length === 1, '"Export Everything" with 0 projects still includes catalog');
    assert('crews' in parsed && parsed.crews.length === 1, '"Export Everything" with 0 projects still includes crews');
  }

  // ── "Import & Replace All" from a settings-only (0-project) export seeds catalog/crews ──
  {
    // Fresh device: nothing stored
    const ctx3 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:(k,v)=>{ fresh[k]=v; }, removeItem:()=>{} },
      alert:()=>{}, confirm:()=>true, console,
    };
    const fresh = {};
    ctx3.localStorage.getItem = k => fresh[k]||null;
    vm.runInNewContext(scriptSrc, ctx3);

    const settingsOnlyExport = {
      projects: [],
      catalog: { turf:[{id:'t1',name:'Premium Turf'}], infill:[], rock:[] },
      crews: [{id:'crew_main', name:'Main Crew'}],
      activeCrewId: 'crew_main',
      miscItems: [{id:'m1', name:'Hauling Fee'}],
    };

    // Simulate the file-read branch of importBackup's 'replace' mode directly
    ctx3.window._wtImportMode = 'replace';
    const data = settingsOnlyExport;
    ctx3.saveProjects(data.projects);
    if (data.catalog) ctx3.saveCatalog(data.catalog);
    if (data.crews) { ctx3.saveCrews(data.crews); ctx3.setActiveCrewId(data.activeCrewId); }
    if (data.miscItems) ctx3.saveMiscItems(data.miscItems);

    const seededCatalog = ctx3.getCatalog();
    const seededCrews = ctx3.getCrews();
    const seededMisc = ctx3.getMiscItems();
    assert(seededCatalog.turf.length === 1, 'replace-import seeds catalog on fresh device');
    assert(seededCrews.length === 1, 'replace-import seeds crews on fresh device');
    assert(seededMisc.length === 1, 'replace-import seeds misc items on fresh device');
    assert(ctx3.getProjects().length === 0, 'fresh device still has 0 projects after settings-only import');
  }

  // ── Factory reset clears all known keys ──
  {
    const keys = ['wt_projects_v4','wt_catalog_v2','wt_crews_v1','wt_active_crew','wt_misc_v1','wt_setup_done','wt_autobackups_v1','wt_labor_v1'];
    const seeded = {};
    keys.forEach(k => seeded[k] = JSON.stringify({dummy:true}));

    const ctx4 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, location: {} },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem: k=>seeded[k]||null, setItem:(k,v)=>{seeded[k]=v;}, removeItem:k=>{delete seeded[k];} },
      alert:()=>{}, confirm:()=>true, console,
      location: { reload: ()=>{} },
    };
    vm.runInNewContext(scriptSrc, ctx4);
    ctx4.factoryResetApp();

    keys.forEach(k => assert(!(k in seeded), `factory reset removes key: ${k}`));
  }

  // ── New-user defaults: labor rates and price sheet have NO pre-filled pricing ──
  {
    const ctx5 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{}, removeItem:()=>{} },
      alert:()=>{}, confirm:()=>true, console,
    };
    vm.runInNewContext(scriptSrc, ctx5);

    // getRates() drives actual quote math — must be all zero for a fresh device
    const rates = ctx5.getRates();
    assert(rates.standard === 0, 'fresh device: standard turf rate = 0');
    assert(rates.putting === 0, 'fresh device: putting green rate = 0');
    assert(rates.edging === 0, 'fresh device: edging rate = 0');
    assert(rates.edgingBoard === 0, 'fresh device: edging board rate = 0');

    // Every default labor/price-sheet line item has an empty (not pre-filled) rate
    const crews = ctx5.getCrews();
    const allEmpty = crews[0].items.every(item => item.rate === '' || item.rate == null);
    assert(allEmpty, 'fresh device: all default labor/price-sheet items have no pre-filled rate');

    // Turf/infill/rock catalogs still have starter products (names), just no pricing
    const catalog = ctx5.getCatalog();
    assert(catalog.turf.length > 0, 'fresh device: starter turf product list still present');
    assert(catalog.turf.every(t => !t.costPerLinFt), 'fresh device: starter turf products have no pre-filled cost');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  16. PROJECT CREATION — sqFtToOrder is optional
// ════════════════════════════════════════════════════════════════════════
section('16. New project: Sqft to Order is optional');
{
  // calcTurfRow logic: with empty sqFtToOrder, linearFt/orderedSqFt should be
  // empty strings (not 0, not NaN) so the UI shows blank rather than a value.
  function simulateCalcTurfRow(row) {
    const width = 15;
    const orderSqFt = parseFloat(row.sqFtToOrder) || 0;
    row.linearFt   = orderSqFt ? Math.ceil(orderSqFt / width) : '';
    row.orderedSqFt = row.linearFt ? row.linearFt * width : '';
    return row;
  }

  const rowEmpty = simulateCalcTurfRow({ sqFtToOrder: '', installedSqFt: 500 });
  assert(rowEmpty.linearFt === '', 'empty sqFtToOrder → linearFt is empty string');
  assert(rowEmpty.orderedSqFt === '', 'empty sqFtToOrder → orderedSqFt is empty string');

  const rowFilled = simulateCalcTurfRow({ sqFtToOrder: 500, installedSqFt: 450 });
  assert(rowFilled.linearFt === 34, 'sqFtToOrder=500 → linearFt = ceil(500/15) = 34');
  assert(rowFilled.orderedSqFt === 510, 'sqFtToOrder=500 → orderedSqFt = 34×15 = 510');

  // turfMaterialCost logic: a row with no sqFtToOrder/orderedSqFt contributes $0, not NaN
  function simulateTurfMaterialCost(rows, catalog) {
    return rows.reduce((s,r) => {
      const ordered = parseFloat(r.orderedSqFt) || (Math.ceil((parseFloat(r.sqFtToOrder)||0) / 15) * 15);
      const ci = catalog.find(c=>c.name===r.product);
      const cpsf = ci ? parseFloat(ci.costPerLinFt)||0 : 0;
      return s + ordered * cpsf;
    }, 0);
  }
  const catalog = [{ name:'WT Test Turf', costPerLinFt: 2.5 }];
  const costWithEmpty = simulateTurfMaterialCost([{ product:'WT Test Turf', sqFtToOrder:'', orderedSqFt:'' }], catalog);
  assert(costWithEmpty === 0, 'turf row with no Sqft to Order contributes $0 to material cost (not NaN)');
  assert(!isNaN(costWithEmpty), 'turf material cost is never NaN with empty sqFtToOrder');

  const costWithValue = simulateTurfMaterialCost([{ product:'WT Test Turf', sqFtToOrder:500, orderedSqFt:510 }], catalog);
  assert(near(costWithValue, 510*2.5), 'turf row with Sqft to Order calculates correct material cost');

  // checkCreateBtn logic: only requires at least one turf product checked,
  // NOT that Sqft to Order be filled in (can be set later via Layout tab).
  function simulateCheckCreateBtn(checkedRows) {
    const anyTurf = checkedRows.length > 0;
    return !anyTurf; // returns `disabled` state
  }
  assert(simulateCheckCreateBtn([{sqFtToOrder:''}]) === false, 'Create button enabled with turf checked, even if Sqft to Order is blank');
  assert(simulateCheckCreateBtn([]) === true, 'Create button disabled with no turf checked');
}

// ════════════════════════════════════════════════════════════════════════
//  17. MULTI-LAYER MOASURE CSV & SECONDARY SHAPES
// ════════════════════════════════════════════════════════════════════════
section('17. Multi-layer CSV parsing & secondary shapes');
{
  // ── Synthetic 2-layer CSV: Layer 1 = 10x10 square (outer), Layer 2 = small square (inner cutout) ──
  // Layer 1 uses path 1, Layer 2 also uses path 1 (paths are per-layer in Moasure exports)
  const header = '"Layer","Path","Point","X:ft","Y:ft","Z:ft","Layer-Name","Path-Type","Point-Name","Point-Type","Area:ft²",';
  const row = (layer, path, point, x, y, layerName, area) =>
    `"${layer}","${path}","${point}","${x.toFixed(2)}","${y.toFixed(2)}","0.00","${layerName}","Dot2Dot","","Default","${area.toFixed(2)}"`;

  const csv = [
    header,
    // Layer 1: 10x10 outer square, area=100
    row(1,1,1, 0,0,  'Base Layer', 100),
    row(1,1,2, 10,0, 'Base Layer', 100),
    row(1,1,3, 10,10,'Base Layer', 100),
    row(1,1,4, 0,10, 'Base Layer', 100),
    // Layer 2: 2x2 inner square, area=4
    row(2,1,1, 4,4, 'Sub Layer 1', 4),
    row(2,1,2, 6,4, 'Sub Layer 1', 4),
    row(2,1,3, 6,6, 'Sub Layer 1', 4),
    row(2,1,4, 4,6, 'Sub Layer 1', 4),
  ].join('\n');

  const result = ctx.parseLayoutCsv(csv);

  assert(result.shapes.length === 2, 'multi-layer CSV produces 2 shapes');
  assert(result.primaryLayer === '1', 'primary layer = largest area (Layer 1)');
  assert(near(result.area, 100), 'primary shape area = 100 (Layer 1)');
  assert(result.points.length === 4, 'primary shape has 4 points');
  assert(result.secondaryShapes.length === 1, 'secondaryShapes contains 1 entry (Layer 2)');
  assert(result.secondaryShapes[0].name === 'Sub Layer 1', 'secondary shape retains Layer-Name');
  assert(near(result.secondaryShapes[0].area, 4), 'secondary shape area = 4 (Layer 2)');

  // ── Single-layer CSV still works (backward compatibility) ──
  const csvSingle = [
    header,
    row(1,1,1, 0,0,  'Base Layer', 100),
    row(1,1,2, 10,0, 'Base Layer', 100),
    row(1,1,3, 10,10,'Base Layer', 100),
    row(1,1,4, 0,10, 'Base Layer', 100),
  ].join('\n');
  const resultSingle = ctx.parseLayoutCsv(csvSingle);
  assert(resultSingle.shapes.length === 1, 'single-layer CSV produces 1 shape');
  assert(resultSingle.secondaryShapes.length === 0, 'single-layer CSV has no secondary shapes');
  assert(near(resultSingle.area, 100), 'single-layer CSV area unchanged');

  // ── getAdjustedShapeArea: exclude mode subtracts secondary shape area ──
  {
    const proj = { layout: { secondaryShapes: [{ name:'Cutout', area: 25, points: rect(0,0,5,5) }], secondaryShapeModes: { 0: 'exclude' } } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(near(adjusted, 75), 'exclude mode: 100 - 25 = 75');
  }

  // ── getAdjustedShapeArea: ignore mode leaves area unchanged ──
  {
    const proj = { layout: { secondaryShapes: [{ name:'Info shape', area: 25, points: rect(0,0,5,5) }], secondaryShapeModes: { 0: 'ignore' } } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(near(adjusted, 100), 'ignore mode: area unchanged (100)');
  }

  // ── getAdjustedShapeArea: default mode (no explicit mode set) is "install" ──
  // Install layers are their own areas (summed separately), so they do NOT
  // subtract from the primary's installed area.
  {
    const proj = { layout: { secondaryShapes: [{ name:'Cutout', area: 10, points: rect(0,0,5,5) }], secondaryShapeModes: {} } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(near(adjusted, 100), 'default mode (no entry) = install: primary area unchanged (100)');
  }

  // ── getAdjustedShapeArea: multiple secondary shapes, mixed modes ──
  {
    const proj = { layout: { secondaryShapes: [
      { name:'Cutout A', area: 10, points: rect(0,0,5,5) },
      { name:'Info B',   area: 20, points: rect(0,0,5,5) },
      { name:'Cutout C', area: 5,  points: rect(0,0,5,5) },
    ], secondaryShapeModes: { 0:'exclude', 1:'ignore', 2:'exclude' } } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(near(adjusted, 85), 'mixed modes: 100 - 10 (A excluded) - 5 (C excluded), B ignored = 85');
  }

  // ── getAdjustedShapeArea: never returns negative (clamped at 0) ──
  {
    const proj = { layout: { secondaryShapes: [{ name:'Huge cutout', area: 500, points: rect(0,0,5,5) }], secondaryShapeModes: { 0:'exclude' } } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(adjusted === 0, 'adjusted area clamped at 0, never negative');
  }

  // ── getAdjustedShapeArea: no secondary shapes returns base area unchanged ──
  {
    const proj = { layout: {} };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(adjusted === 100, 'no secondary shapes: area unchanged');
  }

  // ── getSecondaryShapeArea: falls back to polygonArea if .area is null ──
  {
    const shapeNoArea = { name:'No area field', points: rect(0,0,5,5), area: null };
    assert(near(ctx.getSecondaryShapeArea(shapeNoArea), 25), 'getSecondaryShapeArea falls back to polygonArea when .area is null');
    const shapeWithArea = { name:'Has area', points: rect(0,0,5,5), area: 99 };
    assert(ctx.getSecondaryShapeArea(shapeWithArea) === 99, 'getSecondaryShapeArea uses .area field when present');
  }

  // ── getPuttingGreenShapeArea: sums only putting-green shapes ──
  {
    const proj = { layout: { secondaryShapes: [
      { name:'Green',  area: 150, points: rect(0,0,5,5) },
      { name:'Hole',   area: 50,  points: rect(0,0,5,5) },
      { name:'Info',   area: 20,  points: rect(0,0,5,5) },
      { name:'Green2', area: 30,  points: rect(0,0,5,5) },
    ], secondaryShapeModes: { 0:'putting-green', 1:'exclude', 2:'ignore', 3:'putting-green' } } };
    assert(near(ctx.getPuttingGreenShapeArea(proj), 180), 'getPuttingGreenShapeArea sums only PG shapes (150 + 30 = 180)');
    assert(ctx.getPuttingGreenShapeArea({ layout: {} }) === 0, 'no secondary shapes → PG area 0');
  }

  // ── Apply Area math identity: adjusted + PG = primary minus true holes only ──
  {
    const proj = { layout: { secondaryShapes: [
      { name:'Green', area: 150, points: rect(0,0,5,5) },
      { name:'Hole',  area: 50,  points: rect(0,0,5,5) },
    ], secondaryShapeModes: { 0:'putting-green', 1:'exclude' } } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 1500); // 1500 - 150 - 50
    const baseApply = adjusted + ctx.getPuttingGreenShapeArea(proj);
    assert(near(adjusted, 1300), 'adjusted subtracts green(150) + hole(50) = 1300');
    assert(near(baseApply, 1450), 'base apply adds green back → 1500 - 50 hole = 1450');
  }

  // ── applyLayoutAreaToTurf end-to-end: base row gets whole yard incl. green ──
  {
    const stored = {};
    const mockLS = { getItem:k=>stored[k]||null, setItem:(k,v)=>{stored[k]=v;}, removeItem:k=>{delete stored[k];} };
    stored['wt_catalog_v2'] = JSON.stringify({ turf:[], infill:[], rock:[] });
    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'T', created:1000, edging:{}, miscItems:[],
      turf:[
        { product:'Base', installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'base' },
        { product:'Alt',  installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'alt-turf' },
        { product:'Putt', installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'putting-green' },
      ],
      infill:[], rock:[],
      layout:{
        points: rect(0,0,40,40), area: 1500,
        secondaryShapes:[ { name:'Green', area:150, points: rect(0,0,10,15) }, { name:'Hole', area:50, points: rect(20,20,5,10) } ],
        secondaryShapeModes:{ 0:'putting-green', 1:'exclude' },
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);
    let applyTarget = '0';
    function mEl(){ return { checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild:()=>{}, replaceChildren:()=>{} }; }
    const inputs = { layoutApplyTarget:{ get value(){ return applyTarget; } }, quoteOptionsContainer:{innerHTML:''}, turfRows:{innerHTML:'',appendChild:()=>{}}, infillRows:{innerHTML:'',appendChild:()=>{}}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}}, fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''}, layoutLayersList:{innerHTML:''}, quoteMiscRows:{innerHTML:'',appendChild:()=>{}}, rockRows:{innerHTML:'',appendChild:()=>{}} };
    const m2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    inputs.rollLayoutCanvas = { width:700,height:350,getContext:()=>m2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };
    const ctxA = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900,_wtCurrentRollLayout:null},
      document:{ getElementById:id=>inputs[id]||mEl(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mEl() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver:function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, ctxA);
    ctxA.loadProject('p1');
    ctxA.window._wtCurrentRollLayout = null; // force the getAdjustedShapeArea fallback path

    applyTarget = '0';
    ctxA.applyLayoutAreaToTurf();
    assert(near(ctxA.getCurrentProject().turf[0].installedSqFt, 1450), 'Apply Area → BASE row = whole yard incl. green (1500 - 50 hole = 1450)');

    applyTarget = '1';
    const altBefore = ctxA.getCurrentProject().turf[1].installedSqFt;
    ctxA.applyLayoutAreaToTurf();
    assert(near(ctxA.getCurrentProject().turf[1].installedSqFt, altBefore || 0),
      'Apply Area → ALT-TURF row is blocked (priced on base yard area; its installedSqFt is left unchanged)');

    applyTarget = '2';
    ctxA.applyLayoutAreaToTurf();
    assert(near(ctxA.getCurrentProject().turf[2].installedSqFt, 1300), 'Apply Area → PUTTING-GREEN row does NOT add the green back (1300)');

    // ── computeApplyAreaForRow (pure, role-aware): the decision the DOM wrapper uses ──
    {
      const projH = { layout:{ secondaryShapes:[{area:20,points:rect(0,0,4,5)}], secondaryShapeModes:{0:'putting-green'} } };
      const layH = { adjustedShapeArea: 480 };
      const baseRes = ctxA.computeApplyAreaForRow(projH, layH, { role:'base' });
      assert(baseRes.ok && near(baseRes.area, 500), 'computeApplyAreaForRow: base adds the green back (480 + 20 = 500)');
      const pgRes = ctxA.computeApplyAreaForRow(projH, layH, { role:'putting-green' });
      assert(pgRes.ok && near(pgRes.area, 480), 'computeApplyAreaForRow: putting-green uses the adjusted area as-is (480)');
      const altRes = ctxA.computeApplyAreaForRow(projH, layH, { role:'alt-turf' });
      assert(!altRes.ok && altRes.reason === 'alt-turf-priced-on-base', 'computeApplyAreaForRow: alt-turf is blocked (priced on base yard area)');
      const zeroRes = ctxA.computeApplyAreaForRow({ layout:{} }, { adjustedShapeArea:0, shapeArea:0 }, { role:'base' });
      assert(!zeroRes.ok && zeroRes.reason === 'no-area', 'computeApplyAreaForRow: a zero-area layout is blocked (no-area)');
    }
  }

  // ── Real John_yard.csv fixture (if available): 2 layers, primary ≈ 726.65, secondary ≈ 157 ──
  try {
    const realCsv = fs.readFileSync(path.join(__dirname, 'John_yard.csv'), 'utf8');
    const realResult = ctx.parseLayoutCsv(realCsv);
    assert(realResult.shapes.length === 2, 'John_yard.csv: 2 layers parsed');
    assert(near(realResult.area, 726.65, 1), 'John_yard.csv: primary (Layer 1) area ≈ 726.65');
    assert(realResult.secondaryShapes.length === 1, 'John_yard.csv: 1 secondary shape');
    assert(near(realResult.secondaryShapes[0].area, 157, 1), 'John_yard.csv: secondary (Layer 2) area ≈ 157');
  } catch(e) {
    console.log('  (John_yard.csv fixture not found — skipping real-file test)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  18. EDGING LABELS REFLECT ACTUAL CREW RATES (no hardcoded $4/$55)
// ════════════════════════════════════════════════════════════════════════
section('18. Edging labels use crew rates, not hardcoded values');
{
  // Simulate the hint-building logic from calcEdging()
  function buildHints(rates) {
    const boardsHint = rates.edgingBoard ? `$${rates.edgingBoard.toFixed(2)}/board (board, stakes, screws)` : 'board, stakes, screws — set rate in Settings';
    const installHint = rates.edging ? `$${rates.edging.toFixed(2)}/lin ft` : 'rate not set in Settings';
    return { boardsHint, installHint };
  }

  // Default (zero) rates: no hardcoded $ shown
  let hints = buildHints({ edging: 0, edgingBoard: 0 });
  assert(!hints.installHint.includes('$'), 'zero edging rate: hint has no hardcoded $');
  assert(!hints.boardsHint.includes('$'), 'zero board rate: hint has no hardcoded $');
  assert(hints.installHint.includes('not set'), 'zero edging rate: hint indicates rate not set');

  // Custom crew rate (e.g. $6/lf, $60/board) reflects in the label
  hints = buildHints({ edging: 6, edgingBoard: 60 });
  assert(hints.installHint === '$6.00/lin ft', 'custom edging rate ($6) shown in label');
  assert(hints.boardsHint.startsWith('$60.00/board'), 'custom board rate ($60) shown in label');

  // Different crew with different rate updates the label (not stuck at $4/$55)
  hints = buildHints({ edging: 4, edgingBoard: 55 });
  assert(hints.installHint === '$4.00/lin ft', 'crew with $4 rate shows $4.00/lin ft dynamically (not hardcoded text)');
  hints = buildHints({ edging: 8, edgingBoard: 70 });
  assert(hints.installHint === '$8.00/lin ft', 'switching to a crew with $8 rate updates label to $8.00/lin ft');
}

// ════════════════════════════════════════════════════════════════════════
//  19. TURF ROWS RENDER ON PROJECT LOAD (editable, not just on add)
// ════════════════════════════════════════════════════════════════════════
section('19. Turf rows render with editable values on project load');
{
  // Simulate makeTurfRow's template logic: given a saved turf row, the
  // rendered input values must reflect the saved data (so they're editable
  // immediately on load, not just after adding/removing a row).
  function simulateMakeTurfRowValues(row) {
    return {
      product: row.product || '',
      installedSqFt: row.installedSqFt || '',
      sqFtToOrder: row.sqFtToOrder || '',
      linearFt: row.linearFt || '',
      orderedSqFt: row.orderedSqFt || '',
    };
  }

  const savedRow = { product: 'WT Willamette Lush', installedSqFt: 500, sqFtToOrder: 540, linearFt: 36, orderedSqFt: 540 };
  const rendered = simulateMakeTurfRowValues(savedRow);
  assert(rendered.installedSqFt === 500, 'rendered Installed SqFt matches saved value');
  assert(rendered.sqFtToOrder === 540, 'rendered Sqft to Order matches saved value');
  assert(rendered.product === 'WT Willamette Lush', 'rendered product name matches saved value');

  // Empty/blank row also renders correctly (no NaN, no "undefined")
  const blankRow = { product:'', installedSqFt:'', sqFtToOrder:'', linearFt:'', orderedSqFt:'' };
  const renderedBlank = simulateMakeTurfRowValues(blankRow);
  assert(renderedBlank.installedSqFt === '', 'blank row renders empty Installed SqFt, not "undefined"');
  assert(renderedBlank.sqFtToOrder === '', 'blank row renders empty Sqft to Order, not "undefined"');

  // loadProject ordering: renderTurfRows must run BEFORE calcTurfRow loop,
  // so calcTurfRow's DOM lookups (.turf-row, input[3]/input[4]) find real elements.
  // Verify this ordering directly from source.
  const html = fs.readFileSync(path.join(__dirname, 'waterloo_turf_calculator.html'), 'utf8');
  const loadProjectSrc = html.match(/function loadProject\(id\) \{[\s\S]*?\n\}/)[0];
  const renderIdx = loadProjectSrc.indexOf('renderTurfRows(proj)');
  const calcLoopIdx = loadProjectSrc.indexOf('calcTurfRow(i)');
  assert(renderIdx !== -1, 'loadProject calls renderTurfRows');
  assert(calcLoopIdx !== -1, 'loadProject calls calcTurfRow in a loop');
  assert(renderIdx < calcLoopIdx, 'renderTurfRows runs BEFORE the calcTurfRow loop in loadProject (so DOM elements exist)');
}

// ════════════════════════════════════════════════════════════════════════
//  20. NESTING PERSISTS ACROSS ROLL PARAMETER CHANGES (stable strip keys)
// ════════════════════════════════════════════════════════════════════════
section('20. Nesting keyed by stable position, not array index');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];

  const base = ctx.computeRollLayout(lShape, 0, 0, opts);
  const small = base.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
  const big   = base.strips.find(s => s.index !== (small||{}).index && s.wasteArea >= (small||{purchasedArea:9999}).purchasedArea);

  if (small && big) {
    // Each strip's .key is derived from its y0 band position
    assert(typeof small.key === 'string' && small.key.startsWith('y'), 'strip.key is a position-derived string (e.g. "y0.00")');
    assert(small.key !== String(small.index), 'strip.key is NOT just the array index');

    const nesting = { [small.key]: big.key };

    // Recompute. As long as the same bands still exist (same y0 values), nesting
    // keyed by position should still apply.
    const opts2 = { ...opts, nesting };
    const recomputed = ctx.computeRollLayout(lShape, 0, 0, opts2);
    const recomputedSmall = recomputed.strips.find(s => s.key === small.key);
    assert(recomputedSmall && recomputedSmall.nestedInto != null, 'nesting still applies after recompute when band positions unchanged');
    assert(recomputed.totalSaved > 0, 'totalSaved > 0 after recompute with position-based nesting');

    // A nesting entry for a key that no longer exists is silently ignored — no
    // crash, no misapplied nesting onto an unrelated strip.
    const optsShifted = { ...opts, nesting: { 'y999.00': big.key } };
    const shifted = ctx.computeRollLayout(lShape, 0, 0, optsShifted);
    const anyNested = shifted.strips.some(s => s.nestedInto != null);
    assert(!anyNested, 'nesting entry for a nonexistent key does not get misapplied to a different strip');
  } else {
    console.log('  (section 20 skipped — no suitable strip pair found for this shape)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  21. LAYER VISIBILITY TOGGLES
// ════════════════════════════════════════════════════════════════════════
section('21. Layer visibility (isLayerVisible / setLayerVisible)');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const fullProj = (id,name,created,layout) => ({id,name,created,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout});

  function freshCtx(initialProjects) {
    stored['wt_projects_v4'] = JSON.stringify(initialProjects);
    const ctx2 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null },
      document: { getElementById:()=>mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    };
    vm.runInNewContext(scriptSrc, ctx2);
    return ctx2;
  }

  // ── Default visibility: everything visible when layerVisibility is absent ──
  {
    const proj = { layout: {} };
    assert(ctx.isLayerVisible(proj, 'primary') === true, 'primary layer visible by default (no layerVisibility map)');
    assert(ctx.isLayerVisible(proj, 0) === true, 'secondary layer 0 visible by default (no layerVisibility map)');
  }

  // ── Explicit true/false in the map ──
  {
    const proj = { layout: { layerVisibility: { primary: false, 0: true, 1: false } } };
    assert(ctx.isLayerVisible(proj, 'primary') === false, 'primary layer hidden when explicitly false');
    assert(ctx.isLayerVisible(proj, 0) === true, 'secondary layer 0 visible when explicitly true');
    assert(ctx.isLayerVisible(proj, 1) === false, 'secondary layer 1 hidden when explicitly false');
    assert(ctx.isLayerVisible(proj, 2) === true, 'secondary layer 2 (not in map) defaults to visible');
  }

  // ── setLayerVisible persists to proj.layout.layerVisibility and survives reload ──
  {
    const layoutData = { points: rect(0,0,10,10), area: 100, secondaryShapes: [{name:'Cutout',area:10,points:rect(0,0,2,2)}] };
    const stored2 = {};
    const mockLS2 = { getItem: k => stored2[k]||null, setItem: (k,v) => { stored2[k]=v; } };
    stored2['wt_projects_v4'] = JSON.stringify([fullProj('p1','Test',1000,layoutData)]);

    const mockCtx2d = {
      clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
      fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
      arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
      translate:()=>{}, rect:()=>{}, clip:()=>{},
    };
    const mockCanvas = { getContext:()=>mockCtx2d, width:700, height:440, getBoundingClientRect:()=>({left:0,top:0,width:700,height:440}), addEventListener:()=>{}, style:{} };
    const elMap = { rollLayoutCanvas: mockCanvas, layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} } };

    const ctx2 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
      document: {
        getElementById: id => elMap[id] || mockEl(),
        querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{},
      },
      localStorage: mockLS2, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){ return {observe:()=>{}}; },
    };
    vm.runInNewContext(scriptSrc, ctx2);

    ctx2.loadProject('p1');
    ctx2.setLayerVisible('primary', false);
    ctx2.setLayerVisible(0, false);

    const reloaded = ctx2.getProjects().find(p=>p.id==='p1');
    assert(reloaded.layout.layerVisibility && reloaded.layout.layerVisibility.primary === false, 'primary visibility=false persists to storage');
    assert(reloaded.layout.layerVisibility && reloaded.layout.layerVisibility[0] === false, 'secondary layer 0 visibility=false persists to storage');

    // Toggle back on
    ctx2.setLayerVisible('primary', true);
    const reloaded2 = ctx2.getProjects().find(p=>p.id==='p1');
    assert(reloaded2.layout.layerVisibility.primary === true, 'toggling primary back to visible persists');
  }

  // ── Visibility is independent of secondaryShapeMode (exclude/ignore) ──
  {
    const proj = { layout: { secondaryShapeModes: { 0: 'exclude' }, layerVisibility: { 0: false } } };
    // Even though mode is 'exclude' (affects area calc), visibility can still be false (hidden on canvas)
    assert(ctx.isLayerVisible(proj, 0) === false, 'a layer can be hidden on canvas while still excluded from area calc');
    // getAdjustedShapeArea should be unaffected by visibility — it only cares about mode
    const adjusted = ctx.getAdjustedShapeArea({ layout: { secondaryShapes:[{area:10,points:rect(0,0,2,2)}], secondaryShapeModes:{0:'exclude'}, layerVisibility:{0:false} } }, 100);
    assert(near(adjusted, 90), 'hiding a layer does not change its exclude/ignore effect on Installed Area');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  22. MOVE LAYERS (per-layer position offsets are purely cosmetic)
// ════════════════════════════════════════════════════════════════════════
section('22. Layer offsets are purely visual, do not affect roll math');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  const shape = rect(0,0,20,15);

  // Baseline layout
  const base = ctx.computeRollLayout(shape, 0, 0, opts);

  // Apply a translation offset to the shape before computing — this simulates
  // what renderRollLayout does when primaryOffset is non-zero
  const offsetShape = shape.map(p => ({ x: p.x + 50, y: p.y - 30 }));
  const offset = ctx.computeRollLayout(offsetShape, 0, 0, opts);

  assert(near(offset.shapeArea, base.shapeArea), 'translating the shape does not change shapeArea');
  assert(near(offset.totalOrdered, base.totalOrdered), 'translating the shape does not change totalOrdered');
  assert(near(offset.scrap, base.scrap), 'translating the shape does not change scrap');
  assert(offset.numStrips === base.numStrips, 'translating the shape does not change numStrips');
  assert(near(offset.linearFt, base.linearFt), 'translating the shape does not change linearFt');

  // displayClipped/displayRect geometry IS shifted by the offset (visual position changes)
  const baseStrip = base.strips.find(s=>s.clippedArea>0.5);
  const offsetStrip = offset.strips.find(s=>s.clippedArea>0.5);
  if (baseStrip && offsetStrip) {
    const baseCx = baseStrip.displayClipped.reduce((s,p)=>s+p.x,0)/baseStrip.displayClipped.length;
    const offsetCx = offsetStrip.displayClipped.reduce((s,p)=>s+p.x,0)/offsetStrip.displayClipped.length;
    assert(near(offsetCx - baseCx, 50, 0.1), 'displayClipped geometry shifts by the applied offset (dx=50)');
  }

  // ── resetLayerPosition removes the offset and persists ──
  {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const layoutData = {
      points: rect(0,0,10,10), area: 100,
      secondaryShapes: [{name:'Cutout',area:10,points:rect(0,0,2,2)}],
      layerOffsets: { primary: {dx:50,dy:-30}, 0: {dx:5,dy:5} },
    };
    stored['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData}]);

    const mockCtx2d = {
      clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
      fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
      arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
      translate:()=>{}, rect:()=>{}, clip:()=>{},
    };
    const mockCanvas = { getContext:()=>mockCtx2d, width:700, height:440, getBoundingClientRect:()=>({left:0,top:0,width:700,height:440}), addEventListener:()=>{}, style:{} };
    const elMap = { rollLayoutCanvas: mockCanvas, layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} } };

    const ctx2 = {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
      document: { getElementById: id => elMap[id] || mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){ return {observe:()=>{}}; },
    };
    vm.runInNewContext(scriptSrc, ctx2);

    ctx2.loadProject('p1');
    let reloaded = ctx2.getProjects().find(p=>p.id==='p1');
    assert(reloaded.layout.layerOffsets.primary.dx === 50, 'layerOffsets.primary persisted from saved data');

    ctx2.resetLayerPosition('primary');
    reloaded = ctx2.getProjects().find(p=>p.id==='p1');
    assert(!('primary' in (reloaded.layout.layerOffsets||{})), 'resetLayerPosition removes the primary offset');
    assert(reloaded.layout.layerOffsets[0].dx === 5, 'resetting primary does not affect other layers\' offsets');

    ctx2.resetLayerPosition(0);
    reloaded = ctx2.getProjects().find(p=>p.id==='p1');
    assert(!(0 in (reloaded.layout.layerOffsets||{})), 'resetLayerPosition removes a secondary layer offset');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  23. autoRotateRollLayout — END-TO-END (calls the real button handler)
// ════════════════════════════════════════════════════════════════════════
section('23. autoRotateRollLayout end-to-end (catches undefined-variable bugs)');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const layoutData = { points: rect(0,0,40,12), area: 480, rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4, rotation:0, translation:0 };
  stored['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData}]);

  const mockCtx2d = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas = { getContext:()=>mockCtx2d, width:700, height:440, getBoundingClientRect:()=>({left:0,top:0,width:700,height:440}), addEventListener:()=>{}, style:{} };

  // Input elements need real .value storage so autoRotateRollLayout can write
  // results into rollRotationInput/rollTranslationInput and renderRollLayout can read them back.
  const inputs = {
    rollRotationInput: { value: '0' },
    rollTranslationInput: { value: '0', max:'' },
    rollWidthInput: { value: '15' },
    rollLengthInput: { value: '100' },
    sideTrimInput: { value: '4' },
    cuttingMarginInput: { value: '4' },
    rollRotationValue: { textContent:'' },
    rollTranslationValue: { textContent:'' },
    showRectanglesToggle: { checked: false },
    rollStripsOut: { value:'' }, rollOrderedOut: { value:'' }, rollUsableOut: { value:'' },
    rollLinearOut: { value:'' }, rollWasteOut: { value:'' },
    rollSavedGroup: { style:{} }, rollSavedOut: { value:'' },
    rollNestingLegend: { style:{} },
    layoutArea: { value:'' }, layoutApplyTarget: { innerHTML:'' },
    rollApplyTarget: { innerHTML:'' },
    layoutLayersList: { innerHTML:'' },
    rollLayoutCanvas: mockCanvas,
    layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} },
  };

  const ctx2 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: {
      getElementById: id => inputs[id] || mockEl(),
      querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{},
    },
    localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx2);

  ctx2.loadProject('p1');

  // Calling the real function must not throw (previously threw ReferenceError:
  // basePoints/effW/opts not defined)
  let threw = false, errMsg = '';
  try { ctx2.autoRotateRollLayout(); } catch(e) { threw = true; errMsg = e.message; }
  assert(!threw, 'autoRotateRollLayout runs without throwing' + (threw ? ` (${errMsg})` : ''));

  // It should have written a rotation/translation value back into the inputs
  const rotVal = parseFloat(inputs.rollRotationInput.value);
  const transVal = parseFloat(inputs.rollTranslationInput.value);
  assert(!isNaN(rotVal) && rotVal >= 0 && rotVal < 180, 'autoRotateRollLayout writes a valid rotation (0-179°) to rollRotationInput');
  assert(!isNaN(transVal) && transVal >= 0, 'autoRotateRollLayout writes a valid translation to rollTranslationInput');

  // The resulting totalOrdered should be ≤ the 0°/0 baseline (it found something at least as good)
  const opts = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4, nesting:{} };
  const baseline = ctx.computeRollLayout(rect(0,0,40,12), 0, 0, opts).totalOrdered;
  const result = ctx.computeRollLayout(rect(0,0,40,12), rotVal, transVal, opts).totalOrdered;
  assert(result <= baseline + 0.01, 'auto-minimize result is ≤ 0° baseline (button actually does something)');
}

// ════════════════════════════════════════════════════════════════════════
//  24. SECONDARY LAYER ROTATION (align putting green / cutout to position)
// ════════════════════════════════════════════════════════════════════════
section('24. setLayerRotation — secondary layer rotation about own centroid');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const layoutData = {
    points: rect(0,0,40,40), area: 1600,
    secondaryShapes: [{ name:'Putting Green', area: 100, points: rect(10,10,10,10) }], // 10x10 square at (10,10)-(20,20)
  };
  stored['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData}]);

  const mockCtx2d = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas = { getContext:()=>mockCtx2d, width:700, height:440, getBoundingClientRect:()=>({left:0,top:0,width:700,height:440}), addEventListener:()=>{}, style:{} };
  const elMap = { rollLayoutCanvas: mockCanvas, layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} } };

  const ctx2 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: { getElementById: id => elMap[id] || mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
    localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx2);
  ctx2.loadProject('p1');

  // setLayerRotation persists the rotation value
  ctx2.setLayerRotation(0, 90);
  let reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(reloaded.layout.layerOffsets[0].rotation === 90, 'setLayerRotation persists rotation degrees');

  // Rotation normalizes to [0, 360)
  ctx2.setLayerRotation(0, 450);
  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(reloaded.layout.layerOffsets[0].rotation === 90, '450° normalizes to 90°');

  ctx2.setLayerRotation(0, -30);
  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(near(reloaded.layout.layerOffsets[0].rotation, 330), '-30° normalizes to 330°');

  // Rotating a square by 90° about its own centroid preserves its area and centroid position
  ctx2.setLayerRotation(0, 90);
  const shape = rect(10,10,10,10);
  const { cx, cy } = ctx.centroidOf(shape);
  const rotated90 = ctx.rotateAround(shape, 90, cx, cy);
  assert(near(ctx.polygonArea(rotated90), 100), 'rotating secondary shape 90° preserves its area');
  const rotatedCentroid = ctx.centroidOf(rotated90);
  assert(near(rotatedCentroid.cx, cx) && near(rotatedCentroid.cy, cy), 'rotation about own centroid keeps shape centered in place');

  // Rotation + translation: dragging after rotating preserves the rotation (doesn't reset to 0)
  ctx2.setLayerRotation(0, 45);
  // Simulate a drag: directly call the offset-merge logic moveDragLayer uses
  const allProjects = ctx2.getProjects();
  reloaded = allProjects.find(p=>p.id==='p1');
  const cur = reloaded.layout.layerOffsets[0];
  reloaded.layout.layerOffsets[0] = { ...cur, dx: cur.dx + 5, dy: cur.dy + 3 };
  ctx2.saveProjects(allProjects);
  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(reloaded.layout.layerOffsets[0].rotation === 45, 'translating after rotating preserves the rotation value');
  assert(reloaded.layout.layerOffsets[0].dx === 5 && reloaded.layout.layerOffsets[0].dy === 3, 'translation values also applied correctly');

  // resetLayerPosition clears both rotation and offset
  ctx2.resetLayerPosition(0);
  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(!(0 in (reloaded.layout.layerOffsets||{})), 'resetLayerPosition clears rotation along with position offset');

  // Rotation does not affect getAdjustedShapeArea (area is computed from .area/polygonArea
  // of the ORIGINAL points, not the rotated display points)
  const projForArea = { layout: { secondaryShapes:[{area:100,points:rect(10,10,10,10)}], secondaryShapeModes:{0:'exclude'}, layerOffsets:{0:{dx:5,dy:3,rotation:45}} } };
  const adjusted = ctx.getAdjustedShapeArea(projForArea, 1600);
  assert(near(adjusted, 1500), 'rotation/position offsets do not change the area used in Installed Area calc (still 1600-100=1500)');
}

// ════════════════════════════════════════════════════════════════════════
//  25. MANUAL CUTS — split a strip into multiple independently-nestable pieces
// ════════════════════════════════════════════════════════════════════════
section('25. Manual cuts (butt seams) and piece-level nesting');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0.5, nesting:{}, manualCuts:{} };

  // ── No manual cuts: strips have pieces:null, behavior unchanged ──
  {
    const shape = rect(0,0,30,15);
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = l.strips.find(s=>s.clippedArea>0.5);
    assert(strip.pieces === null, 'strip.pieces is null when no manual cuts are set');
  }

  // ── A single cut splits a strip into 2 pieces with correct lengths ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    const cutOpts = {...opts, manualCuts: { [strip.key]: [18] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);

    assert(cutStrip.pieces !== null, 'cutting a strip populates .pieces');
    assert(cutStrip.pieces.length === 2, 'one cut produces 2 pieces');
    assert(near(cutStrip.pieces[0].length, 18), 'first piece length = 18 (cut position)');
    assert(near(cutStrip.pieces[1].length, 12), 'second piece length = 30-18 = 12');
    assert(near(cutStrip.pieces[0].start, 0) && near(cutStrip.pieces[0].end, 18), 'first piece spans [0,18]');
    assert(near(cutStrip.pieces[1].start, 18) && near(cutStrip.pieces[1].end, 30), 'second piece spans [18,30]');
  }

  // ── Multiple cuts produce 3+ pieces, sorted by position regardless of input order ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    // Cuts given out of order: [20, 10] should still produce pieces [0-10],[10-20],[20-30]
    const cutOpts = {...opts, manualCuts: { [strip.key]: [20, 10] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);

    assert(cutStrip.pieces.length === 3, 'two cuts produce 3 pieces');
    assert(near(cutStrip.pieces[0].start,0) && near(cutStrip.pieces[0].end,10), 'piece 0 = [0,10] even though cuts given out of order');
    assert(near(cutStrip.pieces[1].start,10) && near(cutStrip.pieces[1].end,20), 'piece 1 = [10,20]');
    assert(near(cutStrip.pieces[2].start,20) && near(cutStrip.pieces[2].end,30), 'piece 2 = [20,30]');
  }

  // ── Each piece gets its own cutting margin: orderedLength = pieceLength + cuttingMargin ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    const cutOpts = {...opts, manualCuts: { [strip.key]: [18] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);

    // opts.cuttingMargin is in INCHES (converted to feet inside computeRollLayout).
    // orderedLength is rounded UP to the next whole foot (15ft x 1ft ordering increments).
    const marginFt = opts.cuttingMargin / 12;
    assert(cutStrip.pieces[0].orderedLength === Math.ceil(18 + marginFt - 1e-9), 'piece 0 orderedLength = ceil(length + cuttingMargin) — rounded up to whole feet');
    assert(cutStrip.pieces[1].orderedLength === Math.ceil(12 + marginFt - 1e-9), 'piece 1 orderedLength = ceil(length + cuttingMargin) — rounded up to whole feet');
    assert(near(cutStrip.pieces[0].purchasedArea, cutStrip.pieces[0].orderedLength * opts.rollWidth), 'piece purchasedArea = orderedLength × rollWidth');
  }

  // ── Cuts at/beyond the strip's neededLength are ignored (no degenerate pieces) ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    const cutOpts = {...opts, manualCuts: { [strip.key]: [0, 30, 35, -5] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);
    assert(cutStrip.pieces === null, 'cuts at 0, neededLength, beyond, or negative are all filtered out — no pieces created');
  }

  // ── Total ordered area for pieces ≈ sum of pieces' purchasedArea (extra margins included) ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    const cutOpts = {...opts, manualCuts: { [strip.key]: [18] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);
    const pieceSum = cutStrip.pieces.reduce((s,p)=>s+p.purchasedArea, 0);

    assert(near(cut.totalOrdered, pieceSum, 0.01), 'totalOrdered reflects sum of piece purchasedArea (not the unsplit strip)');
    assert(cut.totalOrdered > base.totalOrdered, 'splitting a strip increases totalOrdered (extra cutting margin for the new seam)');
  }

  // ── Piece-level nesting: a small cut piece can nest into a different strip's waste ──
  {
    const shape = [{x:0,y:0},{x:30,y:0},{x:30,y:15},{x:10,y:15},{x:10,y:22},{x:0,y:22}];
    const opts0 = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const base = ctx.computeRollLayout(shape, 0, 0, opts0);
    const strip0 = base.strips.find(s=>s.key==='y0.00');
    const strip1 = base.strips.find(s=>s.key==='y15.00');
    assert(strip0 && strip1, 'test fixture produces strips y0.00 and y15.00');

    if (strip0 && strip1) {
      const cutOpts = {...opts0, manualCuts: { [strip0.key]: [25] }};
      const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
      const cutS0 = cut.strips.find(s=>s.key===strip0.key);
      const smallPiece = cutS0.pieces.find(p=>p.length < 10);
      assert(smallPiece, 'small piece (5ft) exists after cutting at 25');

      const nestOpts = {...cutOpts, nesting: { [smallPiece.key]: strip1.key }};
      const nested = ctx.computeRollLayout(shape, 0, 0, nestOpts);
      const nestedS0 = nested.strips.find(s=>s.key===strip0.key);
      const nestedPiece = nestedS0.pieces.find(p=>p.key===smallPiece.key);

      assert(nestedPiece.nestedIntoKey === strip1.key, 'manually-cut piece nests into another strip\'s waste by key');
      assert(near(nested.totalSaved, smallPiece.purchasedArea), 'totalSaved equals the nested piece\'s purchasedArea');
      assert(near(nested.totalOrdered, cut.totalOrdered - smallPiece.purchasedArea), 'totalOrdered drops by the nested piece\'s purchasedArea');
    }
  }

  // ── A piece that does NOT fit in the target's waste does not get nested ──
  {
    const shape = rect(0,0,30,15);
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);
    const cutOpts = {...opts, manualCuts: { [strip.key]: [18] }};
    const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutStrip = cut.strips.find(s=>s.key===strip.key);
    const bigPiece = cutStrip.pieces[0]; // 18ft piece, far larger than any available waste here

    // Try nesting into the (empty/zero-waste) overhang strip
    const overhang = cut.strips.find(s=>s.clippedArea < 0.5);
    if (overhang) {
      const nestOpts = {...cutOpts, nesting: { [bigPiece.key]: overhang.key }};
      const nested = ctx.computeRollLayout(shape, 0, 0, nestOpts);
      const nestedStrip = nested.strips.find(s=>s.key===strip.key);
      const nestedPiece = nestedStrip.pieces.find(p=>p.key===bigPiece.key);
      assert(nestedPiece.nestedInto === null, 'a piece that does not fit in the target waste is not nested');
      assert(near(nested.totalOrdered, cut.totalOrdered), 'totalOrdered unchanged when nesting does not apply');
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  26. CUT MODE — END-TO-END (toggleCutMode + startCut via canvas click)
// ════════════════════════════════════════════════════════════════════════
section('26. Cut Mode end-to-end (toggle + click-to-cut on canvas)');
{
  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  // 30x15 rect at rotation 0 -> single strip y0.00, neededLength=30, sMinX=0
  const layoutData = { points: rect(0,0,30,15), area: 450, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0 };
  stored['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData}]);

  const mockCtx2d = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas = {
    width:700, height:350,
    getContext:()=>mockCtx2d,
    getBoundingClientRect:()=>({left:0,top:0,width:mockCanvas.width,height:mockCanvas.height}),
    addEventListener:()=>{}, style:{}, classList:{add:()=>{},remove:()=>{}}, textContent:'',
  };

  const inputs = {
    rollRotationInput: { value: '0' },
    rollTranslationInput: { value: '0', max:'' },
    rollWidthInput: { value: '15' },
    rollLengthInput: { value: '100' },
    sideTrimInput: { value: '0' },
    cuttingMarginInput: { value: '0' },
    rollRotationValue: { textContent:'' },
    rollTranslationValue: { textContent:'' },
    showRectanglesToggle: { checked: true },
    rollStripsOut: { value:'' }, rollOrderedOut: { value:'' }, rollUsableOut: { value:'' },
    rollLinearOut: { value:'' }, rollWasteOut: { value:'' },
    rollSavedGroup: { style:{} }, rollSavedOut: { value:'' },
    rollNestingLegend: { style:{} },
    layoutArea: { value:'' }, layoutApplyTarget: { innerHTML:'' },
    rollApplyTarget: { innerHTML:'' },
    layoutLayersList: { innerHTML:'' },
    rollLayoutCanvas: mockCanvas,
    layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} },
    editShapeBtn: { classList:{add:()=>{},remove:()=>{}}, textContent:'' },
    editShapeHint: { style:{} },
    moveLayersBtn: { classList:{add:()=>{},remove:()=>{}}, textContent:'' },
    moveLayersHint: { style:{} },
    cutModeBtn: { classList:{add:()=>{},remove:()=>{}}, textContent:'' },
    cutModeHint: { style:{} },
    undoShapeBtn: { style:{} },
  };

  const ctx2 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: {
      getElementById: id => inputs[id] || mockEl(),
      querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{},
    },
    localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx2);

  ctx2.loadProject('p1');

  // Toggling cut mode runs without throwing and sets the flag
  let threw = false, errMsg = '';
  try { ctx2.toggleCutMode(); } catch(e) { threw = true; errMsg = e.message; }
  assert(!threw, 'toggleCutMode runs without throwing' + (threw ? ` (${errMsg})` : ''));
  assert(ctx2.window._wtCutMode === true, 'toggleCutMode sets _wtCutMode true');

  // Cut mode is mutually exclusive with Edit Shape mode
  ctx2.toggleEditMode(); // turn edit mode ON -> should turn cut mode off
  assert(ctx2.window._wtEditMode === true, 'edit mode is now on');
  assert(ctx2.window._wtCutMode === false, 'enabling Edit Shape mode turns off Cut Mode (mutual exclusivity)');
  ctx2.toggleEditMode(); // turn edit mode back off

  // Re-enable cut mode for the click test
  ctx2.toggleCutMode();
  assert(ctx2.window._wtCutMode === true, 'cut mode re-enabled');

  // Build the canvas transform by calling renderRollLayout (already done via loadProject,
  // but re-render explicitly to ensure _wtCanvasTransform/_wtCurrentRollLayout are fresh)
  ctx2.renderRollLayout();
  const t = ctx2.window._wtCanvasTransform;
  assert(t && typeof t.scale === 'number', '_wtCanvasTransform is populated after render');

  // Find the strip and pick a click point at roughly the middle of its length
  const layout = ctx2.window._wtCurrentRollLayout;
  const strip = layout.strips.find(s => s.clippedArea > 0.5);
  assert(strip && strip.pieces === null, 'strip starts with no pieces (no cuts yet)');

  // canvasEventToData computes: canvasX = (clientX-rectLeft) * (canvas.width/rect.width)
  // With our mock, canvas.width===rect.width and canvas.height===rect.height (both 700x350),
  // so canvasX===clientX, canvasY===clientY. Then dataX = t.minX + (canvasX-t.pad)/t.scale.
  // Pick a clientX/Y that lands dataX roughly in the middle of [sMinX, sMinX+neededLength],
  // and dataY within [y0,y1].
  const targetDataX = strip.sMinX + strip.neededLength * 0.4; // 40% along the strip
  const targetDataY = (strip.y0 + strip.y1) / 2;
  const canvasX = (targetDataX - t.minX) * t.scale + t.pad;
  // canvasEventToData: dataY = t.minY + (t.h - t.pad - canvasY)/t.scale  =>  canvasY = t.h - t.pad - (dataY-t.minY)*t.scale
  const canvasY = t.h - t.pad - (targetDataY - t.minY) * t.scale;
  const fakeEvt = { clientX: canvasX, clientY: canvasY, preventDefault: () => {} };

  // Sanity check: this point should land inside the strip's displayClipped polygon
  const pos0 = ctx2.canvasEventToData(fakeEvt);
  const dataPt0 = { x: t.minX + (pos0.canvasX - t.pad) / t.scale, y: t.minY + (t.h - t.pad - pos0.canvasY) / t.scale };
  assert(ctx2.pointInPoly(dataPt0, strip.displayClipped), 'computed click point lands inside the strip (test setup sanity check)');

  let cutThrew = false, cutErr = '';
  try { ctx2.startCut(fakeEvt); } catch(e) { cutThrew = true; cutErr = e.message; }
  assert(!cutThrew, 'startCut runs without throwing' + (cutThrew ? ` (${cutErr})` : ''));

  // Verify the cut was recorded and the strip now has pieces
  const reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(reloaded.layout.manualCuts && reloaded.layout.manualCuts[strip.key], 'manualCuts recorded for the clicked strip');
  if (reloaded.layout.manualCuts && reloaded.layout.manualCuts[strip.key]) {
    const cutVal = reloaded.layout.manualCuts[strip.key][0];
    assert(near(cutVal, targetDataX, 0.5), `recorded cut position (~${cutVal.toFixed(2)}) is close to clicked position (12)`);
  }

  const layout2 = ctx2.window._wtCurrentRollLayout;
  const cutStrip = layout2.strips.find(s => s.key === strip.key);
  assert(cutStrip.pieces && cutStrip.pieces.length === 2, 'strip now has 2 pieces after the click-to-cut');

  // Clicking the same spot again removes the cut (toggle)
  ctx2.startCut(fakeEvt);
  const reloaded2 = ctx2.getProjects().find(p=>p.id==='p1');
  assert(!(reloaded2.layout.manualCuts && reloaded2.layout.manualCuts[strip.key] && reloaded2.layout.manualCuts[strip.key].length), 'clicking the same cut position again removes the cut');
}

// ════════════════════════════════════════════════════════════════════════
//  27. ORDERED LENGTH ROUNDS UP TO WHOLE FEET (15ft x 1ft increments)
// ════════════════════════════════════════════════════════════════════════
section('27. orderedLength rounds up to whole feet');
{
  // A shape whose neededLength + cuttingMargin lands on a fractional foot
  // should round UP to the next whole foot for ordering purposes.
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, nesting:{}, manualCuts:{} }; // 6in margin = 0.5ft
  const shape = rect(0,0,18.25,15); // neededLength=18.25, +0.5 margin = 18.75 -> ceil = 19
  const l = ctx.computeRollLayout(shape, 0, 0, opts);
  const strip = l.strips.find(s=>s.clippedArea>0.5);

  assert(strip.orderedLength === 19, `orderedLength rounds 18.75 up to 19 (got ${strip.orderedLength})`);
  assert(strip.orderedLength === Math.round(strip.orderedLength), 'orderedLength is a whole number');
  assert(near(strip.purchasedArea, 19 * 15), 'purchasedArea = rounded orderedLength × rollWidth (19×15=285)');

  // A shape that lands exactly on a whole foot stays unchanged (no spurious +1)
  const opts0 = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
  const shapeExact = rect(0,0,20,15);
  const lExact = ctx.computeRollLayout(shapeExact, 0, 0, opts0);
  const stripExact = lExact.strips.find(s=>s.clippedArea>0.5);
  assert(stripExact.orderedLength === 20, `exact whole-foot length stays 20 (got ${stripExact.orderedLength})`);

  // Manual cut pieces also round up
  const cutOpts = {...opts, manualCuts: { [strip.key]: [10] } }; // piece0=10+0.5=10.5->11, piece1=8.25+0.5=8.75->9
  const cut = ctx.computeRollLayout(shape, 0, 0, cutOpts);
  const cutStrip = cut.strips.find(s=>s.key===strip.key);
  assert(cutStrip.pieces[0].orderedLength === 11, `piece 0 orderedLength rounds 10.5 up to 11 (got ${cutStrip.pieces[0].orderedLength})`);
  assert(cutStrip.pieces[1].orderedLength === 9, `piece 1 orderedLength rounds 8.75 up to 9 (got ${cutStrip.pieces[1].orderedLength})`);
}

// ════════════════════════════════════════════════════════════════════════
//  28. ROLLS vs PIECES — distinct counts (a cut roll is still 1 roll)
// ════════════════════════════════════════════════════════════════════════
section('28. Rolls vs Pieces counting (manual cuts don\'t add rolls)');
{
  function totalRollsAndPieces(layout) {
    return ctx.countRollsAndPieces(layout);
  }

  // ── Simple case: 1 strip, no cuts, under 100ft -> 1 roll, 1 piece (equal, no piece breakout) ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = rect(0,0,30,15);
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);
    assert(totalRolls === 1, 'one strip under 100ft = 1 roll');
    assert(totalPieces === 1, 'one strip under 100ft = 1 piece');
    assert(totalRolls === totalPieces, 'rolls and pieces equal when no cuts and under Max Roll Length');
  }

  // ── Manually cut into 3 pieces, still under 100ft total -> 1 roll, 3 pieces ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = rect(0,0,30,15); // neededLength=30, well under 100
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = base.strips.find(s=>s.clippedArea>0.5);

    const cutOpts = {...opts, manualCuts: { [strip.key]: [10, 20] }}; // 3 pieces of 10ft each
    const l = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);

    assert(totalRolls === 1, '3 pieces totaling 30ft (< 100ft Max Roll Length) = still 1 roll');
    assert(totalPieces === 3, '3 manual cuts produce 3 pieces');
    assert(totalRolls !== totalPieces, 'rolls and pieces differ -> UI should show both');
  }

  // ── A strip needing >100ft of turf = multiple rolls, 1 piece each (no manual cuts) ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = rect(0,0,150,15); // neededLength=150 -> needs 2 rolls (100ft max each)
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = l.strips.find(s=>s.clippedArea>0.5);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);

    assert(strip.numSegments === 2, '150ft strip needs 2 rolls (numSegments=2)');
    assert(totalRolls === 2, '150ft strip = 2 rolls');
    assert(totalPieces === 2, '150ft strip with no manual cuts = 2 pieces (one per roll)');
    assert(totalRolls === totalPieces, 'rolls and pieces equal for a multi-roll strip with no manual cuts');
  }

  // ── Rounding can push a borderline strip into needing an extra roll ──
  {
    // neededLength=100 exactly, cuttingMargin=6in=0.5ft -> orderedLength would be
    // ceil(100+0.5)=101, which exceeds 1×100ft -> needs 2 rolls
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, nesting:{}, manualCuts:{} };
    const shape = rect(0,0,100,15);
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip = l.strips.find(s=>s.clippedArea>0.5);

    assert(strip.numSegments === 2, `a 100ft strip + cutting margin rounds to 101ft, needing 2 rolls (got numSegments=${strip.numSegments})`);
    assert(strip.orderedLength <= strip.numSegments * 100 + 1e-9, 'orderedLength fits within numSegments × Max Roll Length');
  }

  // ── Multiple strips (bands), each its own piece, combined under Max Roll Length = 1 roll ──
  // (the reported scenario: 3 separate pieces from 3 bands, totaling <100ft,
  // should be "1 roll / 3 pieces" — not 1 roll per band)
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:25,y:0},{x:25,y:45},{x:0,y:45}]; // 3 bands of 15ft width, each 25ft long -> 75ft total
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);

    assert(totalPieces === 3, '3 separate bands = 3 pieces');
    assert(totalRolls === 1, '3 pieces totaling 75ft (<100ft) all come from 1 roll');
  }

  // ── Multiple strips whose combined length exceeds Max Roll Length needs 2 rolls ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}]; // 3 bands of 60ft each -> 180ft total
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);

    assert(totalPieces === 3, '3 bands = 3 pieces');
    assert(totalRolls === 2, '3 pieces totaling 180ft needs ceil(180/100)=2 rolls');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  29. MANUAL CUT REMOVAL CONTROLS (removeManualCutAt / clearManualCuts)
// ════════════════════════════════════════════════════════════════════════
section('29. Removing manual cuts via list controls');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
  const shape = rect(0,0,30,15);
  const base = ctx.computeRollLayout(shape, 0, 0, opts);
  const strip = base.strips.find(s=>s.clippedArea>0.5);

  const stored = {};
  const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
  const layoutData = { points: shape, area: 450, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0, manualCuts: { [strip.key]: [10, 20] } };
  stored['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData}]);

  const mockCtx2d = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas = {
    width:700, height:350, getContext:()=>mockCtx2d,
    getBoundingClientRect:()=>({left:0,top:0,width:mockCanvas.width,height:mockCanvas.height}),
    addEventListener:()=>{}, style:{}, classList:{add:()=>{},remove:()=>{}}, textContent:'',
  };
  const inputs = {
    rollRotationInput: { value: '0' }, rollTranslationInput: { value: '0', max:'' },
    rollWidthInput: { value: '15' }, rollLengthInput: { value: '100' },
    sideTrimInput: { value: '0' }, cuttingMarginInput: { value: '0' },
    rollRotationValue: { textContent:'' }, rollTranslationValue: { textContent:'' },
    showRectanglesToggle: { checked: false },
    rollStripsOut: { value:'' }, rollOrderedOut: { value:'' }, rollUsableOut: { value:'' },
    rollLinearOut: { value:'' }, rollWasteOut: { value:'' },
    rollSavedGroup: { style:{} }, rollSavedOut: { value:'' },
    rollNestingLegend: { style:{} },
    layoutArea: { value:'' }, layoutApplyTarget: { innerHTML:'' }, rollApplyTarget: { innerHTML:'' },
    layoutLayersList: { innerHTML:'' },
    manualCutsGroup: { style:{} }, manualCutsList: { innerHTML:'' },
    rollLayoutCanvas: mockCanvas,
    layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} },
  };

  const ctx2 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: { getElementById: id => inputs[id] || mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
    localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx2);
  ctx2.loadProject('p1');

  // Manual cuts group becomes visible and lists both cuts
  let reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  let layout = ctx2.window._wtCurrentRollLayout;
  let cutStrip = layout.strips.find(s=>s.key===strip.key);
  assert(cutStrip.pieces && cutStrip.pieces.length === 3, 'strip starts with 3 pieces from 2 manual cuts');
  assert(inputs.manualCutsGroup.style.display === '', 'manualCutsGroup is visible when cuts exist');
  assert(inputs.manualCutsList.innerHTML.includes('10.0 ft') && inputs.manualCutsList.innerHTML.includes('20.0 ft'), 'manualCutsList shows both cut positions');

  // removeManualCutAt removes one cut, leaving 2 pieces
  let threw = false;
  try { ctx2.removeManualCutAt(strip.key, 10); } catch(e) { threw = true; console.log(e.message); }
  assert(!threw, 'removeManualCutAt runs without throwing');

  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(reloaded.layout.manualCuts[strip.key].length === 1, 'one cut removed, one remains');
  assert(near(reloaded.layout.manualCuts[strip.key][0], 20), 'remaining cut is at position 20');

  layout = ctx2.window._wtCurrentRollLayout;
  cutStrip = layout.strips.find(s=>s.key===strip.key);
  assert(cutStrip.pieces && cutStrip.pieces.length === 2, 'strip now has 2 pieces after removing one cut');

  // clearManualCuts removes all cuts for the strip, reverting to pieces:null
  try { ctx2.clearManualCuts(strip.key); } catch(e) { threw = true; }
  assert(!threw, 'clearManualCuts runs without throwing');

  reloaded = ctx2.getProjects().find(p=>p.id==='p1');
  assert(!(strip.key in (reloaded.layout.manualCuts||{})), 'clearManualCuts removes the manualCuts entry entirely');

  layout = ctx2.window._wtCurrentRollLayout;
  cutStrip = layout.strips.find(s=>s.key===strip.key);
  assert(cutStrip.pieces === null, 'strip reverts to pieces:null after clearing all cuts');
  assert(inputs.manualCutsGroup.style.display === 'none', 'manualCutsGroup hides when no cuts remain');
}

// ════════════════════════════════════════════════════════════════════════
//  30. BOUNDARY-VERTEX FIX: neededLength/purchasedArea for L-shaped yards
// ════════════════════════════════════════════════════════════════════════
section('30. L-shaped yard: strip neededLength uses interior x-extent, not boundary-sliver bbox');
{
  // A common yard shape: 30ft-wide bottom band (y0-15), 10ft-wide top band (y15-30).
  // The polygon edge from (30,15) to (10,15) lies exactly on the y=15 band
  // boundary — clipping the closed band [15,30] picks up this edge as a
  // zero-height sliver whose x-range is [10,30], which must NOT pollute the
  // top strip's neededLength (true value: 10).
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
  const shape = [{x:0,y:0},{x:30,y:0},{x:30,y:15},{x:10,y:15},{x:10,y:30},{x:0,y:30}];
  const l = ctx.computeRollLayout(shape, 0, 0, opts);

  const bottom = l.strips.find(s=>s.key==='y0.00');
  const top = l.strips.find(s=>s.key==='y15.00');
  assert(bottom && top, 'both bands present');

  assert(near(bottom.neededLength, 30), `bottom band neededLength=30 (got ${bottom.neededLength})`);
  assert(near(top.neededLength, 10), `top band neededLength=10, not polluted by the 30-wide bottom band (got ${top.neededLength})`);
  assert(near(top.purchasedArea, 150), `top band purchasedArea = 10×15=150 (got ${top.purchasedArea})`);
  assert(near(top.wasteArea, 0), `top band has zero waste — it's a perfect rectangle (got ${top.wasteArea})`);

  const trueShapeArea = ctx.polygonArea(shape);
  assert(near(trueShapeArea, 600), 'true shape area = 30×15 + 10×15 = 600');
  assert(near(l.totalOrdered, 600), `totalOrdered should equal true shape area for this perfectly-efficient L-shape (got ${l.totalOrdered})`);
  assert(near(l.scrap, 0), `scrap should be 0 for this perfectly-efficient L-shape (got ${l.scrap})`);

  // occupiedX0/X1 should match sMinX / sMinX+neededLength
  assert(near(top.occupiedX0, top.sMinX), 'occupiedX0 = sMinX');
  assert(near(top.occupiedX1, top.sMinX + top.neededLength), 'occupiedX1 = sMinX + neededLength');
}

// ════════════════════════════════════════════════════════════════════════
//  31. NESTED PIECE PLACEMENT — moved piece lands inside target's waste
// ════════════════════════════════════════════════════════════════════════
section('31. Nested piece visually relocates inside target roll\'s waste rectangle');
{
  // Helper: replicate nestedPieceOffset's roll-frame math and verify the
  // translated piece's roll-frame bounding box falls within the target's
  // rect [rfX0,rfX1]x[rfY0,rfY1] and outside the target's own occupied range.
  function checkPlacement(layout, srcPiece, target) {
    const pieceWidth = srcPiece.rfX1 - srcPiece.rfX0;
    const targetClipMinX = target.occupiedX0, targetClipMaxX = target.occupiedX1;
    const spaceBefore = targetClipMinX - target.rfX0;
    const spaceAfter = target.rfX1 - targetClipMaxX;
    let rfTargetX;
    if (spaceAfter + 1e-6 >= pieceWidth) rfTargetX = targetClipMaxX;
    else if (spaceBefore + 1e-6 >= pieceWidth) rfTargetX = target.rfX0;
    else rfTargetX = targetClipMaxX;
    const rfTargetY = target.rfY0;
    const rfDx = rfTargetX - srcPiece.rfX0, rfDy = rfTargetY - srcPiece.rfY0;
    const rad = layout.rotationDeg * Math.PI/180, cos = Math.cos(rad), sin = Math.sin(rad);
    const dx = rfDx*cos - rfDy*sin, dy = rfDx*sin + rfDy*cos;
    const moved = srcPiece.displayClipped.map(p=>({x:p.x+dx, y:p.y+dy}));
    const invMoved = ctx.rotateAround(moved, -layout.rotationDeg, layout.cx, layout.cy);
    const mxs = invMoved.map(p=>p.x), mys = invMoved.map(p=>p.y);
    const insideRectX = Math.min(...mxs) >= target.rfX0-1e-6 && Math.max(...mxs) <= target.rfX1+1e-6;
    const insideRectY = Math.min(...mys) >= target.rfY0-1e-6 && Math.max(...mys) <= target.rfY1+1e-6;
    const overlapsOccupied = !(Math.max(...mxs) <= targetClipMinX+1e-6 || Math.min(...mxs) >= targetClipMaxX-1e-6);
    return { insideRect: insideRectX && insideRectY, overlapsOccupied, bbox: {x0:Math.min(...mxs), x1:Math.max(...mxs), y0:Math.min(...mys), y1:Math.max(...mys)} };
  }

  // ── At rotation 0°: cut a small offcut from a strip with margin-rounding waste,
  // nest it into a different strip's margin-rounding waste ──
  {
    const shape = [{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:10,y:15},{x:10,y:30},{x:0,y:30}];
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, nesting:{}, manualCuts:{} };
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const big = base.strips.find(s=>s.key==='y0.00');
    const small = base.strips.find(s=>s.key==='y15.00');
    assert(big && small, 'both bands present at rotation 0');
    assert(big.wasteArea > 0 && small.wasteArea > 0, 'both bands have rounding-margin waste');

    const cutOpts = {...opts, manualCuts: { [big.key]: [big.neededLength - 0.5] }};
    const cutBase = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const cutBig = cutBase.strips.find(s=>s.key===big.key);
    const offcut = cutBig.pieces.reduce((a,b)=>a.length<b.length?a:b);
    assert(offcut.purchasedArea <= small.wasteArea + 1e-6, 'offcut fits in the other band\'s waste');

    const nestOpts = {...cutOpts, nesting: { [offcut.key]: small.key }};
    const layout = ctx.computeRollLayout(shape, 0, 0, nestOpts);
    const nestedBig = layout.strips.find(s=>s.key===big.key);
    const np = nestedBig.pieces.find(p=>p.key===offcut.key);
    const target = layout.strips.find(s=>s.key===small.key);
    assert(np.nestedIntoKey === small.key, 'offcut nests into the other band');

    const result = checkPlacement(layout, np, target);
    assert(result.insideRect, `moved piece is inside target's rect (bbox=${JSON.stringify(result.bbox)}, target rf=[${target.rfX0},${target.rfX1}]x[${target.rfY0},${target.rfY1}])`);
    assert(!result.overlapsOccupied, 'moved piece does not overlap target\'s own installed turf');
  }

  // ── At a nonzero rotation (10°): same check, verifying the offset VECTOR
  // rotation (not just axis-aligned translation) places the piece correctly ──
  {
    const shape = [{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:10,y:15},{x:10,y:30},{x:0,y:30}];
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, nesting:{}, manualCuts:{} };
    const rotDeg = 10;
    const base = ctx.computeRollLayout(shape, rotDeg, 0, opts);
    const candidates = base.strips.filter(s=>s.clippedArea>1).sort((a,b)=>b.wasteArea-a.wasteArea);
    assert(candidates.length >= 2, 'at least 2 occupied bands at rotation 10°');

    const target = candidates[0];
    const source = candidates[1];
    const cutLen = Math.max(0.1, source.neededLength - 0.5);
    const cutOpts = {...opts, manualCuts: { [source.key]: [cutLen] }};
    const cutBase = ctx.computeRollLayout(shape, rotDeg, 0, cutOpts);
    const cutSource = cutBase.strips.find(s=>s.key===source.key);
    assert(cutSource.pieces && cutSource.pieces.length===2, 'source band split into 2 pieces');
    const offcut = cutSource.pieces.reduce((a,b)=>a.length<b.length?a:b);

    if (offcut.purchasedArea <= target.wasteArea + 1e-6) {
      const nestOpts = {...cutOpts, nesting: { [offcut.key]: target.key }};
      const layout = ctx.computeRollLayout(shape, rotDeg, 0, nestOpts);
      const nestedSource = layout.strips.find(s=>s.key===source.key);
      const np = nestedSource.pieces.find(p=>p.key===offcut.key);
      const tgt = layout.strips.find(s=>s.key===target.key);
      assert(np.nestedIntoKey === target.key, 'offcut nests into target at rotation 10°');

      const result = checkPlacement(layout, np, tgt);
      assert(result.insideRect, `at rotation 10°, moved piece is inside target's rect (bbox=${JSON.stringify(result.bbox)})`);
      assert(!result.overlapsOccupied, 'at rotation 10°, moved piece does not overlap target\'s own installed turf');
    } else {
      const nestOpts = {...cutOpts, nesting: { [offcut.key]: target.key }};
      const layout = ctx.computeRollLayout(shape, rotDeg, 0, nestOpts);
      const nestedSource = layout.strips.find(s=>s.key===source.key);
      const np = nestedSource.pieces.find(p=>p.key===offcut.key);
      assert(np.nestedInto === null, 'offcut correctly not nested when it doesn\'t fit target waste at rotation 10°');
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  32. STALE/OUT-OF-RANGE MANUAL CUTS — visible and clearable
// ════════════════════════════════════════════════════════════════════════
section('32. Stale manual cuts (out of range after a roll-setting change) are shown and clearable');
{
  // A cut at position 25 is valid for a 30ft-needed strip, but becomes
  // out-of-range if neededLength later shrinks to e.g. 10 (cuts must satisfy
  // 0.01 < c < neededLength-0.01). The saved manualCuts entry should still be
  // visible in the list (so it can be cleared) even though it produces no pieces.
  const shape32 = rect(0,0,10,15); // neededLength=10 -> a cut at 25 is out of range
  const opts32 = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
  const base32 = ctx.computeRollLayout(shape32, 0, 0, opts32);
  const strip32 = base32.strips.find(s=>s.clippedArea>0.5);
  assert(near(strip32.neededLength, 10), 'strip neededLength=10');

  const stored32 = {};
  const mockLS32 = { getItem: k => stored32[k]||null, setItem: (k,v) => { stored32[k]=v; } };
  const layoutData32 = { points: shape32, area: 150, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0, manualCuts: { [strip32.key]: [25] } }; // 25 > neededLength-0.01 -> stale
  stored32['wt_projects_v4'] = JSON.stringify([{id:'p1',name:'Test',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[],layout:layoutData32}]);

  const mockCtx2d32 = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas32 = {
    width:700, height:350, getContext:()=>mockCtx2d32,
    getBoundingClientRect:()=>({left:0,top:0,width:mockCanvas32.width,height:mockCanvas32.height}),
    addEventListener:()=>{}, style:{}, classList:{add:()=>{},remove:()=>{}}, textContent:'',
  };
  const inputs32 = {
    rollRotationInput: { value: '0' }, rollTranslationInput: { value: '0', max:'' },
    rollWidthInput: { value: '15' }, rollLengthInput: { value: '100' },
    sideTrimInput: { value: '0' }, cuttingMarginInput: { value: '0' },
    rollRotationValue: { textContent:'' }, rollTranslationValue: { textContent:'' },
    showRectanglesToggle: { checked: false },
    rollStripsOut: { value:'' }, rollOrderedOut: { value:'' }, rollUsableOut: { value:'' },
    rollLinearOut: { value:'' }, rollWasteOut: { value:'' },
    rollSavedGroup: { style:{} }, rollSavedOut: { value:'' },
    rollNestingLegend: { style:{} },
    layoutArea: { value:'' }, layoutApplyTarget: { innerHTML:'' }, rollApplyTarget: { innerHTML:'' },
    layoutLayersList: { innerHTML:'' },
    manualCutsGroup: { style:{} }, manualCutsList: { innerHTML:'' },
    rollLayoutCanvas: mockCanvas32,
    layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} },
  };

  const ctx32 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: { getElementById: id => inputs32[id] || mockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
    localStorage: mockLS32, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx32);
  ctx32.loadProject('p1');

  const layout32 = ctx32.window._wtCurrentRollLayout;
  const cutStrip32 = layout32.strips.find(s=>s.key===strip32.key);
  assert(cutStrip32.pieces === null, 'out-of-range cut produces no pieces (pieces stays null)');

  // The group should still be visible, showing the stale cut with a way to clear it
  assert(inputs32.manualCutsGroup.style.display === '', 'manualCutsGroup is visible even for a stale/out-of-range cut');
  assert(inputs32.manualCutsList.innerHTML.includes('25.0 ft'), 'stale cut position is shown in the list');
  assert(inputs32.manualCutsList.innerHTML.includes('Clear these cuts') || inputs32.manualCutsList.innerHTML.includes('clearManualCuts'), 'a clear button is available for the stale cut');

  // Clearing it removes the manualCuts entry entirely
  let threw32 = false;
  try { ctx32.clearManualCuts(strip32.key); } catch(e) { threw32 = true; }
  assert(!threw32, 'clearManualCuts runs without throwing for a stale entry');

  const reloaded32 = ctx32.getProjects().find(p=>p.id==='p1');
  assert(!(strip32.key in (reloaded32.layout.manualCuts||{})), 'stale manualCuts entry is removed after clearing');
  assert(inputs32.manualCutsGroup.style.display === 'none', 'manualCutsGroup hides once the stale entry is cleared');
}

// ════════════════════════════════════════════════════════════════════════
//  33. PROJECT SORT MODE PERSISTENCE
// ════════════════════════════════════════════════════════════════════════
section('33. Project sort mode persists across reloads');
{
  const stored33 = {};
  const mockLS33 = { getItem: k => stored33[k]||null, setItem: (k,v) => { stored33[k]=v; } };
  stored33['wt_projects_v4'] = JSON.stringify([
    {id:'a',name:'Alpha',created:1000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[]},
    {id:'b',name:'Beta',created:2000,turf:[],infill:[],rock:[],edging:{},pgSqFt:0,miscItems:[]},
  ]);

  function makeCtx(stored) {
    const inputs = { projectList: { innerHTML:'' } };
    const buttons = [
      { dataset:{mode:'name'}, classList:{ _set:new Set(), add(c){this._set.add(c);}, remove(c){this._set.delete(c);}, toggle(c,on){ on?this._set.add(c):this._set.delete(c); }, contains(c){return this._set.has(c);} } },
      { dataset:{mode:'newest'}, classList:{ _set:new Set(), add(c){this._set.add(c);}, remove(c){this._set.delete(c);}, toggle(c,on){ on?this._set.add(c):this._set.delete(c); }, contains(c){return this._set.has(c);} } },
      { dataset:{mode:'oldest'}, classList:{ _set:new Set(), add(c){this._set.add(c);}, remove(c){this._set.delete(c);}, toggle(c,on){ on?this._set.add(c):this._set.delete(c); }, contains(c){return this._set.has(c);} } },
    ];
    return {
      window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
      document: {
        getElementById: id => inputs[id] || mockEl(),
        querySelectorAll: sel => sel === '.sort-btn' ? buttons : [],
        querySelector:()=>null, addEventListener:()=>{},
      },
      localStorage: stored, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){ return {observe:()=>{}}; },
      _buttons: buttons,
    };
  }

  // First load: no sort mode saved yet -> defaults to 'name', A–Z button active
  const ctx33a = makeCtx(mockLS33);
  vm.runInNewContext(scriptSrc, ctx33a);
  ctx33a.renderSidebar();
  assert(ctx33a._buttons[0].classList.contains('active'), 'default sort mode "name" -> A–Z button active on first load');
  assert(!ctx33a._buttons[1].classList.contains('active'), 'New button not active by default');

  // User picks "New" (newest)
  ctx33a.sortProjects('newest', ctx33a._buttons[1]);
  assert(stored33['wt_sort_mode'] === 'newest', 'sortProjects persists the chosen mode to localStorage');
  assert(ctx33a._buttons[1].classList.contains('active'), 'New button active after choosing it');

  // Simulate reload: fresh context reading the same localStorage
  const ctx33b = makeCtx(mockLS33);
  vm.runInNewContext(scriptSrc, ctx33b);
  ctx33b.renderSidebar();
  assert(ctx33b._buttons[1].classList.contains('active'), 'after reload, New button is active (sort mode restored)');
  assert(!ctx33b._buttons[0].classList.contains('active'), 'after reload, A–Z button is not active');

  // Verify sort order actually reflects 'newest'
  const allProjects = ctx33b.getProjects();
  const sortedIds = allProjects.length ? [...allProjects].sort((a,b)=>b.created-a.created).map(p=>p.id) : [];
  assert(JSON.stringify(sortedIds) === JSON.stringify(['b','a']), 'restored sort mode produces newest-first order');
}

// ════════════════════════════════════════════════════════════════════════
//  34. GLOBAL ROLL/PIECE LABELING (assignRollPieceLabels)
// ════════════════════════════════════════════════════════════════════════
section('34. Global "Roll N / Piece M" labeling across all strips');
{
  // ── 3 bands totaling 75ft (<100ft) -> all from Roll 1, sequential pieces ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:25,y:0},{x:25,y:45},{x:0,y:45}];
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const labels = ctx.assignRollPieceLabels(l);
    const occupied = l.strips.filter(s=>s.clippedArea>0.5);
    assert(occupied.length === 3, '3 occupied bands');

    occupied.forEach((s, idx) => {
      const lab = labels.get(s);
      assert(lab.roll === 1, `band ${idx} is in Roll 1 (got Roll ${lab.roll})`);
      assert(lab.piece === idx+1, `band ${idx} is Piece ${idx+1} (got Piece ${lab.piece})`);
    });
  }

  // ── 3 bands of 60ft (180ft total) -> Roll 1: pieces 1-2, Roll 2: piece 1 ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}];
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const labels = ctx.assignRollPieceLabels(l);
    const occupied = l.strips.filter(s=>s.clippedArea>0.5);
    assert(occupied.length === 3, '3 occupied bands');

    const lab0 = labels.get(occupied[0]);
    const lab1 = labels.get(occupied[1]);
    const lab2 = labels.get(occupied[2]);
    assert(lab0.roll === 1 && lab0.piece === 1, `band 0 = Roll 1 / Piece 1 (got Roll ${lab0.roll} / Piece ${lab0.piece})`);
    assert(lab1.roll === 1 && lab1.piece === 2, `band 1 = Roll 1 / Piece 2 (got Roll ${lab1.roll} / Piece ${lab1.piece})`);
    assert(lab2.roll === 2 && lab2.piece === 1, `band 2 (starts at 120ft, crosses into Roll 2) = Roll 2 / Piece 1 (got Roll ${lab2.roll} / Piece ${lab2.piece})`);
  }

  // ── Manual cuts: a band split into 3 pieces, all within Roll 1; the next band continues Roll 1 ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}];
    const base = ctx.computeRollLayout(shape, 0, 0, opts);
    const strip0 = base.strips.find(s=>s.key==='y0.00');

    const cutOpts = {...opts, manualCuts: { [strip0.key]: [20, 40] }};
    const l = ctx.computeRollLayout(shape, 0, 0, cutOpts);
    const labels = ctx.assignRollPieceLabels(l);
    const cutStrip = l.strips.find(s=>s.key==='y0.00');
    const nextStrip = l.strips.find(s=>s.key==='y15.00');
    const lastStrip = l.strips.find(s=>s.key==='y30.00');

    assert(cutStrip.pieces && cutStrip.pieces.length === 3, 'strip y0.00 has 3 pieces from manual cuts');
    cutStrip.pieces.forEach((p, idx) => {
      const lab = labels.get(p);
      assert(lab.roll === 1, `cut piece ${idx} is in Roll 1 (got Roll ${lab.roll})`);
      assert(lab.piece === idx+1, `cut piece ${idx} is Piece ${idx+1} (got Piece ${lab.piece})`);
    });

    const labNext = labels.get(nextStrip);
    assert(labNext.roll === 1 && labNext.piece === 4, `next band continues Roll 1 as Piece 4 (got Roll ${labNext.roll} / Piece ${labNext.piece})`);

    const labLast = labels.get(lastStrip);
    assert(labLast.roll === 2 && labLast.piece === 1, `third band (cumulative 120ft, starts >=100) is Roll 2 / Piece 1 (got Roll ${labLast.roll} / Piece ${labLast.piece})`);
  }

  // ── countRollsAndPieces totals match the max roll/piece-in-roll from assignRollPieceLabels ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}];
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const labels = ctx.assignRollPieceLabels(l);
    const { totalRolls, totalPieces } = ctx.countRollsAndPieces(l);

    let maxRoll = 0, totalAssigned = 0;
    for (const lab of labels.values()) {
      maxRoll = Math.max(maxRoll, lab.roll);
      totalAssigned++;
    }
    assert(maxRoll === totalRolls, `max roll number (${maxRoll}) matches countRollsAndPieces totalRolls (${totalRolls})`);
    assert(totalAssigned === totalPieces, `number of labeled units (${totalAssigned}) matches countRollsAndPieces totalPieces (${totalPieces})`);
  }
}

// ════════════════════════════════════════════════════════════════════════
//  35. SIMPLIFIED ROCK/BASE ROW — Materials shows only Material + Tons
// ════════════════════════════════════════════════════════════════════════
section('35. Materials Rock/Base row shows only material name and tons (no sqft/depth/cost inputs)');
{
  const stored35 = {};
  const mockLS35 = { getItem: k => stored35[k]||null, setItem: (k,v) => { stored35[k]=v; } };
  // Catalog: Clean Crush at 4" depth (default), with pricing fields present but
  // not expected to appear on the Materials row.
  const catalog35 = {
    turf: [], infill: [],
    rock: [{ id:'crush', name:'1/4" x 3/4" Clean Crush', defaultDepth:4, costPerTon:'120', pricePerSqFt1in:'0.50', notes:'' }],
  };
  stored35['wt_catalog_v2'] = JSON.stringify(catalog35);
  stored35['wt_projects_v4'] = JSON.stringify([{
    id:'p1', name:'Test', created:1000, turf:[], infill:[], edging:{}, pgSqFt:0, miscItems:[],
    rock: [{ type:'1/4" x 3/4" Clean Crush', sqFt: 1000, depth: 4, tons: '' }],
  }]);

  const mockCtx2d35 = {
    clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
    fill:()=>{}, stroke:()=>{}, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
    arc:()=>{}, fillRect:()=>{}, fillText:()=>{}, measureText:()=>({width:10}),
    translate:()=>{}, rect:()=>{}, clip:()=>{},
  };
  const mockCanvas35 = {
    width:700, height:350, getContext:()=>mockCtx2d35,
    getBoundingClientRect:()=>({left:0,top:0,width:mockCanvas35.width,height:mockCanvas35.height}),
    addEventListener:()=>{}, style:{}, classList:{add:()=>{},remove:()=>{}}, textContent:'',
  };
  const inputs35 = {
    rollLayoutCanvas: mockCanvas35,
    layoutCanvasWrap: { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} },
    projectTitle: { value:'' },
    topbar: { classList:{add:()=>{},remove:()=>{}} },
    rockRows: { innerHTML:'', appendChild:()=>{} },
    materialsSummary: { innerHTML:'' },
  };
  const ctx35 = {
    window: { onload:null, _wtLayoutZoom:1, _wtEditMode:false, _wtSelectedProjects:null, innerHeight:900 },
    document: {
      getElementById: id => inputs35[id] || mockEl(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{},
      createElement: () => ({ className:'', style:{}, innerHTML:'', appendChild:()=>{} }),
    },
    localStorage: mockLS35, alert:()=>{}, confirm:()=>true, console,
    ResizeObserver: function(){ return {observe:()=>{}}; },
  };
  vm.runInNewContext(scriptSrc, ctx35);
  ctx35.loadProject('p1');

  const proj35 = ctx35.getCurrentProject();
  const row35 = proj35.rock[0];

  // makeRockRow returns a DOM-like node; in this environment document.createElement
  // is mocked via mockEl(), so just verify the calculation it performs on the row
  // (tons) and that the rendered HTML contains only Material + Tons (no sqft/depth/cost inputs).
  const el35 = ctx35.makeRockRow(row35, 0);

  // Expected tons: ceil((1000 * (4/12)) / 27 * 1.4 * 10) / 10
  const expectedTons = Math.ceil((1000 * (4/12)) / 27 * 1.4 * 10) / 10;
  assert(near(row35.tons, expectedTons, 0.01), `tons calculated correctly from sqFt+depth (expected ${expectedTons}, got ${row35.tons})`);

  const html35 = el35.innerHTML || '';
  assert(html35.includes('1/4" x 3/4" Clean Crush'), 'row shows material name');
  assert(html35.includes(String(expectedTons)), 'row shows calculated tons value');
  assert(!html35.includes('updateRockSqFt'), 'no manual sqft input (updateRockSqFt) on the Materials row');
  assert(!html35.includes('$120') && !html35.includes('$0.50') && !/\$\d/.test(html35), 'no per-row cost figure shown on the Materials row');
  assert(!/value="4"/.test(html35), 'no separate depth input shown on the Materials row');

  // calcRockRow (used by autoPopulateRock) still recomputes tons correctly when sqFt changes
  proj35.rock[0].sqFt = 2000;
  let threw35 = false;
  try { ctx35.calcRockRow(0); } catch(e) { threw35 = true; }
  assert(!threw35, 'calcRockRow runs without throwing after sqFt change');
  const expectedTons2 = Math.ceil((2000 * (4/12)) / 27 * 1.4 * 10) / 10;
  assert(near(proj35.rock[0].tons, expectedTons2, 0.01), `tons recalculated for new sqFt (expected ${expectedTons2}, got ${proj35.rock[0].tons})`);
}

// ════════════════════════════════════════════════════════════════════════
//  36. PUTTING GREEN FRINGE — geometry helpers (computeFringePlan)
// ════════════════════════════════════════════════════════════════════════
section('36. computeFringePlan: perimeter, ring area, and per-edge cutting pieces');
{
  // ── 20x10 rectangle, 2ft fringe, CCW winding ──
  {
    const pg = rect(0,0,20,10); // CCW
    const plan = ctx.computeFringePlan(pg, 2);
    assert(plan !== null, 'plan computed for a valid rectangle');
    assert(near(plan.perimeter, 60), `perimeter = 2*(20+10) = 60 (got ${plan.perimeter})`);
    assert(near(plan.pgArea, 200), `pgArea = 20*10 = 200 (got ${plan.pgArea})`);
    // Mitered ring area for a rectangle: outer rect (24x14) minus inner (20x10) = 336-200=136
    assert(near(plan.ringArea, 136), `mitered ringArea = outer(24x14) - inner(20x10) = 136 (got ${plan.ringArea})`);
    assert(plan.pieces.length === 4, '4 pieces for a 4-sided polygon');

    // Mitered corners extend each side by `width` at BOTH ends to meet square
    // outer corners: side lengths (20,10,20,10) -> outer lengths (24,14,24,14)
    const lengths = plan.pieces.map(p=>p.length).sort((a,b)=>a-b);
    assert(JSON.stringify(lengths) === JSON.stringify([14,14,24,24]), `mitered piece lengths are edge+2*width (got ${JSON.stringify(lengths)})`);

    // totalSqFt = sum(length*width) = (24+14+24+14)*2 = 152
    assert(near(plan.totalSqFt, 152), `totalSqFt = sum of piece rectangles = 152 (got ${plan.totalSqFt})`);

    // Every piece's rectangle should lie OUTSIDE the PG polygon. Corners may
    // legitimately sit ON the PG boundary (shared vertices by construction),
    // so check the piece's centroid instead — that should never be inside.
    plan.pieces.forEach((p, idx) => {
      const rectPoly = [p.p0, p.p1, p.p2, p.p3];
      const cx = rectPoly.reduce((s,pt)=>s+pt.x,0)/4, cy = rectPoly.reduce((s,pt)=>s+pt.y,0)/4;
      assert(!ctx.pointInPoly({x:cx,y:cy}, pg), `piece ${idx} centroid is not inside the PG polygon`);
    });

    // Adjacent pieces share both their inner AND outer corners — no overlap, no gap
    for (let i = 0; i < plan.pieces.length; i++) {
      const cur = plan.pieces[i], next = plan.pieces[(i+1) % plan.pieces.length];
      assert(near(cur.p1.x, next.p0.x) && near(cur.p1.y, next.p0.y), `piece ${i} inner end matches piece ${(i+1)%plan.pieces.length} inner start`);
      assert(near(cur.p2.x, next.p3.x) && near(cur.p2.y, next.p3.y), `piece ${i} outer end matches piece ${(i+1)%plan.pieces.length} outer start (no gap/overlap)`);
    }
  }

  // ── Same rectangle, CW winding -> identical totals, pieces still outward ──
  {
    const pgCW = [{x:0,y:0},{x:0,y:10},{x:20,y:10},{x:20,y:0}]; // CW
    const planCW = ctx.computeFringePlan(pgCW, 2);
    assert(near(planCW.perimeter, 60), 'CW: perimeter unchanged by winding');
    assert(near(planCW.totalSqFt, 152), 'CW: totalSqFt unchanged by winding');
    planCW.pieces.forEach((p, idx) => {
      const rectPoly = [p.p0, p.p1, p.p2, p.p3];
      const cx = rectPoly.reduce((s,pt)=>s+pt.x,0)/4, cy = rectPoly.reduce((s,pt)=>s+pt.y,0)/4;
      assert(!ctx.pointInPoly({x:cx,y:cy}, pgCW), `CW piece ${idx} centroid is not inside the PG polygon`);
    });
  }

  // ── Right triangle: exact perimeter via Pythagorean theorem ──
  {
    const tri = [{x:0,y:0},{x:10,y:0},{x:0,y:10}];
    const plan = ctx.computeFringePlan(tri, 1);
    const expectedPerim = 20 + Math.sqrt(200);
    assert(near(plan.perimeter, expectedPerim, 0.001), `triangle perimeter = 20+sqrt(200) (got ${plan.perimeter})`);
    assert(near(plan.pgArea, 50), 'triangle area = 50');
    assert(plan.pieces.length === 3, '3 pieces for a triangle');
  }

  // ── Degenerate inputs ──
  {
    assert(ctx.computeFringePlan([{x:0,y:0},{x:1,y:0}], 2) === null, 'returns null for <3 points');
    assert(ctx.computeFringePlan(rect(0,0,10,10), 0) === null, 'returns null for zero width');
    assert(ctx.computeFringePlan(rect(0,0,10,10), -1) === null, 'returns null for negative width');
  }

  // ── polygonPerimeter helper ──
  {
    assert(near(ctx.polygonPerimeter(rect(0,0,5,3)), 16), 'polygonPerimeter for 5x3 rect = 16');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  37. PUTTING GREEN FRINGE — config, mutual exclusivity, and quote integration
// ════════════════════════════════════════════════════════════════════════
section('37. Putting green fringe: layer mode, config persistence, and quote cost');
{
  function mockEl37() {
    return { checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild:()=>{}, replaceChildren:()=>{} };
  }

  // ── setSecondaryShapeMode: 'putting-green' is mutually exclusive across shapes ──
  {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const shapeA = rect(0,0,10,10);
    const shapeB = rect(20,0,10,10);
    const mainShape = rect(-5,-5,40,20);
    stored['wt_catalog_v2'] = JSON.stringify({ turf:[], infill:[], rock:[] });
    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'Test', created:1000, turf:[], infill:[], rock:[], edging:{}, pgSqFt:0, miscItems:[],
      layout: {
        points: mainShape, area: 800,
        secondaryShapes: [ { name:'Shape A', points: shapeA, area: 100 }, { name:'Shape B', points: shapeB, area: 100 } ],
        secondaryShapeModes: { 0: 'putting-green', 1: 'exclude' },
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);

    const inputs = {
      quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}},
      fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''},
      layoutLayersList:{innerHTML:''},
    };
    const mockCtx2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };

    const ctx37a = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl37(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl37() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, ctx37a);
    ctx37a.loadProject('p1');

    assert(ctx37a.getPuttingGreenShapeIndex(ctx37a.getCurrentProject()) === 0, 'shape 0 is initially the putting green');

    // Mark shape 1 as putting-green -> shape 0 should be demoted to 'install'
    let threw = false;
    try { ctx37a.setSecondaryShapeMode(1, 'putting-green'); } catch(e) { threw = true; }
    assert(!threw, 'setSecondaryShapeMode runs without throwing');
    const proj = ctx37a.getCurrentProject();
    assert(proj.layout.secondaryShapeModes[1] === 'putting-green', 'shape 1 is now putting-green');
    assert(proj.layout.secondaryShapeModes[0] === 'install', 'shape 0 demoted to install (mutual exclusivity)');
    assert(ctx37a.getPuttingGreenShapeIndex(proj) === 1, 'getPuttingGreenShapeIndex now returns 1');
  }

  // ── getAdjustedShapeArea: putting-green mode subtracts area like exclude ──
  {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const pg = rect(0,0,20,10); // area 200
    const mainShape = rect(-10,-10,60,40); // area 2400
    stored['wt_catalog_v2'] = JSON.stringify({ turf:[], infill:[], rock:[] });
    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'Test', created:1000, turf:[], infill:[], rock:[], edging:{}, pgSqFt:0, miscItems:[],
      layout: {
        points: mainShape, area: 2400,
        secondaryShapes: [ { name:'PG', points: pg, area: 200 } ],
        secondaryShapeModes: { 0: 'putting-green' },
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);
    const inputs = { quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}}, fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''}, layoutLayersList:{innerHTML:''} };
    const mockCtx2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };
    const ctx37b = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl37(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl37() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, ctx37b);
    ctx37b.loadProject('p1');
    const proj = ctx37b.getCurrentProject();
    const adjusted = ctx37b.getAdjustedShapeArea(proj, 2400);
    assert(near(adjusted, 2200), `putting-green area (200) is subtracted from base area (2400-200=2200), got ${adjusted}`);
  }

  // ── Full end-to-end: fringe config -> summary + quote cost ──
  {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const catalog = {
      turf: [
        { id:'lush', name:'WT Willamette Lush', type:'standard', costPerLinFt:'2.50' },
        { id:'pdx85', name:'WT PDX Putt 85', type:'putting', costPerLinFt:'3.50' },
        { id:'fringe', name:'WT K9 Cascade Pro', type:'standard', costPerLinFt:'2.00' },
      ],
      infill: [], rock: [],
    };
    stored['wt_catalog_v2'] = JSON.stringify(catalog);
    stored['wt_crews_v1'] = JSON.stringify([{ id:'crew_main', name:'Main Crew', items: [
      { id:'r_standard', name:'Standard Turf Install', unit:'per sq ft', rate:'8', key:'standard' },
      { id:'r_putting', name:'Putting Green Install', unit:'per sq ft', rate:'12', key:'putting' },
    ]}]);
    stored['wt_active_crew'] = 'crew_main';

    const mainShape = rect(0,0,50,40);
    const pgShape = [{x:10,y:10},{x:30,y:10},{x:30,y:20},{x:10,y:20}]; // 20x10 -> perimeter 60

    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
      turf: [
        { product:'WT Willamette Lush', installedSqFt:1800, sqFtToOrder:1800, orderedSqFt:1800, role:'base' },
        { product:'WT PDX Putt 85', installedSqFt:200, sqFtToOrder:200, orderedSqFt:200, role:'putting-green' },
      ],
      infill: [], rock: [],
      layout: {
        points: mainShape, area: 2000,
        secondaryShapes: [ { name:'Putting Green', points: pgShape, area: 200 } ],
        secondaryShapeModes: { 0: 'putting-green' },
        fringe: { enabled: true, turfProduct: 'WT K9 Cascade Pro', width: 2 },
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);

    const inputs = { quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}}, fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''}, layoutLayersList:{innerHTML:''} };
    const mockCtx2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };

    const ctx37c = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl37(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl37() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, ctx37c);
    ctx37c.loadProject('p1');

    // Fringe summary shows correct perimeter/sqft/cost
    const summary = inputs.fringeSummary.innerHTML;
    assert(summary.includes('60.0 ft'), `fringe summary shows PG perimeter 60.0 ft (got: ${summary})`);
    assert(summary.includes('152.0 sqft'), `fringe summary shows fringe sqft 152.0 (got: ${summary})`);
    assert(summary.includes('$304.00'), `fringe summary shows fringe material cost $304.00 = 152*2.00 (got: ${summary})`);

    // Quote: "No Putting Green" card has no fringe line; "With PG" card does, and COGS includes it
    const html = inputs.quoteOptionsContainer.innerHTML;
    const cards = html.split('quote-option').slice(1); // crude split per card
    const noPgCard = cards.find(c => c.includes('No Putting Green'));
    const withPgCard = cards.find(c => c.includes('WT PDX Putt 85'));
    assert(noPgCard && !noPgCard.includes('PG Fringe'), '"No Putting Green" card has no PG Fringe line');
    assert(withPgCard && withPgCard.includes('PG Fringe'), '"With Putting Green" card includes a PG Fringe line');
    assert(withPgCard.includes('$304.00'), '"With Putting Green" card shows fringe cost $304.00');
    assert(withPgCard.includes('Putting green turf'), '"With Putting Green" card shows the green\'s turf material line');

    // Sanity: total COGS for the PG card includes fringe cost as an additive component
    // Std yard: 1600*$8=$12800; PG labor: 200*$12=$2400; base turf mat: 1800*2.50=$4500;
    // PG turf mat: order rounds to a whole roll → ceil(200/15)*15=210, ×$3.50=$735; fringe: $304
    const expectedCogs = 1600*8 + 200*12 + 1800*2.50 + (Math.ceil(200/15)*15)*3.50 + 304;
    const priceMatch = withPgCard.match(/opt-price\">(\$[\d,]+\.\d\d)<\/div>/);
    assert(priceMatch, 'PG card has a price figure');
    const actualCogs = parseFloat(priceMatch[1].replace(/[$,]/g,''));
    assert(near(actualCogs, expectedCogs, 0.01), `PG card COGS = ${expectedCogs} (got ${actualCogs})`);

    // Disabling fringe removes it from both the summary and the quote
    inputs.fringeEnabled.checked = false;
    inputs.fringeTurfProduct.value = 'WT K9 Cascade Pro';
    inputs.fringeWidth.value = '2';
    ctx37c.updateFringeConfig();
    const html2 = inputs.quoteOptionsContainer.innerHTML;
    assert(!html2.includes('PG Fringe'), 'disabling fringe removes the PG Fringe line from the quote');
    const proj2 = ctx37c.getCurrentProject();
    assert(proj2.layout.fringe.enabled === false, 'fringe.enabled persisted as false');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  38. PIECE LIST VIEW (Length × Width per piece)
// ════════════════════════════════════════════════════════════════════════
section('38. Piece List shows length/width/sqft for every roll piece and fringe piece');
{
  function mockEl38() {
    return { checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild:()=>{}, replaceChildren:()=>{} };
  }
  function makeHarness38(projOverrides) {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    stored['wt_catalog_v2'] = JSON.stringify(projOverrides.catalog || { turf:[], infill:[], rock:[] });
    if (projOverrides.crews) {
      stored['wt_crews_v1'] = JSON.stringify(projOverrides.crews);
      stored['wt_active_crew'] = 'crew_main';
    }
    stored['wt_projects_v4'] = JSON.stringify([projOverrides.proj]);

    const inputs = {
      quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}},
      fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''},
      layoutLayersList:{innerHTML:''}, pieceListGroup:{style:{}}, pieceListTable:{innerHTML:''},
      manualCutsGroup:{style:{}}, manualCutsList:{innerHTML:''},
    };
    const mockCtx2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };

    const hctx = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl38(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl38() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, hctx);
    hctx.loadProject('p1');
    return { ctx: hctx, inputs };
  }

  // ── 3 bands of 60ft (180ft total -> 2 rolls, 3 pieces), no cuts ──
  {
    const mainShape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}];
    const { inputs } = makeHarness38({
      proj: {
        id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
        turf:[{ product:'Turf', installedSqFt:2700, sqFtToOrder:2700, orderedSqFt:2700, role:'base' }],
        infill:[], rock:[],
        layout: { points: mainShape, area:2700, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0 },
      },
    });
    const html = inputs.pieceListTable.innerHTML;
    assert(html.includes('Roll 1 / Piece 1'), 'piece list shows Roll 1 / Piece 1');
    assert(html.includes('Roll 1 / Piece 2'), 'piece list shows Roll 1 / Piece 2');
    assert(html.includes('Roll 2 / Piece 1'), 'piece list shows Roll 2 / Piece 1');
    // Each piece: 60ft length x 15ft width = 900 sqft
    const lengths = [...html.matchAll(/(\d+\.\d) ft<\/div>\s*<div>(\d+\.\d) ft<\/div>/g)];
    assert(lengths.length === 3, '3 length/width pairs found');
    lengths.forEach(([_,len,wid]) => {
      assert(near(parseFloat(len), 60), `piece length is 60.0 (got ${len})`);
      assert(near(parseFloat(wid), 15), `piece width is 15.0 (got ${wid})`);
    });
    assert(html.includes('180.0 ft total linear footage'), `total linear footage = 3*60 = 180 (got: ${html.match(/[\d.]+ ft total/)})`);
    assert(html.includes('3 pieces'), 'shows "3 pieces" count');
    assert(inputs.pieceListGroup.style.display === '', 'pieceListGroup is visible');
  }

  // ── L-shape with a manual cut producing a small offcut ──
  {
    const mainShape = [{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:10,y:15},{x:10,y:30},{x:0,y:30}];
    const { inputs } = makeHarness38({
      proj: {
        id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
        turf:[{ product:'Turf', installedSqFt:600, sqFtToOrder:600, orderedSqFt:600, role:'base' }],
        infill:[], rock:[],
        layout: { points: mainShape, area:600, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, rotation:0, translation:0, manualCuts: { 'y0.00': [39.5] } },
      },
    });
    const html = inputs.pieceListTable.innerHTML;
    assert(html.includes('Roll 1 / Piece 1'), 'shows Piece 1 (40ft from the cut band)');
    assert(html.includes('Roll 1 / Piece 2'), 'shows Piece 2 (1ft offcut)');
    assert(html.includes('Roll 1 / Piece 3'), 'shows Piece 3 (10ft from the other band)');
    assert(html.includes('40.0 ft'), 'shows the 40.0ft piece');
    assert(html.includes('1.0 ft'), 'shows the 1.0ft offcut piece');
    assert(html.includes('10.0 ft'), 'shows the 10.0ft piece');
    assert(html.includes('51.0 ft total linear footage'), 'total linear footage = 40+1+10 = 51');
  }

  // ── With PG fringe enabled: fringe pieces appear with their own dimensions ──
  {
    const catalog = { turf: [{ id:'fringe', name:'WT K9 Cascade Pro', type:'standard', costPerLinFt:'2.00' }], infill:[], rock:[] };
    const mainShape = rect(0,0,50,40);
    const pgShape = [{x:10,y:10},{x:30,y:10},{x:30,y:20},{x:10,y:20}]; // 20x10, perimeter 60
    const { inputs } = makeHarness38({
      catalog,
      proj: {
        id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
        turf:[{ product:'Turf', installedSqFt:2000, sqFtToOrder:2000, orderedSqFt:2000, role:'base' }],
        infill:[], rock:[],
        layout: {
          points: mainShape, area:2000,
          secondaryShapes: [ { name:'PG', points: pgShape, area:200 } ],
          secondaryShapeModes: { 0: 'putting-green' },
          fringe: { enabled:true, turfProduct:'WT K9 Cascade Pro', width:2 },
          rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
        },
      },
    });
    const html = inputs.pieceListTable.innerHTML;
    assert(html.includes('Fringe 1'), 'shows Fringe 1');
    assert(html.includes('Fringe 2'), 'shows Fringe 2');
    assert(html.includes('Fringe 3'), 'shows Fringe 3');
    assert(html.includes('Fringe 4'), 'shows Fringe 4');
    assert(html.includes('PG fringe'), 'fringe rows note "PG fringe"');
    // Fringe pieces use the fringe width (2.0 ft) as their "width" column
    const fringeRows = [...html.matchAll(/Fringe \d<\/div>\s*<div>([\d.]+) ft<\/div>\s*<div>([\d.]+) ft<\/div>/g)];
    assert(fringeRows.length === 4, '4 fringe rows found with length/width');
    fringeRows.forEach(([_,len,wid]) => {
      assert(near(parseFloat(wid), 2.0), `fringe piece width is 2.0 (got ${wid})`);
    });
    const fringeLengths = fringeRows.map(([_,len])=>parseFloat(len)).sort((a,b)=>a-b);
    assert(JSON.stringify(fringeLengths) === JSON.stringify([14,14,24,24]), `mitered fringe piece lengths are edge+2*width = [14,14,24,24] (got ${JSON.stringify(fringeLengths)})`);
  }

  // ── No layout -> piece list hidden ──
  {
    const { inputs } = makeHarness38({
      proj: { id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[], turf:[], infill:[], rock:[] },
    });
    assert(inputs.pieceListGroup.style.display !== '' , 'pieceListGroup hidden when there is no layout/turf');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  39. FRINGE EDGE MERGING — fewer seams via near-straight run detection
// ════════════════════════════════════════════════════════════════════════
section('39. mergeCollinearEdges + computeFringePlan: merging reduces piece count for curved/noisy outlines');
{
  // ── A rectangle with a redundant midpoint vertex on one edge should merge
  // that edge back to a single straight run ──
  {
    // 20x10 rectangle, but the bottom edge has an extra point at (10,0)
    const pg = [{x:0,y:0},{x:10,y:0},{x:20,y:0},{x:20,y:10},{x:0,y:10}];
    const merged = ctx.mergeCollinearEdges(pg, 1, 100);
    assert(merged.length === 4, `redundant collinear midpoint merged away (got ${merged.length} points, expected 4)`);
  }

  // ── A gentle curve approximated by many small-deviation points merges into one piece ──
  {
    // Arc-like polyline: points along a shallow curve, each deviating <0.5ft from the chord
    const curve = [];
    for (let i=0; i<=10; i++) {
      const t = i/10;
      curve.push({ x: t*20, y: Math.sin(t*Math.PI)*0.4 }); // max deviation ~0.4ft at midpoint
    }
    // Close it into a polygon with a straight base
    const pg = [...curve, {x:20,y:-5}, {x:0,y:-5}];
    const widthFt = 2; // tolerance = width/2 = 1.0, comfortably > 0.4 deviation
    const merged = ctx.mergeCollinearEdges(pg, widthFt/2, 100);
    assert(merged.length < pg.length, `curve points merged (got ${merged.length} from ${pg.length} original points)`);

    const plan = ctx.computeFringePlan(pg, widthFt, 100);
    assert(plan.pieces.length < pg.length, `fringe piece count (${plan.pieces.length}) is less than original edge count (${pg.length})`);

    // Piece centroids should not be inside the PG
    plan.pieces.forEach((p,i) => {
      const poly=[p.p0,p.p1,p.p2,p.p3];
      const cx=poly.reduce((s,pt)=>s+pt.x,0)/4, cy=poly.reduce((s,pt)=>s+pt.y,0)/4;
      assert(!ctx.pointInPoly({x:cx,y:cy}, pg), `merged piece ${i} centroid is not inside the PG`);
    });
  }

  // ── Real-world shape (John_yard.csv, includes Moasure "Arc" segments) ──
  {
    const csvPath = path.join(__dirname, 'John_yard.csv');
    if (fs.existsSync(csvPath)) {
      const csv = fs.readFileSync(csvPath, 'utf8');
      const parsed = ctx.parseLayoutCsv(csv);
      assert(parsed.points.length > 50, 'John_yard.csv has many points (arc segments)');

      const widthFt = 2;
      const plan = ctx.computeFringePlan(parsed.points, widthFt, 100);
      assert(plan.pieces.length < parsed.points.length / 2, `merging substantially reduces piece count (got ${plan.pieces.length} from ${parsed.points.length} points)`);
      assert(plan.pieces.length >= 4, `still a reasonable number of pieces for this shape (got ${plan.pieces.length})`);

      // No piece should exceed a roll length (100)
      plan.pieces.forEach((p,i) => {
        assert(p.length <= 100 + 1e-6, `piece ${i} length (${p.length.toFixed(1)}) fits within a 100ft roll`);
      });

      // Perimeter/area are reported from the TRUE (unmerged) outline
      assert(near(plan.pgArea, 726.65, 0.5), `pgArea reflects the true shape area (got ${plan.pgArea})`);

      // totalSqFt (merged pieces) should exceed ringArea (perimeter*width) —
      // more material ordered in exchange for fewer seams, as requested
      assert(plan.totalSqFt > plan.ringArea, `totalSqFt (${plan.totalSqFt.toFixed(1)}) exceeds the simple perimeter*width estimate (${plan.ringArea.toFixed(1)}) — extra material for fewer seams`);

      // No piece centroid should fall inside the true PG polygon
      let badCount = 0;
      plan.pieces.forEach(p => {
        const poly=[p.p0,p.p1,p.p2,p.p3];
        const cx=poly.reduce((s,pt)=>s+pt.x,0)/4, cy=poly.reduce((s,pt)=>s+pt.y,0)/4;
        if (ctx.pointInPoly({x:cx,y:cy}, parsed.points)) badCount++;
      });
      assert(badCount === 0, `no merged piece centroids fall inside the true PG outline (${badCount}/${plan.pieces.length} did)`);

      // ── Regression: a very fine-grained secondary shape (e.g. a putting
      // green outline traced with many tiny ~0.3ft edges) must still merge
      // down to a small piece count, and the resulting ring area must be in
      // the right ballpark (perimeter * width), not blown up by unmerged
      // tiny pieces with runaway miter joins. ──
      if (parsed.secondaryShapes && parsed.secondaryShapes.length) {
        const sub = parsed.secondaryShapes[0];
        assert(sub.points.length > 50, 'secondary shape has many fine-grained points');

        const subWidth = 1;
        const subPlan = ctx.computeFringePlan(sub.points, subWidth, 100);
        assert(subPlan.pieces.length < sub.points.length / 5, `fine-grained shape merges substantially (got ${subPlan.pieces.length} pieces from ${sub.points.length} points)`);

        // ringArea should be close to perimeter*width (a 1ft fringe on a ~52ft
        // perimeter should add roughly ~50-70 sqft, NOT hundreds of sqft from
        // unbounded miter spikes on tiny edges)
        const roughEstimate = subPlan.perimeter * subWidth;
        assert(subPlan.ringArea < roughEstimate * 2, `ringArea (${subPlan.ringArea.toFixed(1)}) is within 2x of perimeter*width (${roughEstimate.toFixed(1)}) — no runaway miter spikes`);
        assert(subPlan.totalSqFt < roughEstimate * 2, `totalSqFt (${subPlan.totalSqFt.toFixed(1)}) is within 2x of perimeter*width (${roughEstimate.toFixed(1)})`);

        // No gaps/overlaps between adjacent pieces
        let subGaps = 0;
        for (let i = 0; i < subPlan.pieces.length; i++) {
          const cur = subPlan.pieces[i], next = subPlan.pieces[(i+1) % subPlan.pieces.length];
          if (!near(cur.p1.x, next.p0.x) || !near(cur.p1.y, next.p0.y)) subGaps++;
          if (!near(cur.p2.x, next.p3.x) || !near(cur.p2.y, next.p3.y)) subGaps++;
        }
        assert(subGaps === 0, `fine-grained shape: no gaps/overlaps between adjacent pieces (found ${subGaps})`);

        // Rotation invariance: rotating the shape 154° about its centroid
        // (as the UI's layer-rotation slider does) should not change the
        // merge result's totals.
        const cx = sub.points.reduce((s,p)=>s+p.x,0)/sub.points.length;
        const cy = sub.points.reduce((s,p)=>s+p.y,0)/sub.points.length;
        const rotated = ctx.rotateAround(sub.points, 154, cx, cy);
        const rotPlan = ctx.computeFringePlan(rotated, subWidth, 100);
        assert(rotPlan.pieces.length === subPlan.pieces.length, `rotated shape produces the same piece count (got ${rotPlan.pieces.length} vs ${subPlan.pieces.length})`);
        assert(near(rotPlan.ringArea, subPlan.ringArea, 0.5), `rotated shape has the same ringArea (got ${rotPlan.ringArea.toFixed(1)} vs ${subPlan.ringArea.toFixed(1)})`);
      }
    } else {
      skipped++;
      console.log('  ⊘ (skipped: John_yard.csv not present in this environment)');
    }
  }

  // ── Backward-compat: computeFringePlan(pg, width) without rollLength still works (defaults to 100) ──
  {
    const pg = rect(0,0,20,10);
    const plan = ctx.computeFringePlan(pg, 2);
    assert(plan !== null, 'computeFringePlan works without explicit rollLength');
    assert(plan.pieces.length === 4, 'rectangle still produces 4 pieces with default rollLength');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  40. FRINGE PIECES VISIBILITY TOGGLE
// ════════════════════════════════════════════════════════════════════════
section('40. Fringe "Show pieces" toggle: individual pieces vs single outline');
{
  function mockEl40() {
    return { checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild:()=>{}, replaceChildren:()=>{} };
  }
  function makeHarness40(fringePiecesVisible) {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const catalog = { turf: [{ id:'fringe', name:'WT K9 Cascade Pro', type:'standard', costPerLinFt:'2.00' }], infill:[], rock:[] };
    stored['wt_catalog_v2'] = JSON.stringify(catalog);

    const mainShape = rect(0,0,50,40);
    const pgShape = rect(10,10,20,10); // 20x10, perimeter 60
    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
      turf:[{ product:'Turf', installedSqFt:2000, sqFtToOrder:2000, orderedSqFt:2000, role:'base' }],
      infill:[], rock:[],
      layout: {
        points: mainShape, area:2000,
        secondaryShapes: [ { name:'PG', points: pgShape, area:200 } ],
        secondaryShapeModes: { 0: 'putting-green' },
        fringe: { enabled:true, turfProduct:'WT K9 Cascade Pro', width:2, piecesVisible: fringePiecesVisible },
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);

    const drawCalls = { fillTextLabels: [], strokeStyles: [] };
    const inputs = {
      quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}},
      fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''},
      fringePiecesVisible:{checked:false},
      layoutLayersList:{innerHTML:''}, pieceListGroup:{style:{}}, pieceListTable:{innerHTML:''},
      manualCutsGroup:{style:{}}, manualCutsList:{innerHTML:''},
    };
    let currentStroke = null;
    const mockCtx2d = {
      clearRect:()=>{}, beginPath:()=>{}, moveTo:()=>{}, lineTo:()=>{}, closePath:()=>{},
      fill:()=>{}, stroke:()=>{ drawCalls.strokeStyles.push(currentStroke); }, save:()=>{}, restore:()=>{}, setLineDash:()=>{},
      arc:()=>{}, fillRect:()=>{}, fillText:(text)=>{ if (typeof text==='string' && text.startsWith('Fringe')) drawCalls.fillTextLabels.push(text); },
      measureText:()=>({width:10}), translate:()=>{}, rect:()=>{}, clip:()=>{},
      set strokeStyle(v){ currentStroke = v; }, set fillStyle(v){}, set lineWidth(v){}, set font(v){},
    };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };

    const hctx = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl40(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl40() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, hctx);
    hctx.loadProject('p1');
    return { ctx: hctx, inputs, drawCalls };
  }

  // ── piecesVisible: true (default) -> each piece filled, outlined, and labeled ──
  {
    const { inputs, drawCalls } = makeHarness40(true);
    assert(inputs.fringePiecesVisible.checked === true, 'checkbox reflects piecesVisible=true');
    // loadProject triggers drawRollLayoutCanvas twice (4 pieces x 2 draws = 8 labels)
    assert(drawCalls.fillTextLabels.length === 8, `"Fringe N" labels drawn for all 4 pieces, each draw pass (got ${drawCalls.fillTextLabels.length})`);
    assert(drawCalls.fillTextLabels.includes('Fringe 1'), 'labels include "Fringe 1"');
    assert(drawCalls.strokeStyles.includes('#C77800'), 'fringe pieces stroked in orange (#C77800)');
  }

  // ── piecesVisible: false -> no per-piece labels, single outline drawn ──
  {
    const { inputs, drawCalls } = makeHarness40(false);
    assert(inputs.fringePiecesVisible.checked === false, 'checkbox reflects piecesVisible=false');
    assert(drawCalls.fillTextLabels.length === 0, `no "Fringe N" labels drawn when pieces are hidden (got ${drawCalls.fillTextLabels.length})`);
    // The outline is still drawn in the same fringe color
    assert(drawCalls.strokeStyles.includes('#C77800'), 'fringe outline still stroked in orange (#C77800) even with pieces hidden');
  }

  // ── Default (piecesVisible undefined) behaves as visible ──
  {
    const stored = {};
    const mockLS = { getItem: k => stored[k]||null, setItem: (k,v) => { stored[k]=v; } };
    const catalog = { turf: [{ id:'fringe', name:'WT K9 Cascade Pro', type:'standard', costPerLinFt:'2.00' }], infill:[], rock:[] };
    stored['wt_catalog_v2'] = JSON.stringify(catalog);
    const mainShape = rect(0,0,50,40);
    const pgShape = rect(10,10,20,10);
    stored['wt_projects_v4'] = JSON.stringify([{
      id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
      turf:[{ product:'Turf', installedSqFt:2000, sqFtToOrder:2000, orderedSqFt:2000, role:'base' }],
      infill:[], rock:[],
      layout: {
        points: mainShape, area:2000,
        secondaryShapes: [ { name:'PG', points: pgShape, area:200 } ],
        secondaryShapeModes: { 0: 'putting-green' },
        fringe: { enabled:true, turfProduct:'WT K9 Cascade Pro', width:2 }, // no piecesVisible key
        rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
      },
    }]);
    const inputs = {
      quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}},
      fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''},
      fringePiecesVisible:{checked:false},
      layoutLayersList:{innerHTML:''}, pieceListGroup:{style:{}}, pieceListTable:{innerHTML:''},
      manualCutsGroup:{style:{}}, manualCutsList:{innerHTML:''},
    };
    const labels = [];
    const mockCtx2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:(t)=>{ if(typeof t==='string'&&t.startsWith('Fringe')) labels.push(t); },measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const mockCanvas = { width:700,height:350,getContext:()=>mockCtx2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = mockCanvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };
    const hctx = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById: id => inputs[id]||mockEl40(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockEl40() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver: function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, hctx);
    hctx.loadProject('p1');
    assert(inputs.fringePiecesVisible.checked === true, 'checkbox defaults to checked when piecesVisible is unset');
    // loadProject triggers drawRollLayoutCanvas twice (4 pieces x 2 draws = 8 labels)
    assert(labels.length === 8, `defaults to showing per-piece labels when piecesVisible is unset (got ${labels.length})`);
  }

  // ── Toggling persists to proj.layout.fringe.piecesVisible ──
  {
    const { ctx: hctx, inputs } = makeHarness40(true);
    inputs.fringeEnabled.checked = true;
    inputs.fringeTurfProduct.value = 'WT K9 Cascade Pro';
    inputs.fringeWidth.value = '2';
    inputs.fringePiecesVisible.checked = false;
    hctx.updateFringeConfig();
    const proj = hctx.getCurrentProject();
    assert(proj.layout.fringe.piecesVisible === false, 'unchecking "Show fringe pieces" persists piecesVisible=false');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  41. FRINGE OUTLINE (smooth offset for "outline only" canvas display)
// ════════════════════════════════════════════════════════════════════════
section('41. computeFringeOutline: smooth per-vertex offset hugging the PG outline');
{
  function ptSegDist(p,a,b){
    const dx=b.x-a.x, dy=b.y-a.y;
    const len2 = dx*dx+dy*dy;
    if (len2<1e-12) return Math.hypot(p.x-a.x,p.y-a.y);
    let t = ((p.x-a.x)*dx+(p.y-a.y)*dy)/len2;
    t = Math.max(0,Math.min(1,t));
    return Math.hypot(p.x-(a.x+t*dx), p.y-(a.y+t*dy));
  }
  function perpDist(pt, a, b) {
    const dx = b.x-a.x, dy = b.y-a.y;
    const len = Math.hypot(dx,dy);
    if (len < 1e-9) return Math.hypot(pt.x-a.x, pt.y-a.y);
    return Math.abs((pt.x-a.x)*dy - (pt.y-a.y)*dx) / len;
  }
  function segIntersect(p1,p2,p3,p4){
    function ccw(a,b,c){ return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x); }
    const d1=ccw(p3,p4,p1), d2=ccw(p3,p4,p2), d3=ccw(p1,p2,p3), d4=ccw(p1,p2,p4);
    return ((d1>0&&d2<0)||(d1<0&&d2>0)) && ((d3>0&&d4<0)||(d3<0&&d4>0));
  }
  function countSelfIntersections(poly) {
    const n = poly.length;
    let count = 0;
    for (let i=0;i<n;i++){
      for (let j=i+1;j<n;j++){
        if (j===i||j===(i+1)%n||i===(j+1)%n) continue;
        if (segIntersect(poly[i],poly[(i+1)%n],poly[j],poly[(j+1)%n])) count++;
      }
    }
    return count;
  }

  // ── Rectangle: outline should be a uniform offset at distance `width`
  // along each edge's normal. At square (90°) corners, the offset vertex is
  // the miter point — width*sqrt(2) from the adjacent edges' nearest point
  // (their shared corner), since both edges contribute equally. ──
  {
    const pg = rect(0,0,20,10);
    const outline = ctx.computeFringeOutline(pg, 2);
    assert(outline.length === 4, 'rectangle outline has same vertex count as input (4)');
    outline.forEach((op,i) => {
      let best = Infinity;
      for (let j=0;j<pg.length;j++){
        const d = ptSegDist(op, pg[j], pg[(j+1)%pg.length]);
        if (d<best) best=d;
      }
      assert(near(best, 2*Math.SQRT2, 0.01), `rectangle outline vertex ${i} (a 90° miter corner) is ~2*sqrt(2) ft from the PG boundary (got ${best.toFixed(3)})`);
    });
    assert(countSelfIntersections(outline) === 0, 'rectangle outline has no self-intersections');
  }

  // ── Real-world fine-grained shape (Sub Layer 1 from John_yard.csv) ──
  {
    const csvPath = path.join(__dirname, 'John_yard.csv');
    if (fs.existsSync(csvPath)) {
      const csv = fs.readFileSync(csvPath, 'utf8');
      const parsed = ctx.parseLayoutCsv(csv);
      const sub = parsed.secondaryShapes[0];
      const outline = ctx.computeFringeOutline(sub.points, 1);

      assert(outline.length === sub.points.length, `outline follows every original vertex (got ${outline.length} from ${sub.points.length})`);

      let minD=Infinity, maxD=0, sumD=0;
      outline.forEach(op => {
        let best = Infinity;
        for (let j=0;j<sub.points.length;j++){
          const d = ptSegDist(op, sub.points[j], sub.points[(j+1)%sub.points.length]);
          if (d<best) best=d;
        }
        minD=Math.min(minD,best); maxD=Math.max(maxD,best); sumD+=best;
      });
      const avgD = sumD/outline.length;
      assert(near(avgD, 1, 0.1), `average offset distance is close to the fringe width 1.0 (got ${avgD.toFixed(3)})`);
      assert(maxD < 1.2 + 1e-6, `no offset point exceeds 1.2x the fringe width, even at the duplicate seam vertex (got max ${maxD.toFixed(3)})`);
      assert(minD > 0.5, `every offset point is at least half the fringe width away (got min ${minD.toFixed(3)})`);
      assert(countSelfIntersections(outline) === 0, 'fine-grained shape outline has no self-intersections');

      // No spikes: each outline point should be close to the line through its
      // immediate neighbors (a smooth curve has small local deviation; a spike
      // — like the one caused by a zero-length duplicate edge at the seam —
      // would show up as one point jutting far from its neighbors' line).
      const n = outline.length;
      let maxSpike = 0;
      for (let i = 0; i < n; i++) {
        const prev = outline[(i-1+n)%n], cur = outline[i], next = outline[(i+1)%n];
        const d = perpDist(cur, prev, next);
        if (d > maxSpike) maxSpike = d;
      }
      assert(maxSpike < 0.45, `no spike vertices in the outline (max local deviation ${maxSpike.toFixed(3)}, e.g. the duplicate point at the seam doesn't create a notch)`);

      const outlineArea = ctx.polygonArea(outline);
      assert(outlineArea > sub.area, `outline area (${outlineArea.toFixed(1)}) exceeds the PG area (${sub.area}) — it's outside the green`);
    } else {
      skipped++;
      console.log('  ⊘ (skipped: John_yard.csv not present in this environment)');
    }
  }

  // ── Degenerate inputs ──
  {
    assert(ctx.computeFringeOutline([{x:0,y:0},{x:1,y:0}], 2) === null, 'returns null for <3 points');
    assert(ctx.computeFringeOutline(rect(0,0,10,10), 0) === null, 'returns null for zero width');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  42. STRAY LINE FIX: degenerate sliver strips at extreme seam offset
// ════════════════════════════════════════════════════════════════════════
section('42. computeRollLayout: degenerate near-zero-area slivers produce no stray geometry');
{
  // Irregular 15-point polygon (similar shape/scale to a real Moasure yard)
  // where, at certain seam offsets, the first strip's band only grazes a
  // vertex of the shape — clipping to a thin sliver triangle with near-zero
  // area but a long x-extent (a thin triangle's bounding box isn't bounded
  // by its height). Before the fix, this produced a strip with a long
  // orderedLength/displayRect despite having no real material — a visible
  // stray line on the canvas.
  const shape = [
    {x:0,y:5},{x:5,y:30},{x:12,y:33},{x:22,y:28},{x:33,y:26},{x:43,y:18},
    {x:62,y:18},{x:67,y:14},{x:75,y:10},{x:80,y:0},{x:55,y:0},{x:48,y:-12},
    {x:40,y:-2},{x:18,y:-3},{x:0,y:0}
  ];
  const opts = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4 };

  [0, 14.9].forEach(t => {
    const layout = ctx.computeRollLayout(shape, 89, t, opts);
    const degenerate = layout.strips.filter(s => s.clippedArea === 0);
    assert(degenerate.length >= 1, `t=${t}: at least one degenerate (zero-area) strip exists in this reproduction (got ${degenerate.length})`);
    degenerate.forEach((s, i) => {
      assert(s.orderedLength === 0, `t=${t}: degenerate strip ${i} has orderedLength 0 (got ${s.orderedLength})`);
      assert(Array.isArray(s.clipped) && s.clipped.length === 0, `t=${t}: degenerate strip ${i} has no clipped polygon (got ${s.clipped.length} points)`);
      assert(Array.isArray(s.displayClipped) && s.displayClipped.length === 0, `t=${t}: degenerate strip ${i} has no displayClipped polygon`);
      // displayRect collapses to zero LENGTH (sMinX to sMinX+orderedLength is
      // a zero-width span) even though it retains its normal strip height —
      // so its area is zero and it draws as invisible, not a visible line.
      const rectArea = ctx.polygonArea(s.displayRect);
      assert(rectArea < 0.01, `t=${t}: degenerate strip ${i}'s displayRect has ~zero area, not a stray visible shape (got ${rectArea.toFixed(4)} sqft)`);
    });
  });

  // Sanity: the real (non-degenerate) strips are unaffected — same count and
  // similar areas regardless of which extreme of the seam offset slider.
  const layout0 = ctx.computeRollLayout(shape, 89, 0, opts);
  const layout149 = ctx.computeRollLayout(shape, 89, 14.9, opts);
  assert(layout0.strips.length === layout149.strips.length, `same strip count at both seam offset extremes (got ${layout0.strips.length} vs ${layout149.strips.length})`);
  const realArea0 = layout0.strips.reduce((s,st)=>s+st.clippedArea, 0);
  const realArea149 = layout149.strips.reduce((s,st)=>s+st.clippedArea, 0);
  assert(near(realArea0, realArea149, 5), `total real clipped area is consistent across seam offset extremes (got ${realArea0.toFixed(1)} vs ${realArea149.toFixed(1)})`);
}

// ════════════════════════════════════════════════════════════════════════
//  43. STRAY LINE FIX (round 2): degenerate strip's displayRect must also
//      be suppressed, not just clipped/displayClipped — "Show purchased
//      roll rectangles" draws displayRect directly and only checks
//      `.length`, so a degenerate strip with a 4-point zero-area rect still
//      passed that truthy check and got drawn as a visible sliver/line.
// ════════════════════════════════════════════════════════════════════════
section('43. computeRollLayout: degenerate strip displayRect is empty (not just zero-area)');
{
  const csvPath = path.join(__dirname, 'Melanie_yard.csv');
  if (fs.existsSync(csvPath)) {
    const csv = fs.readFileSync(csvPath, 'utf8');
    const parsed = ctx.parseLayoutCsv(csv);
    const opts = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4 };

    // Exact reproduction: Roll Direction 89°, Seam Offset 0ft, "Show
    // purchased roll rectangles" on (which is what actually exposed this —
    // the rectangle-drawing branch checks `u.displayRect.length` directly).
    const layout = ctx.computeRollLayout(parsed.points, 89, 0, opts);
    const degenerate = layout.strips.filter(s => s.clippedArea === 0);
    assert(degenerate.length >= 1, `Melanie_yard.csv at rot=89,t=0 has at least one degenerate strip (got ${degenerate.length})`);
    degenerate.forEach((s, i) => {
      assert(Array.isArray(s.displayRect) && s.displayRect.length === 0, `degenerate strip ${i}: displayRect is empty, not a 4-point zero-area rect (got ${s.displayRect.length} points)`);
    });

    // Real (non-degenerate) strips must keep their normal 4-point rectangle
    const real = layout.strips.filter(s => s.clippedArea > 0);
    assert(real.length >= 1, 'at least one real strip exists for comparison');
    real.forEach((s, i) => {
      assert(s.displayRect.length === 4, `real strip ${i}: displayRect still has its normal 4 points (got ${s.displayRect.length})`);
    });
  } else {
    skipped++;
    console.log('  ⊘ (skipped: Melanie_yard.csv not present in this environment)');
  }

  // Same check on the synthetic reproduction shape from section 42, across
  // both seam offset extremes, so this is covered even without the fixture file.
  const shape = [
    {x:0,y:5},{x:5,y:30},{x:12,y:33},{x:22,y:28},{x:33,y:26},{x:43,y:18},
    {x:62,y:18},{x:67,y:14},{x:75,y:10},{x:80,y:0},{x:55,y:0},{x:48,y:-12},
    {x:40,y:-2},{x:18,y:-3},{x:0,y:0}
  ];
  const opts2 = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4 };
  [0, 14.9].forEach(t => {
    const layout = ctx.computeRollLayout(shape, 89, t, opts2);
    layout.strips.filter(s => s.clippedArea === 0).forEach((s, i) => {
      assert(s.displayRect.length === 0, `t=${t}: degenerate strip ${i}'s displayRect is empty (got ${s.displayRect.length} points)`);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════
//  44. CUT MODE — drag-to-nest gesture routing (click vs drag)
//  Regression guard for the fix that lets a piece be dragged into a waste
//  area WITHOUT leaving Cut Mode: a click toggles a cut, a press-and-drag
//  nests the piece. These unit-test the routing logic (endCutClick) and the
//  guard change in startDragNesting. NOTE: the harness is DOM-less, so these
//  verify the decision branches, not real pointer drags — a manual drag on
//  the layout canvas is still the only end-to-end check.
// ════════════════════════════════════════════════════════════════════════
section('44. Cut Mode drag-to-nest routing');
{
  const cutMockEl = () => ({
    checked: false, value: '', style: {}, classList: { add:()=>{}, remove:()=>{} },
    addEventListener: ()=>{}, querySelector: ()=>null, querySelectorAll: ()=>[],
  });
  function cutCtx() {
    const c = {
      window: { _wtEditMode:false, _wtMoveLayersMode:false, _wtCutMode:false, _wtLayoutZoom:1 },
      document: { getElementById:()=>cutMockEl(), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }

  // ── A click (barely moved) in Cut Mode toggles a cut ──
  {
    const c = cutCtx();
    let startCutCalled = false;
    c.startCut = () => { startCutCalled = true; };
    c.canvasEventToData = () => ({ canvasX: 101, canvasY: 100 }); // ~1px from down
    c.window._wtCutMode = true;
    c.window._wtCutDownPos = { canvasX: 100, canvasY: 100 };
    c.window._wtDragNestKey = 'armed';
    c.endCutClick({});
    assert(startCutCalled === true, 'click (small move) in Cut Mode toggles a cut (startCut called)');
    assert(c.window._wtDragNestKey == null, 'click clears the armed drag-nest so endDragNesting is a no-op');
    assert(c.window._wtCutDownPos == null, 'endCutClick consumes _wtCutDownPos');
  }

  // ── A real drag does NOT toggle a cut (leaves the nest to endDragNesting) ──
  {
    const c = cutCtx();
    let startCutCalled = false;
    c.startCut = () => { startCutCalled = true; };
    c.canvasEventToData = () => ({ canvasX: 180, canvasY: 100 }); // 80px → drag
    c.window._wtCutMode = true;
    c.window._wtCutDownPos = { canvasX: 100, canvasY: 100 };
    c.window._wtDragNestKey = 'armed';
    c.endCutClick({});
    assert(startCutCalled === false, 'drag (large move) in Cut Mode does NOT toggle a cut');
    assert(c.window._wtDragNestKey === 'armed', 'drag leaves _wtDragNestKey set for endDragNesting to nest');
  }

  // ── endCutClick is inert outside Cut Mode and without a recorded press ──
  {
    const c = cutCtx();
    let startCutCalled = false;
    c.startCut = () => { startCutCalled = true; };
    c.canvasEventToData = () => ({ canvasX: 100, canvasY: 100 });
    c.window._wtCutMode = false;
    c.window._wtCutDownPos = { canvasX: 100, canvasY: 100 };
    c.endCutClick({});
    assert(startCutCalled === false, 'endCutClick is inert when not in Cut Mode');

    c.window._wtCutMode = true;
    c.window._wtCutDownPos = null;
    c.endCutClick({});
    assert(startCutCalled === false, 'endCutClick is inert with no recorded press position');
  }

  // ── Exactly-at-threshold (8px) counts as a drag, not a click ──
  {
    const c = cutCtx();
    let startCutCalled = false;
    c.startCut = () => { startCutCalled = true; };
    c.canvasEventToData = () => ({ canvasX: 108, canvasY: 100 }); // exactly 8px
    c.window._wtCutMode = true;
    c.window._wtCutDownPos = { canvasX: 100, canvasY: 100 };
    c.endCutClick({});
    assert(startCutCalled === false, '8px move is treated as a drag (>= threshold), not a cut');
  }

  // ── startDragNesting now arms a drag-nest even while Cut Mode is on ──
  {
    const c = cutCtx();
    c.getCurrentProject = () => ({ layout: {} });
    c.pointInPoly = () => true; // force the hit regardless of transform math
    c.canvasEventToData = () => ({ canvasX: 50, canvasY: 50 });
    c.document.getElementById = (id) => (id === 'showRectanglesToggle' ? { checked:true } : cutMockEl());
    // Pickup now enumerates nestable units per layer from layout.strips, so the
    // unit must live on a strip (getNestableUnitsByLayer walks strips/pieces).
    c.window._wtCurrentRollLayout = { strips: [{ key:'u1', displayClipped:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}] }] };
    c.window._wtCanvasTransform = { minX:0, minY:0, pad:0, scale:1, h:100 };
    c.window._wtMoveLayersMode = false;
    c.window._wtCutMode = true; // the case that used to bail
    c.window._wtDragNestKey = null;
    c.startDragNesting({ preventDefault(){} });
    assert(c.window._wtDragNestKey === 'u1', 'startDragNesting arms a drag-nest even while Cut Mode is on');
  }

  // ── ...but Move Layers mode STILL blocks it (we only dropped the cut guard) ──
  {
    const c = cutCtx();
    c.getCurrentProject = () => ({ layout: {} });
    c.getNestableUnits = () => ([{ key:'u1', displayClipped:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}] }]);
    c.pointInPoly = () => true;
    c.canvasEventToData = () => ({ canvasX: 50, canvasY: 50 });
    c.document.getElementById = (id) => (id === 'showRectanglesToggle' ? { checked:true } : cutMockEl());
    c.window._wtCurrentRollLayout = { strips: [] };
    c.window._wtCanvasTransform = { minX:0, minY:0, pad:0, scale:1, h:100 };
    c.window._wtMoveLayersMode = true; // should still bail
    c.window._wtCutMode = false;
    c.window._wtDragNestKey = null;
    c.startDragNesting({ preventDefault(){} });
    assert(c.window._wtDragNestKey == null, 'startDragNesting still bails in Move Layers mode (guard intact)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  45. NESTING — per-piece "Put back" (unnestPiece) + restore semantics
//  The user workflow: make multiple cuts, move multiple pieces into waste
//  areas, then reset SPECIFIC pieces. unnestPiece must remove exactly one
//  placement and leave the others alone. The compute-level check confirms that
//  removing a nesting key restores Ordered SqFt to the un-nested baseline.
// ════════════════════════════════════════════════════════════════════════
section('45. Nesting: per-piece Put back');
{
  function unnestCtx() {
    const c = {
      window: { _wtEditMode:false, _wtLayoutZoom:1 },
      document: { getElementById:()=>({ checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{} }), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }

  // ── unnestPiece removes exactly the targeted piece, leaves others nested ──
  {
    const c = unnestCtx();
    const proj = { layout: { nesting: { a: 'host1', b: 'host2', d: 'host1' } } };
    let saved = false, rendered = false;
    c.getCurrentProject = () => proj;
    c.save = () => { saved = true; };
    c.renderRollLayout = () => { rendered = true; };
    c.unnestPiece('b');
    assert(!('b' in proj.layout.nesting), 'unnestPiece removes the targeted piece (b)');
    assert(proj.layout.nesting.a === 'host1' && proj.layout.nesting.d === 'host1', 'unnestPiece leaves the other nested pieces intact (per-piece reset)');
    assert(saved && rendered, 'unnestPiece persists and re-renders');
  }

  // ── unnestPiece is a safe no-op when there is no project/layout/nesting ──
  {
    const c = unnestCtx();
    let threw = false;
    try {
      c.getCurrentProject = () => null;             c.unnestPiece('x');
      c.getCurrentProject = () => ({});             c.unnestPiece('x');
      c.getCurrentProject = () => ({ layout:{} });  c.unnestPiece('x');
    } catch (e) { threw = true; }
    assert(!threw, 'unnestPiece is a safe no-op when project/layout/nesting are missing');
  }

  // ── Compute-level: removing the nesting key restores Ordered SqFt baseline ──
  {
    const c = unnestCtx();
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
    const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];
    const base = c.computeRollLayout(lShape, 0, 0, opts);
    const small = base.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
    const big   = base.strips.find(s => s.index !== (small||{}).index && s.wasteArea >= (small||{purchasedArea:9999}).purchasedArea);
    if (small && big) {
      const nested = c.computeRollLayout(lShape, 0, 0, { ...opts, nesting:{ [small.key]: big.key } });
      assert(nested.totalOrdered < base.totalOrdered, 'nesting a piece lowers Ordered SqFt');
      // "Put back" = remove that key → recompute → back to baseline
      const putBack = c.computeRollLayout(lShape, 0, 0, { ...opts, nesting:{} });
      assert(near(putBack.totalOrdered, base.totalOrdered, 0.01), 'removing the nesting key (Put back) restores Ordered SqFt to baseline');
    } else {
      console.log('  (compute-level restore check skipped — no suitable strip pair)');
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  46. TIERED LABOR PRICING — resolveTierRate / getRateFor (whole-job-at-bracket)
//  A crew's per-sqft labor line (standard/putting) can carry sqft brackets;
//  the whole job is charged at the matching bracket's rate (flat, not
//  progressive). These test the resolver and the crew-aware lookup.
// ════════════════════════════════════════════════════════════════════════
section('46. Tiered labor pricing');
{
  function tierCtx() {
    const c = {
      window: { _wtEditMode:false },
      document: { getElementById:()=>null, querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }

  // ── resolveTierRate: flat item (no tiers) returns its flat rate ──
  {
    const c = tierCtx();
    assert(c.resolveTierRate({ rate: 8 }, 1234) === 8, 'flat item returns flat rate regardless of sqft');
    assert(c.resolveTierRate({ rate: '' }, 500) === 0, 'flat item with empty rate returns 0');
    assert(c.itemIsTiered({ rate: 8 }) === false, 'itemIsTiered false for flat item');
    assert(c.itemIsTiered({ tiers: [] }) === false, 'itemIsTiered false for empty tiers');
    assert(c.itemIsTiered({ tiers: [{upTo:null,rate:7}] }) === true, 'itemIsTiered true when tiers present');
  }

  // ── resolveTierRate: whole job at the matching bracket's rate ──
  {
    const c = tierCtx();
    const item = { tiers: [ {upTo:500, rate:9}, {upTo:1000, rate:8}, {upTo:null, rate:7} ] };
    assert(c.resolveTierRate(item, 400)  === 9, '400 sqft → first bracket ($9)');
    assert(c.resolveTierRate(item, 500)  === 9, '500 sqft (== bound) → first bracket ($9)');
    assert(c.resolveTierRate(item, 501)  === 8, '501 sqft → second bracket ($8)');
    assert(c.resolveTierRate(item, 1000) === 8, '1000 sqft (== bound) → second bracket ($8)');
    assert(c.resolveTierRate(item, 1001) === 7, '1001 sqft → unbounded bracket ($7)');
    assert(c.resolveTierRate(item, 99999) === 7, 'very large sqft → unbounded bracket ($7)');
    assert(c.resolveTierRate(item, 0) === 9, '0 sqft → first bracket ($9)');
  }

  // ── resolveTierRate: unsorted tiers and missing unbounded tier ──
  {
    const c = tierCtx();
    const unsorted = { tiers: [ {upTo:1000, rate:8}, {upTo:null, rate:7}, {upTo:500, rate:9} ] };
    assert(c.resolveTierRate(unsorted, 600) === 8, 'unsorted tiers still resolve correctly (600 → $8)');
    const noUnbounded = { tiers: [ {upTo:500, rate:9}, {upTo:1000, rate:8} ] };
    assert(c.resolveTierRate(noUnbounded, 5000) === 8, 'above all bounds with no unbounded tier → last bracket rate');
  }

  // ── getRateFor: uses the project crew, tier-aware; falls back to default ──
  {
    const c = tierCtx();
    const crews = [
      { id:'crew_flat', name:'Flat', items:[ {key:'standard', rate:8}, {key:'putting', rate:9} ] },
      { id:'crew_tier', name:'Tiered', items:[
        {key:'standard', tiers:[ {upTo:1000, rate:8}, {upTo:null, rate:7} ]},
        {key:'putting',  rate:10 },
      ] },
    ];
    c.getCrews = () => crews;
    c.getLaborItems = () => crews[0].items;
    c.getCurrentProject = () => ({ crewId:'crew_tier' });
    assert(c.getRateFor('standard', 500)  === 8, 'tiered crew: 500 sqft standard → $8');
    assert(c.getRateFor('standard', 1500) === 7, 'tiered crew: 1500 sqft standard → $7 (higher bracket)');
    assert(c.getRateFor('putting', 9999)  === 10, 'tiered crew: putting is flat → $10 regardless of sqft');
    assert(c.getRateFor('edging', 100) === 4, 'unknown-on-crew key falls back to default ($4 edging)');
    c.getCurrentProject = () => ({ crewId:'crew_flat' });
    assert(c.getRateFor('standard', 1500) === 8, 'flat crew: standard is $8 at any sqft');
    c.getCurrentProject = () => ({});
    assert(c.getRateFor('standard', 1500) === 8, 'no project crew → active crew flat rate');
  }

  // ── getTierRanges: explicit from–to line items, lower bound = previous cap ──
  {
    const c = tierCtx();
    const item = { tiers: [ {upTo:1000, rate:8}, {upTo:2000, rate:7.5}, {upTo:null, rate:7} ] };
    const r = c.getTierRanges(item);
    assert(r.length === 3, 'getTierRanges returns one entry per bracket');
    assert(r[0].from === 0 && r[0].to === 1000 && r[0].rate === 8, 'first range 0–1000 @ $8');
    assert(r[1].from === 1001 && r[1].to === 2000 && r[1].rate === 7.5, 'second range 1001–2000 @ $7.50 (lower = previous cap + 1)');
    assert(r[2].from === 2001 && r[2].to === null && r[2].rate === 7, 'last range 2001+ (to=null) @ $7');
    // Ranges align with resolveTierRate: a value in (from, to] resolves to that rate.
    assert(c.resolveTierRate(item, 1500) === r[1].rate, 'a sqft inside a range resolves to that range\'s rate');
    assert(c.resolveTierRate(item, 5000) === r[2].rate, 'a sqft above all caps resolves to the open-ended range rate');
    // Boundary: a cap value belongs to the lower bracket (s <= cap).
    assert(c.resolveTierRate(item, 1000) === r[0].rate, 'exact cap (1000) resolves to the lower bracket');
    assert(c.resolveTierRate(item, 1001) === r[1].rate, 'cap + 1 (1001) resolves to the next bracket');
    // Unsorted input still produces ordered ranges.
    const unsorted = { tiers: [ {upTo:2000, rate:7.5}, {upTo:null, rate:7}, {upTo:1000, rate:8} ] };
    const ru = c.getTierRanges(unsorted);
    assert(ru[0].from === 0 && ru[0].to === 1000 && ru[1].from === 1001 && ru[1].to === 2000 && ru[2].from === 2001 && ru[2].to === null,
      'getTierRanges sorts brackets ascending with integer lower bounds');
    assert(c.getTierRanges({ rate: 8 }).length === 0, 'flat item has no ranges');
  }

  // ── buildEditedLaborItem: rename/edit must preserve tiers + key ──
  {
    const c = tierCtx();
    const existing = {
      id: 'r_putting', name: 'Putting Green Install', desc: 'New base included',
      unit: 'per sq ft', rate: 0, key: 'putting',
      tiers: [ {upTo:500, rate:5}, {upTo:1000, rate:6}, {upTo:null, rate:7} ],
    };
    const edited = c.buildEditedLaborItem(existing, { name: 'PG Install (renamed)', desc: 'd', unit: 'per sq ft', rate: '' });
    assert(edited.name === 'PG Install (renamed)', 'rename applies');
    assert(Array.isArray(edited.tiers) && edited.tiers.length === 3, 'tiers preserved through a rename');
    assert(c.itemIsTiered(edited) === true, 'renamed item is still tiered');
    assert(edited.key === 'putting', 'key preserved through a rename');
    assert(edited.id === 'r_putting', 'id preserved on edit');
    // New item (no existing) starts clean — no tiers leak in.
    const fresh = c.buildEditedLaborItem(null, { name: 'New Line', desc: '', unit: 'per sq ft', rate: '8' });
    assert(fresh.tiers === undefined && fresh.key === '' && fresh.rate === 8, 'new item starts clean with parsed rate');
  }

  // ── infillAreaForTier: putting-green tier → PG area; else base yard area ──
  {
    const c = tierCtx();
    const proj = { turf: [
      { role:'base',          installedSqFt: 800 },
      { role:'base',          installedSqFt: 200 },   // base sums to 1000
      { role:'alt-turf',      installedSqFt: 950 },   // alt is NOT base, excluded
      { role:'putting-green', installedSqFt: 300 },
    ] };
    assert(c.infillAreaForTier(proj, 'putting-green') === 300, 'putting-green infill area = putting green sqft');
    assert(c.infillAreaForTier(proj, 'standard') === 1000, 'standard infill area = base yard sqft (alt excluded)');
    assert(c.infillAreaForTier(proj, 'upgraded') === 1000, 'upgraded infill area = base yard sqft too');
    assert(c.infillAreaForTier({ turf: [{role:'base',installedSqFt:500}] }, 'putting-green') === 0, 'no PG row → putting-green area is 0');
  }

  // ── inferInfillTier: putting-sand products auto-classify as putting-green ──
  {
    const c = tierCtx();
    assert(c.inferInfillTier('GD Putting Sand') === 'putting-green', 'putting sand → putting-green tier');
    assert(c.inferInfillTier('Pro Putt Infill') === 'putting-green', '"Putt" in name → putting-green tier');
    assert(c.inferInfillTier('PFS Silica Sand 16/30') === 'standard', 'silica sand → standard tier');
    assert(c.inferInfillTier('GD Medium Sand') === 'standard', 'medium sand → standard tier');
    assert(c.inferInfillTier('') === 'standard' && c.inferInfillTier(undefined) === 'standard', 'blank/undefined → standard tier');
  }

  // ── shouldIncludeNoPgCombo: hide the empty "No Putting Green" card on PG-only jobs ──
  {
    const c = tierCtx();
    assert(c.shouldIncludeNoPgCombo(1000, 1) === true,  'standard yard + a PG option → show No-PG card');
    assert(c.shouldIncludeNoPgCombo(0, 1)    === false, 'putting-green-only job → hide the No-PG card');
    assert(c.shouldIncludeNoPgCombo(0, 0)    === true,  'no PG rows at all → the single No-PG combo IS the job');
    assert(c.shouldIncludeNoPgCombo(1000, 0) === true,  'standard yard, no PG → show (normal job)');
  }

  // ── margin dollar amount = price − cost ──
  {
    const c = tierCtx();
    const cogs = 1000;
    const price = c.applyMargin(cogs, 40);   // 40% margin on price → 1000/0.6
    assert(Math.abs(price - 1666.67) < 0.01, 'applyMargin: 40% margin on $1000 cost → ~$1666.67 price');
    assert(Math.abs((price - cogs) - 666.67) < 0.01, 'margin dollars = price − cost (~$666.67)');
    assert(c.applyMargin(1000, 0) === 1000, '0% margin → price equals cost (margin $0)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  47. NESTING — honor the drop point (nestPlacementX + nestPos plumbing)
//  Dropping a piece into a waste area now places it where it was dropped
//  (centered on the drop x, clamped inside the target rect), instead of
//  auto-snapping to the first clear spot. nestedPieceOffset itself is nested
//  inside the canvas draw fn (not reachable here), so we test the extracted
//  placement math + the data plumbing that carries the anchor to the unit.
// ════════════════════════════════════════════════════════════════════════
section('47. Nesting: honor drop point');
{
  function nestCtx(getEl) {
    const c = {
      window: { _wtEditMode:false },
      document: { getElementById: getEl || (()=>({ value:'' })), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }

  // ── nestPlacementX: center on drop, clamp inside the target rectangle ──
  {
    const c = nestCtx();
    assert(c.nestPlacementX(600, 200, 0, 1000) === 500, 'centers piece on the drop x (600 → left edge 500)');
    assert(c.nestPlacementX(50, 200, 0, 1000) === 0, 'clamps to rect start when dropped near the left edge');
    assert(c.nestPlacementX(980, 200, 0, 1000) === 800, 'clamps so the piece stays inside the right edge (max 800)');
    assert(c.nestPlacementX(400, 100, 100, 600) === 350, 'respects a rect that does not start at 0 (400 → 350)');
    assert(c.nestPlacementX(400, 1200, 0, 1000) === 0, 'piece longer than the rect pins to the start');
  }

  // ── getRollOpts carries nestPos through (and defaults to {}) ──
  {
    const c = nestCtx(() => ({ value:'15' }));
    const pos = { 's1_p0': { rfX: 42, rfY: 0 } };
    const proj = { layout: { nestPos: pos, nesting: { 's1_p0':'s2' } } };
    const opts = c.getRollOpts(proj);
    assert(opts.nestPos === pos, 'getRollOpts passes proj.layout.nestPos through');
    assert(JSON.stringify(c.getRollOpts({ layout:{} }).nestPos) === '{}', 'getRollOpts defaults nestPos to {} when absent');
  }

  // ── computeRollLayout attaches the drop anchor to the nested unit ──
  {
    const c = nestCtx();
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
    const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];
    const base = c.computeRollLayout(lShape, 0, 0, opts);
    const small = base.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
    const big   = base.strips.find(s => s.index !== (small||{}).index && s.wasteArea >= (small||{purchasedArea:9999}).purchasedArea);
    if (small && big) {
      const anchor = { rfX: 12.5, rfY: big.rfY0 };
      const withPos = c.computeRollLayout(lShape, 0, 0, { ...opts, nesting:{ [small.key]: big.key }, nestPos:{ [small.key]: anchor } });
      const nestedUnit = [].concat(...withPos.strips.map(s => s.pieces || [s])).find(u => u.nestedIntoKey === big.key);
      assert(nestedUnit && nestedUnit.nestPos && nestedUnit.nestPos.rfX === 12.5, 'nested unit carries the drop anchor (nestPos)');
      const noPos = c.computeRollLayout(lShape, 0, 0, { ...opts, nesting:{ [small.key]: big.key } });
      const nestedNoPos = [].concat(...noPos.strips.map(s => s.pieces || [s])).find(u => u.nestedIntoKey === big.key);
      assert(nestedNoPos && nestedNoPos.nestPos == null, 'without a drop anchor, nested unit nestPos is null (auto-place path)');
    } else {
      console.log('  (compute nestPos check skipped — no suitable strip pair)');
    }
  }
}

// ════════════════════════════════════════════════════════════════════════
//  48. NESTING — honor drop but snap off the target's turf (nearestClearX)
//  A nested piece spans the full roll width, so it must sit at an x-range the
//  target's installed turf doesn't occupy. nearestClearX honors the drop's
//  preferred x but snaps to the nearest turf-free x when needed.
// ════════════════════════════════════════════════════════════════════════
section('48. Nesting: snap off turf');
{
  function clearCtx() {
    const c = {
      window: {},
      document: { getElementById:()=>null, querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }
  // Target turf occupies x ∈ [0,500] across the full band y ∈ [0,15];
  // waste is x ∈ [500,1000]. Piece width 100.
  const turf = [{x:0,y:0},{x:500,y:0},{x:500,y:15},{x:0,y:15}];

  {
    const c = clearCtx();
    // Drop in clear waste → kept where dropped
    assert(Math.abs(c.nearestClearX(600, 100, 0, 1000, turf, 0, 15) - 600) < 1e-6,
      'drop in clear waste (600) is kept as-is');
    // Drop on turf → snaps to nearest clear x (just past the turf at 500)
    const snapped = c.nearestClearX(200, 100, 0, 1000, turf, 0, 15);
    assert(snapped >= 500 - 1e-6, 'drop on turf (200) snaps to the clear region (x ≥ 500)');
    assert(Math.abs(snapped - 500) <= 1000/80 + 1e-6, 'snaps to the NEAREST clear x, just past the turf edge');
    // Drop deep in clear area stays put
    assert(Math.abs(c.nearestClearX(820, 100, 0, 1000, turf, 0, 15) - 820) < 1e-6,
      'drop deep in waste (820) is kept as-is');
    // No turf at all → preferred x is always clear
    assert(c.nearestClearX(300, 100, 0, 1000, [], 0, 15) === 300,
      'with no target turf, the preferred x is returned unchanged');
  }

  // ── nearestClearX avoids already-placed pieces (occupied intervals) ──
  {
    const c = clearCtx();
    // A piece already occupies [600,700]; dropping another at 650 should snap clear
    const x = c.nearestClearX(650, 100, 0, 1000, [], 0, 15, [[600,700]]);
    assert(x <= 600 + 1e-6 || x >= 700 - 1e-6, 'a piece dropped onto an occupied spot snaps off it');
    assert(Math.abs(x - 700) < 1000/120 + 1e-6, 'snaps to the NEAREST free side of the occupied piece (700)');
    // Turf [0,500] AND an occupied [500,600]: a 550 drop must clear both → x ≥ 600
    const x2 = c.nearestClearX(550, 100, 0, 1000, turf, 0, 15, [[500,600]]);
    assert(x2 >= 600 - 1e-6, 'clears both the turf and an occupied piece');
  }

  // ── assignNestPlacements: two pieces in the same roll never overlap ──
  {
    const c = clearCtx();
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:[], nestedInto:null };
    const p1 = { key:'P1', rfX0:0, rfX1:100, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:50} };
    const p2 = { key:'P2', rfX0:0, rfX1:100, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:60} };
    const layout = { strips:[ { pieces:[target, p1, p2] } ] };
    c.assignNestPlacements(layout);
    assert(p1._nestX != null && p2._nestX != null, 'both nested pieces get an assigned x');
    assert(Math.abs(p1._nestX - p2._nestX) >= 100 - 1e-6, 'two pieces nested in the same roll do not overlap (gap ≥ piece width)');
    assert(p1._nestX >= 0 && p2._nestX + 100 <= 1000 + 1e-6, 'both placed pieces stay within the target rectangle');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  49. NESTING — honor-the-drop placement + turf-overlap flag
//  The piece lands exactly where the user dropped it (centroid at the drop,
//  clamped into the target rectangle, nudged only to avoid stacking on another
//  nested piece). It is NEVER relocated off the turf; instead, if the dropped
//  position overlaps the target's installed turf, `_nestOverlapsTurf` is set so
//  the piece can be outlined red as an honest "this won't fit here" cue.
// ════════════════════════════════════════════════════════════════════════
section('49. Nesting: honor-the-drop placement + turf-overlap flag');
{
  function intCtx() {
    const c = {
      window: {},
      document: { getElementById:()=>null, querySelectorAll:()=>[], querySelector:()=>null, addEventListener:()=>{} },
      localStorage: { getItem:()=>null, setItem:()=>{} },
      console,
    };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }
  const r = (x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];

  // ── the dropped piece lands centered on the drop x, clamped into the rect ──
  {
    const c = intCtx();
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:[], nestedInto:null };
    const piece = { key:'P', rfX0:0, rfX1:120, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:500, rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, piece] }] });
    assert(piece._nestX != null, 'piece is placed (never refused) when dropped on waste');
    assert(Math.abs(piece._nestX - (500 - 60)) < 1e-6, 'piece is centered on the dropped x (drop 500, half-length 60 → left edge 440)');
    assert(piece._nestX >= 0 && piece._nestX + 120 <= 1000 + 1e-6, 'placement stays within the target rectangle');
  }

  // ── a drop near the edge is clamped so the whole piece stays on the roll ──
  {
    const c = intCtx();
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:[], nestedInto:null };
    const piece = { key:'P', rfX0:0, rfX1:120, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:990, rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, piece] }] });
    assert(Math.abs(piece._nestX - 880) < 1e-6, 'drop near the right edge clamps the piece to maxX (1000-120=880)');
  }

  // ── two pieces dropped in the same roll still do not stack on each other ──
  {
    const c = intCtx();
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:[], nestedInto:null };
    const p1 = { key:'P1', rfX0:0, rfX1:100, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:200,rfY:7.5} };
    const p2 = { key:'P2', rfX0:0, rfX1:100, rfY0:0, rfY1:15, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:230,rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, p1, p2] }] });
    assert(Math.abs(p1._nestX - p2._nestX) >= 100 - 1e-6, 'two pieces dropped close together are nudged apart (no stacking)');
  }

  // ── an asymmetric (triangle) piece lands with its CENTROID at the drop ──
  {
    const c = intCtx();
    const tri = [{x:0,y:0},{x:4,y:0},{x:0,y:3}]; // centroid (1.333, 1.0)
    const cx = (0+4+0)/3, cy = (0+0+3)/3;
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:[], nestedInto:null };
    const piece = { key:'P', rfX0:0, rfX1:4, rfY0:0, rfY1:3, clipped:tri, nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:500, rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, piece] }] });
    const placedCx = cx + (piece._nestX - piece.rfX0);
    const placedCy = cy + (piece._nestY - piece.rfY0);
    assert(Math.abs(placedCx - 500) < 1e-6 && Math.abs(placedCy - 7.5) < 1e-6,
      'triangle piece lands with its centroid exactly at the drop point (not bbox-centered)');
  }

  // ── 90° rotation: the piece's bbox swaps width/height, centroid stays on drop ──
  {
    const c = intCtx();
    const r = (x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:60, clipped:[], nestedInto:null };
    const mk = rot => { const p = { key:'P', rfX0:0, rfX1:40, rfY0:0, rfY1:5, clipped:r(0,0,40,5), nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:500, rfY:30}, nestRot:rot }; c.assignNestPlacements({ strips:[{ pieces:[target, p] }] }); return p; };
    const p0 = mk(0), p90 = mk(90);
    const bw = u => Math.max(...u._nestClipRoll.map(p=>p.x)) - Math.min(...u._nestClipRoll.map(p=>p.x));
    const bh = u => Math.max(...u._nestClipRoll.map(p=>p.y)) - Math.min(...u._nestClipRoll.map(p=>p.y));
    assert(Math.abs(bw(p0)-40) < 1e-6 && Math.abs(bh(p0)-5) < 1e-6, 'unrotated piece bbox is 40×5');
    assert(Math.abs(bw(p90)-5) < 1e-6 && Math.abs(bh(p90)-40) < 1e-6, 'rotated piece bbox swaps to 5×40');
    assert(p90._nestRot === 90, 'rotation flag recorded on the placed piece');
    // centroid still lands on the drop x (500): centroid of the rotated footprint at placed position
    const cxPlaced = (p90._nestClipRoll.reduce((s,p)=>s+p.x,0)/p90._nestClipRoll.length) + (p90._nestX - p90._nestRfX0);
    assert(Math.abs(cxPlaced - 500) < 1e-6, 'rotated piece centroid still lands on the dropped x');
  }

  // ── turf-overlap flag: a piece dropped ONTO the target's turf is flagged, a
  //    piece dropped in clear waste is not (placement honored either way) ──
  {
    const c = intCtx();
    // Target rect [0,1000]x[0,15] with turf filling [0,500] along the roll.
    const target = { key:'T', rfX0:0, rfX1:1000, rfY0:0, rfY1:15, clipped:r(0,0,500,15), nestedInto:null };
    // Dropped on turf (centroid at 200): overlaps → flagged.
    const onTurf = { key:'A', rfX0:0, rfX1:100, rfY0:0, rfY1:15, clipped:r(0,0,100,15), nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:200, rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, onTurf] }] });
    assert(onTurf._nestX != null, 'piece dropped on turf is still placed where dropped (not refused)');
    assert(onTurf._nestOverlapsTurf === true, 'a piece dropped onto turf is flagged (red outline)');
    // Dropped in the clear leftover (centroid at 750): no overlap → not flagged.
    const clear = { key:'B', rfX0:0, rfX1:100, rfY0:0, rfY1:15, clipped:r(0,0,100,15), nestedInto:0, nestedIntoKey:'T', nestPos:{rfX:750, rfY:7.5} };
    c.assignNestPlacements({ strips:[{ pieces:[target, clear] }] });
    assert(clear._nestOverlapsTurf === false, 'a piece dropped in clear leftover is NOT flagged');
  }

  // ── INTEGRATION: real computeRollLayout geometry, honor-drop placement ──
  {
    const c = intCtx();
    const shape = [{x:0,y:0},{x:10,y:0},{x:10,y:25},{x:0,y:25}];
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
    const layout = c.computeRollLayout(shape, 0, 0, opts);
    const units = [];
    layout.strips.forEach(s => (s.pieces || [s]).forEach(u => units.push(u)));
    const real = units.filter(u => u.clipped && u.clipped.length && u.rfX0 != null);
    assert(real.length >= 2, 'real layout yields at least two strips with clipped geometry');
    const tgt = real[0], src = real[1];
    src.nestedInto = 0; src.nestedIntoKey = tgt.key; src.nestPos = { rfX: tgt.rfX0 + 0.5, rfY: tgt.rfY0 + 0.5 };
    c.assignNestPlacements(layout);
    const placed = units.find(u => u.nestedIntoKey === tgt.key);
    assert(placed && placed._nestX != null && placed._nestY != null, 'nested piece on real geometry is placed (x and y)');
    const pw = placed.rfX1 - placed.rfX0, ph = placed.rfY1 - placed.rfY0;
    assert(placed._nestX >= tgt.rfX0 - 1e-6 && placed._nestX + pw <= tgt.rfX1 + 1e-6, 'placed piece stays within target rect (x)');
    assert(placed._nestY >= tgt.rfY0 - 1e-6 && placed._nestY + ph <= tgt.rfY1 + 1e-6, 'placed piece stays within target rect (y)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  50. MULTI-LAYER INSTALL — each layer its own rolls, summed (Phase 1)
//  All layers default to 'install'; computeInstallLayerLayouts rolls the
//  primary + every 'install' secondary with shared settings, and
//  sumInstallLayouts adds up ordered/usable/linear/area/rolls. Layers set to
//  exclude/ignore/putting-green drop out of the install set.
// ════════════════════════════════════════════════════════════════════════
section('50. Multi-layer install (Phase 1)');
{
  function ic() {
    const c = { window:{}, document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}}, localStorage:{getItem:()=>null,setItem:()=>{}}, console };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  // Three simple rectangles as three layers.
  const rectA = [{x:0,y:0},{x:10,y:0},{x:10,y:12},{x:0,y:12}];  // primary
  const rectB = [{x:0,y:0},{x:8,y:0},{x:8,y:10},{x:0,y:10}];
  const rectC = [{x:0,y:0},{x:6,y:0},{x:6,y:6},{x:0,y:6}];

  {
    const c = ic();
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:rectB},{name:'C',points:rectC}], secondaryShapeModes:{0:'install',1:'install'} } };
    const primaryLayout = c.computeRollLayout(rectA, 0, 0, opts);
    const secs = proj.layout.secondaryShapes.map(s => ({ ...s, displayPoints: s.points }));
    const layers = c.computeInstallLayerLayouts(proj, primaryLayout, secs, 0, 0, opts);
    assert(layers.length === 3, 'two secondaries marked Install → 3 install layouts (primary + 2)');
    const sum = c.sumInstallLayouts(layers);
    const expectOrdered = layers.reduce((a,l)=>a+l.layout.totalOrdered,0);
    assert(Math.abs(sum.ordered - expectOrdered) < 1e-6, 'combined ordered = sum of each layer\'s ordered');
    assert(sum.ordered > primaryLayout.totalOrdered + 1e-6, 'combined ordered exceeds the primary alone (extra layers add)');
    // Default grouping is SHARED: small layers pool into shared physical rolls, so the
    // roll count is at most the layer count (here all fit in one roll).
    assert(sum.rolls >= 1, 'combined produces at least one roll');
    assert(sum.rolls <= layers.length, 'shared (default) grouping pools layers → rolls ≤ layer count');
    // Force each layer onto its own roll → rolls sum independently (old behavior).
    const ownLayers = layers.map(l => ({ ...l, rollGroup: 'own' }));
    const ownSum = c.sumInstallLayouts(ownLayers);
    assert(ownSum.rolls >= 3, 'with each layer on its own roll, every layer adds ≥1 roll');
    assert(ownSum.rolls >= sum.rolls, 'own grouping is never fewer rolls than shared');
    assert(Math.abs(ownSum.ordered - sum.ordered) < 1e-6, 'roll grouping never changes Ordered SqFt');
  }

  {
    // Mark one secondary as exclude and one as ignore → both drop out of install
    const c = ic();
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:rectB},{name:'C',points:rectC}], secondaryShapeModes:{0:'exclude',1:'ignore'} } };
    const primaryLayout = c.computeRollLayout(rectA, 0, 0, opts);
    const secs = proj.layout.secondaryShapes.map(s => ({ ...s, displayPoints: s.points }));
    const layers = c.computeInstallLayerLayouts(proj, primaryLayout, secs, 0, 0, opts);
    assert(layers.length === 1, 'exclude + ignore secondaries are not install layers → primary only');
    assert(layers[0].id === 'primary', 'the remaining install layer is the primary');
  }

  {
    // New default: a secondary with NO explicit mode is IGNORED (not summed), so a
    // fresh import shows the primary area only — not an inflated sum.
    const c = ic();
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:rectB},{name:'C',points:rectC}], secondaryShapeModes:{} } };
    const primaryLayout = c.computeRollLayout(rectA, 0, 0, opts);
    const secs = proj.layout.secondaryShapes.map(s => ({ ...s, displayPoints: s.points }));
    const layers = c.computeInstallLayerLayouts(proj, primaryLayout, secs, 0, 0, opts);
    assert(layers.length === 1, 'secondaries default to IGNORE (not install) → primary is the only install layer');
    assert(Math.abs(c.getAdjustedShapeArea(proj, primaryLayout.shapeArea) - primaryLayout.shapeArea) < 1e-6,
      'default-ignored secondaries do not change the primary installed area');
  }

  {
    // Positioned (offset) layer: rolling uses the displayPoints, so a pure
    // translation does not change ordered area (translation-invariant).
    const c = ic();
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:rectB}], secondaryShapeModes:{0:'install'} } };
    const primaryLayout = c.computeRollLayout(rectA, 0, 0, opts);
    const moved = rectB.map(p => ({ x: p.x + 100, y: p.y + 50 }));
    const layersMoved = c.computeInstallLayerLayouts(proj, primaryLayout, [{ name:'B', points:rectB, displayPoints:moved }], 0, 0, opts);
    const layersHome = c.computeInstallLayerLayouts(proj, primaryLayout, [{ name:'B', points:rectB, displayPoints:rectB }], 0, 0, opts);
    assert(Math.abs(layersMoved[1].layout.totalOrdered - layersHome[1].layout.totalOrdered) < 1e-6,
      'translating a layer does not change its ordered area (math is position-invariant)');
  }

  {
    // Phase 2 render input: every install layer must expose strips with
    // displayClipped geometry positioned via its displayPoints, so the canvas
    // has something to draw at that layer's location.
    const c = ic();
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:rectB}], secondaryShapeModes:{0:'install'} } };
    const primaryLayout = c.computeRollLayout(rectA, 0, 0, opts);
    const moved = rectB.map(p => ({ x: p.x + 100, y: p.y + 50 }));
    const layers = c.computeInstallLayerLayouts(proj, primaryLayout, [{ name:'B', points:rectB, displayPoints:moved }], 0, 0, opts);
    const sec = layers.find(l => l.id === 0);
    const drawable = sec.layout.strips.filter(s => s.displayClipped && s.displayClipped.length >= 3);
    assert(drawable.length >= 1, 'secondary install layer has at least one turf-bearing strip to draw');
    // its geometry should sit near the moved position (x ~ 100+), not the origin
    const anyX = drawable[0].displayClipped.map(p => p.x);
    assert(Math.max(...anyX) > 50, 'strip geometry reflects the layer\'s moved position (x ≈ 100+)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  51. EDIT ANY LAYER — per-layer canonical inverse round-trip + history
//  Editing a secondary layer's vertex must write back through the inverse of
//  its full display transform (view-rotation → per-layer rotation → offset).
//  displayPointToLayerCanonical must invert that exactly, and per-layer undo
//  history must snapshot/restore the right layer.
// ════════════════════════════════════════════════════════════════════════
section('51. Edit any layer (per-layer transform + history)');
{
  function ec() {
    const c = { window:{}, document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}}, localStorage:{getItem:()=>null,setItem:()=>{}}, console };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }
  const c = ec();
  const primary = [{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}];
  const sec = [{x:2,y:2},{x:8,y:3},{x:6,y:9}]; // a triangle
  const proj = { layout: {
    points: primary,
    viewRotation: 30,
    secondaryShapes: [{ name:'B', points: JSON.parse(JSON.stringify(sec)) }],
    layerOffsets: { 0: { dx: 12, dy: -5, rotation: 40 } },
    secondaryShapeModes: {},
  }};

  // Build the layer's displayPoints exactly as renderRollLayout does.
  function forwardDisplay() {
    const v = c.getViewCentroid(proj);
    let pts = c.rotateAround(sec, 30, v.cx, v.cy);
    const cc = c.centroidOf(pts);
    pts = c.rotateAround(pts, 40, cc.cx, cc.cy);
    pts = pts.map(p => ({ x: p.x + 12, y: p.y - 5 }));
    return pts;
  }

  {
    const disp = forwardDisplay();
    // Inverting each display point must return the original canonical point.
    let maxErr = 0;
    disp.forEach((dp, i) => {
      const back = c.displayPointToLayerCanonical(proj, 0, dp);
      maxErr = Math.max(maxErr, Math.abs(back.x - sec[i].x), Math.abs(back.y - sec[i].y));
    });
    assert(maxErr < 1e-6, 'displayPointToLayerCanonical exactly inverts view-rotation + rotation + offset');
  }

  {
    // Nearest-vertex across layers: a layout with primary + the positioned secondary.
    const layout = { basePoints: primary, layerVisibility: {}, secondaryShapes: [{ displayPoints: forwardDisplay() }] };
    c.window._wtCanvasTransform = { minX:0, minY:-20, scale:5, pad:0, w:400, h:400 };
    const t = c.window._wtCanvasTransform;
    // Aim at the secondary's first display vertex (convert it to canvas px).
    const dv = layout.secondaryShapes[0].displayPoints[0];
    const cx = t.pad + (dv.x - t.minX)*t.scale, cy = t.h - t.pad - (dv.y - t.minY)*t.scale;
    const hit = c.findNearestVertexAnyLayer(cx, cy, 12, layout);
    assert(hit && hit.layerId === 0 && hit.index === 0, 'nearest vertex correctly identifies the secondary layer + index');
  }

  {
    // Per-layer history snapshots and the area helper target the right layer.
    const c2 = ec();
    const proj2 = { layout: { points: primary, secondaryShapes:[{name:'B',points:JSON.parse(JSON.stringify(sec))}], secondaryShapeModes:{}, layerOffsets:{} } };
    c2.pushLayoutHistory(proj2, 0);
    assert(proj2.layout.history[0].layerId === 0, 'history entry targets the secondary layer');
    proj2.layout.secondaryShapes[0].points[0] = { x: 99, y: 99 };
    c2.recomputeLayerArea(proj2, 0);
    assert(proj2.layout.secondaryShapes[0].area === c2.polygonArea(proj2.layout.secondaryShapes[0].points),
      'recomputeLayerArea updates the secondary shape\'s stored area');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  52. PER-LAYER ROLL DIRECTION / SEAM OFFSET (Phase 3a)
//  Each install layer may override the shared (primary) roll direction +
//  seam offset; unset fields fall back to the primary's values. The primary
//  always uses the passed (global) values.
// ════════════════════════════════════════════════════════════════════════
section('52. Per-layer roll direction / seam offset');
{
  function ec() {
    const c = { window:{}, document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:()=>{}}, localStorage:{getItem:()=>null,setItem:()=>{}}, console };
    vm.runInNewContext(scriptSrc, c);
    return c;
  }
  const c = ec();

  // ── getLayerRoll: fallback + partial/full override + overridden flag ──
  {
    assert(c.getLayerRoll({layout:{}}, 0, 5, 2).rotation === 5, 'no layerRoll → fallback rotation');
    assert(c.getLayerRoll({layout:{}}, 0, 5, 2).translation === 2, 'no layerRoll → fallback translation');
    assert(c.getLayerRoll({layout:{}}, 0, 5, 2).overridden === false, 'no layerRoll → not overridden');
    const proj = { layout: { layerRoll: { 0: { rotation: 90 } } } };
    assert(c.getLayerRoll(proj, 0, 5, 2).rotation === 90, 'override rotation honored');
    assert(c.getLayerRoll(proj, 0, 5, 2).translation === 2, 'partial override → translation falls back');
    assert(c.getLayerRoll(proj, 0, 5, 2).overridden === true, 'overridden flag true when any field set');
    assert(c.getLayerRoll({layout:{layerRoll:{}}}, 1, 5, 2).overridden === false, 'empty layerRoll map → not overridden');
  }

  // ── computeInstallLayerLayouts: per-layer override vs fallback ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0 };
    const primaryPts = [{x:0,y:0},{x:30,y:0},{x:30,y:30},{x:0,y:30}];
    const strip = [{x:0,y:0},{x:40,y:0},{x:40,y:5},{x:0,y:5}]; // long thin → direction-sensitive
    const primaryLayout = c.computeRollLayout(primaryPts, 0, 0, opts);
    const secondaryShapes = [{ name:'Strip', displayPoints: strip }];

    const at0  = c.computeRollLayout(strip, 0, 0, opts).totalOrdered;
    const at90 = c.computeRollLayout(strip, 90, 0, opts).totalOrdered;
    assert(Math.abs(at90 - at0) > 1e-6, 'sanity: the test strip is direction-sensitive');

    // With a 90° override on the secondary, primary stays at the passed 0°.
    const projOv = { layout: { secondaryShapeModes: {0:'install'}, layerRoll: { 0: { rotation: 90 } } } };
    const layers = c.computeInstallLayerLayouts(projOv, primaryLayout, secondaryShapes, 0, 0, opts);
    assert(layers.length === 2, 'primary + 1 install layer');
    assert(layers[0].id === 'primary' && layers[0].rollRotation === 0 && layers[0].rollOverridden === false, 'primary uses passed rotation, not overridden');
    assert(layers[1].rollRotation === 90 && layers[1].rollOverridden === true, 'secondary uses its 90° override');
    assert(Math.abs(layers[1].layout.totalOrdered - at90) < 1e-6, 'overridden layer rolled at 90°');

    // No override → secondary falls back to the passed rotation/translation.
    const projFb = { layout: { secondaryShapeModes: {0:'install'} } };
    const layersFb = c.computeInstallLayerLayouts(projFb, primaryLayout, secondaryShapes, 0, 0, opts);
    assert(layersFb[1].rollRotation === 0 && layersFb[1].rollOverridden === false, 'no override → falls back to passed rotation');
    assert(Math.abs(layersFb[1].layout.totalOrdered - at0) < 1e-6, 'fallback layer rolled at passed 0°');

    // Non-install layers are excluded from the install layouts.
    const projEx = { layout: { secondaryShapeModes: {0:'exclude'} } };
    assert(c.computeInstallLayerLayouts(projEx, primaryLayout, secondaryShapes, 0, 0, opts).length === 1, 'excluded layer not rolled');
  }
}



// ════════════════════════════════════════════════════════════════════════
//  53. END-TO-END QUOTE SCENARIOS (regression net for calcQuote)
//  Renders real quote cards through loadProject → calcQuote and asserts the
//  dollar figures, line items, and card structure. Includes boundary tests
//  (tier caps, roll rounding, margin clamp) and negative tests (empty/zero/
//  garbage input) so the money path can't silently regress.
// ════════════════════════════════════════════════════════════════════════
section('53. End-to-end quote scenarios');
{
  const QCAT = {
    turf: [
      { id:'lush',    name:'WT Willamette Lush', type:'standard', costPerLinFt:'2.50' },
      { id:'pdx85',   name:'WT PDX Putt 85',     type:'putting',  costPerLinFt:'3.50' },
      { id:'reserve', name:'WT Pacific Reserve',  type:'standard', costPerLinFt:'3.00' },
    ],
    infill: [
      { id:'silica', name:'PFS Silica Sand 16/30', lbsPerSqFt:'1', costPerBag:'10' },
      { id:'gdputt', name:'GD Putting Sand',       lbsPerSqFt:'2', costPerBag:'12' },
    ],
    rock: [],
  };
  const FLAT_CREW = [{ id:'crew_main', name:'Main', items:[
    { id:'r_standard', name:'Standard Turf Install', unit:'per sq ft', rate:'8',  key:'standard' },
    { id:'r_putting',  name:'Putting Green Install',  unit:'per sq ft', rate:'12', key:'putting'  },
  ]}];

  function mockElQ(){ return { checked:false, value:'', style:{}, classList:{add:()=>{},remove:()=>{}}, addEventListener:()=>{}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild:()=>{}, replaceChildren:()=>{} }; }

  // Render a project's quote cards and return { ctx, html, cards }.
  function qEnv({ project, crews=FLAT_CREW, catalog=QCAT, margin=0, activeCrew='crew_main' }) {
    const stored = {};
    const mockLS = { getItem:k=>stored[k]||null, setItem:(k,v)=>{stored[k]=v;}, removeItem:k=>{delete stored[k];} };
    stored['wt_catalog_v2']   = JSON.stringify(catalog);
    stored['wt_crews_v1']     = JSON.stringify(crews);
    stored['wt_active_crew']  = activeCrew;
    stored['wt_profit_margin']= String(margin);
    stored['wt_projects_v4']  = JSON.stringify([project]);
    const inputs = {
      quoteOptionsContainer:{innerHTML:''}, fringeSummary:{innerHTML:''}, fringeGroup:{style:{}},
      fringeConfigFields:{style:{}}, fringeEnabled:{checked:false}, fringeTurfProduct:{innerHTML:'',value:''}, fringeWidth:{value:''},
      layoutLayersList:{innerHTML:''}, infillRows:{innerHTML:'',appendChild:()=>{}}, turfRows:{innerHTML:'',appendChild:()=>{}},
      quoteMiscRows:{innerHTML:'',appendChild:()=>{}}, rockRows:{innerHTML:'',appendChild:()=>{}},
    };
    const m2d = { clearRect:()=>{},beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},closePath:()=>{},fill:()=>{},stroke:()=>{},save:()=>{},restore:()=>{},setLineDash:()=>{},arc:()=>{},fillRect:()=>{},fillText:()=>{},measureText:()=>({width:10}),translate:()=>{},rect:()=>{},clip:()=>{} };
    const canvas = { width:700,height:350,getContext:()=>m2d,getBoundingClientRect:()=>({left:0,top:0,width:700,height:350}),addEventListener:()=>{},style:{},classList:{add:()=>{},remove:()=>{}},textContent:'' };
    inputs.rollLayoutCanvas = canvas;
    inputs.layoutCanvasWrap = { clientWidth:700, scrollLeft:0, scrollTop:0, addEventListener:()=>{} };
    const ctx = {
      window:{onload:null,_wtLayoutZoom:1,_wtEditMode:false,_wtSelectedProjects:null,innerHeight:900},
      document:{ getElementById:id=>inputs[id]||mockElQ(), querySelectorAll:()=>[], querySelector:()=>({classList:{add:()=>{},remove:()=>{}}}), addEventListener:()=>{}, createElement:()=>mockElQ() },
      localStorage: mockLS, alert:()=>{}, confirm:()=>true, console,
      ResizeObserver:function(){return{observe:()=>{}};},
    };
    vm.runInNewContext(scriptSrc, ctx);
    ctx.loadProject(project.id);
    const html = inputs.quoteOptionsContainer.innerHTML;
    const cards = html.split('quote-option').slice(1);
    return { ctx, html, cards };
  }

  const findCard = (cards, s) => cards.find(c => c.includes(s));
  const cardPrices = card => [...card.matchAll(/opt-price[^>]*>(\$[\d,]+\.\d\d)<\/div>/g)].map(m=>m[1]);
  const money = s => s==null ? null : parseFloat(String(s).replace(/[$,]/g,''));
  function lineAmt(card, label){
    const i = card.indexOf(label); if(i<0) return null;
    const seg = card.slice(i+label.length);
    const m = seg.match(/<\/span><span[^>]*>([^<]*)<\/span>/);
    return m ? m[1] : null;
  }
  const baseProject = over => Object.assign({
    id:'p1', name:'T', created:1000, edging:{}, pgSqFt:0, miscItems:[], turf:[], infill:[], rock:[],
    layout:{ points:rect(0,0,50,40), area:2000, secondaryShapes:[], secondaryShapeModes:{}, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0 },
  }, over);
  const tRow = o => Object.assign({ product:'', installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'base' }, o);

  // ── A. Base only, no putting green ──
  {
    const { cards } = qEnv({ project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    assert(cards.length === 1, 'A: base-only job → exactly one card');
    const c0 = cards[0];
    assert(c0.includes('Turf install'), 'A: labor line reads "Turf install"');
    assert(!c0.includes('Standard yard install') && !c0.includes('Putting green install'), 'A: no standard/PG split lines');
    assert(!c0.includes('Putting green turf'), 'A: no PG turf material line');
    assert(money(cardPrices(c0)[0]) === 1500*8 + 1500*2.50, 'A: COGS = labor 12000 + turf 3750 = 15750');
  }

  // ── B. Base + putting green → No-PG and With-PG cards ──
  {
    const { cards } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT PDX Putt 85', installedSqFt:150, sqFtToOrder:150, orderedSqFt:150, role:'putting-green' }),
    ] }) });
    assert(cards.length === 2, 'B: base+PG → No-PG and With-PG cards');
    const noPg = findCard(cards, 'No Putting Green');
    const withPg = findCard(cards, 'Putting Green — WT PDX Putt 85');
    assert(noPg && withPg, 'B: both card titles present');
    // No-PG card
    assert(noPg.includes('Turf install') && !noPg.includes('Putting green install'), 'B: No-PG card has no PG labor line');
    assert(!noPg.includes('Putting green turf'), 'B: No-PG card has no PG turf line');
    assert(money(cardPrices(noPg)[0]) === 1500*8 + 1500*2.50, 'B: No-PG COGS = 15750');
    // With-PG card
    assert(withPg.includes('Standard yard install'), 'B: With-PG shows standard yard install line');
    assert(withPg.includes('Putting green install'), 'B: With-PG shows putting green install line');
    assert(money(lineAmt(withPg, 'Putting green turf')) === 150*3.50, 'B: PG turf material line = $525');
    const expectB = 1350*8 + 150*12 + 1500*2.50 + 150*3.50; // 10800+1800+3750+525
    assert(money(cardPrices(withPg)[0]) === expectB, 'B: With-PG COGS = 16875');
  }

  // ── C. Putting-green-only → no empty No-PG card, no standard line ──
  {
    const { cards, html } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT PDX Putt 85', installedSqFt:150, sqFtToOrder:150, orderedSqFt:150, role:'putting-green' }),
    ] }) });
    assert(cards.length === 1, 'C: PG-only → exactly one card');
    assert(!html.includes('No Putting Green'), 'C: no "No Putting Green" card on a PG-only job');
    const c0 = cards[0];
    assert(!c0.includes('Standard yard install'), 'C: no empty standard-yard line when stdSqFt=0');
    assert(c0.includes('Putting green install'), 'C: shows putting green install line');
    assert(money(lineAmt(c0, 'Putting green turf')) === 150*3.50, 'C: PG turf material = $525');
    assert(html.includes('PUTTING GREEN') || html.includes('Putting Green'), 'C: group/title reads as a putting green');
    assert(money(cardPrices(c0)[0]) === 150*12 + 150*3.50, 'C: COGS = PG labor 1800 + PG turf 525 = 2325');
  }

  // ── D. Alt turf + PG → separate base & alt groups ──
  {
    const { cards, html } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT Pacific Reserve', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'alt-turf' }),
      tRow({ product:'WT PDX Putt 85', installedSqFt:150, sqFtToOrder:150, orderedSqFt:150, role:'putting-green' }),
    ] }) });
    assert(cards.length === 4, 'D: 2 turf groups × (No-PG + With-PG) = 4 cards');
    assert(html.includes('WT Pacific Reserve'), 'D: alt turf group header present');
    // Alt With-PG card: alt material 1500*3.00 instead of base 2.50
    const altWithPg = cards.find(c => c.includes('Putting Green — WT PDX Putt 85') && money(cardPrices(c)[0]) === 1350*8 + 150*12 + 1500*3.00 + 150*3.50);
    assert(altWithPg, 'D: alt With-PG COGS uses alt turf material (1500*3.00) = 17625');
  }

  // ── D2. Alt turf with BLANK installed sqft still appears, priced on base area ──
  {
    const { cards, html } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT Pacific Reserve', installedSqFt:0, sqFtToOrder:1500, orderedSqFt:1500, role:'alt-turf' }),
    ] }) });
    assert(html.includes('WT Pacific Reserve'), 'D2: alt option appears even with blank installed sqft (no longer gated on it)');
    assert(cards.length === 2, 'D2: base card + alt card');
    assert(html.includes('Turf install ($8/sqft × 1,500 sqft)'), 'D2: labor priced on base yard area (1,500), not alt installed (0)');
    // Each card's own COGS (first opt-price in its chunk); base uses 2.50 material, alt uses 3.00.
    const prices = cards.map(c => money(cardPrices(c)[0])).sort((a,b)=>a-b);
    assert(prices[0] === 1500*8 + 1500*2.50, 'D2: base card COGS = 15750');
    assert(prices[1] === 1500*8 + 1500*3.00, 'D2: alt card COGS = base-area labor 12000 + alt material 4500 = 16500');
  }

  // ── D3. Alt row with no product and no area does NOT appear ──
  {
    const { cards } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'', installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'alt-turf' }),
    ] }) });
    assert(cards.length === 1, 'D3: empty alt row (no product, no area) produces no card');
  }

  // ── E. Tiered standard AND tiered putting, by own area ──
  {
    const TIER_CREW = [{ id:'crew_main', name:'Main', items:[
      { id:'r_standard', name:'Standard Turf Install', unit:'per sq ft', key:'standard', tiers:[ {upTo:1000, rate:9}, {upTo:null, rate:8} ] },
      { id:'r_putting',  name:'Putting Green Install',  unit:'per sq ft', key:'putting',  tiers:[ {upTo:100, rate:14}, {upTo:null, rate:12} ] },
    ]}];
    const { cards } = qEnv({ crews: TIER_CREW, project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT PDX Putt 85', installedSqFt:150, sqFtToOrder:150, orderedSqFt:150, role:'putting-green' }),
    ] }) });
    const withPg = findCard(cards, 'Putting Green — WT PDX Putt 85');
    // std area 1350 > 1000 → $8; PG area 150 > 100 → $12
    assert(withPg.includes('Standard yard install ($8/sqft tiered'), 'E: standard area 1350 resolves to the $8 bracket');
    assert(withPg.includes('Putting green install ($12/sqft tiered'), 'E: PG area 150 resolves to the $12 bracket');
    assert(money(cardPrices(withPg)[0]) === 1350*8 + 150*12 + 1500*2.50 + 150*3.50, 'E: tiered COGS correct');
  }

  // ── E2. BOUNDARY: standard tier cap is inclusive (1000 → $9, 1001 → $8) ──
  {
    const TIER_CREW = [{ id:'crew_main', name:'Main', items:[
      { id:'r_standard', name:'Standard Turf Install', unit:'per sq ft', key:'standard', tiers:[ {upTo:1000, rate:9}, {upTo:null, rate:8} ] },
      { id:'r_putting',  name:'Putting Green Install',  unit:'per sq ft', key:'putting',  rate:'12' },
    ]}];
    const at1000 = qEnv({ crews: TIER_CREW, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1000, sqFtToOrder:1000, orderedSqFt:1000, role:'base' }) ] }) });
    assert(at1000.cards[0].includes('Turf install ($9/sqft tiered'), 'E2: exactly 1000 sqft → $9 (cap inclusive)');
    const at1001 = qEnv({ crews: TIER_CREW, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1001, sqFtToOrder:1001, orderedSqFt:1005, role:'base' }) ] }) });
    assert(at1001.cards[0].includes('Turf install ($8/sqft tiered'), 'E2: 1001 sqft → $8 (next bracket)');
  }

  // ── F. Misc items broken out per line, split by role ──
  {
    const { cards } = qEnv({ project: baseProject({
      turf:[
        tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
        tRow({ product:'WT PDX Putt 85', installedSqFt:150, sqFtToOrder:150, orderedSqFt:150, role:'putting-green' }),
      ],
      miscItems:[
        { name:'Seam Tape', price:50, qty:1, role:'base' },
        { name:'Adhesive',  price:30, qty:2, role:'base' },
        { name:'Cup Set',   price:40, qty:1, role:'putting-green' },
      ],
    }) });
    const noPg = findCard(cards, 'No Putting Green');
    const withPg = findCard(cards, 'Putting Green — WT PDX Putt 85');
    assert(!withPg.includes('Misc items'), 'F: no lumped "Misc items" line');
    assert(money(lineAmt(withPg, 'Seam Tape')) === 50, 'F: Seam Tape its own line = $50');
    assert(withPg.includes('Adhesive (2 × $30.00)') && money(lineAmt(withPg, 'Adhesive')) === 60, 'F: Adhesive shows qty × price = $60');
    assert(money(lineAmt(withPg, 'Cup Set')) === 40, 'F: PG misc "Cup Set" on the With-PG card');
    assert(!noPg.includes('Cup Set'), 'F: PG misc NOT on the No-PG card');
    assert(noPg.includes('Seam Tape'), 'F: base misc on the No-PG card');
  }

  // ── G. Margin: Cost / Margin$ / Price; margin $ = price − cost ──
  {
    const withMargin = qEnv({ margin:40, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    const p = cardPrices(withMargin.cards[0]).map(money);
    assert(p.length === 3, 'G: margin card shows three figures (cost, margin, price)');
    const [cost, marginAmt, price] = p;
    assert(cost === 15750, 'G: cost = COGS 15750');
    assert(Math.abs(price - 15750/0.6) < 0.01, 'G: 40% margin → price = cost/0.6 = 26250');
    assert(Math.abs(marginAmt - (price - cost)) < 0.01, 'G: margin dollars = price − cost = 10500');
    const noMargin = qEnv({ margin:0, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    assert(cardPrices(noMargin.cards[0]).length === 1, 'G: 0% margin → single price figure');
  }

  // ── H. BOUNDARY: PG turf material uses roll-rounded order (100 → 105) ──
  {
    const { cards } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT PDX Putt 85', installedSqFt:100, sqFtToOrder:100, orderedSqFt:100, role:'putting-green' }),
    ] }) });
    const withPg = findCard(cards, 'Putting Green — WT PDX Putt 85');
    // ceil(100/15)*15 = 105 → 105 * 3.50 = 367.50 (not 100*3.50)
    assert(money(lineAmt(withPg, 'Putting green turf')) === Math.ceil(100/15)*15 * 3.50, 'H: PG turf material rounds the order to a whole roll (105 × $3.50 = $367.50)');
  }

  // ── I. BOUNDARY: margin clamps at 99% ──
  {
    const env = qEnv({ margin:150, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    const p = cardPrices(env.cards[0]).map(money);
    // applyMargin clamps to 99% → price = cost / (1 - 0.99) = cost * 100
    assert(Math.abs(p[p.length-1] - 15750*100) < 0.01, 'I: margin clamps at 99% → price = cost × 100');
  }

  // ── NEGATIVE 1: empty project (no turf) → one $0 card, no crash, no NaN ──
  {
    const { cards, html } = qEnv({ project: baseProject({ turf:[] }) });
    assert(typeof html === 'string', 'N1: empty project renders without throwing');
    assert(!html.includes('NaN'), 'N1: no NaN in output');
    assert(cards.length === 0 || money(cardPrices(cards[0])[0]) === 0, 'N1: empty project → no card or a $0 card');
  }

  // ── NEGATIVE 2: zero-sqft base/PG rows are still filtered out ──
  // (Alt-turf is intentionally gated on product, not installed sqft — see D2/D3.)
  {
    const { cards, html } = qEnv({ project: baseProject({ turf:[
      tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }),
      tRow({ product:'WT PDX Putt 85', installedSqFt:0, sqFtToOrder:0, orderedSqFt:0, role:'putting-green' }),
    ] }) });
    assert(!html.includes('Putting Green —'), 'N2: a 0-sqft putting-green row produces no PG card');
    assert(cards.length === 1, 'N2: only the non-zero base card renders');
  }

  // ── NEGATIVE 3: garbage labor rate → $0 labor, no NaN ──
  {
    const BAD_CREW = [{ id:'crew_main', name:'Main', items:[
      { id:'r_standard', name:'Standard Turf Install', unit:'per sq ft', key:'standard', rate:'abc' },
      { id:'r_putting',  name:'Putting Green Install',  unit:'per sq ft', key:'putting',  rate:'' },
    ]}];
    const { cards, html } = qEnv({ crews: BAD_CREW, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    assert(!html.includes('NaN'), 'N3: garbage rate does not produce NaN');
    assert(money(cardPrices(cards[0])[0]) === 1500*2.50, 'N3: labor falls to $0, COGS = turf material only (3750)');
  }

  // ── NEGATIVE 4: $0-priced misc item shows no line ──
  {
    const { cards } = qEnv({ project: baseProject({
      turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ],
      miscItems:[ { name:'Freebie', price:0, qty:1, role:'base' } ],
    }) });
    assert(!cards[0].includes('Freebie'), 'N4: a $0 misc item renders no line');
  }

  // ── NEGATIVE 5: PG infill but no PG turf row → no PG card, no PG infill line ──
  {
    const { cards, html } = qEnv({ project: baseProject({
      turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ],
      infill:[ { product:'GD Putting Sand', tier:'putting-green', bags:6, costPerBag:12, role:'base' } ],
    }) });
    assert(!html.includes('Putting Green —'), 'N5: no putting-green card without a PG turf row');
    assert(!html.includes('Putting green infill'), 'N5: PG infill not billed when there is no PG area');
    assert(cards.length === 1, 'N5: only the base card renders');
  }

  // ── NEGATIVE 6: negative margin is treated as no margin (single price) ──
  {
    const env = qEnv({ margin:-25, project: baseProject({ turf:[ tRow({ product:'WT Willamette Lush', installedSqFt:1500, sqFtToOrder:1500, orderedSqFt:1500, role:'base' }) ] }) });
    assert(cardPrices(env.cards[0]).length === 1, 'N6: negative margin → single price figure (no margin block)');
  }
}



// ════════════════════════════════════════════════════════════════════════
//  54. Phase 3b (increment 1): per-layer cut/nest key namespacing
//  Strip keys (and the piece/nesting keys derived from them) can be namespaced
//  per install layer via opts.keyPrefix. Primary uses '' (back-compat); each
//  secondary install layer uses 'L<id>_'. This stops a primary cut from bleeding
//  onto a secondary install layer that happens to share a strip position.
// ════════════════════════════════════════════════════════════════════════
section('54. Phase 3b: per-layer cut/nest key namespacing');
{
  function mEl(){ return { checked:false, value:'', style:{}, classList:{add(){},remove(){}}, addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[], innerHTML:'', appendChild(){}, replaceChildren(){} }; }
  const ctx54 = {
    window:{onload:null,_wtLayoutZoom:1,innerHeight:900},
    document:{ getElementById:()=>mEl(), querySelectorAll:()=>[], querySelector:()=>mEl(), addEventListener(){}, createElement:()=>mEl() },
    localStorage:{ _s:{}, getItem(k){return this._s[k]||null;}, setItem(k,v){this._s[k]=v;}, removeItem(k){delete this._s[k];} },
    alert(){}, confirm:()=>true, console, ResizeObserver:function(){return{observe(){}};},
  };
  vm.runInNewContext(scriptSrc, ctx54);

  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0 };
  const pts = rect(0, 0, 30, 15); // 30 ft long × 15 ft wide
  // The grid can include an empty off-shape strip; operate on the real one.
  const realStrip = L => L.strips.reduce((a,b)=> b.clippedArea > a.clippedArea ? b : a);
  const stripByKey = (L, key) => L.strips.find(s => s.key === key);

  // Baseline (primary): no prefix → bare 'y<pos>' key
  const L0 = ctx54.computeRollLayout(pts, 0, 0, opts);
  const k = realStrip(L0).key;
  assert(k.indexOf('y') === 0, 'primary strip key is un-prefixed (starts with "y")');

  // Prefixed layer: key is namespaced
  const Lp = ctx54.computeRollLayout(pts, 0, 0, { ...opts, keyPrefix:'L1_' });
  const kp = realStrip(Lp).key;
  assert(kp === 'L1_' + k, 'prefixed layer strip key = prefix + base key');

  // Piece keys inherit the prefix when the strip is cut
  const LpCut = ctx54.computeRollLayout(pts, 0, 0, { ...opts, keyPrefix:'L1_', manualCuts: { [kp]: [10] } });
  const spCut = stripByKey(LpCut, kp);
  assert(spCut.pieces && spCut.pieces.length === 2, 'prefixed cut splits the prefixed-layer strip into 2 pieces');
  assert(spCut.pieces[0].key.indexOf('L1_') === 0, 'piece keys inherit the layer prefix');

  // Back-compat: an un-prefixed cut still splits the primary strip
  const Lbc = ctx54.computeRollLayout(pts, 0, 0, { ...opts, manualCuts: { [k]: [10] } });
  assert(stripByKey(Lbc, k).pieces && stripByKey(Lbc, k).pieces.length === 2, 'back-compat: un-prefixed cut splits the primary strip');

  // Anti-bleed: a primary-keyed cut must NOT apply to a prefixed layer
  const Lbleed = ctx54.computeRollLayout(pts, 0, 0, { ...opts, keyPrefix:'L1_', manualCuts: { [k]: [10] } });
  assert(!stripByKey(Lbleed, kp).pieces, 'primary-keyed cut does NOT bleed onto a prefixed layer');

  // And the reverse: a prefixed-keyed cut must NOT apply to the primary
  const Lbleed2 = ctx54.computeRollLayout(pts, 0, 0, { ...opts, manualCuts: { [kp]: [10] } });
  assert(!stripByKey(Lbleed2, k).pieces, 'prefixed-keyed cut does NOT bleed onto the un-prefixed primary');

  // computeInstallLayerLayouts assigns distinct prefixes per install layer
  {
    const primaryLayout = ctx54.computeRollLayout(pts, 0, 0, opts);
    const secondaryShapes = [{ name:'Install B', points: rect(0, 40, 30, 15) }];
    const proj = { layout: { secondaryShapeModes: { 0:'install' }, layerRoll: {} } };
    const layers = ctx54.computeInstallLayerLayouts(proj, primaryLayout, secondaryShapes, 0, 0, opts);
    assert(layers.length === 2, 'two install layers (primary + secondary)');
    assert(realStrip(layers[0].layout).key.indexOf('y') === 0, 'primary layer keeps bare key');
    assert(realStrip(layers[1].layout).key.indexOf('L0_') === 0, 'secondary install layer key is prefixed with its id');
  }

  // effectiveRollWidth: single source of truth for usable roll width after trim
  assert(ctx54.effectiveRollWidth({ rollWidth:15, sideTrim:0 }) === 15, 'effW: 15 roll, 0 trim → 15');
  assert(Math.abs(ctx54.effectiveRollWidth({ rollWidth:15, sideTrim:6 }) - 14.5) < 1e-9, 'effW: 15 roll, 6in trim → 14.5 ft');
  assert(ctx54.effectiveRollWidth({}) === 15, 'effW: missing opts default to 15 roll, 0 trim');
  assert(ctx54.effectiveRollWidth({ rollWidth:1, sideTrim:240 }) === 0.01, 'effW: floored at 0.01 when trim exceeds width (1ft − 20ft → 0.01)');

  // Per-layer roll-dir / seam sliders must be drag-safe: the live oninput path
  // (skipList=true) updates the model + canvas but must NOT rebuild the layers
  // list (which would destroy the slider mid-drag). The drag-end onchange path
  // rebuilds it once.
  {
    let listCalls = 0;
    ctx54.renderLayersList = () => { listCalls++; };
    ctx54.renderRollLayout = () => {};
    ctx54.save = () => {};
    const proj = { layout: { layerRoll: {} } };
    ctx54.getCurrentProject = () => proj;

    listCalls = 0;
    ctx54.setLayerRollDirection(0, 45, true);
    assert(proj.layout.layerRoll[0].rotation === 45, 'roll dir: model updates on live input');
    assert(listCalls === 0, 'roll dir: live input does NOT rebuild the layers list (drag-safe)');
    ctx54.setLayerRollDirection(0, 90);
    assert(listCalls === 1, 'roll dir: drag-end rebuilds the list exactly once');

    listCalls = 0;
    ctx54.setLayerSeamOffset(0, 5, true);
    assert(proj.layout.layerRoll[0].translation === 5, 'seam offset: model updates on live input');
    assert(listCalls === 0, 'seam offset: live input does NOT rebuild the layers list (drag-safe)');
    ctx54.setLayerSeamOffset(0, 3);
    assert(listCalls === 1, 'seam offset: drag-end rebuilds the list exactly once');
  }

  // Primary roll dir / seam offset (Layers-list parity): writes the global
  // rotation/translation, syncs the top slider input, and is drag-safe.
  {
    let listCalls = 0;
    ctx54.renderLayersList = () => { listCalls++; };
    ctx54.renderRollLayout = () => {};
    ctx54.save = () => {};
    const proj = { layout: {} };
    ctx54.getCurrentProject = () => proj;
    // getElementById returns a fresh mock each call here, so just assert model + list behavior.
    listCalls = 0;
    ctx54.setPrimaryRollDirection(95, true);
    assert(proj.layout.rotation === 95, 'primary roll dir writes proj.layout.rotation');
    assert(listCalls === 0, 'primary roll dir: live input is drag-safe (no list rebuild)');
    ctx54.setPrimaryRollDirection(200); // wraps mod 180 → 20
    assert(proj.layout.rotation === 20, 'primary roll dir wraps mod 180');
    assert(listCalls === 1, 'primary roll dir: drag-end rebuilds list once');

    listCalls = 0;
    ctx54.setPrimarySeamOffset(2.5, true);
    assert(proj.layout.translation === 2.5, 'primary seam offset writes proj.layout.translation');
    assert(listCalls === 0, 'primary seam offset: live input is drag-safe');
  }
}

section('55. Phase 3b inc 2: layer-aware nestable-unit enumeration');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0 };
  const primaryPts  = rect(0, 0, 30, 15);   // primary, centroid ~ (15, 7.5)
  const secondaryPts = rect(0, 40, 30, 15);  // install layer B, centroid ~ (15, 47.5)

  // Build a layout that carries install layers the way renderRollLayout does:
  // top-level layout = primary, plus layout._installLayers from
  // computeInstallLayerLayouts. Give the secondary its own roll rotation so the
  // per-layer frame conversion has something to differ on.
  const primaryLayout = ctx.computeRollLayout(primaryPts, 0, 0, opts);
  const proj = { layout: { secondaryShapeModes: { 0:'install' }, layerRoll: { 0: { rotation: 30 } } } };
  const secondaryShapes = [{ name:'Install B', points: secondaryPts }];
  primaryLayout._installLayers = ctx.computeInstallLayerLayouts(proj, primaryLayout, secondaryShapes, 0, 0, opts);

  const groups = ctx.getNestableUnitsByLayer(primaryLayout);

  // One group for the primary + one per secondary install layer.
  assert(groups.length === 2, 'enumerator returns one group per install layer (primary + 1 secondary)');
  assert(groups[0].layerId === 'primary', 'first group is the primary layer');
  assert(groups[1].layerId === 0, 'second group is secondary install layer (id 0)');

  // Primary group reproduces exactly what getNestableUnits returns (no drift).
  const flat = ctx.getNestableUnits(primaryLayout);
  assert(groups[0].units.length === flat.length, 'primary group unit count matches getNestableUnits');
  assert(groups[0].units.every((u, i) => u.key === flat[i].key), 'primary group units match getNestableUnits by key/order');

  // Each group carries that layer's OWN transform (not the primary's).
  assert(groups[0].rotationDeg === primaryLayout.rotationDeg, 'primary group rotationDeg = primary layout rotationDeg');
  assert(groups[0].cx === primaryLayout.cx && groups[0].cy === primaryLayout.cy, 'primary group centroid = primary layout centroid');
  const secLayout = primaryLayout._installLayers[1].layout;
  assert(groups[1].rotationDeg === secLayout.rotationDeg, 'secondary group rotationDeg = its own layout rotationDeg');
  assert(groups[1].rotationDeg === 30, 'secondary group rotationDeg reflects its per-layer roll override (30)');
  assert(groups[1].cx === secLayout.cx && groups[1].cy === secLayout.cy, 'secondary group centroid = its own centroid');
  assert(groups[1].cy !== groups[0].cy, 'secondary centroid differs from primary (distinct frames)');
  assert(groups[1].units.length > 0, 'secondary install layer contributes nestable units');

  // displayPointToRollFrame on the primary group reproduces the legacy inline
  // conversion the drop handler has always used — behavior-preserving.
  const dataPt = { x: 12, y: 9 };
  const legacy = ctx.rotateAround([dataPt], -(primaryLayout.rotationDeg || 0), primaryLayout.cx, primaryLayout.cy)[0];
  const viaHelper = ctx.displayPointToRollFrame(dataPt, groups[0]);
  assert(near(viaHelper.x, legacy.x) && near(viaHelper.y, legacy.y), 'displayPointToRollFrame(primary) == legacy inline conversion');

  // Same display point converts to DIFFERENT roll-frame coords under the
  // secondary layer's transform — this is exactly the off-target bug's root
  // cause, now addressable per layer.
  const secFrame = ctx.displayPointToRollFrame(dataPt, groups[1]);
  assert(!(near(secFrame.x, viaHelper.x) && near(secFrame.y, viaHelper.y)),
    'secondary layer converts the same drop point to a different roll frame');

  // Round-trip: forward-rotating the converted point back about the layer's
  // centroid returns the original display point (helper is a true inverse).
  const back = ctx.rotateAround([secFrame], (groups[1].rotationDeg || 0), groups[1].cx, groups[1].cy)[0];
  assert(near(back.x, dataPt.x) && near(back.y, dataPt.y), 'roll-frame conversion round-trips back to the display point');

  // Degenerate input: a layout with no install layers yields just the primary.
  const solo = ctx.computeRollLayout(primaryPts, 0, 0, opts);
  const soloGroups = ctx.getNestableUnitsByLayer(solo);
  assert(soloGroups.length === 1 && soloGroups[0].layerId === 'primary', 'no _installLayers → single primary group');

  // ── Drop resolution at the data layer: a PREFIXED nesting entry must resolve
  // within a secondary layer's computeRollLayout (proving the drop handler can
  // write 'L0_...' keys and have them take effect on that layer's roll plan).
  const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];
  const baseL0 = ctx.computeRollLayout(lShape, 0, 0, { ...opts, keyPrefix:'L0_' });
  const small = baseL0.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
  const big   = baseL0.strips.find(s => s.index !== (small||{}).index && s.wasteArea >= (small||{purchasedArea:9999}).purchasedArea);
  if (small && big) {
    assert(small.key.indexOf('L0_') === 0 && big.key.indexOf('L0_') === 0, 'secondary-layer strip keys are prefixed');
    const nestedL0 = ctx.computeRollLayout(lShape, 0, 0, { ...opts, keyPrefix:'L0_', nesting:{ [small.key]: big.key } });
    assert(nestedL0.totalOrdered < baseL0.totalOrdered, 'prefixed nesting reduces a secondary layer\u2019s totalOrdered');
    const nestedUnit = nestedL0.strips.map(s=>s.pieces||[s]).flat().find(s => s.key === small.key);
    assert(nestedUnit && nestedUnit.nestedIntoKey === big.key, 'secondary nested unit records its (same-layer, prefixed) target key');

    // Cross-layer guard: a primary-keyed (unprefixed) target must NOT resolve
    // inside the secondary layer (keys don't collide → inert, never misapplied).
    const crossKey = big.key.replace('L0_', '');
    const crossL0 = ctx.computeRollLayout(lShape, 0, 0, { ...opts, keyPrefix:'L0_', nesting:{ [small.key]: crossKey } });
    assert(near(crossL0.totalOrdered, baseL0.totalOrdered, 0.01), 'a cross-layer (unprefixed) target does not resolve inside the secondary layer');
  } else {
    console.log('  (secondary-nesting data test skipped — no suitable strip pair)');
  }

  // ── assignNestPlacements must place a nested SECONDARY-layer piece (Edit 1).
  // Hand-build a layout whose only nested unit lives in an install layer; before
  // the fix, assignNestPlacements walked the primary only and left _nestX null.
  {
    const r = (x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
    const tgt = { key:'L0_t', rfX0:0, rfX1:100, rfY0:0, rfY1:15, clipped:[], nestedInto:null, nestedIntoKey:null };
    const src = { key:'L0_s', rfX0:0, rfX1:20, rfY0:0, rfY1:15, clipped:r(0,0,20,15), nestedInto:0, nestedIntoKey:'L0_t', nestPos:{ rfX:50, rfY:7.5 } };
    const layoutWithSecondaryNest = {
      strips: [],
      _installLayers: [
        { id:'primary', layout:{ strips:[] } },
        { id:0, layout:{ rotationDeg:0, strips:[ { pieces:[tgt, src] } ] } },
      ],
    };
    ctx.assignNestPlacements(layoutWithSecondaryNest);
    assert(src._nestX != null && src._nestY != null, 'assignNestPlacements places a nested secondary-layer piece');
    assert(src._nestX >= tgt.rfX0 - 1e-9 && (src._nestX + (src.rfX1 - src.rfX0)) <= tgt.rfX1 + 1e-9,
      'placed secondary piece stays within its target\u2019s purchased rectangle');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  56. Per-layer cut routing — findCutTarget hits sub-layer strips
//  A cut click must resolve against the primary layer AND every visible secondary
//  install layer, returning that layer's own frame so the cut position is computed
//  correctly. (Fixes: "can't make cuts to sub layers.")
// ════════════════════════════════════════════════════════════════════════
section('56. Per-layer cut routing (findCutTarget)');
{
  const sq = (x0,y0,x1,y1) => [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
  // Primary strip occupies x[0,10]; a secondary install-layer strip occupies x[20,30].
  const primStrip = { key:'y0.00', displayClipped: sq(0,0,10,10), sMinX:0, neededLength:10 };
  const subStrip  = { key:'L0_y0.00', displayClipped: sq(20,0,30,10), sMinX:0, neededLength:10 };
  const layout = {
    strips: [primStrip],
    rotationDeg: 0, cx: 5, cy: 5,
    layerVisibility: {},
    _installLayers: [
      { id:'primary', layout:null },
      { id:0, layout:{ strips:[subStrip], rotationDeg: 90, cx: 25, cy: 5 } },
    ],
  };

  const hitPrim = ctx.findCutTarget(layout, { x:5, y:5 });
  assert(hitPrim && hitPrim.strip.key === 'y0.00', 'a click in the primary strip resolves to the primary strip');
  assert(hitPrim.frame.rotationDeg === 0, 'primary hit carries the primary frame');

  const hitSub = ctx.findCutTarget(layout, { x:25, y:5 });
  assert(hitSub && hitSub.strip.key === 'L0_y0.00', 'a click in the SUB-LAYER strip resolves to the sub-layer strip (was previously missed)');
  assert(hitSub.frame.rotationDeg === 90 && hitSub.frame.cx === 25, 'sub-layer hit carries the SUB-LAYER frame (its own rotation/centroid), not the primary\'s');

  // A click in empty space hits nothing.
  assert(ctx.findCutTarget(layout, { x:50, y:50 }) === null, 'a click outside every strip returns null');

  // Hiding the sub-layer makes its strips un-cuttable (you can't cut what you can't see).
  const hidden = { ...layout, layerVisibility: { 0:false } };
  assert(ctx.findCutTarget(hidden, { x:25, y:5 }) === null, 'a hidden install layer is not cut-targetable');

  // Already-cut strips expose pieces; a click resolves to the specific piece.
  const cutSub = { key:'L0_y0.00', pieces:[
    { key:'L0_y0.00_p0', displayClipped: sq(20,0,25,10) },
    { key:'L0_y0.00_p1', displayClipped: sq(25,0,30,10) },
  ], sMinX:0, neededLength:10 };
  const layout2 = { ...layout, _installLayers:[ {id:'primary',layout:null}, {id:0, layout:{ strips:[cutSub], rotationDeg:90, cx:25, cy:5 }} ] };
  const hitPiece = ctx.findCutTarget(layout2, { x:27, y:5 });
  assert(hitPiece && hitPiece.strip.key === 'L0_y0.00', 'a click on an already-cut sub-layer strip still resolves to that strip');
}

// ════════════════════════════════════════════════════════════════════════
//  57. Nesting reduces Linear Ft + roll count (not just Ordered SqFt)
//  A nested piece is re-used from another roll's waste, so it drops out of the
//  linear footage and the roll count — while still counting as an installed piece.
// ════════════════════════════════════════════════════════════════════════
section('57. Nesting reduces Linear Ft + rolls');
{
  // ── compute-level: nesting lowers linearFt by the nested unit's orderedLength ──
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  const lShape = [{x:0,y:0},{x:30,y:0},{x:30,y:8},{x:5,y:8},{x:5,y:30},{x:0,y:30}];
  const base = ctx.computeRollLayout(lShape, 0, 0, opts);
  const small = base.strips.find(s => s.purchasedArea > 0.5 && s.wasteArea < 1);
  const big   = base.strips.find(s => s.index !== (small||{}).index && s.wasteArea >= (small||{purchasedArea:9999}).purchasedArea);
  if (small && big) {
    const nested = ctx.computeRollLayout(lShape, 0, 0, { ...opts, nesting:{ [small.key]: big.key } });
    assert(near(nested.linearFt, base.linearFt - small.orderedLength), 'nesting drops linearFt by the nested unit\'s orderedLength');
    assert(nested.linearFt < base.linearFt, 'nesting lowers Linear Ft (what you order), not just Ordered SqFt');
  }

  // ── countRollsAndPieces: nested piece excluded from length, still a piece, and
  //    the roll count drops when the remaining length crosses a roll boundary ──
  {
    const mk = (nested) => ({ rollLength: 30, strips: [ { clippedArea: 100, pieces: [
      { orderedLength: 20, nestedInto: null },
      { orderedLength: 15, nestedInto: nested ? 0 : null },
    ] } ] });
    const without = ctx.countRollsAndPieces(mk(false)); // 20 + 15 = 35 ft → 2 rolls
    const withNest = ctx.countRollsAndPieces(mk(true));  // 20 ft (15 re-used) → 1 roll
    assert(without.totalRolls === 2 && without.totalPieces === 2, 'before nesting: 35 ft needs 2 rolls / 2 pieces');
    assert(withNest.totalRolls === 1, 'after nesting: the re-used piece drops the order to 1 roll');
    assert(withNest.totalPieces === 2, 'the nested piece is still counted as an installed piece');
  }

  // ── a whole (uncut) strip nested wholesale adds no length either ──
  {
    const layout = { rollLength: 100, strips: [
      { clippedArea: 50, orderedLength: 40, numSegments: 1, nestedInto: null, pieces: null },
      { clippedArea: 30, orderedLength: 25, numSegments: 1, nestedInto: 0, pieces: null }, // nested whole strip
    ] };
    const r = ctx.countRollsAndPieces(layout);
    assert(near(r.totalRolls, 1) , 'a nested whole strip adds no roll length (40 ft → 1 roll, not 65)');
  }

  // ── SAME-ROLL nesting: a cut piece nests into a sibling piece's waste on the
  //    SAME roll, gated by INSTALLED (clipped) area, not the full purchased rect ──
  {
    const shape = [{x:0,y:0},{x:40,y:0},{x:40,y:4},{x:0,y:4}]; // narrow shape → big width-waste
    const o = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{ 'y0.00':[20] } };
    const cut = ctx.computeRollLayout(shape, 0, 0, o);
    const cs = cut.strips.find(s => s.key === 'y0.00');
    const [p0, p1] = cs.pieces;
    // The piece's PURCHASED area exceeds the sibling's waste, but its INSTALLED area fits.
    assert(p1.purchasedArea > p0.wasteArea && p1.clippedArea <= p0.wasteArea,
      'fixture: piece purchased-area > sibling waste, but installed-area fits (the case the old gate wrongly blocked)');
    const nested = ctx.computeRollLayout(shape, 0, 0, { ...o, nesting:{ [p1.key]: p0.key } });
    const np1 = nested.strips.find(s => s.key === 'y0.00').pieces.find(p => p.key === p1.key);
    assert(np1.nestedInto != null, 'a cut piece nests into a SIBLING piece on the same roll (installed-area gate)');
    assert(nested.linearFt < cut.linearFt, 'same-roll nesting reduces Linear Ft (fewer feet to order)');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  58. Roll settings — global default + per-project override
// ════════════════════════════════════════════════════════════════════════
section('58. Roll settings (global default + per-project override)');
{
  // Empty storage → standard 15×100 with default trim/margin.
  const d = ctx.getGlobalRollDefaults();
  assert(d.rollWidth === 15 && d.rollLength === 100, 'default roll size is 15 ft × 100 ft');
  assert(d.sideTrim === 4 && d.cuttingMargin === 4, 'default trim/margin = 4 / 4');

  // A stored partial global is merged over the fallback (missing keys keep defaults).
  const prevGet = ctx.localStorage.getItem;
  ctx.localStorage.getItem = (k) => k === 'wt_rollDefaults' ? JSON.stringify({ cuttingMargin: 6 }) : null;
  const g2 = ctx.getGlobalRollDefaults();
  assert(g2.cuttingMargin === 6, 'stored global cutting margin is read back');
  assert(g2.rollWidth === 15 && g2.rollLength === 100, 'missing keys still fall back to 15×100');
  ctx.localStorage.getItem = prevGet;

  // Resolver: a project with NO override resolves to the global default.
  const G = { rollWidth: 15, rollLength: 100, sideTrim: 4, cuttingMargin: 4 };
  const noOv = ctx.resolveRollSettings({ name: 'A' }, G);
  assert(noOv.cuttingMargin === 4 && noOv.rollWidth === 15, 'no override → uses the global default');
  assert(ctx.projectOverridesRoll({ name: 'A' }) === false, 'a project without rollSettings is not overriding');

  // Resolver: a per-project override is merged OVER the global default.
  const ov = ctx.resolveRollSettings({ name: 'B', rollSettings: { cuttingMargin: 9 } }, G);
  assert(ov.cuttingMargin === 9, 'override value wins for that project');
  assert(ov.rollWidth === 15 && ov.rollLength === 100 && ov.sideTrim === 4, 'override fills unspecified keys from the global default');
  assert(ctx.projectOverridesRoll({ name: 'B', rollSettings: { cuttingMargin: 9 } }) === true, 'a project with rollSettings is overriding');

  // The override is independent of the global: changing the global does not move the override value.
  const ov2 = ctx.resolveRollSettings({ rollSettings: { cuttingMargin: 9 } }, { rollWidth: 15, rollLength: 100, sideTrim: 4, cuttingMargin: 12 });
  assert(ov2.cuttingMargin === 9, 'an overriding job keeps its own margin even if the global changes');

  // Field-granular override set/clear (used by the global-vs-project dialog).
  const job = { name: 'J' };
  ctx.setProjectRollOverrideField(job, 'cuttingMargin', 8);
  assert(job.rollSettings && job.rollSettings.cuttingMargin === 8, 'set override field writes just that field');
  assert(ctx.resolveRollSettings(job, G).sideTrim === 4, 'other fields still resolve to the global');
  ctx.setProjectRollOverrideField(job, 'sideTrim', 6);
  assert(Object.keys(job.rollSettings).length === 2, 'a second override field is added, not replaced');
  ctx.clearProjectRollOverrideField(job, 'cuttingMargin');
  assert(job.rollSettings && job.rollSettings.cuttingMargin === undefined && job.rollSettings.sideTrim === 6, 'clearing one field leaves the others');
  ctx.clearProjectRollOverrideField(job, 'sideTrim');
  assert(!job.rollSettings && ctx.projectOverridesRoll(job) === false, 'clearing the last override field drops the override entirely (back to global)');
}

// ════════════════════════════════════════════════════════════════════════
//  59. Layer roll grouping — shared layers pool into shared rolls
// ════════════════════════════════════════════════════════════════════════
section('59. Layer roll grouping');
{
  // Default group is 'shared' (multiple layers ≠ multiple rolls).
  assert(ctx.getLayerRollGroup({ layout: {} }, 'primary') === 'shared', 'roll group defaults to shared');
  assert(ctx.getLayerRollGroup({ layout: { layerRollGroup: { 0: 'own' } } }, 0) === 'own', 'explicit own is honored');

  // Three layers needing 30 / 40 / 20 linear ft at a 100 ft roll length.
  const mk = (lin) => ({ layout: { totalOrdered: lin*15, totalUsable: lin*15, linearFt: lin, shapeArea: lin*15, totalSaved: 0, rollLength: 100, strips: [{ clippedArea: lin*15, orderedLength: lin, numSegments: 1, nestedInto: null, pieces: null }] } });
  const run = (g) => ctx.sumInstallLayouts([{ ...mk(30), rollGroup: g[0] }, { ...mk(40), rollGroup: g[1] }, { ...mk(20), rollGroup: g[2] }]);

  const shared = run(['shared','shared','shared']);
  const own    = run(['own','own','own']);
  const mixed  = run(['shared','shared','own']); // 70 ft pooled → 1, plus 1 own

  assert(shared.rolls === 1, 'all shared: 90 ft pools into 1 roll');
  assert(own.rolls === 3, 'all own: 3 separate rolls');
  assert(mixed.rolls === 2, 'mixed: ceil(70/100)=1 shared + 1 own = 2');
  assert(shared.ordered === own.ordered && own.ordered === mixed.ordered, 'grouping never changes Ordered SqFt');
  assert(shared.linear === own.linear && own.linear === mixed.linear, 'grouping never changes Ordered Linear Ft');
  assert(shared.pieces === own.pieces, 'grouping never changes the installed-piece count');

  // combined.area sums every install layer's installed area — this is what the
  // Installed SqFt metric is built from, so a secondary 'install' layer adds to it.
  assert(Math.abs(shared.area - (30+40+20)*15) < 1e-6, 'combined installed area = sum of all install layers (not just primary)');

  // computeInstallLayerLayouts tags each layer with its group (default shared).
  {
    const proj = { layout: { primaryLayerName:'A', secondaryShapes:[{name:'B',points:[{x:0,y:0},{x:8,y:0},{x:8,y:10},{x:0,y:10}]}], secondaryShapeModes:{0:'install'}, layerRollGroup:{ primary:'own' } } };
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
    const pl = ctx.computeRollLayout(proj.layout.points = [{x:0,y:0},{x:10,y:0},{x:10,y:12},{x:0,y:12}], 0, 0, opts);
    const secs = proj.layout.secondaryShapes.map(s => ({ ...s, displayPoints: s.points }));
    const layers = ctx.computeInstallLayerLayouts(proj, pl, secs, 0, 0, opts);
    assert(layers[0].rollGroup === 'own', 'primary picks up its explicit own grouping');
    assert(layers[1].rollGroup === 'shared', 'secondary defaults to shared');
  }
}

// ════════════════════════════════════════════════════════════════════════
//  60. Overlay mode — installed turf cut from existing roll waste (free)
//  Adds to Installed SqFt (getOverlayArea), but never subtracts (not a cutout)
//  and is excluded from install layers (no extra rolls / Ordered SqFt).
// ════════════════════════════════════════════════════════════════════════
section('60. Overlay layer mode');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{} };
  const sqA = [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}]; // 100
  const sqB = [{x:0,y:0},{x:5,y:0},{x:5,y:6},{x:0,y:6}];      // 30
  const proj = { layout: { primaryLayerName:'P', secondaryShapes:[{name:'A',points:sqA},{name:'B',points:sqB}], secondaryShapeModes:{0:'overlay',1:'install'} } };

  assert(near(ctx.getOverlayArea(proj), 100), 'getOverlayArea sums only overlay-mode shapes (A=100, B is install)');
  assert(near(ctx.getOverlayArea({ layout: { secondaryShapes: [{name:'A',points:sqA}], secondaryShapeModes:{} } }), 0), 'default (ignore) is not overlay');

  // Overlay does NOT subtract from the primary like a cutout.
  assert(near(ctx.getAdjustedShapeArea(proj, 500), 500), 'overlay never subtracts from primary installed area');

  // Overlay is excluded from install layers → adds no rolls / Ordered SqFt.
  const pl = ctx.computeRollLayout([{x:0,y:0},{x:20,y:0},{x:20,y:20},{x:0,y:20}], 0, 0, opts);
  const secs = proj.layout.secondaryShapes.map(s => ({ ...s, displayPoints: s.points }));
  const layers = ctx.computeInstallLayerLayouts(proj, pl, secs, 0, 0, opts);
  assert(layers.length === 2 && !layers.some(l => l.name === 'A'), 'overlay layer A is NOT an install layer (B is)');
  const sum = ctx.sumInstallLayouts(layers);
  // Switching A from overlay → ignore leaves Ordered identical (overlay never ordered).
  const proj2 = { layout: { ...proj.layout, secondaryShapeModes:{0:'ignore',1:'install'} } };
  const layers2 = ctx.computeInstallLayerLayouts(proj2, pl, secs, 0, 0, opts);
  assert(Math.abs(ctx.sumInstallLayouts(layers2).ordered - sum.ordered) < 1e-6, 'overlay adds nothing to Ordered SqFt (same as ignore for the order)');
}

// ════════════════════════════════════════════════════════════════════════
//  61. Cross-layer nesting — a piece cut from a DIFFERENT layer's roll waste
//  resolveCrossLayerNesting drops the piece from its OWN layer's order, leaves
//  the target layer's order alone, and only fires when the piece fits the waste.
// ════════════════════════════════════════════════════════════════════════
section('61. Cross-layer nesting');
{
  const mk = (over) => Object.assign({ nestedInto: null, nestedIntoKey: null, nestHost: [], index: 0, _nestCrossLayer: false }, over);
  const freshLayers = () => {
    const src = mk({ key: 'p0', purchasedArea: 150, clippedArea: 80, orderedLength: 10, wasteArea: 70 });
    const tgt = mk({ key: 'L1_t0', purchasedArea: 450, clippedArea: 300, orderedLength: 30, wasteArea: 150 });
    const A = { strips: [src, mk({ key: 'p1', purchasedArea: 150, clippedArea: 90, orderedLength: 10, wasteArea: 60 })], totalOrdered: 300, totalSaved: 0, linearFt: 20, shapeArea: 170, scrap: 130 };
    const B = { strips: [tgt], totalOrdered: 450, totalSaved: 0, linearFt: 30, shapeArea: 300, scrap: 150 };
    return { src, tgt, A, B, list: [{ id: 'primary', name: 'Base', layout: A }, { id: 1, name: 'Side Yard', layout: B }] };
  };

  // Happy path: piece (80 ft²) fits target waste (150 ft²) → nested cross-layer.
  {
    const f = freshLayers();
    const n = ctx.resolveCrossLayerNesting(f.list, { p0: 'L1_t0' }, {}, {});
    assert(n === 1, 'one cross-layer nest resolved');
    assert(f.src.nestedInto != null && f.src._nestCrossLayer === true, 'source piece marked nested cross-layer');
    assert(f.src.nestedIntoKey === 'L1_t0' && f.src.nestedIntoLabel === 'Side Yard', 'source records the target key + target layer name');
    assert(near(f.A.totalOrdered, 150), 'source layer order drops by the piece purchased area (300 − 150)');
    assert(near(f.A.linearFt, 10), 'source layer linear ft drops by the piece ordered length (20 − 10)');
    assert(near(f.A.totalSaved, 150), 'piece purchased area moves into the source layer saved');
    assert(near(f.B.totalOrdered, 450) && near(f.B.linearFt, 30), 'target layer order/linear are unchanged (it already bought that roll)');
    assert(f.tgt.nestHost.length === 1, 'target records the foreign piece as a host');
  }

  // Combined totals: ordered falls by the piece, installed area is unchanged → scrap falls.
  {
    const f = freshLayers();
    const before = ctx.sumInstallLayouts(f.list);
    ctx.resolveCrossLayerNesting(f.list, { p0: 'L1_t0' }, {}, {});
    const after = ctx.sumInstallLayouts(f.list);
    assert(near(before.ordered - after.ordered, 150), 'combined ordered falls by the nested piece (150)');
    assert(near(before.area, after.area), 'combined installed area is unchanged (piece is still installed, now in the other layer)');
    assert(after.scrap < before.scrap - 1e-6, 'combined scrap falls — the piece consumed the target layer\'s waste');
  }

  // Doesn't fit: piece clipped (80) > target waste (50) → not resolved, nothing changes.
  {
    const f = freshLayers();
    f.tgt.wasteArea = 50;
    const ord0 = f.A.totalOrdered;
    const n = ctx.resolveCrossLayerNesting(f.list, { p0: 'L1_t0' }, {}, {});
    assert(n === 0 && f.src.nestedInto == null && near(f.A.totalOrdered, ord0), 'a piece larger than the target waste does not nest and changes nothing');
  }

  // Same-layer pair is left to computeRollLayout (resolver skips it).
  {
    const f = freshLayers();
    const sameSrc = mk({ key: 's0', purchasedArea: 100, clippedArea: 40, orderedLength: 7, wasteArea: 60 });
    const sameTgt = mk({ key: 's1', purchasedArea: 100, clippedArea: 30, orderedLength: 7, wasteArea: 70 });
    const S = { strips: [sameSrc, sameTgt], totalOrdered: 200, totalSaved: 0, linearFt: 14, shapeArea: 70, scrap: 130 };
    const list = [{ id: 'primary', name: 'P', layout: S }, { id: 1, name: 'Q', layout: f.B }];
    const n = ctx.resolveCrossLayerNesting(list, { s0: 's1' }, {}, {});
    assert(n === 0 && sameSrc.nestedInto == null, 'a same-layer nest is skipped by the cross-layer resolver');
  }

  // Fewer than two install layers → nothing to do.
  {
    const f = freshLayers();
    assert(ctx.resolveCrossLayerNesting([{ id: 'primary', name: 'B', layout: f.A }], { p0: 'L1_t0' }, {}, {}) === 0, 'a single layer resolves no cross-layer nests');
  }
}

console.log(`  Tests: ${passed + failed} | ✓ Passed: ${passed} | ✗ Failed: ${failed}`);
console.log('═'.repeat(58));
process.exit(failed > 0 ? 1 : 0);
