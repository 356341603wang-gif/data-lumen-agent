# R2V Data Atelier Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat red-and-white R2V interface with the approved Data Atelier visual system while preserving all analysis, upload, export, and privacy behavior.

**Architecture:** Keep the existing React component and R2V analysis boundaries. Restyle the application through a single coherent token system in `app/globals.css`, then make targeted markup changes in the upload shell, dashboard shell, overview, rankings, heatmap, and evidence drawer so the new hierarchy is semantic rather than cosmetic. Existing analysis functions and export functions remain untouched.

**Tech Stack:** React 19, TypeScript, Vite/vinext, plain CSS, Lucide React, Node test runner.

## Global Constraints

- Preserve object, scene, and audio task detection and all current analysis formulas.
- Preserve Excel, CSV, and TSV browser-local parsing; never upload raw files.
- Use Paper `#F1F0EA`, Surface `#FAF9F4`, Ink `#10110F`, Muted `#6F716A`, Line `#D7D7CF`, Acid `#B9F52B`, Acid Dark `#6FA600`, Warning `#F1A73B`, and Danger `#EE6B55`.
- Use local system font stacks only; do not add online font dependencies.
- Use Lucide icons only and preserve current icon stroke language.
- Make the first dashboard viewport answer the highest-priority dimension, question, severity, and coverage questions.
- Keep all ten agreed analysis methods available.
- Support `prefers-reduced-motion`.
- Keep mobile touch targets at least 44px.
- Keep GitHub Pages publicly accessible without authentication.

---

### Task 1: Freeze the Data Atelier visual contract

**Files:**
- Create: `tests/r2v-data-atelier-ui.test.mjs`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Current CSS class names rendered by `app/page.tsx` and `app/r2v/*.tsx`.
- Produces: Stable Data Atelier CSS tokens and visual contract assertions used by later tasks.

- [ ] **Step 1: Write the failing visual-contract test**

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("uses the approved Data Atelier palette and evidence-track motif", () => {
  for (const token of [
    "--atelier-paper: #f1f0ea",
    "--atelier-ink: #10110f",
    "--atelier-acid: #b9f52b",
    "--atelier-warning: #f1a73b",
    "--atelier-danger: #ee6b55",
  ]) {
    assert.match(css.toLowerCase(), new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(css, /\.evidence-track/);
  assert.match(css, /prefers-reduced-motion/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL because the approved Atelier tokens and `.evidence-track` do not exist.

- [ ] **Step 3: Replace the root token block and global canvas**

Define the exact approved colors, system font stacks, shadows, spacing scale, grid background, focus state, reduced-motion handling, and reusable `.evidence-track` treatment in `app/globals.css`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css tests/r2v-data-atelier-ui.test.mjs
git commit -m "style: establish Data Atelier visual system"
```

### Task 2: Rebuild the upload experience

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/globals.css`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`

**Interfaces:**
- Consumes: `UploadStage` callbacks `onFile(file)` and `onDemo()`.
- Produces: The same upload and demo actions inside a new asymmetric hero and black upload workbench.

- [ ] **Step 1: Extend the failing source test**

Add assertions that `app/page.tsx` contains:

```js
assert.match(page, /upload-orbit/);
assert.match(page, /upload-workbench__signal/);
assert.match(page, /Data Atelier/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL because the new upload motifs are absent.

- [ ] **Step 3: Refactor `UploadStage` markup**

Keep the existing hidden input, drag events, validation messages, demo action, and privacy copy. Replace the flat file square with an orbiting upload signal, add a workbench status line, use the headline “把分歧变成可以对齐的证据”, and retain the four real analysis categories.

- [ ] **Step 4: Add upload-page CSS and motion**

Implement the asymmetric 56/44 split, oversized headline reveal, black workbench, orbit animation, lime CTA, drag-active lift, and responsive single-column fallback. Add reduced-motion overrides.

- [ ] **Step 5: Run focused tests**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs tests/static-pages.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx app/globals.css tests/r2v-data-atelier-ui.test.mjs
git commit -m "feat: redesign R2V upload workbench"
```

### Task 3: Recompose the dashboard shell and first viewport

**Files:**
- Modify: `app/r2v/R2VDashboard.tsx`
- Modify: `app/r2v/AnalysisOverview.tsx`
- Modify: `app/globals.css`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`

**Interfaces:**
- Consumes: `R2VAnalysisResult`, existing tab state, task override, export callbacks, and `analysis.headlines`.
- Produces: A fixed Atelier toolbar, numbered rail navigation, Bento overview, and evidence-track hierarchy.

- [ ] **Step 1: Add failing dashboard assertions**

```js
assert.match(dashboard, /r2v-commandbar/);
assert.match(overview, /overview-priority/);
assert.match(overview, /evidence-track/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL because the new shell hooks are absent.

- [ ] **Step 3: Refactor the dashboard toolbar and navigation**

Rename the visual shell classes without changing callbacks. Group file/task context on the left and actions on the right. Keep all eight navigation destinations, but render them as numbered rail controls with a visible active signal.

- [ ] **Step 4: Recompose `AnalysisOverview`**

Render four summary metrics, one large black priority conclusion, secondary conclusions, and the most mixed answer distributions in an asymmetric grid. Keep all numbers and text sourced from the analysis result.

- [ ] **Step 5: Add dashboard and overview CSS**

Implement the warm grid canvas, floating command bar, dark priority panel, lime evidence track, staggered entrance, and responsive navigation. Avoid equal-size card grids.

- [ ] **Step 6: Run source, render, and analysis tests**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs tests/r2v-ui-source.test.mjs tests/rendered-html.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/r2v/R2VDashboard.tsx app/r2v/AnalysisOverview.tsx app/globals.css tests/r2v-data-atelier-ui.test.mjs
git commit -m "feat: build Data Atelier analysis workspace"
```

### Task 4: Restyle evidence-heavy analysis views

**Files:**
- Modify: `app/r2v/DimensionRanking.tsx`
- Modify: `app/r2v/QuestionRanking.tsx`
- Modify: `app/r2v/DisagreementHeatmap.tsx`
- Modify: `app/r2v/ReasonAndConflictViews.tsx`
- Modify: `app/r2v/AnnotatorAndCoverageViews.tsx`
- Modify: `app/globals.css`
- Modify: `tests/r2v-data-atelier-ui.test.mjs`

**Interfaces:**
- Consumes: Existing analysis metrics, reason groups, conflict groups, annotator statistics, completion coverage, and evidence drawer state.
- Produces: Editorial rankings, severity-aware heatmap cells, stance-separated reasons, deviation tracks, and mobile evidence panel.

- [ ] **Step 1: Add failing evidence-view assertions**

```js
assert.match(heatmap, /evidence-drawer/);
assert.match(reasons, /reason-stance/);
assert.match(annotators, /deviation-track/);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs`

Expected: FAIL for absent Atelier hooks.

- [ ] **Step 3: Add semantic styling hooks**

Add only class names and small wrappers needed for visual hierarchy. Do not change calculations, sorting, click targets, or displayed evidence.

- [ ] **Step 4: Implement the analysis-view CSS**

Create oversized editorial ranks, asymmetric row composition, four-state heatmap colors, stance-separated reason columns, deterministic-versus-review conflict treatments, annotator deviation tracks, and a 480px evidence drawer that becomes a bottom sheet on mobile.

- [ ] **Step 5: Run analysis and UI tests**

Run: `node --test tests/r2v-data-atelier-ui.test.mjs tests/r2v-analysis.test.mjs tests/r2v-metrics.test.mjs tests/r2v-rules.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/r2v app/globals.css tests/r2v-data-atelier-ui.test.mjs
git commit -m "style: refine R2V evidence views"
```

### Task 5: Validate responsive behavior and publish

**Files:**
- Modify only if verification exposes a specific defect.

**Interfaces:**
- Consumes: Completed site and existing GitHub Pages/Sites configuration.
- Produces: A verified public Data Atelier deployment.

- [ ] **Step 1: Run all automated verification**

Run:

```bash
git diff --check
npm run lint
npm test
node scripts/analyze-r2v-file.mjs "/Users/bytedance/Downloads/7668287611890323236_20260731113204.csv"
```

Expected: lint exit 0, 36 or more tests passing, real sample detected as audio with no field confirmation.

- [ ] **Step 2: Run browser verification**

Verify the upload page, demo analysis, each navigation tab, evidence drawer, export menu, desktop layout, and 390px mobile layout. Confirm there are no console errors.

- [ ] **Step 3: Commit any verification-only correction**

Only if a concrete defect was found:

```bash
git add <exact corrected files>
git commit -m "fix: polish Data Atelier responsive behavior"
```

- [ ] **Step 4: Push and deploy the exact verified commit**

Push `main`, build `pages-dist`, update `gh-pages`, save a Sites version from the same commit, and deploy it to the existing public project.

- [ ] **Step 5: Verify production**

Confirm the GitHub Pages URL returns the new title and asset hashes, then open it in a real browser and run the demo once.
