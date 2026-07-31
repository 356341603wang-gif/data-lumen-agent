import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ships conclusions-first views and plain-language metric help", async () => {
  const files = await Promise.all(
    [
      "R2VDashboard.tsx",
      "AnalysisOverview.tsx",
      "DimensionRanking.tsx",
      "QuestionRanking.tsx",
      "DisagreementHeatmap.tsx",
      "ReasonAndConflictViews.tsx",
      "AnnotatorAndCoverageViews.tsx",
      "MetricHelp.tsx",
    ].map((name) =>
      readFile(new URL(`../app/r2v/${name}`, import.meta.url), "utf8"),
    ),
  );
  const source = files.join("\n");
  for (const copy of [
    "维度分歧榜",
    "单题分歧榜",
    "题目 × 维度",
    "答案分布",
    "严重分歧",
    "混乱度",
    "原因汇总",
    "总分与维度冲突",
    "标注员偏差",
    "完成覆盖",
    "怎么理解",
  ]) {
    assert.match(source, new RegExp(copy));
  }
  assert.doesNotMatch(source, /确认字段映射|请确认字段/);
});

