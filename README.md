# Waterloo Turf Job Calculator

A single-file desktop and web tool for calculating turf installation jobs:
roll layout and cutting plans, materials and pricing, putting green fringe,
and auto-generated quote options for Jobber.

## Using it online

This repo is served via GitHub Pages — open the live link from the repo's
"About" section (or `https://<your-username>.github.io/waterloo-turf-job-calculator/`)
to use the calculator in any browser.

**Your data stays in your browser.** The app uses `localStorage` — there is
no server and no shared database. Each browser/device has its own separate
set of projects. Clearing browser data (or using a different browser/device)
means a different, empty project list. Use the in-app **Sync/Backup** menu
to export/import a JSON backup if you need to move projects between devices
or back them up.

## Files

- `waterloo_turf_calculator.html` — the app itself (single self-contained
  HTML/CSS/JS file). This is also the file used by the Electron desktop app.
- `index.html` — redirects to `waterloo_turf_calculator.html`, so the Pages
  root URL works.
- `waterloo_turf_tests.js` — unit test suite. Run with `node waterloo_turf_tests.js`.

## Desktop app

The Electron desktop app (Mac/Windows) lives in a separate project
(`waterloo-turf-app`) and uses a copy of `waterloo_turf_calculator.html`.
When you update this repo, copy the updated file into that project too if
you want the desktop app to match.

## Development

Run the test suite before committing any changes to
`waterloo_turf_calculator.html`:

```bash
node waterloo_turf_tests.js
```

All tests should pass (currently 472).
