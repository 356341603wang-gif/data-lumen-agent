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

test("normalizes flat legacy scene dimensions by REF", () => {
  const result = normalizeR2VRows([
    {
      name: "zcy-0723-726",
      操作人: "刘爽205",
      ref_1: "one.mp4",
      ref_2: "two.mp4",
      答案: JSON.stringify({
        data: {
          refConsistencyScores: [3, 4],
          consistencyDimensions: [
            "YES",
            "NO",
            "YES",
            "YES",
            "NA",
            "NO",
            "NO",
            "YES",
            "NO",
            "YES",
            "YES",
            "YES",
          ],
          consistencyDimensionReasons: [
            "布局1",
            "锚点1",
            "视角1",
            "状态1",
            "主体1",
            "覆盖1",
            "布局2",
            "锚点2",
            "视角2",
            "状态2",
            "主体2",
            "覆盖2",
          ],
          valueRefGroups: [[0, 1]],
          valueScores: [2],
          valueReasons: ["增量信息较多"],
        },
      }),
    },
  ]);

  const submission = result.submissions[0];
  assert.equal(result.schema.taskType, "scene");
  assert.equal(submission.dimensions.length, 12);
  assert.deepEqual(
    submission.dimensions
      .filter((item) => item.entityKey === "ref_2")
      .map((item) => [item.dimensionId, item.answer, item.reason]),
    [
      ["spaceLayout", "NO", "布局2"],
      ["anchor", "YES", "锚点2"],
      ["viewpoint", "NO", "视角2"],
      ["state", "YES", "状态2"],
      ["subjectComposition", "YES", "主体2"],
      ["coverage", "YES", "覆盖2"],
    ],
  );
});

test("normalizes legacy scene multi-view and value group aliases", () => {
  const result = normalizeR2VRows([
    {
      name: "zcy-0723-726",
      ref_1: "one.mp4",
      ref_2: "two.mp4",
      答案: JSON.stringify({
        data: {
          refConsistencyScores: [3, 4],
          consistencyDimensions: Array.from({ length: 12 }, () => "YES"),
          consistencyDimensionReasons: Array.from(
            { length: 12 },
            () => "一致",
          ),
          multiViewRefGroups: [[0, 1]],
          multiViewScores: [3],
          multiViewDimensions: [["YES", "YES", "NO", "YES", "NA", "YES"]],
          multiViewDimensionReasons: [
            ["布局", "锚点", "视角", "状态", "主体", "覆盖"],
          ],
          valueRefGroups: [[0, 1]],
          valueScores: [2],
          valueReasons: ["增量信息较多"],
        },
      }),
    },
  ]);

  const submission = result.submissions[0];
  assert.deepEqual(
    submission.groups.map((group) => [
      group.entityKind,
      group.refIndexes,
    ]),
    [
      ["multiview", [0, 1]],
      ["scene-group", [0, 1]],
    ],
  );
  assert.deepEqual(
    submission.scores.map((score) => [
      score.entityKey,
      score.scoreType,
      score.value,
      score.reason,
    ]),
    [
      ["ref_1", "consistency", 3, undefined],
      ["ref_2", "consistency", 4, undefined],
      ["multiview_1", "consistency", 3, undefined],
      ["scene_group_1", "value", 2, "增量信息较多"],
    ],
  );
});
