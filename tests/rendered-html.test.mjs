import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the R2V data analysis system", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>R2V 数据分析系统<\/title>/i);
  assert.match(html, /R2V/);
  assert.match(html, /数据分析/);
  assert.match(html, /系统/);
  assert.doesNotMatch(html, /把分歧变成|可对齐的证据/);
  assert.match(html, /把导出表格拖到这里/);
  assert.match(html, /浏览器本地分析/);
  assert.match(html, /物品 · 场景 · 音频/);
  assert.match(html, /无需字段确认/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the R2V analysis engine and removes generic dashboard copy", async () => {
  const [page, workbook, analysis, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/r2v/workbook.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/r2v/analyze.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /parseR2VWorkbookFile/);
  assert.match(workbook, /XLSX\.read/);
  assert.match(workbook, /sheet_to_json/);
  assert.match(page, /analyzeR2VRows/);
  assert.match(page, /createR2VMarkdownReport/);
  assert.match(analysis, /export function analyzeR2VRows/);
  assert.match(analysis, /calculateDimensionStats/);
  assert.match(analysis, /findR2VConflicts/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(packageJson, /"xlsx"/);
  assert.doesNotMatch(page, /字段画像|关系洞察|createAgentAnswer/);
});
