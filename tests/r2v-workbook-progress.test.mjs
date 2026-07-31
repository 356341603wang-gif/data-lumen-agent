import assert from "node:assert/strict";
import test from "node:test";

test("reports visible, monotonic progress while parsing a workbook", async () => {
  let parseR2VWorkbookFile;
  try {
    ({ parseR2VWorkbookFile } = await import("../lib/r2v/workbook.ts"));
  } catch {
    parseR2VWorkbookFile = undefined;
  }

  assert.equal(typeof parseR2VWorkbookFile, "function");

  const file = new File(
    ["name,uid,ref_1\ndxq_0730_574,question-1,audio.mp3\n"],
    "标注结果.csv",
    { type: "text/csv" },
  );
  const progress = [];
  const workbook = await parseR2VWorkbookFile(file, (update) => {
    progress.push(update);
  });

  assert.equal(workbook.fileName, "标注结果.csv");
  assert.equal(workbook.sheets[0].rows[0].name, "dxq_0730_574");
  assert.deepEqual(
    progress.map((update) => update.percent),
    [8, 24, 52, 78, 96, 100],
  );
  assert.deepEqual(
    progress.map((update) => update.stage),
    [
      "已收到文件",
      "正在读取文件",
      "正在解析工作表",
      "正在整理字段与答案",
      "正在生成分析",
      "解析完成",
    ],
  );
  assert.ok(
    progress.every((update) => update.fileName === "标注结果.csv"),
  );
});
