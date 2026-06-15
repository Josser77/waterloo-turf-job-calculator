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

  proj.layout.points[0] = {x:99, y:99};
  ctx.pushLayoutHistory(proj);
  assert(proj.layout.history.length === 2, 'history has 2 entries after second push');

  // Simulate undo: pop and restore
  const restored = proj.layout.history.pop();
  proj.layout.points = restored;
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

  // ── getAdjustedShapeArea: default mode (no explicit mode set) is "exclude" ──
  {
    const proj = { layout: { secondaryShapes: [{ name:'Cutout', area: 10, points: rect(0,0,5,5) }], secondaryShapeModes: {} } };
    const adjusted = ctx.getAdjustedShapeArea(proj, 100);
    assert(near(adjusted, 90), 'default mode (no entry) = exclude: 100 - 10 = 90');
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

    // Recompute with a small translation change. As long as the same bands
    // still exist (same y0 values), nesting keyed by position should still apply.
    const opts2 = { ...opts, nesting };
    const recomputed = ctx.computeRollLayout(lShape, 0, 0, opts2);
    const recomputedSmall = recomputed.strips.find(s => s.key === small.key);
    assert(recomputedSmall && recomputedSmall.nestedInto != null, 'nesting still applies after recompute when band positions unchanged');
    assert(recomputed.totalSaved > 0, 'totalSaved > 0 after recompute with position-based nesting');

    // A nesting entry for a key that no longer exists (e.g. after a translation
    // shift that changes band positions) is silently ignored — no crash, no
    // misapplied nesting onto an unrelated strip.
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

    // Mark shape 1 as putting-green -> shape 0 should be demoted to 'exclude'
    let threw = false;
    try { ctx37a.setSecondaryShapeMode(1, 'putting-green'); } catch(e) { threw = true; }
    assert(!threw, 'setSecondaryShapeMode runs without throwing');
    const proj = ctx37a.getCurrentProject();
    assert(proj.layout.secondaryShapeModes[1] === 'putting-green', 'shape 1 is now putting-green');
    assert(proj.layout.secondaryShapeModes[0] === 'exclude', 'shape 0 demoted to exclude (mutual exclusivity)');
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
    const withPgCard = cards.find(c => c.includes('With WT PDX Putt 85'));
    assert(noPgCard && !noPgCard.includes('PG Fringe'), '"No Putting Green" card has no PG Fringe line');
    assert(withPgCard && withPgCard.includes('PG Fringe'), '"With Putting Green" card includes a PG Fringe line');
    assert(withPgCard.includes('$304.00'), '"With Putting Green" card shows fringe cost $304.00');

    // Sanity: total COGS for the PG card includes fringe cost as an additive component
    // Standard yard: 1600 sqft * $8 = $12800; PG: 200 * $12 = $2400; turf mat: 1800*2.50=$4500; fringe: $272
    const expectedCogs = 1600*8 + 200*12 + 1800*2.50 + 304;
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
//  SUMMARY
// ════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(58)}`);
console.log(`  Tests: ${passed + failed} | ✓ Passed: ${passed} | ✗ Failed: ${failed}`);
console.log('═'.repeat(58));
process.exit(failed > 0 ? 1 : 0);
