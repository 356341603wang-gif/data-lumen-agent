import assert from "node:assert/strict";
import test from "node:test";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";
import { createR2VDemoRows } from "../lib/r2v/demo.ts";
import {
  createAnnotatorCsv,
  createConflictCsv,
  createDimensionCsv,
  createQuestionCsv,
  createR2VMarkdownReport,
  createReasonCsv,
} from "../lib/r2v/export.ts";

test("exports readable reports with metric definitions and sample sizes", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  const markdown = createR2VMarkdownReport(result);
  assert.match(markdown, /维度分歧榜/);
  assert.match(markdown, /严重分歧率/);
  assert.match(markdown, /有效样本/);
  assert.match(createDimensionCsv(result), /平均分歧度/);
  assert.match(createQuestionCsv(result), /严重分歧维度数/);
  assert.match(createReasonCsv(result), /答案选项/);
  assert.match(createConflictCsv(result), /问题类型/);
  assert.match(createAnnotatorCsv(result), /多数答案一致率/);
});

test("quotes commas, quotes and new lines using RFC 4180", () => {
  const result = analyzeR2VRows(createR2VDemoRows(), "demo.csv");
  result.reasonSummaries[0].clusters[0].examples[0].reason =
    '包含逗号, "引号"\n以及换行';
  const csv = createReasonCsv(result);
  assert.match(csv, /"包含逗号, ""引号""\n以及换行"/);
});

