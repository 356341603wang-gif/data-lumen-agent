import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../app/page.tsx", import.meta.url),
  "utf8",
);
const dashboard = await readFile(
  new URL("../app/r2v/R2VDashboard.tsx", import.meta.url),
  "utf8",
);
const overview = await readFile(
  new URL("../app/r2v/AnalysisOverview.tsx", import.meta.url),
  "utf8",
);
const heatmap = await readFile(
  new URL("../app/r2v/DisagreementHeatmap.tsx", import.meta.url),
  "utf8",
);
const reasons = await readFile(
  new URL("../app/r2v/ReasonAndConflictViews.tsx", import.meta.url),
  "utf8",
);
const annotators = await readFile(
  new URL("../app/r2v/AnnotatorAndCoverageViews.tsx", import.meta.url),
  "utf8",
);

test("uses the approved Data Atelier palette and evidence-track motif", () => {
  for (const token of [
    "--atelier-paper: #f1f0ea",
    "--atelier-ink: #10110f",
    "--atelier-acid: #b9f52b",
    "--atelier-warning: #f1a73b",
    "--atelier-danger: #ee6b55",
  ]) {
    assert.match(
      css.toLowerCase(),
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(css, /\.evidence-track/);
  assert.match(css, /prefers-reduced-motion/);
});

test("renders the Data Atelier upload workbench", () => {
  assert.match(page, /upload-orbit/);
  assert.match(page, /upload-workbench__signal/);
  assert.match(page, /upload-headline__payoff/);
  assert.match(page, /Data Atelier/);
  assert.match(page, /window\.scrollTo\(\{ top: 0, behavior: "auto" \}\)/);
});

test("composes the dashboard around a priority conclusion and evidence track", () => {
  assert.match(dashboard, /r2v-commandbar/);
  assert.match(overview, /overview-priority/);
  assert.match(overview, /evidence-track/);
});

test("keeps evidence-heavy views visually distinct and traceable", () => {
  assert.match(heatmap, /evidence-drawer/);
  assert.match(reasons, /reason-stance/);
  assert.match(annotators, /deviation-track/);
});
