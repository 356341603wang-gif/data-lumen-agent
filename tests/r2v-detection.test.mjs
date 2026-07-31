import assert from "node:assert/strict";
import test from "node:test";
import { detectR2VSchema } from "../lib/r2v/detect.ts";

test("detects audio and chooses repeated uid instead of unique assignment id", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    题目ID: `assignment-${index}`,
    uid: index < 5 ? "question-a" : "question-b",
    "[标注]操作人": `worker-${index % 5}`,
    ref_1: "audio.mp3",
    "最终结果-JSON": JSON.stringify({
      data: { refToneConsistency: ["YES"], refConsistencyScores: [5] },
    }),
  }));
  const schema = detectR2VSchema(rows);
  assert.equal(schema.taskType, "audio");
  assert.equal(schema.questionField, "uid");
  assert.equal(schema.annotatorField, "[标注]操作人");
  assert.equal(schema.answerField, "最终结果-JSON");
  assert.equal(schema.assignmentField, "题目ID");
  assert.equal(schema.requiresConfirmation, false);
});

test("uses name as the question identifier when name and uid are both present", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    题目ID: `assignment-${index}`,
    uid: index < 5 ? "platform-question-a" : "platform-question-b",
    name: index < 5 ? "dxq_0730_574" : "dxq_0730_575",
    "[标注]操作人": `worker-${index % 5}`,
    ref_1: "audio.mp3",
    "最终结果-JSON": JSON.stringify({
      data: { refToneConsistency: ["YES"], refConsistencyScores: [5] },
    }),
  }));

  const schema = detectR2VSchema(rows);

  assert.equal(schema.questionField, "name");
});

test("detects object and scene from their answer keys", () => {
  const objectSchema = detectR2VSchema([
    {
      uid: "o1",
      ref_1: "one.png",
      答案: JSON.stringify({
        data: {
          consistencyDimensions: [[["YES"]]],
          singleRefValueScores: [2],
        },
      }),
    },
  ]);
  const sceneSchema = detectR2VSchema([
    {
      uid: "s1",
      ref_1: "one.mp4",
      答案: JSON.stringify({
        data: {
          sceneGroupRefIndexes: [[0]],
          spaceLayoutConsistency: ["YES"],
        },
      }),
    },
  ]);
  assert.equal(objectSchema.taskType, "object");
  assert.equal(sceneSchema.taskType, "scene");
});

test("falls back to stable asset fields without blocking", () => {
  const schema = detectR2VSchema([
    {
      target_video: "target.mp4",
      ref_1: "one.mp3",
      ref_3: "three.mp3",
      refToneConsistency: '["YES",null,"HIGH_SIMILARITY"]',
    },
  ]);
  assert.equal(schema.taskType, "audio");
  assert.equal(schema.questionField, undefined);
  assert.deepEqual(schema.refFields, [
    { field: "ref_1", index: 0 },
    { field: "ref_3", index: 2 },
  ]);
  assert.ok(schema.notes.some((note) => note.includes("素材组合")));
});

test("prefers the parseable answer object over a human-readable final-result column", () => {
  const schema = detectR2VSchema([
    {
      uid: "q1",
      ref_1: "one.mp3",
      "最终结果-JSON": "操作人：A，答案：refToneConsistency：[YES]",
      答案: JSON.stringify({
        data: {
          refToneConsistency: ["YES"],
          refConsistencyScores: [5],
        },
      }),
    },
  ]);
  assert.equal(schema.answerField, "答案");
  assert.equal(schema.taskType, "audio");
});
