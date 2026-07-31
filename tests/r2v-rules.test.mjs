import assert from "node:assert/strict";
import test from "node:test";
import { findR2VConflicts } from "../lib/r2v/conflicts.ts";
import { summarizeReasons } from "../lib/r2v/reasons.ts";

function makeAudioSubmission({
  score = 3,
  general = "NO",
  tone = "HIGH_SIMILARITY",
  toneReason = "",
  emotion,
  annotator = "A",
} = {}) {
  const dimensions = [
    {
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId: "general",
      answer: general,
    },
    {
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId: "tone",
      answer: tone,
      reason: toneReason,
    },
  ];
  if (emotion) {
    dimensions.push({
      entityKey: "ref_1",
      entityKind: "ref",
      refIndex: 0,
      dimensionId: "emotion",
      answer: emotion,
    });
  }
  return [
    {
      taskType: "audio",
      questionKey: "q1",
      annotator,
      completed: true,
      abandoned: false,
      refSlots: [0],
      dimensions,
      scores: [
        {
          entityKey: "ref_1",
          entityKind: "ref",
          refIndex: 0,
          scoreType: "consistency",
          value: score,
        },
      ],
      groups: [],
      rawRowIndex: 0,
      raw: {},
      parseWarnings: [],
    },
  ];
}

function makeAudioSubmissions(items) {
  return items.map(
    (item, index) =>
      makeAudioSubmission({
        tone: item.tone,
        toneReason: item.reason,
        annotator: `worker-${index + 1}`,
      })[0],
  );
}

test("keeps reasons separated by dimension and selected answer", () => {
  const groups = summarizeReasons(
    makeAudioSubmissions([
      { tone: "YES", reason: "音色和声线相同" },
      { tone: "YES", reason: "声线一致，音高接近" },
      { tone: "LOW_SIMILARITY", reason: "鼻音和厚度差异明显" },
    ]),
  );
  assert.equal(
    groups.find((item) => item.answer === "YES")?.reasonCount,
    2,
  );
  assert.equal(
    groups.find((item) => item.answer === "LOW_SIMILARITY")?.reasonCount,
    1,
  );
  assert.ok(
    groups
      .find((item) => item.answer === "YES")
      ?.clusters.some((cluster) => cluster.label === "声线与音高"),
  );
});

test("flags audio score 5 when general consistency is not YES", () => {
  const conflicts = findR2VConflicts(
    makeAudioSubmission({
      score: 5,
      general: "NO",
      tone: "YES",
      toneReason: "声线相同",
    }),
  );
  assert.ok(
    conflicts.some((item) => item.code === "AUDIO_5_GENERAL_NOT_YES"),
  );
});

test("does not require reasons for audio emotion consistency", () => {
  const conflicts = findR2VConflicts(
    makeAudioSubmission({
      score: 3,
      general: "NO",
      tone: "HIGH_SIMILARITY",
      toneReason: "声线接近",
      emotion: "HIGH_SIMILARITY",
    }),
  );
  assert.ok(
    !conflicts.some(
      (item) =>
        item.dimensionId === "emotion" && item.code === "MISSING_REASON",
    ),
  );
});

test("skips business completeness checks for abandoned submissions", () => {
  const abandoned = {
    ...makeAudioSubmission()[0],
    abandoned: true,
    dimensions: [],
    scores: [],
  };
  assert.deepEqual(findR2VConflicts([abandoned]), []);
});

test("marks missing required object reasons as deterministic errors", () => {
  const submission = {
    taskType: "object",
    questionKey: "object-1",
    annotator: "A",
    completed: true,
    abandoned: false,
    refSlots: [0],
    dimensions: [
      {
        entityKey: "ref_1",
        entityKind: "ref",
        refIndex: 0,
        dimensionId: "shape",
        answer: "YES",
      },
    ],
    scores: [
      {
        entityKey: "ref_1",
        entityKind: "ref",
        refIndex: 0,
        scoreType: "consistency",
        value: 5,
      },
    ],
    groups: [],
    rawRowIndex: 3,
    raw: {},
    parseWarnings: [],
  };
  const conflicts = findR2VConflicts([submission]);
  assert.ok(
    conflicts.some(
      (item) =>
        item.code === "MISSING_REASON" && item.dimensionId === "shape",
    ),
  );
  assert.ok(
    conflicts.some((item) => item.code === "MISSING_DIMENSION_ANSWER"),
  );
});

