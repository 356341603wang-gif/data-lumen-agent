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

test("server-renders the spreadsheet analysis agent", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Data Lumen · 表格可视化分析 Agent<\/title>/i);
  assert.match(html, /把表格/);
  assert.match(html, /变成/);
  assert.match(html, /将表格拖到这里/);
  assert.match(html, /浏览器本地分析/);
  assert.match(html, /支持 \.xlsx \/ \.xls \/ \.csv \/ \.tsv/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the analysis engine and removes starter preview code", async () => {
  const [page, analysis, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/analysis.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /XLSX\.read/);
  assert.match(page, /sheet_to_json/);
  assert.match(page, /createAgentAnswer/);
  assert.match(page, /downloadReport/);
  assert.match(analysis, /export function analyzeRows/);
  assert.match(analysis, /buildCorrelations/);
  assert.match(analysis, /buildInsights/);
  assert.match(layout, /lang="zh-CN"/);
  assert.match(packageJson, /"xlsx"/);
  assert.doesNotMatch(page, /SkeletonPreview|react-loading-skeleton/);
});
