import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import {
  analyzeRows,
  createDemoRows,
} from "../lib/analysis.ts";

test("profiles a mixed business dataset and creates useful analysis modules", () => {
  const result = analyzeRows(createDemoRows(), "demo.xlsx", "经营数据");

  assert.equal(result.rowCount, 720);
  assert.equal(result.columnCount, 9);
  assert.ok(result.numericColumns.length >= 4);
  assert.ok(result.categoryColumns.length >= 3);
  assert.ok(result.dateColumns.length >= 1);
  assert.ok(result.segment);
  assert.ok(result.trend);
  assert.ok(result.insights.length >= 2);
  assert.ok(result.qualityScore > 80);
});

test("detects missing values, duplicates, outliers and correlations", () => {
  const rows = Array.from({ length: 10 }, (_, index) => ({
    group: index < 5 ? "A" : "B",
    x: index + 1,
    y: (index + 1) * 2,
    note: index < 2 ? null : "ok",
  }));
  rows.push(
    { group: "B", x: 100, y: 200, note: "ok" },
    { group: "B", x: 100, y: 200, note: "ok" },
  );
  const result = analyzeRows(rows, "quality.csv", "Sheet1");

  assert.equal(result.duplicateCount, 1);
  assert.equal(result.columns.find((column) => column.name === "note")?.missingCount, 2);
  assert.ok(Math.abs(result.correlations[0].value) > 0.99);
  assert.ok(result.numericColumns.some((column) => column.numeric?.outlierCount));
});

test("accepts an in-memory Excel workbook through the same row shape", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([
    { 日期: "2026-01-01", 类目: "甲", 数量: 12 },
    { 日期: "2026-02-01", 类目: "乙", 数量: 19 },
    { 日期: "2026-03-01", 类目: "甲", 数量: 27 },
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "数据");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  const parsed = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json(parsed.Sheets.数据, {
    defval: null,
    raw: true,
  });
  const result = analyzeRows(rows, "upload.xlsx", "数据");

  assert.equal(result.rowCount, 3);
  assert.equal(result.columnCount, 3);
  assert.equal(result.categoryColumns[0].name, "类目");
  assert.ok(result.trend);
});
