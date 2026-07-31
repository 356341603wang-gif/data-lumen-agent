import assert from "node:assert/strict";
import test from "node:test";
import {
  dimensionAction,
  dimensionDiagnosis,
  dimensionQuestionKeys,
} from "../lib/r2v/dimension-presentation.ts";

function dimension(overrides = {}) {
  return {
    taskType: "audio",
    dimensionId: "environment",
    dimensionLabel: "环境声场一致",
    validCellCount: 50,
    disputedCellCount: 49,
    severeCellCount: 38,
    disagreementOccurrenceRate: 0.98,
    severeDisagreementRate: 0.76,
    meanDisagreementDegree: 0.448,
    meanConsistencyRate: 0.552,
    meanEntropy: 0.769,
    answerDistribution: [],
    ...overrides,
  };
}

function cell({
  questionKey,
  dimensionId = "environment",
  severe = false,
  hasDisagreement = false,
}) {
  return {
    taskType: "audio",
    cellKey: `${questionKey}::ref-1::${dimensionId}`,
    questionKey,
    entityKey: "ref-1",
    entityKind: "ref",
    dimensionId,
    dimensionLabel: dimensionId,
    answers: [],
    sampleSize: 10,
    distribution: [],
    majorityAnswer: "YES",
    majorityTied: false,
    consistencyRate: severe ? 0.6 : 0.7,
    disagreementDegree: severe ? 0.4 : 0.3,
    hasDisagreement,
    severe,
    entropy: severe ? 0.9 : 0.5,
  };
}

test("classifies dimension rows by the share of severe question cells", () => {
  assert.deepEqual(dimensionAction(dimension()), {
    level: "priority",
    label: "优先对齐",
  });
  assert.deepEqual(
    dimensionAction(
      dimension({
        severeCellCount: 10,
        severeDisagreementRate: 0.2,
      }),
    ),
    {
      level: "watch",
      label: "建议关注",
    },
  );
  assert.deepEqual(
    dimensionAction(
      dimension({
        severeCellCount: 0,
        severeDisagreementRate: 0,
      }),
    ),
    {
      level: "stable",
      label: "相对稳定",
    },
  );
});

test("turns the dimension statistics into a plain-language diagnosis", () => {
  assert.equal(
    dimensionDiagnosis(dimension()),
    "50 个有效题目单元中，38 个没有形成稳定多数意见，需要优先统一判断边界。",
  );
  assert.equal(
    dimensionDiagnosis(
      dimension({
        disputedCellCount: 0,
        severeCellCount: 0,
        disagreementOccurrenceRate: 0,
        severeDisagreementRate: 0,
      }),
    ),
    "50 个有效题目单元目前都形成了稳定意见，可暂不作为对齐重点。",
  );
});

test("selects unique severe questions before ordinary disputed questions", () => {
  const cells = [
    cell({ questionKey: "q1", severe: true, hasDisagreement: true }),
    cell({ questionKey: "q1", severe: true, hasDisagreement: true }),
    cell({ questionKey: "q2", severe: true, hasDisagreement: true }),
    cell({ questionKey: "q3", hasDisagreement: true }),
    cell({
      questionKey: "q-other",
      dimensionId: "tone",
      severe: true,
      hasDisagreement: true,
    }),
  ];

  assert.deepEqual(dimensionQuestionKeys(cells, "environment"), ["q1", "q2"]);
  assert.deepEqual(
    dimensionQuestionKeys(
      cells.map((item) =>
        item.dimensionId === "environment" ? { ...item, severe: false } : item,
      ),
      "environment",
    ),
    ["q1", "q2", "q3"],
  );
});
