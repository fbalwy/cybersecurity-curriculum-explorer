# Cybersecurity Curriculum Explorer

An English, left-to-right interactive explorer for the old and developed B.Sc. Cybersecurity study plans.

**Live site:** [fbalwytu.github.io/cybersecurity-curriculum-explorer](https://fbalwytu.github.io/cybersecurity-curriculum-explorer/)

## Included

- Old Plan (`CYB-OLD-1444`): 53 level courses/slots, 15 specialization elective options, 154 total credits.
- Developed Plan (`CYB-DEV-1446`): 50 level courses/slots, 15 specialization elective options, 152 total credits.
- A centered flowchart view that shows only courses related to the selected course.
- Three relationship modes: direct prerequisite, full path, and courses unlocked.
- Optional removal of empty levels in every focused relationship mode.
- Stable metro-style routing with fan-out buses, fan-in receiver rails, and one landing arrow per destination course.
- A unified, vertically scrolling level map with an elective catalog; no zooming, panning, or minimap controls.
- Course search, plan switching, click-empty-space reset, and URL-persisted view state.
- Source-record details, earned-credit conditions, placeholder warnings, and unresolved prerequisite references.

Every course-to-course arrow comes only from a course code explicitly listed in the source `Req` cell. Blank cells and `-` / `---` values never create graph edges.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173/`.

## Verify

```bash
npm test
npm run build
```

The production output is generated in `dist/`. Pushes to `main` are tested, built, and deployed automatically through GitHub Actions and GitHub Pages.

## Data provenance

The committed application data was generated from a verified local knowledge base and raw workbook extraction. The source spreadsheets are intentionally not distributed in this public repository.

The export helper is a maintainer-only utility because it depends on the protected local extraction workspace. Re-run it only from that workspace when the source workbooks or knowledge base are formally updated:

```bash
python3 scripts/export_plan_data.py
```
