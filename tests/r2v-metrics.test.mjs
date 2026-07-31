import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAnnotatorStats,
  calculateCellStats,
  calculateDimensionStats,
  calculateDistributionMetrics,
  calculateQuestionStats,
  calculateScoreStats,
} from "../lib/r2v/metrics.ts";

test("calculates 7 YES and 3 NO as 70% consistency and 30% disagreement", () => {
  const result = calculateDistributionMetrics([
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "NO",
    "NO",
    "NO",
  ]);
  assert.equal(result.sampleSize, 10);
  assert.equal(result.consistencyRate, 0.7);
  assert.equal(result.disagreementDegree, 0.3);
  assert.equal(result.hasDisagreement, true);
  assert.equal(result.severe, false);
});

test("marks a 6 to 4 split as severe at the inclusive 60% threshold", () => {
  const result = calculateDistributionMetrics([
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "NO",
    "NO",
    "NO",
    "NO",
  ]);
  assert.equal(result.consistencyRate, 0.6);
  assert.equal(result.severe, true);
});

test("gives four-way answers higher entropy than a two-way 7 to 3 split", () => {
  const twoWay = calculateDistributionMetrics([
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "YES",
    "NO",
    "NO",
    "NO",
  ]);
  const fourWay = calculateDistributionMetrics([
    "YES",
    "YES",
    "YES",
    "HIGH_SIMILARITY",
    "HIGH_SIMILARITY",
    "HIGH_SIMILARITY",
    "LOW_SIMILARITY",
    "LOW_SIMILARITY",
    "UNKNOWN",
    "UNKNOWN",
  ]);
  assert.ok(fourWay.entropy > twoWay.entropy);
});

function makeSubmission(questionKey, annotator, answers, score) {
  return {
    taskType: "audio",
    questionKey,
    annotator,
    completed: true,
    abandoned: false,
    refSlots: [0],
    dimensions: Object.entries(answers).map(([dimensionId, answer]) => ({
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId,
      answer,
    })),
    scores: [
      {
        entityKey: "ref_1",
        entityKind: "ref",
        refIndex: 0,
        scoreType: "consistency",
        value: score,
      },
    ],
    rawRowIndex: 0,
    raw: {},
    parseWarnings: [],
  };
}

function aggregateFixture() {
  return [
    makeSubmission(
      "qA",
      "A",
      { tone: "YES", environment: "YES", emotion: "YES" },
      5,
    ),
    makeSubmission(
      "qA",
      "B",
      { tone: "YES", environment: "YES", emotion: "HIGH_SIMILARITY" },
      5,
    ),
    makeSubmission(
      "qA",
      "C",
      { tone: "YES", environment: "NO", emotion: "LOW_SIMILARITY" },
      3,
    ),
    makeSubmission(
      "qA",
      "D",
      { tone: "YES", environment: "NO", emotion: "UNKNOWN" },
      3,
    ),
    makeSubmission(
      "qB",
      "A",
      { tone: "YES", environment: "YES", emotion: "YES" },
      3,
    ),
    makeSubmission(
      "qB",
      "B",
      { tone: "YES", environment: "YES", emotion: "YES" },
      3,
    ),
    makeSubmission(
      "qB",
      "C",
      { tone: "YES", environment: "YES", emotion: "YES" },
      3,
    ),
    makeSubmission(
      "qB",
      "D",
      { tone: "NO", environment: "NO", emotion: "YES" },
      1,
    ),
  ];
}

test("aggregates by dimension and question without mixing cells", () => {
  const submissions = aggregateFixture();
  const cells = calculateCellStats(submissions);
  const dimensions = calculateDimensionStats(cells);
  const scoreStats = calculateScoreStats(submissions);
  const questions = calculateQuestionStats(cells, scoreStats);

  const environment = dimensions.find(
    (item) => item.dimensionId === "environment",
  );
  const tone = dimensions.find((item) => item.dimensionId === "tone");
  const questionA = questions.find((item) => item.questionKey === "qA");

  assert.equal(environment?.disagreementOccurrenceRate, 1);
  assert.equal(tone?.disagreementOccurrenceRate, 0.5);
  assert.equal(questionA?.disputedDimensionCount, 2);
  assert.equal(questionA?.severeDimensionCount, 2);
  assert.equal(questionA?.scoreSpread, 2);
});

test("calculates annotator deviation only on cells with a unique majority", () => {
  const submissions = aggregateFixture();
  const cells = calculateCellStats(submissions);
  const annotators = calculateAnnotatorStats(submissions, cells);
  const workerD = annotators.find((item) => item.annotator === "D");

  assert.equal(workerD?.comparableCellCount, 4);
  assert.equal(workerD?.majorityAlignmentRate, 0.5);
  assert.equal(workerD?.completedCount, 2);
});

