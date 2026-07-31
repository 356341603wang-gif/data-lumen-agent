import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import XLSX from "xlsx";
import { analyzeR2VRows } from "../lib/r2v/analyze.ts";

const input = process.argv[2];
if (!input) {
  console.error("用法：node scripts/analyze-r2v-file.mjs <CSV/XLSX 文件>");
  process.exit(1);
}

const filePath = resolve(input);
const extension = extname(filePath).toLowerCase();
if (![".csv", ".tsv", ".xls", ".xlsx"].includes(extension)) {
  console.error("仅支持 CSV、TSV、XLS 和 XLSX 文件");
  process.exit(1);
}

const workbook = XLSX.read(readFileSync(filePath), {
  type: "buffer",
  raw: true,
  cellDates: true,
});
const sheetName = workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
  defval: null,
  raw: true,
});

try {
  const result = analyzeR2VRows(rows, filePath);
  console.log(
    JSON.stringify(
      {
        taskType: result.taskType,
        totalRows: result.coverage.totalRowCount,
        completedSubmissions: result.coverage.completedSubmissionCount,
        questionCount: result.coverage.questionCount,
        questionField: result.schema.questionField ?? "素材组合哈希",
        annotatorField: result.schema.annotatorField ?? null,
        answerField: result.schema.answerField ?? null,
        topDimension: result.dimensionRanking[0]?.dimensionLabel ?? null,
        conflictCount: result.scoreConflicts.length,
        requiresFieldConfirmation: result.requiresFieldConfirmation,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

