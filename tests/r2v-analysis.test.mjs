import assert from "node:assert/strict";
import test from "node:test";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";
import { createR2VDemoRows } from "../lib/r2v/demo.ts";

test("returns the ten agreed analysis modules without field confirmation", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  assert.equal(result.taskType, "audio");
  assert.equal(result.requiresFieldConfirmation, false);
  assert.equal(result.coverage.totalRowCount, 44);
  assert.equal(result.coverage.completedSubmissionCount, 40);
  assert.equal(result.coverage.questionCount, 4);
  assert.ok(result.dimensionRanking.length);
  assert.ok(result.questionRanking.length);
  assert.ok(result.heatmap.cells.length);
  assert.ok(result.answerDistributions.length);
  assert.ok(result.reasonSummaries.length);
  assert.ok(result.scoreConflicts.length);
  assert.ok(result.annotatorStats.length);
  assert.ok(result.headlines.length >= 3);
});

test("keeps completion coverage separate from disagreement cells", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  assert.equal(result.coverage.unfinishedSubmissionCount, 4);
  assert.ok(result.heatmap.cells.every((cell) => cell.sampleSize === 10));
});

test("updates question conflict counts after rule evaluation", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  const question = result.questionRanking.find(
    (item) => item.questionKey === "音频示例 1",
  );
  assert.ok((question?.conflictCount ?? 0) > 0);
});
