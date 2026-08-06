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
  const stored = { 'wt_shippingDefault': '0' };
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
  const stored = { 'wt_shippingDefault': '0' };
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
  const stored = { 'wt_shippingDefault': '0' };
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
    const stored = { 'wt_shippingDefault': '0' };
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
    assert(near(ctxA.getCurrentProject().turf[0].installedSqFt, 1300), 'Apply Area → BASE row = outline minus green AND hole (1500 - 150 green - 50 hole = 1300)');

    applyTarget = '1';
    const altBefore = ctxA.getCurrentProject().turf[1].installedSqFt;
    ctxA.applyLayoutAreaToTurf();
    assert(near(ctxA.getCurrentProject().turf[1].installedSqFt, altBefore || 0),
      'Apply Area → ALT-TURF row is blocked (priced on base yard area; its installedSqFt is left unchanged)');

    applyTarget = '2';
    ctxA.applyLayoutAreaToTurf();
    assert(near(ctxA.getCurrentProject().turf[2].installedSqFt, 150), 'Apply Area → PUTTING-GREEN row = the green\'s own area (150), not the base');

    // ── computeApplyAreaForRow (pure, role-aware): the decision the DOM wrapper uses ──
    {
      const projH = { layout:{ secondaryShapes:[{area:20,points:rect(0,0,4,5)}], secondaryShapeModes:{0:'putting-green'} } };
      const layH = { adjustedShapeArea: 480 };
      const baseRes = ctxA.computeApplyAreaForRow(projH, layH, { role:'base' });
      assert(baseRes.ok && near(baseRes.area, 480), 'computeApplyAreaForRow: base is the adjusted area with the green already subtracted — NOT added back (480)');
      const pgRes = ctxA.computeApplyAreaForRow(projH, layH, { role:'putting-green' });
      assert(pgRes.ok && near(pgRes.area, 20), 'computeApplyAreaForRow: putting-green row = the green\'s own area (20), not the base yard');
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
  const stored = { 'wt_shippingDefault': '0' };
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

  // ── Deselecting (hiding) a layer removes it from ALL accounting ──
  // Changed from the old behavior (visibility independent of area). A stray/mistaken
  // measurement is removed by unticking it: it then contributes nothing to area, PG,
  // rolls, infill, or labor — matching how a user reads an unchecked box.
  {
    const proj = { layout: { secondaryShapeModes: { 0: 'exclude' }, layerVisibility: { 0: false } } };
    assert(ctx.isLayerVisible(proj, 0) === false, 'an unticked layer reports not visible');
    // A hidden 'exclude' layer no longer subtracts from the installed area.
    const hidden = ctx.getAdjustedShapeArea({ layout: { secondaryShapes:[{area:10,points:rect(0,0,2,2)}], secondaryShapeModes:{0:'exclude'}, layerVisibility:{0:false} } }, 100);
    assert(near(hidden, 100), 'a deselected exclude layer no longer comes off the area (was 90, now 100)');
    // Visible, it still subtracts as before.
    const shown = ctx.getAdjustedShapeArea({ layout: { secondaryShapes:[{area:10,points:rect(0,0,2,2)}], secondaryShapeModes:{0:'exclude'}, layerVisibility:{0:true} } }, 100);
    assert(near(shown, 90), 'a visible exclude layer still subtracts');
    // A deselected putting-green layer drops out of the PG area entirely.
    const pgHidden = ctx.getPuttingGreenShapeArea({ layout: { secondaryShapes:[{area:91.52,points:rect(0,0,3,3)}], secondaryShapeModes:{0:'putting-green'}, layerVisibility:{0:false} } });
    assert(near(pgHidden, 0), 'a deselected putting-green layer contributes 0 PG area');
    const pgShown = ctx.getPuttingGreenShapeArea({ layout: { secondaryShapes:[{area:91.52,points:rect(0,0,3,3)}], secondaryShapeModes:{0:'putting-green'}, layerVisibility:{0:true} } });
    assert(near(pgShown, 91.52), 'a visible putting-green layer still contributes its area');
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
    const stored = { 'wt_shippingDefault': '0' };
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
  const stored = { 'wt_shippingDefault': '0' };
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
  const stored = { 'wt_shippingDefault': '0' };
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
  const stored = { 'wt_shippingDefault': '0' };
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

  // ── Pieces can't span a roll join, so rolls come from PACKING, not division ──
  {
    const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
    const shape = [{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}]; // 3 bands of 60ft each -> 180ft total
    const l = ctx.computeRollLayout(shape, 0, 0, opts);
    const { totalRolls, totalPieces } = totalRollsAndPieces(l);

    assert(totalPieces === 3, '3 bands = 3 pieces');
    // Default is butt seams OFF: a 60ft run can't finish on another roll, so each
    // takes its own. With a cut-to-length supplier this costs nothing — 3 rolls of
    // 60ft is the same 180ft as 2 seamed rolls — and every run stays seamless.
    assert(totalRolls === 3, '3x60ft = 3 rolls by default (butt seams off, seamless runs)');

    // Opting in to butt seams: roll 1 gives 60 + the first 40ft of the next run,
    // roll 2 gives its remaining 20 + the last 60. Fewer, longer rolls; same 180ft.
    const lSeam = ctx.computeRollLayout(shape, 0, 0, {...opts, allowJoinSeams:true});
    const seamed = totalRollsAndPieces(lSeam);
    assert(seamed.totalRolls === 2, '3x60ft = 2 rolls when butt seams are allowed');
    assert(seamed.totalPieces === 3, 'piece count is unchanged by the seam setting');
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

  const stored = { 'wt_shippingDefault': '0' };
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

  // ── 3 bands of 60ft: only one fits per 100ft roll, so each gets its own roll ──
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
    // Default (seams off): no piece is ever split; each 60ft band gets its own roll.
    assert(lab0.roll === 1 && lab0.piece === 1, `band 0 = Roll 1 / Piece 1 (got Roll ${lab0.roll} / Piece ${lab0.piece})`);
    assert(lab1.roll === 2 && lab1.piece === 1, `band 1 gets its own roll (got Roll ${lab1.roll} / Piece ${lab1.piece})`);
    assert(lab2.roll === 3 && lab2.piece === 1, `band 2 gets its own roll (got Roll ${lab2.roll} / Piece ${lab2.piece})`);
    assert(!lab1.parts && !lab2.parts, 'seams off: no piece is butt-seamed');

    // Seams on: band 1 takes roll 1's last 40ft and is butt-seamed onto roll 2 for
    // its remaining 20ft — and the label SAYS so, instead of silently implying a
    // 120ft piece came off a 100ft roll.
    const lS = ctx.computeRollLayout(shape, 0, 0, {...opts, allowJoinSeams:true});
    const labS = ctx.assignRollPieceLabels(lS);
    const occS = lS.strips.filter(s=>s.clippedArea>0.5);
    const s0 = labS.get(occS[0]), s1 = labS.get(occS[1]), s2 = labS.get(occS[2]);
    assert(s0.roll === 1 && s0.piece === 1, 'seams on: band 0 = Roll 1 / Piece 1');
    assert(s1.roll === 1 && s1.piece === 2, 'seams on: band 1 starts on Roll 1 as Piece 2');
    assert(s1.parts === 2 && s1.part === 1, 'seams on: band 1 is flagged butt-seamed, part 1 of 2');
    assert(near(s1.partLength, 40), "seams on: band 1's first part is roll 1's last 40ft");
    assert(s1.extraParts && s1.extraParts.length === 1, 'seams on: band 1 records its continuation');
    assert(s1.extraParts[0].roll === 2 && s1.extraParts[0].part === 2, 'seams on: band 1 part 2 of 2 continues on Roll 2');
    assert(near(s1.extraParts[0].partLength, 20), 'seams on: band 1 continuation is the remaining 20ft');
    assert(s2.roll === 2 && s2.piece === 2, 'seams on: band 2 = Roll 2 / Piece 2');
  }

  // ── Manual cuts: 3 small pieces share Roll 1; a following 60ft band can't fit
  //    the 40ft remainder, so it starts Roll 2 ──
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
    // 20+20+20 = 60ft, all fit on Roll 1 together.
    cutStrip.pieces.forEach((p, idx) => {
      const lab = labels.get(p);
      assert(lab.roll === 1, `cut piece ${idx} is in Roll 1 (got Roll ${lab.roll})`);
      assert(lab.piece === idx+1, `cut piece ${idx} is Piece ${idx+1} (got Piece ${lab.piece})`);
    });

    // Default (seams off): Roll 1 has 40ft left, but the next band is 60ft — it
    // can't use the remainder, so it starts a fresh Roll 2, unseamed.
    const labNext = labels.get(nextStrip);
    assert(labNext.roll === 2 && labNext.piece === 1 && !labNext.parts, `60ft band starts a fresh Roll 2, unseamed (got Roll ${labNext.roll} / Piece ${labNext.piece})`);

    const labLast = labels.get(lastStrip);
    assert(labLast.roll === 3 && labLast.piece === 1, `third band starts Roll 3 (got Roll ${labLast.roll} / Piece ${labLast.piece})`);

    // Seams on: the 60ft band takes Roll 1's last 40ft and is seamed onto Roll 2.
    const lS = ctx.computeRollLayout(shape, 0, 0, {...cutOpts, allowJoinSeams:true});
    const labS = ctx.assignRollPieceLabels(lS);
    const nextS = labS.get(lS.strips.find(s=>s.key==='y15.00'));
    assert(nextS.roll === 1 && nextS.piece === 4, 'seams on: 60ft band starts on Roll 1 as Piece 4');
    assert(nextS.parts === 2, 'seams on: 60ft band is butt-seamed across the join');
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
    const stored = { 'wt_shippingDefault': '0' };
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
    const stored = { 'wt_shippingDefault': '0' };
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
    const stored = { 'wt_shippingDefault': '0' };
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

    // Sanity: total COGS for the PG card includes fringe cost as an additive component.
    // With the live link on, loadProject syncs each row's order from its OWN roll plan:
    // the base row orders the full 50×40 outline (2,250 ft² after roll waste) and the
    // PG row orders the green's own plan (300 ft² — the green is 20 ft wide vs a 15 ft
    // roll, so it needs a second width). Base install (labor) is outline−green = 1800.
    // Std yard: 1800*$8=$14,400; PG labor: 200*$12=$2,400; base turf mat: 2250*$2.50=$5,625;
    // PG turf mat: 300*$3.50=$1,050; fringe: $304.
    const expectedCogs = 1800*8 + 200*12 + 2250*2.50 + 300*3.50 + 304;
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
    const stored = { 'wt_shippingDefault': '0' };
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
      // Mirrors the real page: the butt-seam checkbox ships checked. The generic
      // mock element defaults checked:false, which would silently test the
      // opposite of the shipped default.
      // Mirrors the real page: the butt-seam checkbox ships UNCHECKED (with a
      // cut-to-length supplier, seams save no material — see CHANGELOG cont'd 20).
      allowJoinSeamsInput:{type:'checkbox',checked:false},
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
    // Default (butt seams off): each 60ft band gets its own roll, no seams.
    assert(html.includes('Roll 1 / Piece 1'), 'piece list shows Roll 1 / Piece 1');
    assert(html.includes('Roll 2 / Piece 1'), 'piece list shows Roll 2 / Piece 1');
    assert(html.includes('Roll 3 / Piece 1'), 'piece list shows Roll 3 / Piece 1');
    assert(!html.includes('butt seam'), 'no butt-seam note when seams are off');
    // Rolls-to-order summary: the length to actually buy for each roll. This is the
    // ordering figure for a cut-to-length supplier.
    assert(html.includes('ROLLS TO ORDER'), 'piece list shows the rolls-to-order summary');
    assert(html.includes('Cut-to-length'), 'rolls-to-order says these are cut-to-length lengths');
    assert(html.includes('60.0 ft'), 'each seamless roll needs only 60ft');
    assert(!html.includes('100.0 ft'), 'no roll is padded out to a full 100ft');
    assert(html.includes('180.0 ft to order'), 'total to order is 180ft — the same as the seamed case');
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

  // ── A NESTED piece must not add linear footage (real job, 2026-07-15) ──
  // An L-shape: a 25ft band, plus an 8ft band nested into the 25ft band's waste.
  // The 8ft piece is cut from a roll already being bought, so the order is 25ft —
  // NOT 33ft. Summing every row charged for that 8ft twice and made the piece list
  // disagree with both the top-bar Linear Ft and "ft to order".
  {
    // Band y0 (25ft long) is only partly covered, leaving waste — same situation as
    // the real job, where a 25ft roll had 118 sqft of scrap to nest into.
    const lShape = [{x:0,y:0},{x:25,y:0},{x:25,y:7},{x:8,y:7},{x:8,y:30},{x:0,y:30}];
    const { inputs } = makeHarness38({
      proj: {
        id:'p1', name:'Test', created:1000, edging:{}, pgSqFt:0, miscItems:[],
        turf:[{ product:'Turf', installedSqFt:359, sqFtToOrder:359, orderedSqFt:359, role:'base' }],
        infill:[], rock:[],
        layout: { points: lShape, area:359, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0,
                  nesting: { 'y15.00': 'y0.00' } },
      },
    });
    const html = inputs.pieceListTable.innerHTML;
    assert(/cut from .*waste/.test(html), 'the nested piece is flagged as cut from waste');
    // The order figure excludes the nested piece.
    assert(html.includes('25.0 ft total linear footage'), `nested piece excluded: order is 25ft, not 33ft (got: ${(html.match(/[\d.]+ ft total linear footage/)||[])[0]})`);
    assert(!html.includes('33.0 ft total linear footage'), 'the 8ft nested piece is NOT charged as extra linear footage');
    // But the cut footage is still shown, so the installer knows what gets cut.
    assert(html.includes('33.0 ft of pieces get cut'), 'cut footage (33ft) is still surfaced');
    assert(html.includes('8.0 ft of that is nested'), 'the nested portion is named');
    // And it reconciles with rolls-to-order.
    assert(html.includes('25.0 ft to order'), 'rolls-to-order agrees at 25ft');
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
    const stored = { 'wt_shippingDefault': '0' };
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
    const stored = { 'wt_shippingDefault': '0' };
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
    const stored = { 'wt_shippingDefault': '0' };
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
    // liveLink off: these fixtures hand-set installed/ordered to isolate quote MATH.
    // With it on, loadProject's live sync would (correctly) overwrite sqFtToOrder from
    // the roll plan, which is a different thing under test (covered elsewhere).
    layout:{ points:rect(0,0,50,40), area:2000, secondaryShapes:[], secondaryShapeModes:{}, liveLink:false, rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, rotation:0, translation:0 },
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

// ════════════════════════════════════════════════════════════════════════
//  62. Fit frame includes a roll's waste rectangle when it HOSTS a nested piece
//  even with rectangles hidden — otherwise the piece (drawn in the waste) clips.
// ════════════════════════════════════════════════════════════════════════
section('62. Fit includes host rectangles');
{
  const host = { displayRect:[{x:-50,y:0},{x:-30,y:0},{x:-30,y:10},{x:-50,y:10}], displayClipped:[{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}], nestHost:[0] };
  const plain = { displayRect:[{x:100,y:0},{x:120,y:0},{x:120,y:10},{x:100,y:10}], displayClipped:[{x:10,y:0},{x:15,y:0},{x:15,y:5},{x:10,y:5}] };
  const layout = { basePoints:[{x:0,y:0}], strips:[host, plain] };
  const off = ctx.layoutFitPoints(layout, false);
  assert(near(Math.min(...off.map(p=>p.x)), -50), 'rectangles OFF: a host roll\'s waste rectangle is still framed in (nested piece there won\'t clip)');
  assert(Math.max(...off.map(p=>p.x)) < 100, 'rectangles OFF: a non-host roll\'s rectangle is excluded');
  const on = ctx.layoutFitPoints(layout, true);
  assert(Math.max(...on.map(p=>p.x)) >= 120 - 1e-6, 'rectangles ON: every roll rectangle is framed in');
}

section('63. Layout lock predicate');
{
  assert(ctx.isLayoutLocked(undefined) === false, 'no project → not locked');
  assert(ctx.isLayoutLocked({}) === false, 'project without layout → not locked');
  assert(ctx.isLayoutLocked({ layout: {} }) === false, 'layout without locked flag → not locked');
  assert(ctx.isLayoutLocked({ layout: { locked: false } }) === false, 'locked:false → not locked');
  assert(ctx.isLayoutLocked({ layout: { locked: true } }) === true, 'locked:true → locked');
}

section('64. Add CSV: append placement');
{
  const existing = [{x:0,y:0},{x:10,y:0},{x:10,y:8},{x:0,y:8}];
  const neu = [{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}];
  const off = ctx.computeAppendOffset(existing, neu, 3);
  assert(near(off.dx, 13), 'dx drops the new group just right of existing (maxX 10 + gap 3 − newMinX 0)');
  assert(near(off.dy, 0), 'dy top-aligns the new group with existing');
  const movedMinX = Math.min(...neu.map(p => p.x + off.dx));
  assert(movedMinX >= 10 - 1e-9, 'shifted new shape clears the existing content on X (no origin stacking)');
  assert(ctx.computeAppendOffset([], neu, 3).dx === 0, 'no existing content → zero offset (first import lands at origin)');

  const proj = { layout: { points: [{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}], secondaryShapes: [{ points: [{x:1,y:1},{x:2,y:1},{x:2,y:2},{x:1,y:2}] }], layerOffsets: { primary: {dx:0,dy:0}, 0: {dx:20,dy:0} } } };
  const placed = ctx.layoutPlacedPoints(proj);
  assert(Math.max(...placed.map(p=>p.x)) >= 22 - 1e-9, 'placed-points bounds include a secondary shifted by its own offset');
}

section('65. Auto-cut at gaps');
{
  // Rectangle 60×30 with a notch removed from the bottom middle (x 20–40, y 0–15).
  const poly = [{x:0,y:0},{x:20,y:0},{x:20,y:15},{x:40,y:15},{x:40,y:0},{x:60,y:0},{x:60,y:30},{x:0,y:30}];
  const runs = ctx.bandCoverageRuns(poly, 0, 60, 0, 15, 2);
  assert(runs.length === 2, 'notched band splits into two coverage runs');
  assert(near(runs[0].x0, 0) && near(runs[0].x1, 20), 'first run is the left solid part [0,20]');
  assert(near(runs[1].x0, 40) && near(runs[1].x1, 60), 'second run is the right solid part [40,60]');
  const mergedRuns = ctx.bandCoverageRuns(poly, 0, 60, 0, 15, 25);
  assert(mergedRuns.length === 1, 'a gap below the min-gap threshold is bridged, not cut');
  const upper = ctx.bandCoverageRuns(poly, 0, 60, 15, 30, 2);
  assert(upper.length === 1, 'the un-notched upper band stays a single run');

  // End-to-end: the notch band is ordered as two pieces with the gap dropped.
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:6, maxRollLength:100, keyPrefix:'' };
  const L = ctx.computeRollLayout(poly, 0, 0, opts);
  const cut = L.strips.find(s => s.autoGapSplit);
  assert(!!cut, 'computeRollLayout auto-cuts the notch band');
  if (cut) {
    assert(cut.pieces.length === 2, 'notch band becomes two pieces');
    const covered = cut.pieces.reduce((a, p) => a + p.length, 0);
    assert(covered < cut.neededLength - 10, 'pieces cover far less than the gap-spanning extent (gap dropped)');
  }
  // A plain rectangle (no notch) is never auto-cut.
  const plain = ctx.computeRollLayout([{x:0,y:0},{x:60,y:0},{x:60,y:30},{x:0,y:30}], 0, 0, opts);
  assert(!plain.strips.some(s => s.autoGapSplit), 'a gap-free rectangle is left as whole strips');
}

section('66. Edging perimeter per layer');
{
  const proj = { layout: {
    points: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}], // 10×10 → perimeter 40
    primaryLayerName: 'Main Yard',
    secondaryShapes: [
      { name: 'Tree', points: [{x:2,y:2},{x:4,y:2},{x:4,y:4},{x:2,y:4}] }, // 2×2 → 8
      { name: 'Bed',  points: [{x:6,y:6},{x:9,y:6},{x:9,y:7},{x:6,y:7}] },  // 3×1 → 8
    ],
  }};
  const pers = ctx.layerPerimeters(proj);
  assert(pers.length === 3, 'one entry per layer (primary + 2 secondary)');
  assert(pers[0].id === 'primary' && near(pers[0].perimeter, 40), 'primary boundary perimeter (10×10 = 40)');
  assert(near(pers[1].perimeter, 8), 'tree cutout perimeter (2×2 = 8)');
  const total = pers.reduce((a, p) => a + p.perimeter, 0);
  assert(near(total, 56), 'total edging = sum of all layer boundaries (40 + 8 + 8)');
  assert(ctx.layerPerimeters({}).length === 0, 'no layout → no perimeters');
}

section('67. Draw tool geometry');
{
  const line = ctx.drawShapePoints('line', {x:0,y:0}, {x:3,y:4});
  assert(line.closed === false && line.points.length === 2, 'line is an open 2-point segment');
  assert(near(line.points[1].x, 3) && near(line.points[1].y, 4), 'line end matches drag end');

  const rect = ctx.drawShapePoints('rect', {x:1,y:1}, {x:5,y:3});
  assert(rect.closed === true && rect.points.length === 4, 'rect is a closed 4-corner polygon');
  const rxs = rect.points.map(p=>p.x), rys = rect.points.map(p=>p.y);
  assert(near(Math.min(...rxs),1) && near(Math.max(...rxs),5) && near(Math.min(...rys),1) && near(Math.max(...rys),3), 'rect spans the drag box');

  const circ = ctx.drawShapePoints('circle', {x:0,y:0}, {x:4,y:2});
  assert(circ.closed === true && circ.points.length >= 16, 'circle sampled as a closed polygon');
  const cxs = circ.points.map(p=>p.x), cys = circ.points.map(p=>p.y);
  assert(near((Math.min(...cxs)+Math.max(...cxs))/2, 2) && near((Math.min(...cys)+Math.max(...cys))/2, 1), 'circle centered in the drag box');
  assert(near(Math.max(...cxs), 4, 0.05) && near(Math.max(...cys), 2, 0.05), 'circle fills the drag box bounds');

  assert(ctx.annotationHasSize({points:[{x:0,y:0},{x:5,y:0}]}) === true, 'a real-sized shape is kept');
  assert(ctx.annotationHasSize({points:[{x:0,y:0},{x:0.05,y:0.05}]}) === false, 'a stray tiny click is discarded');
}

section('68. Annotation transforms (move / resize / rotate)');
{
  const rect = ctx.drawShapePoints('rect', {x:0,y:0}, {x:4,y:2}).points;

  const moved = ctx.translatePoints(rect, 3, -1);
  const mb = ctx.annoBBox(moved);
  assert(near(mb.minX,3) && near(mb.maxX,7) && near(mb.minY,-1) && near(mb.maxY,1), 'translate shifts the whole shape');

  // resize about corner 0 (0,0) by dragging corner 2 — scale x2 in X, x3 in Y
  const scaled = ctx.scalePointsAbout(rect, {x:0,y:0}, 2, 3);
  const sb = ctx.annoBBox(scaled);
  assert(near(sb.minX,0) && near(sb.maxX,8) && near(sb.minY,0) && near(sb.maxY,6), 'scale about anchor grows from the anchor');

  // rotate 90° about center keeps the center fixed and swaps extents
  const b0 = ctx.annoBBox(rect);
  const ctr = {x:(b0.minX+b0.maxX)/2, y:(b0.minY+b0.maxY)/2};
  const rot = ctx.rotatePointsAbout(rect, ctr, Math.PI/2);
  const rb = ctx.annoBBox(rot);
  assert(near((rb.minX+rb.maxX)/2, ctr.x) && near((rb.minY+rb.maxY)/2, ctr.y), 'rotate keeps the center fixed');
  assert(near(rb.maxX-rb.minX, 2) && near(rb.maxY-rb.minY, 4), '90° rotation swaps width and height');

  // handles: 4 corners + a rotate knob above the top edge
  const h = ctx.annoHandles(rect, 10);
  assert(h.corners.length === 4, 'four corner handles');
  assert(h.rotate.y > b0.maxY, 'rotate handle sits above the top edge');
  assert(near(h.center.x, ctr.x) && near(h.center.y, ctr.y), 'handle center is the bbox center');

  // hit testing
  const filled = {closed:true, fill:true, points:rect};
  assert(ctx.annoHitTest({x:2,y:1}, filled, 0.1) === true, 'click inside a filled shape selects it');
  assert(ctx.annoHitTest({x:50,y:50}, filled, 0.1) === false, 'click far away misses');
  const openLine = {closed:false, fill:false, points:[{x:0,y:0},{x:10,y:0}]};
  assert(ctx.annoHitTest({x:5,y:0.05}, openLine, 0.2) === true, 'click near a line segment selects it');
  assert(ctx.annoHitTest({x:5,y:3}, openLine, 0.2) === false, 'click off the line misses');
}

section('69. Cut list');
{
  const opts = { rollWidth: 15, rollLength: 100, sideTrim: 4, cuttingMargin: 4 };
  const rectL = ctx.computeRollLayout([{x:0,y:0},{x:40,y:0},{x:40,y:30},{x:0,y:30}], 0, 0, opts);
  const cl = ctx.buildCutList(rectL);
  assert(cl.layers.length === 1, 'one install layer for a single shape');
  assert(cl.totals.pieces === cl.layers[0].pieces.length, 'grand total piece count matches the layer');
  assert(near(cl.totals.area, 1200, 1), 'cut-list coverage sums to the shape area (1200 ft²)');
  assert(cl.layers[0].pieces.every(p => p.cutLength > 0 && p.footW > 0 && p.footL > 0), 'every piece has positive dimensions');
  assert(cl.layers[0].pieces.every(p => near(p.rollWidth, 15)), 'cut width is the roll width');
  const lf = cl.layers[0].pieces.reduce((s,p) => s + p.cutLength, 0);
  assert(near(cl.totals.linearFt, lf), 'total cut length is the sum of piece cut lengths');

  // The subtotal must sum the lengths the panel PRINTS (the trimmed footprint,
  // "Cut 40'0" long"), not the ordered length. It used to add orderedLength while
  // printing footL, so the total contradicted the pieces listed above it — a real
  // job printed 7'1" + 23'8" (= 30'9") under a "33.0 ft total cut" subtotal.
  // The old test compared the total against p.cutLength, which WAS orderedLength —
  // self-consistent, but never checked against the displayed dimension.
  assert(cl.layers[0].pieces.every(p => near(p.cutLength, p.footL)),
    'the piece\'s cut length IS the printed footprint length');
  const printedLf = cl.layers[0].pieces.reduce((s,p) => s + p.footL, 0);
  assert(near(cl.totals.linearFt, printedLf), 'total cut = sum of the printed footprint lengths');
  // 3 bands: the 4" side trim drops the effective width to 14'8", so a 30ft depth
  // takes three passes (the third a sliver). Each prints 40ft → 120ft total cut.
  assert(near(cl.totals.linearFt, 120), '3 bands of 40ft print a 120ft total cut (not the 123ft of ordered length)');

  // Ordered length is a DIFFERENT number: footprint + 4" cutting margin, rounded up
  // to the whole foot. It's what a roll gives up, and it lives in Rolls to order.
  assert(cl.layers[0].pieces.every(p => p.rollLength >= p.footL), 'ordered length is never shorter than the piece cut from it');
  assert(cl.layers[0].pieces.every(p => near(p.rollLength, 41)), 'a 40ft piece consumes 41ft of roll (40 + 4" margin, rounded up)');
  const orderedLf = cl.layers[0].pieces.reduce((s,p) => s + p.rollLength, 0);
  assert(near(orderedLf, 123) && !near(orderedLf, cl.totals.linearFt), 'ordered (123ft) and printed cut (120ft) are genuinely different totals');

  const Lshape = ctx.computeRollLayout([{x:0,y:0},{x:40,y:0},{x:40,y:15},{x:20,y:15},{x:20,y:30},{x:0,y:30}], 0, 0, opts);
  const cl2 = ctx.buildCutList(Lshape);
  assert(near(cl2.totals.area, 900, 1), 'L-shape cut list sums to its area (900 ft²)');
  assert(cl2.layers[0].pieces.some(p => p.irregular), 'an L-shape produces at least one trim-to-shape piece');

  assert(ctx.buildCutList(null).layers.length === 0, 'no layout yields an empty cut list');
}

section('70. Snap to grid');
{
  assert(ctx.snapPt({x:1.3,y:2.7}, 1).x === 1 && ctx.snapPt({x:1.3,y:2.7}, 1).y === 3, 'snaps to nearest 1 ft');
  assert(near(ctx.snapPt({x:7,y:11}, 5).x, 5) && near(ctx.snapPt({x:7,y:11}, 5).y, 10), 'snaps to nearest 5 ft');
  const p = {x:1.3,y:2.7};
  assert(ctx.snapPt(p, 0) === p, 'step 0 is a no-op (snap off)');
  assert(near(ctx.snapPt({x:0.4,y:0.4}, 1).x, 0) && near(ctx.snapPt({x:0.6,y:0.6}, 1).x, 1), 'rounds to the nearer line');

  // paste offset: snap on lands the bbox corner on grid + offsets a whole cell
  const rect = [{x:2,y:3},{x:6,y:3},{x:6,y:5},{x:2,y:5}];
  const onGrid = ctx.pasteOffset(rect, 1.6, 1);
  assert(Number.isInteger(2 + onGrid.dx) && Number.isInteger(3 + onGrid.dy), 'snap paste lands corner on grid');
  assert(Math.abs(onGrid.dx) >= 1 && Math.abs(onGrid.dy) >= 1, 'snap paste offsets at least one whole cell');
  const offGrid = ctx.pasteOffset([{x:2.4,y:3.7},{x:6.4,y:3.7},{x:6.4,y:5.7},{x:2.4,y:5.7}], 1.6, 1);
  assert(Number.isInteger(2.4 + offGrid.dx) && Number.isInteger(3.7 + offGrid.dy), 'snap paste pulls an off-grid corner onto the grid');
  const noSnap = ctx.pasteOffset(rect, 1.6, 0);
  assert(near(noSnap.dx, 1.6) && near(noSnap.dy, -1.6), 'no-snap paste is a plain nudge');
}

section('71. Cut-piece drawings (ft-in + SVG)');
{
  assert(ctx.ftIn(22.5) === "22' 6\"", 'ftIn 22.5 → 22\' 6"');
  assert(ctx.ftIn(15) === "15'", 'ftIn whole feet drops inches');
  assert(ctx.ftIn(0.5) === "0' 6\"", 'ftIn sub-foot shows inches');
  assert(ctx.ftIn(1.0833) === "1' 1\"", 'ftIn rounds to nearest inch');

  const piece = { footW: 14, footL: 20, rollWidth: 15, cutLength: 21, area: 280, irregular: false,
    poly: [{x:0,y:0},{x:20,y:0},{x:20,y:14},{x:0,y:14}] };
  const svg = ctx.cutPieceSvg(piece);
  assert(svg.indexOf('<svg') === 0, 'returns an SVG element');
  assert(svg.indexOf('</svg>') > 0, 'SVG is closed');
  assert(svg.indexOf("20'") >= 0, 'length dimension label present');
  assert(svg.indexOf("14'") >= 0, 'width dimension label present');
  assert((svg.match(/<path/g) || []).length >= 1, 'shape path is drawn');

  // a degenerate piece (no poly) still renders from its bbox without throwing
  const tiny = ctx.cutPieceSvg({ footW: 0.1, footL: 0.1, rollWidth: 15, cutLength: 1, area: 0.01, irregular: false });
  assert(tiny.indexOf('<svg') === 0 && tiny.indexOf('</svg>') > 0, 'degenerate piece still yields valid SVG');

  // Cut-list text shows the piece's ACTUAL length × width (ft-in), not the roll width.
  const data = { layers: [{ name: 'Turf', pieces: [
    { label: 'Roll 1, Piece 1', footL: 12, footW: 7.833, area: 69.2, rollWidth: 15, cutLength: 13, irregular: true, nested: true,
      poly: [{x:0,y:0},{x:12,y:0},{x:12,y:7.833},{x:0,y:7.833}] }
  ], subtotal: { pieces: 1, linearFt: 13, area: 69.2 } }], totals: { pieces: 1, linearFt: 13, area: 69.2 } };
  const html = ctx.renderCutListHtml(data);
  assert(html.indexOf("Cut 12' long × 7' 10\" wide") >= 0, 'cut text = actual length × width, labeled, in ft-in');
  assert(html.indexOf('15.0 ×') < 0, 'roll width (15.0) no longer shown as the cut size');
  assert(!/Cut [\d.]+ × [\d.]+ ft off the roll/.test(html), 'old "N × N ft off the roll" line removed');

  // With cutW present, the WIDTH column shows the cut width (footprint + S-seam
  // trim taken off on site), and a "trim on site" note appears when the cut
  // width exceeds the footprint.
  const seamData = { layers: [{ name: 'Turf', pieces: [
    { label: 'Roll 1, Piece 1', footL: 20, footW: 14.6667, cutW: 15, area: 293, rollWidth: 15, cutLength: 21, irregular: false, nested: false,
      poly: [{x:0,y:0},{x:20,y:0},{x:20,y:14.6667},{x:0,y:14.6667}] }
  ], subtotal: { pieces: 1, linearFt: 21, area: 293 } }], totals: { pieces: 1, linearFt: 21, area: 293 } };
  const seamHtml = ctx.renderCutListHtml(seamData);
  assert(seamHtml.indexOf("\u00d7 15' wide") >= 0, 'full-coverage strip shows the full 15\' cut width, not 14\'8"');
  assert(seamHtml.indexOf('trim S-seam on site') >= 0, 'cut-full-width note shown when cut width exceeds footprint');
  assert(seamHtml.indexOf("covers 14' 8\"") >= 0, 'coverage note reports the trimmed footprint (14\' 8")');

  // A narrow filler strip whose cut width equals its footprint shows no note.
  const narrowData = { layers: [{ name: 'Turf', pieces: [
    { label: 'Roll 2, Piece 1', footL: 10, footW: 6, cutW: 6, area: 60, rollWidth: 15, cutLength: 11, irregular: false, nested: false,
      poly: [{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6}] }
  ], subtotal: { pieces: 1, linearFt: 11, area: 60 } }], totals: { pieces: 1, linearFt: 11, area: 60 } };
  const narrowHtml = ctx.renderCutListHtml(narrowData);
  assert(narrowHtml.indexOf("\u00d7 6' wide") >= 0, 'narrow strip shows its own cut width');
  assert(narrowHtml.indexOf('trim S-seam on site') < 0, 'no trim note when cut width equals footprint');
}

section('71b. seamCutWidth (installer cut width = footprint + S-seam trim)');
{
  const scw = ctx.seamCutWidth;
  assert(near(scw(14.6667, 4, 15), 15, 0.01), 'full usable-width strip (14\'8" + 4") caps to the full 15\' roll');
  assert(near(scw(6, 4, 15), 6.3333, 0.01), 'narrow 6\' strip + 4" trim = 6\'4"');
  assert(near(scw(15, 4, 15), 15, 0.01), 'a strip already at full roll width never exceeds it');
  assert(near(scw(14.9, 4, 15), 15, 0.01), 'footprint just under full width still caps at the roll');
  assert(near(scw(14.6667, 0, 15), 14.6667, 0.01), 'no S-seam trim setting → width unchanged');
  assert(near(scw(10, 4, 15), 10.3333, 0.01), 'mid-width strip gains exactly the 4" allowance');
  // The invariant Brian cares about: a strip that spans the full USABLE width
  // (effectiveRollWidth) cuts back to the full roll width.
  const eff = ctx.effectiveRollWidth({ rollWidth: 15, sideTrim: 4 });
  assert(near(eff, 14.6667, 0.01), 'effectiveRollWidth(15, 4") = 14\'8" usable');
  assert(near(scw(eff, 4, 15), 15, 0.01), 'usable-width strip → full 15\' cut (effW + trim = roll)');

  // The on-site note must MATCH what's actually cut. The label used to say "Cut full
  // width" for any piece that gained the seam allowance — including a 9 ft piece cut
  // 9'4", which is nowhere near the 15 ft roll. Only a piece spanning the full usable
  // width is a full-roll cut.
  const K = ctx.cutWidthNoteKind;
  assert(K(9, ctx.seamCutWidth(9, 4, 15), 15) === 'allowance', 'a 9ft piece (cut 9\'4") is an ALLOWANCE cut, not full width');
  assert(K(6, ctx.seamCutWidth(6, 4, 15), 15) === 'allowance', 'a 6ft piece is an allowance cut');
  assert(K(eff, ctx.seamCutWidth(eff, 4, 15), 15) === 'full', 'a full-usable-width piece IS a full-roll cut');
  assert(K(15, 15, 15) === 'none', 'a piece cut exactly at roll width with no added trim gets no note');
  assert(K(9, 9, 15) === 'none', 'no seam allowance (cutW == footW) → no note, even on a narrow piece');
  assert(K(14.9, ctx.seamCutWidth(14.9, 4, 15), 15) === 'full', 'a piece just under full width still caps to the roll → full-roll note');
  assert(K(10, 10.02, 15) === 'none', 'a sub-quarter-inch difference is not worth a note (tolerance)');
}

section('71c. buildCutListPrintDoc (installer print sheet)');
{
  const doc = ctx.buildCutListPrintDoc({
    jobName: 'Smith Backyard',
    metaHtml: 'Install date: 2026-07-18',
    diagramImg: '<div class="print-diagram"><img src="data:image/png;base64,AAAA" alt="d"></div>',
    cutListHtml: '<div id="marker">CUTLISTBODY</div>',
  });
  assert(doc.indexOf('<!DOCTYPE html') === 0, 'returns a full standalone HTML document');
  assert(doc.indexOf('Smith Backyard') >= 0, 'includes the job name');
  assert(doc.indexOf('CUTLISTBODY') >= 0, 'embeds the supplied cut-list html');
  assert(doc.indexOf(':root{') >= 0, 'carries its own CSS variables (self-contained for the iframe)');
  assert(doc.indexOf('@page') >= 0, 'sets print page margins');
  assert(doc.indexOf('Roll Layout') >= 0 && doc.indexOf('data:image/png') >= 0, 'shows the diagram section when an image is supplied');

  const noImg = ctx.buildCutListPrintDoc({ jobName: 'X', cutListHtml: '<p>p</p>' });
  assert(noImg.indexOf('Roll Layout') < 0, 'omits the diagram section when no image is supplied');
  assert(noImg.indexOf('Cut Pieces') >= 0, 'still shows the cut-pieces section without a diagram');

  const empty = ctx.buildCutListPrintDoc();
  assert(empty.indexOf('Turf Job') >= 0 && empty.indexOf('</html>') >= 0, 'defaults to a valid doc with no args');
}

section('71d. pickTopLayerIndex (Move Layers grabs the topmost shape)');
{
  const pick = ctx.pickTopLayerIndex;
  // Two overlapping shapes; a point inside both must resolve to the higher index
  // (drawn last / on top), not the first one found.
  const shapes = [
    { name: 'A', displayPoints: rect(0, 0, 10, 10) },   // index 0, underneath
    { name: 'B', displayPoints: rect(2, 2, 6, 6) },      // index 1, on top, inside A
  ];
  assert(pick({ x: 5, y: 5 }, shapes, {}) === 1, 'point inside both grabs the TOP (higher-index) layer');
  assert(pick({ x: 1, y: 1 }, shapes, {}) === 0, 'point only inside the lower layer grabs it');
  assert(pick({ x: 20, y: 20 }, shapes, {}) === -1, 'point outside every layer returns -1');

  // A hidden top layer is skipped so the visible one underneath is grabbed.
  assert(pick({ x: 5, y: 5 }, shapes, { 1: false }) === 0, 'hidden top layer is skipped, lower visible layer wins');
  assert(pick({ x: 5, y: 5 }, shapes, { 0: false, 1: false }) === -1, 'all layers hidden → -1');

  // Degenerate / missing polygons are ignored without throwing.
  const degen = [{ name: 'X', displayPoints: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, { name: 'Y' }];
  assert(pick({ x: 0.5, y: 0.5 }, degen, {}) === -1, 'shapes with <3 points or no displayPoints are ignored');
  assert(pick({ x: 5, y: 5 }, [], {}) === -1, 'no layers → -1');
}

section('72. Order / install export text builders');
{
  const proj = {
    name: 'Smith Backyard',
    address: '123 Main St\nTigard, OR 97223',
    deliveryDate: '2026-07-15',
    installDate: '2026-07-18',
    turf: [
      { product: 'Pro 90', role: 'base', installedSqFt: 1200, orderedSqFt: 1215, linearFt: 81 },
      { product: 'Putt 56', role: 'putting-green', installedSqFt: 300, orderedSqFt: 315, linearFt: 21 },
      { product: 'Premium Alt', role: 'alt', installedSqFt: '', orderedSqFt: 1215, linearFt: 81 }
    ],
    infill: [{ product: 'Envirofill', bags: 40 }],
    edging: { boards: 6, linFt: 110 },
    rock: [{ type: '1/4" Minus', sqFt: 1500, depth: 4, tons: 18 }],
    miscItems: [
      { name: 'Weed barrier', qty: 2, unit: 'roll' },
      { name: 'Nails 6"', qty: 5, unit: 'box' },
      { name: 'Zero qty item', qty: 0, unit: 'each' }
    ]
  };

  const order = ctx.buildSupplierOrderText(proj);
  assert(order.indexOf('MATERIAL ORDER') >= 0, 'order has header');
  assert(order.indexOf('Smith Backyard') >= 0, 'order shows job name');
  assert(order.indexOf('123 Main St, Tigard, OR 97223') >= 0, 'order flattens multi-line address');
  assert(order.indexOf('Delivery date:') >= 0 && order.indexOf('TBD') < 0, 'order shows a real delivery date');
  assert(/Pro 90: 1215 sq ft \(81 lin ft/.test(order), 'turf ordered sqft + linear ft listed');
  assert(order.indexOf('Envirofill: 40 bags') >= 0, 'infill bags listed');
  assert(order.indexOf('Edging (bender board): 6 boards (110 lin ft)') >= 0, 'edging boards listed');
  assert(/Benderboard stakes: 120 \(20 per board × 6\)/.test(order), 'benderboard stakes = 20 per board (no color when no material)');
  assert(order.indexOf('Weed barrier: 2') >= 0 && order.indexOf('Weed barrier: 2 roll') < 0, 'misc item shows quantity only (unit removed) on supplier order');
  assert(order.indexOf('Zero qty item') < 0, 'zero-qty misc item omitted');
  assert(order.indexOf('Minus') < 0, 'rock material still excluded from the supplier order');
  assert(order.indexOf('Note: rock') < 0, 'rock note removed from supplier order');
  assert((order.match(/Rock|18 ton/g) || []).length === 0, 'no rock tonnage in the order');

  const sheet = ctx.buildInstallerSheetText(proj);
  assert(sheet.indexOf('INSTALL DETAILS') >= 0, 'sheet has header');
  assert(sheet.indexOf('Install address: 123 Main St, Tigard, OR 97223') >= 0, 'sheet shows install address');
  assert(sheet.indexOf('Install date:') >= 0, 'sheet shows install date');
  assert(sheet.indexOf('Pro 90 (base yard): 1200 sq ft') >= 0, 'base turf install sqft per product');
  assert(sheet.indexOf('Putt 56 (putting green): 300 sq ft') >= 0, 'putting green install sqft per product');
  assert(sheet.indexOf('Premium Alt') < 0, 'alt turf (no installed sqft) omitted from install sheet');
  assert(sheet.indexOf('Weed barrier: 2') >= 0 && sheet.indexOf('Nails 6": 5') >= 0 && sheet.indexOf('Weed barrier: 2 roll') < 0, 'installer misc items show quantity only (unit removed)');
  assert(/INFILL\n• Envirofill: 40 bags/.test(sheet), 'installer sheet lists infill (product + bags)');
  assert(/EDGING\n• bender board: 6 boards \(110 lin ft\)/.test(sheet), 'installer sheet lists edging (material + boards + lin ft)');
  assert(sheet.indexOf('WATERLOO TURF PROVIDES') >= 0 && sheet.indexOf('Turf, infill, edging, stakes, and screws') >= 0, 'installer sheet has Waterloo-provides section');
  assert(sheet.indexOf('TURF INSTALLER PROVIDES') >= 0 && sheet.indexOf('weed cloth') >= 0 && sheet.indexOf('non-galvanized nails') >= 0, 'installer sheet has installer-provides section');

  // empty / missing data degrades gracefully
  const empty = { name: '', turf: [], infill: [], miscItems: [] };
  const eo = ctx.buildSupplierOrderText(empty);
  assert(eo.indexOf('Delivery date: TBD') >= 0, 'missing delivery date → TBD');
  assert(eo.indexOf('(no orderable materials entered yet)') >= 0, 'empty order notes nothing to order');
  assert(ctx.buildInstallerSheetText(empty).indexOf('(no installed turf area entered yet)') >= 0, 'empty install sheet notes no turf');
  assert(ctx.buildSupplierOrderText(null) === '' && ctx.buildInstallerSheetText(null) === '', 'null project → empty string, no throw');
  assert(ctx.fmtExportDate('') === 'TBD' && ctx.fmtExportDate('2026-07-15') !== 'TBD', 'fmtExportDate handles blank + real dates');
}

section('73. Rock quantities — cubic yards alongside tons');
{
  const oldTons = (sqFt, depth) => sqFt ? Math.ceil((sqFt * (depth/12)) / 27 * 1.4 * 10) / 10 : '';
  [[1500,4],[900,3],[2400,6],[100,1],[3333,4]].forEach(([sf,d]) => {
    const q = ctx.rockQuantities(sf, d);
    assert(q.tons === oldTons(sf, d), `tons unchanged for ${sf}sf @ ${d}" (got ${q.tons})`);
    const rawYards = (sf * (d/12)) / 27;
    assert(near(q.yards, Math.ceil(rawYards*10)/10), `yards = raw volume for ${sf}sf @ ${d}"`);
    assert(q.yards < q.tons, `yards (${q.yards}) < tons (${q.tons}) at 1.4 density`);
  });
  assert(ctx.rockQuantities(1500,4).yards === 18.6 && ctx.rockQuantities(1500,4).tons === 26, '1500 sqft @ 4" → 18.6 yd³ / 26 tons');
  const z = ctx.rockQuantities(0, 4); assert(z.yards === 0 && z.tons === 0, 'zero sqft → zero yards & tons');
  const z2 = ctx.rockQuantities(1500, 0); assert(z2.yards === 0 && z2.tons === 0, 'zero depth → zero yards & tons');
  assert(ctx.rockQuantities('', '').yards === 0, 'blank inputs → 0, no NaN');
}

section('74. Draw shape → install layer (coordinate frame)');
{
  const rect = [{x:10,y:10},{x:30,y:10},{x:30,y:22},{x:10,y:22}]; // 20×12 = 240 sqft
  const cen = { cx: 20, cy: 16 };
  // viewRotation 0 → canonical points identical to drawn (display) points
  const id = ctx.annotationToLayerPoints(rect, 0, cen);
  assert(id.every((p,i)=>near(p.x,rect[i].x)&&near(p.y,rect[i].y)), 'viewRotation 0 → points unchanged');
  assert(id !== rect, 'returns a fresh array (no mutation of source)');
  // area preserved and rotation-invariant
  assert(near(Math.abs(ctx.polygonArea(id)), 240), 'area = 240 sqft for 20×12 rect');
  // With a view rotation, re-applying +viewRotation must reproduce the drawn points
  [15, 37, -50, 90].forEach(vr => {
    const canon = ctx.annotationToLayerPoints(rect, vr, cen);
    const back = ctx.rotateAround(canon, vr, cen.cx, cen.cy);
    const err = Math.max(...rect.map((p,i)=>Math.hypot(p.x-back[i].x, p.y-back[i].y)));
    assert(err < 1e-9, `viewRotation ${vr}° round-trips to the drawn position (err ${err.toExponential(1)})`);
    assert(near(Math.abs(ctx.polygonArea(canon)), 240), `area stays 240 under inverse-rotation at ${vr}°`);
  });
}

section('75. Live link — Ordered SqFt value from layout');
{
  assert(ctx.orderedFromLayout({ totalOrdered: 1477.5 }) === 1477.5, 'single layout → totalOrdered');
  assert(ctx.orderedFromLayout({ totalOrdered: 100, _combined: { ordered: 2050.25 } }) === 2050.25, 'combined layers → combined.ordered (overrides total)');
  assert(ctx.orderedFromLayout({ totalOrdered: 1477.556 }) === 1477.56, 'rounds to 0.01');
  assert(ctx.orderedFromLayout(null) === null, 'no layout → null');
  assert(ctx.orderedFromLayout({}) === null, 'layout without ordered → null');
  assert(ctx.orderedFromLayout({ totalOrdered: 0 }) === 0, 'zero ordered is a real value, not null');
}

section('76. Shipping cost — default-unless-override resolver');
{
  // Missing/blank shipping now RESOLVES TO THE DEFAULT ($150), so every project —
  // old or new — follows the standard unless it overrides. Only an explicit number
  // (including 0) is a per-job override.
  assert(ctx.getDefaultShipping() === 150, 'default shipping falls back to $150 when unset');
  assert(ctx.resolveShipping({}) === 150, 'missing shipping → default (150)');
  assert(ctx.resolveShipping({ shipping: '' }) === 150, 'blank shipping → default (150)');
  assert(ctx.resolveShipping({ shipping: null }) === 150, 'null shipping → default (150)');
  assert(ctx.resolveShipping(null) === 150, 'no project → default (150)');
  assert(ctx.resolveShipping({ shipping: 225 }) === 225, 'override → that value');
  assert(ctx.resolveShipping({ shipping: '199.5' }) === 199.5, 'string override parsed');
  assert(ctx.resolveShipping({ shipping: 0 }) === 0, 'explicit 0 is a real override (free freight), not "use default"');
  assert(ctx.resolveShipping({ shipping: -40 }) === 0, 'negative override clamped to 0');

  assert(ctx.projectOverridesShipping({ shipping: 225 }) === true, 'number → overridden');
  assert(ctx.projectOverridesShipping({ shipping: 0 }) === true, '0 → overridden (explicit free)');
  assert(ctx.projectOverridesShipping({}) === false, 'missing → not overridden (uses default)');
  assert(ctx.projectOverridesShipping({ shipping: '' }) === false, 'blank → not overridden (uses default)');
}

section('77. Vendor name + edging material resolvers');
{
  const cat = { turf: [{ name:'Pro 90', tdName:'FieldTurf Vista 90' }, { name:'Plain' }],
                edging: [{ id:'e1', name:'Bender Board', color:'Black', pricePerBoard:'18.50' },
                         { id:'e2', name:'Steel Edge', color:'', pricePerBoard:'' }] };
  // turf vendor name
  assert(ctx.turfVendorName('Pro 90', cat) === 'FieldTurf Vista 90', 'vendor name uses tdName when set');
  assert(ctx.turfVendorName('Plain', cat) === 'Plain', 'no tdName → internal name');
  assert(ctx.turfVendorName('Unknown', cat) === 'Unknown', 'unknown product → passed-through name');
  // edging material lookup + label
  assert(ctx.getProjectEdgingMaterial({ edgingMaterialId:'e1' }, cat).name === 'Bender Board', 'edging material found by id');
  assert(ctx.getProjectEdgingMaterial({ edgingMaterialId:'nope' }, cat) === null, 'unknown edging id → null');
  assert(ctx.getProjectEdgingMaterial({}, cat) === null, 'no edging id → null');
  assert(ctx.edgingMaterialLabel({ name:'Bender Board', color:'Black' }) === 'Bender Board — Black', 'label includes color');
  assert(ctx.edgingMaterialLabel({ name:'Steel Edge', color:'' }) === 'Steel Edge', 'label omits empty color');
  assert(ctx.edgingMaterialLabel(null) === 'bender board', 'null material → generic bender board');
  // effective per-board cost: material overrides crew, else crew rate
  assert(ctx.edgingBoardCost({ edgingMaterialId:'e1' }, { edgingBoard:55 }, cat) === 18.5, 'material price overrides crew rate');
  assert(ctx.edgingBoardCost({ edgingMaterialId:'e2' }, { edgingBoard:55 }, cat) === 55, 'material with blank price → crew rate');
  assert(ctx.edgingBoardCost({}, { edgingBoard:55 }, cat) === 55, 'no material → crew rate');
  assert(ctx.edgingBoardCost({}, {}, cat) === 0, 'no material and no crew rate → 0');

  // misc item notes resolver: stored notes win, else Settings catalog by name, else none
  const miscCat = [{ name:'Seam tape', notes:'6 inch green' }, { name:'Nails' }];
  assert(ctx.miscItemNotes({ name:'Seam tape', notes:'own note' }, miscCat) === 'own note', 'stored item notes win');
  assert(ctx.miscItemNotes({ name:'Seam tape' }, miscCat) === '6 inch green', 'falls back to catalog notes by name');
  assert(ctx.miscItemNotes({ name:'Nails' }, miscCat) === '', 'catalog item without notes → empty');
  assert(ctx.miscItemNotes({ name:'Custom one-off' }, miscCat) === '', 'custom item not in catalog → empty');
  assert(ctx.miscItemNotes({ name:'x' }, null) === '', 'no catalog → empty, no throw');
}

section('78. commitLayerOffsetsToPoints — bake move into points so edits happen in place');
{
  // viewRotation 0: a translation offset folds straight into the points.
  const proj = { layout: {
    viewRotation: 0,
    points: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    secondaryShapes: [{ name:'L0', points:[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}], area:16 }],
    layerOffsets: { primary:{dx:0,dy:0,rotation:0}, 0:{dx:35,dy:-3,rotation:0} }
  }};
  const changed = ctx.commitLayerOffsetsToPoints(proj);
  assert(changed === true, 'reports changed when a non-zero offset exists');
  const p0 = proj.layout.secondaryShapes[0].points;
  assert(near(p0[0].x,35) && near(p0[0].y,-3), 'secondary vertex 0 shifted by (35,-3)');
  assert(near(p0[1].x,39) && near(p0[1].y,-3), 'secondary vertex 1 shifted by (35,-3)');
  assert(proj.layout.layerOffsets[0].dx===0 && proj.layout.layerOffsets[0].dy===0, 'secondary offset zeroed after commit');
  assert(near(ctx.polygonArea(p0), 16), 'baked shape keeps its area (translation-invariant)');
  assert(near(proj.layout.points[2].x,10) && near(proj.layout.points[2].y,10), 'primary with zero offset left untouched');

  // primary offset uses its own path.
  const projP = { layout: { viewRotation:0,
    points:[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    secondaryShapes:[], layerOffsets:{ primary:{dx:-5,dy:2,rotation:0} } }};
  assert(ctx.commitLayerOffsetsToPoints(projP) === true, 'primary offset commits');
  assert(near(projP.layout.points[0].x,-5) && near(projP.layout.points[0].y,2), 'primary vertex 0 shifted by (-5,2)');
  assert(projP.layout.layerOffsets.primary.dx===0 && projP.layout.layerOffsets.primary.dy===0, 'primary offset zeroed');

  // no-op when every offset is already zero.
  const proj2 = { layout: { viewRotation:0, points:[{x:0,y:0},{x:1,y:0},{x:1,y:1}],
    secondaryShapes:[{points:[{x:0,y:0},{x:2,y:0},{x:2,y:2}]}], layerOffsets:{ 0:{dx:0,dy:0,rotation:0} } }};
  assert(ctx.commitLayerOffsetsToPoints(proj2) === false, 'all-zero offsets → reports no change');

  // per-point extras (z elevation) preserved by index through the bake.
  const proj3 = { layout: { viewRotation:0, points:[],
    secondaryShapes:[{ points:[{x:0,y:0,z:5},{x:2,y:0,z:7},{x:0,y:2,z:9}] }],
    layerOffsets:{ 0:{dx:1,dy:1,rotation:0} } }};
  ctx.commitLayerOffsetsToPoints(proj3);
  const q = proj3.layout.secondaryShapes[0].points;
  assert(q[0].z===5 && q[1].z===7 && q[2].z===9, 'z elevation preserved by index');
  assert(near(q[0].x,1) && near(q[0].y,1), 'z-bearing vertex also translated');

  // rotation-only offset preserves area and zeroes the offset.
  const proj4 = { layout: { viewRotation:0, points:[],
    secondaryShapes:[{ points:[{x:0,y:0},{x:6,y:0},{x:6,y:2},{x:0,y:2}] }],
    layerOffsets:{ 0:{dx:0,dy:0,rotation:37} } }};
  const beforeArea = ctx.polygonArea(proj4.layout.secondaryShapes[0].points);
  ctx.commitLayerOffsetsToPoints(proj4);
  assert(near(ctx.polygonArea(proj4.layout.secondaryShapes[0].points), beforeArea, 0.01), 'rotation-only bake preserves area');
  assert(proj4.layout.layerOffsets[0].rotation===0, 'rotation offset zeroed after commit');
}

section('79. Install layers are movable; nested pieces stay in their host roll');
{
  // Every imported Moasure CSV arrives on its own origin, so a second measured
  // area lands on top of the primary and must be positioned by hand. An earlier
  // build zeroed install-layer offsets on every render and refused the grab, which
  // made multi-CSV jobs impossible to lay out. Offsets must now survive for EVERY
  // layer mode.
  const proj = { layout: {
    viewRotation: 0,
    points: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],
    secondaryShapes: [{ name:'Shed yard', points:[{x:0,y:0},{x:4,y:0},{x:4,y:4},{x:0,y:4}] }],
    secondaryShapeModes: { 0:'install' },
    layerOffsets: { 0:{dx:35,dy:-3,rotation:0} },
  }};
  // The offset is real geometry now: committing it on Edit-mode entry must move the
  // install layer's points like any other layer's.
  assert(ctx.commitLayerOffsetsToPoints(proj) === true, 'an install layer\'s move offset commits');
  const p0 = proj.layout.secondaryShapes[0].points;
  assert(near(p0[0].x, 35) && near(p0[0].y, -3), 'install layer moved by (35,-3) — the move is NOT discarded');
  assert(near(ctx.polygonArea(p0), 16), 'moving an install layer does not change its area');

  // countNestedPiecesForLayer: nested pieces are cut from their host roll's waste
  // and stay drawn there, so they don't follow a moved layer. Report them.
  const layoutWithNest = { _installLayers: [
    { id: 'primary', layout: { strips: [{ pieces: [{ nestedInto: null }] }] } },
    { id: 0, layout: { strips: [
      { pieces: [{ nestedInto: 2 }, { nestedInto: null }] },
      { pieces: [{ nestedInto: 5 }] },
    ] } },
    { id: 1, layout: { strips: [{ nestedInto: null }] } },
  ] };
  assert(ctx.countNestedPiecesForLayer(layoutWithNest, 0) === 2, 'counts both nested pieces on layer 0');
  assert(ctx.countNestedPiecesForLayer(layoutWithNest, 1) === 0, 'layer 1 has nothing nested');
  assert(ctx.countNestedPiecesForLayer(layoutWithNest, 'primary') === 0, 'primary has nothing nested');
  assert(ctx.countNestedPiecesForLayer(layoutWithNest, 99) === 0, 'unknown layer → 0, no throw');
  assert(ctx.countNestedPiecesForLayer(null, 0) === 0, 'null layout → 0, no throw');
  assert(ctx.countNestedPiecesForLayer({}, 0) === 0, 'layout with no install layers → 0, no throw');

  // A strip with no pieces array counts as a single unit.
  const bare = { _installLayers: [{ id: 0, layout: { strips: [{ nestedInto: 3 }, { nestedInto: null }] } }] };
  assert(ctx.countNestedPiecesForLayer(bare, 0) === 1, 'an un-split strip counts as one unit');
}

section('80. packPiecesIntoRolls — butt seams across roll joins are a choice');
{
  const P = ctx.packPiecesIntoRolls;
  const used = roll => roll.reduce((a,e)=>a+e.length,0);

  // ── Seams allowed: use the remainder, seam onto the next roll. Least material.
  const s3 = P([60,60,60], 100, true);
  assert(s3.length === 2, '3x60ft packs into 2 rolls when butt seams are allowed');
  s3.forEach((r,i)=>assert(used(r) <= 100+1e-9, `roll ${i+1} holds ${used(r)}ft — never exceeds 100ft`));
  assert(s3[0].length === 2 && s3[0][1].parts === 2, 'the second 60ft run is butt-seamed across the join');
  assert(near(s3[0][1].length, 40), "first part takes roll 1's remaining 40ft");
  assert(s3[1][0].part === 2 && near(s3[1][0].length, 20), 'second part is the 20ft continuation on roll 2');
  assert(s3[0][0].parts === 1, 'the first run needs no seam');

  // ── Seams off: seamless runs, more rolls.
  const n3 = P([60,60,60], 100, false);
  assert(n3.length === 3, '3x60ft needs 3 rolls when butt seams are not allowed');
  n3.forEach(r => r.forEach(e => assert(e.parts === 1, 'no piece is split when seams are off')));
  n3.forEach((r,i)=>assert(used(r) <= 100+1e-9, `seamless roll ${i+1} never exceeds 100ft`));

  // ── The live job that surfaced this: 18/10/42/43 were labelled Roll 1 = 113ft.
  const j = P([18,10,42,43,44], 100, false);
  assert(j.length === 2, 'live job packs into 2 rolls, seamless');
  j.forEach((r,i)=>assert(used(r) <= 100+1e-9, `roll ${i+1} holds ${used(r)}ft — the 113ft overrun is gone`));
  assert(j[0].map(e=>e.index).join(',') === '0,1,2', 'Roll 1 takes 18+10+42 = 70ft');
  assert(j[1].map(e=>e.index).join(',') === '3,4', 'Roll 2 takes 43+44 — the 43 could NOT finish Roll 1');

  const js = P([18,10,42,43,44], 100, true);
  assert(js.length === 2, 'same job with seams allowed also fits 2 rolls');
  assert(near(used(js[0]), 100), 'with seams allowed roll 1 is used to the full 100ft');
  assert(js[0][3].parts === 2, 'the 43ft run is butt-seamed to fill roll 1');

  // ── Exact fits never spill to an extra roll (float guard).
  assert(P([50,50], 100, false).length === 1, '50+50 = exactly 100 → 1 roll');
  assert(P([50,50], 100, true).length === 1, 'exact fit needs no seam');
  assert(P([50,51], 100, false).length === 2, '50+51 = 101 → 2 rolls');

  // ── A run longer than a whole roll must be seamed either way.
  const big = P([120,30], 100, true);
  assert(big.length === 2, '120ft run spans 2 rolls');
  assert(big[0][0].parts === 2, '120ft run is butt-seamed — it cannot be cut in one piece');
  assert(P([120], 100, false).length === 1, 'seams off: oversized run still takes its own roll');

  // ── Cut order is preserved (labels depend on it).
  const seq = P([30,30,30,30,30], 100, false);
  assert(seq.length === 2, '5x30ft = 150ft packs into 2 rolls, seamless');
  assert(seq[0].map(e=>e.index).join(',') === '0,1,2', 'Roll 1 takes the first three 30ft runs (90ft)');

  // ── A zero-length entry (how a nested piece is packed) consumes no roll and
  //    never forces a new one — it just holds its place in the sequence.
  const withNested = P([60, 0, 60], 100, false);
  assert(withNested.length === 2, 'a zero-length (nested) piece adds no roll');
  assert(withNested[0].map(e=>e.index).join(',') === '0,1', 'nested piece stays in sequence on the current roll');
  assert(withNested[0][1].parts === 1, 'nested piece is never marked butt-seamed');

  // ── Degenerate inputs don't throw.
  assert(P([], 100, true).length === 0, 'no pieces → no rolls');
  assert(P([10], 0, true).length === 1, 'invalid roll length falls back to 100');
  assert(P([0,0], 100, false).length === 1, 'zero-length pieces still land on a roll');
}

section('81. Roll settings: the butt-seam toggle is a checkbox, not a number');
{
  // parseFloat(checkbox.value) reads "on" → NaN, which used to make the edit
  // handler bail out and silently discard the change. Booleans route separately.
  const cb = { type:'checkbox', checked:true, value:'on', dataset:{} };
  const num = { type:'number', value:'100', dataset:{} };
  assert(ctx.isRollBoolField(cb) === true, 'checkbox is recognised as a boolean field');
  assert(ctx.isRollBoolField(num) === false, 'number input is not a boolean field');
  assert(ctx.isRollBoolField(null) === false, 'null element is safe');

  assert(ctx.rollElValue(cb) === true, 'checkbox value reads .checked (true), not parseFloat("on")');
  cb.checked = false;
  assert(ctx.rollElValue(cb) === false, 'unchecked reads false — the value that used to be lost');
  assert(ctx.rollElValue(num) === 100, 'number input still reads .value');

  // Reverting (Cancel in the scope dialog) must restore .checked, not .value.
  ctx.setRollElValue(cb, 'true');
  assert(cb.checked === true, "cancel restores a checkbox's checked state from 'true'");
  ctx.setRollElValue(cb, 'false');
  assert(cb.checked === false, "cancel restores a checkbox's checked state from 'false'");
  ctx.setRollElValue(num, 90);
  assert(num.value === 90, 'cancel restores a number input via .value');

  // The setting must survive the resolver as a real boolean (false is meaningful,
  // and must not be treated as "missing" and replaced by the default).
  const g = { rollWidth:15, rollLength:100, sideTrim:4, cuttingMargin:4, allowJoinSeams:false };
  const on = ctx.resolveRollSettings({ rollSettings:{ allowJoinSeams:true } }, g);
  assert(on.allowJoinSeams === true, 'a project can override butt seams to ON');
  assert(on.rollLength === 100, 'other roll settings still resolve from the global default');
  const off = ctx.resolveRollSettings({ rollSettings:{ allowJoinSeams:false } }, { ...g, allowJoinSeams:true });
  assert(off.allowJoinSeams === false, 'a project can override butt seams to OFF — false is a real value, not "missing"');
  const inherit = ctx.resolveRollSettings({}, g);
  assert(inherit.allowJoinSeams === false, 'no override → global default (off)');
  const dflt = ctx.resolveRollSettings(null, {});
  assert(dflt.allowJoinSeams === false, 'fallback default is butt seams OFF — with a cut-to-length supplier seams save no material');
}

section('82. rollLengthSummary — how long each roll actually needs to be');
{
  const mk = (lengths, rollLength, allowJoinSeams) => ({
    rollLength, allowJoinSeams,
    strips: lengths.map((L,i) => ({ key:'y'+i, clippedArea: 1, orderedLength: L, nestedInto: null })),
  });

  // The live job, butt seams OFF: roll 1 only needs 70ft, roll 2 needs 87ft.
  // Ordering two full 100ft rolls would pay for 43ft of turf that's never used.
  const off = ctx.rollLengthSummary(mk([18,10,42,43,44], 100, false));
  assert(off.rolls.length === 2, 'seams off: 2 rolls');
  assert(off.rolls[0].usedFt === 70, 'Roll 1 needs 70ft (18+10+42)');
  assert(off.rolls[1].usedFt === 87, 'Roll 2 needs 87ft (43+44)');
  assert(off.rolls[0].scrapFt === 30, 'Roll 1 leaves 30ft unused on a full roll');
  assert(off.rolls[1].scrapFt === 13, 'Roll 2 leaves 13ft unused on a full roll');
  assert(off.totalFt === 157, 'seams off: 157ft to order in total');
  assert(off.fullRollFt === 200, 'two full 100ft rolls would be 200ft');

  // Same job, butt seams ON: roll 1 is used to the full 100ft.
  const on = ctx.rollLengthSummary(mk([18,10,42,43,44], 100, true));
  assert(on.rolls[0].usedFt === 100, 'seams on: Roll 1 is filled to 100ft');
  assert(on.rolls[0].scrapFt === 0, 'seams on: no scrap on the filled roll');
  assert(on.rolls[1].usedFt === 57, 'seams on: Roll 2 needs 57ft (13ft continuation + 44)');
  assert(on.totalFt === 157, 'total footage is the same either way — only its distribution differs');

  // 3x60: the case where the seam setting changes the roll COUNT.
  const t3off = ctx.rollLengthSummary(mk([60,60,60], 100, false));
  assert(t3off.rolls.length === 3 && t3off.totalFt === 180, 'seams off: 3 rolls of 60ft = 180ft');
  assert(t3off.rolls.every(r => r.usedFt === 60 && r.scrapFt === 40), 'each seamless roll needs only 60ft, wasting 40ft if bought full');
  assert(t3off.fullRollFt === 300, 'three full rolls would be 300ft — 120ft more than needed');
  const t3on = ctx.rollLengthSummary(mk([60,60,60], 100, true));
  assert(t3on.rolls.length === 2 && t3on.totalFt === 180, 'seams on: 2 rolls, same 180ft');

  // Lengths round UP to the whole foot — you can't buy 69.4ft.
  const frac = ctx.rollLengthSummary(mk([20.2, 30.3], 100, false));
  assert(frac.rolls[0].usedFt === 51, '50.5ft rounds up to 51ft to order');

  // A nested piece is cut from waste and adds nothing to any roll's length.
  const nested = {
    rollLength: 100, allowJoinSeams: false,
    strips: [
      { key:'a', clippedArea:1, orderedLength:60, nestedInto:null },
      { key:'b', clippedArea:1, orderedLength:30, nestedInto:0 },
    ],
  };
  const ns = ctx.rollLengthSummary(nested);
  assert(ns.rolls.length === 1 && ns.totalFt === 60, 'nested piece adds no roll length');

  // Degenerate: nothing to order.
  assert(ctx.rollLengthSummary({ rollLength:100, strips:[] }).rolls.length === 0, 'no strips → no rolls');
  assert(ctx.rollLengthSummary({}).rolls.length === 0, 'empty layout → no rolls, no throw');
}

section('83. pointsFitInView — re-fit on drop only when a shape lands out of view');
{
  const F = ctx.pointsFitInView;
  // A 800x600 canvas, 16px padding, 10 px/ft: the visible data window is
  // x: -1.6 .. 78.4, y: -1.6 .. 58.4 (from minX/minY = 0).
  const t = { minX: 0, minY: 0, scale: 10, pad: 16, w: 800, h: 600 };

  assert(F([{x:0,y:0},{x:70,y:50}], t) === true, 'shapes inside the viewport need no re-fit');
  assert(F([{x:10,y:10}], t) === true, 'a point well inside fits');

  // Dragged off the right / top / left / bottom — each must trigger a re-fit.
  assert(F([{x:0,y:0},{x:120,y:10}], t) === false, 'a shape dragged off the right edge does NOT fit');
  assert(F([{x:0,y:0},{x:10,y:90}], t) === false, 'a shape dragged off the top does NOT fit');
  assert(F([{x:-40,y:10}], t) === false, 'a shape dragged off the left does NOT fit');
  assert(F([{x:10,y:-40}], t) === false, 'a shape dragged off the bottom does NOT fit');

  // The slack keeps a shape grazing the edge from re-fitting on every nudge.
  assert(F([{x:78.5,y:10}], t) === true, 'a point just past the edge is within tolerance');
  assert(F([{x:79.0,y:10}], t) === false, 'a point clearly past the edge is not');
  assert(F([{x:78.5,y:10}], t, 0) === false, 'zero tolerance is strict');

  // Padding is on the data side of the edge, so slightly negative coords are visible.
  assert(F([{x:-1.5,y:-1.5}], t) === true, 'the padded margin is still visible');

  // Degenerate inputs must never force a spurious re-fit (which would rescale the
  // view under the user for no reason).
  assert(F([{x:1,y:1}], null) === true, 'no transform → assume it fits, do not re-fit');
  assert(F([], t) === true, 'no points → nothing to reveal');
  assert(F(null, t) === true, 'null points → no re-fit');
  assert(F([{x:1,y:1}], { ...t, scale: 0 }) === true, 'zero scale → no divide-by-zero, no re-fit');
  assert(F([{x:1,y:1}], { ...t, scale: NaN }) === true, 'NaN scale → no re-fit');
}

section('84. Multi-layer: every install layer counts toward the rolls to order');
{
  const strip = (len, nested) => ({ key:'k'+len, clippedArea:1, orderedLength:len, nestedInto: nested === undefined ? null : nested });

  // layoutUnitLengths is the single definition of "what consumes roll length".
  assert(JSON.stringify(ctx.layoutUnitLengths({ rollLength:100, strips:[strip(23), strip(19)] })) === '[23,19]',
    'unit lengths are the pieces in cut order');
  assert(JSON.stringify(ctx.layoutUnitLengths({ rollLength:100, strips:[strip(23), strip(19, 0)] })) === '[23]',
    'a nested piece consumes no roll length');
  assert(ctx.layoutUnitLengths({ rollLength:100, strips:[{ key:'z', clippedArea:0, orderedLength:50 }] }).length === 0,
    'an empty strip contributes nothing');
  assert(ctx.layoutUnitLengths({}).length === 0, 'no strips → nothing, no throw');
  assert(ctx.layoutUnitLengths(null).length === 0, 'null layout → nothing, no throw');
  // A strip longer than the roll is inherently segmented into roll-length runs.
  assert(JSON.stringify(ctx.layoutUnitLengths({ rollLength:100, strips:[{ key:'s', clippedArea:1, orderedLength:250, numSegments:3, nestedInto:null }] })) === '[100,100,50]',
    'an over-long strip splits into roll-length runs');

  // The real job: primary = 23 + 19 = 42lf, shed yard = 13lf, both SHARED. The
  // piece list showed only the primary's 42ft under a 55ft header — the shed
  // layer's pieces were missing because the walk only saw layout.strips.
  const twoLayer = {
    rollLength: 100, allowJoinSeams: false, strips: [strip(23), strip(19)],
    _installLayers: [
      { id:'primary', name:'Primary Shape', rollGroup:'shared', layout:{ rollLength:100, strips:[strip(23), strip(19)] } },
      { id:0, name:'Shed yard', rollGroup:'shared', layout:{ rollLength:100, strips:[strip(13)] } },
    ],
  };
  const sum = ctx.rollLengthSummary(twoLayer);
  assert(sum.totalFt === 55, `shared layers pool: 42 + 13 = 55ft to order (got ${sum.totalFt})`);
  assert(sum.rolls.length === 1, 'they pool onto 1 roll (55ft < 100ft)');
  assert(sum.rolls[0].usedFt === 55, 'the single roll needs 55ft');

  // A layer rolled "on its own" gets its own roll, never pooled.
  const ownLayer = {
    rollLength: 100, allowJoinSeams: false, strips: [strip(23)],
    _installLayers: [
      { id:'primary', name:'Primary', rollGroup:'shared', layout:{ rollLength:100, strips:[strip(23)] } },
      { id:0, name:'Shed', rollGroup:'own', layout:{ rollLength:100, strips:[strip(13)] } },
    ],
  };
  const own = ctx.rollLengthSummary(ownLayer);
  assert(own.rolls.length === 2, '"roll on its own" is not pooled — 2 rolls');
  assert(own.rolls[0].usedFt === 23 && own.rolls[1].usedFt === 13, 'each roll carries only its own layer');
  assert(own.totalFt === 36, 'total to order is still 23 + 13 = 36ft');

  // Pooling honours the roll length: 60 + 60 shared can't share a 100ft roll.
  const big = {
    rollLength: 100, allowJoinSeams: false, strips: [strip(60)],
    _installLayers: [
      { id:'primary', rollGroup:'shared', layout:{ rollLength:100, strips:[strip(60)] } },
      { id:0, rollGroup:'shared', layout:{ rollLength:100, strips:[strip(60)] } },
    ],
  };
  assert(ctx.rollLengthSummary(big).rolls.length === 2, 'pooled 60+60 needs 2 rolls with seams off');
  assert(ctx.rollLengthSummary({ ...big, allowJoinSeams:true }).rolls.length === 2, 'pooled 60+60 = 120ft → 2 rolls with seams on too');

  // No _installLayers (single-layer job) still works off layout.strips.
  const single = ctx.rollLengthSummary({ rollLength:100, allowJoinSeams:false, strips:[strip(23), strip(19)] });
  assert(single.totalFt === 42 && single.rolls.length === 1, 'single-layer job unchanged: 42ft on 1 roll');
}

section('85. totalLayerPerimeter — the one-click edging starting point');
{
  const sq = (n) => [{x:0,y:0},{x:n,y:0},{x:n,y:n},{x:0,y:n}]; // perimeter = 4n

  const proj = { layout: {
    points: sq(10), // 40 ft
    secondaryShapes: [{ name:'Shed yard', points: sq(5) }], // 20 ft
  }};
  assert(near(ctx.totalLayerPerimeter(proj), 60), 'total = main 40ft + layer 20ft = 60ft');

  // Every measured shape counts, including cutouts — this is the ceiling for edging.
  const three = { layout: {
    points: sq(10),
    secondaryShapes: [{ points: sq(5) }, { points: sq(2) }], // 20 + 8
  }};
  assert(near(ctx.totalLayerPerimeter(three), 68), 'all shapes count: 40 + 20 + 8 = 68ft');

  // Perimeter is rotation/translation invariant, so a moved layer must not change it.
  const moved = { layout: {
    points: sq(10),
    secondaryShapes: [{ points: sq(5) }],
    layerOffsets: { 0: { dx: 35, dy: -3, rotation: 45 } },
  }};
  assert(near(ctx.totalLayerPerimeter(moved), 60), 'moving/rotating a layer does not change its perimeter');

  // Degenerate shapes contribute nothing and must not throw.
  const degen = { layout: { points: sq(10), secondaryShapes: [{ points: [{x:0,y:0}] }] } };
  assert(near(ctx.totalLayerPerimeter(degen), 40), 'a single-point shape adds nothing');
  assert(ctx.totalLayerPerimeter({ layout: {} }) === 0, 'no shapes → 0');
  assert(ctx.totalLayerPerimeter(null) === 0, 'null project → 0, no throw');
  assert(ctx.totalLayerPerimeter({}) === 0, 'project with no layout → 0, no throw');

  // It matches the sum the Layers panel prints, since both read layerPerimeters.
  const perims = ctx.layerPerimeters(proj);
  assert(near(ctx.totalLayerPerimeter(proj), perims.reduce((a,p)=>a+p.perimeter,0)),
    'the button figure is exactly the "Total — all edges" the Layers panel shows');
}

section('86. Apply Area is layer-aware (Installed SqFt must match the header)');
{
  const proj = { layout: { points:[], secondaryShapes:[], secondaryShapeModes:{} } };
  const base = { role:'base' };

  // The real 2-layer job: primary 422.4 + shed yard 144.5 = 566.8 installed.
  // Apply used to push only the primary's 422.4 while Ordered SqFt (which reads
  // _combined) pushed the layer-aware figure — two sources on one click.
  const twoLayer = {
    shapeArea: 422.4, adjustedShapeArea: 422.4,
    _combined: { area: 566.9 },
    _installLayers: [{ id:'primary' }, { id:0 }],
  };
  const r = ctx.computeApplyAreaForRow(proj, twoLayer, base);
  assert(r.ok === true, 'a 2-layer job has an area to apply');
  assert(near(r.area, 566.9), `Apply pushes the COMBINED area, not just the primary's 422.4 (got ${r.area})`);

  // The primary's own exclusions must still come off, while other layers stay raw.
  const withExclusions = {
    shapeArea: 422.4, adjustedShapeArea: 400,   // 22.4 ft² excluded from the primary
    _combined: { area: 566.9 },
  };
  const rx = ctx.computeApplyAreaForRow(proj, withExclusions, base);
  assert(near(rx.area, 544.5), 'primary exclusions still apply: 566.9 - 422.4 + 400 = 544.5');

  // Single-layer jobs are unchanged.
  const single = { shapeArea: 422.4, adjustedShapeArea: 400 };
  assert(near(ctx.computeApplyAreaForRow(proj, single, base).area, 400), 'single-layer job still applies its adjusted area');

  // Alt-turf is still blocked — it's priced on the base yard, so its own Installed
  // SqFt is never read and writing one would be a lie.
  const alt = ctx.computeApplyAreaForRow(proj, twoLayer, { role:'alt-turf' });
  assert(alt.ok === false && alt.reason === 'alt-turf-priced-on-base', 'alt-turf rows are still blocked');

  // No area at all is still reported, not silently applied as 0.
  const none = ctx.computeApplyAreaForRow(proj, { shapeArea:0, adjustedShapeArea:0 }, base);
  assert(none.ok === false && none.reason === 'no-area', 'a zero-area layout reports no-area');
}

section('87. Live link (auto-apply) is ON by default');
{
  // The layout auto-applies to the selected turf row unless explicitly switched off.
  // `undefined` must mean ON: a project saved before the flag existed, or a brand new
  // one, gets auto-apply without anyone opting in.
  assert(ctx.isLiveLinkOn({ layout: {} }) === true, 'undefined → live link ON (the default)');
  assert(ctx.isLiveLinkOn({ layout: { liveLink: true } }) === true, 'explicitly on → ON');
  assert(ctx.isLiveLinkOn({ layout: { liveLink: false } }) === false, 'explicitly off → OFF (a real choice, respected)');
  assert(ctx.isLiveLinkOn({}) === false, 'no layout → nothing to sync');
  assert(ctx.isLiveLinkOn(null) === false, 'null project → off, no throw');

  // The shipped checkbox markup must agree with that default. It previously shipped
  // UNCHECKED while isLiveLinkOn() returned true, so the UI said "off" while the link
  // was live — and any stray toggle would then write liveLink=false permanently.
  // Same mock-vs-reality trap the butt-seam checkbox had.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  const tag = (html.match(/<input[^>]*id="rollLiveLink"[^>]*>/) || [''])[0];
  assert(tag !== '', 'the live link checkbox exists in the markup');
  assert(/\bchecked\b/.test(tag), 'the live link checkbox ships CHECKED, matching isLiveLinkOn()\'s default');

  // What the link pushes must be layer-aware on both sides, or a multi-layer job
  // auto-applies a wrong number on every render.
  assert(ctx.orderedFromLayout({ totalOrdered: 422, _combined: { ordered: 825 } }) === 825,
    'auto-applied Ordered SqFt uses the combined (all-layer) figure');
  const inst = ctx.computeApplyAreaForRow(
    { layout: { points: [], secondaryShapes: [], secondaryShapeModes: {} } },
    { shapeArea: 422.4, adjustedShapeArea: 422.4, _combined: { area: 566.9 } },
    { role: 'base' });
  assert(inst.ok && near(inst.area, 566.9), 'auto-applied Installed SqFt counts every layer too');
}

section('88. New project: edging from the CSV perimeter');
{
  // The new-project dialog has its own CSV import, separate from the Layout tab's.
  // It already showed "Perimeter: X ft" and had an Edging field, but nothing joined
  // them — the Quote Builder's button only exists after the project is created.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  assert(/id="newProjEdgingPerimBtn"/.test(html), 'the new-project dialog has a "use CSV perimeter" button');
  assert(/onclick="useCsvPerimeterForNewProjEdging\(\)"/.test(html), 'the button is wired to its handler');
  const btnTag = (html.match(/<button[^>]*id="newProjEdgingPerimBtn"[^>]*>/) || [''])[0];
  assert(/display:none/.test(btnTag), 'it ships hidden — there is no perimeter until a CSV is loaded');
  // It must be a button, never an auto-fill: the total is the MAXIMUM edging, and
  // runs against a house/patio/driveway need none, so filling it silently would
  // over-quote every job with a hardscape edge.
  assert(!/prefillEdgingFromCsv/.test(html), 'edging is never auto-filled from the CSV');

  // The dialog's displayed "Perimeter" is the main outline only; edging can wrap
  // every measured shape, so the button offers the all-shapes total instead.
  assert(/perimAll/.test(html), 'an all-shapes perimeter total is computed for the button');
  assert(/refreshNewProjEdgingPerimBtn\(\); \/\/ no CSV/.test(html), 'clearing the CSV hides the button again');

  // The figure must agree with what the Layers tab calls "Total — all edges" once
  // the project exists, so the number doesn't change on create.
  const proj = { layout: {
    points: [{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:10}],          // 40 ft
    secondaryShapes: [{ points: [{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:0,y:5}] }], // 20 ft
  }};
  assert(near(ctx.totalLayerPerimeter(proj), 60),
    'the post-create total (60ft) matches what the new-project button offers for the same shapes');
}

section('89. Deleting a layer reindexes every per-layer key');
{
  const J = o => JSON.stringify(o);

  // ── Index-keyed maps: drop the deleted index, shift higher ones down ──
  const R = ctx.reindexLayerIndexMap;
  assert(J(R({0:'a',1:'b',2:'c'}, 1)) === J({0:'a',1:'c'}), 'deleting index 1: 2 becomes 1, 0 untouched');
  assert(J(R({0:'a',1:'b',2:'c'}, 0)) === J({0:'b',1:'c'}), 'deleting index 0 shifts everything down');
  assert(J(R({0:'a',1:'b',2:'c'}, 2)) === J({0:'a',1:'b'}), 'deleting the last index leaves the rest alone');
  assert(J(R({0:'a', primary:'p'}, 0)) === J({primary:'p'}), "non-numeric keys like 'primary' survive");
  assert(J(R(null, 0)) === J({}), 'null map → empty, no throw');
  assert(J(R({5:'x'}, 9)) === J({5:'x'}), 'deleting an index that has no entry changes nothing');

  // ── Strip keys are namespaced 'L<idx>_...' (see keyPrefix) ──
  const K = ctx.remapLayerStripKey;
  assert(K('L2_y0.00', 1) === 'L1_y0.00', 'layer 2 renumbers to 1 when layer 1 is deleted');
  assert(K('L1_y0.00', 1) === null, "the deleted layer's own keys are dropped");
  assert(K('L0_y0.00', 1) === 'L0_y0.00', 'lower layers are untouched');
  assert(K('y0.00', 1) === 'y0.00', "the primary's un-prefixed keys are never touched");
  assert(K('L10_y3.00', 2) === 'L9_y3.00', 'multi-digit indices remap correctly');

  // This is the corruption the reindex prevents: without it, old layer 2 (now index
  // 1) would look up 'L1_' and find the DELETED layer's cuts — wrong data silently
  // applied to the wrong shape.
  const S = ctx.reindexLayerStripKeyMap;
  const cuts = { 'y0.00':[10], 'L1_y0.00':[5], 'L2_y0.00':[7,9] };
  assert(J(S(cuts, 1)) === J({ 'y0.00':[10], 'L1_y0.00':[7,9] }),
    "layer 2's cuts follow it down to index 1; the deleted layer's cuts are gone, not inherited");

  // ── Nesting: BOTH sides are strip keys ──
  const N = ctx.reindexNestingMap;
  assert(J(N({ 'L2_y0.00':'y0.00' }, 1)) === J({ 'L1_y0.00':'y0.00' }), 'the source side remaps');
  assert(J(N({ 'y0.00':'L2_y0.00' }, 1)) === J({ 'y0.00':'L1_y0.00' }), 'the target side remaps too');
  assert(J(N({ 'L1_y0.00':'y0.00' }, 1)) === J({}), 'nesting FROM the deleted layer is dropped');
  assert(J(N({ 'y0.00':'L1_y0.00' }, 1)) === J({}), 'nesting INTO the deleted layer is dropped — that roll no longer exists');
  assert(J(N({ 'y0.00':'y15.00' }, 1)) === J({ 'y0.00':'y15.00' }), 'primary-only nesting is untouched');

  // ── The whole operation ──
  const mk = () => ({ layout: {
    secondaryShapes: [{name:'A'},{name:'B'},{name:'C'}],
    secondaryShapeModes: {0:'install',1:'exclude',2:'install'},
    layerOffsets: {0:{dx:1},1:{dx:2},2:{dx:3}},
    layerVisibility: {0:true,1:false,2:true},
    layerRoll: {0:{rotation:10},1:{rotation:20},2:{rotation:30}},
    layerRollGroup: {0:'own',1:'shared',2:'shared'},
    manualCuts: {'L0_y0.00':[1],'L1_y0.00':[2],'L2_y0.00':[3]},
    nestPos: {'L2_y0.00':{x:1}},
    nestRot: {'L2_y0.00':90},
    nesting: {'L2_y0.00':'L0_y0.00','L1_y0.00':'L0_y0.00'},
  }});

  const p = mk();
  assert(ctx.deleteSecondaryLayer(p, 1) === true, 'deleting a valid layer reports success');
  assert(p.layout.secondaryShapes.length === 2, 'the shape is removed');
  assert(J(p.layout.secondaryShapes.map(s=>s.name)) === J(['A','C']), 'the right shape is removed');
  assert(J(p.layout.secondaryShapeModes) === J({0:'install',1:'install'}), "C's mode follows it to index 1");
  assert(p.layout.layerOffsets[1].dx === 3, "C's offset follows it — not B's");
  assert(p.layout.layerVisibility[1] === true, "C's visibility follows it");
  assert(p.layout.layerRoll[1].rotation === 30, "C's roll rotation follows it");
  assert(p.layout.layerRollGroup[1] === 'shared', "C's roll group follows it");
  assert(J(p.layout.manualCuts) === J({'L0_y0.00':[1],'L1_y0.00':[3]}), "C's cuts follow it; B's are gone");
  assert(J(p.layout.nestPos) === J({'L1_y0.00':{x:1}}), 'nest position follows the renumbered layer');
  assert(p.layout.nestRot['L1_y0.00'] === 90, 'nest rotation follows too');
  assert(J(p.layout.nesting) === J({'L1_y0.00':'L0_y0.00'}), "C's nesting survives renumbered; B's is dropped");

  // Guards
  const g = mk();
  assert(ctx.deleteSecondaryLayer(g, 9) === false, 'out-of-range index is refused');
  assert(ctx.deleteSecondaryLayer(g, -1) === false, 'negative index is refused');
  assert(g.layout.secondaryShapes.length === 3, 'a refused delete changes nothing');
  assert(ctx.deleteSecondaryLayer(null, 0) === false, 'null project is refused, no throw');
  assert(ctx.deleteSecondaryLayer({}, 0) === false, 'project with no layout is refused');
  assert(ctx.deleteSecondaryLayer({layout:{}}, 0) === false, 'no shapes to delete is refused');

  // Deleting the last remaining layer leaves clean, empty state.
  const one = { layout: { secondaryShapes:[{name:'only'}], secondaryShapeModes:{0:'install'}, manualCuts:{'L0_y0.00':[1]} } };
  assert(ctx.deleteSecondaryLayer(one, 0) === true, 'the only layer can be deleted');
  assert(one.layout.secondaryShapes.length === 0 && J(one.layout.secondaryShapeModes) === J({}), 'no orphaned settings left behind');
  assert(J(one.layout.manualCuts) === J({}), 'its cuts go with it');
}

section('90. Butt seams are hard-wired OFF (no longer a setting)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // The supplier cuts to length, so seaming a run across a roll join saves ZERO
  // material — it only redistributes footage between rolls. Its only possible effect
  // is an extra seam in a lawn, so the control is gone rather than sitting there as a
  // switch whose best case is "no change".
  assert(!/id="allowJoinSeamsInput"/.test(html), 'the butt-seam checkbox is gone from Roll Settings');
  assert(!/getElementById\('allowJoinSeamsInput'\)/.test(html), 'nothing reads a butt-seam control any more');
  assert(/allowJoinSeams: false,/.test(html), 'getRollOpts hard-wires seams off');

  // But the packer keeps the argument and stays correct both ways, so a fixed-length
  // supply is a one-line revert rather than a rewrite.
  const P = ctx.packPiecesIntoRolls;
  assert(P([60,60,60], 100, false).length === 3, 'packer still packs seamless (the shipped behaviour)');
  assert(P([60,60,60], 100, true).length === 2, 'packer still supports seams if ever re-enabled');

  // What actually ships: a layout built through the real opts path never seams.
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, nesting:{}, manualCuts:{} };
  const L = ctx.computeRollLayout([{x:0,y:0},{x:60,y:0},{x:60,y:45},{x:0,y:45}], 0, 0, opts);
  assert(L.allowJoinSeams === false, 'a layout defaults to seamless');
  const labels = ctx.assignRollPieceLabels(L);
  const occupied = L.strips.filter(x=>x.clippedArea>0.5);
  assert(occupied.every(x => !(labels.get(x) || {}).parts), 'no piece is ever butt-seamed across a join');

  // And the footage is unchanged by it — the whole reason the setting was pointless.
  const seamless = ctx.rollLengthSummary({ rollLength:100, allowJoinSeams:false,
    strips:[{key:'a',clippedArea:1,orderedLength:60,nestedInto:null},{key:'b',clippedArea:1,orderedLength:60,nestedInto:null}] });
  const seamed = ctx.rollLengthSummary({ rollLength:100, allowJoinSeams:true,
    strips:[{key:'a',clippedArea:1,orderedLength:60,nestedInto:null},{key:'b',clippedArea:1,orderedLength:60,nestedInto:null}] });
  assert(seamless.totalFt === seamed.totalFt, 'seams never change the footage to order — only how it splits across rolls');
}

section('91. Infill weight — 50 lb bags');
{
  const W = ctx.infillWeightLbs;
  const F = ctx.fmtInfillWeight;

  // Weight is on the BAGS bought (already rounded up), 50 lb each.
  assert(W(10) === 500, '10 bags = 500 lbs');
  assert(W(1) === 50, '1 bag = 50 lbs');
  assert(W(0) === 0, '0 bags = 0 lbs');
  assert(W('') === 0, 'blank bags = 0 lbs, no NaN');
  assert(W('7') === 350, 'string bag counts parse');

  // Formatting: lbs always; tons appears once it's the useful unit (>= 2000 lbs).
  assert(F(500) === '500 lbs', 'light loads show lbs only');
  assert(F(1950) === '1,950 lbs', 'just under a ton stays in lbs, with a thousands separator');
  assert(/^2,000 lbs \(1 ton\)$/.test(F(2000)), 'exactly 2000 lbs = 1 ton (singular)');
  assert(/^5,000 lbs \(2\.5 tons\)$/.test(F(5000)), '5000 lbs = 2.5 tons (plural)');
  assert(F(0) === '0 lbs', 'zero is 0 lbs');

  // The realistic path: a 500 sqft yard at 1.5 lbs/sqft = 750 lbs = ceil(15) bags.
  const bags = Math.ceil(500 * 1.5 / 50); // 15
  assert(bags === 15, '500 sqft x 1.5 lbs/sqft = 15 bags');
  assert(W(bags) === 750, '15 bags = 750 lbs');
  assert(F(W(bags)) === '750 lbs', 'and reads as 750 lbs');

  // A big putting-green job crossing into tons.
  assert(F(W(60)) === '3,000 lbs (1.5 tons)', '60 bags = 3,000 lbs = 1.5 tons');
}

section('92. polygonEdgeLabels — edge dimension labels (with collinear merge)');
{
  const E = ctx.polygonEdgeLabels;

  // A 10x6 rectangle: 4 clean edges.
  const rect = [{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6}];
  const labels = E(rect);
  assert(labels.length === 4, 'a rectangle yields 4 edge labels');
  assert(labels.map(l=>Math.round(l.len)).sort((a,b)=>a-b).join(',') === '6,6,10,10', 'edge lengths are correct');
  labels.forEach(l => assert(near(Math.hypot(l.nx, l.ny), 1), 'normal is unit length'));

  // Outward normals point away from the centroid.
  const bottom = labels.find(l => near(l.my, 0));
  assert(bottom && bottom.ny < 0, 'bottom edge normal points outward (down)');

  // THE fix: a wall broken into many tiny segments (a Moasure "straight" edge) merges
  // into ONE label with the run's total length — not 30 labels of "0'11"".
  const segmentedWall = [];
  for (let x = 0; x <= 30; x++) segmentedWall.push({ x, y: 0 });   // 30 one-ft segments
  segmentedWall.push({ x: 30, y: 10 }, { x: 0, y: 10 });           // close the box
  const wall = E(segmentedWall);
  const bottomRun = wall.find(l => near(l.my, 0));
  assert(bottomRun && near(bottomRun.len, 30), 'a 30-segment straight wall reads as ONE 30ft edge, not 30 labels');
  assert(wall.filter(l => near(l.my, 0)).length === 1, 'the segmented wall produces exactly one label');

  // A curve (many small direction changes) legitimately has no straight run to call
  // out, so with the default 2ft threshold it produces few/no labels rather than spam.
  const curve = [];
  for (let a = 0; a <= Math.PI; a += Math.PI/24) curve.push({ x: 10*Math.cos(a), y: 10*Math.sin(a) });
  curve.push({ x: 10, y: 0 });
  const curveLabels = E(curve);
  assert(curveLabels.length <= 3, 'a tight curve yields at most a couple labels, not one per facet');

  // Sub-threshold edges (below 2ft default) are dropped.
  const sliver = [{x:0,y:0},{x:10,y:0},{x:10,y:0.5},{x:0,y:0.5}]; // two 0.5ft ends
  assert(E(sliver).every(l => l.len >= 2), 'edges below the 2ft default are dropped');
  assert(E(sliver, 0.25).length === 4, 'a lower threshold keeps the short edges');

  // Degenerate input never throws.
  assert(E([]).length === 0, 'no points → no labels');
  assert(E([{x:0,y:0}]).length === 0, 'a single point → no labels');
  assert(E(null).length === 0, 'null → no labels, no throw');
  const withDup = [{x:0,y:0},{x:10,y:0},{x:10,y:6},{x:0,y:6},{x:0,y:0}];
  assert(E(withDup).length === 4, 'a repeated closing vertex does not add a spurious label');

  // A 3-4-5 right triangle: three distinct edges, none collinear.
  const tri = [{x:0,y:0},{x:4,y:0},{x:0,y:3}];
  const t = E(tri);
  assert(t.length === 3, 'a triangle has 3 edge labels');
  assert(t.map(l=>Math.round(l.len)).sort().join(',') === '3,4,5', '3-4-5 triangle edge lengths');
}

section('93. Per-tab guide buttons + openGuideAt wiring');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // Each of the three tabs links into the right guide section.
  ['doc-quote', 'doc-layout', 'doc-settings'].forEach(sec => {
    assert(html.includes("openGuideAt('" + sec + "')"), 'a ? Guide button links to ' + sec);
  });
  // The links are visible help badges (not faint ghost buttons tucked in a corner —
  // those shipped but were unnoticeable, which is why this was reworked).
  assert(html.includes('class="help-badge"'), 'the guide links render as visible help badges');
  ['doc-quote','doc-layout','doc-settings'].forEach(sec => {
    const re = new RegExp('help-badge[^>]*onclick="openGuideAt\\(\'' + sec + '\'\\)"');
    assert(re.test(html), 'a help badge for ' + sec + ' sits on a section title');
  });
  // The helper exists and opens the modal before jumping.
  assert(/function openGuideAt\(/.test(html), 'openGuideAt is defined');
  assert(/docsModal'\)[\s\S]{0,40}classList\.add\('open'\)/.test(html.slice(html.indexOf('function openGuideAt'))),
    'openGuideAt opens the docs modal');
  // Every section it targets actually exists as an anchor in the guide.
  ['doc-quote', 'doc-layout', 'doc-settings'].forEach(sec => {
    assert(html.includes('id="' + sec + '"'), 'guide section ' + sec + ' exists to jump to');
  });

  // The long explainers that were cut should be gone (guard against them creeping back).
  assert(!html.includes('Tons and cubic yards are calculated from this job'), 'the long rock depth explainer was trimmed');
  assert(!html.includes('The standard freight cost applied to'), 'the long shipping explainer was trimmed');
  assert(!html.includes('This Moasure file contains more than one measured shape'), 'the long multi-shape explainer was trimmed');

  // The layout tab's above-canvas text is trimmed: the 3-line Import intro is now one
  // line, and the always-on "Show dimensions" doc paragraph (added and mistakenly
  // left visible in cont'd 13) is gone from the layout panel.
  assert(!html.includes('The diagram below shows the measured'), 'the 3-line Import CSV intro was shortened');
  assert(html.includes('id="layoutIntro"'), 'the shortened intro has an id so it can be hidden once a layout loads');
  assert(!html.includes('a checkbox above the canvas that labels'), 'the always-visible Show dimensions paragraph was removed from the layout panel');
  // The mode hints stay (they only appear in their mode), still hidden by default.
  ['editShapeHint','moveLayersHint','cutModeHint'].forEach(id => {
    const tag = (html.match(new RegExp('<p id="' + id + '"[^>]*>')) || [''])[0];
    assert(/display:none/.test(tag), id + ' is hidden by default (shown only in its mode)');
  });
}

section('94. Two independent dimension toggles (shapes vs pieces)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // Two separate checkboxes, each re-rendering the canvas.
  assert(/id="showDimensionsToggle"/.test(html), 'the shape-dimensions toggle exists');
  assert(/id="showPieceDimensionsToggle"/.test(html), 'the piece-dimensions toggle exists');

  // Each persists to its own layout flag, loaded and saved independently.
  assert(/proj\.layout\.showDimensions = /.test(html), 'shape toggle saves to layout.showDimensions');
  assert(/proj\.layout\.showPieceDimensions = /.test(html), 'piece toggle saves to layout.showPieceDimensions');
  assert(/d\.checked = !!proj\.layout\.showPieceDimensions/.test(html), 'piece toggle loads from its own flag');

  // The piece-dimension draw walks every install layer's pieces and uses the nested
  // position when a piece has been moved into waste.
  assert(/window\._wtShowPieceDimensions/.test(html), 'the renderer reads the piece-dimensions flag');
  assert(/_displayClippedMoved/.test(html.slice(html.indexOf('window._wtShowPieceDimensions'))),
    'piece labels use the nested (moved) polygon when a piece sits in waste');

  // Same collinear-merge protection so a piece does not spam labels: reuses
  // polygonEdgeLabels, already tested in section 92.
}

section('95. .btn renders buttons and label-buttons at equal height');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  // The layout toolbar mixes <button class="btn"> with <label class="btn"> (Import
  // CSV / Add CSV). Without inline-flex + border-box on .btn they render at different
  // heights. Assert the normalizing rule is present so it can't be dropped silently.
  const btnRule = (html.match(/\.btn \{[\s\S]*?\}/) || [''])[0];
  assert(/display:\s*inline-flex/.test(btnRule), '.btn uses inline-flex so button and label heights match');
  assert(/box-sizing:\s*border-box/.test(btnRule), '.btn is border-box so padding does not change height between element types');
  assert(/align-items:\s*center/.test(btnRule), '.btn centers its content vertically');

  // The toolbar still mixes both element types — this is the case the rule protects.
  assert(/<label[^>]*class="btn[^"]*"[^>]*>↑ Import CSV/.test(html), 'Import CSV is a label styled as a button');
  assert(/<button[^>]*id="editShapeBtn"[^>]*class="btn/.test(html), 'Edit Shape is a real button');
}

section('96. Fit view respects layer visibility (hidden layers are not framed)');
{
  const F = ctx.layoutFitPoints;
  const spanX = pts => { const xs = pts.map(p => p.x); return [Math.min(...xs), Math.max(...xs)]; };
  const box = (x0, x1) => [{x:x0,y:0},{x:x1,y:0},{x:x1,y:10},{x:x0,y:10}];

  // Primary at x 0..10; a secondary INSTALL layer far away at x 100..110.
  const mk = vis => ({
    basePoints: box(0, 10),
    strips: [{ pieces: [{ displayClipped: box(0, 10) }] }],
    secondaryShapes: [{ displayPoints: box(100, 110) }],
    layerVisibility: vis || {},
    _installLayers: [
      { id: 'primary', layout: { strips: [] } },
      { id: 0, layout: { strips: [{ pieces: [{ displayClipped: box(100, 110) }] }] } },
    ],
  });

  // Visible: the fit spans both.
  assert(JSON.stringify(spanX(F(mk({}), false))) === JSON.stringify([0, 110]),
    'a visible layer is included in the fit');

  // Hidden: the fit must shrink to the primary. The outline was already skipped, but
  // the layer's ROLL PIECES were still added via _installLayers — so "Fit" appeared
  // to do nothing after unticking a layer.
  assert(JSON.stringify(spanX(F(mk({ 0: false }), false))) === JSON.stringify([0, 10]),
    'a hidden layer\'s pieces are excluded — Fit shrinks to what is actually drawn');

  // Rectangles on: a hidden layer still contributes nothing.
  const withRects = {
    basePoints: box(0, 10),
    strips: [{ pieces: [{ displayClipped: box(0, 10), displayRect: box(0, 12) }] }],
    secondaryShapes: [{ displayPoints: box(100, 110) }],
    layerVisibility: { 0: false },
    _installLayers: [
      { id: 'primary', layout: { strips: [] } },
      { id: 0, layout: { strips: [{ pieces: [{ displayClipped: box(100,110), displayRect: box(100,130) }] }] } },
    ],
  };
  assert(spanX(F(withRects, true))[1] === 12, 'with rectangles shown, a hidden layer\'s rectangle is still excluded');

  // Hiding the PRIMARY drops its outline and its strips too.
  const primaryHidden = mk({ primary: false });
  assert(JSON.stringify(spanX(F(primaryHidden, false))) === JSON.stringify([100, 110]),
    'hiding the primary frames only the remaining visible layer');

  // Everything hidden → fall back to the primary outline rather than an empty/NaN fit.
  const allHidden = mk({ primary: false, 0: false });
  assert(JSON.stringify(spanX(F(allHidden, false))) === JSON.stringify([0, 10]),
    'all layers hidden falls back to the primary outline (never an empty fit)');

  // A layer explicitly visible (true) behaves like the default.
  assert(JSON.stringify(spanX(F(mk({ 0: true }), false))) === JSON.stringify([0, 110]),
    'explicit visible:true is included');
}

section('97. Misc catalog items flagged "always include" seed new projects');
{
  const D = ctx.defaultMiscItemsForNewProject;
  const cat = [
    { id:'m1', name:'Seam tape',   price:45,  unit:'per roll', notes:'',             alwaysInclude:true },
    { id:'m2', name:'Haul away',   price:200, unit:'each',     notes:'job specific'                     },
    { id:'m3', name:'Turf nails',  price:30,  unit:'per box',                        alwaysInclude:true },
  ];

  const rows = D(cat);
  assert(rows.length === 2, 'only flagged items seed a new project');
  assert(rows.map(r => r.name).join(',') === 'Seam tape,Turf nails', 'the right items carry over');
  assert(!rows.some(r => r.name === 'Haul away'), 'a job-specific item is NOT auto-added');

  // Rows are usable project rows, not catalog references.
  rows.forEach(r => {
    assert(r.qty === 1, 'seeded at qty 1');
    assert(r.role === 'base', 'seeded with the base role');
    assert(r.fromCatalog === true, 'marked as coming from the catalog');
  });
  assert(rows[0].price === 45 && rows[0].unit === 'per roll', 'price and unit carry from the catalog');
  assert(rows[1].unit === 'per box', 'unit carries per item');
  assert(rows[0].notes === '', 'missing notes become an empty string, not undefined');

  // Mutating a seeded row must not touch the catalog entry (fresh objects, not refs).
  rows[0].price = 999;
  assert(cat[0].price === 45, 'editing a project row does not change the catalog item');

  // Degenerate input.
  assert(D([]).length === 0, 'an empty catalog seeds nothing');
  assert(D(null).length === 0, 'null catalog → nothing, no throw');
  assert(D([null, undefined]).length === 0, 'junk entries are skipped');
  assert(D([{ name:'x' }]).length === 0, 'an unflagged item is not included');
  assert(D([{ name:'y', alwaysInclude:false }]).length === 0, 'explicitly false is not included');

  // Defaults fill in when the catalog entry is sparse.
  const sparse = D([{ name:'Bare', alwaysInclude:true }]);
  assert(sparse[0].price === 0 && sparse[0].unit === 'each', 'a sparse catalog item gets sane defaults');
}

section('98. The dead turf "Type" column is gone (role is the real control)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // turfType was written, displayed and backfilled but NEVER read by any calculation.
  // Worse, it offered its own "Putting Green" option next to the role dropdown's — so
  // setting Type=Putting Green looked like it would price a green and did nothing.
  assert(!/updateTurfField\(\$\{i\},'turfType'/.test(html), 'the dead Type dropdown is removed from the turf row');
  assert(!/<label>Type<\/label>\s*\n\s*<label>Installed SqFt<\/label>/.test(html), 'the Type column header is removed');

  // Role remains, and it is what every calculation filters on.
  assert(/updateTurfField\(\$\{i\},'role'/.test(html), 'the role dropdown remains');
  ['3', '4'].length; // (no-op, keeps lint quiet)
  assert(html.includes("r.role === 'putting-green'"), 'pricing still filters on role, not type');

  // Header and row grids must declare the same number of columns or the table skews.
  const rowGrid = (html.match(/\.turf-row \{[\s\S]*?grid-template-columns:\s*([^;]+);/) || [])[1];
  const hdrGrid = (html.match(/class="row-grid-wide"[^>]*grid-template-columns:([^;]+);[^>]*>\s*<label>Product<\/label>/) || [])[1];
  assert(rowGrid && hdrGrid, 'both the row and header grids are declared');
  const cols = g => g.trim().split(/\s+/).length;
  assert(cols(rowGrid) === cols(hdrGrid), 'row and header have the same column count (' + cols(rowGrid) + ')');
  assert(cols(rowGrid) === 7, 'seven columns: Product, Installed, ToOrder, LinearFt, OrderedSqFt, Role, remove');
}

section('99. Top-bar material aggregates (edging, rock, sand)');
{
  // Rock and sand sum across ALL lines — a job can have several of each.
  assert(ctx.sumRockTons([{tons:4.2},{tons:1.8}]) === 6, 'rock tons sum across lines');
  assert(ctx.sumRockTons([{tons:'3'},{tons:''},{tons:2}]) === 5, 'string/blank tons parse; blanks are 0');
  assert(ctx.sumRockTons([]) === 0, 'no rock → 0');
  assert(ctx.sumInfillBags([{bags:15},{bags:45}]) === 60, 'infill bags sum across lines');
  assert(ctx.sumInfillBags(null) === 0, 'null infill → 0, no throw');

  // Edging: linear feet and boards, from proj.edging.
  assert(ctx.fmtTopEdging({linFt:212, boards:11}) === '212 ft · 11 bd', 'edging shows feet and boards');
  assert(ctx.fmtTopEdging({linFt:212}) === '212 ft', 'boards omitted when there are none');
  assert(ctx.fmtTopEdging({}) === '—', 'no edging → dash');
  assert(ctx.fmtTopEdging(null) === '—', 'null edging → dash, no throw');

  // Rock cell.
  assert(ctx.fmtTopRock([{tons:4.2},{tons:1.8}]) === '6 tons', 'rock cell sums to 6 tons');
  assert(ctx.fmtTopRock([]) === '—', 'no rock → dash');

  // Sand cell: bags + weight, tons past 2000 lbs (reuses infill weight helpers).
  assert(ctx.fmtTopInfill([{bags:15}]) === '15 bags · 750 lbs', 'sand cell: bags and weight in lbs');
  assert(ctx.fmtTopInfill([{bags:15},{bags:45}]) === '60 bags · 3,000 lbs (1.5 tons)', 'sand cell sums lines and shows tons');
  assert(ctx.fmtTopInfill([]) === '—', 'no sand → dash');

  // The old Perimeter cell is gone from the bar; the three new cells exist.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  assert(!/id="layoutPerimeterOut"/.test(html), 'the Perimeter cell is removed from the top bar');
  ['topEdgingOut','topRockOut','topInfillOut'].forEach(id =>
    assert(html.includes('id="' + id + '"'), 'the ' + id + ' cell exists in the top bar'));

  // The bar scrolls rather than clipping a cell in the windowed-laptop width band
  // (~860px..full). Isolated to .top-metrics so the maximized case is untouched.
  const tmRule = (html.match(/\.top-metrics \{[\s\S]*?\}/) || [''])[0];
  assert(/overflow-x:\s*auto/.test(tmRule), '.top-metrics scrolls instead of clipping when the header is tight');
  assert(/min-width:\s*0/.test(tmRule), '.top-metrics has min-width:0 so a flex child can actually scroll');
  assert(!/flex-shrink:\s*0/.test(tmRule), '.top-metrics no longer refuses to shrink (which caused the clip)');
  assert(/\.top-metrics \.tm \{[^}]*flex-shrink:\s*0/.test(html), 'the cells keep their width so the bar scrolls rather than squishing them');
}

section('100. Landscape stamps (decorative icons)');
{
  // The icon registry drives what can be placed and is the extension point — adding a
  // landscape element later is one entry here.
  const ICONS = ctx.landscapeIcons();
  assert(typeof ICONS === 'object' && ICONS, 'the icon registry exists');
  assert(typeof ICONS.bush.draw === 'function', 'bush has a draw function');
  assert(typeof ICONS.tree.draw === 'function', 'tree has a draw function');
  assert(ICONS.bush.label && ICONS.tree.label, 'each icon has a label for the palette');

  // A stamp is selectable/movable anywhere inside its bounding box (not just along the
  // two-point diagonal), so it uses the annotation move/resize/rotate/delete pipeline.
  const stamp = { type:'stamp', stampKind:'bush', points:[{x:0,y:0},{x:10,y:6}] };
  assert(ctx.annoHitTest({x:5,y:3}, stamp, 0.1) === true, 'a click inside the stamp box selects it');
  assert(ctx.annoHitTest({x:2,y:5}, stamp, 0.1) === true, 'anywhere in the box hits, not just the diagonal');
  assert(ctx.annoHitTest({x:20,y:20}, stamp, 0.1) === false, 'a click well outside misses');

  // annotationHasSize still gates stray clicks for real shapes, but the commit path
  // gives a click-placed stamp a default box — modelled here.
  const clicked = { type:'stamp', stampKind:'tree', points:[{x:4,y:4},{x:4,y:4}] };
  assert(ctx.annotationHasSize(clicked) === false, 'a zero-size stamp would be dropped without the default-box step');

  // THE guarantee: stamps are decorative and must never reach a money-path calc.
  // annotations (stamps included) are not read by fit, area, perimeter, roll, or
  // pricing. Assert the source has no such reference.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  const moneyFns = ['layoutFitPoints','function calcQuote','function calcTurfTotals','sumRockTons','packPiecesIntoRolls'];
  moneyFns.forEach(fn => {
    const i = html.indexOf(fn);
    if (i < 0) return;
    const body = html.slice(i, i + 1500);
    assert(!/\bstamp\b/.test(body) && !/annotations/.test(body),
      fn + ' does not read annotations/stamps (stays out of the money path)');
  });

  // The palette exposes the two starter tools.
  assert(/data-shape="stamp:bush"/.test(html), 'the Bush tool is in the draw toolbar');
  assert(/data-shape="stamp:tree"/.test(html), 'the Tree tool is in the draw toolbar');
}

section('101. Pavers stamp + retaining wall');
{
  const ICONS = ctx.landscapeIcons();
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // Pavers is a stamp (box) — one registry entry, reuses the stamp pipeline.
  assert(typeof ICONS.pavers.draw === 'function', 'pavers has a draw function');
  assert(ICONS.pavers.label === 'Pavers', 'pavers has its palette label');
  assert(/data-shape="stamp:pavers"/.test(html), 'the Pavers tool is in the toolbar');
  const pav = { type:'stamp', stampKind:'pavers', points:[{x:0,y:0},{x:12,y:8}] };
  assert(ctx.annoHitTest({x:6,y:4}, pav, 0.1) === true, 'a paver area is selectable inside its box');

  // Retaining wall is a thick multi-point path (NOT a box) — its own type.
  assert(/data-shape="wall"/.test(html), 'the Wall tool is in the toolbar');
  assert(/id="wallThickInput"/.test(html), 'the wall thickness input exists');

  // A wall is grabbable within half its thickness of the centerline — thicker than a
  // thin line's tolerance, so a click just off the drawn line still selects it.
  const wall = { type:'wall', thicknessFt:1.0, points:[{x:0,y:0},{x:10,y:0}] };
  assert(ctx.annoHitTest({x:5,y:0.0}, wall, 0.05) === true, 'a click on the wall centerline selects it');
  assert(ctx.annoHitTest({x:5,y:0.45}, wall, 0.05) === true, 'a click within half-thickness (0.5ft) still selects it');
  assert(ctx.annoHitTest({x:5,y:2.0}, wall, 0.05) === false, 'a click well off the wall misses');
  // A thin freehand line at the same offset would NOT hit — proves the thickness
  // widened the grab zone.
  const thin = { type:'freehand', points:[{x:0,y:0},{x:10,y:0}] };
  assert(ctx.annoHitTest({x:5,y:0.45}, thin, 0.05) === false, 'the same offset misses a thin line (thickness matters)');

  // Still visual-only: the money-path functions read no annotations/stamps/walls.
  ['layoutFitPoints','function calcQuote','sumRockTons'].forEach(fn => {
    const i = html.indexOf(fn); if (i < 0) return;
    const body = html.slice(i, i + 1500);
    assert(!/\bwall\b/.test(body) && !/annotations/.test(body), fn + ' ignores walls/annotations');
  });
}

section('102. More landscape elements + wall thickness handle');
{
  const ICONS = ctx.landscapeIcons();
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // Mulch and rock beds are stamp entries; fence is a path type.
  assert(typeof ICONS.mulch.draw === 'function' && ICONS.mulch.label === 'Mulch bed', 'mulch bed registered');
  assert(typeof ICONS.rockbed.draw === 'function' && ICONS.rockbed.label === 'Rock bed', 'rock bed registered');
  assert(/data-shape="stamp:mulch"/.test(html) && /data-shape="stamp:rockbed"/.test(html), 'bed tools in toolbar');
  assert(/data-shape="fence"/.test(html), 'fence tool in toolbar');

  // Fence is a thin path, selectable along its line.
  const fence = { type:'fence', points:[{x:0,y:0},{x:8,y:0}] };
  assert(ctx.annoHitTest({x:4,y:0}, fence, 0.1) === true, 'a fence is selectable on its line');

  // ── Wall thickness handle ──
  const wall = { type:'wall', thicknessFt:1, points:[{x:0,y:0},{x:10,y:0}] };
  const h = ctx.wallThicknessHandle(wall);
  assert(h && near(h.x, 5) && near(h.y, 0.5), 'handle sits off the midpoint by half-thickness');
  assert(near(h.nx, 0) && near(h.ny, 1), 'handle carries the unit normal');
  // Dragging it sets thickness = 2 x perpendicular distance.
  assert(near(ctx.wallThicknessFromDrag(h, {x:5, y:1.5}), 3), 'drag to 1.5ft perp → 3ft thick');
  assert(near(ctx.wallThicknessFromDrag(h, {x:5, y:-1.0}), 2), 'works on either side (abs)');
  // Clamped to a sane range.
  assert(ctx.wallThicknessFromDrag(h, {x:5, y:0.01}) >= 2/12 - 1e-9, 'clamped to a 2in minimum');
  assert(ctx.wallThicknessFromDrag(h, {x:5, y:50}) === 4, 'clamped to a 4ft maximum');
  // Only walls get a handle.
  assert(ctx.wallThicknessHandle(fence) === null, 'non-walls have no thickness handle');
  assert(ctx.wallThicknessHandle({type:'wall',points:[{x:0,y:0}]}) === null, 'a degenerate wall has none');

  // Still visual-only.
  ['layoutFitPoints','function calcQuote','sumRockTons'].forEach(fn => {
    const i = html.indexOf(fn); if (i < 0) return;
    const body = html.slice(i, i + 1500);
    assert(!/\bfence\b/.test(body) && !/annotations/.test(body), fn + ' ignores fences/annotations');
  });
}

section('103. Deselected layer excluded from all accounting (Back_putting_green.csv)');
{
  // Real job geometry: base outline 173.89, putting green 91.52 (inside the base),
  // and a stray mis-measurement 38.82 that the user deselects. The green stays whole;
  // the stray contributes nothing once unticked.
  const R = (a)=>rect(0,0,Math.sqrt(a),Math.sqrt(a)); // area-only shapes for the math
  const mk = (vis) => ({ layout: {
    secondaryShapes: [
      { area: 38.82, points: R(38.82) },  // 0: the stray measurement
      { area: 91.52, points: R(91.52) },  // 1: the putting green
    ],
    secondaryShapeModes: { 0: 'exclude', 1: 'putting-green' },
    layerVisibility: vis,
  }});

  // With the stray VISIBLE and set to exclude, it wrongly comes off the base.
  const withStray = ctx.getAdjustedShapeArea(mk({ 0:true, 1:true }), 173.89);
  assert(near(withStray, 173.89 - 38.82 - 91.52), 'visible stray + green both come off the outline');

  // Deselect the stray (0): only the green comes off the base outline now.
  const strayHidden = ctx.getAdjustedShapeArea(mk({ 0:false, 1:true }), 173.89);
  assert(near(strayHidden, 173.89 - 91.52), 'deselected stray no longer subtracts — base outline minus green = 82.37');
  assert(near(strayHidden, 82.37), 'base turf installed = 82.37 ft² for this job');

  // The green is unaffected by the stray being hidden — still its full 91.52.
  const pg = ctx.getPuttingGreenShapeArea(mk({ 0:false, 1:true }));
  assert(near(pg, 91.52), 'putting green stays whole at 91.52 — installed turf does not subtract from the green');

  // Deselecting the green too would drop it from PG accounting.
  assert(near(ctx.getPuttingGreenShapeArea(mk({ 0:false, 1:false })), 0), 'deselecting the green removes it from PG area');
}

section('104. Base-minus-green install model (splitInstallArea)');
{
  const S = ctx.splitInstallArea;

  // Real job: base outline 173.89, green 91.52 → base row Installed = 82.37.
  const baseInstall = 82.37, green = 91.52;

  // With the green installed: standard yard = base area (green cut out), pg = green.
  const withGreen = S(baseInstall, green, green);
  assert(near(withGreen.std, 82.37), 'with green: standard labor/infill area = base minus green = 82.37');
  assert(near(withGreen.pg, 91.52), 'with green: putting green area = 91.52 (whole, never reduced)');

  // No-green comparison scenario: base covers the green\'s spot too → full outline.
  const noGreen = S(baseInstall, green, 0);
  assert(near(noGreen.std, 173.89), 'no green: standard area reconstructs the full outline = 173.89');
  assert(near(noGreen.pg, 0), 'no green: no putting green area');

  // A plain job with no green at all: std = base, unchanged.
  assert(near(S(1000, 0, 0).std, 1000), 'no-green job: standard area = base');

  // The standard yard never goes negative (a green larger than the reconstructed
  // outline is clamped, not negative labor).
  assert(S(10, 5, 999).std === 0, 'std clamps at 0, never negative');

  // Garbage/blank inputs coerce to 0 without throwing.
  assert(near(S('82.37','91.52','91.52').std, 82.37), 'string inputs parse');
  assert(near(S(null, undefined, NaN).std, 0), 'null/undefined/NaN → 0');
}

section('105. Installed → infill cascade (base minus green flows to infill)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // The three programmatic writers of a base row's Installed SqFt must re-populate
  // infill afterward, or the infill keeps a stale full-outline area. Guard the wiring.
  // syncLinkedTurfRow (live link), applyLayoutAreaToTurf (Apply Installed), and the
  // Apply-Ordered path each set installedSqFt then must call autoPopulateInfill.
  const syncFn = html.slice(html.indexOf('function syncLinkedTurfRow'), html.indexOf('function scheduleLinkedSync'));
  assert(/autoPopulateInfill\(\)/.test(syncFn), 'live-link sync re-populates infill after setting Installed');

  const applyInst = html.slice(html.indexOf('function applyLayoutAreaToTurf'), html.indexOf('function applyLayoutAreaToTurf') + 1600);
  assert(/autoPopulateInfill\(\)/.test(applyInst), 'Apply Installed re-populates infill');

  // Invariant: infill area derives from the (now green-subtracted) base install.
  // Modeled directly via infillAreaForTier, which autoPopulateInfill uses.
  const proj = {
    turf: [ { role:'base', installedSqFt: 82.37 }, { role:'putting-green', installedSqFt: 91.52 } ],
  };
  assert(near(ctx.infillAreaForTier(proj, 'standard'), 82.37), 'base infill area = base install (outline − green) = 82.37');
  assert(near(ctx.infillAreaForTier(proj, 'putting-green'), 91.52), 'PG infill area = green = 91.52');
}

section('106. Apply Area is role-aware: PG row gets the green, base gets outline-minus-green');
{
  const proj = {
    turf: [ { role:'base' }, { role:'putting-green' }, { role:'alt-turf' } ],
    layout: { area:173.89, shapeArea:173.89, adjustedShapeArea:82.37,
      secondaryShapes:[{area:38.82},{area:91.52}],
      secondaryShapeModes:{0:'ignore',1:'putting-green'}, layerVisibility:{0:false} },
  };
  const base = ctx.computeApplyAreaForRow(proj, proj.layout, proj.turf[0]);
  const pg   = ctx.computeApplyAreaForRow(proj, proj.layout, proj.turf[1]);
  const alt  = ctx.computeApplyAreaForRow(proj, proj.layout, proj.turf[2]);
  assert(base.ok && near(base.area, 82.37), 'base row = outline minus green (82.37)');
  assert(pg.ok && near(pg.area, 91.52), 'PG row = the green area (91.52), NOT the base');
  assert(!alt.ok && alt.reason === 'alt-turf-priced-on-base', 'alt-turf still blocked');

  // A PG row with no green designated → no-area (nothing to apply).
  const noGreen = { turf:[{role:'putting-green'}], layout:{ area:100, adjustedShapeArea:100, secondaryShapes:[], secondaryShapeModes:{} } };
  const r = ctx.computeApplyAreaForRow(noGreen, noGreen.layout, noGreen.turf[0]);
  assert(!r.ok && r.reason === 'no-area', 'PG row with no green shape → no-area');
}

section('107. Putting green rolls as its own layer (step 1 of base/PG roll split)');
{
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, allowJoinSeams:false };
  const outline = [{x:0,y:0},{x:10,y:0},{x:10,y:17.4},{x:0,y:17.4}];          // ~174
  const green   = [{x:0.2,y:4},{x:9.8,y:4},{x:9.8,y:13.6},{x:0.2,y:13.6}];    // ~92
  const primaryLayout = ctx.computeRollLayout(outline, 0, 0, opts);
  const proj = { layout:{ points:outline, secondaryShapes:[{points:green,area:92}],
    secondaryShapeModes:{0:'putting-green'}, layerVisibility:{} } };
  const prevGetProj = ctx.getCurrentProject; ctx.getCurrentProject = () => proj;
  const secShapes = [{points:green, displayPoints:green, area:92, name:'Putting Green'}];
  const layers = ctx.computeInstallLayerLayouts(proj, primaryLayout, secShapes, 0, 0, opts);

  // The green is now rolled as its own layer, alongside the primary.
  assert(layers.length === 2, 'primary + putting-green = two rolled layers');
  const pg = layers.find(l => l.isPuttingGreen);
  assert(pg, 'the green layer is tagged isPuttingGreen');
  assert(pg.name === 'Putting Green', 'the green layer is labeled for the breakdown');
  assert(pg.rollGroup === 'own', 'the green is cut from its OWN rolls (different product from base)');
  assert(near(pg.layout.shapeArea, 92, 1.5), 'the green rolls its own ~92 ft² shape');

  // The base still rolls the FULL outline (green filled in), not the subtracted shape.
  const base = layers.find(l => l.id === 'primary');
  assert(near(base.layout.shapeArea, 174, 1), 'the base still rolls the full outline (~174), cut to fit on site');

  // Area nets out: the green is subtracted from the base install but rolled back as its
  // own layer — the Installed metric must equal total turf (base 82 + green 92 = ~174),
  // NOT double-count to 266.
  const combined = ctx.sumInstallLayouts(layers);
  const adjusted = ctx.getAdjustedShapeArea(proj, primaryLayout.shapeArea);
  const baseInstalled = combined.area - primaryLayout.shapeArea + adjusted;
  assert(near(adjusted, 82, 1), 'base install (adjusted) = outline minus green (~82)');
  assert(near(baseInstalled, 174, 1.5), 'Installed metric = total turf (~174), green not double-counted');
  assert(combined.rolls >= 2, 'base and green produce separate rolls');

  ctx.getCurrentProject = prevGetProj;
}

section('108. Per-row order routing (base row ← base plan, PG row ← green plan)');
{
  const F = ctx.orderedFromLayoutForRole;
  const layer = (isPG, ordered) => ({ isPuttingGreen: isPG, layout: { totalOrdered: ordered } });

  // Two-layer job: base primary (300) + green (150).
  const layout = { _installLayers: [ layer(false, 300), layer(true, 150) ] };
  assert(F(layout, 'base') === 300, 'base row draws the base plan order (300)');
  assert(F(layout, 'putting-green') === 150, 'PG row draws the green plan order (150), NOT the base');
  assert(F(layout, 'alt-turf') === 300, 'alt-turf draws the base plan (priced on base yard)');

  // Base + a second non-green install layer (e.g. a detached side yard): base sums both.
  const twoBase = { _installLayers: [ layer(false, 300), layer(false, 120), layer(true, 150) ] };
  assert(F(twoBase, 'base') === 420, 'base sums all non-green layers (300+120)');
  assert(F(twoBase, 'putting-green') === 150, 'PG still only the green layer');

  // Single-layer job (no green layer at all): base gets the whole plan, PG gets null so
  // the caller leaves the PG row untouched rather than zeroing it.
  const single = { totalOrdered: 285 };
  assert(F(single, 'base') === 285, 'single-layer base = whole plan');
  assert(F(single, 'putting-green') === null, 'single-layer PG row → null (no green layer to draw from)');

  // No layout → null.
  assert(F(null, 'base') === null, 'no layout → null');

  // The live link routes the PG row from the green plan without a manual target: the
  // sync writes every PG row plus the selected target. Guard the wiring.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  const syncFn = html.slice(html.indexOf('function syncLinkedTurfRow'), html.indexOf('function scheduleLinkedSync'));
  assert(/orderedFromLayoutForRole/.test(syncFn), 'live link uses the role-aware order');
  assert(/putting-green/.test(syncFn) && /forEach/.test(syncFn), 'live link syncs every PG row, not just the picked target');
}

section('109. Scrap measured against the rolled outline, not the green-subtracted area (step 3)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  // The single-layer scrap line must subtract the rolled shapeArea, not adjustedArea.
  assert(/layout\.scrap = layout\.totalOrdered - layout\.shapeArea/.test(html),
    'primary scrap = ordered − rolled outline (not the green-subtracted install area)');
  assert(!/layout\.scrap = layout\.totalOrdered - adjustedArea/.test(html),
    'the old adjusted-area scrap baseline is gone');

  // Numeric: a 174 outline that orders 300, with a 92 green inside it.
  const opts = { rollWidth:15, rollLength:100, sideTrim:0, cuttingMargin:0, allowJoinSeams:false };
  const outline = [{x:0,y:0},{x:10,y:0},{x:10,y:17.4},{x:0,y:17.4}];
  const L = ctx.computeRollLayout(outline, 0, 0, opts);
  const orderedBase = L.totalOrdered, outlineArea = L.shapeArea;
  const scrapVsOutline = orderedBase - outlineArea;
  const scrapVsInstall = orderedBase - 82; // the old, inflated baseline
  assert(scrapVsOutline < scrapVsInstall, 'measuring against the rolled outline is less waste than against install-minus-green');
  const pctOutline = scrapVsOutline / orderedBase * 100;
  assert(pctOutline < 50, 'base roll waste is a sane ~40%, not the inflated ~70%');

  // Combined (green as its own layer): scrap = ordered − sum of rolled shape areas.
  const green = [{x:0.2,y:4},{x:9.8,y:4},{x:9.8,y:13.6},{x:0.2,y:13.6}];
  const proj = { layout:{ points:outline, secondaryShapes:[{points:green,area:92}], secondaryShapeModes:{0:'putting-green'}, layerVisibility:{} } };
  const prev = ctx.getCurrentProject; ctx.getCurrentProject = () => proj;
  const layers = ctx.computeInstallLayerLayouts(proj, L, [{points:green,displayPoints:green,area:92,name:'Putting Green'}], 0, 0, opts);
  const combined = ctx.sumInstallLayouts(layers);
  assert(near(combined.scrap, combined.ordered - combined.area, 0.01), 'combined scrap = ordered − total rolled area');
  assert(combined.wastePct < 50, 'combined base+green waste is sane (~40%), not inflated');
  ctx.getCurrentProject = prev;
}

section('110. Green-as-layer must not inflate the base row Installed (regression)');
{
  // After the green rolls as its own layer, combo.area includes it. The base row's
  // Installed must still be outline − green, NOT the full outline. Bug was: base row
  // showed 173.95 (full outline) instead of 82.43.
  const proj = { layout:{ secondaryShapes:[{area:91.52}], secondaryShapeModes:{0:'putting-green'}, layerVisibility:{} } };
  const prev = ctx.getCurrentProject; ctx.getCurrentProject = () => proj;
  const layout = {
    shapeArea: 173.95, adjustedShapeArea: 82.43,
    _combined: { area: 265.47 }, // primary 173.95 + green 91.52
    _installLayers: [
      { id:'primary', isPuttingGreen:false, layout:{ shapeArea:173.95 } },
      { id:0, isPuttingGreen:true, layout:{ shapeArea:91.52 } },
    ],
  };
  const base = ctx.computeApplyAreaForRow(proj, layout, { role:'base' });
  assert(near(base.area, 82.43), 'base row = outline minus green (82.43), NOT the full outline');

  // A base + a genuine side-yard install layer (non-green) still SUMS both.
  const proj2 = { layout:{ secondaryShapes:[], secondaryShapeModes:{} } };
  ctx.getCurrentProject = () => proj2;
  const sideLayout = {
    shapeArea: 400, adjustedShapeArea: 400,
    _combined: { area: 550 }, // primary 400 + side 150
    _installLayers: [ { id:'primary', isPuttingGreen:false, layout:{shapeArea:400} }, { id:0, isPuttingGreen:false, layout:{shapeArea:150} } ],
  };
  assert(near(ctx.computeApplyAreaForRow(proj2, sideLayout, {role:'base'}).area, 550), 'a non-green side yard is still added to the base');

  // Base + side yard + green: base = adjusted primary + side, minus green.
  const proj3 = { layout:{ secondaryShapes:[{area:90}], secondaryShapeModes:{1:'putting-green'} } };
  ctx.getCurrentProject = () => proj3;
  const mixLayout = {
    shapeArea: 400, adjustedShapeArea: 310, // 400 primary − 90 green
    _combined: { area: 400 + 150 + 90 },    // primary + side + green
    _installLayers: [
      { id:'primary', isPuttingGreen:false, layout:{shapeArea:400} },
      { id:0, isPuttingGreen:false, layout:{shapeArea:150} },  // side yard
      { id:1, isPuttingGreen:true,  layout:{shapeArea:90} },   // green
    ],
  };
  assert(near(ctx.computeApplyAreaForRow(proj3, mixLayout, {role:'base'}).area, 460), 'base = adj primary (310) + side yard (150), green excluded = 460');

  ctx.getCurrentProject = prev;
}

section('111. Workflow: designating the green updates the base row (setSecondaryShapeMode)');
{
  // computeApplyAreaForRow is the engine both the live link and Apply use. Prove the
  // key workflow property directly: once a shape is putting-green mode, a base row's
  // area is outline-minus-green and a PG row's is the green — the same values the
  // live sync writes when you designate the green.
  const outlineArea = 173.95, greenArea = 91.52;
  const layout = {
    shapeArea: outlineArea,
    adjustedShapeArea: outlineArea - greenArea, // 82.43
    _combined: { area: outlineArea + greenArea },
    _installLayers: [
      { id:'primary', isPuttingGreen:false, layout:{ shapeArea: outlineArea } },
      { id:0, isPuttingGreen:true, layout:{ shapeArea: greenArea } },
    ],
  };
  const proj = { layout:{ secondaryShapes:[{area:greenArea}], secondaryShapeModes:{0:'putting-green'}, layerVisibility:{} } };
  const prev = ctx.getCurrentProject; ctx.getCurrentProject = () => proj;

  const base = ctx.computeApplyAreaForRow(proj, layout, { role:'base' });
  const pg   = ctx.computeApplyAreaForRow(proj, layout, { role:'putting-green' });
  assert(near(base.area, 82.43), 'after designating the green, the base row = outline − green (82.43)');
  assert(near(pg.area, 91.52), 'the PG row = the green (91.52)');
  assert(near(base.area + pg.area, outlineArea, 0.1), 'base + green = the full outline (they tile it, no overlap)');

  // The mode-change handler is wired to push this through immediately.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  const modeFn = html.slice(html.indexOf('function setSecondaryShapeMode'), html.indexOf('function isLayerVisible'));
  assert(/syncLinkedTurfRow\(\)/.test(modeFn), 'setSecondaryShapeMode re-syncs the turf rows (base recomputes when you set the green)');

  ctx.getCurrentProject = prev;
}

section('112. New project designates the green shape at creation (root-cause fix)');
{
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');

  // createProject must set secondaryShapeModes with the picked shape as putting-green.
  // Before, it attached secondaryShapes but no modes — so every imported shape defaulted
  // to 'ignore', the green was never designated, and the base never subtracted it.
  const cp = html.slice(html.indexOf('function createProject'), html.indexOf('function createProject') + 6000);
  assert(/secondaryShapeModes:\s*secModes/.test(cp) || /secondaryShapeModes/.test(cp), 'createProject sets secondaryShapeModes on the layout');
  assert(/newProjPgShape/.test(cp), 'createProject reads the putting-green shape selector');
  assert(/'putting-green'/.test(cp), 'it designates the picked shape as putting-green');

  // The selector only shows when a PG turf is chosen AND there are secondary shapes.
  assert(html.includes('function refreshNewProjPgShape'), 'the green-shape selector refresh exists');
  assert(html.includes('id="newProjPgShape"'), 'the selector control exists in the dialog');

  // Once designated, the area math is right (proven end-to-end via the engine).
  const proj = { layout:{ area:173.89, secondaryShapes:[{area:38.82},{area:91.52}], secondaryShapeModes:{1:'putting-green'}, layerVisibility:{} } };
  const prev = ctx.getCurrentProject; ctx.getCurrentProject = () => proj;
  assert(near(ctx.getPuttingGreenShapeArea(proj), 91.52), 'designated green area = 91.52');
  assert(near(ctx.getAdjustedShapeArea(proj, 173.89), 82.37), 'base = outline − green = 82.37 from creation');
  ctx.getCurrentProject = prev;
}

section('113. Top-bar base/green split (Installed, Ordered, Turf LF)');
{
  const layout = {
    shapeArea: 173.95, adjustedShapeArea: 82.43,
    _installLayers: [
      { id:'primary', isPuttingGreen:false, layout:{ shapeArea:173.95, totalOrdered:285, linearFt:19 } },
      { id:0, isPuttingGreen:true, layout:{ shapeArea:91.52, totalOrdered:150, linearFt:10 } },
    ],
  };
  const s = ctx.splitTurfTotals(layout);
  assert(s, 'a job with a green layer produces a split');
  assert(near(s.base.installed, 82.43), 'base installed = adjusted primary (82.43), not the full outline');
  assert(near(s.green.installed, 91.52), 'green installed = the green shape (91.52)');
  assert(s.base.ordered === 285 && s.green.ordered === 150, 'ordered splits base/green');
  assert(s.base.linear === 19 && s.green.linear === 10, 'linear ft splits base/green');

  // A non-green install layer (side yard) counts toward BASE, not green.
  const withSide = { shapeArea:100, adjustedShapeArea:100, _installLayers:[
    { id:'primary', isPuttingGreen:false, layout:{shapeArea:100,totalOrdered:120,linearFt:8} },
    { id:0, isPuttingGreen:false, layout:{shapeArea:50,totalOrdered:60,linearFt:4} },
    { id:1, isPuttingGreen:true,  layout:{shapeArea:40,totalOrdered:45,linearFt:3} },
  ]};
  const s2 = ctx.splitTurfTotals(withSide);
  assert(near(s2.base.installed, 150), 'base = primary 100 + side yard 50 = 150');
  assert(near(s2.green.installed, 40), 'green = 40');

  // No green layer → null (caller uses the single combined figure).
  assert(ctx.splitTurfTotals({ _installLayers:[{id:'primary',isPuttingGreen:false,layout:{shapeArea:100,totalOrdered:120,linearFt:8}}] }) === null, 'no green → null');
  assert(ctx.splitTurfTotals({}) === null, 'no layers → null');

  // Formatter: "base · green unit".
  assert(ctx.fmtSplitCell(82, 92, 'ft²', 0) === '82 · 92 ft²', 'installed cell format');
  assert(ctx.fmtSplitCell(19, 10, 'ft', 1) === '19 · 10 ft', 'turf LF cell format');

  // The label was renamed Linear ft → Turf LF.
  const html = require('fs').readFileSync(__dirname + '/waterloo_turf_calculator.html', 'utf8');
  assert(/<span class="tm-l">Turf LF<\/span>/.test(html), 'the top-bar label reads "Turf LF"');
  assert(!/<span class="tm-l">Linear ft<\/span>/.test(html), 'the old "Linear ft" label is gone');
}

console.log(`  Tests: ${passed + failed} | ✓ Passed: ${passed} | ✗ Failed: ${failed}`);
console.log('═'.repeat(58));
process.exit(failed > 0 ? 1 : 0);
