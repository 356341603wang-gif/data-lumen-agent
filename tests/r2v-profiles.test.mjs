import assert from "node:assert/strict";
import test from "node:test";
import {
  R2V_PROFILES,
  getDimensionRule,
  normalizeAnswer,
} from "../lib/r2v/profiles.ts";

test("keeps task score scales and answer semantics separate", () => {
  assert.deepEqual(R2V_PROFILES.audio.consistencyScores, [0, 1, 3, 5]);
  assert.deepEqual(R2V_PROFILES.scene.consistencyScores, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(R2V_PROFILES.object.consistencyScores, [
    0,
    1,
    2,
    3,
    4,
    5,
    "SKIP",
  ]);
  assert.equal(
    normalizeAnswer("audio", "tone", "HIGH_SIMILARITY"),
    "HIGH_SIMILARITY",
  );
  assert.equal(normalizeAnswer("audio", "general", "无法判断"), "UNKNOWN");
  assert.equal(
    normalizeAnswer("scene", "subjectComposition", "N/A"),
    "NA",
  );
  assert.equal(normalizeAnswer("object", "scene", "不考虑"), "NA");
});

test("marks only audio tone as requiring a consistency reason", () => {
  const audio = R2V_PROFILES.audio;
  assert.equal(
    audio.dimensions.find((item) => item.id === "tone")?.reasonRequired,
    true,
  );
  assert.equal(
    audio.dimensions.find((item) => item.id === "emotion")?.reasonRequired,
    false,
  );
  assert.equal(getDimensionRule("audio", "tone")?.label, "音色一致");
});

test("exposes all task dimensions in the documented order", () => {
  assert.deepEqual(
    R2V_PROFILES.audio.dimensions.map((item) => item.id),
    [
      "general",
      "tone",
      "dialect",
      "emotion",
      "style",
      "environment",
      "scenario",
    ],
  );
  assert.deepEqual(
    R2V_PROFILES.scene.dimensions.map((item) => item.id),
    [
      "spaceLayout",
      "anchor",
      "viewpoint",
      "state",
      "subjectComposition",
      "coverage",
    ],
  );
  assert.deepEqual(
    R2V_PROFILES.object.dimensions.map((item) => item.id),
    [
      "shape",
      "textPattern",
      "material",
      "color",
      "camera",
      "scene",
      "coverage",
    ],
  );
});
