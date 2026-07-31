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
const dimensions = await readFile(
  new URL("../app/r2v/DimensionRanking.tsx", import.meta.url),
  "utf8",
);
const questions = await readFile(
  new URL("../app/r2v/QuestionRanking.tsx", import.meta.url),
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
  assert.match(page, /role="progressbar"/);
  assert.match(page, /aria-valuenow/);
  assert.match(page, /upload-progress__rail/);
  assert.match(page, /Data Atelier/);
  assert.match(page, /R2V 数据分析系统/);
  assert.match(page, /upload-headline__lead">R2V/);
  assert.match(page, /<mark>数据分析<\/mark>/);
  assert.doesNotMatch(page, /把分歧变成|可对齐/);
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
  assert.match(annotators, /标注员姓名/);
  assert.match(annotators, /姓名来源：/);
  assert.match(annotators, /analysis\.schema\.annotatorField/);
});

test("turns the dimension ranking into an action-first evidence view", () => {
  for (const copy of [
    "建议优先讨论",
    "严重分歧题",
    "全部标注答案构成",
    "查看相关题目",
    "详细指标",
  ]) {
    assert.match(dimensions, new RegExp(copy));
  }
  assert.doesNotMatch(dimensions, /metric-switch/);
  assert.match(dimensions, /dimension-severity-track/);
  assert.match(dimensions, /showPercentages/);
});

test("supports drilling from a dimension into its related questions", () => {
  assert.match(dashboard, /onViewQuestions/);
  assert.match(dashboard, /dimensionFilter/);
  assert.match(questions, /dimension-question-filter/);
  assert.match(questions, /清除筛选/);
});

test("keeps the action-first dimension ranking readable on narrow screens", () => {
  for (const selector of [
    ".dimension-summary",
    ".dimension-severity-track",
    ".dimension-row__details",
    ".dimension-question-filter",
  ]) {
    assert.match(
      css,
      new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(
    css,
    /@media \(max-width: 800px\)[\s\S]*?\.dimension-row\s*\{[\s\S]*?min-width:\s*0/,
  );
});
