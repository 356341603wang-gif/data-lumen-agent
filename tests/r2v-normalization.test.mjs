import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeR2VRows,
  parseArrayish,
} from "../lib/r2v/normalize.ts";

test("parses JSON-like arrays without flattening nested structures", () => {
  assert.deepEqual(parseArrayish('["YES",null,"NO"]'), ["YES", null, "NO"]);
  assert.deepEqual(parseArrayish("YES"), ["YES"]);
  assert.deepEqual(parseArrayish(null), []);
});

test("preserves a missing ref_2 slot and maps ref_3 to index 2", () => {
  const rows = [
    {
      uid: "q1",
      ref_1: "one.mp3",
      ref_2: "",
      ref_3: "three.mp3",
      "[标注]操作人": "A",
      "最终结果-JSON": JSON.stringify({
        data: {
          refConsistencyScores: [5, null, 3],
          refGeneralConsistency: ["YES", null, "NO"],
          refToneConsistency: ["YES", null, "HIGH_SIMILARITY"],
          refToneConsistencyReason: ["同源", null, "音色接近"],
        },
      }),
    },
  ];
  const result = normalizeR2VRows(rows);
  assert.deepEqual(result.submissions[0].refSlots, [0, 2]);
  assert.equal(
    result.submissions[0].dimensions.find((item) => item.refIndex === 2)
      ?.entityKey,
    "ref_3",
  );
  assert.equal(
    result.submissions[0].dimensions.find(
      (item) => item.refIndex === 2 && item.dimensionId === "tone",
    )?.reason,
    "音色接近",
  );
});

test("uses [标注]操作人 as the annotator name when another operator field exists", () => {
  const result = normalizeR2VRows([
    {
      uid: "q1",
      ref_1: "one.mp3",
      操作人: "平台操作账号",
      "[标注]操作人": "张同学",
      "最终结果-JSON": JSON.stringify({
        data: {
          refConsistencyScores: [5],
          refGeneralConsistency: ["YES"],
          refToneConsistency: ["YES"],
          refToneConsistencyReason: ["同源"],
        },
      }),
    },
  ]);

  assert.equal(result.schema.annotatorField, "[标注]操作人");
  assert.equal(result.submissions[0].annotator, "张同学");
});

test("keeps unfinished rows for coverage but not as completed submissions", () => {
  const result = normalizeR2VRows(
    [{ uid: "q1", ref_1: "one.mp3", "最终结果-JSON": "" }],
    "audio",
  );
  assert.equal(result.submissions.length, 1);
  assert.equal(result.submissions[0].completed, false);
});

test("normalizes flattened audio value fields for target and REF separately", () => {
  const result = normalizeR2VRows(
    [
      {
        uid: "q1",
        ref_1: "one.mp3",
        "[标注]操作人": "A",
        "[标注]refConsistencyScores": "[3]",
        "[标注]refToneConsistency": '["高度相似"]',
        "[标注]refToneConsistencyReason": '["声线接近"]',
        "[标注]refGeneralConsistency": '["No"]',
        "[标注]targetValueScore": "高",
        "[标注]targetClarityIntegrity": "YES",
        "[标注]targetClarityIntegrityReason": "人声清楚",
        "[标注]targetEmotionRange": "NO",
        "[标注]targetEmotionRangeReason": "情绪平稳",
        "[标注]refValueScores": '["中"]',
        "[标注]refClarityIntegrityList": '["NO"]',
        "[标注]refClarityIntegrityReasonList": '["有混响"]',
        "[标注]refEmotionRangeList": '["YES"]',
        "[标注]refEmotionRangeReasonList": '["起伏明显"]',
      },
    ],
    "audio",
  );
  const submission = result.submissions[0];
  assert.equal(submission.completed, true);
  assert.equal(
    submission.scores.find((item) => item.entityKey === "target")?.value,
    "HIGH",
  );
  assert.equal(
    submission.dimensions.find(
      (item) =>
        item.entityKey === "ref_1" &&
        item.dimensionId === "clarityIntegrity",
    )?.reason,
    "有混响",
  );
});

test("marks abandoned answers without requiring business fields", () => {
  const result = normalizeR2VRows(
    [
      {
        uid: "q1",
        ref_1: "one.mp3",
        "最终结果-JSON": JSON.stringify({
          isAbandoned: true,
          data: {},
        }),
      },
    ],
    "audio",
  );
  assert.equal(result.submissions[0].abandoned, true);
  assert.equal(result.submissions[0].completed, true);
});
