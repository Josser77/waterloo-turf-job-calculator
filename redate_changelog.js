#!/usr/bin/env node
/*
 * redate_changelog.js — one-time CHANGELOG.md migration:
 *   1) re-date each "## <date> …" header to the date of the git commit that FIRST introduced it
 *      (in your local timezone, Pacific), and
 *   2) drop the running "(cont'd N)" counter, rewriting every header as:  ## <date> — Title
 *
 * It matches entries on their TITLE (the text after the "—"), which is stable whether or not the
 * counter is present — so it re-dates entries whose date was already hand-corrected, and it stays
 * safe to re-run after the counter has been removed.
 *
 * Run from the repo root:
 *   node redate_changelog.js           # preview — prints the plan, writes nothing
 *   node redate_changelog.js --apply   # rewrite CHANGELOG.md in place (saves CHANGELOG.md.bak first)
 */
const { execSync } = require('child_process');
const fs = require('fs');

const FILE = 'CHANGELOG.md';
const DATE_RE = /^(##\s+)(\d{4}-\d{2}-\d{2})\b(.*)$/;

// The stable key for an entry = its title (text after the em-dash). Pure/testable.
function titleOf(headerLine) {
  const m = headerLine.match(DATE_RE);
  if (!m) return null;
  const i = m[3].indexOf('\u2014');
  return (i >= 0 ? m[3].slice(i + 1) : m[3]).trim();
}

// From a `git log --reverse --format='DATE:%ad' -p` dump, map each title -> the FIRST (earliest)
// commit date whose diff ADDED that entry's header line. Pure/testable.
function buildFirstDateMap(gitLogText) {
  const firstDate = new Map();
  let cur = null;
  for (const raw of gitLogText.split('\n')) {
    if (raw.startsWith('DATE:')) { cur = raw.slice(5).trim(); continue; }
    if (raw.startsWith('+## ')) {
      const t = titleOf(raw.slice(1)); // strip leading '+'
      if (t && !firstDate.has(t)) firstDate.set(t, cur);
    }
  }
  return firstDate;
}

// Rewrite every header to "## <gitDate> - <title>" (counter dropped). Pure/testable.
// Returns { text, changed, missing, dupes }.
function rewrite(changelogText, firstDate) {
  let changed = 0; const missing = []; const seen = new Map();
  const out = changelogText.split('\n').map(line => {
    const m = line.match(DATE_RE);
    if (!m) return line;
    const i = m[3].indexOf('\u2014');
    const title = (i >= 0 ? m[3].slice(i + 1) : m[3]).trim();
    seen.set(title, (seen.get(title) || 0) + 1);
    const d = firstDate.get(title);
    if (!d) { missing.push(title); return line; }
    const newLine = m[1] + d + ' \u2014 ' + title;
    if (newLine !== line) changed++;
    return newLine;
  }).join('\n');
  const dupes = [...seen].filter(([, n]) => n > 1).map(([t]) => t);
  return { text: out, changed, missing, dupes };
}

module.exports = { titleOf, buildFirstDateMap, rewrite };

// -- CLI ----------------------------------------------------------------------
if (require.main === module) {
  const apply = process.argv.includes('--apply');
  let log;
  try {
    log = execSync("git log --reverse --follow --date=short --format='DATE:%ad' -p -- " + FILE,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 128 });
  } catch (e) {
    console.error('git log failed - run this from inside the repo root. ' + e.message);
    process.exit(1);
  }
  const map = buildFirstDateMap(log);
  const cl = fs.readFileSync(FILE, 'utf8');
  const { text, changed, missing, dupes } = rewrite(cl, map);
  console.log('Entries found in git history: ' + map.size);
  console.log('Header lines that will change: ' + changed);
  if (dupes.length) {
    console.log('\nWARNING - duplicate titles (both get the earliest matching commit date - check these):');
    dupes.forEach(t => console.log('  ' + t));
  }
  if (missing.length) {
    console.log('\nNot found in git (left unchanged - likely not yet committed): ' + missing.length);
    missing.slice(0, 12).forEach(t => console.log('  ' + t));
    if (missing.length > 12) console.log('  ...');
  }
  if (apply) {
    fs.copyFileSync(FILE, FILE + '.bak');
    fs.writeFileSync(FILE, text);
    console.log('\nApplied. Original backed up to ' + FILE + '.bak');
  } else {
    console.log('\nDry run - nothing written. Re-run with --apply to rewrite CHANGELOG.md.');
  }
}
