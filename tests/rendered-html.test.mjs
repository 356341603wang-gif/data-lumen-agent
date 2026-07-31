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

test("server-renders the R2V disagreement analysis agent", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>R2V 标注分歧分析 Agent<\/title>/i);
  assert.match(html, /把分歧/);
  assert.match(html, /对齐/);
  assert.match(html, /的证据/);
  assert.match(html, /把导出表格拖到这里/);
  assert.match(html, /浏览器本地分析/);
  assert.match(html, /物品 · 场景 · 音频/);
  assert.match(html, /无需字段确认/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the R2V analysis engine and removes generic dashboard copy", async () => {
  const [page, analysis, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/r2v/analyze.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /XLSX\.read/);
  assert.match(page, /sheet_to_json/);
  assert.match(page, /analyzeR2VRows/);
  assert.match(page, /createR2VMarkdownReport/);
  assert.match(analysis, /export function analyzeR2VRows/);
  assert.match(analysis, /calculateDimensionStats/);
  assert.match(analysis, /findR2VConflicts/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(packageJson, /"xlsx"/);
  assert.doesNotMatch(page, /字段画像|关系洞察|createAgentAnswer/);
});
